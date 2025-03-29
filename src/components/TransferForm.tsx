import React, { useState, useEffect } from 'react';
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from '@ton/core';

// Базовые URL для API и CORS прокси
const API_BASE_URL = 'https://maze-router-api.vercel.app/api';
const CORS_PROXY = 'https://corsproxy.io/?';

// Интерфейс для ответа от API при расчете комиссии
interface CommissionResponse {
  commission: string;
  gasReserve: string;
  total: string;
}

interface CommissionInfo {
  originalAmount: string;
  commission: string;
  gasReserve: string;
  total: string;
}

// Простая функция для запросов через CORS прокси
async function fetchApi(endpoint: string, params: any = {}, method: string = 'GET'): Promise<any> {
  try {
    console.log(`API запрос: ${endpoint}, метод: ${method}, параметры:`, params);

    // Полный URL API-эндпоинта
    const apiUrl = `${API_BASE_URL}/${endpoint}`;
    
    // URL с прокси
    let url: string;
    let options: RequestInit = { 
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (method === 'GET') {
      // Для GET запросов добавляем параметры в URL
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        queryParams.append(key, params[key]);
      });
      
      // Формируем URL через прокси
      url = `${CORS_PROXY}${encodeURIComponent(`${apiUrl}?${queryParams.toString()}`)}`;
    } else {
      // Для POST запросов отправляем параметры в теле
      url = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
      options.body = JSON.stringify(params);
    }
    
    console.log(`Отправка запроса через прокси: ${url}`);
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка API запроса:', error);
    throw error;
  }
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

  // useEffect для автоматического расчета комиссии при изменении суммы
  useEffect(() => {
    const getCommission = async () => {
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        setCommissionInfo(null);
        return;
      }
      
      try {
        const amountNum = parseFloat(amount);
        console.log('Расчет комиссии для суммы:', amountNum);
        
        // Запрос через CORS прокси
        const result = await fetchApi('calculate', { amount: amountNum }, 'GET');
        console.log('Результат расчета комиссии:', result);
        
        if (result.success) {
          setCommissionInfo({
            originalAmount: amount,
            commission: result.commission,
            gasReserve: result.gasReserve,
            total: result.total
          });
        } else {
          console.error('Ошибка при расчете комиссии:', result.details);
          setCommissionInfo(null);
        }
      } catch (err) {
        console.error('Ошибка при расчете комиссии:', err);
        setCommissionInfo(null);
      }
    };
    
    getCommission();
  }, [amount]);

  const handleConnect = async () => {
    try {
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
    try {
      const url = 'https://app.tonkeeper.com/dapp/https%3A%2F%2Falliexchange.github.io%2Fmaze-router-ton%2Ftonconnect-manifest.json?testnet=true';
      console.log('Открываем Tonkeeper Web:', url);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Ошибка при открытии Tonkeeper Web:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(`Ошибка при открытии Tonkeeper Web: ${errorMessage}`);
    }
  };

  const handleAddressInput = () => {
    const userAddress = prompt('Введите адрес вашего TON кошелька:');
    if (userAddress) {
      try {
        const address = Address.parse(userAddress);
        const formattedAddress = address.toString();
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    
    try {
      if (!targetAddress || !amount) {
        throw new Error('Укажите адрес получателя и сумму');
      }
      
      console.log(`Отправка транзакции: to=${targetAddress}, amount=${amount}`);
      
      // Запрос через CORS прокси
      const result = await fetchApi('transfer', {
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
      const result = await fetchApi('calculate', { amount: 1 }, 'GET');
      alert(`Прокси работает! Результат: ${JSON.stringify(result)}`);
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