/**
 * Перехватывает и возвращает ответ нужного fetch/XHR-запроса на странице Puppeteer.
 * @param {import('puppeteer').Page} page - объект страницы Puppeteer
 * @param {string} urlPart - часть URL, по которой ищем нужный запрос
 * @returns {Promise<any>} - ответ нужного запроса (JSON)
 */
export default async function waitForFetchResponse(page, urlPart) {
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
