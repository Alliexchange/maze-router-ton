// direct-api.js - Прямой доступ к API через JSONP
// JSONP - это легкий способ обойти ограничения CORS, загружая данные через теги <script>

console.log('Direct API module загружен');

// Создаем глобальный коллбэк для JSONP
window.MazeRouterJSONPCallback = function(data) {
  console.log('Получены данные через JSONP:', data);
  window.MazeRouterLatestJSONPResponse = data;
};

// Счетчик для уникальных имен коллбэков
let callbackCounter = 0;

// API URL
const API_BASE_URL = 'https://maze-router-api.vercel.app/api';

// Функция для создания JSONP запроса
function createJSONPRequest(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    // Создаем уникальное имя функции обратного вызова
    const callbackName = `mazerouter_jsonp_callback_${Date.now()}_${callbackCounter++}`;
    
    // Устанавливаем временный обработчик в глобальном объекте
    window[callbackName] = function(data) {
      // Очищаем обработчик
      delete window[callbackName];
      
      // Удаляем скрипт
      document.head.removeChild(script);
      
      // Возвращаем результат
      resolve(data);
    };
    
    // Добавляем параметры в URL
    const queryParams = new URLSearchParams();
    
    // Добавляем все параметры
    Object.keys(params).forEach(key => {
      queryParams.append(key, params[key]);
    });
    
    // Добавляем callback параметр для JSONP
    queryParams.append('callback', callbackName);
    
    // Собираем итоговый URL
    const url = `${API_BASE_URL}/${endpoint}?${queryParams.toString()}`;
    console.log('JSONP URL:', url);
    
    // Создаем элемент script
    const script = document.createElement('script');
    script.src = url;
    
    // Обработка ошибки загрузки скрипта
    script.onerror = function() {
      // Очищаем обработчик
      delete window[callbackName];
      
      // Удаляем скрипт
      document.head.removeChild(script);
      
      // Отклоняем промис с ошибкой
      reject(new Error('Ошибка загрузки JSONP запроса'));
    };
    
    // Устанавливаем таймаут
    const timeoutId = setTimeout(() => {
      // Очищаем обработчик
      delete window[callbackName];
      
      // Удаляем скрипт
      if (script.parentNode) {
        document.head.removeChild(script);
      }
      
      // Отклоняем промис с ошибкой таймаута
      reject(new Error('JSONP запрос превысил время ожидания'));
    }, 10000); // 10 секунд
    
    // Добавляем обработчик для успешного выполнения
    window[callbackName].timeoutId = timeoutId;
    
    // Добавляем скрипт на страницу, что запускает запрос
    document.head.appendChild(script);
  });
}

// Функция для отправки запроса через произвольный переданный URL
async function fetchViaExternalAPI(url) {
  try {
    console.log('Отправка запроса через внешний API:', url);
    
    // Оборачиваем запрос в try-catch, чтобы обработать возможные ошибки
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Получаем данные в формате JSON
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка при выполнении запроса через внешний API:', error);
    throw error;
  }
}

// CORS Anywhere proxy URL
const CORS_ANYWHERE_URL = 'https://cors-anywhere.herokuapp.com/';

// Функция для отправки запроса через CORS Anywhere
async function fetchViaCORSAnywhere(endpoint, params = {}) {
  // Добавляем параметры в URL
  const queryParams = new URLSearchParams();
  
  // Добавляем все параметры
  Object.keys(params).forEach(key => {
    queryParams.append(key, params[key]);
  });
  
  // Собираем URL API
  const apiUrl = `${API_BASE_URL}/${endpoint}?${queryParams.toString()}`;
  
  // Полный URL с прокси
  const proxyUrl = `${CORS_ANYWHERE_URL}${apiUrl}`;
  
  // Отправляем запрос через прокси
  return fetchViaExternalAPI(proxyUrl);
}

// AllOrigins proxy URL
const ALL_ORIGINS_URL = 'https://api.allorigins.win/get?url=';

// Функция для отправки запроса через AllOrigins
async function fetchViaAllOrigins(endpoint, params = {}) {
  // Добавляем параметры в URL
  const queryParams = new URLSearchParams();
  
  // Добавляем все параметры
  Object.keys(params).forEach(key => {
    queryParams.append(key, params[key]);
  });
  
  // Собираем URL API
  const apiUrl = `${API_BASE_URL}/${endpoint}?${queryParams.toString()}`;
  
  // Кодируем URL для передачи в качестве параметра
  const encodedUrl = encodeURIComponent(apiUrl);
  
  // Полный URL с прокси
  const proxyUrl = `${ALL_ORIGINS_URL}${encodedUrl}`;
  
  // Отправляем запрос через прокси
  const response = await fetchViaExternalAPI(proxyUrl);
  
  // AllOrigins возвращает ответ в свойстве contents в виде строки
  if (response && response.contents) {
    try {
      // Парсим содержимое ответа
      return JSON.parse(response.contents);
    } catch (error) {
      console.error('Ошибка при парсинге JSON из AllOrigins:', error);
      return response;
    }
  }
  
  return response;
}

// Создаем новый интерфейс для работы с API
window.DirectMazeAPI = {
  // Расчет комиссии
  calculateCommission: async (amount) => {
    console.log(`Расчет комиссии для суммы: ${amount}`);
    
    // Сначала пробуем через JSONP
    try {
      const result = await createJSONPRequest('calculate', { amount });
      console.log('JSONP ответ:', result);
      return result;
    } catch (jsonpError) {
      console.error('JSONP запрос не удался:', jsonpError);
      
      // Затем пробуем через CORS Anywhere
      try {
        const result = await fetchViaCORSAnywhere('calculate', { amount });
        console.log('CORS Anywhere ответ:', result);
        return result;
      } catch (corsError) {
        console.error('CORS Anywhere запрос не удался:', corsError);
        
        // Наконец, пробуем через AllOrigins
        try {
          const result = await fetchViaAllOrigins('calculate', { amount });
          console.log('AllOrigins ответ:', result);
          return result;
        } catch (allOriginsError) {
          console.error('All Origins запрос не удался:', allOriginsError);
          
          // Если все методы не сработали, возвращаем ошибку
          throw new Error('Не удалось выполнить запрос ни одним из доступных методов');
        }
      }
    }
  },
  
  // Подготовка транзакции
  prepareTransfer: async (to, amount) => {
    console.log(`Подготовка перевода: to=${to}, amount=${amount}`);
    
    // Для этого запроса используем только CORS Anywhere и AllOrigins, т.к. JSONP не подходит для сложных запросов
    try {
      const result = await fetchViaCORSAnywhere('transfer', { to, amount });
      console.log('CORS Anywhere ответ:', result);
      return result;
    } catch (corsError) {
      console.error('CORS Anywhere запрос не удался:', corsError);
      
      // Пробуем через AllOrigins
      try {
        const result = await fetchViaAllOrigins('transfer', { to, amount });
        console.log('AllOrigins ответ:', result);
        return result;
      } catch (allOriginsError) {
        console.error('All Origins запрос не удался:', allOriginsError);
        
        // Если все методы не сработали, возвращаем ошибку
        throw new Error('Не удалось выполнить запрос ни одним из доступных методов');
      }
    }
  }
};

console.log('Direct API интерфейс готов к использованию'); 