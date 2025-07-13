import cron from 'node-cron';
import chalk from 'chalk';
import { PARSERS } from '../config/parsers.js';
import database from '../adapters/database.js';

export class ProductionScheduler {
  constructor() {
    this.db = database;
    this.isRunning = false;
    this.currentJob = null;
    this.stats = {
      totalRuns: 0,
      lastRunTime: null,
      lastRunResults: {},
      errors: []
    };

    // Планировщики для разных парсеров
    this.schedulers = new Map();
    
    // Инициализация парсеров
    this.parsers = Object.entries(PARSERS).reduce((acc, [key, parser]) => {
      acc[key] = {
        name: parser.name,
        runner: parser.runner,
        schedule: parser.schedule,
        enabled: true,
        lastRun: null,
        totalRuns: 0,
        isRunning: false
      };
      return acc;
    }, {});

    // Обработчик для корректного завершения
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
  }

  async init() {
    try {
      console.log(chalk.blue('🚀 Инициализация продакшн планировщика...'));
      
      // Подключаемся к БД
      await this.db.connect();
      
      // Показываем статистику по всем парсерам
      await this.showInitialStats();
      
      console.log(chalk.green('✅ Планировщик готов к работе'));
      
    } catch (error) {
      console.error(chalk.red('❌ Ошибка инициализации планировщика:'), error.message);
      throw error;
    }
  }

  async showInitialStats() {
    console.log(chalk.cyan('\n📊 ТЕКУЩАЯ СТАТИСТИКА:'));
    
    for (const [parserName, config] of Object.entries(this.parsers)) {
      if (config.enabled) {
        const stats = await this.db.getSiteStats(parserName);
        console.log(chalk.white(`\n🔹 ${config.name}:`));
        console.log(`   📝 Всего записей: ${stats?.saved_listings || 0}`);
        console.log(`   🔗 Обработано URL: ${stats?.processed_urls_count || 0}`);
        console.log(`   ⏰ Последний парсинг: ${stats?.last_parsed ? new Date(stats.last_parsed).toLocaleString('ru-RU') : 'Никогда'}`);
      }
    }
    console.log();
  }

  // Запуск всех планировщиков
  start() {
    console.log(chalk.blue('🔄 Запуск продакшн планировщика...'));
    
    for (const [parserName, config] of Object.entries(this.parsers)) {
      if (config.enabled) {
        this.scheduleParser(parserName, config);
      }
    }
    
    this.isRunning = true;
    console.log(chalk.green('✅ Все планировщики запущены'));
    
    // Показываем расписание
    this.showSchedule();
  }

  // Планирование отдельного парсера
  scheduleParser(parserName, config) {
    const task = cron.schedule(config.schedule, async () => {
      await this.runParser(parserName, config);
    }, {
      scheduled: false,
      timezone: 'Europe/Moscow'
    });

    this.schedulers.set(parserName, task);
    task.start();
    
    console.log(chalk.cyan(`📅 ${config.name} запланирован: ${config.schedule}`));
  }

  // Выполнение парсера
  async runParser(parserName, config) {
    if (this.currentJob) {
      console.log(chalk.yellow(`⚠️ Парсер ${parserName} пропущен - уже выполняется: ${this.currentJob}`));
      return;
    }

    if (config.isRunning) {
      console.log(chalk.yellow(`⚠️ Парсер ${parserName} уже запущен, пропускаем`));
      return;
    }

    this.currentJob = parserName;
    config.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue(`\n🚀 ЗАПУСК ПАРСЕРА: ${config.name}`));
      console.log(chalk.gray(`Время запуска: ${new Date().toLocaleString('ru-RU')}`));
      
      // Запускаем парсер
      const results = await config.runner();
      
      if (results && results.length > 0) {
        // Сохраняем результаты в БД (это также очистит старые данные)
        const saveResult = await this.db.saveParsingResults(parserName, results);
        
        // Обновляем статистику
        config.lastRun = new Date();
        config.totalRuns++;
        this.stats.totalRuns++;
        this.stats.lastRunTime = new Date();
        this.stats.lastRunResults[parserName] = {
          timestamp: new Date(),
          totalFound: results.length,
          saved: saveResult.savedCount,
          duration: Date.now() - startTime
        };
        
        console.log(chalk.green(`✅ ${config.name} завершен:`));
        console.log(`   📊 Найдено: ${results.length}`);
        console.log(`   💾 Сохранено: ${saveResult.savedCount}`);
        console.log(`   ⏱️ Время: ${Math.round((Date.now() - startTime) / 1000)}с`);
        
      } else {
        console.log(chalk.yellow(`⚠️ ${config.name}: Новых данных не найдено`));
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка выполнения ${config.name}:`), error.message);
      
      this.stats.errors.push({
        timestamp: new Date(),
        parser: parserName,
        error: error.message
      });
      
      // Ограничиваем количество сохраняемых ошибок
      if (this.stats.errors.length > 100) {
        this.stats.errors = this.stats.errors.slice(-50);
      }
      
    } finally {
      this.currentJob = null;
      config.isRunning = false;
      console.log(chalk.gray(`Завершено: ${new Date().toLocaleString('ru-RU')}\n`));
    }
  }

  // Показать расписание
  showSchedule() {
    console.log(chalk.cyan('\n📅 РАСПИСАНИЕ ЗАПУСКОВ:'));
    
    for (const [parserName, config] of Object.entries(this.parsers)) {
      if (config.enabled) {
        const nextRun = this.getNextRunTime(config.schedule);
        console.log(chalk.white(`🔹 ${config.name}:`));
        console.log(`   ⏰ Расписание: ${config.schedule}`);
        console.log(`   ▶️ Следующий запуск: ${nextRun}`);
        console.log(`   📊 Всего запусков: ${config.totalRuns}`);
      }
    }
    console.log();
  }

  // Вычислить время следующего запуска
  getNextRunTime(cronExpression) {
    try {
      // Простая эмуляция для "0 */4 * * *"
      const now = new Date();
      const nextHour = Math.ceil(now.getHours() / 4) * 4;
      const nextRun = new Date(now);
      
      if (nextHour >= 24) {
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(0, 0, 0, 0);
      } else {
        nextRun.setHours(nextHour, 0, 0, 0);
      }
      
      return nextRun.toLocaleString('ru-RU');
    } catch {
      return 'Неизвестно';
    }
  }

  // Получить статистику
  getStats() {
    return {
      isRunning: this.isRunning,
      currentJob: this.currentJob,
      totalRuns: this.stats.totalRuns,
      lastRunTime: this.stats.lastRunTime,
      lastRunResults: this.stats.lastRunResults,
      recentErrors: this.stats.errors.slice(-10),
      parsers: Object.fromEntries(
        Object.entries(this.parsers).map(([name, config]) => [
          name, 
          {
            name: config.name,
            enabled: config.enabled,
            schedule: config.schedule,
            lastRun: config.lastRun,
            totalRuns: config.totalRuns
          }
        ])
      )
    };
  }

  // Принудительно запустить парсер
  async forceRun(parserName) {
    const config = this.parsers[parserName];
    if (!config) {
      throw new Error(`Парсер ${parserName} не найден`);
    }
    
    console.log(chalk.blue(`🔧 Принудительный запуск: ${config.name}`));
    await this.runParser(parserName, config);
  }

  // Остановить планировщик
  stop() {
    console.log(chalk.blue('🛑 Остановка планировщика...'));
    
    for (const [parserName, task] of this.schedulers) {
      task.stop();
      console.log(chalk.yellow(`📵 ${parserName} остановлен`));
    }
    
    this.isRunning = false;
    console.log(chalk.red('🔴 Планировщик остановлен'));
  }

  // Graceful shutdown
  async shutdown() {
    console.log(chalk.blue('🔄 Завершение работы планировщика...'));
    
    this.stop();
    await this.db.close();
    
    console.log(chalk.green('✅ Планировщик корректно завершен'));
  }
}

// Раскомментируйте для тестового запуска:
// (async () => {
//   console.log(chalk.blue('🧪 Тестовый запуск планировщика для EmlakJet...'));
//   const scheduler = new ProductionScheduler();
//   try {
//     await scheduler.init();
//     await scheduler.forceRun('emlakjet');
//     console.log(chalk.green('✅ Тест завершен успешно'));
//   } catch (error) {
//     console.error(chalk.red('❌ Ошибка теста:'), error.message);
//   } finally {
//     await scheduler.shutdown();
//     process.exit(0);
//   }
// })(); 