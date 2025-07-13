import { CONSTANTS } from './CONSTANTS.js';

/**
 * Форматирует цену, удаляя лишние символы и конвертируя в число
 */
export function formatPrice(price) {
    if (!price) return null;
    return parseInt(price.replace(/[^0-9]/g, ''));
}

/**
 * Форматирует дату в ISO формат
 */
export function formatDate(date) {
    if (!date) return null;
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return null;
        }
        return d.toISOString();
    } catch (error) {
        console.warn(`⚠️ Ошибка форматирования даты: ${date}`);
        return null;
    }
}

/**
 * Очищает текст от лишних пробелов и переносов строк
 */
export function cleanText(text) {
    if (!text) return null;
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Извлекает число из строки
 */
export function extractNumber(text) {
    if (!text) return null;
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : null;
}

/**
 * Перехватывает и возвращает ответ нужного fetch/XHR-запроса на странице Puppeteer.
 * @param {import('puppeteer').Page} page - объект страницы Puppeteer
 * @param {string} urlPart - часть URL, по которой ищем нужный запрос
 * @returns {Promise<any>} - ответ нужного запроса (JSON)
 */
export async function waitForFetchResponse(page, urlPart) {
    return new Promise((resolve, reject) => {
        // Слушаем все ответы страницы
        function onResponse(response) {
            const req = response.request();
            // Проверяем, что это XHR или fetch и нужный нам URL
            if (
                (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') &&
                req.url().includes(urlPart)
            ) {
                // Отписываемся от события, чтобы не ловить лишние ответы
                page.off('response', onResponse);
                // Пробуем получить JSON-ответ
                response.json()
                    .then(resolve)
                    .catch(reject);
            }
        }
        page.on('response', onResponse);
    });
}

/**
 * Обработка Cloudflare защиты
 */
export async function handleCloudflare(page) {
    try {
        const title = await page.title();
        if (title.includes('Challenge') || title.includes('Checking') || title.includes('Один момент')) {
            console.log(CONSTANTS.CHALK.yellow('🛡️ Обнаружен Cloudflare, ожидаем...'));
            
            let attempts = 0;
            while (attempts < 12) {
                await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAYS.CLOUDFLARE_CHECK));
                const newTitle = await page.title();
                if (!newTitle.includes('Challenge') && !newTitle.includes('Checking') && !newTitle.includes('Один момент')) {
                    console.log(CONSTANTS.CHALK.green('✅ Cloudflare пройден!'));
                    break;
                }
                attempts++;
            }
        }
    } catch (error) {
        console.log(CONSTANTS.CHALK.yellow('⚠️ Ошибка проверки Cloudflare, продолжаем...'));
    }
}

/**
 * Инициализация браузера с общими настройками
 */
export async function initBrowser() {
    const { browser, page } = await CONSTANTS.PUPPETEER.connect({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--no-default-browser-check',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-translate',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection'
        ],
        turnstile: true,
        connectOption: {
            defaultViewport: { width: 1366, height: 768 }
        }
    });

    // Настройки для обхода детекции бота
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    return { browser, page };
}

/**
 * Общая функция для сбора изображений со страницы
 */
export async function collectImages(page) {
    return await page.evaluate(() => {
        const images = [];
        const imgEls = document.querySelectorAll('img');
        imgEls.forEach(img => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (src && 
                !src.includes('placeholder') && 
                !src.includes('data:image/svg') &&
                !src.includes('flag_') &&
                !src.includes('icon') &&
                !src.includes('logo') &&
                src.length > 50) {
                images.push(src);
            }
        });
        return images;
    });
} 