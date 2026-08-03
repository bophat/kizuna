import { lazy, Suspense, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatedPage } from './AnimatedPage';

const HomePage = lazy(() => import('@/pages/Home').then((module) => ({ default: module.HomePage })));
const CartPage = lazy(() => import('@/pages/Cart').then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import('@/pages/Checkout').then((module) => ({ default: module.CheckoutPage })));
const NotificationsPage = lazy(() => import('@/pages/Notifications').then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import('@/pages/Profile').then((module) => ({ default: module.ProfilePage })));
const LoginPage = lazy(() => import('@/pages/Login').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/Register').then((module) => ({ default: module.RegisterPage })));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmail').then((module) => ({ default: module.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword').then((module) => ({ default: module.ResetPasswordPage })));
const CollectionPage = lazy(() => import('@/pages/Collection').then((module) => ({ default: module.CollectionPage })));
const ConciergePage = lazy(() => import('@/pages/Concierge').then((module) => ({ default: module.ConciergePage })));
const WishlistPage = lazy(() => import('@/pages/Wishlist').then((module) => ({ default: module.WishlistPage })));
const ProductDetail = lazy(() => import('@/pages/ProductDetail').then((module) => ({ default: module.ProductDetail })));
const StaticPage = lazy(() => import('@/pages/StaticPage').then((module) => ({ default: module.StaticPage })));
const ContactPage = lazy(() => import('@/pages/Contact').then((module) => ({ default: module.ContactPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFound').then((module) => ({ default: module.NotFoundPage })));

function wrap(page: ReactNode) {
  return <AnimatedPage>{page}</AnimatedPage>;
}

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense
      fallback={(
        <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <div key={location.pathname} className="contents">
          <Routes location={location}>
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
            <Route path="/verify-email" element={wrap(<VerifyEmailPage />)} />
            <Route path="/forgot-password" element={wrap(<ForgotPasswordPage />)} />
            <Route path="/reset-password" element={wrap(<ResetPasswordPage />)} />
            <Route path="/concierge" element={wrap(<ConciergePage />)} />
            <Route path="/chinh-sach-bao-mat" element={wrap(<StaticPage slug="privacy-policy" />)} />
            <Route path="/dieu-khoan-dich-vu" element={wrap(<StaticPage slug="terms-of-service" />)} />
            <Route path="/giao-hang-va-tra-hang" element={wrap(<StaticPage slug="shipping-returns" />)} />
            <Route path="/lien-he" element={wrap(<ContactPage />)} />
            <Route path="*" element={wrap(<NotFoundPage />)} />
          </Routes>
        </div>
      </AnimatePresence>
    </Suspense>
  );
}
