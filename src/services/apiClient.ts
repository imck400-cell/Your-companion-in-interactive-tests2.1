import axios from 'axios';

let rawBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

// Ensure the baseURL ends with /api (fixes 404 errors if VITE_API_BASE_URL is set to just the domain)
if (rawBaseUrl && !rawBaseUrl.endsWith('/api') && !rawBaseUrl.endsWith('/api/')) {
  rawBaseUrl = rawBaseUrl.replace(/\/$/, '') + '/api';
}

// Create central Axios instance for Laravel Sanctum API
export const apiClient = axios.create({
  baseURL: rawBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach Sanctum Bearer Token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sanctum_token') || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch 401 Unauthorized to trigger automatic logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request (401). Clearing session token...');
      localStorage.removeItem('sanctum_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('interactive_quiz_teacher_profile');
      // Dispatch custom auth error event for React components to respond
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
