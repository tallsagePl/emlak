import config from './config.js';
import { Pool } from 'pg';

const pool = new Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,
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
      return true;
    } catch (error) {
      console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
      throw error;
    }
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

  // МЕТОДЫ ДЛЯ ПАРСЕРА

  async getProcessedUrls(siteName) {
    const query = `SELECT processed_urls FROM parser_processed WHERE site_name = $1`;
    const result = await this.query(query, [siteName]);
    return result.rows[0]?.processed_urls || [];
  }

  async addProcessedUrls(siteName, urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;

    const query = `
      INSERT INTO parser_processed (site_name, processed_urls, total_processed)
      VALUES ($1, $2, $3)
      ON CONFLICT (site_name) 
      DO UPDATE SET 
        processed_urls = parser_processed.processed_urls || $2,
        total_processed = parser_processed.total_processed + $3,
        last_updated = CURRENT_TIMESTAMP
    `;

    await this.query(query, [siteName, urls, urls.length]);
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

  async getParserStats(siteName = null) {
    let query = `
      SELECT 
        site_name,
        total_processed,
        last_updated,
        array_length(processed_urls, 1) as urls_count
      FROM parser_processed
    `;
    
    let params = [];
    if (siteName) {
      query += ' WHERE site_name = $1';
      params = [siteName];
    }
    
    query += ' ORDER BY last_updated DESC';
    
    const result = await this.query(query, params);
    return result.rows;
  }

  async getListingsStats(siteName = null) {
    let query = `
      SELECT 
        site_name,
        COUNT(*) as total_listings,
        MAX(created_at) as last_parsed,
        MIN(created_at) as first_parsed,
        AVG(price_numeric) as avg_price
      FROM parsed_listings
    `;
    
    let params = [];
    if (siteName) {
      query += ' WHERE site_name = $1';
      params = [siteName];
    }
    
    query += ' GROUP BY site_name ORDER BY total_listings DESC';
    
    const result = await this.query(query, params);
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