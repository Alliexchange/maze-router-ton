import React, { useState, useEffect } from 'react';
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from '@ton/core';

// Определение типа для MazeRouterProxy
declare global {
  interface Window {
    MazeRouterProxy?: {
      calculateCommission: (amount: number) => Promise<any>;
      prepareTransfer: (to: string, amount: number) => Promise<any>;
    };
    DirectMazeAPI?: {
      calculateCommission: (amount: number) => Promise<any>;
      prepareTransfer: (to: string, amount: number) => Promise<any>;
    };
  }
}

// Адрес Vercel прокси-сервера
const PROXY_API_URL = 'https://maze-proxy-server.vercel.app/api';

// Создаем глобальный объект MazeRouterProxy, если он еще не существует
if (typeof window !== 'undefined' && !window.MazeRouterProxy) {
  console.log('Инициализация MazeRouterProxy в TransferForm...');
  window.MazeRouterProxy = {
    calculateCommission: async (amount) => {
      console.log('MazeRouterProxy.calculateCommission вызван с суммой:', amount);
      return fetchViaProxy('calculate', { amount }, 'GET');
    },
    prepareTransfer: async (to, amount) => {
      console.log('MazeRouterProxy.prepareTransfer вызван:', { to, amount });
      return fetchViaProxy('transfer', { to, amount }, 'POST');
    }
  };
}

// Интерфейс для ответа от API при расчете комиссии
interface CommissionResponse {
  commission: string;
  gasReserve: string;
  total: string;
}

// Функция для отправки запроса к API через прокси
async function fetchViaProxy(endpoint: string, params: any = {}, method: string = 'GET') {
  console.log(`Запрос через прокси: ${endpoint}, метод: ${method}, параметры:`, params);
  
  try {
    // Пробуем использовать DirectMazeAPI, если он доступен
    if (window.DirectMazeAPI) {
      try {
        console.log(`Используем DirectMazeAPI для ${endpoint}`);
        if (endpoint === 'calculate') {
          return await window.DirectMazeAPI.calculateCommission(params.amount);
        } else if (endpoint === 'transfer') {
          return await window.DirectMazeAPI.prepareTransfer(params.to, params.amount);
        }
      } catch (directApiError) {
        console.error('Ошибка при использовании DirectMazeAPI:', directApiError);
        // Продолжаем выполнение и пробуем стандартный метод
      }
    }

    if (method === 'GET') {
      // Для GET запросов формируем параметры в URL
      const queryParams = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        queryParams.append(key, params[key]);
      });
      
      const url = `${PROXY_API_URL}/${endpoint}?${queryParams.toString()}`;
      console.log(`GET запрос: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Для POST запросов отправляем параметры в теле
      const url = `${PROXY_API_URL}/${endpoint}`;
      console.log(`POST запрос: ${url}`);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    }
  } catch (error: unknown) {
    console.error('Ошибка при обращении к API через прокси:', error);
    throw error;
  }
}

interface CommissionInfo {
    originalAmount: string;
    commission: string;
    gasReserve: string;
    total: string;
}

const TransferForm = () => {
    const [tonConnectUI] = useTonConnectUI();
    const [targetAddress, setTargetAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [error, setError] = useState('');
    const [commissionInfo, setCommissionInfo] = useState<CommissionInfo | null>(null);
    const [manualAddress, setManualAddress] = useState<string | null>(null);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                if (tonConnectUI.connected) {
                    setConnectionStatus(`Подключен: ${tonConnectUI.account?.address || 'адрес не получен'}`);
                    setError('');
                    console.log('Wallet connected:', {
                        address: tonConnectUI.account?.address,
                        chain: tonConnectUI.account?.chain,
                        wallet: tonConnectUI.wallet
                    });
                } else if (manualAddress) {
                    setConnectionStatus(`Ручное подключение: ${manualAddress}`);
                } else {
                    setConnectionStatus('Не подключен');
                    console.log('Wallet not connected');
                    
                    // Проверяем доступные кошельки
                    try {
                        const wallets = await tonConnectUI.getWallets();
                        console.log('Available wallets:', wallets);
                    } catch (walletErr) {
                        console.error('Error getting wallets:', walletErr);
                    }
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
                setError(`Ошибка подключения: ${errorMessage}`);
                console.error('Connection error:', err);
            }
        };

        checkConnection();
        const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
            console.log('Wallet status changed:', wallet);
            checkConnection();
        });

        return () => {
            unsubscribe();
        };
    }, [tonConnectUI, manualAddress]);

    // Заменяем функцию calculateCommission на новую версию с использованием прокси
    const calculateCommission = async (amount: number): Promise<CommissionResponse> => {
        console.log('Расчет комиссии для суммы:', amount);
        
        try {
            // Запрос через прокси-сервер Vercel
            const result = await fetchViaProxy('calculate', { amount }, 'GET');
            console.log('Результат расчета комиссии:', result);
            
            if (!result.success) {
                throw new Error(result.details || 'Ошибка при расчете комиссии');
            }
            
            return {
                commission: result.commission,
                gasReserve: result.gasReserve,
                total: result.total
            };
        } catch (error: unknown) {
            console.error('Ошибка при расчете комиссии:', error);
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            alert(`Ошибка при расчете комиссии: ${errorMessage}`);
            throw error;
        }
    };

    const handleConnect = async () => {
        try {
            // Открываем модальное окно с принудительным использованием веб-версии
            console.log('Opening modal...');
            await tonConnectUI.openModal();
            console.log('Modal opened successfully');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка открытия модального окна: ${errorMessage}`);
            console.error('Modal error:', err);
        }
    };

    const handleManualConnect = () => {
        // Прямое подключение к Tonkeeper Web
        try {
            // Создаем URL с явным параметром testnet
            const url = 'https://app.tonkeeper.com/dapp/https%3A%2F%2Falliexchange.github.io%2Fmaze-router-ton%2Ftonconnect-manifest.json?testnet=true';
            console.log('Открываем Tonkeeper Web:', url);
            
            // Открываем в новой вкладке
            window.open(url, '_blank');
        } catch (err) {
            console.error('Ошибка при открытии Tonkeeper Web:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка при открытии Tonkeeper Web: ${errorMessage}`);
        }
    };

    const handleAddressInput = () => {
        // Функция для ручного ввода адреса из Tonkeeper
        const userAddress = prompt('Введите адрес вашего TON кошелька:');
        if (userAddress) {
            try {
                // Проверяем валидность адреса
                const address = Address.parse(userAddress);
                const formattedAddress = address.toString();
                
                // Сохраняем адрес в состоянии
                setManualAddress(formattedAddress);
                
                alert(`Адрес успешно добавлен: ${formattedAddress}`);
            } catch (err) {
                alert('Некорректный адрес TON. Пожалуйста, проверьте и попробуйте снова.');
            }
        }
    };

    const handleDisconnectManual = () => {
        setManualAddress(null);
        setConnectionStatus('Не подключен');
    };

    // Заменяем функцию handleSubmit на новую версию с использованием прокси
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        
        try {
            if (!targetAddress || !amount) {
                throw new Error('Укажите адрес получателя и сумму');
            }
            
            console.log(`Отправка транзакции: to=${targetAddress}, amount=${amount}`);
            
            // Запрос через прокси-сервер Vercel
            const result = await fetchViaProxy('transfer', {
                to: targetAddress,
                amount: parseFloat(amount)
            }, 'POST');
            
            console.log('Результат подготовки транзакции:', result);
            
            if (!result.success) {
                throw new Error(result.details || 'Ошибка при создании транзакции');
            }
            
            // Вызываем TonConnect для отправки транзакции
            const tx = {
                validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут на выполнение
                messages: [
                    {
                        address: result.contractAddress,
                        amount: result.totalAmount.toString(),
                        payload: result.encryptedPayload
                    }
                ]
            };
            
            console.log('Отправка транзакции через TonConnect:', tx);
            
            await tonConnectUI.sendTransaction(tx)
                .then((transactionResult) => {
                    console.log('Результат отправки транзакции:', transactionResult);
                    alert('Транзакция успешно отправлена!');
                    setLoading(false);
                    setTargetAddress('');
                    setAmount('');
                    setError('');
                    setCommissionInfo(null);
                })
                .catch((error: unknown) => {
                    console.error('Ошибка при отправке транзакции:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                    alert(`Ошибка при отправке транзакции: ${errorMessage}`);
                    setLoading(false);
                });
            
        } catch (error: unknown) {
            console.error('Ошибка при подготовке транзакции:', error);
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            alert(`Ошибка: ${errorMessage}`);
            setLoading(false);
        }
    };

    const isConnected = tonConnectUI.connected || !!manualAddress;

    // Функция для тестирования прокси
    const testProxy = async () => {
        try {
            if (window.MazeRouterProxy) {
                const result = await window.MazeRouterProxy.calculateCommission(1);
                alert(`Прокси работает! Результат: ${JSON.stringify(result)}`);
            } else {
                alert('MazeRouterProxy не найден!');
            }
        } catch (err) {
            alert(`Ошибка при тестировании прокси: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <div className="transfer-form">
            <h2>Перевод TON</h2>
            <div className="wallet-connection">
                <TonConnectButton />
                <p>{connectionStatus}</p>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <div className="connect-buttons">
                    {!isConnected && (
                        <>
                            <button onClick={handleConnect}>Подключить через QR-код</button>
                            <button onClick={handleManualConnect} className="web-connect">Открыть в Tonkeeper Web</button>
                            <button onClick={handleAddressInput} className="manual-input">Ввести адрес вручную</button>
                        </>
                    )}
                    {manualAddress && (
                        <button onClick={handleDisconnectManual} className="disconnect">Отключить ручное подключение</button>
                    )}
                    <button onClick={testProxy} style={{ backgroundColor: '#4CAF50' }}>Проверить прокси</button>
                </div>
            </div>
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Адрес получателя:</label>
                    <input
                        type="text"
                        value={targetAddress}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetAddress(e.target.value)}
                        placeholder="Введите адрес получателя"
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label>Сумма (TON):</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                        placeholder="Введите сумму"
                        step="0.000000001"
                        min="0.01"
                        required
                    />
                </div>

                {commissionInfo && (
                    <div className="commission-info">
                        <p>Комиссия сервиса: {commissionInfo.commission} TON</p>
                        <p>Резерв на газ: {commissionInfo.gasReserve} TON</p>
                        <p>Итого к оплате: {commissionInfo.total} TON</p>
                    </div>
                )}
                
                <button type="submit" disabled={loading || !isConnected || !commissionInfo}>
                    {loading ? 'Отправка...' : 'Отправить'}
                </button>
            </form>
        </div>
    );
};

export default TransferForm; 