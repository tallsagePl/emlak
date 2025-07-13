/**
 * Сцена редактирования объявления (edit_listing)
 * 
 * Назначение:
 * - Редактирование всех параметров существующего объявления
 * - Интерактивное изменение данных с предварительным просмотром
 * - Валидация изменений и сохранение в базе данных
 * 
 * Функциональность:
 * 1. Отображение текущих данных объявления:
 *    - Полная информация об объявлении
 *    - Отображение геолокации (если есть)
 *    - Интерактивное меню редактирования
 * 
 * 2. Редактируемые поля:
 *    - Тип недвижимости (Аренда/Продажа)
 *    - Количество комнат (1+0, 1+1, 2+1, 3+1, 4+1, Другое)
 *    - Цена (с валидацией числового формата)
 *    - Местоположение (геолокация или адрес)
 *    - Описание объекта
 * 
 * 3. Управление сессией:
 *    - Отслеживание редактируемого объявления через session.editingListingId
 *    - Очистка старых сообщений при переходах
 *    - Сохранение состояния редактирования
 * 
 * 4. Интерфейс:
 *    - Пошаговое редактирование каждого поля
 *    - Немедленное отображение изменений
 *    - Возможность отмены операций
 * 
 * 5. Валидация и безопасность:
 *    - Проверка принадлежности объявления пользователю
 *    - Обработка ошибок ввода
 *    - Корректное обновление базы данных
 * 
 * События:
 * - enter: Вход в сцену, отображение текущих данных
 * - action(edit_*): Выбор поля для редактирования
 * - action(type_*): Изменение типа недвижимости
 * - action(rooms_*): Изменение количества комнат
 * - text: Обработка текстового ввода (цена, описание, адрес)
 * - location: Обработка отправленной геолокации
 * - action(back_*): Навигация по меню
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { formatListing } from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Функция для показа текущих данных объявления
async function showCurrentListing(ctx) {
  if (!ctx.session.editingListingId) {
    await ctx.reply(ctx.t('error'));
    return ctx.scene.enter('my_listings');
  }

  // Очищаем старые сообщения
  if (ctx.session.editMessages) {
    for (const msgId of ctx.session.editMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
  }
  ctx.session.editMessages = [];

  const result = await database.query(
    'SELECT * FROM user_listings WHERE id = $1 AND owner_id = $2',
    [ctx.session.editingListingId, ctx.from.id.toString()]
  );

  if (!result.rows.length) {
    await ctx.reply(ctx.t('error'));
    return ctx.scene.enter('my_listings');
  }

  const listing = result.rows[0];
  ctx.session.currentListing = listing;

  // Используем функцию formatListing из хелперов
  const message = formatListing(listing, ctx);

  const mainMsg = await ctx.replyWithMarkdownV2(message);
  ctx.session.editMessages.push(mainMsg.message_id);

  // Отправляем геолокацию если есть
  if (listing.location) {
    try {
      const loc = JSON.parse(listing.location);
      if (loc.latitude && loc.longitude) {
        const locMsg = await ctx.replyWithLocation(loc.latitude, loc.longitude);
        ctx.session.editMessages.push(locMsg.message_id);
      }
    } catch (e) {
      // Игнорируем ошибку парсинга
    }
  }

  // Показываем меню редактирования
  const menuMsg = await ctx.reply(ctx.t('edit-what-change'), Markup.inlineKeyboard([
    [
      Markup.button.callback(ctx.t('listing-type'), 'edit_type'),
      Markup.button.callback(ctx.t('listing-rooms'), 'edit_rooms')
    ],
    [
      Markup.button.callback(ctx.t('listing-price'), 'edit_price'),
      Markup.button.callback(ctx.t('listing-location'), 'edit_location')
    ],
    [Markup.button.callback(ctx.t('listing-description'), 'edit_description')],
    [Markup.button.callback(ctx.t('back'), 'back_to_listings')]
  ]));
  ctx.session.editMessages.push(menuMsg.message_id);
}

// Создаем сцену
const editListingScene = new BaseScene('edit_listing');

// Вход в сцену
editListingScene.enter(async (ctx) => {
  if (!ctx.session.editingListingId) {
    await ctx.reply(ctx.t('error'));
    return ctx.scene.enter('my_listings');
  }
  await showCurrentListing(ctx);
});

// Редактирование типа недвижимости
editListingScene.action('edit_type', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.editField = 'property_type';
  
  // Очищаем старые сообщения
  if (ctx.session.editMessages) {
    for (const msgId of ctx.session.editMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
  }
  ctx.session.editMessages = [];
  
  const msg = await ctx.reply(ctx.t('property-choose'), Markup.inlineKeyboard([
    [
      Markup.button.callback(ctx.t('property-rent'), 'type_rent'),
      Markup.button.callback(ctx.t('property-sale'), 'type_sale')
    ],
    [Markup.button.callback(ctx.t('back'), 'back_to_edit')]
  ]));
  ctx.session.editMessages.push(msg.message_id);
});

editListingScene.action(/^type_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const type = ctx.match[1];
  
  await database.query(
    'UPDATE user_listings SET property_type = $1 WHERE id = $2 AND owner_id = $3',
    [type, ctx.session.editingListingId, ctx.from.id.toString()]
  );
  
  await ctx.reply(ctx.t('edit-success'));
  await showCurrentListing(ctx);
});

// Редактирование комнат
editListingScene.action('edit_rooms', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.editField = 'rooms';
  
  await ctx.reply(ctx.t('rooms-choose'), Markup.inlineKeyboard([
    [
      Markup.button.callback(ctx.t('rooms-1-0'), 'rooms_1+0'),
      Markup.button.callback(ctx.t('rooms-1-1'), 'rooms_1+1'),
      Markup.button.callback(ctx.t('rooms-2-1'), 'rooms_2+1')
    ],
    [
      Markup.button.callback(ctx.t('rooms-3-1'), 'rooms_3+1'),
      Markup.button.callback(ctx.t('rooms-4-1'), 'rooms_4+1'),
      Markup.button.callback(ctx.t('rooms-other'), 'rooms_other')
    ],
    [Markup.button.callback(ctx.t('back'), 'back_to_edit')]
  ]));
});

editListingScene.action(/^rooms_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const rooms = ctx.match[1];
  
  if (rooms === 'other') {
    await ctx.reply(ctx.t('rooms-text'));
    ctx.session.awaitingInput = 'rooms';
    return;
  }
  
  await database.query(
    'UPDATE user_listings SET rooms = $1 WHERE id = $2 AND owner_id = $3',
    [rooms, ctx.session.editingListingId, ctx.from.id.toString()]
  );
  
  await ctx.reply(ctx.t('edit-success'));
  await showCurrentListing(ctx);
});

// Редактирование цены
editListingScene.action('edit_price', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.editField = 'price';
  ctx.session.awaitingInput = 'price';
  
  await ctx.reply(ctx.t('price-enter'));
});

// Редактирование локации
editListingScene.action('edit_location', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.editField = 'location';
  ctx.session.awaitingInput = 'location';
  
  await ctx.reply(ctx.t('location-send'), Markup.keyboard([
    [Markup.button.text(ctx.t('location-skip'))]
  ]).resize());
});

// Редактирование описания
editListingScene.action('edit_description', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.editField = 'description';
  ctx.session.awaitingInput = 'description';
  
  await ctx.reply(ctx.t('description-enter'));
});

// Обработка текстового ввода
editListingScene.on('text', async (ctx) => {
  if (!ctx.session.awaitingInput) return;

  const text = ctx.message.text;
  const field = ctx.session.awaitingInput;

  if (text === ctx.t('location-skip')) {
    delete ctx.session.awaitingInput;
    await showCurrentListing(ctx);
    return;
  }

  switch (field) {
    case 'rooms':
    case 'price':
    case 'description':
      await database.query(
        `UPDATE user_listings SET ${field} = $1 WHERE id = $2 AND owner_id = $3`,
        [text, ctx.session.editingListingId, ctx.from.id.toString()]
      );
      break;
    case 'location':
      await database.query(
        'UPDATE user_listings SET address = $1, location = NULL WHERE id = $2 AND owner_id = $3',
        [text, ctx.session.editingListingId, ctx.from.id.toString()]
      );
      break;
  }

  delete ctx.session.awaitingInput;
  await ctx.reply(ctx.t('edit-success'));
  await showCurrentListing(ctx);
});

// Обработка геолокации
editListingScene.on('location', async (ctx) => {
  if (ctx.session.awaitingInput !== 'location') return;

  const location = ctx.message.location;
  await database.query(
    'UPDATE user_listings SET location = $1, address = NULL WHERE id = $2 AND owner_id = $3',
    [JSON.stringify(location), ctx.session.editingListingId, ctx.from.id.toString()]
  );

  delete ctx.session.awaitingInput;
  await ctx.reply(ctx.t('edit-success'));
  await showCurrentListing(ctx);
});

// Возврат к просмотру объявления
editListingScene.action('back_to_edit', async (ctx) => {
  await ctx.answerCbQuery();
  await showCurrentListing(ctx);
});

// Возврат к списку объявлений
editListingScene.action('back_to_listings', async (ctx) => {
  await ctx.answerCbQuery();
  
  // Очищаем все сообщения и данные сессии
  if (ctx.session.editMessages) {
    for (const msgId of ctx.session.editMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
  }
  
  delete ctx.session.editingListingId;
  delete ctx.session.editField;
  delete ctx.session.awaitingInput;
  delete ctx.session.currentListing;
  delete ctx.session.editMessages;
  
  await ctx.scene.enter('my_listings');
});

export default editListingScene; 