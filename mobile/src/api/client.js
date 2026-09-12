import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_SERVER_URL = '@finances_server_url';
const STORAGE_KEY_AUTH_TOKEN = '@finances_auth_token';

// Live GCP Production VM Host
const DEFAULT_HOST = 'http://35.253.57.89:4173';

let currentServerUrl = DEFAULT_HOST;
let currentAuthToken = null;
let isInitialized = false;

export const initApiClient = async () => {
  if (isInitialized) return { serverUrl: currentServerUrl, authToken: currentAuthToken };
  try {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
    if (savedUrl && savedUrl.trim().length > 0) {
      currentServerUrl = savedUrl.trim().replace(/\/+$/, '');
    }
    const savedToken = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
    if (savedToken) {
      currentAuthToken = savedToken;
    }
  } catch (err) {
    console.warn('[API Client Init Error]:', err);
  }
  isInitialized = true;
  return { serverUrl: currentServerUrl, authToken: currentAuthToken };
};

export const getServerUrl = () => currentServerUrl;

export const setServerUrl = async (url) => {
  const sanitized = (url || '').trim().replace(/\/+$/, '');
  currentServerUrl = sanitized || DEFAULT_HOST;
  await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, currentServerUrl);
  return currentServerUrl;
};

export const getSessionToken = () => currentAuthToken;

export const setSessionToken = async (token) => {
  currentAuthToken = token;
  if (token) {
    await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
  }
};

const request = async (path, options = {}) => {
  await initApiClient();
  const url = `${currentServerUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Check server URL and network.');
    }
    throw err;
  }
};

export const api = {
  // Health & Ping
  getHealth: () => request('/api/health', { timeout: 6000 }),

  // Auth
  login: async (password) => {
    const res = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (res.token) {
      await setSessionToken(res.token);
    }
    return res;
  },

  logout: async () => {
    await setSessionToken(null);
  },

  // Transactions
  getTransactions: () => request('/api/transactions'),
  getTransactionDetail: (id) => request(`/api/transactions/${encodeURIComponent(id)}`),
  setCategory: (transactionId, category) =>
    request('/api/category', {
      method: 'POST',
      body: JSON.stringify({ transactionId, category }),
    }),
  setAcknowledged: (transactionId, acknowledged = true) =>
    request('/api/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ transactionId, acknowledged }),
    }),
  retryReview: (transactionId) =>
    request('/api/retry-review', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    }),
  deleteTransaction: (transactionId) =>
    request('/api/delete-transaction', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    }),

  // Split & Friends
  getUnsplit: () => request('/api/unsplit'),
  getCategories: () => request('/api/categories'),
  getFriends: () => request('/api/friends'),
  getLedger: () => request('/api/ledger'),
  splitTransaction: (transactionId, friends, customShares = null) =>
    request('/api/split', {
      method: 'POST',
      body: JSON.stringify({ transactionId, friends, customShares }),
    }),
  markPersonal: (transactionId) =>
    request('/api/personal', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    }),
  settleFriend: (friendName, amount) =>
    request('/api/settle', {
      method: 'POST',
      body: JSON.stringify({ friendName, amount }),
    }),

  // Trigger sync / fetch
  refreshServer: () =>
    request('/api/refresh', {
      method: 'POST',
      timeout: 65000,
    }),
};
