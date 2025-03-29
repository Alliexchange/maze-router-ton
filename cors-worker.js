// CORS Service Worker для Maze Router
// Registers a service worker to intercept API calls and add CORS headers

// Проверка поддержки Service Workers
if ('serviceWorker' in navigator) {
  // Регистрируем Service Worker при загрузке страницы
  window.addEventListener('load', async () => {
    try {
      console.log('Регистрация CORS Service Worker...');
      const registration = await navigator.serviceWorker.register('/maze-router-ton/sw.js');
      console.log('CORS Service Worker успешно зарегистрирован:', registration.scope);
      
      // Сообщаем в глобальный объект, что Service Worker зарегистрирован
      window.serviceWorkerRegistered = true;
    } catch (error) {
      console.error('Ошибка при регистрации CORS Service Worker:', error);
      
      // Отмечаем, что Service Worker не зарегистрирован
      window.serviceWorkerRegistered = false;
    }
  });
} else {
  console.error('Service Workers не поддерживаются в этом браузере');
  window.serviceWorkerRegistered = false;
}

// Обновляем MazeRouterProxy чтобы проверять наличие Service Worker
if (window.MazeRouterProxy) {
  console.log('Обновляем MazeRouterProxy для использования Service Worker');
  
  // Сохраняем оригинальные методы
  const originalCalculateCommission = window.MazeRouterProxy.calculateCommission;
  const originalPrepareTransfer = window.MazeRouterProxy.prepareTransfer;
  
  // Переопределяем методы, чтобы использовать Service Worker, если он доступен
  window.MazeRouterProxy.calculateCommission = async (amount) => {
    console.log(`Расчет комиссии для суммы: ${amount} через Service Worker`);
    
    if (window.serviceWorkerRegistered) {
      try {
        // Если Service Worker зарегистрирован, используем прямой запрос к API
        // Service Worker перехватит запрос и добавит нужные заголовки
        const response = await fetch(`https://maze-router-api.vercel.app/api/calculate?amount=${amount}`);
        return await response.json();
      } catch (error) {
        console.error('Ошибка SW запроса (calculateCommission):', error);
        // Fallback к оригинальному методу
        return originalCalculateCommission(amount);
      }
    } else {
      // Используем оригинальный метод
      return originalCalculateCommission(amount);
    }
  };
  
  window.MazeRouterProxy.prepareTransfer = async (to, amount) => {
    console.log(`Подготовка перевода: to=${to}, amount=${amount} через Service Worker`);
    
    if (window.serviceWorkerRegistered) {
      try {
        // Если Service Worker зарегистрирован, используем прямой запрос к API
        // Service Worker перехватит запрос и добавит нужные заголовки
        const response = await fetch(`https://maze-router-api.vercel.app/api/transfer?to=${encodeURIComponent(to)}&amount=${amount}`);
        return await response.json();
      } catch (error) {
        console.error('Ошибка SW запроса (prepareTransfer):', error);
        // Fallback к оригинальному методу
        return originalPrepareTransfer(to, amount);
      }
    } else {
      // Используем оригинальный метод
      return originalPrepareTransfer(to, amount);
    }
  };
} else {
  console.error('MazeRouterProxy не найден');
}

console.log('CORS Worker загружен'); 