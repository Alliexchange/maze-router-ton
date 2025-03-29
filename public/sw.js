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
    
    // Создаем новый запрос с модифицированными заголовками
    const modifiedRequest = createCORSRequest(event.request);
    
    // Обрабатываем запрос
    event.respondWith(handleAPIRequest(modifiedRequest, event.request.url));
  }
});

/**
 * Создает запрос с CORS-заголовками
 */
function createCORSRequest(originalRequest) {
  // Клонируем оригинальный запрос
  const requestInit = {
    method: originalRequest.method,
    headers: new Headers(originalRequest.headers),
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-cache',
    redirect: 'follow'
  };
  
  // Если запрос содержит тело, копируем его
  if (['POST', 'PUT'].includes(originalRequest.method)) {
    // Клонируем тело
    requestInit.body = originalRequest.clone().body;
  }
  
  // Создаем новый запрос
  return new Request(originalRequest.url, requestInit);
}

/**
 * Обрабатывает запрос к API
 */
async function handleAPIRequest(request, originalUrl) {
  try {
    console.log(`[SW] Отправка запроса: ${originalUrl}`);
    
    // Отправляем запрос
    const response = await fetch(request);
    
    // Если ответ успешный, но нет доступа из-за CORS
    if (response.status === 0 || !response.ok) {
      throw new Error(`API ответ не успешен: ${response.status}`);
    }
    
    // Создаем новый ответ с правильными CORS-заголовками
    const modifiedResponse = createCORSResponse(response);
    
    return modifiedResponse;
  } catch (error) {
    console.error(`[SW] Ошибка при запросе к API: ${error.message}`);
    
    // Возвращаем ошибку в формате JSON
    return new Response(
      JSON.stringify({
        error: true,
        message: `Ошибка при запросе к API: ${error.message}`,
        originalUrl
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

/**
 * Создает ответ с CORS-заголовками
 */
function createCORSResponse(originalResponse) {
  // Клонируем заголовки ответа
  const headers = new Headers(originalResponse.headers);
  
  // Добавляем CORS-заголовки
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Создаем новый ответ с теми же данными и статусом, но с новыми заголовками
  return originalResponse.clone().blob().then(blob => {
    return new Response(blob, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: headers
    });
  });
} 