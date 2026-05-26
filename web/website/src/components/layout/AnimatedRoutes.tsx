import type { ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatedPage } from './AnimatedPage';
import { HomePage } from '@/pages/Home';
import { CartPage } from '@/pages/Cart';
import { CheckoutPage } from '@/pages/Checkout';
import { NotificationsPage } from '@/pages/Notifications';
import { ProfilePage } from '@/pages/Profile';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { CollectionPage } from '@/pages/Collection';
import { ConciergePage } from '@/pages/Concierge';
import { WishlistPage } from '@/pages/Wishlist';
import { ProductDetail } from '@/pages/ProductDetail';
import { NotFoundPage } from '@/pages/NotFound';

function wrap(page: ReactNode) {
  return <AnimatedPage>{page}</AnimatedPage>;
}

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={wrap(<HomePage />)} />
        <Route path="/collections" element={wrap(<CollectionPage />)} />
        <Route path="/cart" element={wrap(<CartPage />)} />
        <Route path="/checkout" element={wrap(<CheckoutPage />)} />
        <Route path="/notifications" element={wrap(<NotificationsPage />)} />
        <Route path="/order-history" element={wrap(<ProfilePage />)} />
        <Route path="/account" element={wrap(<ProfilePage />)} />
        <Route path="/profile" element={wrap(<ProfilePage />)} />
        <Route path="/wishlist" element={wrap(<WishlistPage />)} />
        <Route path="/product/:id" element={wrap(<ProductDetail />)} />
        <Route path="/login" element={wrap(<LoginPage />)} />
        <Route path="/register" element={wrap(<RegisterPage />)} />
        <Route path="/concierge" element={wrap(<ConciergePage />)} />
        <Route path="*" element={wrap(<NotFoundPage />)} />
      </Routes>
    </AnimatePresence>
  );
}
