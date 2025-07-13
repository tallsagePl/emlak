/**
 * Сцена управления своими объявлениями (my_listings)
 * 
 * Назначение:
 * - Просмотр всех объявлений пользователя
 * - Управление статусом объявлений (активация/деактивация)
 * - Редактирование и удаление объявлений
 * 
 * Функциональность:
 * 1. Просмотр объявлений:
 *    - Список всех объявлений пользователя
 *    - Отображение статуса каждого объявления
 *    - Постраничный просмотр (пагинация)
 * 
 * 2. Управление объявлениями:
 *    - Активация/деактивация объявления
 *    - Редактирование информации
 *    - Удаление объявления
 *    - Обновление даты публикации
 * 
 * 3. Фильтрация:
 *    - Показ только активных
 *    - Показ только неактивных
 *    - Показ всех объявлений
 * 
 * События:
 * - enter: Вход в сцену, показ списка объявлений
 * - action(my_listings_*): Пагинация
 * - action(edit_*): Переход к редактированию
 * - action(toggle_*): Изменение статуса
 * - action(delete_*): Удаление объявления
 * - action(filter_*): Фильтрация по статусу
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { 
  formatListing, 
  clearOldMessages, 
  sendLocation,
  createPaginationButtons,
  showMainMenu
} from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Функция для показа объявлений пользователя
async function showUserListings(ctx, offset = 0) {
  if (!ctx.session.shownMessages) ctx.session.shownMessages = [];

  // Удаляем старые сообщения
  await clearOldMessages(ctx, ctx.session);

  // Получаем объявления пользователя
  const listings = await database.query(
    `SELECT * FROM user_listings WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 5 OFFSET $2`,
    [ctx.from.id.toString(), offset]
  );

  if (!listings.rows.length) {
    const btnMsg = await ctx.reply(ctx.t('listing-empty'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('add'), 'add')],
      [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
    ]));
    ctx.session.shownMessages.push(btnMsg.message_id);
    return;
  }

  // Показываем объявления
  for (const row of listings.rows) {
    // Используем функцию formatListing из хелперов
    const message = formatListing(row, ctx);

    const sent = await ctx.replyWithMarkdownV2(message, Markup.inlineKeyboard([
      [
        Markup.button.callback(ctx.t('listing-edit'), `edit_listing_${row.id}`),
        Markup.button.callback(ctx.t('listing-delete'), `delete_listing_${row.id}`)
      ]
    ]));
    ctx.session.shownMessages.push(sent.message_id);

    // Отправляем геолокацию если есть
    await sendLocation(ctx, row, ctx.session);
  }

  // Добавляем кнопки пагинации
  const paginationButtons = createPaginationButtons(ctx, offset, 5, listings.rows.length, 'my_listings');

  const navigationButtons = [
    [Markup.button.callback(ctx.t('add'), 'add')],
    [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
  ];

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
const myListingsScene = new BaseScene('my_listings');

// Вход в сцену
myListingsScene.enter(async (ctx) => {
  await showUserListings(ctx, 0);
});

// Обработчик пагинации
myListingsScene.action(/my_listings_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const offset = parseInt(ctx.match[1]);
  await showUserListings(ctx, offset);
});

// Обработчик удаления объявления
myListingsScene.action(/delete_listing_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const listingId = ctx.match[1];
  
  // Запрашиваем подтверждение
  ctx.session.deletingListingId = listingId;

  await ctx.reply(ctx.t('listing-confirm-delete'), Markup.inlineKeyboard([
    [
      Markup.button.callback(ctx.t('yes'), `confirm_delete_${listingId}`),
      Markup.button.callback(ctx.t('no'), 'cancel_delete')
    ]
  ]));
});

// Подтверждение удаления
myListingsScene.action(/confirm_delete_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const listingId = ctx.match[1];
  
  if (ctx.session.deletingListingId === listingId) {
    await database.query(
      'DELETE FROM user_listings WHERE id = $1 AND owner_id = $2',
      [listingId, ctx.from.id.toString()]
    );
    delete ctx.session.deletingListingId;
    await ctx.reply(ctx.t('listing-deleted'));
  }
  
  await showUserListings(ctx, 0);
});

// Отмена удаления
myListingsScene.action('cancel_delete', async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.session.deletingListingId) {
    delete ctx.session.deletingListingId;
  }
  await showUserListings(ctx, 0);
});

// Обработчик редактирования (переход в сцену редактирования)
myListingsScene.action(/edit_listing_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const listingId = ctx.match[1];
  
  // Проверяем существование объявления
  const result = await database.query(
    'SELECT * FROM user_listings WHERE id = $1 AND owner_id = $2',
    [listingId, ctx.from.id.toString()]
  );

  if (!result.rows.length) {
    await ctx.reply(ctx.t('error'));
    return;
  }

  // Сохраняем ID в сессии Telegraf
  ctx.session.editingListingId = listingId;
  await ctx.scene.enter('edit_listing');
});

// Обработчик добавления нового объявления
myListingsScene.action('add', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('add_listing');
});

// Обработчик возврата в главное меню
myListingsScene.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

export default myListingsScene; 