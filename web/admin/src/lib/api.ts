const API_BASE_URL = 'http://127.0.0.1:8000/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // If the endpoint doesn't start with /admin or /login or /register, 
  // and it's not a full URL, we prefix with /admin
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (!path.startsWith('/admin') && !path.startsWith('/login') && !path.startsWith('/register') && !path.startsWith('/me')) {
    path = `/admin${path}`;
  }

  const url = `${API_BASE_URL}${path}`;
  
  const headers: any = {
    ...(options.headers || {}),
  };

  // Only set default Content-Type if it's not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = localStorage.getItem('access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

