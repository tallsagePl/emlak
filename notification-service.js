import config from './config.js';
import database from './database/index.js';
import https from 'https';

class NotificationService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 5 * 60 * 1000; // 5 минут
  }

    async sendTelegramMessage(chatId, message) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        chat_id: chatId,
        text: message
      });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${config.telegram.token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(responseData));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  async checkAndSendNotifications() {
    try {
      const subscribedUsers = await database.getSubscribedUsers();
      
      for (const user of subscribedUsers) {
        await this.sendNotificationsToUser(user);
      }
      
    } catch (error) {
      console.error('❌ Ошибка проверки уведомлений:', error.message);
    }
  }

  // Функция для очистки текста от проблемных символов
  cleanText(text) {
    if (!text) return 'Not specified';
    
    // Агрессивная замена турецких символов и слов
    let cleaned = text
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ı/g, 'i').replace(/I/g, 'I')
      .replace(/İ/g, 'I').replace(/i/g, 'i')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ş/g, 's').replace(/Ş/g, 'S')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      // Заменяем турецкие слова на английские
      .replace(/Konyaalti/g, 'Konyaalti')
      .replace(/Dubleks/g, 'Duplex')
      .replace(/Temmuz/g, 'July')
      .replace(/Kat/g, 'Floor')
      .replace(/Mahallesi/g, 'District')
      .replace(/Antalya/g, 'Antalya')
      .replace(/[^\x00-\x7F]/g, '') // Удаляем все остальные не-ASCII символы
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
      .trim();
    
    return cleaned || 'Not specified';
  }

  async sendNotificationsToUser(user) {
    try {
      const { user_id, last_notification_sent_at } = user;
      
      // Определяем время последней отправки (или час назад, если никогда не отправляли)
      const lastSent = last_notification_sent_at 
        ? new Date(last_notification_sent_at)
        : new Date(Date.now() - 60 * 60 * 1000); // час назад
      
      // Получаем новые объявления
      const newListings = await database.getNewListingsSince(lastSent);
      
      if (newListings.length === 0) {
        return; // Нет новых объявлений
      }
      
      // Отправляем каждое объявление отдельно
      for (const listing of newListings) {
        
        const data = typeof listing.data === 'string' 
          ? JSON.parse(listing.data) 
          : listing.data;
        
        const specs = data.specifications || {};
        
        // Получаем эмодзи для сайта
        let source_emoji = '🏘️';
        let displayName = listing.site_name;
        
        switch(listing.site_name) {
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
            displayName = 'HURRIYET EMLAK';
            break;
          case 'zingate':
            source_emoji = '🔑';
            displayName = 'ZINGATE';
            break;
          default:
            source_emoji = '🏘️';
            displayName = listing.site_name.toUpperCase();
        }

        // Формируем сообщение из реальных данных
        const get = (key) => this.cleanText(String(specs[key] || '—'));
        let message = `${source_emoji} ${get('Название') || displayName}\n`;
        message += `Цена: ${get('Цена')}\n`;
        message += `Провинция: ${get('Провинция')}\n`;
        message += `Тип: ${get('Тип недвижимости')}\n`;
        message += `Площадь: ${get('м² (нетто)')} нетто / ${get('м² (брутто)')} брутто\n`;
        message += `Комнат: ${get('Количество комнат')}\n`;
        message += `Этаж: ${get('Расположен на')} из ${get('Количество этажей')}\n`;
        message += `Возраст здания: ${get('Здание возраст')}\n`;
        message += `Меблировка: ${get('Меблировано')}\n`;
        message += `Статус: ${get('Статус использования')}\n`;
        message += `Дата: ${get('Дата объявления')}\n`;
        message += `ID: ${listing.id}`;

        try {
          await this.sendTelegramMessage(user_id, message);
          if (listing.url) {
            const linkMessage = `Ссылка: ${listing.url}`;
            await this.sendTelegramMessage(user_id, linkMessage);
          }
        } catch (error) {
          console.error(`❌ Ошибка отправки для объявления ${listing.id}:`, error.message);
        }
      }
      
      // Обновляем время последней отправки
      await database.updateLastNotificationSent(user_id);
      
    } catch (error) {
      console.error(`❌ Ошибка отправки уведомления пользователю ${user.user_id}:`, error.message);
    }
  }

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

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🔔 Сервис уведомлений остановлен');
  }
}

async function main() {
  try {
    console.log('🚀 Запускаю сервис уведомлений...');
    
    // Инициализируем базу данных
    await database.init();
    
    // Создаём и запускаем сервис уведомлений
    const notificationService = new NotificationService();
    notificationService.start();
    
    // Обработка завершения
    process.once('SIGINT', () => {
      console.log('\n🛑 Получен сигнал SIGINT, завершаю работу...');
      notificationService.stop();
      process.exit(0);
    });
    
    process.once('SIGTERM', () => {
      console.log('\n🛑 Получен сигнал SIGTERM, завершаю работу...');
      notificationService.stop();
      process.exit(0);
    });
    
    console.log('✅ Сервис уведомлений успешно запущен');
    
  } catch (error) {
    console.error('❌ Ошибка запуска сервиса уведомлений:', error.message);
    process.exit(1);
  }
}

main(); 