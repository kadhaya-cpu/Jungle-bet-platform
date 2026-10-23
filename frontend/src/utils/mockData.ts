/**
 * Mock Data for Active European Betting Challenges & Placed Bets
 *
 * NOTE FOR BACKEND INTEGRATION:
 * Swap the mock fallback calls in `/services/betting.ts` and `/store/useBettingStore.ts`
 * once `GET /api/games` and `POST /api/bet` are live on the backend server.
 */

import { EUROPE_CITIES } from './cityData';
import { BetRecord, CameraFeedGame } from '../store/useBettingStore';

export const MOCK_GAMES: CameraFeedGame[] = EUROPE_CITIES.map((city, idx) => {
  const baseOddsList = [2.5, 3.2, 2.85, 3.6, 2.25, 4.1, 2.95, 5.0];
  const timers = [180, 240, 150, 300, 120, 210, 195, 260];
  const risks: Array<'low' | 'medium' | 'high'> = [
    'medium',
    'high',
    'medium',
    'high',
    'low',
    'high',
    'medium',
    'high',
  ];
  const challenges = [
    'Over 15 Vehicles in 60s',
    'Roundabout Surge > 22 Cars',
    'Autobahn Express > 18 Cars',
    'Piazza Rush Exact Window',
    'Ring Road Flow > 12 Cars',
    'Gran Vía Evening Sprint',
    'Ringstraße Tram & Car Pass',
    'Wilsonova Corridor > 20 Cars',
  ];

  return {
    id: city.feedId,
    cityId: city.id,
    name: `${city.name} — ${challenges[idx]}`,
    cityName: city.name,
    country: city.country,
    country_code: city.countryCode,
    flagEmoji: city.flagEmoji,
    location: `${city.name} - ${city.corridorName}`,
    rtsp_url: city.youtubeLiveUrl,
    youtubeLiveUrl: city.youtubeLiveUrl,
    youtubeChannelId: city.youtubeChannelId,
    thumbnailUrl: city.thumbnailUrl,
    odds: baseOddsList[idx],
    riskLevel: risks[idx],
    timeRemainingSeconds: timers[idx],
    challengeTitle: challenges[idx],
    viewerCount: city.viewerCount,
    status: city.isStreamAvailable !== false ? 'ACTIVE' : 'COMING_SOON',
    created_at: new Date().toISOString(),
  };
});

export const MOCK_PLACED_BETS: BetRecord[] = [
  {
    id: 1041,
    gameId: 1,
    cityName: 'London',
    flagEmoji: '🇬🇧',
    type: 'count_prediction',
    amount: 25,
    odds: 2.5,
    potentialWin: 62.5,
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 45).toISOString(),
    criteria: {
      feed_id: 1,
      market_key: 'over_13',
      target_count: 15,
      operator: 'over',
      odds: 2.5,
      duration_seconds: 60,
    },
  },
  {
    id: 1038,
    gameId: 2,
    cityName: 'Paris',
    flagEmoji: '🇫🇷',
    type: 'count_prediction',
    amount: 15,
    odds: 3.2,
    potentialWin: 48.0,
    status: 'won',
    created_at: new Date(Date.now() - 1000 * 320).toISOString(),
    resolved_at: new Date(Date.now() - 1000 * 260).toISOString(),
    criteria: {
      feed_id: 2,
      market_key: 'over_13',
      target_count: 22,
      operator: 'over',
      odds: 3.2,
      duration_seconds: 60,
    },
    resolution_data: {
      actual_count: 25,
      payout: 48.0,
      won: true,
    },
  },
  {
    id: 1032,
    gameId: 5,
    cityName: 'Amsterdam',
    flagEmoji: '🇳🇱',
    type: 'count_prediction',
    amount: 10,
    odds: 2.25,
    potentialWin: 22.5,
    status: 'lost',
    created_at: new Date(Date.now() - 1000 * 780).toISOString(),
    resolved_at: new Date(Date.now() - 1000 * 720).toISOString(),
    criteria: {
      feed_id: 5,
      market_key: 'under_10',
      target_count: 10,
      operator: 'under',
      odds: 2.25,
      duration_seconds: 30,
    },
    resolution_data: {
      actual_count: 14,
      payout: 0,
      won: false,
    },
  },
];
