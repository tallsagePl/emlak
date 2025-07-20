import { CONSTANTS } from '../utils/index.js';
import database from '../../database/index.js';

// Адаптер для совместимости со старым API парсера
class ParserDatabaseAdapter {
  constructor() {
    this.database = database;
  }

  // Инициализация
  async connect() {
    try {
      await this.database.init();
      console.log(CONSTANTS.CHALK.green('✅ База данных подключена'));
    } catch (error) {
      console.error(CONSTANTS.CHALK.red('❌ Ошибка подключения к базе данных:'), error.message);
      throw error;
    }
  }

  // Получить список обработанных URL для сайта
  async getProcessedUrls(siteName) {
    try {
      return await this.database.getProcessedUrls(siteName);
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка получения URL для ${siteName}:`), error.message);
      return [];
    }
  }

  // Проверить, обработан ли URL
  async isUrlProcessed(url) {
    try {
      return await this.database.isUrlProcessed(url);
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка проверки URL ${url}:`), error.message);
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
        coordinates: data.mapLocation ? `(${data.mapLocation.lon},${data.mapLocation.lat})` : null
      };

      const result = await this.database.saveParsedListing(listingData);
      return result.id;
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка сохранения данных:`), error.message);
      throw error;
    }
  }

  // Очистить все данные для сайта
  async clearSiteData(siteName) {
    try {
      const count = await this.database.clearSiteData(siteName);
      console.log(CONSTANTS.CHALK.blue(`🗑️ Удалено ${count} записей для ${siteName}`));
      return count;
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка очистки данных для ${siteName}:`), error.message);
      throw error;
    }
  }

  // Умная синхронизация результатов парсинга
  async saveParsingResults(siteName, results) {
    try {
      console.log(CONSTANTS.CHALK.cyan(`🔄 Синхронизация ${results.length} объявлений для ${siteName}...`));

      // Подготавливаем данные для синхронизации
      const newListings = results
        .filter(result => result.success)
        .map(result => {

          return {
            site_name: siteName,
            listing_id: result.listingId || result.specifications?.['Номер объявления'] || null,
            url: result.url,
            data: result,
            price_numeric: result.priceFromAPI || this.extractPrice(result.specifications?.['Цена']) || null,
            coordinates: result.mapLocation ? `(${result.mapLocation.lon},${result.mapLocation.lat})` : null
          };
        });

      // Выполняем умную синхронизацию
      const syncResult = await this.smartSync(siteName, newListings);

      console.log(CONSTANTS.CHALK.green(`✅ Синхронизация завершена для ${siteName}:`));
      console.log(CONSTANTS.CHALK.blue(`  ➕ Добавлено: ${syncResult.added}`));
      console.log(CONSTANTS.CHALK.yellow(`  🔄 Обновлено: ${syncResult.updated}`));
      console.log(CONSTANTS.CHALK.red(`  ➖ Удалено: ${syncResult.deleted}`));
      console.log(CONSTANTS.CHALK.gray(`  ⏭️ Без изменений: ${syncResult.unchanged}`));

      return {
        savedCount: syncResult.added + syncResult.updated,
        totalCount: results.length,
        ...syncResult
      };
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка синхронизации результатов:`), error.message);
      throw error;
    }
  }

  // Умная синхронизация данных
  async smartSync(siteName, newListings) {
    const stats = {
      added: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0
    };

    try {
      // 1. Получаем все существующие записи для этого сайта
      const existingQuery = `
        SELECT id, url, listing_id, data, price_numeric, coordinates, created_at, updated_at
        FROM parsed_listings 
        WHERE site_name = $1
      `;
      const existingResult = await this.database.query(existingQuery, [siteName]);
      const existingListings = existingResult.rows;

      // Создаем карты для быстрого поиска
      const existingByUrl = new Map();
      const existingByListingId = new Map();
      
      existingListings.forEach(listing => {
        if (listing.url) {
          existingByUrl.set(listing.url, listing);
        }
        if (listing.listing_id) {
          existingByListingId.set(listing.listing_id, listing);
        }
      });

      // Создаем карту новых объявлений
      const newByUrl = new Map();
      const newByListingId = new Map();
      
      newListings.forEach(listing => {
        if (listing.url) {
          newByUrl.set(listing.url, listing);
        }
        if (listing.listing_id) {
          newByListingId.set(listing.listing_id, listing);
        }
      });

      // 2. Обрабатываем новые объявления (добавление/обновление)
      for (const newListing of newListings) {
        let existingListing = null;
        
        // Ищем существующую запись по URL или listing_id
        if (newListing.url && existingByUrl.has(newListing.url)) {
          existingListing = existingByUrl.get(newListing.url);
        } else if (newListing.listing_id && existingByListingId.has(newListing.listing_id)) {
          existingListing = existingByListingId.get(newListing.listing_id);
        }

        if (existingListing) {
          // Проверяем, изменились ли данные
          if (this.hasDataChanged(existingListing, newListing)) {
            // Обновляем существующую запись
            await this.updateListing(existingListing.id, newListing);
            stats.updated++;
            console.log(CONSTANTS.CHALK.yellow(`🔄 Обновлено: ${newListing.url}`));
          } else {
            stats.unchanged++;
          }
        } else {
          // Добавляем новую запись
          await this.addListing(newListing);
          stats.added++;
          console.log(CONSTANTS.CHALK.green(`➕ Добавлено: ${newListing.url}`));
        }
      }

      // 3. Удаляем устаревшие записи (которые есть в БД, но нет в новых данных)
      for (const existingListing of existingListings) {
        let foundInNew = false;
        
        // Ищем в новых данных по URL или listing_id
        if (existingListing.url && newByUrl.has(existingListing.url)) {
          foundInNew = true;
        } else if (existingListing.listing_id && newByListingId.has(existingListing.listing_id)) {
          foundInNew = true;
        }

        if (!foundInNew) {
          // Удаляем устаревшую запись
          await this.deleteListing(existingListing.id);
          stats.deleted++;
          console.log(CONSTANTS.CHALK.red(`➖ Удалено: ${existingListing.url}`));
        }
      }

      return stats;
    } catch (error) {
      console.error(CONSTANTS.CHALK.red('❌ Ошибка умной синхронизации:'), error.message);
      throw error;
    }
  }

  // Проверка изменения данных
  hasDataChanged(existingListing, newListing) {
    // Сравниваем ключевые поля
    const existingData = existingListing.data;
    const newData = newListing.data;

    // Сравниваем цену
    if (existingListing.price_numeric !== newListing.price_numeric) {
      return true;
    }

    // Сравниваем основные характеристики
    const keyFields = [
      'Название', 'Цена', 'м² (брутто)', 'м² (нетто)', 
      'Количество комнат', 'Количество ванных', 'Расположен на',
      'Количество этажей', 'Здание возраст', 'Меблировано'
    ];

    for (const field of keyFields) {
      const existingValue = existingData.specifications?.[field];
      const newValue = newData.specifications?.[field];
      
      if (existingValue !== newValue) {
        return true;
      }
    }

    // Сравниваем количество изображений
    const existingImages = existingData.images?.length || 0;
    const newImages = newData.images?.length || 0;
    
    if (existingImages !== newImages) {
      return true;
    }

    return false;
  }

  // Добавить новую запись
  async addListing(listing) {
    const query = `
      INSERT INTO parsed_listings (site_name, listing_id, url, data, price_numeric, coordinates, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
    `;
    
    const values = [
      listing.site_name,
      listing.listing_id,
      listing.url,
      JSON.stringify(listing.data),
      listing.price_numeric,
      listing.coordinates
    ];

    const result = await this.database.query(query, values);
    return result.rows[0].id;
  }

  // Обновить существующую запись
  async updateListing(id, listing) {
    const query = `
      UPDATE parsed_listings 
      SET data = $1, price_numeric = $2, coordinates = $3, updated_at = NOW()
      WHERE id = $4
    `;
    
    const values = [
      JSON.stringify(listing.data),
      listing.price_numeric,
      listing.coordinates,
      id
    ];

    await this.database.query(query, values);
  }

  // Удалить запись
  async deleteListing(id) {
    const query = `DELETE FROM parsed_listings WHERE id = $1`;
    await this.database.query(query, [id]);
  }

  // Извлечь цену из строки
  extractPrice(priceString) {
    if (!priceString || typeof priceString !== 'string') {
      return null;
    }
    
    const numbers = priceString.replace(/[^\d]/g, '');
    return numbers ? parseInt(numbers) : null;
  }

  // Получить статистику сайта
  async getSiteStats(siteName) {
    try {
      const stats = await this.database.getListingsStats(siteName);
      const siteStat = stats[0] || {};

      return {
        site_name: siteName,
        processed_urls_count: siteStat.processed_urls_count || 0,
        saved_listings: parseInt(siteStat.total_listings) || 0,
        last_parsed: siteStat.last_parsed || null,
        first_parsed: siteStat.first_parsed || null,
        avg_price: parseFloat(siteStat.avg_price) || 0
      };
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка получения статистики для ${siteName}:`), error.message);
      return null;
    }
  }

  // Получить общую статистику всех сайтов
  async getAllStats() {
    try {
      const stats = await this.database.getAllStats();
      
      return stats.map(stat => ({
          site_name: stat.site_name,
        processed_urls_count: stat.processed_urls_count || 0,
        saved_listings: parseInt(stat.total_listings) || 0,
        last_parsed: stat.last_parsed || null,
        first_parsed: stat.first_parsed || null,
        avg_price: parseFloat(stat.avg_price) || 0
      }));
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка получения общей статистики:`), error.message);
      return [];
    }
  }

  // Получить детальную статистику синхронизации
  async getSyncStats(siteName, hoursBack = 24) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_listings,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${hoursBack} hours') as added_recently,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '${hoursBack} hours' AND created_at < NOW() - INTERVAL '${hoursBack} hours') as updated_recently,
          MAX(updated_at) as last_sync,
          MIN(created_at) as first_sync,
          AVG(price_numeric) as avg_price,
          COUNT(DISTINCT listing_id) as unique_listings
        FROM parsed_listings 
        WHERE site_name = $1
      `;
      
      const result = await this.database.query(query, [siteName]);
      const row = result.rows[0];

      return {
        site_name: siteName,
        total_listings: parseInt(row.total_listings) || 0,
        added_recently: parseInt(row.added_recently) || 0,
        updated_recently: parseInt(row.updated_recently) || 0,
        last_sync: row.last_sync || null,
        first_sync: row.first_sync || null,
        avg_price: parseFloat(row.avg_price) || 0,
        unique_listings: parseInt(row.unique_listings) || 0
      };
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка получения статистики синхронизации:`), error.message);
      return null;
    }
  }

  // Получить список недавно измененных объявлений
  async getRecentChanges(siteName, limit = 10) {
    try {
      const query = `
        SELECT 
          listing_id,
          url,
          data->>'specifications'->>'Название' as title,
          price_numeric,
          created_at,
          updated_at,
          CASE 
            WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 'added'
            WHEN updated_at >= NOW() - INTERVAL '1 hour' THEN 'updated'
            ELSE 'existing'
          END as change_type
        FROM parsed_listings 
        WHERE site_name = $1 
        ORDER BY GREATEST(created_at, updated_at) DESC
        LIMIT $2
      `;
      
      const result = await this.database.query(query, [siteName, limit]);
      
      return result.rows.map(row => ({
        listing_id: row.listing_id,
        url: row.url,
        title: row.title || 'Без названия',
        price: row.price_numeric,
        created_at: row.created_at,
        updated_at: row.updated_at,
        change_type: row.change_type
      }));
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка получения недавних изменений:`), error.message);
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
      
      console.log(CONSTANTS.CHALK.blue(`🧹 Удалено ${result.rowCount} старых записей для ${siteName}`));
      
      return result.rowCount;
    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка очистки данных:`), error.message);
      throw error;
    }
  }

  // Закрыть соединение
  async close() {
    try {
      await this.database.close();
      console.log(CONSTANTS.CHALK.green('✅ Соединение с базой данных закрыто'));
    } catch (error) {
      console.error(CONSTANTS.CHALK.red('❌ Ошибка закрытия соединения:'), error.message);
    }
  }
}

// Создаем единственный экземпляр адаптера
const databaseManager = new ParserDatabaseAdapter();

// Экспортируем для совместимости со старым API
export default databaseManager; 