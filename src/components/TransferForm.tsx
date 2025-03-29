import React, { useState, useEffect } from 'react';
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from '@ton/core';

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
                const response = await fetch('http://localhost:3001/api/calculate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ amount: parseFloat(amount) })
                });

                if (!response.ok) {
                    throw new Error('Ошибка при расчете комиссии');
                }

                const data = await response.json();
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
            const url = 'https://app.tonkeeper.com/dapp/http%3A%2F%2Flocalhost%3A3001%2Ftonconnect-manifest.json?testnet=true';
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
            const address = Address.parse(targetAddress);
            
            // Отправляем запрос на сервер для создания транзакции
            console.log('Sending transfer request...');
            const response = await fetch('http://localhost:3001/api/transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: tonConnectUI.connected ? tonConnectUI.account?.address : manualAddress,
                    to: address.toString(),
                    amount: amount
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Ошибка при создании транзакции');
            }

            const data = await response.json();
            console.log('Transaction data:', data);
            
            // Если есть TonConnect, используем его для отправки
            if (tonConnectUI.connected) {
                // Отправляем транзакцию через TonConnect
                console.log('Sending transaction via TonConnect...');
                await tonConnectUI.sendTransaction({
                    validUntil: Date.now() + 5 * 60 * 1000, // 5 минут
                    messages: [
                        {
                            address: data.contractAddress,
                            amount: data.amount,
                            payload: data.encryptedPayload
                        }
                    ]
                });
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
            }

            alert('Транзакция успешно подготовлена!');
            setTargetAddress('');
            setAmount('');
            setError('');
            setCommissionInfo(null);
        } catch (err) {
            console.error('Ошибка:', err);
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