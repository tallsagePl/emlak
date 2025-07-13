import { Markup } from 'telegraf';

/**
 * Набор переиспользуемых функций для работы с ботом
 */

/**
 * Экранирует специальные символы для MarkdownV2
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
export function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Форматирует объявление в текст с MarkdownV2
 * @param {Object} listing - Объект объявления
 * @param {Object} ctx - Контекст бота для i18n
 * @returns {string} Отформатированный текст объявления
 */
export function formatListing(listing, ctx) {
  let addressText = '';
  if (listing.address) {
    addressText = `📍 ${escapeMarkdown(listing.address)}\n`;
  } else if (listing.location) {
    addressText = `📍 ${escapeMarkdown(ctx.t('location-geo'))}\n`;
  }

  return `🏡 *${escapeMarkdown(listing.property_type)}*, ${escapeMarkdown(listing.rooms)}, ${escapeMarkdown(listing.price)}\n` +
         addressText +
         `📝 ${escapeMarkdown(listing.description)}`;
}

/**
 * Очищает старые сообщения из сессии
 * @param {Object} ctx - Контекст бота
 * @param {Object} session - Объект сессии
 */
export async function clearOldMessages(ctx, session) {
  if (session.shownMessages && session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try {
        await ctx.deleteMessage(msgId);
      } catch (e) {
        // Игнорируем ошибки удаления
      }
    }
    session.shownMessages = [];
  }
}

/**
 * Отправляет геолокацию, если она есть в объявлении
 * @param {Object} ctx - Контекст бота
 * @param {Object} listing - Объект объявления
 * @param {Object} session - Объект сессии
 */
export async function sendLocation(ctx, listing, session) {
  if (listing.location) {
    try {
      const loc = JSON.parse(listing.location);
      if (loc.latitude && loc.longitude) {
        const geoMsg = await ctx.replyWithLocation(loc.latitude, loc.longitude);
        session.shownMessages.push(geoMsg.message_id);
      }
    } catch (e) {
      // Игнорируем ошибки парсинга
    }
  }
}

/**
 * Создает SQL условие WHERE на основе фильтров
 * @param {Array} filters - Массив фильтров
 * @returns {Object} Объект с WHERE условием и параметрами
 */
export function buildFilterWhereClause(filters) {
  let where = [];
  let params = [];

  // Группируем валюты и комнаты отдельно
  const currencyFilters = filters.filter(f => f.type === 'currency');
  const roomsFilters = filters.filter(f => f.type === 'rooms');
  const otherFilters = filters.filter(f => f.type !== 'currency' && f.type !== 'rooms');

  if (currencyFilters.length) {
    const currencyConds = currencyFilters.map((f) => {
      params.push(`%${f.value}%`);
      return `price ILIKE $${params.length}`;
    });
    where.push('(' + currencyConds.join(' OR ') + ')');
  }

  if (roomsFilters.length) {
    const roomsConds = roomsFilters.map((f) => {
      params.push(f.value);
      return `rooms = $${params.length}`;
    });
    where.push('(' + roomsConds.join(' OR ') + ')');
  }

  otherFilters.forEach((f) => {
    switch (f.type) {
      case 'property_type':
        params.push(f.value);
        where.push(`property_type = $${params.length}`);
        break;
      case 'price_from':
        params.push(f.value);
        where.push(`CAST(split_part(price, ' ', 1) AS NUMERIC) >= $${params.length}`);
        break;
      case 'price_to':
        params.push(f.value);
        where.push(`CAST(split_part(price, ' ', 1) AS NUMERIC) <= $${params.length}`);
        break;
    }
  });

  const whereClause = where.length ? `WHERE status = 'live' AND ${where.join(' AND ')}` : "WHERE status = 'live'";
  return { whereClause, params };
}

/**
 * Проверяет корректность цены
 * @param {string} price - Строка с ценой
 * @returns {boolean} Является ли цена корректной
 */
export function isValidPrice(price) {
  return /^\d+(\.\d+)?$/.test(price.trim());
}

/**
 * Создает кнопки пагинации
 * @param {Object} ctx - Контекст бота
 * @param {number} offset - Текущее смещение
 * @param {number} limit - Количество записей на странице
 * @param {number} total - Общее количество записей
 * @param {string} actionPrefix - Префикс для callback_data кнопок
 * @returns {Array} Массив кнопок
 */
export function createPaginationButtons(ctx, offset, limit, total, actionPrefix) {
  let buttons = [];
  if (offset > 0) {
    buttons.push(Markup.button.callback(
      ctx.t('listing-prev'), 
      `${actionPrefix}_${offset - limit}`
    ));
  }
  if (total === limit) {
    buttons.push(Markup.button.callback(
      ctx.t('listing-next'), 
      `${actionPrefix}_${offset + limit}`
    ));
  }
  return buttons;
}

/**
 * Инициализирует сессию для работы со списком объявлений
 * @param {Object} session - Объект сессии
 * @returns {Object} Инициализированная сессия
 */
export function initListingSession(session = {}) {
  return {
    ...session,
    filters: session.filters || [],
    offset: session.offset || 0,
    shownMessages: session.shownMessages || [],
    step: session.step || null
  };
}

/**
 * Показывает главное меню бота (избегаем дублирования кода)
 * @param {Object} ctx - Контекст бота
 * @returns {Promise} Promise отправки сообщения
 */
export function showMainMenu(ctx) {
  return ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('add'), 'add')],
    [Markup.button.callback(ctx.t('view'), 'view')],
    [Markup.button.callback(ctx.t('my-listings'), 'my_listings')],
    [Markup.button.callback(ctx.t('parsed-listings'), 'view_parsed')],
    [Markup.button.callback(ctx.t('settings'), 'settings')]
  ]));
} 