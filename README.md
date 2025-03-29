# Maze Router - TON Testnet

Maze Router - это приложение для анонимного маршрутизатора транзакций в сети TON (тестовая сеть). Проект использует шифрование адресов получателей для повышения приватности транзакций.

## Функциональность

- Подключение кошелька через TonConnect
- Ручной ввод адреса кошелька для локального тестирования
- Расчет комиссии за транзакцию
- Шифрование адреса получателя
- Работа через смарт-контракт маршрутизатора

## Технический стек

- React.js
- TypeScript
- Express.js
- TON SDK (@ton/core, @ton/ton)
- TonConnect (@tonconnect/ui-react, @tonconnect/sdk)
- TON Blueprint (структура смарт-контрактов)

## Установка и запуск

1. Клонировать репозиторий:
   ```
   git clone https://github.com/your-username/maze-router.git
   cd maze-router
   ```

2. Установить зависимости:
   ```
   npm install --legacy-peer-deps
   ```

3. Сборка проекта:
   ```
   npm run build
   ```

4. Запуск сервера:
   ```
   PORT=3001 node server/index.js
   ```

5. Открыть в браузере:
   ```
   http://localhost:3001
   ```

## Особенности работы с TonConnect

### Локальное тестирование
При работе на localhost существуют ограничения в функциональности TonConnect:
- QR-код не сканируется с мобильных устройств, так как они не имеют доступа к локальному IP
- Протокол `tonkeeper-tc://` не может быть обработан в браузере
- Для тестирования используйте функцию "Ввести адрес вручную"

### Продакшен-версия
Для полной работы с TonConnect необходимо:
- Разместить приложение на публичном домене с HTTPS
- Обновить значение поля `url` в манифесте на ваш публичный домен
- В Tonkeeper должен быть включен режим тестовой сети

## TON Blueprint

Проект использует некоторые концепции из [TON Blueprint](https://github.com/ton-org/blueprint) - официального шаблона для разработки смарт-контрактов на TON. Это помогает структурировать код смарт-контрактов и взаимодействие с ними.

## Лицензия

MIT 