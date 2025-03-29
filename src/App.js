import React, { useState } from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';
import './App.css';

function App() {
  const [targetWallet, setTargetWallet] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          to: targetWallet, 
          amount: parseFloat(amount) 
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Ошибка при создании транзакции');
      }
      
      const data = await response.json();
      console.log('Transaction response:', data);
      alert('Транзакция успешно подготовлена');
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Maze - TON Transaction Router</h1>
        <TonConnectButton />
      </header>
      <main>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="targetWallet">Целевой кошелек:</label>
            <input
              type="text"
              id="targetWallet"
              value={targetWallet}
              onChange={(e) => setTargetWallet(e.target.value)}
              placeholder="Введите адрес кошелька"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="amount">Сумма (TON):</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Введите сумму"
              required
              min="0.01"
              step="0.000000001"
            />
          </div>
          <button type="submit">Отправить транзакцию</button>
        </form>
      </main>
    </div>
  );
}

export default App; 