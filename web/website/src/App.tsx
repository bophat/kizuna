import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
import { HomePage } from '@/pages/Home';
import { CartPage } from '@/pages/Cart';
import { CheckoutPage } from '@/pages/Checkout';
import { NotificationsPage } from '@/pages/Notifications';
import { OrderHistoryPage } from '@/pages/OrderHistory';
import { ProfilePage } from '@/pages/Profile';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { CollectionPage } from '@/pages/Collection';
import { ConciergePage } from '@/pages/Concierge';
import { WishlistPage } from '@/pages/Wishlist';
import { ProductDetail } from '@/pages/ProductDetail';
import { ConciergeFAB } from '@/components/home/ConciergeFAB';
import { useEffect } from 'react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col font-sans selection:bg-secondary/10 selection:text-secondary">
        <ConditionalHeader />
        <ConditionalMobileNav />
        <main className="flex-1 pt-20 pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/collections" element={<CollectionPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/order-history" element={<ProfilePage />} />
            <Route path="/account" element={<ProfilePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/concierge" element={<ConciergePage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <ConditionalConciergeFAB />
        <ConditionalFooter />
      </div>
    </Router>
  );
}

function ConditionalHeader() {
  return <Header />;
}

function ConditionalMobileNav() {
  const location = useLocation();
  const hideNavOn = ['/login', '/register', '/checkout'];
  if (hideNavOn.includes(location.pathname)) return null;
  return <MobileNav />;
}

function ConditionalConciergeFAB() {
  const location = useLocation();
  const hideOn = ['/login', '/register', '/concierge', '/checkout'];
  if (hideOn.includes(location.pathname)) return null;
  return <ConciergeFAB />;
}

function ConditionalFooter() {
  const location = useLocation();
  const hideFooterOn = ['/checkout', '/login', '/register'];
  if (hideFooterOn.includes(location.pathname)) return null;
  return <Footer />;
}
