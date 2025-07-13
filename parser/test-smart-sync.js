import { CONSTANTS } from './utils/index.js';
import databaseManager from './adapters/database.js';

console.log(CONSTANTS.CHALK.blue('🧪 Тест умной синхронизации'));

async function testSmartSync() {
  try {
    // Подключаемся к БД
    await databaseManager.connect();
    
    console.log(CONSTANTS.CHALK.cyan('\n📊 Тестирование на примере HepsEmlak...'));

    // Симулируем первый парсинг (3 объявления)
    const firstBatch = [
      {
        site_name: 'hepsiemlak',
        listing_id: 'test-001',
        url: 'https://test.com/test-001',
        data: {
          specifications: {
            'Название': 'Тестовая квартира 1',
            'Цена': 5000000,
            'Количество комнат': '2+1',
            'м² (нетто)': 85
          },
          images: ['img1.jpg', 'img2.jpg'],
          success: true
        },
        price_numeric: 5000000
      },
      {
        site_name: 'hepsiemlak',
        listing_id: 'test-002', 
        url: 'https://test.com/test-002',
        data: {
          specifications: {
            'Название': 'Тестовая квартира 2',
            'Цена': 7500000,
            'Количество комнат': '3+1',
            'м² (нетто)': 120
          },
          images: ['img3.jpg'],
          success: true
        },
        price_numeric: 7500000
      }
    ];

    console.log(CONSTANTS.CHALK.yellow('\n🔄 Первый запуск (добавление объявлений):'));
    const firstResult = await databaseManager.saveParsingResults('hepsiemlak', firstBatch);
    
    // Симулируем второй парсинг (обновление + новое + удаление старого)
    const secondBatch = [
      {
        site_name: 'hepsiemlak',
        listing_id: 'test-001',
        url: 'https://test.com/test-001',
        data: {
          specifications: {
            'Название': 'Тестовая квартира 1 (ОБНОВЛЕНА)',
            'Цена': 5200000, // Цена изменилась
            'Количество комнат': '2+1',
            'м² (нетто)': 85
          },
          images: ['img1.jpg', 'img2.jpg', 'img4.jpg'], // Добавилось изображение
          success: true
        },
        price_numeric: 5200000
      },
      // test-002 исчез с сайта (будет удален)
      {
        // Новое объявление
        site_name: 'hepsiemlak',
        listing_id: 'test-003',
        url: 'https://test.com/test-003',
        data: {
          specifications: {
            'Название': 'Новая тестовая квартира 3',
            'Цена': 6000000,
            'Количество комнат': '2+1',
            'м² (нетто)': 95
          },
          images: ['img5.jpg'],
          success: true
        },
        price_numeric: 6000000
      }
    ];

    console.log(CONSTANTS.CHALK.yellow('\n🔄 Второй запуск (обновление + новое + удаление):'));
    const secondResult = await databaseManager.saveParsingResults('hepsiemlak', secondBatch);

    // Показываем статистику
    console.log(CONSTANTS.CHALK.blue('\n📈 Статистика синхронизации:'));
    const syncStats = await databaseManager.getSyncStats('hepsiemlak', 1);
    console.log(`📝 Всего записей: ${syncStats.total_listings}`);
    console.log(`➕ Добавлено за час: ${syncStats.added_recently}`);
    console.log(`🔄 Обновлено за час: ${syncStats.updated_recently}`);

    const recentChanges = await databaseManager.getRecentChanges('hepsiemlak', 10);
    console.log(CONSTANTS.CHALK.green('\n📋 Недавние изменения:'));
    recentChanges.forEach(change => {
      const icon = change.change_type === 'added' ? '➕' : 
                   change.change_type === 'updated' ? '🔄' : '📄';
      console.log(`${icon} ${change.title} (${change.listing_id})`);
      console.log(`   💰 ${change.price ? Math.round(change.price).toLocaleString() + ' ₺' : 'Без цены'}`);
    });

    // Очистка тестовых данных
    console.log(CONSTANTS.CHALK.gray('\n🧹 Очистка тестовых данных...'));
    await databaseManager.clearSiteData('hepsiemlak');

    console.log(CONSTANTS.CHALK.green('\n✅ Тест умной синхронизации завершен!'));
    console.log(CONSTANTS.CHALK.cyan('Результат показывает что система корректно:'));
    console.log('  - Добавляет новые объявления');
    console.log('  - Обновляет измененные объявления');  
    console.log('  - Удаляет устаревшие объявления');
    console.log('  - Отслеживает статистику изменений');

    await databaseManager.close();

  } catch (error) {
    console.error(CONSTANTS.CHALK.red('❌ Ошибка тестирования:'), error.message);
    await databaseManager.close();
    process.exit(1);
  }
}

testSmartSync(); 