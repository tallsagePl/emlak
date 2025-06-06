require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { I18n } = require('@grammyjs/i18n');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = new Map();

// Глобальная Map для хранения языков пользователей
const userLocales = new Map();

// Инициализация i18n
const i18n = new I18n({
  defaultLocale: 'en',
  directory: 'locales',
  useSession: true,
  locales: ['ru', 'en', 'tr'],
  localeNegotiator: (ctx) =>
    userLocales.get(ctx.from?.id) ?? ctx.from?.language_code ?? 'en',
});

// Добавляем middleware для i18n
bot.use(i18n.middleware());

// Добавляем обработчик ошибок
bot.catch((err, ctx) => {
  ctx.reply(ctx.t('error'));
});

// Добавляем логирование действий пользователя
bot.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
});

function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function showStartMenu(ctx) {
  return ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('add'), 'add')],
    [Markup.button.callback(ctx.t('view'), 'view')],
    [Markup.button.callback(ctx.t('change-lang'), 'change_lang')]
  ]));
}

// Главный экран: /start и кнопка "Посмотреть"
bot.start((ctx) => {
  ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('add'), 'add')],
    [Markup.button.callback(ctx.t('view'), 'view')],
    [Markup.button.callback(ctx.t('change-lang'), 'change_lang')]
  ]));
});

bot.command('view', (ctx) => {
  sessions.set(ctx.from.id, { step: 'view_menu', filters: [], offset: 0 });
  ctx.reply(ctx.t('view-menu-title'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('view-all'), 'view_all')],
    [Markup.button.callback(ctx.t('view-filtered'), 'view_filtered')]
  ]));
});

bot.action('view', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  sessions.set(ctx.from.id, { step: 'view_menu', filters: [], offset: 0 });
  await ctx.reply(ctx.t('view-menu-title'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('view-all'), 'view_all')],
    [Markup.button.callback(ctx.t('view-filtered'), 'view_filtered')]
  ]));
});

// ===== ВСЕ ОБЪЯВЛЕНИЯ С ПАГИНАЦИЕЙ =====
bot.action('view_all', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || {};
  if (!session.shownMessages) session.shownMessages = [];
  sessions.set(ctx.from.id, session);

  // Перед показом новых объявлений удаляем старые сообщения
  if (session.shownMessages && session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try {
        await ctx.deleteMessage(msgId);
      } catch (e) { /* игнорируем ошибки удаления */ }
    }
    session.shownMessages = [];
  }

  const offset = 0;
  const result = await db.query(
    `SELECT * FROM listings ORDER BY created_at DESC LIMIT 10 OFFSET $1`,
    [offset]
  );

  if (!result.rows.length) {
    await ctx.reply(ctx.t('listing-empty'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
    ]));
    return;
  }

  for (const row of result.rows) {
    // Формируем строку адреса
    let addressText = '';
    if (row.address) {
      addressText = `📍 ${escapeMarkdown(row.address)}\n`;
    } else if (row.location) {
      addressText = `📍 ${escapeMarkdown(ctx.t('location-geo'))}\n`;
    }

    // Формируем текст объявления
    let message =
      `🏡 *${escapeMarkdown(row.property_type)}*, ${escapeMarkdown(row.rooms)}, ${escapeMarkdown(row.price)}\n` +
      addressText +
      `📝 ${escapeMarkdown(row.description)}`;

    const sent = await ctx.replyWithMarkdownV2(message);
    session.shownMessages.push(sent.message_id);

    // Если есть location — отправляем геоточку
    if (row.location) {
      try {
        const loc = JSON.parse(row.location);
        if (loc.latitude && loc.longitude) {
          const geoMsg = await ctx.replyWithLocation(loc.latitude, loc.longitude);
          session.shownMessages.push(geoMsg.message_id);
        }
      } catch (e) {
        // игнорируем ошибку парсинга
      }
    }
  }

  // После показа объявлений выводим кнопки
  let buttons = [];
  if (offset > 0) {
    buttons.push(Markup.button.callback(ctx.t('listing-prev'), `view_all_${offset - 10}`));
  }
  if (result.rows.length === 10) {
    buttons.push(Markup.button.callback(ctx.t('listing-next'), `view_all_${offset + 10}`));
  }
  if (buttons.length) {
    const btnMsg = await ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([buttons, [Markup.button.callback(ctx.t('back'), 'back_to_menu')]]));
    session.shownMessages.push(btnMsg.message_id);
  } else {
    const btnMsg = await ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([[Markup.button.callback(ctx.t('back'), 'back_to_menu')]]));
    session.shownMessages.push(btnMsg.message_id);
  }
});

// Отдельный обработчик для пагинации
bot.action(/view_all_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || {};
  if (!session.shownMessages) session.shownMessages = [];
  sessions.set(ctx.from.id, session);

  // Перед показом новых объявлений удаляем старые сообщения
  if (session.shownMessages && session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try {
        await ctx.deleteMessage(msgId);
      } catch (e) { /* игнорируем ошибки удаления */ }
    }
    session.shownMessages = [];
  }

  const offset = parseInt(ctx.match[1]);
  const result = await db.query(
    `SELECT * FROM listings ORDER BY created_at DESC LIMIT 10 OFFSET $1`,
    [offset]
  );

  if (!result.rows.length) {
    await ctx.reply(ctx.t('listing-empty'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
    ]));
    return;
  }

  for (const row of result.rows) {
    // Формируем строку адреса
    let addressText = '';
    if (row.address) {
      addressText = `📍 ${escapeMarkdown(row.address)}\n`;
    } else if (row.location) {
      addressText = `📍 ${escapeMarkdown(ctx.t('location-geo'))}\n`;
    }

    // Формируем текст объявления
    let message =
      `🏡 *${escapeMarkdown(row.property_type)}*, ${escapeMarkdown(row.rooms)}, ${escapeMarkdown(row.price)}\n` +
      addressText +
      `📝 ${escapeMarkdown(row.description)}`;

    const sent = await ctx.replyWithMarkdownV2(message);
    session.shownMessages.push(sent.message_id);

    // Если есть location — отправляем геоточку
    if (row.location) {
      try {
        const loc = JSON.parse(row.location);
        if (loc.latitude && loc.longitude) {
          const geoMsg = await ctx.replyWithLocation(loc.latitude, loc.longitude);
          session.shownMessages.push(geoMsg.message_id);
        }
      } catch (e) {
        // игнорируем ошибку парсинга
      }
    }
  }

  // После показа объявлений выводим кнопки
  let buttons = [];
  if (offset > 0) {
    buttons.push(Markup.button.callback(ctx.t('listing-prev'), `view_all_${offset - 10}`));
  }
  if (result.rows.length === 10) {
    buttons.push(Markup.button.callback(ctx.t('listing-next'), `view_all_${offset + 10}`));
  }
  if (buttons.length) {
    const btnMsg = await ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([buttons, [Markup.button.callback(ctx.t('back'), 'back_to_menu')]]));
    session.shownMessages.push(btnMsg.message_id);
  } else {
    const btnMsg = await ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([[Markup.button.callback(ctx.t('back'), 'back_to_menu')]]));
    session.shownMessages.push(btnMsg.message_id);
  }
});

// ===== ФИЛЬТРЫ =====
bot.action('view_filtered', async (ctx) => {
  const session = sessions.get(ctx.from.id) || { filters: [], offset: 0 };
  session.step = 'filter_menu';
  sessions.set(ctx.from.id, session);

  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const msg = await ctx.reply(
    ctx.t('filter-added') + '\n' + ctx.t('filter-count', { count: session.filters.length }),
    Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('filter-show'), 'show_filtered')],
      [Markup.button.callback(ctx.t('filter-add'), 'add_filter')]
    ])
  );
  session.shownMessages = session.shownMessages || [];
  session.shownMessages.push(msg.message_id);
});

bot.action('add_filter', async (ctx) => {
  const session = sessions.get(ctx.from.id);
  if (!session) return;
  session.step = 'choose_filter';

  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.reply(ctx.t('filter-type-title'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('filter-type'), 'filter_type')],
    [Markup.button.callback(ctx.t('filter-currency'), 'filter_currency')],
    [Markup.button.callback(ctx.t('filter-rooms'), 'filter_rooms')],
    [Markup.button.callback(ctx.t('filter-price'), 'filter_price')]
  ]));
});

bot.action('filter_type', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.reply(ctx.t('filter-type-title'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('property-rent'), 'filter_type_set_Аренда')],
    [Markup.button.callback(ctx.t('property-sale'), 'filter_type_set_Продажа')]
  ]));
});

bot.action('filter_currency', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.reply(ctx.t('filter-type-title'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('currency-usd'), 'filter_currency_set_USD'), Markup.button.callback(ctx.t('currency-try'), 'filter_currency_set_TRY')],
    [Markup.button.callback(ctx.t('currency-eur'), 'filter_currency_set_EUR'), Markup.button.callback(ctx.t('currency-rub'), 'filter_currency_set_RUB')]
  ]));
});

bot.action('filter_rooms', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.reply(ctx.t('filter-type-title'), Markup.inlineKeyboard([
    [ctx.t('rooms-1-0'), ctx.t('rooms-1-1'), ctx.t('rooms-2-1'), ctx.t('rooms-3-1'), ctx.t('rooms-4-1'), ctx.t('rooms-other')].map(val => 
      Markup.button.callback(val, 'filter_rooms_set_' + val))
  ]));
});

bot.action('filter_price', async (ctx) => {
  const session = sessions.get(ctx.from.id);
  session.step = 'price_from';
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.reply(ctx.t('price-min'));
});

bot.on('text', async (ctx) => {
  const session = sessions.get(ctx.from.id);
  if (!session || !session.step) return;

  // === Добавление объявления ===
  if (session.step === 'add_price') {
    const value = ctx.message.text.trim();
    if (!/^\d+(\.\d+)?$/.test(value)) {
      return ctx.reply(ctx.t('price-only-number'));
    }
    session.data.price = value + ' ' + session.data.currency;
    session.step = 'add_rooms';
    return ctx.reply(ctx.t('rooms-choose'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('rooms-1-0'), 'add_rooms_1+0'), Markup.button.callback(ctx.t('rooms-1-1'), 'add_rooms_1+1')],
      [Markup.button.callback(ctx.t('rooms-2-1'), 'add_rooms_2+1'), Markup.button.callback(ctx.t('rooms-3-1'), 'add_rooms_3+1')],
      [Markup.button.callback(ctx.t('rooms-4-1'), 'add_rooms_4+1'), Markup.button.callback(ctx.t('rooms-other'), 'add_rooms_Другое')]
    ]));
  }
  if (session.step === 'add_rooms_text') {
    session.data.rooms = ctx.message.text.trim();
    session.step = 'add_location';
    return ctx.reply(ctx.t('location-send'));
  }
  if (session.step === 'add_location') {
    session.data.location = ctx.message.location;
    session.data.address = null;
    session.step = 'add_address';
    await ctx.reply(ctx.t('location-address'));
    return;
  }
  if (session.step === 'add_address') {
    const text = ctx.message.text.trim();
    if (text !== '-' && text !== ctx.t('location-skip')) {
      session.data.address = text;
    } else {
      session.data.address = null;
    }
    session.step = 'add_description';
    return ctx.reply(ctx.t('description-enter'));
  }
  if (session.step === 'add_description') {
    session.data.description = ctx.message.text.trim();
    await db.query(
      `INSERT INTO listings (owner_id, property_type, rooms, price, location, address, description) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ctx.from.id, // owner_id
        session.data.property_type,
        session.data.rooms,
        session.data.price,
        session.data.location ? JSON.stringify(session.data.location) : null,
        session.data.address,
        session.data.description
      ]
    );
    sessions.delete(ctx.from.id);
    await ctx.reply(ctx.t('listing-success'));
    return showStartMenu(ctx);
  }

  // === Фильтры ===
  if (session.step === 'price_from') {
    session.filters.push({ type: 'price_from', value: Number(ctx.message.text.trim()) });
    session.step = 'price_to';
    return ctx.reply(ctx.t('price-max'));
  }
  if (session.step === 'price_to') {
    session.filters.push({ type: 'price_to', value: Number(ctx.message.text.trim()) });
    session.step = 'filter_menu';

    // Удаляем старые сообщения с фильтрами и кнопками
    if (session.shownMessages && session.shownMessages.length) {
      for (const msgId of session.shownMessages) {
        try { await ctx.deleteMessage(msgId); } catch (e) {}
      }
      session.shownMessages = [];
    }

    const msg = await ctx.reply(
      ctx.t('filter-added') + '\n' + ctx.t('filter-count', { count: session.filters.length }),
      Markup.inlineKeyboard([
        [Markup.button.callback(ctx.t('filter-show'), 'show_filtered')],
        [Markup.button.callback(ctx.t('filter-add'), 'add_filter')]
      ])
    );
    session.shownMessages = session.shownMessages || [];
    session.shownMessages.push(msg.message_id);
    return;
  }

  // Обработка текстового адреса после геоточки
  if (session.step === 'add_location' && ctx.message.text) {
    session.data.location = null;
    session.data.address = ctx.message.text.trim();
    session.step = 'add_description';
    return ctx.reply(ctx.t('description-enter'));
  }
});

bot.on('location', async (ctx) => {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'add_location') return;
  session.data.location = ctx.message.location;
  session.data.address = null;
  session.step = 'add_address';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('location-address'));
});

bot.action(/filter_type_set_(.+)/, async (ctx) => {
  const session = sessions.get(ctx.from.id);
  // Удаляем предыдущий фильтр типа недвижимости, если есть
  session.filters = (session.filters || []).filter(f => f.type !== 'property_type');
  session.filters.push({ type: 'property_type', value: ctx.match[1] });
  session.step = 'filter_menu';
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const msg = await ctx.reply(
    ctx.t('filter-added') + '\n' + ctx.t('filter-count', { count: session.filters.length }),
    Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('filter-show'), 'show_filtered')],
      [Markup.button.callback(ctx.t('filter-add'), 'add_filter')]
    ])
  );
  session.shownMessages = session.shownMessages || [];
  session.shownMessages.push(msg.message_id);
});

bot.action(/filter_currency_set_(.+)/, async (ctx) => {
  const session = sessions.get(ctx.from.id);
  session.filters = session.filters || [];
  // Добавляем валюту только если её ещё нет в фильтрах
  if (!session.filters.some(f => f.type === 'currency' && f.value === ctx.match[1])) {
    session.filters.push({ type: 'currency', value: ctx.match[1] });
  }
  session.step = 'filter_menu';
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const msg = await ctx.reply(
    ctx.t('filter-added') + '\n' + ctx.t('filter-count', { count: session.filters.length }),
    Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('filter-show'), 'show_filtered')],
      [Markup.button.callback(ctx.t('filter-add'), 'add_filter')]
    ])
  );
  session.shownMessages = session.shownMessages || [];
  session.shownMessages.push(msg.message_id);
});

bot.action(/filter_rooms_set_(.+)/, async (ctx) => {
  const session = sessions.get(ctx.from.id);
  session.filters.push({ type: 'rooms', value: ctx.match[1] });
  session.step = 'filter_menu';
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const msg = await ctx.reply(
    ctx.t('filter-added') + '\n' + ctx.t('filter-count', { count: session.filters.length }),
    Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('filter-show'), 'show_filtered')],
      [Markup.button.callback(ctx.t('filter-add'), 'add_filter')]
    ])
  );
  session.shownMessages = session.shownMessages || [];
  session.shownMessages.push(msg.message_id);
});

bot.action('show_filtered', async (ctx) => {
  const session = sessions.get(ctx.from.id) || {};
  session.offset = 0;
  sessions.set(ctx.from.id, session);
  await showFilteredListings(ctx, 0);
});

bot.action(/show_filtered_(\d+)/, async (ctx) => {
  const session = sessions.get(ctx.from.id) || {};
  const offset = parseInt(ctx.match[1]);
  session.offset = offset;
  sessions.set(ctx.from.id, session);
  await showFilteredListings(ctx, offset);
});

async function showFilteredListings(ctx, offset = 0) {
  offset = Number(offset) || 0;
  const session = sessions.get(ctx.from.id) || {};
  if (!session.shownMessages) session.shownMessages = [];
  sessions.set(ctx.from.id, session);
  const filters = session.filters || [];
  let where = [];
  let params = [];

  // Группируем валюты и комнаты отдельно
  const currencyFilters = filters.filter(f => f.type === 'currency');
  const roomsFilters = filters.filter(f => f.type === 'rooms');
  const otherFilters = filters.filter(f => f.type !== 'currency' && f.type !== 'rooms');

  if (currencyFilters.length) {
    const currencyConds = currencyFilters.map((f, idx) => {
      params.push(`%${f.value}%`);
      return `price ILIKE $${params.length}`;
    });
    where.push('(' + currencyConds.join(' OR ') + ')');
  }

  if (roomsFilters.length) {
    const roomsConds = roomsFilters.map((f, idx) => {
      params.push(f.value);
      return `rooms = $${params.length}`;
    });
    where.push('(' + roomsConds.join(' OR ') + ')');
  }

  otherFilters.forEach((f) => {
    switch (f.type) {
      case 'property_type':
        where.push(`property_type = $${params.length + 1}`);
        params.push(f.value);
        break;
      case 'price_from':
        where.push(`CAST(split_part(price, ' ', 1) AS NUMERIC) >= $${params.length + 1}`);
        params.push(f.value);
        break;
      case 'price_to':
        where.push(`CAST(split_part(price, ' ', 1) AS NUMERIC) <= $${params.length + 1}`);
        params.push(f.value);
        break;
    }
  });

  // Удаляем старые сообщения
  if (session.shownMessages && session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
    session.shownMessages = [];
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT * FROM listings ${whereClause} ORDER BY created_at DESC LIMIT 10 OFFSET $${params.length + 1}`,
    [...params, offset]
  );

  if (!result.rows.length) {
    const btnMsg = await ctx.reply(ctx.t('listing-empty'), Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t('back'), 'back_to_menu')]
    ]));
    session.shownMessages.push(btnMsg.message_id);
    return;
  }

  for (const row of result.rows) {
    let addressText = '';
    if (row.address) {
      addressText = `📍 ${escapeMarkdown(row.address)}\n`;
    } else if (row.location) {
      addressText = `📍 ${escapeMarkdown(ctx.t('location-geo'))}\n`;
    }

    // Формируем текст объявления
    let message =
      `🏡 *${escapeMarkdown(row.property_type)}*, ${escapeMarkdown(row.rooms)}, ${escapeMarkdown(row.price)}\n` +
      addressText +
      `📝 ${escapeMarkdown(row.description)}`;

    const sent = await ctx.replyWithMarkdownV2(message);
    session.shownMessages.push(sent.message_id);

    // Если есть location — отправляем геоточку
    if (row.location) {
      try {
        const loc = JSON.parse(row.location);
        if (loc.latitude && loc.longitude) {
          const geoMsg = await ctx.replyWithLocation(loc.latitude, loc.longitude);
          session.shownMessages.push(geoMsg.message_id);
        }
      } catch (e) {
        // игнорируем ошибку парсинга
      }
    }
  }

  // После показа объявлений выводим кнопки
  let buttons = [];
  if (offset > 0) {
    buttons.push(Markup.button.callback(ctx.t('listing-prev'), `show_filtered_${offset - 10}`));
  }
  if (result.rows.length === 10) {
    buttons.push(Markup.button.callback(ctx.t('listing-next'), `show_filtered_${offset + 10}`));
  }
  let actionButtons = [
    Markup.button.callback(ctx.t('filter-add'), 'add_filter'),
    Markup.button.callback(ctx.t('back'), 'back_to_menu')
  ];
  const btnMsg = await ctx.reply(ctx.t('welcome'), Markup.inlineKeyboard([
    buttons,
    actionButtons
  ].filter(arr => arr.length)));
  session.shownMessages.push(btnMsg.message_id);
};

bot.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || {};
  if (session.shownMessages && session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
    session.shownMessages = [];
  }
  return showStartMenu(ctx);
});

bot.action('add', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  // Здесь логика для добавления объявления
  // Например, переход к первому шагу добавления:
  sessions.set(ctx.from.id, { step: 'add_property_type', data: {} });
  await ctx.reply(ctx.t('property-choose'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('property-rent'), 'add_type_Аренда')],
    [Markup.button.callback(ctx.t('property-sale'), 'add_type_Продажа')]
  ]));
});

bot.action('add_type_Аренда', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  // Сохраняем выбранный тип недвижимости
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.property_type = 'Аренда';
  session.step = 'add_currency';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('filter-currency'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('currency-usd'), 'add_currency_USD'), Markup.button.callback(ctx.t('currency-try'), 'add_currency_TRY')],
    [Markup.button.callback(ctx.t('currency-eur'), 'add_currency_EUR'), Markup.button.callback(ctx.t('currency-rub'), 'add_currency_RUB')]
  ]));
});

bot.action('add_type_Продажа', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  // Сохраняем выбранный тип недвижимости
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.property_type = 'Продажа';
  session.step = 'add_currency';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('filter-currency'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('currency-usd'), 'add_currency_USD'), Markup.button.callback(ctx.t('currency-try'), 'add_currency_TRY')],
    [Markup.button.callback(ctx.t('currency-eur'), 'add_currency_EUR'), Markup.button.callback(ctx.t('currency-rub'), 'add_currency_RUB')]
  ]));
});

bot.action(/add_currency_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.currency = ctx.match[1];
  session.step = 'add_price';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('price-enter'));
});

bot.action(/add_rooms_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.rooms = ctx.match[1];
  // Если выбрано "Другое", просим ввести вручную
  if (ctx.match[1] === 'Другое') {
    session.step = 'add_rooms_text';
    sessions.set(ctx.from.id, session);
    return ctx.reply(ctx.t('rooms-text'));
  }
  session.step = 'add_location';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('location-send'));
});

// Обработчик смены языка
bot.action('change_lang', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  await ctx.reply(ctx.t('choose-lang'), Markup.inlineKeyboard([
    [
      Markup.button.callback('🇷🇺 Русский', 'set_lang_ru'),
      Markup.button.callback('🇬🇧 English', 'set_lang_en'),
      Markup.button.callback('🇹🇷 Türkçe', 'set_lang_tr')
    ]
  ]));
});

bot.action('set_lang_ru', async (ctx) => {
  userLocales.set(ctx.from.id, 'ru');
  await ctx.i18n.renegotiateLocale();
  await ctx.answerCbQuery(ctx.t('choose-lang') + ' Русский');
  try { await ctx.deleteMessage(); } catch (e) {}
  return showStartMenu(ctx);
});

bot.action('set_lang_en', async (ctx) => {
  userLocales.set(ctx.from.id, 'en');
  await ctx.i18n.renegotiateLocale();
  await ctx.answerCbQuery(ctx.t('choose-lang') + ' English');
  try { await ctx.deleteMessage(); } catch (e) {}
  return showStartMenu(ctx);
});

bot.action('set_lang_tr', async (ctx) => {
  userLocales.set(ctx.from.id, 'tr');
  await ctx.i18n.renegotiateLocale();
  await ctx.answerCbQuery(ctx.t('choose-lang') + ' Türkçe');
  try { await ctx.deleteMessage(); } catch (e) {}
  return showStartMenu(ctx);
});

bot.launch().then(() => console.log('🤖 Бот запущен'));