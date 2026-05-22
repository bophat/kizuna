import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

function defaultStartDate() {
  return new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
}

function defaultEndDate() {
  return new Date().toISOString().split('T')[0];
}

export function useDashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const response = await apiFetch(`/stats/?start_date=${startDate}&end_date=${endDate}`);
        if (response.ok) setStats(await response.json());
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [startDate, endDate]);

  return { stats, loading, startDate, endDate, setStartDate, setEndDate };
}
