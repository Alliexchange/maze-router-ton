// Service Worker для кэширования и управления сетевыми запросами
const CACHE_NAME = 'maze-router-cache-v3';
const API_URL = 'https://maze-router-api.vercel.app';

// Список путей для кэширования при установке
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
  '/proxy.js',
  '/direct-api.js'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: установка');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: кэширование статических ресурсов');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: все статические ресурсы закэшированы');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: ошибка при кэшировании:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: активация');
  
  // Удаление устаревших кэшей
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: удаление устаревшего кэша', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: теперь контролирует клиенты');
        return self.clients.claim();
      })
  );
});

// Функция для проверки, является ли запрос API запросом
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.hostname === new URL(API_URL).hostname && url.pathname.startsWith('/api');
}

// Перехват fetch запросов
self.addEventListener('fetch', (event) => {
  console.log('Service Worker: перехват запроса', event.request.url);
  
  // ВАЖНО: Полностью отключаем перехват API запросов!
  // Это позволит прокси-серверу и другим методам обхода CORS работать без помех
  if (isApiRequest(event.request)) {
    console.log('API запрос обнаружен, НЕ перехватываем:', event.request.url);
    return; // просто игнорируем запрос, чтобы браузер обработал его обычным способом
  }
  
  // Для всех остальных запросов используем стратегию "сначала сеть"
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если получили успешный ответ из сети, кэшируем его
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then((cache) => {
            console.log('Service Worker: кэширование ответа для', event.request.url);
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch((error) => {
        console.log('Service Worker: ошибка сети, возвращаем из кэша', event.request.url, error);
        
        // Если сеть недоступна, возвращаем ресурс из кэша, если он там есть
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Если ресурса нет в кэше, возвращаем страницу ошибки или базовый ответ
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
            
            // Для других запросов возвращаем ошибку
            return new Response('Нет сети и ресурс не найден в кэше', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
}); 