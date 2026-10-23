import { FINANCIAL_LIMITS } from './constants';
import { calculateDepositUsdPreview } from './formatCurrency';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates login credentials form
 */
export function validateLoginForm(username: string, password: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!username || username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.';
  }
  if (!password || password.length < 4) {
    errors.password = 'Password must be at least 4 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates registration form (username, email, password, confirmPassword)
 */
export function validateRegisterForm(data: {
  username: string;
  email?: string;
  password: string;
  confirmPassword?: string;
  preferredCurrency?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.username || data.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.';
  } else if (!/^[a-zA-Z0-9_.-]+$/.test(data.username.trim())) {
    errors.username = 'Username may only contain letters, numbers, dots, hyphens, or underscores.';
  }

  if (data.email !== undefined) {
    const trimmedEmail = data.email.trim();
    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }
  }

  if (!data.password || data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates deposit form against backend minimum USD equivalent ($2.00)
 */
export function validateDepositForm(amountLocal: number, currency: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!Number.isFinite(amountLocal) || amountLocal <= 0) {
    errors.amount = 'Please enter a valid deposit amount greater than 0.';
  } else {
    const { creditedUsd } = calculateDepositUsdPreview(amountLocal, currency);
    if (creditedUsd < FINANCIAL_LIMITS.MIN_DEPOSIT_USD) {
      errors.amount = `Minimum deposit is $${FINANCIAL_LIMITS.MIN_DEPOSIT_USD.toFixed(
        2
      )} USD equivalent (current credit: $${creditedUsd.toFixed(2)} USD).`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates withdrawal form against backend minimum USD ($5.00) and user balance
 */
export function validateWithdrawForm(
  amountUsd: number,
  availableBalanceUsd: number
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    errors.amount = 'Please enter a valid withdrawal amount greater than 0.';
  } else if (amountUsd < FINANCIAL_LIMITS.MIN_WITHDRAWAL_USD) {
    errors.amount = `Minimum withdrawal is $${FINANCIAL_LIMITS.MIN_WITHDRAWAL_USD.toFixed(2)} USD.`;
  } else if (amountUsd > availableBalanceUsd) {
    errors.amount = `Insufficient balance. Available: $${availableBalanceUsd.toFixed(2)} USD.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates bet slip wager stake
 */
export function validateBetForm(stakeUsd: number, availableBalanceUsd: number): ValidationResult {
  const errors: Record<string, string> = {};

  if (!Number.isFinite(stakeUsd) || stakeUsd < FINANCIAL_LIMITS.MIN_BET_USD) {
    errors.stake = `Minimum wager is $${FINANCIAL_LIMITS.MIN_BET_USD.toFixed(2)} USD.`;
  } else if (stakeUsd > FINANCIAL_LIMITS.MAX_BET_USD) {
    errors.stake = `Maximum single wager is $${FINANCIAL_LIMITS.MAX_BET_USD.toLocaleString()} USD.`;
  } else if (stakeUsd > availableBalanceUsd) {
    errors.stake = 'Insufficient USD balance for this wager. Please deposit funds first.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
