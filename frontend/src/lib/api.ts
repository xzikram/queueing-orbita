import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : 'http://localhost:3001/api');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('orbita_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/kiosk') && !path.startsWith('/display')) {
        localStorage.removeItem('orbita_token');
        localStorage.removeItem('orbita_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
