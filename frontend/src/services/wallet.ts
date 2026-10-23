import api from './api';
import { API_ENDPOINTS } from '../utils/constants';
import { WalletTransaction } from '../store/useWalletStore';

export interface BalanceResponse {
  id?: number;
  username: string;
  balance_usd: number;
  v_coins: number;
  preferred_currency: string;
  is_flagged?: boolean;
  flag_reason?: string | null;
  is_banned?: boolean;
}

export interface DepositPayload {
  amount_local: number;
  currency: string;
  user_id?: number;
}

export interface DepositResponse {
  message: string;
  status: string;
  type: string;
  currency: string;
  local_in: number;
  amount_local: number;
  market_rate: number;
  custom_rate: number;
  spread_diff: number;
  real_usd: number;
  profit_to_keep: number;
  usd_credited: number;
  user_credit_usd: number;
  spread_profit_kept: number;
  balance_usd: number;
  transaction_id: number;
}

export interface WithdrawPayload {
  amount_usd: number;
  currency: string;
  user_id?: number;
}

export interface WithdrawResponse {
  message: string;
  status: string;
  type: string;
  amount_usd: number;
  currency: string;
  market_rate: number;
  custom_rate: number;
  local_currency_amount: number;
  payout_local: number;
  spread_profit_captured: number;
  spread_profit_local: number;
  balance_usd: number;
  transaction_id: number;
}

/**
 * Fetch user USD balance & preferred currency from GET /me/balance
 */
export async function getWalletBalance(): Promise<BalanceResponse> {
  const { data } = await api.get<BalanceResponse>(API_ENDPOINTS.WALLET.BALANCE);
  return data;
}

/**
 * Execute deposit via POST /deposit
 */
export async function depositFunds(payload: DepositPayload): Promise<DepositResponse> {
  const { data } = await api.post<DepositResponse>(API_ENDPOINTS.WALLET.DEPOSIT, payload);
  return data;
}

/**
 * Execute withdrawal via POST /withdraw
 */
export async function withdrawFunds(payload: WithdrawPayload): Promise<WithdrawResponse> {
  const { data } = await api.post<WithdrawResponse>(API_ENDPOINTS.WALLET.WITHDRAW, payload);
  return data;
}

/**
 * Fetch recent wallet transactions from GET /transactions
 */
export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  const { data } = await api.get<WalletTransaction[]>(API_ENDPOINTS.WALLET.TRANSACTIONS);
  return Array.isArray(data) ? data : [];
}
