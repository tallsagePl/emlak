import { connect } from 'puppeteer-real-browser';
import chalk from 'chalk';

class EmlakjetParser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.listingUrls = [];
    this.detailResults = [];
    this.errors = [];
    
    // Словарь переводов полей EmlakJet
    this.translationMap = {
      // Основные поля
      'İlan Numarası': 'Номер объявления',
      'İlan Oluşturma Tarihi': 'Дата объявления', 
      'Kategorisi': 'Тип недвижимости',
      'Tipi': 'Тип1',
      'Türü': 'Тип2',
      'Brüt Metrekare': 'м² (брутто)',
      'Net Metrekare': 'м² (нетто)',
      'Oda Sayısı': 'Количество комнат',
      'Binanın Yaşı': 'Здание возраст',
      'Bulunduğu Kat': 'Расположен на',
      'Binanın Kat Sayısı': 'Количество этажей',
      
      // Дополнительные поля
      'Satılık': 'Продажа',
      'Kiralık': 'Аренда',
      'Daire': 'Квартира',
      'Villa': 'Вилла',
      'Müstakil Ev': 'Отдельный дом',
      'Residence': 'Резиденция',
      'İkinci El': 'Вторичка',
      'Sıfır': 'Новостройка'
    };
    
    // Базовый URL для поиска
    this.baseUrl = 'https://www.emlakjet.com/satilik-daire/antalya-konyaalti-liman-mahallesi';
  }

  async init() {
    console.log(chalk.blue('🚀 Инициализация парсера EmlakJet...'));
    
    const { browser, page } = await connect({
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

    this.browser = browser;
    this.page = page;
    
    // Настройки для обхода детекции бота
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    console.log(chalk.green('✅ Браузер запущен'));
  }

  translateField(text) {
    if (!text) return text;
    
    for (const [turkish, russian] of Object.entries(this.translationMap)) {
      text = text.replace(new RegExp(turkish, 'gi'), russian);
    }
    
    return text;
  }

  async step1_GetListingUrls() {
    console.log(chalk.yellow('\n📍 ЭТАП 1: Сбор ссылок на объявления'));
    
    let currentPage = 1;
    let hasNextPage = true;
    let previousUrls = new Set(); // Для отслеживания повторяющихся ссылок
    
    while (hasNextPage) {
      const pageUrl = currentPage === 1 
        ? `${this.baseUrl}?tarih_araligi=1`
        : `${this.baseUrl}?tarih_araligi=1&sayfa=${currentPage}`;
      
      console.log(chalk.blue(`📄 Страница ${currentPage}: ${pageUrl}`));
      
      try {
        await this.page.goto(pageUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        await this.handleCloudflare();
        
        // Ждем загрузки списка объявлений
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Получаем ссылки на объявления с текущей страницы
        const pageUrls = await this.page.evaluate(() => {
          const links = [];
          
          // Ищем ссылки на объявления (возможные селекторы)
          const selectors = [
            'a[href*="/ilan/"]', // Основной селектор для EmlakJet
            'a[href*="/satilik-daire/"]',
            'a[href*="/kiralık-daire/"]',
            '.listing-item a',
            '.property-card a',
            '.ilan-card a'
          ];
          
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const href = el.href;
              if (href && href.includes('/ilan/') && !links.includes(href)) {
                links.push(href);
              }
            });
            
            if (links.length > 0) break; // Если нашли ссылки, прекращаем поиск
          }
          
          return [...new Set(links)]; // Убираем дубликаты
        });
        
        console.log(chalk.cyan(`🔗 Найдено ${pageUrls.length} ссылок на странице ${currentPage}`));
        
        if (pageUrls.length === 0) {
          console.log(chalk.yellow(`⚠️ Объявления не найдены на странице ${currentPage} - завершаем`));
          hasNextPage = false;
        } else {
          // Проверяем, есть ли новые ссылки
          const newUrls = pageUrls.filter(url => !previousUrls.has(url));
          
          if (newUrls.length === 0) {
            console.log(chalk.yellow(`⚠️ Все ссылки на странице ${currentPage} уже встречались - завершаем`));
            hasNextPage = false;
          } else {
            // Добавляем новые ссылки
            this.listingUrls.push(...newUrls);
            pageUrls.forEach(url => previousUrls.add(url));
            
            console.log(chalk.green(`✅ Добавлено ${newUrls.length} новых ссылок`));
            
            currentPage++;
            
            // Защита от бесконечного цикла
            if (currentPage > 10) {
              console.log(chalk.yellow('⚠️ Достигнут лимит страниц (10) - завершаем'));
              hasNextPage = false;
            }
          }
        }
        
        // Пауза между страницами
        if (hasNextPage) {
          console.log(chalk.gray('⏰ Пауза 3 секунды...'));
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Ошибка на странице ${currentPage}: ${error.message}`));
        hasNextPage = false;
      }
    }
    
    console.log(chalk.green(`✅ ЭТАП 1 ЗАВЕРШЕН: Собрано ${this.listingUrls.length} уникальных ссылок`));
    return this.listingUrls;
  }

  async parseDetailPage(url, index, total) {
    console.log(chalk.cyan(`\n[${index + 1}/${total}] 🔍 Парсинг объявления`));
    console.log(chalk.gray(`🔗 ${url}`));

    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      await this.handleCloudflare();
      
      // Ждем загрузки контента
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Проверяем, что страница загрузилась корректно
      const title = await this.page.title();
      if (title.includes('404') || title.includes('Sayfa Bulunamadı') || title.includes('Hata')) {
        throw new Error('Страница не найдена или недоступна');
      }

      // Парсим данные со страницы
      const listingData = await this.page.evaluate(() => {
        const data = {
          url: window.location.href,
          title: '',
          price: '',
          specifications: {},
          description: '',
          features: [],
          location: '',
          parsedAt: new Date().toISOString()
        };

        // Получаем заголовок
        const titleEl = document.querySelector('h1') || document.querySelector('.listing-title') || document.querySelector('.property-title');
        if (titleEl) data.title = titleEl.textContent.trim();

        // Получаем цену
        const priceSelectors = [
          '.price',
          '.fiyat',
          '.listing-price',
          '.property-price',
          '[class*="price"]',
          '[class*="fiyat"]'
        ];
        
        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            data.price = priceEl.textContent.trim();
            break;
          }
        }

        // Получаем провинцию из breadcrumb или адреса
        const locationSelectors = [
          '.breadcrumb',
          '.address',
          '.location',
          '.adres',
          '[class*="location"]',
          '[class*="address"]'
        ];
        
        for (const selector of locationSelectors) {
          const locationEl = document.querySelector(selector);
          if (locationEl) {
            data.location = locationEl.textContent.trim();
            break;
          }
        }

        // Получаем характеристики объявления с правильными селекторами EmlakJet
        const specContainer = document.querySelector('.styles_inner__sV8Bk');
        if (specContainer) {
          const keys = specContainer.querySelectorAll('.styles_key__VqMhC');
          const values = specContainer.querySelectorAll('.styles_value__3QmL3');
          
          // Проходим по парам ключ-значение
          for (let i = 0; i < Math.min(keys.length, values.length); i++) {
            const key = keys[i].textContent.trim();
            const value = values[i].textContent.trim();
            if (key && value) {
              data.specifications[key] = value;
            }
          }
        }

        // Получаем описание
        const descSelectors = [
          '.description',
          '.aciklama',
          '.property-description',
          '.listing-description',
          '[class*="description"]'
        ];

        for (const selector of descSelectors) {
          const descEl = document.querySelector(selector);
          if (descEl) {
            data.description = descEl.textContent.trim();
            break;
          }
        }

        // Получаем особенности/удобства
        const featureSelectors = [
          '.features li',
          '.amenities li', 
          '.ozellikler li',
          '.imkanlar li',
          '.facilities li'
        ];

        for (const selector of featureSelectors) {
          const features = document.querySelectorAll(selector);
          if (features.length > 0) {
            features.forEach(feature => {
              const text = feature.textContent.trim();
              if (text) data.features.push(text);
            });
            break;
          }
        }

        return data;
      });

      // Извлекаем цену в числовом формате
      const priceMatch = listingData.price.match(/[\d.,]+/);
      const priceFromAPI = priceMatch ? parseInt(priceMatch[0].replace(/[.,]/g, '')) : null;

      // Применяем переводы
      const translatedData = this.applyTranslations(listingData);
      
      const result = {
        ...translatedData,
        priceFromAPI,
        listingId: this.extractListingId(url),
        success: true
      };

      console.log(chalk.green(`✅ Успешно: ${result.title || 'Без названия'}`));
      
      this.detailResults.push(result);
      return result;

    } catch (error) {
      console.log(chalk.red(`❌ Ошибка: ${error.message}`));
      
      const errorResult = {
        url,
        error: error.message,
        parsedAt: new Date().toISOString(),
        success: false
      };

      this.errors.push(errorResult);
      return errorResult;
    }
  }

  extractListingId(url) {
    // Извлекаем ID объявления из URL EmlakJet
    // Формат: https://www.emlakjet.com/ilan/название-объявления-17587498/
    const match = url.match(/-(\d+)\/?$/);
    if (match) {
      return match[1];
    }
    
    // Альтернативный способ: ищем цифры в самом конце URL
    const fallbackMatch = url.match(/(\d+)\/?$/);
    return fallbackMatch ? fallbackMatch[1] : null;
  }

  applyTranslations(data) {
    const translated = { ...data };
    
    // Переводим спецификации
    const translatedSpecs = {};
    for (const [key, value] of Object.entries(translated.specifications || {})) {
      const translatedKey = this.translateField(key);
      const translatedValue = this.translateField(value);
      translatedSpecs[translatedKey] = translatedValue;
    }
    translated.specifications = translatedSpecs;

    // Переводим особенности
    if (translated.features) {
      translated.features = translated.features.map(feature => this.translateField(feature));
    }

    return translated;
  }

  async handleCloudflare() {
    try {
      const title = await this.page.title();
      if (title.includes('Challenge') || title.includes('Checking') || title.includes('Один момент')) {
        console.log(chalk.yellow('🛡️ Обнаружен Cloudflare, ожидаем...'));
        
        let attempts = 0;
        while (attempts < 12) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const newTitle = await this.page.title();
          if (!newTitle.includes('Challenge') && !newTitle.includes('Checking') && !newTitle.includes('Один момент')) {
            console.log(chalk.green('✅ Cloudflare пройден!'));
            break;
          }
          attempts++;
        }
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Ошибка проверки Cloudflare, продолжаем...'));
    }
  }

  async step2_ParseDetailPages(limit = null, processedUrls = []) {
    console.log(chalk.yellow('\n📄 ЭТАП 2: Парсинг детальных страниц'));
    
    if (this.listingUrls.length === 0) {
      throw new Error('Нет ссылок для парсинга. Сначала выполните этап 1');
    }

    // Фильтруем уже обработанные URL
    let filteredUrls = this.listingUrls;
    
    if (processedUrls.length > 0) {
      const initialCount = filteredUrls.length;
      filteredUrls = filteredUrls.filter(url => !processedUrls.includes(url));
      
      const skippedCount = initialCount - filteredUrls.length;
      
      console.log(chalk.cyan(`🔄 Найдено ссылок: ${initialCount}`));
      console.log(chalk.yellow(`⏭️ Пропущено (уже обработано): ${skippedCount}`));
      console.log(chalk.green(`🆕 К обработке: ${filteredUrls.length}`));
    }

    // Ограничиваем количество для тестирования
    const urlsToProcess = limit ? filteredUrls.slice(0, limit) : filteredUrls;
    const total = urlsToProcess.length;
    
    if (total === 0) {
      console.log(chalk.yellow('⚠️ Нет новых объявлений для обработки'));
      return;
    }
    
    console.log(chalk.blue(`📋 Парсим ${total} объявлений...`));
    
    for (let i = 0; i < total; i++) {
      const url = urlsToProcess[i];
      
      await this.parseDetailPage(url, i, total);
      
      // Пауза между запросами
      if (i < total - 1) {
        console.log(chalk.gray('⏰ Пауза 3 секунды...'));
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(chalk.green(`\n✅ ЭТАП 2 ЗАВЕРШЕН`));
    console.log(chalk.cyan(`📊 Успешно: ${this.detailResults.length}`));
    console.log(chalk.red(`❌ Ошибок: ${this.errors.length}`));
  }

  async saveResults() {
    // JSON файлы больше не сохраняем, данные сразу идут в базу данных
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalUrls: this.listingUrls.length,
      successful: this.detailResults.length,
      failed: this.errors.length,
      successRate: this.detailResults.length > 0 ? 
        ((this.detailResults.length / (this.detailResults.length + this.errors.length)) * 100).toFixed(2) + '%' : '0%'
    };

    console.log(chalk.green('\n🎉 ПАРСИНГ ЗАВЕРШЕН!'));
    console.log(chalk.cyan(`📊 Всего ссылок: ${summary.totalUrls}`));
    console.log(chalk.green(`✅ Успешно обработано: ${summary.successful} (${summary.successRate})`));
    console.log(chalk.red(`❌ Ошибок: ${summary.failed}`));

    return summary;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log(chalk.blue('🔒 Браузер закрыт'));
    }
  }

  async run(testLimit = 5, processedUrls = []) {
    try {
      // Этап 1: Получаем ссылки на объявления со всех страниц
      await this.step1_GetListingUrls();
      
      // Этап 2: Парсим детальные страницы
      await this.step2_ParseDetailPages(testLimit, processedUrls);
      
      // Сохраняем результаты (только статистика)
      await this.saveResults();
      
    } catch (error) {
      console.error(chalk.red('❌ Критическая ошибка:'), error.message);
      throw error;
    }
  }
}

// Функция для запуска парсера emlakjet
async function runEmlakjet(testLimit = null, processedUrls = []) {
  const parser = new EmlakjetParser();

  try {
    await parser.init();
    await parser.run(testLimit, processedUrls);
    return parser.detailResults;
  } catch (error) {
    console.error(chalk.red('❌ Критическая ошибка emlakjet:'), error.message);
    throw error;
  } finally {
    await parser.close();
  }
}

export { EmlakjetParser, runEmlakjet };

// Раскомментируйте для тестового запуска:
// (async () => {
//   console.log(chalk.blue('🧪 Тестирование новых селекторов EmlakJet...'));
//   try {
//     const results = await runEmlakjet(2);
//     results.forEach((result, index) => {
//       console.log(chalk.cyan(`=== ОБЪЯВЛЕНИЕ ${index + 1} ===`));
//       console.log(JSON.stringify(result, null, 2));
//     });
//   } catch (error) {
//     console.error(chalk.red('❌ Ошибка:'), error.message);
//   }
// })(); 