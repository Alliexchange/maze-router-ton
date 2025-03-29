// CORS Proxy для Maze Router API
// Загружается в браузере и позволяет обходить ограничения CORS

// API URL для основного API
const API_BASE_URL = 'https://maze-router-api.vercel.app/api';

// URL локального прокси-сервера (в разработке на порту 3002)
const LOCAL_PROXY_URL = 'http://localhost:3002/proxy/api';

// URL прокси для продакшена - нужно его задеплоить на Vercel
const PROXY_URL = 'https://maze-router-proxy.vercel.app/proxy/api';

// Функция для определения URL прокси в зависимости от окружения
function getProxyUrl() {
  if (window.location.hostname === 'localhost') {
    return LOCAL_PROXY_URL;
  }
  return PROXY_URL;
}

// Функция для отправки запроса через локальный прокси
async function fetchViaProxy(endpoint, params = {}, method = 'GET') {
  console.log(`Отправка запроса через прокси: ${endpoint}, метод: ${method}`);
  
  try {
    // Формируем URL для запроса
    let url = `${getProxyUrl()}/${endpoint}`;
    const queryParams = new URLSearchParams();
    
    // Для GET-запросов добавляем параметры в URL
    if (method === 'GET' && Object.keys(params).length > 0) {
      Object.keys(params).forEach(key => {
        queryParams.append(key, params[key]);
      });
      
      if (queryParams.toString()) {
        url += '?' + queryParams.toString();
      }
    }
    
    console.log(`Итоговый URL: ${url}`);
    
    // Настройки запроса
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Для не-GET запросов добавляем тело
    if (method !== 'GET' && Object.keys(params).length > 0) {
      options.body = JSON.stringify(params);
    }
    
    // Отправляем запрос
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.error(`Ошибка HTTP: ${response.status}`);
      throw new Error(`Ошибка HTTP! Статус: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при выполнении запроса через прокси:', error);
    
    // Запасной вариант - прямой запрос к API с no-cors
    try {
      console.log('Пробуем прямой запрос с no-cors...');
      
      let url = `${API_BASE_URL}/${endpoint}`;
      if (method === 'GET' && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          queryParams.append(key, params[key]);
        });
        
        if (queryParams.toString()) {
          url += '?' + queryParams.toString();
        }
      }
      
      const options = {
        method: method,
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      if (method !== 'GET' && Object.keys(params).length > 0) {
        options.body = JSON.stringify(params);
      }
      
      const response = await fetch(url, options);
      return await response.json(); // Это скорее всего не сработает из-за no-cors
    } catch (backupError) {
      console.error('Прямой запрос с no-cors тоже не сработал:', backupError);
      
      // Третий запасной вариант - использовать AllOrigins
      console.log('Пробуем AllOrigins...');
      return fetchViaAllOrigins(endpoint, params, method);
    }
  }
}

// Запасной вариант через AllOrigins
async function fetchViaAllOrigins(endpoint, params = {}, method = 'GET') {
  try {
    let url = `${API_BASE_URL}/${endpoint}`;
    if (method === 'GET' && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        queryParams.append(key, params[key]);
      });
      
      if (queryParams.toString()) {
        url += '?' + queryParams.toString();
      }
    }
    
    const allOriginsUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
    console.log(`Пробуем AllOrigins: ${allOriginsUrl}`);
    
    const response = await fetch(allOriginsUrl);
    if (!response.ok) {
      throw new Error(`AllOrigins ошибка! Статус: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || !data.contents) {
      throw new Error('Пустой ответ от прокси AllOrigins');
    }
    
    // Распарсим содержимое ответа
    return JSON.parse(data.contents);
  } catch (error) {
    console.error('Все методы запросов не сработали:', error);
    throw new Error('Не удалось выполнить запрос. Проверьте сетевое соединение.');
  }
}

// Экспортируем функции для использования в приложении
window.MazeRouterProxy = {
  // Расчет комиссии
  calculateCommission: async (amount) => {
    console.log(`Расчет комиссии для суммы: ${amount}`);
    return fetchViaProxy('calculate', { amount }, 'GET');
  },
  
  // Создание транзакции
  prepareTransfer: async (to, amount) => {
    console.log(`Подготовка перевода: to=${to}, amount=${amount}`);
    return fetchViaProxy('transfer', { to, amount }, 'GET');
  }
};

console.log('Maze Router Proxy успешно загружен'); 