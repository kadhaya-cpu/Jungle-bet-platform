import { create } from 'zustand';
import axios from 'axios';
import { CITY_FEEDS, CityFeed, getCityFeed } from '@/data/cityFeeds';

const API_URL = 'http://localhost:8000'; // FastAPI Backend

export type SupportedCurrency = 'USD' | 'GBP' | 'UGX' | 'KES' | 'NGN' | 'EUR';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // Units per 1 USD
  decimals: number;
}

export const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rate: 1.0, decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rate: 0.79, decimals: 2 },
  UGX: { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling', flag: '🇺🇬', rate: 3750, decimals: 0 },
  KES: { code: 'KES', symbol: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪', rate: 130, decimals: 0 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬', rate: 1500, decimals: 0 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rate: 0.92, decimals: 2 },
};

export function convertUSDAmount(usdAmount: number, targetCurrency: SupportedCurrency): number {
  const config = CURRENCY_CONFIGS[targetCurrency] || CURRENCY_CONFIGS.USD;
  const converted = usdAmount * config.rate;
  return config.decimals === 0 ? Math.round(converted) : Number(converted.toFixed(config.decimals));
}

export function formatCurrencyAmount(usdAmount: number, targetCurrency: SupportedCurrency): string {
  const config = CURRENCY_CONFIGS[targetCurrency] || CURRENCY_CONFIGS.USD;
  const value = convertUSDAmount(usdAmount, targetCurrency);
  
  if (config.code === 'USD') return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (config.code === 'GBP') return `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (config.code === 'EUR') return `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (config.code === 'NGN') return `₦${value.toLocaleString()}`;
  if (config.code === 'UGX') return `UGX ${value.toLocaleString()}`;
  if (config.code === 'KES') return `KES ${value.toLocaleString()}`;
  
  return `${config.symbol} ${value.toLocaleString()}`;
}

export function detectGeoCurrencyFromContext(userPhone?: string): SupportedCurrency {
  // 1. Detect from user phone prefix if available
  if (userPhone) {
    const cleanPhone = userPhone.replace(/[^\d+]/g, '').trim();
    if (cleanPhone.startsWith('+256') || cleanPhone.startsWith('256')) return 'UGX';
    if (cleanPhone.startsWith('+254') || cleanPhone.startsWith('254')) return 'KES';
    if (cleanPhone.startsWith('+234') || cleanPhone.startsWith('234')) return 'NGN';
    if (cleanPhone.startsWith('+44') || cleanPhone.startsWith('44')) return 'GBP';
    if (cleanPhone.startsWith('+1') || cleanPhone.startsWith('1')) return 'USD';
    if (cleanPhone.startsWith('+31') || cleanPhone.startsWith('+49') || cleanPhone.startsWith('+33')) return 'EUR';
  }

  // 2. Detect from client browser timezone
  if (typeof window !== 'undefined') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
      if (tz.includes('london')) return 'GBP';
      if (tz.includes('kampala')) return 'UGX';
      if (tz.includes('nairobi')) return 'KES';
      if (tz.includes('lagos')) return 'NGN';
      if (tz.includes('amsterdam') || tz.includes('paris') || tz.includes('berlin') || tz.includes('madrid') || tz.includes('rome')) return 'EUR';
      if (tz.includes('america') || tz.includes('new_york') || tz.includes('los_angeles') || tz.includes('chicago')) return 'USD';
    } catch {
      // Fallback
    }

    // 3. Detect from navigator language
    try {
      const lang = (navigator.language || '').toLowerCase();
      if (lang === 'en-gb') return 'GBP';
      if (lang === 'en-us') return 'USD';
      if (lang.startsWith('nl')) return 'EUR';
    } catch {
      // Fallback
    }
  }

  return 'USD';
}

function getInitialCurrency(): SupportedCurrency {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('jungle_currency') as SupportedCurrency | null;
    if (saved && CURRENCY_CONFIGS[saved]) {
      return saved;
    }
    return detectGeoCurrencyFromContext();
  }
  return 'USD';
}

interface UserState {
  token: string | null;
  username: string | null;
  balance: number; // Base balance in USD
  isAuthenticated: boolean;
  currency: SupportedCurrency;
  selectedCity: CityFeed;

  setCurrency: (currency: SupportedCurrency) => void;
  setSelectedCity: (city: CityFeed | string | number) => void;
  detectGeoCurrency: (userPhone?: string) => Promise<SupportedCurrency>;
  formatAmount: (usdAmount: number, targetCurrency?: SupportedCurrency) => string;
  convertAmount: (usdAmount: number, targetCurrency?: SupportedCurrency) => number;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  fetchBalance: () => Promise<void>;
  placeBet: (betType: string, criteria: object, amount: number) => Promise<{ bet_id?: string | number; [key: string]: unknown }>;
  logout: () => void;
}

export const useStore = create<UserState>((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('tr_token') : null,
  username: typeof window !== 'undefined' ? localStorage.getItem('tr_username') : null,
  balance: 100.0,
  isAuthenticated: false,
  currency: getInitialCurrency(),
  selectedCity: CITY_FEEDS[0],

  setSelectedCity: (city) => {
    if (typeof city === 'string' || typeof city === 'number') {
      const found = getCityFeed(city);
      if (found) {
        set({ selectedCity: found });
      }
    } else {
      set({ selectedCity: city });
    }
  },

  setCurrency: (currency: SupportedCurrency) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jungle_currency', currency);
    }
    set({ currency });
  },

  detectGeoCurrency: async (userPhone?: string) => {
    // Check if user has already set a manual currency preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jungle_currency') as SupportedCurrency | null;
      if (saved && CURRENCY_CONFIGS[saved]) {
        set({ currency: saved });
        return saved;
      }
    }

    // 1. First priority: user phone code
    let detected = detectGeoCurrencyFromContext(userPhone);

    // 2. Second priority: Geo IP lookup via API
    try {
      const res = await axios.get('/api/geo', { timeout: 2000 });
      if (res.data?.currency && CURRENCY_CONFIGS[res.data.currency as SupportedCurrency]) {
        detected = res.data.currency as SupportedCurrency;
      }
    } catch {
      // API call failed, keep client-detected currency
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('jungle_currency', detected);
    }
    set({ currency: detected });
    return detected;
  },

  formatAmount: (usdAmount: number, targetCurrency?: SupportedCurrency) => {
    const cur = targetCurrency || get().currency;
    return formatCurrencyAmount(usdAmount, cur);
  },

  convertAmount: (usdAmount: number, targetCurrency?: SupportedCurrency) => {
    const cur = targetCurrency || get().currency;
    return convertUSDAmount(usdAmount, cur);
  },

  login: async (username, password) => {
    try {
      const res = await axios.post(`${API_URL}/login`, { username, password });
      const token = res.data.access_token;

      if (typeof window !== 'undefined') {
        localStorage.setItem('tr_token', token);
        localStorage.setItem('tr_username', username);
      }

      set({ token, username, isAuthenticated: true });
      await get().fetchBalance();
      await get().detectGeoCurrency(username);
    } catch (error) {
      throw error;
    }
  },

  register: async (username, password) => {
    await axios.post(`${API_URL}/register`, { username, password });
    await get().login(username, password);
  },

  fetchBalance: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/me/balance`, { headers: { Authorization: `Bearer ${token}` } });
      set({ balance: res.data.v_coins });
    } catch (error) {
      console.error(error);
    }
  },

  placeBet: async (betType, criteria, amount) => {
    const { token } = get();
    if (!token) throw new Error('Not authenticated');

    const res = await axios.post(
      `${API_URL}/bet/place`,
      { bet_type: betType, criteria, amount },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    set((state) => ({ balance: state.balance - amount }));
    return res.data;
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tr_token');
      localStorage.removeItem('tr_username');
    }
    set({ token: null, username: null, isAuthenticated: false, balance: 100.0 });
  },
}));
