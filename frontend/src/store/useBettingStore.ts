import { create } from 'zustand';
import api from '../services/api';
import { API_ENDPOINTS, OPTICAL_MARKETS, MarketOption } from '../utils/constants';
import { CityData, EUROPE_CITIES, getCityById } from '../utils/cityData';
import { MOCK_GAMES, MOCK_PLACED_BETS } from '../utils/mockData';

export interface CameraFeedGame {
  id: number;
  cityId?: string;
  name: string;
  cityName?: string;
  country?: string;
  flagEmoji?: string;
  location: string;
  rtsp_url: string;
  youtubeLiveUrl?: string;
  youtubeChannelId?: string;
  thumbnailUrl?: string;
  odds?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  timeRemainingSeconds?: number;
  challengeTitle?: string;
  viewerCount?: number;
  country_code: string;
  status: string;
  lane_mask?: { coordinates?: number[][] } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BetRecord {
  id: number;
  gameId?: number;
  cityName?: string;
  flagEmoji?: string;
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
  odds?: number;
  potentialWin?: number;
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
  cityName?: string;
  flagEmoji?: string;
  odds?: number;
  market: MarketOption;
  stakeUsd: number;
}

interface BettingState {
  // Core requested state
  selectedCity: CityData;
  activeGames: CameraFeedGame[];
  placedBets: BetRecord[];
  currentOdds: number;
  isLoadingGames: boolean;
  isPlacingBet: boolean;
  isBetModalOpen: boolean;

  // Backward-compatible state for existing pages/components
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

  // Core requested actions
  selectCity: (cityOrId: CityData | string) => void;
  placeBet: (gameId: number, amount: number, customOdds?: number) => Promise<BetRecord>;
  fetchGames: () => Promise<CameraFeedGame[]>;
  updateOdds: (customMultiplier?: number) => void;
  openBetModal: (game?: CameraFeedGame) => void;
  closeBetModal: () => void;

  // Backward-compatible actions
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

const initialCity = EUROPE_CITIES[0];
const initialGame = MOCK_GAMES[0];

export const useBettingStore = create<BettingState>((set, get) => ({
  selectedCity: initialCity,
  activeGames: MOCK_GAMES,
  placedBets: MOCK_PLACED_BETS,
  currentOdds: initialGame?.odds || 2.5,
  isLoadingGames: false,
  isPlacingBet: false,
  isBetModalOpen: false,

  games: MOCK_GAMES,
  selectedFeedId: initialCity.feedId,
  selectedMarketKey: 'over_13',
  activeBets: MOCK_PLACED_BETS.filter((b) => b.status === 'pending'),
  history: MOCK_PLACED_BETS,
  odds: defaultOdds,
  liveVehicleCount: 14,
  lastVehicleCrossingX: null,
  wsConnected: false,
  betSlip: {
    feedId: initialGame.id,
    feedName: initialGame.name,
    location: initialGame.location,
    cityName: initialCity.name,
    flagEmoji: initialCity.flagEmoji,
    odds: initialGame.odds || 2.5,
    market: OPTICAL_MARKETS[1],
    stakeUsd: 10,
  },

  selectCity: (cityOrId) =>
    set((state) => {
      const resolvedCity =
        typeof cityOrId === 'string'
          ? getCityById(cityOrId) || state.selectedCity
          : cityOrId;

      const matchingGame =
        state.activeGames.find(
          (g) =>
            g.cityId?.toLowerCase() === resolvedCity.id.toLowerCase() ||
            g.cityName?.toLowerCase() === resolvedCity.name.toLowerCase() ||
            g.id === resolvedCity.feedId ||
            g.country_code?.toLowerCase() === resolvedCity.countryCode.toLowerCase()
        ) || state.activeGames[0];

      const market =
        OPTICAL_MARKETS.find((m) => m.key === state.selectedMarketKey) || OPTICAL_MARKETS[1];
      const nextOdds = matchingGame?.odds || state.currentOdds || market.odds;

      return {
        selectedCity: resolvedCity,
        selectedFeedId: matchingGame ? matchingGame.id : resolvedCity.feedId,
        currentOdds: nextOdds,
        betSlip: {
          feedId: matchingGame ? matchingGame.id : resolvedCity.feedId,
          feedName: matchingGame?.name || `${resolvedCity.name} Live Challenge`,
          location: matchingGame?.location || `${resolvedCity.name} - ${resolvedCity.corridorName}`,
          cityName: resolvedCity.name,
          flagEmoji: resolvedCity.flagEmoji,
          odds: nextOdds,
          market,
          stakeUsd: state.betSlip?.stakeUsd || 10,
        },
      };
    }),

  fetchGames: async () => {
    set({ isLoadingGames: true });
    try {
      // =========================================================================
      // BACKEND INTEGRATION POINT: GET /api/games
      // Attempts to fetch active games from GET /api/games (or /camera-feeds).
      // Falls back to MOCK_GAMES in /utils/mockData.ts if endpoint is unavailable.
      // =========================================================================
      const response = await api.get<CameraFeedGame[]>(API_ENDPOINTS.BETTING.GAMES);
      if (Array.isArray(response.data) && response.data.length > 0) {
        const enriched = response.data.map((game, index) => {
          const fallbackCity =
            EUROPE_CITIES.find(
              (c) =>
                c.countryCode.toLowerCase() === (game.country_code || '').toLowerCase() ||
                game.location?.toLowerCase().includes(c.name.toLowerCase())
            ) || EUROPE_CITIES[index % EUROPE_CITIES.length];
          const mockMatch = MOCK_GAMES.find((m) => m.cityId === fallbackCity.id) || MOCK_GAMES[0];
          return {
            ...mockMatch,
            ...game,
            cityId: game.cityId || fallbackCity.id,
            cityName: game.cityName || fallbackCity.name,
            country: game.country || fallbackCity.country,
            flagEmoji: game.flagEmoji || fallbackCity.flagEmoji,
            odds: game.odds || mockMatch.odds || 2.5,
            thumbnailUrl: game.thumbnailUrl || fallbackCity.thumbnailUrl,
            youtubeLiveUrl: game.youtubeLiveUrl || fallbackCity.youtubeLiveUrl,
          };
        });
        get().setGames(enriched);
        set({ isLoadingGames: false });
        return enriched;
      }
    } catch {
      // Swap/remove fallback below once GET /api/games is live in production
    }

    get().setGames(MOCK_GAMES);
    set({ isLoadingGames: false });
    return MOCK_GAMES;
  },

  placeBet: async (gameId, amount, customOdds) => {
    set({ isPlacingBet: true });
    const state = get();
    const targetGame =
      state.activeGames.find((g) => g.id === gameId) ||
      MOCK_GAMES.find((g) => g.id === gameId) ||
      state.activeGames[0];
    const effectiveOdds = customOdds || targetGame?.odds || state.currentOdds || 2.5;
    const market =
      OPTICAL_MARKETS.find((m) => m.key === state.selectedMarketKey) || OPTICAL_MARKETS[1];

    try {
      // =========================================================================
      // BACKEND INTEGRATION POINT: POST /api/bet
      // Sends { gameId, amount, odds, marketKey } to POST /api/bet.
      // Falls back toPOST /bet/place or mock confirmation if /api/bet is not yet live.
      // =========================================================================
      let betId = Math.floor(1000 + Math.random() * 9000);
      try {
        const { data } = await api.post(API_ENDPOINTS.BETTING.BET, {
          gameId,
          amount,
          odds: effectiveOdds,
          marketKey: market.key,
        });
        if (data?.bet_id || data?.id) {
          betId = data.bet_id || data.id;
        }
      } catch {
        // Fallback to existing /bet/place endpoint or mock demo confirmation
        try {
          const { data } = await api.post(API_ENDPOINTS.BETTING.PLACE_BET, {
            bet_type: 'count_prediction',
            feed_id: gameId,
            amount,
            criteria: {
              feed_id: gameId,
              market_key: market.key,
              target_count: market.targetCount,
              operator: market.operator,
              odds: effectiveOdds,
              duration_seconds: 30,
            },
          });
          if (data?.bet_id) {
            betId = data.bet_id;
          }
        } catch {
          // Using mock bet confirmation for demonstration
        }
      }

      const newBet: BetRecord = {
        id: betId,
        gameId,
        cityName: targetGame?.cityName || state.selectedCity.name,
        flagEmoji: targetGame?.flagEmoji || state.selectedCity.flagEmoji,
        type: 'count_prediction',
        amount,
        odds: effectiveOdds,
        potentialWin: Number((amount * effectiveOdds).toFixed(2)),
        status: 'pending',
        created_at: new Date().toISOString(),
        criteria: {
          feed_id: gameId,
          market_key: market.key,
          target_count: market.targetCount,
          operator: market.operator,
          odds: effectiveOdds,
          duration_seconds: targetGame?.timeRemainingSeconds || 60,
        },
      };

      get().addPlacedBet(newBet);
      set({ isPlacingBet: false });
      return newBet;
    } catch (error) {
      set({ isPlacingBet: false });
      throw error;
    }
  },

  updateOdds: (customMultiplier) =>
    set((state) => {
      if (typeof customMultiplier === 'number' && customMultiplier > 1) {
        const rounded = Number(customMultiplier.toFixed(2));
        return {
          currentOdds: rounded,
          betSlip: state.betSlip ? { ...state.betSlip, odds: rounded } : state.betSlip,
        };
      }

      // Dynamic odds fluctuation based on risk & time remaining
      const updatedGames = state.activeGames.map((game) => {
        const base = game.odds || 2.5;
        const delta = (Math.random() - 0.48) * 0.15;
        const nextGameOdds = Number(Math.max(1.25, Math.min(36.0, base + delta)).toFixed(2));
        const nextTime =
          typeof game.timeRemainingSeconds === 'number' && game.timeRemainingSeconds > 5
            ? game.timeRemainingSeconds - 1
            : 180;
        return {
          ...game,
          odds: nextGameOdds,
          timeRemainingSeconds: nextTime,
        };
      });

      const activeGame = updatedGames.find((g) => g.id === state.selectedFeedId);
      const nextCurrentOdds = activeGame?.odds || state.currentOdds;

      return {
        activeGames: updatedGames,
        games: updatedGames,
        currentOdds: nextCurrentOdds,
        betSlip: state.betSlip
          ? { ...state.betSlip, odds: nextCurrentOdds }
          : state.betSlip,
      };
    }),

  openBetModal: (game) => {
    if (game) {
      get().setSelectedFeedId(game.id);
    }
    set({ isBetModalOpen: true });
  },

  closeBetModal: () => set({ isBetModalOpen: false }),

  setGames: (games) =>
    set((state) => {
      const mergedGames =
        games.length > 0
          ? games.map((g, idx) => {
              const city =
                EUROPE_CITIES.find(
                  (c) =>
                    c.id === g.cityId ||
                    c.feedId === g.id ||
                    c.countryCode.toLowerCase() === (g.country_code || '').toLowerCase() ||
                    g.location?.toLowerCase().includes(c.name.toLowerCase())
                ) || EUROPE_CITIES[idx % EUROPE_CITIES.length];
              const mockFallback =
                MOCK_GAMES.find((m) => m.cityId === city.id) || MOCK_GAMES[idx % MOCK_GAMES.length];
              return {
                ...mockFallback,
                ...g,
                cityId: g.cityId || city.id,
                cityName: g.cityName || city.name,
                country: g.country || city.country,
                flagEmoji: g.flagEmoji || city.flagEmoji,
                thumbnailUrl: g.thumbnailUrl || city.thumbnailUrl,
                youtubeLiveUrl: g.youtubeLiveUrl ?? city.youtubeLiveUrl,
                odds: g.odds || mockFallback.odds || 2.5,
              };
            })
          : MOCK_GAMES;

      const firstActive =
        mergedGames.find((g) => g.id === state.selectedFeedId) || mergedGames[0];
      const market =
        OPTICAL_MARKETS.find((m) => m.key === state.selectedMarketKey) || OPTICAL_MARKETS[1];
      const matchedCity =
        (firstActive?.cityId && getCityById(firstActive.cityId)) || state.selectedCity;

      return {
        games: mergedGames,
        activeGames: mergedGames,
        selectedCity: matchedCity,
        selectedFeedId: firstActive ? firstActive.id : state.selectedFeedId,
        currentOdds: firstActive?.odds || state.currentOdds,
        betSlip: firstActive
          ? {
              feedId: firstActive.id,
              feedName: firstActive.name,
              location: firstActive.location,
              cityName: firstActive.cityName || matchedCity.name,
              flagEmoji: firstActive.flagEmoji || matchedCity.flagEmoji,
              odds: firstActive.odds || market.odds,
              market,
              stakeUsd: state.betSlip?.stakeUsd || 10,
            }
          : state.betSlip,
      };
    }),

  setSelectedFeedId: (feedId) =>
    set((state) => {
      const feed =
        state.activeGames.find((g) => g.id === feedId) ||
        MOCK_GAMES.find((g) => g.id === feedId);
      const matchedCity =
        (feed?.cityId && getCityById(feed.cityId)) ||
        EUROPE_CITIES.find((c) => c.feedId === feedId) ||
        state.selectedCity;
      const market =
        OPTICAL_MARKETS.find((m) => m.key === state.selectedMarketKey) || OPTICAL_MARKETS[1];
      const nextOdds = feed?.odds || state.currentOdds || market.odds;

      return {
        selectedFeedId: feedId,
        selectedCity: matchedCity,
        currentOdds: nextOdds,
        betSlip: {
          feedId,
          feedName: feed?.name || `${matchedCity.name} Traffic Challenge`,
          location: feed?.location || `${matchedCity.name} - ${matchedCity.corridorName}`,
          cityName: matchedCity.name,
          flagEmoji: matchedCity.flagEmoji,
          odds: nextOdds,
          market,
          stakeUsd: state.betSlip?.stakeUsd || 10,
        },
      };
    }),

  setSelectedMarketKey: (key) =>
    set((state) => {
      const market = OPTICAL_MARKETS.find((m) => m.key === key) || OPTICAL_MARKETS[0];
      const feed = state.activeGames.find((g) => g.id === state.selectedFeedId);
      return {
        selectedMarketKey: key,
        currentOdds: market.odds,
        betSlip: {
          feedId: state.selectedFeedId,
          feedName:
            feed?.name || state.betSlip?.feedName || `Camera Feed #${state.selectedFeedId}`,
          location: feed?.location || state.betSlip?.location || 'Live Optical Junction',
          cityName: feed?.cityName || state.selectedCity.name,
          flagEmoji: feed?.flagEmoji || state.selectedCity.flagEmoji,
          odds: market.odds,
          market,
          stakeUsd: state.betSlip?.stakeUsd || 10,
        },
      };
    }),

  setHistory: (bets) =>
    set((state) => {
      const combined = bets.length > 0 ? bets : state.placedBets;
      return {
        history: combined,
        placedBets: combined,
        activeBets: combined.filter((b) => b.status === 'pending'),
      };
    }),

  addPlacedBet: (bet) =>
    set((state) => {
      const nextHistory = [bet, ...state.placedBets.filter((b) => b.id !== bet.id)];
      return {
        history: nextHistory,
        placedBets: nextHistory,
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
