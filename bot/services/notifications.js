/**
 * Сервис уведомлений
 * 
 * Назначение:
 * - Отправка уведомлений о новых объявлениях
 * - Проверка подписок пользователей
 * - Форматирование уведомлений
 */

import database from '../../database/index.js';
import { Markup } from 'telegraf';
import { userLocales } from '../utils/userState.js';

class NotificationService {
  constructor(bot, i18n) {
    this.bot = bot;
    this.i18n = i18n;
    this.isRunning = false;
    this.checkInterval = 5 * 60 * 1000; // 5 минут
  }

  // Запуск сервиса уведомлений
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔔 Сервис уведомлений запущен, проверка каждые 5 минут');
    
    // Проверяем новые объявления каждые 5 минут
    this.intervalId = setInterval(() => {
      this.checkAndSendNotifications();
    }, this.checkInterval);
    
    // Сразу проверяем при запуске
    setTimeout(() => {
      this.checkAndSendNotifications();
    }, 5000); // Через 5 секунд после запуска
  }

  // Остановка сервиса
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  // Проверка и отправка уведомлений
  async checkAndSendNotifications() {
    try {
      console.log('🔍 Проверяю новые объявления для уведомлений...');
      const subscribedUsers = await database.getSubscribedUsers();
      console.log(`👥 Найдено ${subscribedUsers.length} подписанных пользователей`);
      
      for (const user of subscribedUsers) {
        await this.sendNotificationsToUser(user);
      }
      
    } catch (error) {
      console.error('❌ Ошибка проверки уведомлений:', error.message);
    }
  }

  // Отправка уведомлений конкретному пользователю
  async sendNotificationsToUser(user) {
    try {
      const { user_id, last_notification_sent_at } = user;
      
      // Определяем время последней отправки (или час назад, если никогда не отправляли)
      const lastSent = last_notification_sent_at 
        ? new Date(last_notification_sent_at)
        : new Date(Date.now() - 60 * 60 * 1000); // час назад
      
      // Получаем новые объявления (без фильтров)
      const newListings = await database.getNewListingsSince(lastSent);
      console.log(`📋 Для пользователя ${user_id} найдено ${newListings.length} новых объявлений`);
      
      if (newListings.length === 0) {
        return; // Нет новых объявлений
      }
      
      // Отправляем уведомление
      console.log(`📤 Отправляю уведомление пользователю ${user_id}`);
      await this.sendNotificationMessage(user_id, newListings);
      
      // Обновляем время последней отправки
      await database.updateLastNotificationSent(user_id);
      console.log(`✅ Уведомление отправлено пользователю ${user_id}`);
      
    } catch (error) {
      // Логируем ошибку только в крайних случаях
    }
  }

  // Получение локализованного текста для пользователя
  getLocalizedText(userId, key, params = {}) {
    // Получаем язык пользователя из userLocales или используем русский по умолчанию
    const userLocale = userLocales.get(userId) || 'ru';
    
    // Используем i18n для получения перевода
    return this.i18n.t(userLocale, key, params);
  }

  // Отправка сообщения с уведомлением
  async sendNotificationMessage(userId, listings) {
    try {
      const count = listings.length;
      const maxShow = 3; // Показываем максимум 3 объявления в уведомлении
      
      // Заголовок уведомления
      let message = `🆕 ${this.getLocalizedText(userId, 'notifications-new-listings')}\n\n`;
      
      // Показываем первые несколько объявлений
      const listingsToShow = listings.slice(0, maxShow);
      
      for (const listing of listingsToShow) {
        const data = typeof listing.data === 'string' 
          ? JSON.parse(listing.data) 
          : listing.data;
        
        const specs = data.specifications || {};
        
        message += `🏠 ${specs['Тип недвижимости'] || this.getLocalizedText(userId, 'common-not-specified')}\n`;
        message += `💰 ${specs['Цена'] || this.getLocalizedText(userId, 'common-price-not-specified')}\n`;
        message += `📍 ${specs['Провинция'] || this.getLocalizedText(userId, 'common-location-not-specified')}\n`;
        message += `🔗 ${listing.url}\n\n`;
      }
      
      if (count > maxShow) {
        message += `... ${this.getLocalizedText(userId, 'notifications-and-more', { count: count - maxShow })}\n\n`;
      }
      
      message += `${this.getLocalizedText(userId, 'notifications-total-new', { count })}`;
      
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('📋 ' + this.getLocalizedText(userId, 'notifications-view-all'), 'view_parsed')],
          [Markup.button.callback('⚙️ ' + this.getLocalizedText(userId, 'notifications-settings'), 'settings')]
        ]).reply_markup
      });
      
    } catch (error) {
      // Логируем ошибку только в крайних случаях
    }
  }

  // Принудительная проверка (для тестирования)
  async forceCheck() {
    await this.checkAndSendNotifications();
  }
}

export default NotificationService; 