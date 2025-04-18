// Service Worker для кэширования и управления сетевыми запросами
// ВАЖНО: полностью отключен для предотвращения конфликтов с обходом CORS
console.log('Service Worker загружен, но отключен для предотвращения конфликтов с обходом CORS');

// Минимальная установка без кэширования
self.addEventListener('install', (event) => {
  console.log('Service Worker: установка (без активных действий)');
  self.skipWaiting(); // Пропускаем ожидание и активируем сразу
});

// Активация без принятия контроля над клиентами
self.addEventListener('activate', (event) => {
  console.log('Service Worker: активация (без действий)');
});

// Перехват запросов отключен
self.addEventListener('fetch', (event) => {
  // Ничего не делаем, пусть браузер обрабатывает запросы самостоятельно
}); 