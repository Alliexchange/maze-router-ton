// Service Worker для обхода CORS
console.log('Service Worker загружен');

// Список разрешенных доменов для API
const API_DOMAINS = [
  'maze-router-api.vercel.app',
  'localhost:3001'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker устанавливается');
  
  // Активируем немедленно, не дожидаясь обновления страницы
  event.waitUntil(self.skipWaiting());
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker активирован');
  
  // Берем контроль над всеми клиентами без перезагрузки страницы
  event.waitUntil(self.clients.claim());
});

// Перехват fetch запросов
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Проверяем, относится ли запрос к нашему API
  if (API_DOMAINS.some(domain => requestUrl.hostname === domain)) {
    console.log(`[SW] Перехвачен запрос к API: ${event.request.url}`);
    
    // Обрабатываем запрос
    event.respondWith(handleAPIRequest(event.request));
  }
});

/**
 * Обрабатывает запрос к API
 */
async function handleAPIRequest(originalRequest) {
  try {
    console.log(`[SW] Отправка запроса: ${originalRequest.url}`);
    
    // Создаем новый запрос с нужными опциями
    const newRequestInit = {
      method: originalRequest.method,
      headers: new Headers(originalRequest.headers),
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-cache',
      redirect: 'follow'
    };
    
    // Важное исправление: добавляем duplex свойство для запросов с телом
    if (['POST', 'PUT'].includes(originalRequest.method)) {
      newRequestInit.duplex = 'half';
      
      // Копируем тело запроса
      const originalBody = await originalRequest.clone().text();
      if (originalBody) {
        newRequestInit.body = originalBody;
      }
    }
    
    // Создаем новый запрос
    const newRequest = new Request(originalRequest.url, newRequestInit);
    
    // Отправляем запрос
    const response = await fetch(newRequest);
    
    // Если ответ не успешный
    if (!response.ok) {
      throw new Error(`API ответ не успешен: ${response.status}`);
    }
    
    // Создаем новый ответ с правильными CORS-заголовками
    const responseBody = await response.blob();
    const headers = new Headers(response.headers);
    
    // Добавляем CORS-заголовки
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  } catch (error) {
    console.error(`[SW] Ошибка при запросе к API: ${error.message}`);
    
    // Возвращаем ошибку в формате JSON
    return new Response(
      JSON.stringify({
        error: true,
        message: `Ошибка при запросе к API: ${error.message}`,
        url: originalRequest.url
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        }
      }
    );
  }
} 