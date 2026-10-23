import { SUPPORTED_CURRENCIES } from './constants';

/**
 * Formats a numeric amount into a currency string.
 * Supports direct formatting or conversion from USD to a target local currency.
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode: string = 'USD',
  options?: {
    convertFromUsd?: boolean;
    useCustomRate?: boolean;
    compact?: boolean;
  }
): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const normalizedCode = (currencyCode || 'USD').toUpperCase();
  const config = SUPPORTED_CURRENCIES[normalizedCode] || SUPPORTED_CURRENCIES.USD;

  let finalAmount = safeAmount;
  if (options?.convertFromUsd && normalizedCode !== 'USD') {
    const rate = options.useCustomRate ? config.customRate : config.marketRate;
    finalAmount = safeAmount * rate;
  }

  const isZeroDecimal = ['UGX', 'KES', 'TZS', 'NGN'].includes(normalizedCode);

  if (options?.compact && Math.abs(finalAmount) >= 1000) {
    return `${config.symbol}${Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(finalAmount)}`;
  }

  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(finalAmount);

  return `${config.symbol}${formattedNumber}`;
}

/**
 * Preview deposit USD credit based on backend Value Reduction FX spread formula:
 * real_usd = amount_local / market_rate
 * user_credit_usd = (amount_local / market_rate) * (custom_rate / market_rate)
 */
export function calculateDepositUsdPreview(amountLocal: number, currencyCode: string = 'UGX') {
  const code = currencyCode.toUpperCase();
  const config = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.USD;
  if (amountLocal <= 0 || config.marketRate <= 0) {
    return {
      realUsd: 0,
      creditedUsd: 0,
      spreadUsd: 0,
      marketRate: config.marketRate,
      customRate: config.customRate,
    };
  }

  const realUsd = amountLocal / config.marketRate;
  const creditedUsd = (amountLocal / config.marketRate) * (config.customRate / config.marketRate);
  const spreadUsd = Math.max(0, realUsd - creditedUsd);

  return {
    realUsd,
    creditedUsd,
    spreadUsd,
    marketRate: config.marketRate,
    customRate: config.customRate,
  };
}

/**
 * Preview local currency payout for a USD withdrawal based on customRate:
 * local_payout = amount_usd * custom_rate
 */
export function calculateWithdrawalLocalPreview(amountUsd: number, currencyCode: string = 'UGX') {
  const code = currencyCode.toUpperCase();
  const config = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.USD;
  if (amountUsd <= 0) {
    return {
      localPayout: 0,
      customRate: config.customRate,
      marketRate: config.marketRate,
      symbol: config.symbol,
    };
  }

  return {
    localPayout: amountUsd * config.customRate,
    customRate: config.customRate,
    marketRate: config.marketRate,
    symbol: config.symbol,
  };
}
