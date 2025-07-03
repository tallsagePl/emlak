// Используем универсальную базу данных проекта
import database from '../database/index.js';
import chalk from 'chalk';

// Адаптер для совместимости со старым API парсера
class ParserDatabaseAdapter {
  constructor() {
    this.database = database;
  }

  // Инициализация
  async connect() {
    try {
      await this.database.init();
      console.log(chalk.green('✅ База данных подключена'));
    } catch (error) {
      console.error(chalk.red('❌ Ошибка подключения к базе данных:'), error.message);
      throw error;
    }
  }

  // Получить список обработанных URL для сайта
  async getProcessedUrls(siteName) {
    try {
      return await this.database.getProcessedUrls(siteName);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка получения URL для ${siteName}:`), error.message);
      return [];
    }
  }

  // Добавить URL в список обработанных
  async addProcessedUrl(siteName, url) {
    try {
      await this.database.addProcessedUrls(siteName, [url]);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка добавления URL ${url}:`), error.message);
    }
  }

  // Добавить множественные URL в список обработанных
  async addProcessedUrls(siteName, urls) {
    try {
      await this.database.addProcessedUrls(siteName, urls);
      console.log(chalk.cyan(`📝 Добавлено ${urls.length} URL в обработанные для ${siteName}`));
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка добавления URL:`), error.message);
    }
  }

  // Проверить, обработан ли URL
  async isUrlProcessed(siteName, url) {
    try {
      const processedUrls = await this.getProcessedUrls(siteName);
      return processedUrls.includes(url);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка проверки URL ${url}:`), error.message);
      return false;
    }
  }

  // Сохранить спаршенные данные
  async saveParsingResult(siteName, data) {
    try {
      const listingData = {
        site_name: siteName,
        listing_id: data.listingId || data.specifications?.['Номер объявления'] || null,
        url: data.url,
        data: data,
        price_numeric: data.priceFromAPI || null,
        coordinates: data.mapLocation || null
      };

      const result = await this.database.saveParsedListing(listingData);
      return result.id;
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка сохранения данных:`), error.message);
      throw error;
    }
  }

  // Сохранить множественные результаты парсинга
  async saveParsingResults(siteName, results) {
    try {
      const savedIds = [];
      const successfulUrls = [];
      
      for (const result of results) {
        if (result.success) {
          try {
            const id = await this.saveParsingResult(siteName, result);
            savedIds.push(id);
            successfulUrls.push(result.url);
          } catch (error) {
            console.error(chalk.yellow(`⚠️ Не удалось сохранить ${result.url}:`, error.message));
          }
        }
      }

      // Добавляем успешно сохраненные URL в обработанные
      if (successfulUrls.length > 0) {
        await this.addProcessedUrls(siteName, successfulUrls);
      }

      return {
        savedIds,
        successfulUrls,
        savedCount: savedIds.length,
        totalCount: results.length
      };
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка сохранения результатов:`), error.message);
      throw error;
    }
  }

  // Получить статистику сайта
  async getSiteStats(siteName) {
    try {
      const [parserStats, listingsStats] = await Promise.all([
        this.database.getParserStats(siteName),
        this.database.getListingsStats(siteName)
      ]);

      const parserStat = parserStats[0] || {};
      const listingStat = listingsStats[0] || {};

      return {
        site_name: siteName,
        processed_urls_count: parserStat.urls_count || 0,
        total_processed: parserStat.total_processed || 0,
        saved_listings: parseInt(listingStat.total_listings) || 0,
        last_updated: parserStat.last_updated || null,
        last_parsed: listingStat.last_parsed || null,
        first_parsed: listingStat.first_parsed || null,
        avg_price: parseFloat(listingStat.avg_price) || 0
      };
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка получения статистики для ${siteName}:`), error.message);
      return null;
    }
  }

  // Получить общую статистику всех сайтов
  async getAllStats() {
    try {
      const [parserStats, listingsStats] = await Promise.all([
        this.database.getParserStats(),
        this.database.getListingsStats()
      ]);

      const combined = {};

      // Объединяем статистики парсера
      parserStats.forEach(stat => {
        combined[stat.site_name] = {
          site_name: stat.site_name,
          processed_urls_count: stat.urls_count || 0,
          total_processed: stat.total_processed || 0,
          last_updated: stat.last_updated,
          saved_listings: 0,
          last_parsed: null,
          first_parsed: null,
          avg_price: 0
        };
      });

      // Добавляем статистики листингов
      listingsStats.forEach(stat => {
        if (combined[stat.site_name]) {
          combined[stat.site_name].saved_listings = parseInt(stat.total_listings) || 0;
          combined[stat.site_name].last_parsed = stat.last_parsed;
          combined[stat.site_name].first_parsed = stat.first_parsed;
          combined[stat.site_name].avg_price = parseFloat(stat.avg_price) || 0;
        }
      });

      return Object.values(combined);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка получения общей статистики:`), error.message);
      return [];
    }
  }

  // Очистить старые данные
  async cleanOldData(siteName, daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const query = `
        DELETE FROM parsed_listings 
        WHERE site_name = $1 AND created_at < $2
      `;
      
      const result = await this.database.query(query, [siteName, cutoffDate.toISOString()]);
      
      console.log(chalk.blue(`🧹 Удалено ${result.rowCount} старых записей для ${siteName}`));
      
      return result.rowCount;
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка очистки данных для ${siteName}:`), error.message);
      return 0;
    }
  }

  // Логирование активности парсера
  async logActivity(siteName, logType, message, details = null) {
    try {
      await this.database.logParserActivity(siteName, logType, message, details);
    } catch (error) {
      console.error(chalk.red(`❌ Ошибка логирования:`), error.message);
    }
  }

  // Закрыть соединение
  async close() {
    try {
      await this.database.close();
    } catch (error) {
      console.error(chalk.red('❌ Ошибка закрытия соединения:'), error.message);
    }
  }
}

// Создаем единственный экземпляр адаптера
const databaseManager = new ParserDatabaseAdapter();

// Экспортируем для совместимости со старым API
export default databaseManager; 