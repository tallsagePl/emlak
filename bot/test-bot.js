import config from '../config.js';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(config.telegram.token);

console.log('🚀 Запускаю тестового бота...');

// Простой обработчик
bot.start((ctx) => {
  console.log('Получен /start от:', ctx.from.username);
  ctx.reply('Привет! Тестовый бот работает.');
});

// Запуск с таймаутом
const timeout = setTimeout(() => {
  console.error('❌ Таймаут запуска тестового бота');
  process.exit(1);
}, 30000);

bot.launch().then(() => {
  clearTimeout(timeout);
  console.log('✅ Тестовый бот запущен успешно');
}).catch(err => {
  clearTimeout(timeout);
  console.error('❌ Ошибка запуска тестового бота:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 