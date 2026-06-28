import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Transform datetime strings dari server (UTC tanpa Z) supaya browser parse sebagai UTC
const dateRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/;
function fixDates(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) { obj.forEach(fixDates); return obj; }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && dateRegex.test(val)) {
      obj[key] = val.replace(' ', 'T') + 'Z';
    } else if (typeof val === 'object' && val !== null) {
      fixDates(val);
    }
  }
  return obj;
}

api.interceptors.response.use(res => {
  if (res.data) fixDates(res.data);
  return res;
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (err.response?.status === 403) {
      const code = err.response?.data?.code;
      if (code === 'PAYMENT_PENDING' || code === 'SUBSCRIPTION_EXPIRED') {
        // Dispatch custom event supaya Layout bisa tangkap
        window.dispatchEvent(new CustomEvent('subscription-blocked', { detail: err.response.data }));
      }
    }
    return Promise.reject(err);
  }
);

export default api;
