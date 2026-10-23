/**
 * RUSH HOUR BET — Global Constants, API Endpoints, Currencies & Market Multipliers
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

/**
 * Modular API Endpoint Registry
 * Swap or extend endpoints in one place without modifying components.
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
    REFRESH: '/auth/refresh',
    PROFILE: '/me/balance',
  },
  WALLET: {
    BALANCE: '/me/balance',
    CURRENCIES: '/api/currencies',
    DEPOSIT: '/deposit',
    WITHDRAW: '/withdraw',
    WITHDRAW_PREVIEW: '/api/withdraw-preview',
    TRANSACTIONS: '/transactions',
  },
  BETTING: {
    CITIES: '/api/cities',
    FEED_MANAGER: '/api/feed-manager',
    FEED_MANAGER_CITY: (city: string) => `/api/feed-manager/${encodeURIComponent(city)}`,
    FEEDS: '/camera-feeds',
    FEED_DETAIL: (id: number | string) => `/camera-feeds/${id}`,
    FEED_STREAM: (id: number | string) => `/camera-feeds/${id}/stream`,
    PLACE_BET: '/bet/place',
    HISTORY: '/bets/history',
    PROCESS_BET: '/api/finance/bet/process',
  },
  ADMIN: {
    USERS: '/api/admin/users',
    FLAGGED_USERS: '/api/admin/flagged',
    BAN_USER: '/api/admin/ban',
    ANALYTICS: '/api/admin/analytics',
    PAYOUTS: '/api/admin/payouts',
    PAYOUT_ACTION: (id: number | string) => `/api/admin/payouts/${id}/action`,
    FEED_OVERRIDE: '/api/feed-manager/override',
    FEED_FAILOVER: '/api/feed-manager/failover',
    FEED_SCAN: '/api/feed-manager/scan',
    TREASURY: '/api/finance/treasury',
    TREASURY_SWEEP: '/api/finance/treasury/sweep',
    TREASURY_FORCE_SWEEP: '/api/finance/treasury/force-sweep',
    TREASURY_AUDIT_LOGS: '/api/finance/treasury/audit-logs',
    METRICS: '/api/finance/metrics',
    ALERTS: '/api/finance/alerts',
    TEST_ALERT: '/api/finance/alerts/test',
    DAILY_SETTLEMENT: '/api/finance/settlement/daily',
    SETTLEMENTS: '/api/finance/settlements',
    FRAUD_ALERTS: '/api/fraud/alerts',
    FRAUD_STREAM: '/api/fraud/stream',
    SIMULATE_FRAUD: '/api/admin/simulate',
  },
  HEALTH: '/health',
} as const;

/**
 * Financial & Betting Thresholds (matching FastAPI backend rules)
 */
export const FINANCIAL_LIMITS = {
  MIN_DEPOSIT_USD: 2.0,
  MIN_WITHDRAWAL_USD: 5.0,
  MIN_BET_USD: 1.0,
  MAX_BET_USD: 5000.0,
  SAFETY_FLOAT_RATIO: 0.25,
  HIGH_WIN_ALERT_USD: 1000.0,
  RAPID_BET_LIMIT_PER_MIN: 10,
} as const;

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  marketRate: number;
  customRate: number;
  locale: string;
}

/**
 * Supported Currencies & FX Conversion Rates
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    marketRate: 1.0,
    customRate: 1.0,
    locale: 'en-US',
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    marketRate: 0.92,
    customRate: 0.89,
    locale: 'de-DE',
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    marketRate: 0.79,
    customRate: 0.76,
    locale: 'en-GB',
  },
  UGX: {
    code: 'UGX',
    name: 'Uganda Shilling',
    symbol: 'USh',
    marketRate: 4040.0,
    customRate: 3800.0,
    locale: 'en-UG',
  },
  KES: {
    code: 'KES',
    name: 'Kenya Shilling',
    symbol: 'KSh',
    marketRate: 130.0,
    customRate: 120.0,
    locale: 'en-KE',
  },
  TZS: {
    code: 'TZS',
    name: 'Tanzania Shilling',
    symbol: 'TSh',
    marketRate: 2600.0,
    customRate: 2400.0,
    locale: 'en-TZ',
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    marketRate: 1500.0,
    customRate: 1420.0,
    locale: 'en-NG',
  },
};

export interface MarketOption {
  key: 'under_10' | 'over_13' | 'star_pick' | 'exact_20';
  label: string;
  shortLabel: string;
  description: string;
  odds: number;
  targetCount: number;
  operator: 'under' | 'over' | 'exact';
  badge?: string;
}

/**
 * Core Optical Prediction Markets & Multipliers
 */
export const OPTICAL_MARKETS: MarketOption[] = [
  {
    key: 'under_10',
    label: 'UNDER 10 VEHICLES',
    shortLabel: 'Under 10',
    description: 'Fewer than 10 vehicles cross the optical trigger line in 30s',
    odds: 2.25,
    targetCount: 10,
    operator: 'under',
    badge: 'STEADY',
  },
  {
    key: 'over_13',
    label: 'OVER 13 VEHICLES',
    shortLabel: 'Over 13',
    description: '14 or more vehicles cross the optical trigger line in 30s',
    odds: 3.6,
    targetCount: 13,
    operator: 'over',
    badge: 'HOT',
  },
  {
    key: 'star_pick',
    label: 'STAR PICK (EXACT 7)',
    shortLabel: 'Exact 7',
    description: 'Precision jackpot: exactly 7 vehicles cross the optical line',
    odds: 18.0,
    targetCount: 7,
    operator: 'exact',
    badge: 'JACKPOT',
  },
  {
    key: 'exact_20',
    label: 'EXACT HIGH (EXACT 20)',
    shortLabel: 'Exact 20',
    description: 'Mega precision jackpot: exactly 20 vehicles cross the line',
    odds: 36.0,
    targetCount: 20,
    operator: 'exact',
    badge: 'MEGA 36X',
  },
];

/**
 * Multi-language i18n dictionary hook ready for expansion
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const I18N_TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    nav_home: 'Arena',
    nav_betting: 'Live Markets',
    nav_wallet: 'Vault & Wallet',
    nav_profile: 'Racer Profile',
    nav_admin: 'Command Center',
    cta_place_bet: 'Lock In Wager',
    leo_fraud_banner: 'Leo AI Security Notice: Your account is currently flagged for high-frequency review.',
  },
  fr: {
    nav_home: 'Arène',
    nav_betting: 'Marchés en Direct',
    nav_wallet: 'Portefeuille',
    nav_profile: 'Profil',
    nav_admin: 'Administration',
    cta_place_bet: 'Placer le Pari',
    leo_fraud_banner: 'Alerte Leo AI : Votre compte fait l’objet d’une vérification de sécurité.',
  },
  es: {
    nav_home: 'Arena',
    nav_betting: 'Mercados en Vivo',
    nav_wallet: 'Billetera',
    nav_profile: 'Perfil',
    nav_admin: 'Administración',
    cta_place_bet: 'Confirmar Apuesta',
    leo_fraud_banner: 'Aviso de Leo AI: Su cuenta está marcada para revisión de seguridad.',
  },
  sw: {
    nav_home: 'Uwanja',
    nav_betting: 'Masoko Mubashara',
    nav_wallet: 'Pochi',
    nav_profile: 'Wasifu',
    nav_admin: 'Utawala',
    cta_place_bet: 'Weka Dau',
    leo_fraud_banner: 'Ilani ya Leo AI: Akaunti yako inakaguliwa kwa usalama.',
  },
};
