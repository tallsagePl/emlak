/**
 * Конфигурация порталов недвижимости
 * Содержит базовые URL, API endpoints и параметры для каждого портала
 */
const portals = [
    {
        name: 'zingat',
        enabled: false, // Пока не реализован
        baseUrl: 'https://www.zingat.com',
        searchUrl: 'https://www.zingat.com/antalya-satilik-daire',
        mapUrl: 'https://www.zingat.com/antalya-satilik-daire?listType=map&geo_polygon[]=36.84585619557826,%2030.628872560643035&geo_polygon[]=36.86268608193984,%2030.628872560643035&geo_polygon[]=36.86268608193984,%2030.593510316990685&geo_polygon[]=36.84585619557826,%2030.593510316990685&geo_polygon[]=36.84585619557826,%2030.628872560643035',
        region: {
            city: 'antalya',
            district: 'konyaalti',
            area: 'liman'
        },
        parser: {
            type: 'browser', // Тип парсера: browser/api
            delay: 3000, // Задержка между запросами
            retries: 3 // Количество попыток при ошибке
        }
    },
    {
        name: 'hepsiemlak',
        enabled: true,
        baseUrl: 'https://www.hepsiemlak.com',
        searchUrl: 'https://www.hepsiemlak.com/harita/konyaalti-satilik',
        mapUrl: 'https://www.hepsiemlak.com/harita/konyaalti-satilik?districts=uluc,uncali,konyaalti-liman-mah,hurma,konyaalti-sarisu,konyaalti-altinkum&floorCounts=1-5&mapTopLeft=36.89465474733249,%2030.53083419799805&mapBottomRight=36.81285800626765,%2030.66069602966309&p37=120401',
        apiUrl: 'https://www.hepsiemlak.com/api/realty-map/konyaalti-satilik?mapSize=1500&floorCounts=1-5&mapTopLeft=36.89465474733249,+30.53083419799805&mapBottomRight=36.81285800626765,+30.66069602966309&p37=120401&intent=satilik&mainCategory=konut&listingDate=today&mapCornersEnabled=true',
        region: {
            city: 'antalya',
            district: 'konyaalti',
            areas: ['uluc', 'uncali', 'liman', 'hurma', 'sarisu', 'altinkum']
        },
        parser: {
            type: 'api', // Использует API
            delay: 1000,
            retries: 3
        }
    },
    {
        name: 'emlakjet',
        enabled: true,
        baseUrl: 'https://www.emlakjet.com',
        searchUrl: 'https://www.emlakjet.com/satilik-daire/antalya-konyaalti-liman-mahallesi',
        mapUrl: 'https://www.emlakjet.com/satilik-daire/antalya-konyaalti-liman-mahallesi?tarih_araligi=1',
        region: {
            city: 'antalya',
            district: 'konyaalti',
            area: 'liman'
        },
        parser: {
            type: 'browser',
            delay: 3000,
            retries: 3
        }
    },
    {
        name: 'sahibinden',
        enabled: false, // Пока не реализован
        baseUrl: 'https://www.sahibinden.com',
        searchUrl: 'https://www.sahibinden.com/satilik-daire/antalya-konyaalti-arapsuyu-liman-mah.',
        mapUrl: 'https://www.sahibinden.com/satilik-daire/antalya-konyaalti-arapsuyu-liman-mah.?date=1day&mode=short&autoViewport=3',
        region: {
            city: 'antalya',
            district: 'konyaalti',
            areas: ['arapsuyu', 'liman']
        },
        parser: {
            type: 'browser',
            delay: 5000, // Больше задержка из-за защиты от ботов
            retries: 3
        }
    }
];

module.exports = portals; 