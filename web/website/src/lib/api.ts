const API_BASE_URL = 'http://127.0.0.1:8000/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Add auth token if available, but NOT for login/register/check-email
  const isAuthEndpoint = endpoint.includes('/login/') || 
                         endpoint.includes('/register/') || 
                         endpoint.includes('/check-email/');
  
  const token = localStorage.getItem('access_token');
  if (token && !isAuthEndpoint) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
