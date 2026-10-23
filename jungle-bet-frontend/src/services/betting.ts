import api from './api';
import { API_ENDPOINTS } from '../utils/constants';
import { BetRecord, CameraFeedGame } from '../store/useBettingStore';

export interface PlaceBetPayload {
  bet_type: string;
  criteria: {
    feed_id: number;
    market_key: string;
    target_count: number;
    operator: string;
    odds: number;
    duration_seconds?: number;
    lane_regions?: number[][];
  };
  amount: number;
  feed_id: number;
}

export interface PlaceBetResponse {
  message: string;
  bet_id: number;
  feed_id: number;
  remaining_balance: number;
}

/**
 * Get all live camera feeds / betting games from GET /camera-feeds
 */
export async function getGames(): Promise<CameraFeedGame[]> {
  const { data } = await api.get<CameraFeedGame[]>(API_ENDPOINTS.BETTING.FEEDS);
  return Array.isArray(data) ? data : [];
}

/**
 * Get details of a specific camera feed from GET /camera-feeds/{id}
 */
export async function getGameById(feedId: number | string): Promise<CameraFeedGame> {
  const { data } = await api.get<CameraFeedGame>(API_ENDPOINTS.BETTING.FEED_DETAIL(feedId));
  return data;
}

/**
 * Place a new optical telemetry bet via POST /bet/place
 */
export async function placeBet(payload: PlaceBetPayload): Promise<PlaceBetResponse> {
  const { data } = await api.post<PlaceBetResponse>(API_ENDPOINTS.BETTING.PLACE_BET, payload);
  return data;
}

/**
 * Get bet history & results for current user via GET /bets/history
 */
export async function getBetResults(): Promise<BetRecord[]> {
  const { data } = await api.get<BetRecord[]>(API_ENDPOINTS.BETTING.HISTORY);
  return Array.isArray(data) ? data : [];
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
