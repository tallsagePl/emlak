import { connect } from 'puppeteer-real-browser';
import config from '../../config.js';

export async function createBrowser() {
  const browser = await connect({
    headless: config.parser.puppeteer.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ],
    executablePath: config.parser.puppeteer.executablePath,
    userDataDir: './browser_data'
  });

  return browser;
}

export async function delay(ms = 2000) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function navigateToPage(page, url, options = {}) {
  try {
    const defaultOptions = {
      waitUntil: 'domcontentloaded',
      timeout: config.browser.timeout,
      ...options
    };

    await page.goto(url, defaultOptions);
    console.log(`📄 Переход на страницу: ${url}`);
    
    // Ждем загрузки страницы
    await new Promise(resolve => setTimeout(resolve, config.parser.delay));
    
    return true;
  } catch (error) {
    console.error(`❌ Ошибка перехода на ${url}:`, error.message);
    return false;
  }
}

export async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    console.error(`❌ Элемент ${selector} не найден:`, error.message);
    return false;
  }
}

export async function safeClick(page, selector) {
  try {
    await waitForElement(page, selector);
    await page.click(selector);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка клика по ${selector}:`, error.message);
    return false;
  }
}

export async function extractText(page, selector) {
  try {
    await waitForElement(page, selector);
    const text = await page.$eval(selector, el => el.textContent?.trim());
    return text || '';
  } catch (error) {
    console.error(`❌ Ошибка извлечения текста из ${selector}:`, error.message);
    return '';
  }
}

export async function extractAttribute(page, selector, attribute) {
  try {
    await waitForElement(page, selector);
    const value = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    return value || '';
  } catch (error) {
    console.error(`❌ Ошибка извлечения атрибута ${attribute} из ${selector}:`, error.message);
    return '';
  }
} 