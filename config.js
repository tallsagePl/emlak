import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  env: {
    current: process.env.NODE_ENV || 'development'
  },
  
  database: {
    user: process.env.POSTGRES_USER || 'emlak',
    password: (process.env.POSTGRES_PASSWORD || '111').toString(),
    host: process.env.POSTGRES_HOST || 'localhost', // Используем переменную окружения для Docker
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'emlak'
  },
  
  telegram: {
    token: process.env.BOT_TOKEN
  },
  
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    skipDownload: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === 'true',
  },
  
  schedule: {
    hepsiemlak: process.env.HEPSIEMLAK_SCHEDULE || '0 10,16,22 * * *',
    emlakjet: process.env.EMLAKJET_SCHEDULE || '15 10,16,22 * * *'
  }
};

export default config;