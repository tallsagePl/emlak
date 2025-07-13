import config from './config.js';
import { Pool } from 'pg';

console.log('🔧 Создание таблиц через Node.js...');

const pool = new Pool({
  user: config.database.user,
  host: config.database.host,
  database: config.database.database,
  password: config.database.password,
  port: config.database.port,
});

async function createTablesFromNode() {
  try {
    const client = await pool.connect();
    
    console.log('✅ Подключение успешно!');
    
    // Создаем таблицу user_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        notifications_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица user_settings создана через Node.js');
    
    // Проверяем что таблица создалась
    const count = await client.query('SELECT COUNT(*) FROM user_settings');
    console.log('✅ Таблица user_settings доступна! Записей:', count.rows[0].count);
    
    client.release();
    console.log('🎉 Создание через Node.js успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

createTablesFromNode(); 