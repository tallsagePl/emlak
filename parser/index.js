#!/usr/bin/env node

import { HepsiemlakParser, runHepsiemlak } from './hepsiemlak-parser.js';
import { EmlakjetParser, runEmlakjet } from './emlakjet-parser.js';
import { ProductionScheduler } from './production-scheduler.js';
import database from './database.js';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Будут добавлены в будущем:
// import { SahibindenParser, runSahibinden } from './sahibinden-parser.js';
// import { HurriyetParser, runHurriyet } from './hurriyet-parser.js';
// import { ZingateParser, runZingate } from './zingate-parser.js';

// Список доступных парсеров
const PARSERS = {
  hepsiemlak: {
    name: 'HepsEmlak.com',
    runner: runHepsiemlak,
    description: 'Парсер для сайта hepsiemlak.com'
  },
  emlakjet: {
    name: 'EmlakJet.com',
    runner: runEmlakjet,
    description: 'Парсер для сайта emlakjet.com'
  },
  // В будущем:
  // sahibinden: {
  //   name: 'Sahibinden.com', 
  //   runner: runSahibinden,
  //   description: 'Парсер для сайта sahibinden.com'
  // },
  // hurriyet: {
  //   name: 'HurriyetEmlak.com',
  //   runner: runHurriyet, 
  //   description: 'Парсер для сайта hurriyetemlak.com'
  // },
  // zingate: {
  //   name: 'Zingate.com',
  //   runner: runZingate,
  //   description: 'Парсер для сайта zingate.com'  
  // }
};

const argv = yargs(hideBin(process.argv))
  .command('list', 'Показать доступные парсеры', {}, showParsersList)
  .command('run <parser>', 'Запустить конкретный парсер', (yargs) => {
    return yargs
      .positional('parser', {
        describe: 'Название парсера (hepsiemlak, sahibinden, hurriyet, zingate)',
        type: 'string'
      })
      .option('test', {
        alias: 't',
        describe: 'Тестовый режим (ограниченное количество)',
        type: 'boolean',
        default: false
      })
      .option('limit', {
        alias: 'l',
        describe: 'Количество объявлений для обработки',
        type: 'number'
      });
  }, runSingleParser)
  .command('run-all', 'Запустить все доступные парсеры', (yargs) => {
    return yargs
      .option('test', {
        alias: 't',
        describe: 'Тестовый режим (ограниченное количество)',
        type: 'boolean',
        default: false
      })
      .option('limit', {
        alias: 'l',
        describe: 'Количество объявлений для обработки',
        type: 'number'
      });
  }, runAllParsers)
  .command('production', 'Запустить продакшн планировщик', (yargs) => {
    return yargs
      .option('config', {
        alias: 'c',
        describe: 'Путь к файлу конфигурации БД',
        type: 'string'
      })
      .option('test-run', {
        describe: 'Тестовый запуск одного цикла',
        type: 'boolean',
        default: false
      });
  }, runProduction)
  .command('production-force <parser>', 'Принудительно запустить парсер в продакшн режиме', (yargs) => {
    return yargs
      .positional('parser', {
        describe: 'Название парсера для принудительного запуска',
        type: 'string'
      })
      .option('config', {
        alias: 'c',
        describe: 'Путь к файлу конфигурации БД',
        type: 'string'
      });
  }, forceProductionRun)
  .command('stats', 'Показать статистику парсеров', (yargs) => {
    return yargs
      .option('config', {
        alias: 'c',
        describe: 'Путь к файлу конфигурации БД',
        type: 'string'
      });
  }, showStats)
  .option('verbose', {
    alias: 'v',
    describe: 'Подробный вывод',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h')
  .demandCommand()
  .strict()
  .argv;

// Функции команд
function showParsersList() {
  console.log(chalk.blue('\n🚀 ДОСТУПНЫЕ ПАРСЕРЫ:\n'));
  
  Object.entries(PARSERS).forEach(([key, parser]) => {
    console.log(chalk.white(`🔹 ${key}:`));
    console.log(`   📝 Название: ${parser.name}`);
    console.log(`   📄 Описание: ${parser.description}`);
    console.log();
  });
  
  console.log(chalk.cyan('📝 Примеры использования:'));
  console.log(chalk.gray('node index.js run hepsiemlak --test'));
  console.log(chalk.gray('node index.js run hepsiemlak --limit 10'));
  console.log(chalk.gray('node index.js run-all --test'));
  console.log(chalk.gray('node index.js production'));
  console.log(chalk.gray('node index.js production-force hepsiemlak'));
  console.log(chalk.gray('node index.js stats'));
  console.log();
}

async function runSingleParser(argv) {
  const { parser: parserName, test, limit } = argv;
  
  const parser = PARSERS[parserName];
  if (!parser) {
    console.error(chalk.red(`❌ Парсер "${parserName}" не найден!`));
    console.log(chalk.cyan('Доступные парсеры:'), Object.keys(PARSERS).join(', '));
    process.exit(1);
  }

  console.log(chalk.blue(`🚀 Запуск парсера: ${parser.name}`));
  
  const testLimit = test ? 3 : (limit || null);
  if (testLimit) {
    console.log(chalk.yellow(`🧪 Режим: ${test ? 'тестовый' : 'ограниченный'} (${testLimit} объявлений)`));
  }

  try {
    const results = await parser.runner(testLimit);
    
    console.log(chalk.green(`\n✅ ${parser.name} завершен успешно!`));
    console.log(chalk.cyan(`📊 Обработано: ${results?.length || 0} объявлений`));
    
  } catch (error) {
    console.error(chalk.red(`❌ Ошибка выполнения ${parser.name}:`), error.message);
    process.exit(1);
  }
}

async function runAllParsers(argv) {
  const { test, limit } = argv;
  
  console.log(chalk.blue('🚀 Запуск всех доступных парсеров...\n'));
  
  const testLimit = test ? 3 : (limit || null);
  const results = {};
  
  for (const [parserName, parser] of Object.entries(PARSERS)) {
    console.log(chalk.blue(`\n▶️ Запуск: ${parser.name}`));
    
    try {
      const result = await parser.runner(testLimit);
      results[parserName] = {
        success: true,
        count: result?.length || 0,
        data: result
      };
      
      console.log(chalk.green(`✅ ${parser.name}: ${result?.length || 0} объявлений`));
      
    } catch (error) {
      results[parserName] = {
        success: false,
        error: error.message
      };
      
      console.error(chalk.red(`❌ ${parser.name}: ${error.message}`));
    }
  }
  
  // Итоговый отчет
  console.log(chalk.blue('\n📊 ИТОГОВЫЙ ОТЧЕТ:'));
  
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalCount = 0;
  
  Object.entries(results).forEach(([parserName, result]) => {
    const parser = PARSERS[parserName];
    
    if (result.success) {
      console.log(chalk.green(`✅ ${parser.name}: ${result.count} объявлений`));
      totalSuccess++;
      totalCount += result.count;
    } else {
      console.log(chalk.red(`❌ ${parser.name}: ${result.error}`));
      totalFailed++;
    }
  });
  
  console.log(chalk.cyan(`\n🎉 Всего обработано: ${totalCount} объявлений`));
  console.log(chalk.green(`✅ Успешно: ${totalSuccess} парсеров`));
  console.log(chalk.red(`❌ Ошибок: ${totalFailed} парсеров`));
}

async function runProduction(argv) {
  const { config, testRun } = argv;
  
  console.log(chalk.blue('🚀 ЗАПУСК ПРОДАКШН ПЛАНИРОВЩИКА'));
  
  // Загружаем конфигурацию БД если указана
  let dbConfig = {};
  if (config) {
    try {
      dbConfig = await import(config);
      console.log(chalk.green(`✅ Конфигурация БД загружена: ${config}`));
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка загрузки конфигурации: ${error.message}`));
      process.exit(1);
    }
  }

  const scheduler = new ProductionScheduler(dbConfig);
  
  try {
    await scheduler.init();
    
    if (testRun) {
      console.log(chalk.yellow('🧪 ТЕСТОВЫЙ ЗАПУСК'));
      await scheduler.forceRun('hepsiemlak');
      await scheduler.shutdown();
    } else {
      console.log(chalk.green('🔄 ЗАПУСК В ПРОДАКШН РЕЖИМЕ'));
      
      // Обработчики для graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n🛑 Получен сигнал остановки...'));
        await scheduler.shutdown();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\n🛑 Получен сигнал завершения...'));
        await scheduler.shutdown();
        process.exit(0);
      });
      
      scheduler.start();
      
      // Показываем статистику каждые 30 минут
      setInterval(() => {
        const stats = scheduler.getStats();
        console.log(chalk.blue('\n📊 ТЕКУЩАЯ СТАТИСТИКА:'));
        console.log(`🔄 Активен: ${stats.isRunning ? 'Да' : 'Нет'}`);
        console.log(`📋 Текущая задача: ${stats.currentJob || 'Нет'}`);
        console.log(`📈 Всего запусков: ${stats.totalRuns}`);
        console.log(`⏰ Последний запуск: ${stats.lastRunTime ? stats.lastRunTime.toLocaleString('ru-RU') : 'Никогда'}`);
      }, 30 * 60 * 1000);
      
      console.log(chalk.cyan('\n👀 Планировщик работает... Нажмите Ctrl+C для остановки\n'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Ошибка запуска планировщика:'), error.message);
    await scheduler.shutdown();
    process.exit(1);
  }
}

async function forceProductionRun(argv) {
  const { parser: parserName, config } = argv;
  
  if (!PARSERS[parserName]) {
    console.error(chalk.red(`❌ Парсер "${parserName}" не найден!`));
    process.exit(1);
  }

  console.log(chalk.blue(`🔧 ПРИНУДИТЕЛЬНЫЙ ЗАПУСК: ${PARSERS[parserName].name}`));
  
  // Загружаем конфигурацию БД если указана
  let dbConfig = {};
  if (config) {
    try {
      dbConfig = await import(config);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка загрузки конфигурации: ${error.message}`));
      process.exit(1);
    }
  }

  const scheduler = new ProductionScheduler(dbConfig);
  
  try {
    await scheduler.init();
    await scheduler.forceRun(parserName);
    await scheduler.shutdown();
    
    console.log(chalk.green('✅ Принудительный запуск завершен'));
    
  } catch (error) {
    console.error(chalk.red('❌ Ошибка принудительного запуска:'), error.message);
    await scheduler.shutdown();
    process.exit(1);
  }
}

async function showStats(argv) {
  const { config } = argv;
  
  console.log(chalk.blue('📊 СТАТИСТИКА ПАРСЕРОВ'));
  
  // Загружаем конфигурацию БД если указана
  let dbConfig = {};
  if (config) {
    try {
      dbConfig = await import(config);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка загрузки конфигурации: ${error.message}`));
      process.exit(1);
    }
  }

      const db = database;
  
  try {
    await db.connect();
    
    for (const [parserName, parser] of Object.entries(PARSERS)) {
      console.log(chalk.white(`\n🔹 ${parser.name}:`));
      
      try {
        // Получаем статистику напрямую через универсальную БД
        const [parserStats] = await db.database.getParserStats(parserName);
        const [listingStats] = await db.database.getListingsStats(parserName);
        
        console.log(`   📝 Всего записей: ${listingStats?.total_listings || 0}`);
        console.log(`   🔗 Обработано URL: ${parserStats?.total_processed || 0}`);
        console.log(`   💰 Средняя цена: ${listingStats?.avg_price ? Math.round(listingStats.avg_price) + ' ₺' : 'Неизвестно'}`);
        console.log(`   ⏰ Последний парсинг: ${listingStats?.last_parsed ? new Date(listingStats.last_parsed).toLocaleString('ru-RU') : 'Никогда'}`);
        console.log(`   📅 Последнее обновление: ${parserStats?.last_updated ? new Date(parserStats.last_updated).toLocaleString('ru-RU') : 'Никогда'}`);
      } catch (error) {
        console.log(chalk.red(`   ❌ Ошибка получения статистики: ${error.message}`));
      }
    }
    
    await db.close();
    
  } catch (error) {
    console.error(chalk.red('❌ Ошибка получения статистики:'), error.message);
    await db.close();
    process.exit(1);
  }
}

// Экспорт для использования как модуль
export {
  HepsiemlakParser,
  runHepsiemlak,
  PARSERS,
  ProductionScheduler,
  database
}; 