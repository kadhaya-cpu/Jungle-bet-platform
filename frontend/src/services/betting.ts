import api from './api';
import { API_ENDPOINTS } from '../utils/constants';
import { BetRecord, CameraFeedGame } from '../store/useBettingStore';
import { MOCK_GAMES, MOCK_PLACED_BETS } from '../utils/mockData';

export interface PlaceBetPayload {
  gameId?: number;
  bet_type?: string;
  criteria?: {
    feed_id: number;
    market_key: string;
    target_count: number;
    operator: string;
    odds: number;
    duration_seconds?: number;
    lane_regions?: number[][];
  };
  amount: number;
  feed_id?: number;
}

export interface PlaceBetResponse {
  message: string;
  bet_id: number;
  feed_id: number;
  remaining_balance?: number;
}

/**
 * Fetch active betting games / challenges from backend GET /api/games (or GET /camera-feeds).
 * Falls back to MOCK_GAMES in /utils/mockData.ts when backend endpoint does not exist yet.
 */
export async function getGames(): Promise<CameraFeedGame[]> {
  try {
    // =====================================================================
    // SWAP MOCK DATA FOR REAL API LATER:
    // Primary endpoint: GET /api/games
    // =====================================================================
    const { data } = await api.get<CameraFeedGame[]>(API_ENDPOINTS.BETTING.GAMES);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    try {
      const { data } = await api.get<CameraFeedGame[]>(API_ENDPOINTS.BETTING.FEEDS);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fall back to mock European city challenges for demonstration
    }
  }
  return MOCK_GAMES;
}

/**
 * Get details of a specific camera feed from GET /camera-feeds/{id}
 */
export async function getGameById(feedId: number | string): Promise<CameraFeedGame> {
  try {
    const { data } = await api.get<CameraFeedGame>(API_ENDPOINTS.BETTING.FEED_DETAIL(feedId));
    return data;
  } catch {
    return MOCK_GAMES.find((g) => g.id === Number(feedId)) || MOCK_GAMES[0];
  }
}

/**
 * Place a new bet via POST /api/bet (with fallback to POST /bet/place and mock response).
 */
export async function placeBet(payload: PlaceBetPayload): Promise<PlaceBetResponse> {
  const gameId = payload.gameId || payload.feed_id || payload.criteria?.feed_id || 1;
  try {
    // =====================================================================
    // SWAP MOCK DATA FOR REAL API LATER:
    // Primary endpoint: POST /api/bet -> { gameId, amount }
    // =====================================================================
    const { data } = await api.post<PlaceBetResponse>(API_ENDPOINTS.BETTING.BET, {
      ...payload,
      gameId,
      amount: payload.amount,
    });
    return {
      message: data?.message || 'Bet Placed Successfully!',
      bet_id: data?.bet_id || Math.floor(1000 + Math.random() * 9000),
      feed_id: data?.feed_id || gameId,
      remaining_balance: data?.remaining_balance,
    };
  } catch {
    try {
      const { data } = await api.post<PlaceBetResponse>(API_ENDPOINTS.BETTING.PLACE_BET, payload);
      return data;
    } catch {
      // Return simulated confirmation when backend /api/bet is offline
      return {
        message: 'Bet Placed Successfully!',
        bet_id: Math.floor(1000 + Math.random() * 9000),
        feed_id: gameId,
      };
    }
  }
}

/**
 * Get bet history & results for current user via GET /bets/history
 */
export async function getBetResults(): Promise<BetRecord[]> {
  try {
    const { data } = await api.get<BetRecord[]>(API_ENDPOINTS.BETTING.HISTORY);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    // Fall back to mock placed bets when backend is unreachable
  }
  return MOCK_PLACED_BETS;
}

/**
 * Admin: Fetch analytics dashboard data from GET /api/admin/analytics
 */
export async function getAdminAnalytics() {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.ANALYTICS);
  return data;
}

/**
 * Admin: Fetch registered users & flagged accounts from GET /api/admin/users
 */
export async function getAdminUsers() {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.USERS);
  return data;
}

/**
 * Admin: Ban, unban, or unflag a user via POST /api/admin/ban
 */
export async function performAdminUserAction(userId: string, action: 'ban' | 'unban' | 'unflag') {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.BAN_USER, { userId, action });
  return data;
}

/**
 * Admin: Fetch treasury status & 25% safety float from GET /api/finance/treasury
 */
export async function getTreasuryStatus() {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.TREASURY);
  return data;
}

/**
 * Admin: Fetch payout queue from GET /api/admin/payouts
 */
export async function getAdminPayoutQueue() {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.PAYOUTS);
  return Array.isArray(data) ? data : [];
}

/**
 * Admin: Approve or reject a payout item via POST /api/admin/payouts/{id}/action
 */
export async function updatePayoutStatus(id: number | string, action: 'approve' | 'reject') {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.PAYOUT_ACTION(id), { action });
  return data;
}

/**
 * Admin: Trigger treasury profit sweep via POST /api/finance/treasury/sweep
 */
export async function triggerTreasurySweep(amount?: number) {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.TREASURY_SWEEP, {
    amount,
    isManual: true,
  });
  return data;
}

/**
 * Admin: Dispatch Telegram daily summary report / test alert via POST /api/finance/alerts/test
 */
export async function sendTelegramAlertTest(
  alertType: 'HIGH_WIN' | 'PROFIT_TARGET' | 'FRAUD_ALERT' | 'DAILY_SUMMARY' = 'DAILY_SUMMARY'
) {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.TEST_ALERT, { alertType });
  return data;
}
