import config from '../../config.js';

export default {
  // Настройки браузера
  browser: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ],
    turnstile: false,
    userDataDir: './browser_data',
    disableXvfb: true,
    ignoreAllFlags: true,
    timeout: 30000
  },

  // Настройки парсера
  parser: {
    delay: 2000, // Задержка между запросами
    retries: 3,  // Количество попыток при ошибке
    schedules: config.parser.schedules
  },

  // База данных
  db: config.db,

  // Настройки бота
  bot: config.bot
}; 