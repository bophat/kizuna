import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import './i18n';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { ExchangeRatesProvider } from './context/ExchangeRatesContext';
import { MotionProvider } from './components/MotionProvider';
import { initGA } from './lib/analytics';

initGA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <MotionProvider>
        <ExchangeRatesProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </ExchangeRatesProvider>
      </MotionProvider>
    </HelmetProvider>
  </StrictMode>,
);
