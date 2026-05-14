import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WishlistProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </WishlistProvider>
  </StrictMode>,
);
