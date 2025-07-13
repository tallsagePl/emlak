const { Markup } = require('telegraf');
const database = require('../database');

// Хранилище для сессий
const sessions = new Map();

async function showParsedListings(ctx, source = null, offset = 0) {
  const session = sessions.get(ctx.from.id) || {};
  if (!session.shownMessages) session.shownMessages = [];
  sessions.set(ctx.from.id, session);

  // Удаляем старые сообщения
  if (session.shownMessages && session.shownMessages.length) {
    for (const msgId of session.shownMessages) {
      try { await ctx.deleteMessage(msgId); } catch (e) {}
    }
    session.shownMessages = [];
  }

  // Формируем запрос
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
    const btnMsg = await ctx.reply('❌ Спаршенные объявления не найдены', Markup.inlineKeyboard([
      [Markup.button.callback('↩️ Назад', 'view_parsed')]
    ]));
    session.shownMessages.push(btnMsg.message_id);
    return;
  }

  for (const row of listings.rows) {
    const data = row.data;
    if (!data || !data.specifications) continue;
    
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
    }

    // Формируем сообщение только из specifications
    let message = `${source_emoji} ${displayName}\n\n`;
    const specs = data.specifications;

    // Приоритетные поля
    const priorityFields = [
      'Название',
      'Цена',
      'Местоположение',
      'Тип недвижимости',
      'Количество комнат',
      'м² (брутто)',
      'м² (нетто)',
      'Расположен на',
      'Количество этажей'
    ];

    // Добавляем приоритетные поля с эмодзи
    for (const field of priorityFields) {
      if (specs[field]) {
        let emoji = '•';
        switch(field) {
          case 'Название':
            emoji = '📑';
            break;
          case 'Цена':
            emoji = '💰';
            break;
          case 'Местоположение':
            emoji = '📍';
            break;
          case 'Тип недвижимости':
            emoji = '🏠';
            break;
          case 'Количество комнат':
            emoji = '🚪';
            break;
          case 'м² (брутто)':
          case 'м² (нетто)':
            emoji = '📐';
            break;
          case 'Расположен на':
          case 'Количество этажей':
            emoji = '🏢';
            break;
        }
        message += `${emoji} ${field}: ${specs[field]}\n`;
      }
    }

    message += '\n📋 Характеристики:\n';

    // Добавляем остальные поля
    for (const [key, value] of Object.entries(specs)) {
      if (!priorityFields.includes(key) && value && typeof value === 'string') {
        message += `• ${key}: ${value}\n`;
      }
    }

    // Добавляем дату парсинга
    message += `\n⏰ Дата парсинга: ${new Date(row.created_at).toLocaleDateString('ru-RU')}`;
    message += `\n🆔 ID: ${row.listing_id}`;

    // Отправляем сообщение
    const sent = await ctx.reply(message);
    session.shownMessages.push(sent.message_id);

    // Добавляем кнопку с ссылкой на оригинал
    if (data.url) {
      const linkMsg = await ctx.reply('🔗 Ссылка на оригинал:', Markup.inlineKeyboard([
        [Markup.button.url('Посмотреть на сайте', data.url)]
      ]));
      session.shownMessages.push(linkMsg.message_id);
    }
  }

  // Добавляем кнопки пагинации
  let buttons = [];
  const sourceParam = source || 'all';
  
  if (offset > 0) {
    buttons.push(Markup.button.callback('⬅️ Назад', `parsed_${sourceParam}_${offset - 5}`));
  }
  if (listings.rows.length === 5) {
    buttons.push(Markup.button.callback('Вперёд ➡️', `parsed_${sourceParam}_${offset + 5}`));
  }

  const navigationButtons = [
    [Markup.button.callback('↩️ К источникам', 'view_parsed')],
    [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
  ];

  if (buttons.length > 0) {
    navigationButtons.unshift(buttons);
  }

  const navMsg = await ctx.reply(`Показано: ${offset + 1}-${offset + listings.rows.length}`, 
    Markup.inlineKeyboard(navigationButtons)
  );
  session.shownMessages.push(navMsg.message_id);
}

module.exports = {
  showParsedListings,
  sessions
}; 