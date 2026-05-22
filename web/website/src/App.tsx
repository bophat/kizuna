import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
import { AnimatedRoutes } from '@/components/layout/AnimatedRoutes';
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
          <AnimatedRoutes />
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
