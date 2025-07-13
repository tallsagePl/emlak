#!/usr/bin/env node

import database from './database/index.js';

console.log('🔍 Тестирование инициализации базы данных...');

async function testDatabaseInit() {
  try {
    // Инициализируем базу данных
    await database.init();
    
    // Проверяем, что таблицы созданы
    const tables = await database.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Созданные таблицы:');
    tables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    // Проверяем основные таблицы
    const requiredTables = ['user_listings', 'parsed_listings', 'parser_logs', 'user_settings'];
    const existingTables = tables.rows.map(row => row.table_name);
    
    console.log('\n🔎 Проверка обязательных таблиц:');
    requiredTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table} - найдена`);
      } else {
        console.log(`  ❌ ${table} - не найдена`);
      }
    });
    
    // Проверяем индексы
    const indexes = await database.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY indexname
    `);
    
    console.log('\n📋 Созданные индексы:');
    indexes.rows.forEach(row => {
      console.log(`  ✅ ${row.indexname}`);
    });
    
    // Проверяем функции
    const functions = await database.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
      ORDER BY routine_name
    `);
    
    console.log('\n🔧 Созданные функции:');
    functions.rows.forEach(row => {
      console.log(`  ✅ ${row.routine_name}`);
    });
    
    console.log('\n🎉 Инициализация базы данных прошла успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании базы данных:', error.message);
    console.error('Детали ошибки:', error);
  } finally {
    await database.close();
  }
}

testDatabaseInit(); 