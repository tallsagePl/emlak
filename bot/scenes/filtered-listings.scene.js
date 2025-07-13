/**
 * Сцена просмотра объявлений с фильтрами (filtered_listings)
 * 
 * Назначение:
 * - Позволяет пользователям искать объявления по различным критериям
 * - Комбинирование нескольких фильтров для точного поиска
 * - Постраничный просмотр отфильтрованных результатов
 * 
 * Поддерживаемые фильтры:
 * 1. Тип недвижимости (Аренда/Продажа)
 * 2. Валюта (USD, EUR, TRY, RUB)
 * 3. Количество комнат (1+0, 1+1, 2+1, 3+1, 4+1, Другое)
 * 4. Диапазон цен (от и до)
 * 
 * Функциональность:
 * 1. Пошаговое добавление фильтров через меню
 * 2. Возможность комбинировать несколько фильтров
 * 3. Отображение количества активных фильтров
 * 4. Просмотр результатов с пагинацией
 * 5. Возможность добавить новые фильтры к существующим
 * 
 * События:
 * - enter: Вход в сцену, показ меню фильтров
 * - action(filter_*): Обработка выбора фильтров
 * - action(show_filtered): Показ результатов
 * - action(show_filtered_*): Пагинация результатов
 * - text: Обработка ввода цен
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { 
  escapeMarkdown,
  showMainMenu
} from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Хранилище для сессий (сцена отключена, но оставляем для совместимости)
const sessions = new Map();

// Функция для построения SQL запроса с фильтрами
function buildFilteredQuery(filters, offset = 0) {
  let query = 'SELECT * FROM user_listings WHERE status = $1';
  let params = ['live'];
  let paramIndex = 2;

  if (filters.type) {
    query += ` AND property_type = $${paramIndex}`;
    params.push(filters.type);
    paramIndex++;
  }

  if (filters.rooms) {
    query += ` AND rooms = $${paramIndex}`;
    params.push(filters.rooms);
    paramIndex++;
  }

  if (filters.price_min !== undefined) {
    query += ` AND CAST(REGEXP_REPLACE(price, '[^0-9]', '', 'g') AS INTEGER) >= $${paramIndex}`;
    params.push(filters.price_min);
    paramIndex++;
  }

  if (filters.price_max !== undefined) {
    query += ` AND CAST(REGEXP_REPLACE(price, '[^0-9]', '', 'g') AS INTEGER) <= $${paramIndex}`;
    params.push(filters.price_max);
    paramIndex++;
  }

  query += ' ORDER BY created_at DESC LIMIT 5';
  if (offset > 0) {
    query += ` OFFSET $${paramIndex}`;
    params.push(offset);
  }

  return { query, params };
}

// Функция для показа списка объявлений
async function showListings(ctx, offset = 0) {
  const session = sessions.get(ctx.from.id) || { filters: {} };
  if (!session.shownMessages) session.shownMessages = [];
  sessions.set(ctx.from.id, session);

  // Удаляем старые сообщения
  if (session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
    session.shownMessages = [];
  }

  // Получаем объявления с фильтрами
  const { query, params } = buildFilteredQuery(session.filters, offset);
  const listings = await database.query(query, params);

  if (!listings.rows.length) {
    const msg = await ctx.reply(ctx.t('listing-not-found'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('filter-add'), 'add_filter')],
      [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
    ]));
    session.shownMessages.push(msg.message_id);
    return;
  }

  // Показываем объявления
  for (const row of listings.rows) {
    let addressText = '';
    if (row.address) {
      addressText = `📍 ${escapeMarkdown(row.address)}\n`;
    } else if (row.location) {
      addressText = `📍 ${escapeMarkdown(ctx.t('location-geo'))}\n`;
    }

    let message =
      `🏡 *${escapeMarkdown(row.property_type)}*, ${escapeMarkdown(row.rooms)}, ${escapeMarkdown(row.price)}\n` +
      addressText +
      `📝 ${escapeMarkdown(row.description)}`;

    const sent = await ctx.replyWithMarkdownV2(message);
    session.shownMessages.push(sent.message_id);

    if (row.location) {
      try {
        const loc = JSON.parse(row.location);
        if (loc.latitude && loc.longitude) {
          const geoMsg = await ctx.replyWithLocation(loc.latitude, loc.longitude);
          session.shownMessages.push(geoMsg.message_id);
        }
      } catch (e) {}
    }
  }

  // Добавляем кнопки навигации и фильтров
  let buttons = [];
  
  if (offset > 0) {
    buttons.push(Markup.button.callback(ctx.t('listing-prev'), `show_${offset - 5}`));
  }
  if (listings.rows.length === 5) {
    buttons.push(Markup.button.callback(ctx.t('listing-next'), `show_${offset + 5}`));
  }

  const navigationButtons = [
    [Markup.button.callback(ctx.t('filter-add'), 'add_filter')],
    [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
  ];

  if (buttons.length > 0) {
    navigationButtons.unshift(buttons);
  }

  // Показываем текущие фильтры
  let filterText = ctx.t('filter-count', { count: Object.keys(session.filters).length });
  if (Object.keys(session.filters).length > 0) {
    filterText += '\n\n';
    if (session.filters.type) {
      filterText += `${ctx.t('filter-type')}: ${ctx.t(`property-${session.filters.type}`)}\n`;
    }
    if (session.filters.rooms) {
      filterText += `${ctx.t('filter-rooms')}: ${session.filters.rooms}\n`;
    }
    if (session.filters.price_min !== undefined || session.filters.price_max !== undefined) {
      filterText += `${ctx.t('filter-price')}: ${session.filters.price_min || '0'} - ${session.filters.price_max || '∞'}\n`;
    }
  }

  const navMsg = await ctx.reply(filterText, Markup.inlineKeyboard(navigationButtons));
  session.shownMessages.push(navMsg.message_id);
}

// Создаем сцену
const filteredListingsScene = new BaseScene('filtered_listings');

// Вход в сцену
filteredListingsScene.enter(async (ctx) => {
  await showListings(ctx, 0);
});

// Обработчик пагинации
filteredListingsScene.action(/show_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const offset = parseInt(ctx.match[1]);
  await showListings(ctx, offset);
});

// Добавление фильтра
filteredListingsScene.action('add_filter', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(ctx.t('filter-type-title'), Markup.inlineKeyboard([
    [
      Markup.button.callback(ctx.t('filter-type'), 'filter_type'),
      Markup.button.callback(ctx.t('filter-rooms'), 'filter_rooms')
    ],
    [Markup.button.callback(ctx.t('filter-price'), 'filter_price')],
    [Markup.button.callback(ctx.t('back'), 'back_to_filters')]
  ]));
});

// Фильтр по типу
filteredListingsScene.action('filter_type', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(ctx.t('property-choose'), Markup.inlineKeyboard([
    [
      Markup.button.callback(ctx.t('property-rent'), 'type_rent'),
      Markup.button.callback(ctx.t('property-sale'), 'type_sale')
    ],
    [Markup.button.callback(ctx.t('back'), 'back_to_filters')]
  ]));
});

filteredListingsScene.action(/type_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const session = { filters: {} }; // Removed sessions.get(ctx.from.id)
  session.filters.type = ctx.match[1];
  await ctx.reply(ctx.t('filter-added'));
  await showListings(ctx, 0);
});

// Фильтр по комнатам
filteredListingsScene.action('filter_rooms', async (ctx) => {
  await ctx.answerCbQuery();
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
    [Markup.button.callback(ctx.t('back'), 'back_to_filters')]
  ]));
});

filteredListingsScene.action(/rooms_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const session = { filters: {} }; // Removed sessions.get(ctx.from.id)
  const rooms = ctx.match[1];
  
  if (rooms === 'other') {
    await ctx.reply(ctx.t('rooms-text'));
    session.awaitingInput = 'rooms';
    return;
  }
  
  session.filters.rooms = rooms;
  await ctx.reply(ctx.t('filter-added'));
  await showListings(ctx, 0);
});

// Фильтр по цене
filteredListingsScene.action('filter_price', async (ctx) => {
  await ctx.answerCbQuery();
  const session = { filters: {} }; // Removed sessions.get(ctx.from.id)
  session.awaitingInput = 'price_min';
  await ctx.reply(ctx.t('price-min'));
});

// Обработка текстового ввода
filteredListingsScene.on('text', async (ctx) => {
  const session = { awaitingInput: undefined }; // Removed sessions.get(ctx.from.id)
  if (!session?.awaitingInput) return;

  const text = ctx.message.text;
  const field = session.awaitingInput;

  switch (field) {
    case 'rooms':
      session.filters.rooms = text;
      delete session.awaitingInput;
      await ctx.reply(ctx.t('filter-added'));
      await showListings(ctx, 0);
      break;

    case 'price_min':
      const priceMin = parseInt(text);
      if (isNaN(priceMin)) {
        await ctx.reply(ctx.t('error'));
        return;
      }
      session.filters.price_min = priceMin;
      session.awaitingInput = 'price_max';
      await ctx.reply(ctx.t('price-max'));
      break;

    case 'price_max':
      const priceMax = parseInt(text);
      if (isNaN(priceMax)) {
        await ctx.reply(ctx.t('error'));
        return;
      }
      session.filters.price_max = priceMax;
      delete session.awaitingInput;
      await ctx.reply(ctx.t('filter-added'));
      await showListings(ctx, 0);
      break;
  }
});

// Возврат к фильтрам
filteredListingsScene.action('back_to_filters', async (ctx) => {
  await ctx.answerCbQuery();
  await showListings(ctx, 0);
});

// Возврат в главное меню
filteredListingsScene.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const session = { filters: undefined, awaitingInput: undefined, shownMessages: undefined }; // Removed sessions.get(ctx.from.id)
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

export default filteredListingsScene; 