import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getWalletBalance,
  getWalletTransactions,
  depositFunds,
  withdrawFunds,
  BalanceResponse,
  DepositResponse,
  WithdrawResponse,
} from '../services/wallet';

export interface WalletTransaction {
  id: number | string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | string;
  amount?: number;
  amount_usd: number;
  local_amount?: number | null;
  currency?: string;
  exchange_rate?: number | null;
  spread_profit?: number | null;
  status: 'completed' | 'pending' | 'failed' | 'rejected' | string;
  description?: string | null;
  created_at?: string | null;
}

interface WalletState {
  balance: number;
  preferredCurrency: string;
  transactions: WalletTransaction[];
  isLoading: boolean;
  setBalance: (balanceUsd: number, preferredCurrency?: string) => void;
  setPreferredCurrency: (currency: string) => void;
  setTransactions: (txns: WalletTransaction[]) => void;
  addTransaction: (txn: WalletTransaction) => void;
  setLoading: (loading: boolean) => void;
  fetchBalance: () => Promise<BalanceResponse>;
  fetchTransactions: () => Promise<WalletTransaction[]>;
  deposit: (amountLocal: number, currency: string) => Promise<DepositResponse>;
  withdraw: (amountUsd: number, currency?: string) => Promise<WithdrawResponse>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: 0,
      preferredCurrency: 'UGX',
      transactions: [],
      isLoading: false,

      setBalance: (balance, preferredCurrency) =>
        set((state) => ({
          balance: Number.isFinite(balance) ? balance : 0,
          preferredCurrency: preferredCurrency || state.preferredCurrency,
        })),

      setPreferredCurrency: (preferredCurrency) => set({ preferredCurrency }),

      setTransactions: (transactions) => set({ transactions }),

      addTransaction: (txn) =>
        set((state) => ({
          transactions: [
            txn,
            ...state.transactions.filter((existing) => existing.id !== txn.id),
          ].slice(0, 50),
        })),

      setLoading: (isLoading) => set({ isLoading }),

      fetchBalance: async () => {
        set({ isLoading: true });
        try {
          const data = await getWalletBalance();
          set((state) => ({
            balance: Number.isFinite(data.balance_usd) ? data.balance_usd : 0,
            preferredCurrency: data.preferred_currency || state.preferredCurrency,
            isLoading: false,
          }));
          return data;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      fetchTransactions: async () => {
        set({ isLoading: true });
        try {
          const txns = await getWalletTransactions();
          set({ transactions: txns, isLoading: false });
          return txns;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      deposit: async (amountLocal: number, currency: string) => {
        set({ isLoading: true });
        try {
          const res = await depositFunds({
            amount_local: amountLocal,
            currency,
          });
          const newTxn: WalletTransaction = {
            id: res.transaction_id,
            type: 'deposit',
            amount: res.usd_credited,
            amount_usd: res.usd_credited,
            local_amount: res.amount_local,
            currency: res.currency,
            exchange_rate: res.custom_rate,
            spread_profit: res.spread_profit_kept,
            status: res.status || 'completed',
            description: `Deposited ${res.amount_local} ${res.currency} → $${res.usd_credited.toFixed(2)} USD`,
            created_at: new Date().toISOString(),
          };
          set((state) => ({
            balance: res.balance_usd,
            preferredCurrency: res.currency || state.preferredCurrency,
            transactions: [
              newTxn,
              ...state.transactions.filter((t) => t.id !== newTxn.id),
            ].slice(0, 50),
            isLoading: false,
          }));
          return res;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      withdraw: async (amountUsd: number, currency?: string) => {
        set({ isLoading: true });
        const targetCurrency = currency || get().preferredCurrency || 'UGX';
        try {
          const res = await withdrawFunds({
            amount_usd: amountUsd,
            currency: targetCurrency,
          });
          const newTxn: WalletTransaction = {
            id: res.transaction_id,
            type: 'withdrawal',
            amount: res.amount_usd,
            amount_usd: res.amount_usd,
            local_amount: res.payout_local,
            currency: res.currency,
            exchange_rate: res.custom_rate,
            spread_profit: res.spread_profit_captured,
            status: res.status || 'completed',
            description: `Withdrawal $${res.amount_usd.toFixed(2)} USD → ${res.payout_local} ${res.currency}`,
            created_at: new Date().toISOString(),
          };
          set((state) => ({
            balance: res.balance_usd,
            transactions: [
              newTxn,
              ...state.transactions.filter((t) => t.id !== newTxn.id),
            ].slice(0, 50),
            isLoading: false,
          }));
          return res;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },
    }),
    {
      name: 'junglebet-wallet-storage',
    }
  )
);
