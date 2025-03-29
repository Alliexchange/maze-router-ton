import React, { useState, useEffect } from 'react';
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from '@ton/core';

// API URL - локальный для разработки, или публичный для продакшн
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://maze-router-api.vercel.app/api' // Vercel API URL
  : 'http://localhost:3001/api';

// Указываем явно режим для обхода CORS
const API_FETCH_OPTIONS = {
    mode: 'cors' as RequestMode,
    credentials: 'include' as RequestCredentials,
};

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

    // Расчет комиссии при изменении суммы
    useEffect(() => {
        const calculateCommission = async () => {
            if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                setCommissionInfo(null);
                return;
            }

            try {
                console.log('Sending calculate commission request to:', `${API_URL}/calculate`);
                
                // Сначала пробуем GET-запрос
                try {
                    const getUrl = `${API_URL}/calculate?amount=${encodeURIComponent(amount)}`;
                    console.log('Trying GET request:', getUrl);
                    
                    const response = await fetch(getUrl, API_FETCH_OPTIONS);
                    
                    if (!response.ok) {
                        throw new Error(`GET failed with status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('Commission data received (GET):', data);
                    setCommissionInfo(data);
                    return;
                } catch (getErr) {
                    console.warn('GET request failed, trying POST:', getErr);
                }
                
                // Если GET не сработал, используем POST
                const response = await fetch(`${API_URL}/calculate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ amount: parseFloat(amount) }),
                    ...API_FETCH_OPTIONS
                });

                if (!response.ok) {
                    console.error('POST request failed:', response.status, response.statusText);
                    throw new Error(`Ошибка при расчете комиссии: ${response.status}`);
                }

                const data = await response.json();
                console.log('Commission data received (POST):', data);
                setCommissionInfo(data);
            } catch (err) {
                console.error('Ошибка при расчете комиссии:', err);
                setCommissionInfo(null);
            }
        };

        calculateCommission();
    }, [amount]);

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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        
        // Проверяем наличие подключения (TonConnect или ручное)
        if (!tonConnectUI.connected && !manualAddress) {
            setError('Пожалуйста, подключите кошелек');
            return;
        }

        if (!commissionInfo) {
            setError('Не удалось рассчитать комиссию');
            return;
        }

        try {
            setLoading(true);
            
            // Проверяем валидность адреса
            let addressString = '';
            try {
                const address = Address.parse(targetAddress);
                addressString = address.toString();
                console.log('Parsed address:', addressString);
            } catch (addrErr) {
                console.error('Ошибка при парсинге адреса:', addrErr);
                addressString = targetAddress;
                console.log('Using original address:', addressString);
            }
            
            // Отправляем запрос на сервер для создания транзакции
            console.log('Preparing request for API:', {
                from: tonConnectUI.connected ? tonConnectUI.account?.address : manualAddress,
                to: addressString,
                amount: amount
            });
            
            // Сначала попробуем с помощью GET для совместимости с разными окружениями
            const apiUrl = `${API_URL}/transfer?to=${encodeURIComponent(addressString)}&amount=${encodeURIComponent(amount)}`;
            
            console.log('Sending transfer request (GET):', apiUrl);
            let response;
            let data;
            
            try {
                response = await fetch(apiUrl, API_FETCH_OPTIONS);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                data = await response.json();
                console.log('Received transaction data (GET):', data);
            } catch (getErr) {
                console.warn('GET request failed, falling back to POST:', getErr);
                
                // Если GET не сработал, пробуем POST
                try {
                    response = await fetch(`${API_URL}/transfer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: tonConnectUI.connected ? tonConnectUI.account?.address : manualAddress,
                            to: addressString,
                            amount: amount
                        }),
                        ...API_FETCH_OPTIONS
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ details: 'Ошибка при парсинге ответа' }));
                        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
                    }
                    
                    data = await response.json();
                    console.log('Received transaction data (POST):', data);
                } catch (postErr) {
                    console.error('POST request also failed:', postErr);
                    throw new Error('Не удалось получить данные для транзакции. Попробуйте позже.');
                }
            }
            
            if (!data || !data.contractAddress || !data.amount || !data.encryptedPayload) {
                console.error('Invalid transaction data:', data);
                throw new Error('Сервер вернул некорректные данные для транзакции');
            }
            
            // Если есть TonConnect, используем его для отправки
            if (tonConnectUI.connected) {
                // Отправляем транзакцию через TonConnect
                console.log('Sending transaction via TonConnect with data:', {
                    contractAddress: data.contractAddress,
                    amount: data.amount,
                    payload: data.encryptedPayload
                });
                
                // Форматируем данные в правильном формате для tonConnectUI
                const transaction = {
                    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут в секундах
                    messages: [
                        {
                            address: data.contractAddress,
                            amount: data.amount,
                            payload: data.encryptedPayload
                        }
                    ]
                };
                
                console.log('Final transaction object:', JSON.stringify(transaction, null, 2));
                
                try {
                    await tonConnectUI.sendTransaction(transaction);
                    console.log('Transaction sent successfully!');
                    
                    alert('Транзакция успешно отправлена!');
                    setTargetAddress('');
                    setAmount('');
                    setError('');
                    setCommissionInfo(null);
                } catch (txErr) {
                    console.error('TonConnect transaction error:', txErr);
                    const txErrorMessage = txErr instanceof Error ? txErr.message : 'Неизвестная ошибка';
                    throw new Error(`Ошибка при отправке через TonConnect: ${txErrorMessage}`);
                }
            } else if (manualAddress) {
                // Показываем инструкции для ручной отправки
                console.log('Preparing manual transaction instructions...');
                
                const instructions = `
                    Отправьте транзакцию вручную из вашего кошелька:
                    
                    Адрес: ${data.contractAddress}
                    Сумма: ${parseFloat(data.amount) / 1000000000} TON
                    Комментарий: ${data.encryptedPayload}
                    
                    После отправки, транзакция будет обработана контрактом.
                `;
                
                alert(instructions);
                
                setTargetAddress('');
                setAmount('');
                setError('');
                setCommissionInfo(null);
            }
        } catch (err) {
            console.error('Общая ошибка при обработке транзакции:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка при отправке транзакции: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const isConnected = tonConnectUI.connected || !!manualAddress;

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