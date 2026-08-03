/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { apiFetch } from './lib/api';
import { Loader2 } from 'lucide-react';
import { GlobalToaster } from '@izuna/shared/components/GlobalToaster';
import { useTranslation } from 'react-i18next';

const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Orders = lazy(() => import('./pages/Orders'));
const Users = lazy(() => import('./pages/Users'));
const Staff = lazy(() => import('./pages/Staff'));
const Categories = lazy(() => import('./pages/Categories'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Pricing = lazy(() => import('./pages/Pricing').then((module) => ({ default: module.Pricing })));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'));
const AiDiscovery = lazy(() => import('./pages/AiDiscovery'));
const ContentPages = lazy(() => import('./pages/ContentPages'));
const Coupons = lazy(() => import('./pages/Coupons'));

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-brand-paper flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
      <p className="text-sm font-serif italic text-brand-ink/40">{t('common.loading')}</p>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiFetch('/me/');
        if (response.ok) {
          const userData = await response.json();
          setIsAuthenticated(!!(userData.is_staff || userData.is_superuser));
          if (!(userData.is_staff || userData.is_superuser)) {
            await apiFetch('/logout/', { method: 'POST' });
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/staff" element={<Staff />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/approvals" element={<ApprovalQueue />} />
                    <Route path="/ai-discovery" element={<AiDiscovery />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/content-pages" element={<ContentPages />} />
                    <Route path="/coupons" element={<Coupons />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
