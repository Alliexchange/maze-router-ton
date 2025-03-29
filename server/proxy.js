const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

// Создаем логгер
const logFile = path.join(__dirname, 'proxy.log');
const logger = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage);
    try {
        fs.appendFileSync(logFile, logMessage);
    } catch (err) {
        console.error(`Ошибка записи лога: ${err.message}`);
    }
};

// Очищаем лог при старте
try {
    fs.writeFileSync(logFile, '');
    logger('Локальный прокси-сервер запускается');
} catch (err) {
    console.error(`Ошибка создания лог-файла: ${err.message}`);
}

// Создаем экземпляр приложения
const app = express();

// Настройка CORS для всех доменов
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.use(express.json());

// Добавляем промежуточное ПО для логирования запросов
app.use((req, res, next) => {
    logger(`Запрос: ${req.method} ${req.url}`);
    
    // Логируем заголовки запроса
    logger(`Заголовки: ${JSON.stringify(req.headers)}`);
    
    // Логируем тело запроса, если оно есть
    if (req.body && Object.keys(req.body).length > 0) {
        logger(`Тело запроса: ${JSON.stringify(req.body)}`);
    }
    
    // Перехватываем ответ для логирования
    const originalSend = res.send;
    res.send = function(body) {
        logger(`Ответ: ${res.statusCode}`);
        
        // Если это JSON, логируем его
        if (typeof body === 'string' && body.startsWith('{')) {
            try {
                const jsonBody = JSON.parse(body);
                logger(`Тело ответа: ${JSON.stringify(jsonBody)}`);
            } catch (err) {
                logger(`Тело ответа (не JSON): ${body.substring(0, 200)}...`);
            }
        }
        
        return originalSend.apply(res, arguments);
    };
    
    next();
});

// Настройка прокси для перенаправления запросов к API
const apiProxy = createProxyMiddleware({
    target: 'https://maze-router-api.vercel.app',
    changeOrigin: true, // Важно для работы с разными доменами
    pathRewrite: {
        '^/proxy/api': '/api' // Убираем префикс /proxy при перенаправлении
    },
    onProxyReq: (proxyReq, req, res) => {
        // Изменяем заголовки перед отправкой
        proxyReq.setHeader('Origin', 'https://maze-router-api.vercel.app');
        
        // Если запрос имеет тело и это POST/PUT, нужно переписать тело
        if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.write(bodyData);
        }
        
        logger(`Прокси запрос к API: ${req.method} ${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        logger(`Ответ от API: ${proxyRes.statusCode}`);
        
        // Добавляем CORS заголовки в каждый ответ
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
    },
    onError: (err, req, res) => {
        logger(`Ошибка прокси: ${err.message}`);
        res.status(500).json({ error: 'Ошибка прокси', details: err.message });
    }
});

// Настройка маршрутов
app.use('/proxy/api', apiProxy); // API запросы через прокси

// Обработка OPTIONS запросов напрямую
app.options('*', cors(corsOptions));

// Добавляем базовый маршрут для проверки работы
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Локальный прокси-сервер работает',
        usage: {
            api: 'Используйте /proxy/api/{endpoint} для запросов к API',
            examples: [
                '/proxy/api/calculate?amount=1',
                '/proxy/api/transfer?to=0x...&amount=1'
            ]
        }
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    logger(`Ошибка: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', details: err.message });
});

// Запуск сервера
const PORT = process.env.PROXY_PORT || 3002;
app.listen(PORT, () => {
    logger(`Локальный прокси-сервер запущен на порту ${PORT}`);
    console.log(`Локальный прокси-сервер запущен на порту ${PORT}`);
}); 