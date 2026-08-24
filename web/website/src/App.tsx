import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
import { AnimatedRoutes } from '@/components/layout/AnimatedRoutes';
import { ConciergeFAB } from '@/components/home/ConciergeFAB';
import { GlobalToaster } from '@izuna/shared/components/GlobalToaster';
import { useEffect } from 'react';
import { captureAffiliateFromUrl } from '@/lib/affiliate';
import { trackPageView } from '@/lib/analytics';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    // setTimeout(0): đợi react-helmet-async commit xong document.title của trang mới
    // trước khi đọc, vì effect này chạy trước effect cập nhật <title> (thứ tự JSX).
    const id = window.setTimeout(() => {
      trackPageView(`${location.pathname}${location.search}`, document.title);
    }, 0);
    return () => window.clearTimeout(id);
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <AffiliateTracker />
      <AnalyticsTracker />
      <GlobalToaster />
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

function AffiliateTracker() {
  const location = useLocation();
  useEffect(() => {
    void captureAffiliateFromUrl(
      location.search,
      `${location.pathname}${location.search}`,
    );
  }, [location.pathname, location.search]);
  return null;
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
