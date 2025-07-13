import { CONSTANTS } from '../utils/index.js';
import { 
    formatPrice,
    formatDate,
    cleanText,
    extractNumber,
    handleCloudflare,
    initBrowser,
    collectImages
} from '../utils/index.js';

export class EmlakjetParser {
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
      'İlan Güncelleme Tarihi': 'Дата обновления',
      'Kategorisi': 'Тип недвижимости',
      'Tipi': 'Тип1',
      'Türü': 'Тип2',
      'Brüt Metrekare': 'м² (брутто)',
      'Net Metrekare': 'м² (нетто)',
      'Oda Sayısı': 'Количество комнат',
      'Binanın Yaşı': 'Здание возраст',
      'Bulunduğu Kat': 'Расположен на',
      'Binanın Kat Sayısı': 'Количество этажей',
      'Banyo Sayısı': 'Количество ванных',
      'Isıtma Tipi': 'Тип отопления',
      'Yakıt Tipi': 'Тип топлива',
      'Kullanım Durumu': 'Статус использования',
      'Krediye Uygunluk': 'Право на кредит',
      'Yatırıma Uygunluk': 'Инвестиционная пригодность',
      'Tapu Durumu': 'Статус Титула',
      'Site İçerisinde': 'В комплексе',
      'Eşya Durumu': 'Меблировка',
      'Takas': 'Обмен',
      'Fiyat Durumu': 'Статус цены',
      
      // Значения полей
      'Satılık': 'Продажа',
      'Kiralık': 'Аренда',
      'Daire': 'Квартира',
      'Villa': 'Вилла',
      'Müstakil Ev': 'Отдельный дом',
      'Residence': 'Резиденция',
      'İkinci El': 'Вторичка',
      'Sıfır': 'Новостройка',
      'Evet': 'Да',
      'Hayır': 'Нет',
      'Yok': 'Нет',
      'Var': 'Есть',
      'Bilinmiyor': 'Неизвестно',
      'Kombi Doğalgaz': 'Комбинированное газовое',
      'Mülk Sahibi Oturuyor': 'Проживает собственник',
      'Krediye Uygun': 'Подходит под кредит',
      'Krediye Uygun Değil': 'Не подходит под кредит',
      'Kat Mülkiyeti': 'Право собственности',
      'Eşyalı': 'С мебелью',
      'Eşyasız': 'Без мебели',
      'Genel Fiyat': 'Общая цена'
    };
    
    // Базовый URL для поиска
    this.baseUrl = 'https://www.emlakjet.com/satilik-daire/antalya-konyaalti-liman-mahallesi';
  }

  async init() {
    console.log(CONSTANTS.CHALK.blue('🚀 Инициализация парсера EmlakJet...'));
    
    const { browser, page } = await initBrowser();
    this.browser = browser;
    this.page = page;
    
    console.log(CONSTANTS.CHALK.green('✅ Браузер запущен'));
  }

  translateField(text) {
    if (!text || typeof text !== 'string') return text;
    
    for (const [turkish, russian] of Object.entries(this.translationMap)) {
      text = text.replace(new RegExp(turkish, 'gi'), russian);
    }
    
    return text;
  }

  async step1_GetListingUrls() {
    console.log(CONSTANTS.CHALK.yellow('\n📍 ЭТАП 1: Сбор ссылок на объявления'));
    
    let currentPage = 1;
    let hasNextPage = true;
    let previousUrls = new Set(); // Для отслеживания повторяющихся ссылок
    
    while (hasNextPage) {
      const pageUrl = currentPage === 1 
        ? `${this.baseUrl}?tarih_araligi=1`
        : `${this.baseUrl}?tarih_araligi=1&sayfa=${currentPage}`;
      
      console.log(CONSTANTS.CHALK.blue(`📄 Страница ${currentPage}: ${pageUrl}`));
      
      try {
        await this.page.goto(pageUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        await handleCloudflare(this.page);
        
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
        
        console.log(CONSTANTS.CHALK.cyan(`🔗 Найдено ${pageUrls.length} ссылок на странице ${currentPage}`));
        
        if (pageUrls.length === 0) {
          console.log(CONSTANTS.CHALK.yellow(`⚠️ Объявления не найдены на странице ${currentPage} - завершаем`));
          hasNextPage = false;
        } else {
          // Проверяем, есть ли новые ссылки
          const newUrls = pageUrls.filter(url => !previousUrls.has(url));
          
          if (newUrls.length === 0) {
            console.log(CONSTANTS.CHALK.yellow(`⚠️ Все ссылки на странице ${currentPage} уже встречались - завершаем`));
            hasNextPage = false;
          } else {
            // Добавляем новые ссылки
            this.listingUrls.push(...newUrls);
            pageUrls.forEach(url => previousUrls.add(url));
            
            console.log(CONSTANTS.CHALK.green(`✅ Добавлено ${newUrls.length} новых ссылок`));
            
            currentPage++;
            
            // Защита от бесконечного цикла
            if (currentPage > 10) {
              console.log(CONSTANTS.CHALK.yellow('⚠️ Достигнут лимит страниц (10) - завершаем'));
              hasNextPage = false;
            }
          }
        }
        
        // Пауза между страницами
        if (hasNextPage) {
          console.log(CONSTANTS.CHALK.gray('⏰ Пауза 3 секунды...'));
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(CONSTANTS.CHALK.red(`❌ Ошибка на странице ${currentPage}: ${error.message}`));
        hasNextPage = false;
      }
    }
    
    console.log(CONSTANTS.CHALK.green(`✅ ЭТАП 1 ЗАВЕРШЕН: Собрано ${this.listingUrls.length} уникальных ссылок`));
    return this.listingUrls;
  }

  async parseDetailPage(url, index, total) {
    console.log(CONSTANTS.CHALK.cyan(`\n[${index + 1}/${total}] 🔍 Парсинг объявления`));
    console.log(CONSTANTS.CHALK.gray(`🔗 ${url}`));

    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      await handleCloudflare(this.page);
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAYS.AFTER_PAGE_LOAD));

      // Собираем данные со страницы
      const data = await this.page.evaluate(() => {
        const result = {
          table: {},  // Оригинальные данные
          specifications: {},  // Переведенные данные
          title: '',
          price: '',
          location: '',
          description: '',
          url: window.location.href,
          date: ''
        };

        // Специальные селекторы для EmlakJet
        const titleSelectors = [
          'h1', '.listing-title', '.property-title', '.ad-title', '.detail-title'
        ];
        
        const priceSelectors = [
          '.price', '.listing-price', '.property-price', '.ad-price', '.detail-price',
          '[class*="price"]', '[data-testid*="price"]'
        ];
        
        const locationSelectors = [
          '.location', '.address', '.property-location', '.listing-location',
          '[class*="location"]', '[class*="address"]'
        ];
        
        const descriptionSelectors = [
          '#classifiedDescription', '.description', '.listing-description', '.property-description', '.ad-description',
          '[class*="description"]', '.detail-content', '.content'
        ];

        // Ищем заголовок
        for (const selector of titleSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) {
            result.title = el.textContent.trim();
            break;
          }
        }

        // Ищем цену
        for (const selector of priceSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) {
            result.price = el.textContent.trim();
            break;
          }
        }

        // Ищем местоположение
        for (const selector of locationSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) {
            result.location = el.textContent.trim();
            break;
          }
        }

        // Ищем описание - специальная обработка для EmlakJet
        const descriptionEl = document.querySelector('#classifiedDescription');
        if (descriptionEl) {
          // Извлекаем текст из всех параграфов
          const paragraphs = descriptionEl.querySelectorAll('p');
          const descriptionParts = [];
          paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text) {
              descriptionParts.push(text);
            }
          });
          result.description = descriptionParts.join(' ');
        } else {
          // Если нет специального селектора, используем общие
          for (const selector of descriptionSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
              result.description = el.textContent.trim();
              break;
            }
          }
        }

        // Собираем характеристики - специфические селекторы EmlakJet
        // Сначала ищем в основной структуре EmlakJet
        const emlakjetList = document.querySelector('.styles_inner__sV8Bk ul');
        if (emlakjetList) {
          const listItems = emlakjetList.querySelectorAll('li');
          listItems.forEach(item => {
            const keyEl = item.querySelector('.styles_key__VqMhC');
            const valueEl = item.querySelector('.styles_value__3QmL3');
            
            if (keyEl && valueEl) {
              const key = keyEl.textContent.trim();
              const value = valueEl.textContent.trim();
              if (key && value) {
                result.table[key] = value;
              }
            }
          });
        }
        
        // Если не нашли основную структуру, ищем альтернативные варианты
        if (Object.keys(result.table).length === 0) {
          const specSelectors = [
            '.spec-item', '.property-spec', '.detail-spec', '.listing-spec',
            '.feature-item', '.attribute-item', '.info-item'
          ];
          
          for (const selector of specSelectors) {
            const specs = document.querySelectorAll(selector);
            if (specs.length > 0) {
              specs.forEach(spec => {
                // Ищем лейбл и значение различными способами
                const labelSelectors = ['.label', '.key', '.name', '.title', 'dt', 'th'];
                const valueSelectors = ['.value', '.val', '.data', '.content', 'dd', 'td'];
                
                let label = '';
                let value = '';
                
                // Поиск лейбла
                for (const lblSelector of labelSelectors) {
                  const lblEl = spec.querySelector(lblSelector);
                  if (lblEl) {
                    label = lblEl.textContent.trim();
                    break;
                  }
                }
                
                // Поиск значения
                for (const valSelector of valueSelectors) {
                  const valEl = spec.querySelector(valSelector);
                  if (valEl) {
                    value = valEl.textContent.trim();
                    break;
                  }
                }
                
                // Если не нашли лейбл и значение, попробуем альтернативный способ
                if (!label || !value) {
                  const children = spec.children;
                  if (children.length >= 2) {
                    label = children[0].textContent.trim();
                    value = children[1].textContent.trim();
                  }
                }
                
                if (label && value) {
                  result.table[label] = value;
                }
              });
              break; // Если нашли спецификации, прекращаем поиск
            }
          }
        }

        // Если не нашли характеристики выше, ищем в стандартных таблицах
        if (Object.keys(result.table).length === 0) {
          const tables = document.querySelectorAll('table, .table, .specs-table');
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td, th');
              if (cells.length >= 2) {
                const label = cells[0].textContent.trim();
                const value = cells[1].textContent.trim();
                if (label && value) {
                  result.table[label] = value;
                }
              }
            });
          });
        }

        return result;
      });

      // Собираем изображения
      data.images = await collectImages(this.page);

      // Форматируем данные
      data.price = formatPrice(data.price);
      data.date = formatDate(data.date);
      data.description = cleanText(data.description);
      
      // Извлекаем числовые значения из характеристик
      if (data.table['Brüt Metrekare']) {
        data.table['Brüt Metrekare'] = extractNumber(data.table['Brüt Metrekare']) + ' м²';
      }
      if (data.table['Net Metrekare']) {
        data.table['Net Metrekare'] = extractNumber(data.table['Net Metrekare']) + ' м²';
      }

      // Создаем specifications по аналогии с HepsEmlak парсером
      data.specifications = {
        'Название': data.title || '',
        'Источник': data.url || '',
        'Цена': data.price || '',
        'Провинция': data.location || '',
        'Номер объявления': data.table['İlan Numarası'] || '',
        'Дата объявления': data.table['İlan Oluşturma Tarihi'] || 'Не указана',
        'Тип недвижимости': data.table['Tipi'] || '',
        'м² (брутто)': data.table['Brüt Metrekare'] || '',
        'м² (нетто)': data.table['Net Metrekare'] || '',
        'Количество комнат': data.table['Oda Sayısı'] || '',
        'Актуальность': data.table['İlan Güncelleme Tarihi'] || '',
        'Здание возраст': data.table['Binanın Yaşı'] || '',
        'Тип здания': data.table['Türü'] || '',
        'Статус здания': data.table['Türü'] || '',
        'Стороны света': '',
        'Расположен на': data.table['Bulunduğu Kat'] || '',
        'Количество этажей': data.table['Binanın Kat Sayısı'] || '',
        'Отопление': data.table['Isıtma Tipi'] || '',
        'Тип топлива': data.table['Yakıt Tipi'] || '',
        'Количество ванных': data.table['Banyo Sayısı'] || '',
        'Кухня': '',
        'Балкон': '',
        'Лифт': '',
        'Парковка': '',
        'Меблировано': data.table['Eşya Durumu'] || '',
        'Статус использования': data.table['Kullanım Durumu'] || '',
        'Ситэ': data.table['Site İçerisinde'] || '',
        'Название ситэ': '',
        'Айдат': '',
        'Право на кредит': data.table['Krediye Uygunluk'] || '',
        'Статус Титула': data.table['Tapu Durumu'] || '',
        'От кого': '',
        'Обмен': data.table['Takas'] || '',
        'Описание': data.description || ''
      };

      // Применяем переводы для всех полей
      const translatedSpecs = {};
      for (const [key, value] of Object.entries(data.specifications)) {
        const translatedValue = this.translateField(value);
        translatedSpecs[key] = translatedValue;
      }
      data.specifications = translatedSpecs;

      // Создаем финальный результат
      const result = {
        ...data,
        success: true,
        parsedAt: new Date().toISOString(),
        url,
        listingId: this.extractListingId(url)
      };

      this.detailResults.push(result);
      console.log(CONSTANTS.CHALK.green(`✅ Успешно: ${result.title || 'Без названия'}`));

      return result;

    } catch (error) {
      console.error(CONSTANTS.CHALK.red(`❌ Ошибка при парсинге ${url}: ${error.message}`));
      
      const errorResult = {
        url,
        listingId: this.extractListingId(url),
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
        console.log(CONSTANTS.CHALK.yellow('🛡️ Обнаружен Cloudflare, ожидаем...'));
        
        let attempts = 0;
        while (attempts < 12) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const newTitle = await this.page.title();
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

  async step2_ParseDetailPages(limit = null, processedUrls = []) {
    console.log(CONSTANTS.CHALK.yellow('\n📄 ЭТАП 2: Парсинг детальных страниц'));
    
    if (this.listingUrls.length === 0) {
      throw new Error('Нет ссылок для парсинга. Сначала выполните этап 1');
    }

    // Фильтруем уже обработанные URL
    let filteredUrls = this.listingUrls;
    
    if (processedUrls.length > 0) {
      const initialCount = filteredUrls.length;
      filteredUrls = filteredUrls.filter(url => !processedUrls.includes(url));
      
      const skippedCount = initialCount - filteredUrls.length;
      
      console.log(CONSTANTS.CHALK.cyan(`�� Найдено ссылок: ${initialCount}`));
      console.log(CONSTANTS.CHALK.yellow(`⏭️ Пропущено (уже обработано): ${skippedCount}`));
      console.log(CONSTANTS.CHALK.green(`🆕 К обработке: ${filteredUrls.length}`));
    }

    // Ограничиваем количество для тестирования
    const urlsToProcess = limit ? filteredUrls.slice(0, limit) : filteredUrls;
    const total = urlsToProcess.length;
    
    if (total === 0) {
      console.log(CONSTANTS.CHALK.yellow('⚠️ Нет новых объявлений для обработки'));
      return;
    }
    
    console.log(CONSTANTS.CHALK.blue(`📋 Парсим ${total} объявлений...`));
    
    for (let i = 0; i < total; i++) {
      const url = urlsToProcess[i];
      
      await this.parseDetailPage(url, i, total);
      
      // Пауза между запросами
      if (i < total - 1) {
        console.log(CONSTANTS.CHALK.gray('⏰ Пауза 3 секунды...'));
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(CONSTANTS.CHALK.green(`\n✅ ЭТАП 2 ЗАВЕРШЕН`));
    console.log(CONSTANTS.CHALK.cyan(`📊 Успешно: ${this.detailResults.length}`));
    console.log(CONSTANTS.CHALK.red(`❌ Ошибок: ${this.errors.length}`));
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

    console.log(CONSTANTS.CHALK.green('\n🎉 ПАРСИНГ ЗАВЕРШЕН!'));
    console.log(CONSTANTS.CHALK.cyan(`📊 Всего ссылок: ${summary.totalUrls}`));
    console.log(CONSTANTS.CHALK.green(`✅ Успешно обработано: ${summary.successful} (${summary.successRate})`));
    console.log(CONSTANTS.CHALK.red(`❌ Ошибок: ${summary.failed}`));

    return summary;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log(CONSTANTS.CHALK.blue('🔒 Браузер закрыт'));
    }
  }

  static async run(limit = null) {
    const parser = new EmlakjetParser();

    try {
      await parser.init();
      await parser.step1_GetListingUrls();
      await parser.step2_ParseDetailPages(limit);
      await parser.saveResults();
      return parser.detailResults;
    } catch (error) {
      console.error(CONSTANTS.CHALK.red('❌ Критическая ошибка:'), error.message);
      throw error;
    } finally {
      await parser.close();
    }
  }
}

// Экспорт уже выполнен в строке 11

// Раскомментируйте для тестового запуска:
// (async () => {
//   console.log(CONSTANTS.CHALK.blue('🧪 Тестирование новых селекторов EmlakJet...'));
//   try {
//     const results = await runEmlakjet(2);
//     results.forEach((result, index) => {
//       console.log(CONSTANTS.CHALK.cyan(`=== ОБЪЯВЛЕНИЕ ${index + 1} ===`));
//       console.log(JSON.stringify(result, null, 2));
//     });
//   } catch (error) {
//     console.error(CONSTANTS.CHALK.red('❌ Ошибка:'), error.message);
//   }
// })(); 