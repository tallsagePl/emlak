import { HepsiemlakParser, EmlakjetParser } from './parsers/index.js';
import { CONSTANTS } from './utils/index.js';
import fs from 'fs';
import path from 'path';

console.log(CONSTANTS.CHALK.blue('🧪 Тестовый запуск парсера без базы данных'));

// Выбираем парсер из аргументов командной строки
const parserName = process.argv[2] || 'hepsiemlak';
const limit = parseInt(process.argv[3]) || 3;

console.log(CONSTANTS.CHALK.cyan(`📋 Парсер: ${parserName}`));
console.log(CONSTANTS.CHALK.cyan(`📊 Лимит: ${limit} объявлений`));

async function testParser() {
  try {
    let results = [];
    
    if (parserName === 'hepsiemlak') {
      console.log(CONSTANTS.CHALK.yellow('\n🏠 Запуск HepsEmlak парсера...'));
      results = await HepsiemlakParser.run(limit);
    } else if (parserName === 'emlakjet') {
      console.log(CONSTANTS.CHALK.yellow('\n🏡 Запуск EmlakJet парсера...'));
      results = await EmlakjetParser.run(limit);
    } else {
      console.error(CONSTANTS.CHALK.red('❌ Неизвестный парсер. Используйте: hepsiemlak или emlakjet'));
      process.exit(1);
    }
    
    console.log(CONSTANTS.CHALK.green(`\n✅ Парсинг завершен: ${results.length} объявлений`));
    
    // Сохраняем результаты в JSON файл
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${parserName}_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf8');
    
    console.log(CONSTANTS.CHALK.cyan(`💾 Результаты сохранены: ${filepath}`));
    
    // Выводим краткую статистику
    console.log(CONSTANTS.CHALK.blue('\n📈 СТАТИСТИКА:'));
    console.log(`Всего объявлений: ${results.length}`);
    console.log(`Успешных: ${results.filter(r => r.success).length}`);
    console.log(`С ошибками: ${results.filter(r => !r.success).length}`);
    
    // Показываем первое объявление как пример
    if (results.length > 0) {
      console.log(CONSTANTS.CHALK.yellow('\n🔍 ПРИМЕР ОБЪЯВЛЕНИЯ:'));
      console.log(JSON.stringify(results[0], null, 2));
    }
    
  } catch (error) {
    console.error(CONSTANTS.CHALK.red('❌ Ошибка:'), error.message);
    console.error(error.stack);
  }
}

testParser(); 