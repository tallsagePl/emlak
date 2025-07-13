import config from './config.js';
import { Pool } from 'pg';

console.log('🔍 Отладка подключения бота к базе данных');
console.log('');
console.log('Параметры из config:');
console.log('   user:', config.database.user);
console.log('   host:', config.database.host);
console.log('   database:', config.database.database);
console.log('   password:', config.database.password);
console.log('   port:', config.database.port);
console.log('');

const pool = new Pool({
  user: config.database.user,
  host: config.database.host,
  database: config.database.database,
  password: config.database.password,
  port: config.database.port,
});

async function testBotConnection() {
  try {
    const client = await pool.connect();
    
    console.log('✅ Подключение успешно!');
    
    // Проверяем к какой базе подключились
    const dbResult = await client.query('SELECT current_database(), current_user');
    console.log('📍 Подключен к базе:', dbResult.rows[0].current_database);
    console.log('👤 Пользователь:', dbResult.rows[0].current_user);
    
    // Проверяем существует ли таблица user_settings
    try {
      const userSettingsTest = await client.query('SELECT COUNT(*) FROM public.user_settings');
      console.log('✅ Таблица user_settings найдена! Записей:', userSettingsTest.rows[0].count);
    } catch (error) {
      console.log('❌ Таблица user_settings НЕ найдена:', error.message);
      
      // Попробуем без указания схемы
      try {
        const userSettingsTest2 = await client.query('SELECT COUNT(*) FROM user_settings');
        console.log('✅ Таблица user_settings (без схемы) найдена! Записей:', userSettingsTest2.rows[0].count);
      } catch (error2) {
        console.log('❌ Таблица user_settings (без схемы) тоже НЕ найдена:', error2.message);
      }
      
      // Проверим какие таблицы есть
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      console.log('📋 Доступные таблицы в этой базе:');
      if (tables.rows.length > 0) {
        tables.rows.forEach(row => console.log('   -', row.table_name));
      } else {
        console.log('   ❌ Таблицы не найдены');
      }
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
    console.error('Код ошибки:', error.code);
  } finally {
    await pool.end();
  }
}

testBotConnection(); 