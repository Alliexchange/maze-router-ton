import React, { useEffect } from 'react';
import { TonConnectUIProvider, THEME } from '@tonconnect/ui-react';
import TransferForm from './components/TransferForm';
import './App.css';

// Используем локальный URL для манифеста
const manifestUrl = 'http://localhost:3001/tonconnect-manifest.json';

function App() {
  // Для отладки
  useEffect(() => {
    // Проверяем доступность манифеста
    fetch(manifestUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Manifest not available: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Manifest loaded successfully:', data);
      })
      .catch(error => {
        console.error('Error loading manifest:', error);
      });
  }, []);

  return (
    <TonConnectUIProvider 
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: 'http://localhost:3001',
        skipRedirectToWallet: "always"
      }}
      uiPreferences={{
        theme: THEME.DARK
      }}
      language="ru"
    >
      <div className="App">
        <header className="App-header">
          <h1>Maze Router (Testnet)</h1>
        </header>
        <main>
          <TransferForm />
        </main>
      </div>
    </TonConnectUIProvider>
  );
}

export default App; 