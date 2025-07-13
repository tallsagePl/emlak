import { CONSTANTS } from '../utils/index.js';
import { 
    formatPrice,
    formatDate,
    cleanText,
    extractNumber,
    waitForFetchResponse,
    handleCloudflare,
    initBrowser,
    collectImages
} from '../utils/index.js';

export class HepsiemlakParser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.realtiesData = [];
    this.detailResults = [];
    this.errors = [];
    
    // Словарь переводов с турецкого на русский
    this.translationMap = {
      // Типы недвижимости
      'Satılık': 'Продажа',
      'Kiralık': 'Аренда',
      
      // Типы жилья
      'Daire': 'Квартира',
      'Villa': 'Вилла',
      'Müstakil Ev': 'Отдельный дом',
      'Residence': 'Резиденция',
      
      // Формы жилья
      'Dubleks': 'Дуплекс',
      'Tripleks': 'Триплекс',
      'Normal': 'Обычная',
      'Stüdyo': 'Студия',
      'Çatı Dubleks': 'Мансардный дуплекс',
      
      // Поля недвижимости
      'Banyo Sayısı': 'Количество ванных',
      'Bulunduğu Kat': 'Этаж',
      'Kat Sayısı': 'Количество этажей',
      'İlan No': 'Номер объявления',
      'İlan Tarihi': 'Дата объявления',
      'Son Güncelleme': 'Последнее обновление',
      'Oda Sayısı': 'Количество комнат',
      'Brüt / Net M2': 'Брутто/Нетто м2',
      'Isıtma': 'Отопление',
      'Yaşı': 'Возраст здания',
      'Aidat': 'Коммунальные расходы',
      'Depozito': 'Депозит',
      'Kredi Uygunluğu': 'Кредитная пригодность',
      'Takas': 'Обмен',
      'Tapu Durumu': 'Статус собственности',
      'Kimden': 'От кого',
      'İlan Durumu': 'Тип недвижимости',
      'Konut Tipi': 'Тип жилья',
      'Konut Şekli': 'Форма жилья'
    };
  }

  async init() {
    console.log(CONSTANTS.CHALK.blue('🚀 Инициализация полного парсера недвижимости...'));
    
    const { browser, page } = await initBrowser();
    this.browser = browser;
    this.page = page;
    
    console.log(CONSTANTS.CHALK.green('✅ Браузер запущен'));
  }

  translateField(text) {
    if (!text) return text;
    
    for (const [turkish, russian] of Object.entries(this.translationMap)) {
      text = text.replace(new RegExp(turkish, 'gi'), russian);
    }
    
    return text;
  }

  async step1_GetMapData() {
    console.log(CONSTANTS.CHALK.yellow('\n📍 ЭТАП 1: Получение данных с карты'));
    console.log(CONSTANTS.CHALK.blue('🗺️ Перехват API /api/realty-map/ при загрузке карты...'));
    
    let realtyMapData = null;

    // Настраиваем перехват ПЕРЕД переходом на страницу
    console.log(CONSTANTS.CHALK.blue('🕷️ Настраиваем перехват API...'));
    
    this.page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      
      if (status === 200 && url.includes('/api/realty-map/')) {
        console.log(CONSTANTS.CHALK.green(`📥 ОТВЕТ REALTY-MAP API: ${url}`));
        
        try {
          const contentType = response.headers()['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            const data = await response.json();
            const dataSize = JSON.stringify(data).length;
            
            console.log(CONSTANTS.CHALK.green(`✅ JSON данные получены: ${dataSize} байт`));
            
            realtyMapData = data;
            
            if (data.realties) {
              console.log(CONSTANTS.CHALK.green(`🎉 НАЙДЕНО ПОЛЕ REALTIES: ${data.realties.length} объявлений`));
              this.realtiesData = data.realties;
            }
          }
          
        } catch (error) {
          console.error(CONSTANTS.CHALK.red(`❌ Ошибка обработки ответа: ${error.message}`));
        }
      }
    });

    // Переходим на страницу карты
    const mapUrl = 'https://www.hepsiemlak.com/harita/konyaalti-satilik?districts=uluc,uncali,konyaalti-liman-mah,hurma,konyaalti-sarisu,konyaalti-altinkum&floorCounts=1-5&mapTopLeft=36.89465474733249,%2030.53083419799805&mapBottomRight=36.81285800626765,%2030.66069602966309&p37=120401';
    
    console.log(CONSTANTS.CHALK.yellow(`🎯 Переходим на карту: ${mapUrl}`));
    
    await this.page.goto(mapUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });

    // Ждем загрузки API
    console.log(CONSTANTS.CHALK.cyan('⏰ Ждем загрузки API (30 секунд)...'));
    await new Promise(resolve => setTimeout(resolve, 30000));

    if (this.realtiesData.length === 0) {
      throw new Error('Не удалось получить данные с карты');
    }

    console.log(CONSTANTS.CHALK.green(`✅ ЭТАП 1 ЗАВЕРШЕН: Получено ${this.realtiesData.length} объявлений`));
    
    return this.realtiesData;
  }

  generateDetailUrl(listingId) {
    return `https://www.hepsiemlak.com/antalya-konyaalti-liman-satilik/daire/${listingId}`;
  }

  async parseDetailPage(realty, index, total) {
    const { listingId, realtyId, price, mapLocation } = realty;
    const url = this.generateDetailUrl(listingId);
    
    console.log(CONSTANTS.CHALK.cyan(`\n[${index + 1}/${total}] 🔍 Парсинг: ${listingId}`));
    console.log(CONSTANTS.CHALK.gray(`🔗 ${url}`));

    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      await handleCloudflare(this.page);
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAYS.AFTER_PAGE_LOAD));

      // Собираем детальную информацию
      const detailData = await this.page.evaluate((selectors) => {
        const data = {
          // Основная информация
          title: document.querySelector(selectors.COMMON.TITLE)?.textContent?.trim() || '',
          description: document.querySelector(selectors.COMMON.DESCRIPTION)?.textContent?.trim() || '',
          
          // Обязательные поля от пользователя
          source: window.location.href,
          priceText: '',
          province: '',
          listingNumber: '',
          listingDate: '',
          propertyType: '',
          housingType: '',
          housingForm: '',
          roomCount: '',
          bathroomCount: '',
          areaBrutoNeto: '',
          
          // Дополнительные поля
          floor: '',
          totalFloors: '',
          age: '',
          heating: '',
          dues: '',
          deposit: '',
          creditEligibility: '',
          exchange: '',
          deedStatus: '',
          fromWhom: '',
          
          // Технические данные
          features: [],
          location: {},
          contact: {},
          images: [],
          specifications: {}
        };

        // Заголовок
        const titleEl = document.querySelector('h1.fontRB, h1, .listing-title');
        if (titleEl) data.title = titleEl.textContent.trim();

        // Цена (по указанному селектору пользователя)
        const priceEl = document.querySelector('.fz24-text.price');
        if (priceEl) {
          data.priceText = priceEl.textContent.trim();
        }

        // Провинция (по указанному селектору пользователя)  
        const provinceEl = document.querySelector('.detail-info-location');
        if (provinceEl) {
          data.province = provinceEl.textContent
            .trim()
            .replace(/\s+/g, ' ')  // Заменяем множественные пробелы и переносы на одинарные пробелы
            .replace(/\n/g, ' ');  // Заменяем переносы строк на пробелы
        }

        // Описание
        const descEl = document.querySelector('.ql-editor.description-content, .description');
        if (descEl) data.description = descEl.textContent.trim();

        // Характеристики из таблицы .adv-info-list с элементами .spec-item
        const specs = {};
        
        // Основной поиск в таблице справочной информации hepsiemlak
        const advInfoList = document.querySelector('.adv-info-list');
        if (advInfoList) {
          const specItems = advInfoList.querySelectorAll('.spec-item');
          specItems.forEach(item => {
            // Ищем лейбл и значение внутри каждого spec-item
            const labelEl = item.querySelector('.spec-item-label, .label, dt, th, .key');
            const valueEl = item.querySelector('.spec-item-value, .value, dd, td, .val');
            
            if (labelEl && valueEl) {
              const key = labelEl.textContent.trim();
              let value = valueEl.textContent.trim();
              
              // Специальная обработка для "Brüt / Net M2" - берем значения из всех спанов на уровне item
              if (key.includes('Brüt') && key.includes('Net') && key.includes('M2')) {
                const allSpans = item.querySelectorAll('span:not(.txt)');
                if (allSpans.length >= 2) {
                  const brutValue = allSpans[0].textContent.trim().replace(/&nbsp;/g, ' ');
                  const netValue = allSpans[1].textContent.trim();
                  value = `${brutValue}${netValue}`;
                }
              }
              
              if (key && value && key.length < 100 && value.length < 500) {
                specs[key] = value;
              }
            } else {
              // Альтернативный поиск: ключ в tooltip-wrapper, значения в спанах
              const tooltipKey = item.querySelector('.tooltip-wrapper .txt, .spec-item__tooltip .txt');
              
              if (tooltipKey) {
                const key = tooltipKey.textContent.trim();
                
                // Специальная обработка для "Brüt / Net M2" - берем значения из всех спанов на уровне item
                if (key.includes('Brüt') && key.includes('Net') && key.includes('M2')) {
                  const allSpans = item.querySelectorAll('span:not(.txt)'); // исключаем span с классом txt (это ключ)
                  if (allSpans.length >= 2) {
                    const brutValue = allSpans[0].textContent.trim().replace(/&nbsp;/g, ' ');
                    const netValue = allSpans[1].textContent.trim();
                    const value = `${brutValue}${netValue}`;
                    specs[key] = value;
                  }
                } else {
                  // Для других полей - обычная обработка
                  const valueSpans = item.querySelectorAll('span:not(.txt)');
                  if (valueSpans.length > 0) {
                    const value = Array.from(valueSpans).map(span => span.textContent.trim()).join(' ');
                    if (key && value && key.length < 100 && value.length < 500) {
                      specs[key] = value;
                    }
                  }
                }
              } else {
                // Совсем альтернативный поиск: первый и второй дочерний элемент
                const children = item.children;
                if (children.length >= 2) {
                  const key = children[0].textContent.trim();
                  const value = children[1].textContent.trim();
                  
                  if (key && value && key.length < 100 && value.length < 500) {
                    specs[key] = value;
                  }
                }
              }
            }
          });
        }

        // Дополнительный поиск в стандартных таблицах (если основной не сработал)
        if (Object.keys(specs).length === 0) {
          const specRows = document.querySelectorAll(
            'table tr, .spec-table tr, .property-specs tr, .details-table tr, ' +
            '.detail-attributes tr, .listing-details tr'
          );
          
          specRows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const key = cells[0].textContent.trim();
              const value = cells[1].textContent.trim();
              if (key && value && key.length < 100 && value.length < 500) {
                specs[key] = value;
              }
            }
          });

          // Поиск в списках определений
          const dtElements = document.querySelectorAll('dt');
          dtElements.forEach(dt => {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName === 'DD') {
              const key = dt.textContent.trim();
              const value = dd.textContent.trim();
              if (key && value) {
                specs[key] = value;
              }
            }
          });

          // Поиск в div-структурах с лейблами
          const labelElements = document.querySelectorAll(
            '.label, .property-label, .detail-label, .attribute-label, ' +
            '.spec-label, .info-label, [class*="label"]'
          );
          
          labelElements.forEach(label => {
            const value = label.nextElementSibling || 
                         label.parentElement?.querySelector('.value, .property-value, .detail-value') ||
                         label.parentElement?.lastElementChild;
            
            if (value && value !== label) {
              const key = label.textContent.trim();
              const val = value.textContent.trim();
              if (key && val && key.length < 100 && val.length < 500) {
                specs[key] = val;
              }
            }
          });
        }

        // Очищаем ключи от троеточий и лишних символов
        const cleanedSpecs = {};
        for (const [key, value] of Object.entries(specs)) {
          let cleanKey;
          // Если ключ содержит троеточия, берем последние 2 слова
          if (key.includes('...')) {
            const words = key.trim().split(/\s+/);
            cleanKey = words.slice(-2).join(' ');
          } else {
            cleanKey = key.trim();
          }
          cleanedSpecs[cleanKey] = value;
        }

        // Добавляем полную таблицу ключ-значение (без переводов)
        data.table = { ...cleanedSpecs };

        // Создаем specifications согласно новому списку пользователя
        const specifications = {
          'Название': data.title || '',
          'Источник': data.source || '',
          'Цена': data.priceText || '',
          'Провинция': data.province || '',
          'Номер объявления': cleanedSpecs['İlan no'] || '',
          'Дата объявления': cleanedSpecs['İlan tarihi'] || cleanedSpecs['İlan Tarihi'] || 'Не указана',
          'Тип недвижимости': cleanedSpecs['Konut Tipi'] || '',
          'м² (брутто)': '',
          'м² (нетто)': '',
          'Количество комнат': cleanedSpecs['Oda Sayısı'] || '',
          'Актуальность': '',
          'Здание возраст': cleanedSpecs['Bina Yaşı'] || '',
          'Тип здания': cleanedSpecs['Yapının Durumu'] || '',
          'Статус здания': cleanedSpecs['Yapının Durumu'] || '',
          'Стороны света': cleanedSpecs['Cephe'] || '',
          'Расположен на': cleanedSpecs['Bulunduğu Kat'] || '',
          'Количество этажей': cleanedSpecs['Kat Sayısı'] || '',
          'Отопление': cleanedSpecs['Isınma Tipi'] || '',
          'Тип топлива': cleanedSpecs['Yakıt Tipi'] || '',
          'Количество ванных': cleanedSpecs['Banyo Sayısı'] || '',
          'Кухня': '',
          'Балкон': '',
          'Лифт': '',
          'Парковка': '',
          'Меблировано': cleanedSpecs['Eşya Durumu'] || '',
          'Статус использования': cleanedSpecs['Kullanım Durumu'] || '',
          'Ситэ': cleanedSpecs['Site İçerisinde'] || '',
          'Название ситэ': '',
          'Айдат': cleanedSpecs['Aidat'] || '',
          'Право на кредит': cleanedSpecs['Krediye Uygunlu'] || '',
          'Статус Титула': cleanedSpecs['Tapu Durumu'] || '',
          'От кого': cleanedSpecs['Yetkili Ofis'] || '',
          'Обмен': cleanedSpecs['Takas'] || ''
        };

        // Обрабатываем "Brüt / Net M2" - извлекаем два значения
        const brutNetValue = cleanedSpecs['Brüt / Net M2'] || '';
        if (brutNetValue.includes('/')) {
          const parts = brutNetValue.split('/');
          specifications['м² (брутто)'] = parts[0].trim();
          specifications['м² (нетто)'] = parts[1].trim();
        } else if (brutNetValue) {
          specifications['м² (брутто)'] = brutNetValue;
        }

        data.specifications = specifications;

        // Извлекаем listingNumber для обратной совместимости
        data.listingNumber = cleanedSpecs['İlan no'] || '';



        // Особенности
        const featureSelectors = [
          '.features li', '.amenities li', '.property-features li',
          '.listing-features li', '.detail-features li', '.attributes li',
          '[class*="feature"] li', '[class*="amenity"] li'
        ];
        
        featureSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            const feature = el.textContent.trim();
            if (feature && feature.length > 2 && feature.length < 200) {
              data.features.push(feature);
            }
          });
        });

        // Изображения
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
            data.images.push(src);
          }
        });

        // Контактная информация
        const phoneSelectors = [
          '.phone', '.contact-phone', '.agent-phone', '.listing-phone',
          '[class*="phone"]', '[data-testid*="phone"]'
        ];
        
        phoneSelectors.forEach(selector => {
          const phoneEl = document.querySelector(selector);
          if (phoneEl && !data.contact.phone) {
            const phone = phoneEl.textContent.trim();
            if (phone && phone.length > 5) {
              data.contact.phone = phone;
            }
          }
        });

        const agentSelectors = [
          '.agent-name', '.contact-name', '.listing-agent', '.broker-name',
          '[class*="agent"]', '[class*="broker"]'
        ];
        
        agentSelectors.forEach(selector => {
          const agentEl = document.querySelector(selector);
          if (agentEl && !data.contact.agent) {
            const agent = agentEl.textContent.trim();
            if (agent && agent.length > 2) {
              data.contact.agent = agent;
            }
          }
        });

        // Адрес
        const addressSelectors = [
          '.address', '.location', '.property-address', '.listing-address',
          '[class*="address"]', '[class*="location"]'
        ];
        
        addressSelectors.forEach(selector => {
          const addressEl = document.querySelector(selector);
          if (addressEl && !data.location.address) {
            const address = addressEl.textContent.trim();
            if (address && address.length > 5) {
              data.location.address = address;
            }
          }
        });

        return data;
      }, CONSTANTS.SELECTORS);

      // Собираем изображения
      detailData.images = await collectImages(this.page);

      // Форматируем данные
      detailData.priceText = formatPrice(detailData.priceText);
      detailData.description = cleanText(detailData.description);

      // Применяем переводы
      const translatedData = this.applyTranslations(detailData);

      // Форматируем данные
      if (translatedData.specifications) {
        translatedData.specifications['Цена'] = formatPrice(translatedData.specifications['Цена']);
        // Форматируем дату только если она не содержит "Не указана"
        if (translatedData.specifications['Дата объявления'] && 
            !translatedData.specifications['Дата объявления'].includes('Не указана')) {
          translatedData.specifications['Дата объявления'] = formatDate(translatedData.specifications['Дата объявления']);
        }
        translatedData.specifications['м² (брутто)'] = extractNumber(translatedData.specifications['м² (брутто)']);
        translatedData.specifications['м² (нетто)'] = extractNumber(translatedData.specifications['м² (нетто)']);
      }

      // Очищаем описание если есть
      if (translatedData.description) {
        translatedData.description = cleanText(translatedData.description);
      }

      // Создаем финальный объект только с нужными полями
      const result = {
        specifications: translatedData.specifications,
        table: translatedData.table,
        contact: translatedData.contact,
        success: true,
        parsedAt: new Date().toISOString(),
        url,
        mapLocation,
        priceFromAPI: price,
        realtyId,
        listingId,
        images: translatedData.images
      };

      this.detailResults.push(result);
      console.log(CONSTANTS.CHALK.green(`✅ Успешно: ${result.title || 'Без названия'}`));
      
      return result;

    } catch (error) {
      console.log(CONSTANTS.CHALK.red(`❌ Ошибка ${listingId}: ${error.message}`));
      
      const errorResult = {
        listingId,
        realtyId,
        price,
        mapLocation,
        url,
        error: error.message,
        parsedAt: new Date().toISOString(),
        success: false
      };

      this.errors.push(errorResult);
      return errorResult;
    }
  }

  applyTranslations(data) {
    const translated = { ...data };
    
    // Переводим основные поля (propertyType и housingType оставляем на английском)
    const fieldsToTranslate = [
      'housingForm', 'floor', 'heating', 'creditEligibility', 'exchange', 'deedStatus', 'fromWhom'
    ];
    
    fieldsToTranslate.forEach(field => {
      if (translated[field]) {
        translated[field] = this.translateField(translated[field]);
      }
    });

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
    
    if (this.realtiesData.length === 0) {
      throw new Error('Нет данных для парсинга. Сначала выполните этап 1');
    }

    // Фильтруем уже обработанные URL
    let filteredData = this.realtiesData;
    
    if (processedUrls.length > 0) {
      const initialCount = filteredData.length;
      
      filteredData = filteredData.filter(realty => {
        const url = this.generateDetailUrl(realty.listingId);
        return !processedUrls.includes(url);
      });
      
      const skippedCount = initialCount - filteredData.length;
      
      console.log(CONSTANTS.CHALK.cyan(`🔄 Найдено объявлений: ${initialCount}`));
      console.log(CONSTANTS.CHALK.yellow(`⏭️ Пропущено (уже обработано): ${skippedCount}`));
      console.log(CONSTANTS.CHALK.green(`🆕 К обработке: ${filteredData.length}`));
    }

    // Ограничиваем количество для тестирования
    const dataToProcess = limit ? filteredData.slice(0, limit) : filteredData;
    const total = dataToProcess.length;
    
    if (total === 0) {
      console.log(CONSTANTS.CHALK.yellow('⚠️ Нет новых объявлений для обработки'));
      return;
    }
    
    console.log(CONSTANTS.CHALK.blue(`📋 Парсим ${total} объявлений...`));
    
    for (let i = 0; i < total; i++) {
      const realty = dataToProcess[i];
      
      await this.parseDetailPage(realty, i, total);
      
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // JSON файлы больше не сохраняем, данные сразу идут в базу данных
    
    const summary = {
      timestamp,
      mapData: this.realtiesData.length,
      successful: this.detailResults.length,
      failed: this.errors.length,
      successRate: this.detailResults.length > 0 ? 
        ((this.detailResults.length / (this.detailResults.length + this.errors.length)) * 100).toFixed(2) + '%' : '0%'
    };

    console.log(CONSTANTS.CHALK.green('\n🎉 ПАРСИНГ ЗАВЕРШЕН!'));
    console.log(CONSTANTS.CHALK.cyan(`📊 Данных с карты: ${summary.mapData}`));
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

  static async run(testLimit = 5, processedUrls = []) {
    const parser = new HepsiemlakParser();

    try {
      await parser.init();
      await parser.step1_GetMapData();
      await parser.step2_ParseDetailPages(testLimit, processedUrls);
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

// Экспорт уже выполнен в строке 12 