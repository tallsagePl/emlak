import globalConfig from '../config.js';

// Парсим URL базы данных из глобального конфига
const parseDatabaseUrl = (url) => {
  if (!url) return {};
  
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port),
      user: urlObj.username,
      password: urlObj.password,
      database: urlObj.pathname.slice(1) // Убираем первый символ '/'
    };
  } catch (error) {
    console.error('Ошибка парсинга URL базы данных:', error.message);
    return {};
  }
};

const dbConfig = parseDatabaseUrl(globalConfig.database?.url);

export const config = {
  database: {
    host: dbConfig.host || 'localhost',
    port: dbConfig.port || 5432,
    user: dbConfig.user || 'postgres',
    password: dbConfig.password || '111',
    database: dbConfig.database || 'emlak',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  browser: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--start-maximized'
    ],
    turnstile: true,
    connectOption: {
      defaultViewport: null,
      timeout: 60000
    },
    disableXvfb: false,
    ignoreAllFlags: false
  },
  parser: {
    delay: 10000,
    retryAttempts: 3,
    retryDelay: 5000,
  },
  bot: globalConfig.bot || {},
  customConfig: {
    userDataDir: './user-data',
    chromePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  },
  parsing: {
    delay: {
      min: 1000,
      max: 3000
    },
    timeout: 30000,
    retries: 3,
    batchSize: 10
  },
  output: {
    directory: './output',
    format: 'xlsx',
    filename: 'parsed_data'
  },
  proxy: {
    enabled: false,
    host: '',
    port: '',
    username: '',
    password: ''
  },
  targets: [
    {
      name: 'hepsiemlak',
      url: 'https://www.hepsiemlak.com/harita/konyaalti-satilik?districts=uluc,uncali,konyaalti-liman-mah,hurma,konyaalti-sarisu,konyaalti-altinkum&floorCounts=1-5&mapTopLeft=36.89465474733249,%2030.53083419799805&mapBottomRight=36.81285800626765,%2030.66069602966309&p37=120401',
      apiUrl: 'https://www.hepsiemlak.com/api/realty-map/konyaalti-satilik?mapSize=1500&floorCounts=1-5&mapTopLeft=36.89465474733249,+30.53083419799805&mapBottomRight=36.81285800626765,+30.66069602966309&p37=120401&intent=satilik&mainCategory=konut&listingDate=today&mapCornersEnabled=true',
      selectors: {
        listings: '.listing-map-view [class*="item"], .map-property-card, [class*="listing"], [class*="property"], [data-testid*="property"], .search-result-item, .result-item',
        title: 'h1, h2, h3, .title, .property-title, .listing-title, [class*="title"], [class*="name"]',
        price: '.price, .amount, [class*="price"], [class*="amount"], [class*="cost"]',
        location: '.location, .address, .district, [class*="location"], [class*="address"], [class*="district"]',
        details: '.description, .details, [class*="description"], [class*="detail"], [class*="info"]'
      }
    }
  ]
}; 