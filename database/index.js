import config from '../config.js';
import { Pool } from 'pg';

const pool = new Pool({
  user: config.database.user,
  host: config.database.host,
  database: config.database.database,
  password: config.database.password,
  port: config.database.port,
});

class Database {
  constructor() {
    this.pool = pool;
    
    this.pool.on('error', (err) => {
      console.error('🔴 Ошибка PostgreSQL пула:', err.message);
    });
  }

  // Базовый метод для выполнения запросов
  async query(text, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Инициализация базы данных
  async init() {
    try {
      // Проверяем подключение
      await this.query('SELECT NOW()');
      console.log('✅ Подключение к PostgreSQL успешно');
      
      // Инициализируем схему базы данных
      await this.initSchema();
      console.log('✅ Схема базы данных инициализирована');
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
      throw error;
    }
  }

  // Инициализация схемы базы данных
  async initSchema() {
    try {
      // Создаем таблицы если они не существуют
      await this.createTables();
      console.log('✅ Таблицы созданы или уже существуют');
    } catch (error) {
      console.error('❌ Ошибка инициализации схемы:', error.message);
      throw error;
    }
  }

  // Создание всех необходимых таблиц
  async createTables() {
    const createTablesSQL = `
      -- Таблица для пользовательских объявлений (из бота)
      CREATE TABLE IF NOT EXISTS user_listings (
          id SERIAL PRIMARY KEY,
          owner_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'live', -- live / freeze / dead
          property_type TEXT NOT NULL, -- Аренда / Продажа
          district TEXT NOT NULL,
          price TEXT NOT NULL,
          rooms TEXT NOT NULL, -- 1+1, 2+1 и т.д.
          location TEXT,
          address TEXT,
          description TEXT
      );

      -- Таблица для спаршенных данных
      CREATE TABLE IF NOT EXISTS parsed_listings (
          id SERIAL PRIMARY KEY,
          site_name TEXT NOT NULL,
          listing_id TEXT NOT NULL,
          url TEXT NOT NULL,
          data JSONB NOT NULL,
          price_numeric BIGINT,
          coordinates POINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Уникальный индекс для предотвращения дублирования URL
      CREATE UNIQUE INDEX IF NOT EXISTS idx_parsed_listings_url_unique 
      ON parsed_listings(url);

      -- Индексы для оптимизации поиска
      CREATE INDEX IF NOT EXISTS idx_parsed_listings_site_listing 
      ON parsed_listings(site_name, listing_id);

      CREATE INDEX IF NOT EXISTS idx_parsed_listings_price 
      ON parsed_listings(price_numeric);

      CREATE INDEX IF NOT EXISTS idx_parsed_listings_coordinates 
      ON parsed_listings USING GIST(coordinates);

      CREATE INDEX IF NOT EXISTS idx_parsed_listings_created_at 
      ON parsed_listings(created_at);

      -- JSONB индексы для быстрого поиска по данным
      CREATE INDEX IF NOT EXISTS idx_parsed_listings_data_gin 
      ON parsed_listings USING GIN(data);

      -- Таблица для логов парсера
      CREATE TABLE IF NOT EXISTS parser_logs (
          id SERIAL PRIMARY KEY,
          site_name TEXT NOT NULL,
          log_type TEXT NOT NULL, -- success / error / info
          message TEXT NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_parser_logs_site_type 
      ON parser_logs(site_name, log_type);

      -- Таблица для хранения настроек пользователей
      CREATE TABLE IF NOT EXISTS user_settings (
          id SERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL UNIQUE,
          notifications_enabled BOOLEAN DEFAULT TRUE,
          notification_filters JSONB DEFAULT '{}',
          last_notification_sent_at TIMESTAMP DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Индекс для быстрого поиска по user_id
      CREATE INDEX IF NOT EXISTS idx_user_settings_user_id 
      ON user_settings(user_id);

      -- Функция для автоматического обновления updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Удаляем триггеры если они существуют
      DROP TRIGGER IF EXISTS update_user_listings_updated_at ON user_listings;
      DROP TRIGGER IF EXISTS update_parsed_listings_updated_at ON parsed_listings;
      DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;

      -- Триггеры для автоматического обновления updated_at
      CREATE TRIGGER update_user_listings_updated_at 
          BEFORE UPDATE ON user_listings
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_parsed_listings_updated_at 
          BEFORE UPDATE ON parsed_listings
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_user_settings_updated_at 
          BEFORE UPDATE ON user_settings
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    await this.query(createTablesSQL);
  }

  // МЕТОДЫ ДЛЯ БОТА (пользовательские объявления)
  
  async createUserListing(data) {
    const {
      owner_id,
      property_type,
      district,
      price,
      rooms,
      location,
      address,
      description
    } = data;

    const query = `
      INSERT INTO user_listings (owner_id, property_type, district, price, rooms, location, address, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await this.query(query, [
      owner_id,
      property_type,
      district,
      price,
      rooms,
      location,
      address,
      description
    ]);

    return result.rows[0];
  }

  async getUserListings(owner_id, status = 'live') {
    const query = `
      SELECT * FROM user_listings 
      WHERE owner_id = $1 AND status = $2 
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [owner_id, status]);
    return result.rows;
  }

  async updateUserListingStatus(id, status) {
    const query = `
      UPDATE user_listings 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await this.query(query, [status, id]);
    return result.rows[0];
  }

  async deleteUserListing(id, owner_id) {
    const query = `DELETE FROM user_listings WHERE id = $1 AND owner_id = $2 RETURNING *`;
    const result = await this.query(query, [id, owner_id]);
    return result.rows[0];
  }

  // МЕТОДЫ ДЛЯ УВЕДОМЛЕНИЙ

  async getUserNotificationSettings(userId) {
    const query = `
      SELECT notifications_enabled, notification_filters, last_notification_sent_at 
      FROM user_settings 
      WHERE user_id = $1
    `;
    const result = await this.query(query, [userId]);
    return result.rows[0] || null;
  }

  async updateUserNotificationSettings(userId, settings) {
    const query = `
      INSERT INTO user_settings (user_id, notifications_enabled, notification_filters)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        notifications_enabled = $2,
        notification_filters = $3,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await this.query(query, [
      userId,
      settings.notifications_enabled,
      JSON.stringify(settings.notification_filters || {})
    ]);
    return result.rows[0];
  }

  async getSubscribedUsers() {
    const query = `
      SELECT user_id, last_notification_sent_at
      FROM user_settings 
      WHERE notifications_enabled = true
    `;
    const result = await this.query(query);
    return result.rows;
  }

  async updateLastNotificationSent(userId) {
    const query = `
      UPDATE user_settings 
      SET last_notification_sent_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    await this.query(query, [userId]);
  }

  async getNewListingsSince(timestamp) {
    const query = `
      SELECT * FROM parsed_listings 
      WHERE created_at > $1
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    
    const result = await this.query(query, [timestamp]);
    return result.rows;
  }

  // МЕТОДЫ ДЛЯ ПАРСЕРА

  async getProcessedUrls(siteName) {
    const query = `SELECT url FROM parsed_listings WHERE site_name = $1`;
    const result = await this.query(query, [siteName]);
    return result.rows.map(row => row.url);
  }

  async isUrlProcessed(url) {
    const query = `SELECT EXISTS(SELECT 1 FROM parsed_listings WHERE url = $1)`;
    const result = await this.query(query, [url]);
    return result.rows[0].exists;
  }

  async saveParsedListing(data) {
    const {
      site_name,
      listing_id,
      url,
      data: listingData,
      price_numeric,
      coordinates
    } = data;

    // Преобразуем координаты в формат POINT если они есть
    let coordsPoint = null;
    if (coordinates && coordinates.lat && coordinates.lon) {
      coordsPoint = `(${coordinates.lon},${coordinates.lat})`;
    }

    const query = `
      INSERT INTO parsed_listings (site_name, listing_id, url, data, price_numeric, coordinates)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (url) 
      DO UPDATE SET 
        data = $4,
        price_numeric = $5,
        coordinates = $6,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.query(query, [
      site_name,
      listing_id,
      url,
      JSON.stringify(listingData),
      price_numeric,
      coordsPoint
    ]);

    return result.rows[0];
  }

  async getListingsStats(siteName = null) {
    let query = `
      SELECT 
        site_name,
        COUNT(*) as total_listings,
        MAX(created_at) as last_parsed,
        MIN(created_at) as first_parsed,
        AVG(price_numeric) as avg_price,
        COUNT(DISTINCT url) as processed_urls_count
      FROM parsed_listings
    `;
    
    let params = [];
    if (siteName) {
      query += ' WHERE site_name = $1';
      params = [siteName];
    }
    
    query += ' GROUP BY site_name ORDER BY last_parsed DESC';
    
    const result = await this.query(query, params);
    return result.rows;
  }

  // Получить общую статистику
  async getAllStats() {
    const query = `
      SELECT 
        site_name,
        COUNT(*) as total_listings,
        MAX(created_at) as last_parsed,
        MIN(created_at) as first_parsed,
        AVG(price_numeric) as avg_price,
        COUNT(DISTINCT url) as processed_urls_count
      FROM parsed_listings
      GROUP BY site_name
      ORDER BY last_parsed DESC
    `;
    
    const result = await this.query(query);
    return result.rows;
  }

  async logParserActivity(siteName, logType, message, details = null) {
    const query = `
      INSERT INTO parser_logs (site_name, log_type, message, details)
      VALUES ($1, $2, $3, $4)
    `;
    
    await this.query(query, [
      siteName,
      logType,
      message,
      details ? JSON.stringify(details) : null
    ]);
  }

  async getRecentLogs(siteName = null, limit = 100) {
    let query = `
      SELECT * FROM parser_logs
    `;
    
    let params = [];
    if (siteName) {
      query += ' WHERE site_name = $1';
      params = [siteName];
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await this.query(query, params);
    return result.rows;
  }

  // ПОИСК И ФИЛЬТРАЦИЯ

  async searchListings(filters = {}) {
    let query = 'SELECT * FROM parsed_listings WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (filters.site_name) {
      paramCount++;
      query += ` AND site_name = $${paramCount}`;
      params.push(filters.site_name);
    }

    if (filters.min_price) {
      paramCount++;
      query += ` AND price_numeric >= $${paramCount}`;
      params.push(filters.min_price);
    }

    if (filters.max_price) {
      paramCount++;
      query += ` AND price_numeric <= $${paramCount}`;
      params.push(filters.max_price);
    }

    if (filters.rooms) {
      paramCount++;
      query += ` AND data->>'Количество комнат' LIKE $${paramCount}`;
      params.push(`%${filters.rooms}%`);
    }

    if (filters.location) {
      paramCount++;
      query += ` AND (data->>'Провинция' ILIKE $${paramCount} OR data->>'location' ILIKE $${paramCount})`;
      params.push(`%${filters.location}%`);
    }

    if (filters.property_type) {
      paramCount++;
      query += ` AND data->>'Тип недвижимости' ILIKE $${paramCount}`;
      params.push(`%${filters.property_type}%`);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  // Очистить все данные для конкретного сайта
  async clearSiteData(siteName) {
    const query = `DELETE FROM parsed_listings WHERE site_name = $1 RETURNING COUNT(*)`;
    const result = await this.query(query, [siteName]);
    return result.rows[0].count;
  }

  // Сохранить множество объявлений одним запросом
  async saveParsedListingsBatch(listings) {
    if (!listings || listings.length === 0) return { saved: 0 };

    const values = listings.map(listing => {
      const coordsPoint = listing.coordinates?.lat && listing.coordinates?.lon 
        ? `(${listing.coordinates.lon},${listing.coordinates.lat})`
        : null;

      return `(
        '${listing.site_name}',
        ${listing.listing_id ? `'${listing.listing_id}'` : 'NULL'},
        '${listing.url}',
        '${JSON.stringify(listing.data).replace(/'/g, "''")}',
        ${listing.price_numeric || 'NULL'},
        ${coordsPoint ? `'${coordsPoint}'` : 'NULL'}
      )`;
    }).join(',');

    const query = `
      INSERT INTO parsed_listings (site_name, listing_id, url, data, price_numeric, coordinates)
      VALUES ${values}
      ON CONFLICT (url) DO UPDATE SET
        data = EXCLUDED.data,
        price_numeric = EXCLUDED.price_numeric,
        coordinates = EXCLUDED.coordinates,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const result = await this.query(query);
    return { saved: result.rows.length };
  }

  // Закрытие соединения
  async close() {
    try {
      await this.pool.end();
      console.log('🔒 PostgreSQL соединение закрыто');
    } catch (error) {
      console.error('❌ Ошибка закрытия PostgreSQL:', error.message);
    }
  }
}

const database = new Database();
export default database; 