/**
 * Сцена настроек приложения (settings)
 * 
 * Назначение:
 * - Управление настройками пользователя
 * - Смена языка интерфейса
 * - Включение/отключение оповещений
 * 
 * Функциональность:
 * 1. Отображение главного меню настроек
 * 2. Переход к выбору языка
 * 3. Управление оповещениями
 * 4. Возврат в главное меню
 * 
 * События:
 * - enter: Вход в сцену, показ меню настроек
 * - action(change_lang): Переход к выбору языка
 * - action(notifications): Управление оповещениями
 * - action(set_lang_*): Установка языка
 * - action(toggle_notifications): Переключение оповещений
 * - action(back_to_menu): Возврат в главное меню
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { clearOldMessages, initListingSession, showMainMenu } from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Импортируем userLocales из модуля состояния
import { userLocales } from '../utils/userState.js';

// Получение настроек пользователя
async function getUserSettings(userId) {
  const result = await database.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length) {
    const settings = result.rows[0];
    return {
      notifications_enabled: settings.notifications_enabled
    };
  }

  // Если настройки не найдены, создаем их с дефолтными значениями
  const defaultSettings = {
    notifications_enabled: true
  };

  await database.query(
    'INSERT INTO user_settings (user_id, notifications_enabled) VALUES ($1, $2)',
    [userId, defaultSettings.notifications_enabled]
  );

  return defaultSettings;
}

// Обновление настроек уведомлений
async function updateNotificationSettings(userId, enabled) {
  await database.query(
    'UPDATE user_settings SET notifications_enabled = $1 WHERE user_id = $2',
    [enabled, userId]
  );
}

// Показ главного меню настроек
async function showSettingsMenu(ctx) {
  if (!ctx.session.shownMessages) ctx.session.shownMessages = [];
  
  await clearOldMessages(ctx, ctx.session);
  
  const userSettings = await getUserSettings(ctx.from.id);
  
  const notificationStatus = userSettings.notifications_enabled 
    ? ctx.t('notifications-enabled')
    : ctx.t('notifications-disabled');

  const menuText = `⚙️ ${ctx.t('settings-main-menu')}

🔔 ${ctx.t('settings-notification-settings')}
${ctx.t('settings-notification-status')}: ${notificationStatus}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('settings-notification-settings'), 'settings_notifications')],
    [Markup.button.callback(ctx.t('change-lang'), 'change_lang')],
    [Markup.button.callback(ctx.t('back'), 'settings_back')]
  ]);

  const msg = await ctx.reply(menuText, keyboard);
  ctx.session.shownMessages.push(msg.message_id);
}

// Показ меню настроек уведомлений
async function showNotificationSettings(ctx) {
  if (!ctx.session.shownMessages) ctx.session.shownMessages = [];
  
  await clearOldMessages(ctx, ctx.session);
  
  const userSettings = await getUserSettings(ctx.from.id);
  
  const currentStatus = userSettings.notifications_enabled 
    ? ctx.t('notifications-enabled')
    : ctx.t('notifications-disabled');

  const menuText = `🔔 ${ctx.t('settings-notification-settings')}

${ctx.t('settings-current-status')}: ${currentStatus}

${ctx.t('settings-notification-description')}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(
      userSettings.notifications_enabled ? ctx.t('settings-disable') : ctx.t('settings-enable'),
      'settings_toggle_notifications'
    )],
    [Markup.button.callback(ctx.t('back'), 'settings_menu')]
  ]);

  const msg = await ctx.reply(menuText, keyboard);
  ctx.session.shownMessages.push(msg.message_id);
}

// Создаем сцену
const settingsScene = new BaseScene('settings');

// Вход в сцену
settingsScene.enter(async (ctx) => {
  ctx.session = initListingSession(ctx.session);
  await showSettingsMenu(ctx);
});

// Переход к выбору языка
settingsScene.action('change_lang', async (ctx) => {
  await ctx.answerCbQuery();
  await clearOldMessages(ctx, ctx.session);
  
  const msg = await ctx.reply(ctx.t('choose-lang'), Markup.inlineKeyboard([
    [
      Markup.button.callback('🇷🇺 Русский', 'set_lang_ru'),
      Markup.button.callback('🇬🇧 English', 'set_lang_en'),
      Markup.button.callback('🇹🇷 Türkçe', 'set_lang_tr')
    ],
    [Markup.button.callback(ctx.t('back'), 'back_to_settings')]
  ]));
  
  ctx.session.shownMessages.push(msg.message_id);
});

// Установка русского языка
settingsScene.action('set_lang_ru', async (ctx) => {
  userLocales.set(ctx.from.id, 'ru');
  await ctx.i18n.renegotiateLocale();
  await ctx.answerCbQuery(ctx.t('choose-lang') + ' Русский');
  await showSettingsMenu(ctx);
});

// Установка английского языка
settingsScene.action('set_lang_en', async (ctx) => {
  userLocales.set(ctx.from.id, 'en');
  await ctx.i18n.renegotiateLocale();
  await ctx.answerCbQuery(ctx.t('choose-lang') + ' English');
  await showSettingsMenu(ctx);
});

// Установка турецкого языка
settingsScene.action('set_lang_tr', async (ctx) => {
  userLocales.set(ctx.from.id, 'tr');
  await ctx.i18n.renegotiateLocale();
  await ctx.answerCbQuery(ctx.t('choose-lang') + ' Türkçe');
  await showSettingsMenu(ctx);
});

// Обработчики экшенов
settingsScene.action('settings_notifications', async (ctx) => {
  await ctx.answerCbQuery();
  await showNotificationSettings(ctx);
});

settingsScene.action('settings_toggle_notifications', async (ctx) => {
  await ctx.answerCbQuery();
  
  const userSettings = await getUserSettings(ctx.from.id);
  const newStatus = !userSettings.notifications_enabled;
  
  await updateNotificationSettings(ctx.from.id, newStatus);
  
  const statusText = newStatus ? ctx.t('notifications-enabled') : ctx.t('notifications-disabled');
  await ctx.reply(ctx.t('settings-notifications-updated', { status: statusText }));
  
  await showNotificationSettings(ctx);
});

settingsScene.action('settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await showSettingsMenu(ctx);
});

settingsScene.action('settings_back', async (ctx) => {
  await ctx.answerCbQuery();
  await clearOldMessages(ctx, ctx.session);
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

// Возврат к настройкам
settingsScene.action('back_to_settings', async (ctx) => {
  await ctx.answerCbQuery();
  await showSettingsMenu(ctx);
});

// Возврат в главное меню
settingsScene.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await clearOldMessages(ctx, ctx.session);
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

export default settingsScene; 