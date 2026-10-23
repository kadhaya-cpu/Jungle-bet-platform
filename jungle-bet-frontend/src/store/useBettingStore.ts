import { create } from 'zustand';
import { OPTICAL_MARKETS, MarketOption } from '../utils/constants';

export interface CameraFeedGame {
  id: number;
  name: string;
  location: string;
  rtsp_url: string;
  country_code: string;
  status: string;
  lane_mask?: { coordinates?: number[][] } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BetRecord {
  id: number;
  type: string;
  criteria: {
    feed_id?: number;
    market_key?: string;
    target_count?: number;
    operator?: string;
    odds?: number;
    duration_seconds?: number;
    [key: string]: unknown;
  };
  amount: number;
  status: 'pending' | 'won' | 'lost' | 'void' | string;
  resolution_data?: {
    actual_count?: number;
    payout?: number;
    won?: boolean;
    [key: string]: unknown;
  } | null;
  created_at?: string | null;
  resolved_at?: string | null;
}

export interface SelectedBetSlipItem {
  feedId: number;
  feedName: string;
  location: string;
  market: MarketOption;
  stakeUsd: number;
}

interface BettingState {
  games: CameraFeedGame[];
  selectedFeedId: number;
  selectedMarketKey: MarketOption['key'];
  activeBets: BetRecord[];
  history: BetRecord[];
  odds: Record<MarketOption['key'], number>;
  liveVehicleCount: number;
  lastVehicleCrossingX: number | null;
  wsConnected: boolean;
  betSlip: SelectedBetSlipItem | null;
  setGames: (games: CameraFeedGame[]) => void;
  setSelectedFeedId: (feedId: number) => void;
  setSelectedMarketKey: (key: MarketOption['key']) => void;
  setHistory: (bets: BetRecord[]) => void;
  addPlacedBet: (bet: BetRecord) => void;
  setLiveTelemetry: (count: number, crossingX?: number | null) => void;
  setWsConnected: (connected: boolean) => void;
  setBetSlip: (item: SelectedBetSlipItem | null) => void;
  updateStake: (stakeUsd: number) => void;
}

const defaultOdds = OPTICAL_MARKETS.reduce(
  (acc, m) => {
    acc[m.key] = m.odds;
    return acc;
  },
  {} as Record<MarketOption['key'], number>
);

export const useBettingStore = create<BettingState>((set) => ({
  games: [],
  selectedFeedId: 1,
  selectedMarketKey: 'over_13',
  activeBets: [],
  history: [],
  odds: defaultOdds,
  liveVehicleCount: 0,
  lastVehicleCrossingX: null,
  wsConnected: false,
  betSlip: {
    feedId: 1,
    feedName: 'Caltrans I-405 Culver Overpass',
    location: 'Los Angeles - I-405',
    market: OPTICAL_MARKETS[1],
    stakeUsd: 10,
  },

  setGames: (games) =>
    set((state) => {
      const firstActive = games.find((g) => g.id === state.selectedFeedId) || games[0];
      const market =
        OPTICAL_MARKETS.find((m) => m.key === state.selectedMarketKey) || OPTICAL_MARKETS[1];
      return {
        games,
        selectedFeedId: firstActive ? firstActive.id : state.selectedFeedId,
        betSlip: firstActive
          ? {
              feedId: firstActive.id,
              feedName: firstActive.name,
              location: firstActive.location,
              market,
              stakeUsd: state.betSlip?.stakeUsd || 10,
            }
          : state.betSlip,
      };
    }),

  setSelectedFeedId: (feedId) =>
    set((state) => {
      const feed = state.games.find((g) => g.id === feedId);
      const market =
        OPTICAL_MARKETS.find((m) => m.key === state.selectedMarketKey) || OPTICAL_MARKETS[1];
      return {
        selectedFeedId: feedId,
        betSlip: {
          feedId,
          feedName: feed?.name || `Camera Feed #${feedId}`,
          location: feed?.location || 'Live Optical Junction',
          market,
          stakeUsd: state.betSlip?.stakeUsd || 10,
        },
      };
    }),

  setSelectedMarketKey: (key) =>
    set((state) => {
      const market = OPTICAL_MARKETS.find((m) => m.key === key) || OPTICAL_MARKETS[0];
      const feed = state.games.find((g) => g.id === state.selectedFeedId);
      return {
        selectedMarketKey: key,
        betSlip: {
          feedId: state.selectedFeedId,
          feedName: feed?.name || state.betSlip?.feedName || `Camera Feed #${state.selectedFeedId}`,
          location: feed?.location || state.betSlip?.location || 'Live Optical Junction',
          market,
          stakeUsd: state.betSlip?.stakeUsd || 10,
        },
      };
    }),

  setHistory: (bets) =>
    set({
      history: bets,
      activeBets: bets.filter((b) => b.status === 'pending'),
    }),

  addPlacedBet: (bet) =>
    set((state) => {
      const nextHistory = [bet, ...state.history];
      return {
        history: nextHistory,
        activeBets: nextHistory.filter((b) => b.status === 'pending'),
      };
    }),

  setLiveTelemetry: (count, crossingX = null) =>
    set({
      liveVehicleCount: count,
      lastVehicleCrossingX: crossingX,
    }),

  setWsConnected: (wsConnected) => set({ wsConnected }),

  setBetSlip: (betSlip) => set({ betSlip }),

  updateStake: (stakeUsd) =>
    set((state) => ({
      betSlip: state.betSlip ? { ...state.betSlip, stakeUsd } : null,
    })),
}));
