import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { ExchangeRatesProvider } from './context/ExchangeRatesContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExchangeRatesProvider>
      <App />
    </ExchangeRatesProvider>
  </StrictMode>,
);
