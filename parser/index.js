#!/usr/bin/env node

import { ProductionScheduler } from './scheduler/index.js';
import { PARSERS } from './config/parsers.js';
import { HepsiemlakParser, EmlakjetParser } from './parsers/index.js';
import database from './adapters/database.js';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import config from '../config.js';

// Будут добавлены в будущем:
// import { SahibindenParser, runSahibinden } from './sahibinden-parser.js';
// import { HurriyetParser, runHurriyet } from './hurriyet-parser.js';
// import { ZingateParser, runZingate } from './zingate-parser.js';

const argv = yargs(hideBin(process.argv))
  .command('list', 'Показать доступные парсеры', {}, showParsersList)
  .command('run <parser>', 'Запустить конкретный парсер', (yargs) => {
    return yargs
      .positional('parser', {
        describe: 'Название парсера (hepsiemlak, sahibinden, hurriyet, zingate)',
        type: 'string',
        choices: Object.keys(PARSERS)
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
        type: 'number',
        coerce: (arg) => {
          const num = parseInt(arg);
          if (isNaN(num) || num < 1) {
            throw new Error('Лимит должен быть положительным числом');
          }
          return num;
        }
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
        type: 'number',
        coerce: (arg) => {
          const num = parseInt(arg);
          if (isNaN(num) || num < 1) {
            throw new Error('Лимит должен быть положительным числом');
          }
          return num;
        }
      });
  }, runAllParsers)
  .command('production', 'Запустить продакшн планировщик', (yargs) => {
    return yargs
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
        type: 'string',
        choices: Object.keys(PARSERS)
      })
      .option('config', {
        alias: 'c',
        describe: 'Путь к файлу конфигурации БД',
        type: 'string',
        normalize: true,
        coerce: (arg) => {
          if (!fs.existsSync(arg)) {
            throw new Error('Файл конфигурации не найден');
          }
          return arg;
        }
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
    console.log(`   ⏰ Расписание: ${parser.schedule}`);
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
  const { testRun } = argv;
  
  console.log(chalk.blue('🚀 ЗАПУСК ПРОДАКШН ПЛАНИРОВЩИКА'));
  console.log(chalk.cyan(`🔧 Окружение: ${config.env.current.toUpperCase()}`));
  
  const scheduler = new ProductionScheduler();
  
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
  
  console.log(chalk.blue('📊 ДЕТАЛЬНАЯ СТАТИСТИКА ПАРСЕРОВ\n'));
  
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
      console.log(chalk.white(`🔹 ${parser.name}:`));
      console.log(chalk.gray(`   Расписание: ${parser.schedule}`));
      
      try {
        // Получаем детальную статистику синхронизации
        const syncStats = await db.getSyncStats(parserName, 24);
        const recentChanges = await db.getRecentChanges(parserName, 5);
        
        if (syncStats) {
          console.log(chalk.cyan('\n   📈 Общая статистика:'));
          console.log(`      📝 Всего записей: ${syncStats.total_listings}`);
          console.log(`      🆔 Уникальных объявлений: ${syncStats.unique_listings}`);
          console.log(`      💰 Средняя цена: ${syncStats.avg_price ? Math.round(syncStats.avg_price).toLocaleString() + ' ₺' : 'Неизвестно'}`);
          console.log(`      📅 Первый парсинг: ${syncStats.first_sync ? new Date(syncStats.first_sync).toLocaleString('ru-RU') : 'Никогда'}`);
          console.log(`      ⏰ Последняя синхронизация: ${syncStats.last_sync ? new Date(syncStats.last_sync).toLocaleString('ru-RU') : 'Никогда'}`);
          
          console.log(chalk.yellow('\n   🔄 За последние 24 часа:'));
          console.log(`      ➕ Добавлено: ${syncStats.added_recently} объявлений`);
          console.log(`      🔄 Обновлено: ${syncStats.updated_recently} объявлений`);
          
          if (recentChanges.length > 0) {
            console.log(chalk.green('\n   📋 Недавние изменения:'));
            recentChanges.forEach((change, index) => {
              const changeIcon = change.change_type === 'added' ? '➕' : 
                               change.change_type === 'updated' ? '🔄' : '📄';
              const title = change.title.length > 50 ? 
                           change.title.substring(0, 50) + '...' : 
                           change.title;
              const price = change.price ? 
                           Math.round(change.price).toLocaleString() + ' ₺' : 
                           'Цена не указана';
              
              console.log(`      ${changeIcon} ${title}`);
              console.log(`         💰 ${price} | 🆔 ${change.listing_id}`);
              
              if (index < recentChanges.length - 1) {
                console.log('');
              }
            });
          } else {
            console.log(chalk.gray('\n   📋 Недавних изменений нет'));
          }
        } else {
          console.log(chalk.gray('   📋 Данные отсутствуют'));
        }
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Ошибка получения статистики: ${error.message}`));
      }
      
      console.log(''); // Пустая строка между парсерами
    }
    
    // Общая сводка
    console.log(chalk.blue('📊 ОБЩАЯ СВОДКА:'));
    const allStats = await db.getAllStats();
    
    let totalListings = 0;
    let totalAvgPrice = 0;
    let sitesWithData = 0;
    
    allStats.forEach(stat => {
      totalListings += stat.saved_listings;
      if (stat.avg_price > 0) {
        totalAvgPrice += stat.avg_price;
        sitesWithData++;
      }
    });
    
    console.log(`   📝 Всего объявлений: ${totalListings.toLocaleString()}`);
    console.log(`   🌐 Активных сайтов: ${allStats.filter(s => s.saved_listings > 0).length}`);
    console.log(`   💰 Средняя цена по всем сайтам: ${sitesWithData > 0 ? Math.round(totalAvgPrice / sitesWithData).toLocaleString() + ' ₺' : 'Неизвестно'}`);
    
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
  EmlakjetParser,
  PARSERS,
  ProductionScheduler,
  database
}; 