/**
 * Специальный загрузчик для ES модулей в Node.js
 * Используется для правильной работы import/export синтаксиса
 */

/**
 * Резолвер для путей импорта
 * @param {string} specifier - Путь импорта
 * @param {object} context - Контекст загрузки
 * @param {Function} nextResolve - Следующий обработчик
 */
export async function resolve(specifier, context, nextResolve) {
    return nextResolve(specifier, context);
}

/**
 * Загрузчик модулей
 * @param {string} url - URL модуля
 * @param {object} context - Контекст загрузки
 * @param {Function} nextLoad - Следующий обработчик
 */
export async function load(url, context, nextLoad) {
    return nextLoad(url, context);
} 