import { EmlakjetParser, HepsiemlakParser } from '../parsers/index.js';
import config from '../../config.js';

// Список доступных парсеров
export const PARSERS = {
  hepsiemlak: {
    name: 'HepsEmlak.com',
    runner: HepsiemlakParser.run,
    description: 'Парсер для сайта hepsiemlak.com',
    schedule: config.schedule.hepsiemlak
  },
  emlakjet: {
    name: 'EmlakJet.com',
    runner: EmlakjetParser.run,
    description: 'Парсер для сайта emlakjet.com',
    schedule: config.schedule.emlakjet
  }
}; 