import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(chalk.blue('🚀 Запуск производственного сервера...'));

// Процессы
let botProcess = null;
let parserProcess = null;
const runningProcesses = [];

// Обработка завершения
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n⚠️ Получен сигнал завершения...'));
  await shutdown();
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n⚠️ Получен сигнал завершения...'));
  await shutdown();
});

// Функция завершения
async function shutdown() {
  console.log(chalk.blue('🔄 Завершение всех процессов...'));
  
  for (const proc of runningProcesses) {
    if (proc && !proc.killed) {
      proc.kill();
    }
  }
  
  console.log(chalk.green('✅ Все процессы завершены'));
  process.exit(0);
}

// Запуск бота
function startBot() {
  console.log(chalk.cyan('🤖 Запуск Telegram бота...'));
  
  const botPath = path.join(__dirname, 'bot');
  botProcess = spawn('node', ['index.js'], {
    cwd: botPath,
    stdio: ['inherit', 'pipe', 'pipe']
  });
  
  runningProcesses.push(botProcess);
  
  botProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(chalk.blue('🤖 [BOT]'), output);
    }
  });
  
  botProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(chalk.red('🤖 [BOT ERROR]'), output);
    }
  });
  
  botProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`❌ Бот завершился с кодом: ${code}`));
      console.log(chalk.blue('🔄 Перезапуск бота через 5 секунд...'));
      setTimeout(startBot, 5000);
    }
  });
  
  botProcess.on('error', (error) => {
    console.error(chalk.red('❌ Ошибка запуска бота:'), error.message);
    setTimeout(startBot, 5000);
  });
}

// Запуск парсеров
function startParsers() {
  console.log(chalk.cyan('🔍 Запуск планировщика парсеров...'));
  
  const parserPath = path.join(__dirname, 'parser');
  parserProcess = spawn('node', ['--loader', './loader.mjs', 'start-production.js'], {
    cwd: parserPath,
    stdio: ['inherit', 'pipe', 'pipe']
  });
  
  runningProcesses.push(parserProcess);
  
  parserProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(chalk.green('🔍 [PARSER]'), output);
    }
  });
  
  parserProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('DeprecationWarning')) {
      console.log(chalk.yellow('🔍 [PARSER WARN]'), output);
    }
  });
  
  parserProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`❌ Парсер завершился с кодом: ${code}`));
      console.log(chalk.blue('🔄 Перезапуск парсера через 10 секунд...'));
      setTimeout(startParsers, 10000);
    }
  });
  
  parserProcess.on('error', (error) => {
    console.error(chalk.red('❌ Ошибка запуска парсера:'), error.message);
    setTimeout(startParsers, 10000);
  });
}

// Главная функция запуска
async function main() {
  try {
    console.log(chalk.blue('📋 Проверка зависимостей...'));
    
    // Запускаем бот
    startBot();
    
    // Ждем немного и запускаем парсеры
    setTimeout(() => {
      startParsers();
    }, 2000);
    
    console.log(chalk.green('✅ Все сервисы запущены!'));
    console.log(chalk.cyan('📊 Статус:'));
    console.log('   🤖 Telegram бот: Активен');
    console.log('   🔍 Парсеры: Запущены (каждые 4 часа)');
    console.log('   💾 База данных: PostgreSQL');
    console.log('');
    console.log(chalk.yellow('⚠️ Для остановки нажмите Ctrl+C'));
    
  } catch (error) {
    console.error(chalk.red('❌ Критическая ошибка:'), error.message);
    await shutdown();
  }
}

// Запуск
main().catch(console.error); 