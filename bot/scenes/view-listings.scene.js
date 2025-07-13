/**
 * Сцена просмотра всех активных объявлений (view_listings)
 * 
 * Назначение:
 * - Отображение списка всех активных объявлений в системе
 * - Постраничный просмотр объявлений (пагинация)
 * - Отображение детальной информации по каждому объявлению
 * 
 * Функциональность:
 * 1. При входе в сцену показывает первые 5 объявлений
 * 2. Для каждого объявления отображает:
 *    - Тип недвижимости и количество комнат
 *    - Цену и валюту
 *    - Адрес или геолокацию
 *    - Описание объекта
 * 3. Поддерживает пагинацию (кнопки Вперед/Назад)
 * 4. Позволяет вернуться в главное меню
 * 
 * События:
 * - enter: Вход в сцену, показ первой страницы объявлений
 * - action(view_all_*): Обработка пагинации
 * - action(back_to_menu): Возврат в главное меню
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { 
  formatListing, 
  clearOldMessages, 
  sendLocation,
  createPaginationButtons,
  initListingSession,
  showMainMenu
} from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Функция для показа объявлений
async function showListings(ctx, offset = 0) {
  // Инициализируем сессию если её нет
  if (!ctx.session.shownMessages) ctx.session.shownMessages = [];

  // Удаляем старые сообщения
  await clearOldMessages(ctx, ctx.session);

  // Получаем объявления
  const listings = await database.query(
    `SELECT * FROM user_listings WHERE status = 'live' ORDER BY created_at DESC LIMIT 5 OFFSET $1`,
    [offset]
  );

  if (!listings.rows.length) {
    const msg = await ctx.reply(ctx.t('listing-empty'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
    ]));
    ctx.session.shownMessages.push(msg.message_id);
    return;
  }

  // Показываем объявления
  for (const row of listings.rows) {
    // Используем функцию formatListing из хелперов
    const message = formatListing(row, ctx);

    const sent = await ctx.replyWithMarkdownV2(message);
    ctx.session.shownMessages.push(sent.message_id);

    // Отправляем геолокацию если есть
    await sendLocation(ctx, row, ctx.session);
  }

  // Добавляем кнопки пагинации
  const paginationButtons = createPaginationButtons(ctx, offset, 5, listings.rows.length, 'view_all');

  const navigationButtons = [[Markup.button.callback(ctx.t('back'), 'back_to_menu')]];

  if (paginationButtons.length > 0) {
    navigationButtons.unshift(paginationButtons);
  }

  const navMsg = await ctx.reply(
    ctx.t('listing-shown', { from: offset + 1, to: offset + listings.rows.length }),
    Markup.inlineKeyboard(navigationButtons)
  );
  ctx.session.shownMessages.push(navMsg.message_id);
}

// Создаем сцену
const viewListingsScene = new BaseScene('view_listings');

// Вход в сцену
viewListingsScene.enter(async (ctx) => {
  // Инициализируем сессию
  ctx.session = initListingSession(ctx.session);
  await showListings(ctx, 0);
});

// Обработчик пагинации
viewListingsScene.action(/view_all_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const offset = parseInt(ctx.match[1]);
  await showListings(ctx, offset);
});

// Переход к фильтрам
viewListingsScene.action('go_to_filters', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('filtered_listings');
});

// Добавление нового объявления
viewListingsScene.action('add', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('add_listing');
});

// Просмотр объявления на сайте
viewListingsScene.action(/view_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const listingId = ctx.match[1];
  
  const result = await database.query(
    'SELECT source_url FROM user_listings WHERE id = $1',
    [listingId]
  );

  if (result.rows.length && result.rows[0].source_url) {
    await ctx.reply(ctx.t('listing-original-link') + '\n' + result.rows[0].source_url);
  }
});

// Возврат в главное меню
viewListingsScene.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await clearOldMessages(ctx, ctx.session);
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

export default viewListingsScene; 