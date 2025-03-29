const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Address, toNano, fromNano } = require('@ton/core');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Настройка логирования
const logFile = fs.createWriteStream('server.log', { flags: 'a' });
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage);
    logFile.write(logMessage);
};

log('Запуск сервера...');

// Проверяем наличие необходимых переменных окружения
if (!process.env.CONTRACT_ADDRESS) {
    log('WARNING: CONTRACT_ADDRESS не задан в .env файле');
}

const app = express();

// Константы
const COMMISSION_PERCENT = 0.2; // 0.2%
const MIN_COMMISSION = 0.01; // 0.01 TON
const GAS_RESERVE = 0.1; // 0.1 TON для газа

// Middleware для логирования запросов
app.use((req, res, next) => {
    log(`${req.method} ${req.url}`);
    next();
});

// CORS настройки
app.use(cors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'https://maze-ton.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// Проверяем наличие необходимых директорий
const buildPath = path.join(__dirname, '../build');
const publicPath = path.join(__dirname, '../public');

log(`Проверка директории build: ${buildPath}`);
if (!fs.existsSync(buildPath)) {
    log('ВНИМАНИЕ: Директория build не найдена. Запустите npm run build');
}

log(`Проверка директории public: ${publicPath}`);
if (!fs.existsSync(publicPath)) {
    log('ВНИМАНИЕ: Директория public не найдена');
}

// Раздача статических файлов React приложения
app.use(express.static(buildPath));
app.use(express.static(publicPath));

// Функция для шифрования адреса
function encryptAddress(address, key, iv) {
    try {
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(address),
            cipher.final()
        ]);
        return encrypted;
    } catch (error) {
        log(`Ошибка при шифровании: ${error.message}`);
        throw error;
    }
}

// Функция расчета комиссии
function calculateCommission(amount) {
    const commission = Math.max(
        amount * (COMMISSION_PERCENT / 100),
        MIN_COMMISSION
    );
    return {
        commission,
        total: amount + commission + GAS_RESERVE
    };
}

// API эндпоинт для расчета комиссии
app.post('/api/calculate', (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                error: 'Некорректная сумма',
                details: 'Сумма должна быть положительным числом'
            });
        }

        const { commission, total } = calculateCommission(parseFloat(amount));
        
        res.json({
            originalAmount: amount,
            commission: commission.toFixed(9),
            gasReserve: GAS_RESERVE,
            total: total.toFixed(9)
        });
    } catch (error) {
        log(`Ошибка при расчете комиссии: ${error.message}`);
        res.status(500).json({
            error: 'Ошибка при расчете комиссии',
            details: error.message
        });
    }
});

// Редирект со старого API на новый
app.post('/api/transaction', (req, res) => {
    log('Получен запрос на /api/transaction, перенаправляю на /api/transfer');
    
    // Перенаправляем запрос и сохраняем тело
    req.url = '/api/transfer';
    app._router.handle(req, res);
});

// API эндпоинт для перевода
app.post('/api/transfer', async (req, res) => {
    try {
        log(`Получен запрос на перевод: ${JSON.stringify(req.body)}`);
        const { to, amount } = req.body;
        
        if (!to || !amount) {
            log('Ошибка: отсутствуют обязательные параметры');
            return res.status(400).json({ 
                error: 'Отсутствуют обязательные параметры',
                details: 'Необходимо указать адрес получателя (to) и сумму (amount)'
            });
        }
        
        // Проверяем валидность адреса
        const targetAddress = Address.parse(to);
        
        // Рассчитываем комиссию
        const { commission, total } = calculateCommission(parseFloat(amount));
        
        // Генерируем ключ и IV для шифрования
        const encryptionKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        // Шифруем адрес получателя
        const encryptedAddress = encryptAddress(
            targetAddress.toString(),
            encryptionKey,
            iv
        );
        
        // Создаем payload для контракта
        const payload = Buffer.concat([
            encryptionKey,
            iv,
            encryptedAddress
        ]);

        const response = {
            contractAddress: process.env.CONTRACT_ADDRESS || 'EQDk2VTvn04SUKJrWJmXAZT7jh-9McgaF95Lc5vTwUtfxPtN',
            amount: toNano(total).toString(),
            commission: toNano(commission).toString(),
            gasReserve: toNano(GAS_RESERVE).toString(),
            encryptedPayload: payload.toString('base64')
        };

        log(`Подготовлен ответ: ${JSON.stringify(response)}`);
        res.json(response);
    } catch (error) {
        log(`Ошибка при обработке запроса: ${error.message}`);
        res.status(500).json({ 
            error: 'Ошибка при создании транзакции',
            details: error.message 
        });
    }
});

// Проверка манифеста
app.get('/tonconnect-manifest.json', (req, res) => {
    const manifestPath = path.join(__dirname, '../public/tonconnect-manifest.json');
    log(`Запрошен манифест TonConnect: ${manifestPath}`);
    
    if (!fs.existsSync(manifestPath)) {
        log('ОШИБКА: Файл манифеста не найден');
        return res.status(404).json({ error: 'Manifest not found' });
    }
    
    res.sendFile(manifestPath);
});

// Раздача index.html для всех остальных маршрутов (для работы React Router)
app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    log(`Запрошен маршрут ${req.url}, отдаю index.html: ${indexPath}`);
    
    if (!fs.existsSync(indexPath)) {
        log('ОШИБКА: index.html не найден');
        return res.status(404).send('Application files not found. Please run npm run build first.');
    }
    
    res.sendFile(indexPath);
});

const PORT = process.env.PORT || 3001;

// Создаем HTTP сервер
try {
    app.listen(PORT, '0.0.0.0', () => {
        log(`Сервер успешно запущен на порту ${PORT}`);
        log(`Откройте http://localhost:${PORT} в браузере`);
    });
} catch (error) {
    log(`Критическая ошибка при создании сервера: ${error.message}`);
}

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
    log(`Необработанное исключение: ${error.message}\n${error.stack}`);
    process.exit(1);
}); 