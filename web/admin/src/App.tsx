/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Users from './pages/Users';
import Staff from './pages/Staff';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { apiFetch } from './lib/api';
import { Loader2 } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiFetch('/me/');
        if (response.ok) {
          const userData = await response.json();
          if (userData.is_staff || userData.is_superuser) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            localStorage.clear();
          }
        } else {
          setIsAuthenticated(false);
          localStorage.clear();
        }
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-paper flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">Authenticating with KIZUNA systems...</p>
      </div>
    );
  }

  return (
    <Router>
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
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
