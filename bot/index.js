import config from '../config.js';
import { Telegraf, Markup, Scenes, session } from 'telegraf';
import { I18n } from '@grammyjs/i18n';
import database from '../database/index.js';
import { 
  parsedListingsScene, 
  viewListingsScene, 
  // filteredListingsScene, 
  addListingScene,
  editListingScene,
  myListingsScene,
  settingsScene
} from './scenes/index.js';
import { clearOldMessages } from './utils/helpers.js';
import NotificationService from './services/notifications.js';

console.log('🔧 DEBUG: NODE_ENV =', process.env.NODE_ENV);
console.log('🔧 DEBUG: BOT_TOKEN =', process.env.BOT_TOKEN ? '***установлен***' : 'НЕ УСТАНОВЛЕН');
console.log('🔧 DEBUG: Используемый токен =', config.telegram.token ? '***установлен***' : 'НЕ УСТАНОВЛЕН');

if (!config.telegram.token) {
  console.warn('⚠️ Внимание: Бот запущен без токена. Функциональность будет ограничена.');
}

const bot = new Telegraf(config.telegram.token);

// Инициализация базы данных
(async () => {
  try {
    await database.init();
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error.message);
    process.exit(1);
  }
})();

// Импортируем userLocales из модуля состояния
import { userLocales } from './utils/userState.js';

// Инициализация i18n
const i18n = new I18n({
  defaultLocale: 'en',
  directory: 'locales',
  useSession: true,
  locales: ['ru', 'en', 'tr'],
  localeNegotiator: (ctx) =>
    userLocales.get(ctx.from?.id) ?? ctx.from?.language_code ?? 'en',
});

// Создаем менеджер сцен
const stage = new Scenes.Stage([
  parsedListingsScene, 
  viewListingsScene, 
  // filteredListingsScene, 
  addListingScene,
  editListingScene,
  myListingsScene,
  settingsScene
]);

// Подключаем middleware
bot.use(session());
bot.use(i18n.middleware());
bot.use(stage.middleware());

// Добавляем обработчик ошибок
bot.catch((err, ctx) => {
  ctx.reply(ctx.t('error'));
});

// Вспомогательная функция для показа главного меню
function showStartMenu(ctx) {
  return ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('add'), 'add')],
    [Markup.button.callback(ctx.t('view'), 'view')],
    [Markup.button.callback(ctx.t('my-listings'), 'my_listings')],
    [Markup.button.callback(ctx.t('parsed-listings'), 'view_parsed')],
    [Markup.button.callback(ctx.t('settings'), 'settings')]
  ]));
}

// Главное меню
bot.start((ctx) => showStartMenu(ctx));

bot.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  if (ctx.session) {
    await clearOldMessages(ctx, ctx.session);
  }
  return showStartMenu(ctx);
});

// Навигация по сценам
bot.action('add', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.scene.enter('add_listing');
});

bot.action('view', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.scene.enter('view_listings');
});

// bot.action('view_all', async (ctx) => {
//   await ctx.answerCbQuery();
//   await ctx.scene.enter('view_listings');
// });

// bot.action('view_filtered', async (ctx) => {
//   await ctx.answerCbQuery();
//   await ctx.scene.enter('filtered_listings');
// });

bot.action('my_listings', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.scene.enter('my_listings');
});

bot.action('view_parsed', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.scene.enter('parsed_listings');
});

// Переход к настройкам
bot.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.scene.enter('settings');
});

// Управление языком теперь происходит в сцене настроек

// Запускаем бот только если есть токен
if (config.telegram.token) {
  console.log('🚀 Запускаю бота...');
  
  // Проверяем подключение к Telegram API
  console.log('🔍 Проверяю подключение к Telegram API...');
  bot.telegram.getMe().then(info => {
    console.log('✅ Подключение к Telegram API успешно:', info.username);
    console.log('🚀 Запускаю polling...');
    
    return bot.launch();
  }).then(() => {
    console.log('✅ Бот запущен успешно');
    
    // Пока отключаем автоматические уведомления из-за проблем с bot.launch()
    // const notificationService = new NotificationService(bot, i18n);
    // notificationService.start();
    
    console.log('ℹ️ Автоматические уведомления временно отключены');
    
    // Добавляем команду для принудительной проверки уведомлений (для тестирования)
    bot.command('check_notifications', async (ctx) => {
      if (ctx.from.id === 123456789) { // Замените на ваш ID для безопасности
        await ctx.reply('🔍 Проверяю уведомления...');
        await notificationService.forceCheck();
        await ctx.reply('✅ Проверка завершена');
      }
    });
  
  // Включаем graceful shutdown
    process.once('SIGINT', () => {
      notificationService.stop();
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      notificationService.stop();
      bot.stop('SIGTERM');
    });
  }).catch(error => {
    console.error('❌ Ошибка запуска бота:', error.message);
  });
} else {
  // Бот не запущен из-за отсутствия токена
}