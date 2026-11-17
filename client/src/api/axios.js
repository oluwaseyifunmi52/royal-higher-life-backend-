import axios from 'axios';

const API_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api');

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isNetworkError = !error.response;
    const isConnectionRefused = error.message.includes('ECONNREFUSED');
    const isTimeout = error.message.includes('timeout');
    const isCorsError = isNetworkError && !isConnectionRefused && !isTimeout;
    const status = error.response?.status;
    let reason = '';
    if (isCorsError) reason = 'CORS error - check Vite proxy and backend CORS config';
    else if (isConnectionRefused) reason = 'Connection refused - backend may not be running';
    else if (isTimeout) reason = 'Request timed out';
    else if (status === 401) reason = 'Unauthorized - wrong credentials or token expired';
    else if (status === 403) reason = 'Forbidden - insufficient permissions';
    else if (status === 404) reason = 'Not found - API route may be missing';
    else if (status === 500) reason = 'Server error - backend exception';
    else if (status) reason = `HTTP ${status}`;
    else reason = error.message;

    console.error('API Error:', reason, '|', error.message, error.code, `status=${status}`);
    if (isNetworkError) {
      console.error('Connection error - backend may not be running or CORS/proxy misconfigured');
    }
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;