// CORS Proxy для Maze Router API
// Загружается в браузере и позволяет обходить ограничения CORS

// API URL
const API_BASE_URL = 'https://maze-router-api.vercel.app/api';

// Функция для отправки запроса через jsonp-proxy
async function fetchViaProxy(endpoint, params = {}, method = 'GET') {
  try {
    // Для GET-запросов формируем URL с параметрами
    let url = API_BASE_URL + '/' + endpoint;
    const queryParams = new URLSearchParams();
    
    if (method === 'GET') {
      Object.keys(params).forEach(key => {
        queryParams.append(key, params[key]);
      });
      
      if (queryParams.toString()) {
        url += '?' + queryParams.toString();
      }
    }
    
    // Используем прокси cors-anywhere
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    const proxyUrl = corsProxy + url;
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    
    if (method !== 'GET' && Object.keys(params).length > 0) {
      options.body = JSON.stringify(params);
    }
    
    const response = await fetch(proxyUrl, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при выполнении запроса через прокси:', error);
    
    // Пробуем второй вариант прокси
    try {
      // Используем allorigins как запасной вариант
      const allOriginsUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(API_BASE_URL + '/' + endpoint);
      
      // Для GET-запросов добавляем параметры к URL
      if (method === 'GET' && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          queryParams.append(key, params[key]);
        });
        if (queryParams.toString()) {
          allOriginsUrl += '&' + queryParams.toString();
        }
      }
      
      const response = await fetch(allOriginsUrl);
      if (!response.ok) {
        throw new Error(`AllOrigins proxy error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || !data.contents) {
        throw new Error('Пустой ответ от прокси AllOrigins');
      }
      
      // Распарсим содержимое ответа
      return JSON.parse(data.contents);
    } catch (backupError) {
      console.error('Ошибка при использовании запасного прокси:', backupError);
      throw error; // Выбрасываем оригинальную ошибку
    }
  }
}

// Экспортируем функции для использования в приложении
window.MazeRouterProxy = {
  // Расчет комиссии
  calculateCommission: async (amount) => {
    return fetchViaProxy('calculate', { amount }, 'GET');
  },
  
  // Создание транзакции
  prepareTransfer: async (to, amount) => {
    return fetchViaProxy('transfer', { to, amount }, 'GET');
  }
};

console.log('Maze Router Proxy успешно загружен'); 