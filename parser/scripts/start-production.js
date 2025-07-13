import { CONSTANTS } from '../utils/index.js';
import { ProductionScheduler } from '../scheduler/index.js';

// Graceful shutdown
let scheduler = null;

async function shutdown() {
    console.log(CONSTANTS.CHALK.yellow('\n⚠️ Получен сигнал завершения парсеров...'));
    if (scheduler) {
        await scheduler.shutdown();
    }
    console.log(CONSTANTS.CHALK.green('✅ Парсеры корректно завершены'));
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Главная функция запуска
(async () => {
    try {
        console.log(CONSTANTS.CHALK.blue('🚀 Запуск продакшн парсеров...'));
        
        scheduler = new ProductionScheduler();
        
        // Инициализация и запуск
        await scheduler.init();
        scheduler.start();
        
        console.log(CONSTANTS.CHALK.green('✅ Продакшн парсеры запущены и работают по расписанию'));
        console.log(CONSTANTS.CHALK.cyan('📋 Расписание:'));
        console.log('   🏠 HepsEmlak: каждые 4 часа в 00 минут');  
        console.log('   🏡 EmlakJet: каждые 4 часа в 15 минут');
        console.log('');
        console.log(CONSTANTS.CHALK.yellow('⚠️ Для остановки нажмите Ctrl+C'));
        
        // Держим процесс активным
        setInterval(() => {
            // Показываем статистику каждый час
            const stats = scheduler.getStats();
            if (stats.lastRunTime) {
                const timeSince = Math.round((Date.now() - new Date(stats.lastRunTime)) / (1000 * 60));
                console.log(CONSTANTS.CHALK.gray(`⏰ ${new Date().toLocaleString('ru-RU')} | Последний запуск: ${timeSince} мин назад | Активных парсеров: ${Object.keys(stats.parsers).filter(p => stats.parsers[p].enabled).length}`));
            }
        }, 60 * 60 * 1000); // Каждый час
        
    } catch (error) {
        console.error(CONSTANTS.CHALK.red('❌ Критическая ошибка запуска парсеров:'), error.message);
        process.exit(1);
    }
})(); 