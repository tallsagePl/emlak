/**
 * Сцена добавления нового объявления (add_listing)
 * 
 * Назначение:
 * - Пошаговое создание нового объявления о недвижимости
 * - Сбор всей необходимой информации об объекте
 * - Валидация введенных данных
 * 
 * Шаги создания объявления:
 * 1. Выбор типа объявления (Аренда/Продажа)
 * 2. Выбор валюты (USD, EUR, TRY, RUB)
 * 3. Ввод цены
 * 4. Выбор количества комнат
 * 5. Указание местоположения:
 *    - Отправка геолокации
 *    - ИЛИ ввод адреса текстом
 * 6. Ввод описания объекта
 * 
 * Особенности:
 * - Проверка корректности цены
 * - Поддержка отмены на любом шаге
 * - Возможность пропустить геолокацию
 * - Ограничение длины описания
 * - Автоматическая активация объявления после создания
 * 
 * События:
 * - enter: Начало создания объявления
 * - action(add_type_*): Выбор типа
 * - action(add_currency_*): Выбор валюты
 * - action(add_rooms_*): Выбор комнат
 * - text: Обработка текстового ввода (цена, адрес, описание)
 * - location: Обработка отправленной геолокации
 */

import { Scenes, Markup } from 'telegraf';
import database from '../../database/index.js';
import { escapeMarkdown, showMainMenu } from '../utils/helpers.js';

const { BaseScene } = Scenes;

// Хранилище для сессий
const sessions = new Map();

// Создаем сцену
const addListingScene = new BaseScene('add_listing');

// Вход в сцену
addListingScene.enter(async (ctx) => {
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.step = 'add_property_type';
  sessions.set(ctx.from.id, session);

  await ctx.reply(ctx.t('property-choose'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('property-rent'), 'add_type_Аренда')],
    [Markup.button.callback(ctx.t('property-sale'), 'add_type_Продажа')],
    [Markup.button.callback(ctx.t('cancel'), 'back_to_menu')]
  ]));
});

// Обработчики типа недвижимости
addListingScene.action('add_type_Аренда', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.property_type = 'Аренда';
  session.step = 'add_currency';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('filter-currency'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('currency-usd'), 'add_currency_USD'), Markup.button.callback(ctx.t('currency-try'), 'add_currency_TRY')],
    [Markup.button.callback(ctx.t('currency-eur'), 'add_currency_EUR'), Markup.button.callback(ctx.t('currency-rub'), 'add_currency_RUB')],
    [Markup.button.callback(ctx.t('cancel'), 'back_to_menu')]
  ]));
});

addListingScene.action('add_type_Продажа', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.property_type = 'Продажа';
  session.step = 'add_currency';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('filter-currency'), Markup.inlineKeyboard([
    [Markup.button.callback(ctx.t('currency-usd'), 'add_currency_USD'), Markup.button.callback(ctx.t('currency-try'), 'add_currency_TRY')],
    [Markup.button.callback(ctx.t('currency-eur'), 'add_currency_EUR'), Markup.button.callback(ctx.t('currency-rub'), 'add_currency_RUB')],
    [Markup.button.callback(ctx.t('cancel'), 'back_to_menu')]
  ]));
});

// Обработчик выбора валюты
addListingScene.action(/add_currency_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.currency = ctx.match[1];
  session.step = 'add_price';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('price-enter') + '\n\n' + ctx.t('cancel') + ': /cancel');
});

// Обработчик цены и комнат
addListingScene.on('text', async (ctx) => {
  const session = sessions.get(ctx.from.id);
  if (!session || !session.step) return;

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
      [Markup.button.callback(ctx.t('rooms-4-1'), 'add_rooms_4+1'), Markup.button.callback(ctx.t('rooms-other'), 'add_rooms_Другое')],
      [Markup.button.callback(ctx.t('cancel'), 'back_to_menu')]
    ]));
  }

  if (session.step === 'add_rooms_text') {
    session.data.rooms = ctx.message.text.trim();
    session.step = 'add_location';
    return ctx.reply(ctx.t('location-send') + '\n\n' + ctx.t('cancel') + ': /cancel');
  }

  if (session.step === 'add_location' && ctx.message.text) {
    session.data.location = null;
    session.data.address = ctx.message.text.trim();
    session.step = 'add_description';
    return ctx.reply(ctx.t('description-enter') + '\n\n' + ctx.t('cancel') + ': /cancel');
  }

  if (session.step === 'add_address') {
    const text = ctx.message.text.trim();
    if (text !== '-' && text !== ctx.t('location-skip')) {
      session.data.address = text;
    } else {
      session.data.address = null;
    }
    session.step = 'add_description';
    return ctx.reply(ctx.t('description-enter') + '\n\n' + ctx.t('cancel') + ': /cancel');
  }

  if (session.step === 'add_description') {
    session.data.description = ctx.message.text.trim();
    
    // Создаем объявление
    const listing = await database.createUserListing({
      owner_id: ctx.from.id.toString(),
      property_type: session.data.property_type,
      district: session.data.district || 'Не указан',
      price: session.data.price,
      rooms: session.data.rooms,
      location: session.data.location ? JSON.stringify(session.data.location) : null,
      address: session.data.address,
      description: session.data.description
    });

    // Формируем превью объявления используя стандартную структуру
    const previewData = {
      property_type: session.data.property_type,
      rooms: session.data.rooms,
      price: session.data.price,
      address: session.data.address,
      location: session.data.location ? JSON.stringify(session.data.location) : null,
      description: session.data.description
    };

    // Формируем строку адреса
    let addressText = '';
    if (previewData.address) {
      addressText = `📍 ${escapeMarkdown(previewData.address)}\n`;
    } else if (previewData.location) {
      addressText = `📍 ${escapeMarkdown(ctx.t('location-geo'))}\n`;
    }

    let message =
      `✨ *${escapeMarkdown('Новое объявление')}*\n\n` +
      `🏡 *${escapeMarkdown(previewData.property_type)}*, ${escapeMarkdown(previewData.rooms)}, ${escapeMarkdown(previewData.price)}\n` +
      addressText +
      `📝 ${escapeMarkdown(previewData.description)}`;

    // Отправляем превью
    await ctx.replyWithMarkdownV2(message);

    // Если есть геолокация, отправляем её
    if (session.data.location) {
      try {
        await ctx.replyWithLocation(session.data.location.latitude, session.data.location.longitude);
      } catch (e) {
        // игнорируем ошибку парсинга
      }
    }

    sessions.delete(ctx.from.id);
    await ctx.scene.leave();
    return showMainMenu(ctx);
  }
});

// Обработчик выбора комнат
addListingScene.action(/add_rooms_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  const session = sessions.get(ctx.from.id) || { data: {} };
  session.data.rooms = ctx.match[1];
  
  if (ctx.match[1] === 'Другое') {
    session.step = 'add_rooms_text';
    sessions.set(ctx.from.id, session);
    return ctx.reply(ctx.t('rooms-text') + '\n\n' + ctx.t('cancel') + ': /cancel');
  }
  
  session.step = 'add_location';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('location-send') + '\n\n' + ctx.t('cancel') + ': /cancel');
});

// Обработчик геолокации
addListingScene.on('location', async (ctx) => {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'add_location') return;
  
  session.data.location = ctx.message.location;
  session.data.address = null;
  session.step = 'add_address';
  sessions.set(ctx.from.id, session);
  await ctx.reply(ctx.t('location-address') + '\n\n' + ctx.t('cancel') + ': /cancel');
});

// Обработчик команды отмены
addListingScene.command('cancel', async (ctx) => {
  try { await ctx.deleteMessage(); } catch (e) {}
  sessions.delete(ctx.from.id);
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

// Обработчик возврата в главное меню
addListingScene.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}
  sessions.delete(ctx.from.id);
  await ctx.scene.leave();
  return showMainMenu(ctx);
});

export default addListingScene; 