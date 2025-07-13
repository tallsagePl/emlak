/**
 * Сцена работы с парсером объявлений (parsed_listings)
 * 
 * Назначение:
 * - Просмотр объявлений, собранных парсером
 * - Импорт понравившихся объявлений в свой список
 * - Управление настройками парсера
 * 
 * Функциональность:
 * 1. Просмотр спаршенных объявлений:
 *    - Список новых объявлений
 *    - Детальная информация по каждому
 *    - Постраничный просмотр
 * 
 * 2. Управление объявлениями:
 *    - Импорт в свои объявления
 *    - Пометка как просмотренное
 *    - Скрытие неинтересных
 * 
 * 3. Настройки парсера:
 *    - Выбор источников
 *    - Частота обновления
 *    - Фильтры для парсинга
 * 
 * 4. Статистика:
 *    - Количество новых объявлений
 *    - Время последнего обновления
 *    - Статус работы парсера
 * 
 * События:
 * - enter: Вход в сцену, показ меню парсера
 * - action(parsed_*): Пагинация
 * - action(import_*): Импорт объявления
 * - action(hide_*): Скрытие объявления
 * - action(settings_*): Настройки парсера
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { 
  clearOldMessages,
  showMainMenu
} from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Функция для показа списка объявлений
async function showParsedListings(ctx, source = null, offset = 0) {
  if (!ctx.session.shownMessages) ctx.session.shownMessages = [];

  // Удаляем старые сообщения
  await clearOldMessages(ctx, ctx.session);

  // Сначала получаем общее количество объявлений
  let countQuery, countParams;
  if (source) {
    countQuery = 'SELECT COUNT(*) as total FROM parsed_listings WHERE site_name = $1';
    countParams = [source];
  } else {
    countQuery = 'SELECT COUNT(*) as total FROM parsed_listings';
    countParams = [];
  }
  
  const totalResult = await database.query(countQuery, countParams);
  const total = parseInt(totalResult.rows[0].total);


  // Проверяем, не превышает ли offset общее количество
  if (offset >= total) {
    const btnMsg = await ctx.reply(`❌ ${ctx.t('parsed-listings-no-more')}`, Markup.inlineKeyboard([
      [Markup.button.callback(`↩️ ${ctx.t('back-to-sources')}`, 'back_to_sources')]
    ]));
    ctx.session.shownMessages.push(btnMsg.message_id);
    return;
  }

  // Формируем запрос для получения страницы объявлений
  let query, params;
  if (source) {
    query = `SELECT * FROM parsed_listings WHERE site_name = $1 ORDER BY created_at DESC LIMIT 5 OFFSET $2`;
    params = [source, offset];
  } else {
    query = `SELECT * FROM parsed_listings ORDER BY created_at DESC LIMIT 5 OFFSET $1`;
    params = [offset];
  }

  const listings = await database.query(query, params);

  if (!listings.rows.length) {
    const btnMsg = await ctx.reply(`❌ ${ctx.t('parsed-listings-not-found')}`, Markup.inlineKeyboard([
      [Markup.button.callback(`↩️ ${ctx.t('back-to-sources')}`, 'back_to_sources')]
    ]));
    ctx.session.shownMessages.push(btnMsg.message_id);
    return;
  }

  for (const row of listings.rows) {
    // Правильно извлекаем данные из JSONB поля
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const specs = data.specifications || {};
    
    // Получаем эмодзи для сайта
    let source_emoji = '🏘️';
    let displayName = row.site_name;
    
    switch(row.site_name) {
      case 'hepsiemlak':
        source_emoji = '🏠';
        displayName = 'HEPSEMLAK';
        break;
      case 'emlakjet':
        source_emoji = '🏡';
        displayName = 'EMLAKJET';
        break;
      case 'sahibinden':
        source_emoji = '🏢';
        displayName = 'SAHIBINDEN';
        break;
      case 'hurriyet':
        source_emoji = '📰';
        displayName = 'HÜRRIYET EMLAK';
        break;
      case 'zingate':
        source_emoji = '🔑';
        displayName = 'ZINGATE';
        break;
      default:
        source_emoji = '🏘️';
        displayName = row.site_name.toUpperCase();
    }

    // Формируем сообщение
    let message = `${source_emoji} *${displayName}*\n\n`;

    // Основная информация
    message += `🏡 *${specs['Тип1'] || 'Не указан'}*\n`;
    message += `📋 *${specs['Тип недвижимости'] || 'Не указан'}*\n`;
    message += `📍 ${specs['Тип2'] || 'Не указано'}\n\n`;

    // Информация об объявлении
    message += `🔢 Номер: ${specs['Номер объявления'] || 'Не указан'}\n`;
    message += `📅 Дата: ${specs['Дата объявления'] || 'Не указана'}\n`;
    message += `🔄 Обновлено: ${specs['İlan Güncelleme Tarihi'] || 'Не указано'}\n\n`;

    // Характеристики помещения
    message += `🚪 Комнаты: ${specs['Количество комнат'] || 'Не указано'}\n`;
    message += `📐 Нетто: ${specs['м² (нетто)'] || 'Не указана'}\n`;
    message += `📏 Брутто: ${specs['м² (брутто)'] || 'Не указана'}\n`;
    message += `🏢 Этаж: ${specs['Расположен на'] || 'Не указан'} из ${specs['Количество этажей'] || '?'}\n`;
    message += `🏗 Возраст здания: ${specs['Здание возраст'] || 'Не указан'}\n\n`;

    // Дополнительная информация
    message += `🔥 Отопление: ${specs['Isıtma Тип1'] || 'Не указано'}\n`;
    message += `👥 Статус: ${specs['Kullanım Durumu'] || 'Не указан'}\n`;
    message += `💳 Кредит: ${specs['Krediye Uygunluk'] || 'Не указано'}\n`;
    message += `📈 Инвестиция: ${specs['Yatırıma Uygunluk'] || 'Не указано'}\n`;
    message += `📄 ТАПУ: ${specs['Tapu Durumu'] || 'Не указано'}\n`;
    message += `🏘 В комплексе: ${specs['Site İçerisinde'] || 'Не указано'}\n`;
    message += `🛋 Мебель: ${specs['Eşya Durumu'] || 'Не указано'}\n`;
    message += `🔄 Бартер: ${specs['Takas'] || 'Не указано'}\n`;
    message += `🚿 Кол-во ванных: ${specs['Banyo Sayısы'] || 'Не указано'}\n\n`;

    // Описание
    if (data.description) {
      message += `📝 ${data.description}\n\n`;
    }

    // Дата парсинга и ID
    message += `⏰ Дата парсинга: ${new Date(row.created_at).toLocaleDateString('ru-RU')}\n`;
    message += `🆔 ID: ${row.id}`;

    // Отправляем основное сообщение
    const sent = await ctx.reply(message, { parse_mode: 'Markdown' });
    ctx.session.shownMessages.push(sent.message_id);

    // Добавляем кнопку с ссылкой на источник
    if (row.url) {
      const linkMsg = await ctx.reply('🔗 Ссылка на оригинал:', Markup.inlineKeyboard([
        [Markup.button.url('Посмотреть на сайте', row.url)]
      ]));
      ctx.session.shownMessages.push(linkMsg.message_id);
    }
  }

  // Модифицируем логику пагинации
  const currentPage = Math.floor(offset / 5) + 1;
  const totalPages = Math.ceil(total / 5);
  const hasMore = currentPage < totalPages;
  const hasPrev = currentPage > 1;
  
  const paginationButtons = [];
  if (hasPrev) {
    paginationButtons.push(
      Markup.button.callback('⬅️ Предыдущие', `parsed_${source || 'all'}_${offset - 5}`)
    );
  }
  if (hasMore) {
    paginationButtons.push(
      Markup.button.callback('Следующие ➡️', `parsed_${source || 'all'}_${offset + 5}`)
    );
  }

  const navigationButtons = [
    paginationButtons,
    [Markup.button.callback(`↩️ ${ctx.t('back-to-sources')}`, 'back_to_sources')],
    [Markup.button.callback(`🏠 ${ctx.t('back')}`, 'back_to_menu')]
  ].filter(buttons => buttons.length > 0);

  const navMsg = await ctx.reply(
    ctx.t('parsed-listings-showing', {
      from: offset + 1,
      to: offset + listings.rows.length,
      total: total,
      page: currentPage,
      totalPages: totalPages
    }),
    Markup.inlineKeyboard(navigationButtons)
  );
  ctx.session.shownMessages.push(navMsg.message_id);
}

// Функция импорта объявления
async function importListing(ctx, parsedId) {
  const result = await database.query(
    'SELECT * FROM parsed_listings WHERE id = $1',
    [parsedId]
  );

  if (!result.rows.length) {
    await ctx.reply(ctx.t('error'));
    return false;
  }

  const listing = result.rows[0];
  
  // Правильно извлекаем данные из JSONB поля
  const data = typeof listing.data === 'string' ? JSON.parse(listing.data) : listing.data;
  const specs = data.specifications || {};

  // Импортируем в user_listings
  await database.query(
    `INSERT INTO user_listings (
      owner_id, property_type, district, price, rooms,
      description, address, location, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      ctx.from.id.toString(),
      specs['Тип недвижимости'] || 'Не указан',
      specs['Тип2'] || 'Не указан',
      specs['Цена'] || 'Не указана',
      specs['Количество комнат'] || 'Не указано',
      data.description || 'Без описания',
      specs['Провинция'] || null,
      null, // location coordinates не импортируем
      'live',
      new Date()
    ]
  );

  return true;
}

// Функция для показа меню источников
async function showSourceMenu(ctx) {
  if (!ctx.session.shownMessages) ctx.session.shownMessages = [];

  // Удаляем старые сообщения
  await clearOldMessages(ctx, ctx.session);

  // Получаем список уникальных источников и количество объявлений
  const result = await database.query(
    `SELECT site_name, COUNT(*) as count 
     FROM parsed_listings 
     GROUP BY site_name 
     ORDER BY count DESC`
  );

  const buttons = [];
  let totalCount = 0;

  // Формируем кнопки для каждого источника
  for (const row of result.rows) {
    let emoji = '🏘️';
    let displayName = row.site_name.toUpperCase();
    
    switch(row.site_name) {
      case 'hepsiemlak':
        emoji = '🏠';
        displayName = 'HEPSEMLAK';
        break;
      case 'emlakjet':
        emoji = '🏡';
        displayName = 'EMLAKJET';
        break;
      case 'sahibinden':
        emoji = '🏢';
        displayName = 'SAHIBINDEN';
        break;
      case 'hurriyet':
        emoji = '📰';
        displayName = 'HÜRRIYET EMLAK';
        break;
      case 'zingate':
        emoji = '🔑';
        displayName = 'ZINGATE';
        break;
    }

    buttons.push([
      Markup.button.callback(
        `${emoji} ${displayName} (${row.count})`,
        `show_source_${row.site_name}`
      )
    ]);
    totalCount += parseInt(row.count);
  }

  // Добавляем кнопку "Показать все" и возврат в меню
  buttons.push([
    Markup.button.callback(`📋 ${ctx.t('parsed-listings-show-all')} (${totalCount})`, 'show_source_all')
  ]);
  buttons.push([
    Markup.button.callback(`🏠 ${ctx.t('back')}`, 'back_to_menu')
  ]);

  const msg = await ctx.reply(
    ctx.t('parsed-listings-choose-source'),
    Markup.inlineKeyboard(buttons)
  );
  ctx.session.shownMessages.push(msg.message_id);
}

// Создаем сцену
const parsedListingsScene = new BaseScene('parsed_listings');

// Вход в сцену
parsedListingsScene.enter(async (ctx) => {
  await showSourceMenu(ctx);
});

// Обработчик выбора источника
parsedListingsScene.action(/show_source_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const source = ctx.match[1];
  await showParsedListings(ctx, source === 'all' ? null : source, 0);
});

// Обработчик пагинации
parsedListingsScene.action(/parsed_(\w+)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const [source, offsetStr] = ctx.match.slice(1);
  const offset = parseInt(offsetStr);
  await showParsedListings(ctx, source === 'all' ? null : source, offset);
});

// Просмотр объявления на сайте
parsedListingsScene.action(/view_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const listingId = ctx.match[1];
  
  const result = await database.query(
    'SELECT url FROM parsed_listings WHERE id = $1',
    [listingId]
  );

  if (result.rows.length && result.rows[0].url) {
    await ctx.reply(ctx.t('listing-original-link') + '\n' + result.rows[0].url);
  }
});

// Импорт объявления
parsedListingsScene.action(/import_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const listingId = ctx.match[1];
  
  const success = await importListing(ctx, listingId);
  if (success) {
    await ctx.reply(ctx.t('listing-import-success'));
    // Обновляем список, так как импортированное объявление должно исчезнуть
    await showParsedListings(ctx, null, 0);
  }
});

// Возврат к списку источников
parsedListingsScene.action('back_to_sources', async (ctx) => {
  await ctx.answerCbQuery();
  await showSourceMenu(ctx);
});

// Возврат в главное меню
parsedListingsScene.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  // Очищаем сообщения и выходим из сцены
  await clearOldMessages(ctx, ctx.session);
  if (ctx.session.shownMessages) {
    delete ctx.session.shownMessages;
  }
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

export default parsedListingsScene; 