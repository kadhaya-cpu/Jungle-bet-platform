/**
 * European City Telemetry & Live Traffic Stream Registry
 * Used by InteractiveEuropeMap, CityPin, VideoPlayer, and Betting Challenge Grid.
 */

export interface CityData {
  id: string;
  feedId: number;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  long: number;
  flagEmoji: string;
  youtubeChannelId: string;
  youtubeLiveUrl: string;
  viewerCount: number;
  corridorName: string;
  thumbnailUrl: string;
  isStreamAvailable?: boolean;
}

export const EUROPE_CITIES: CityData[] = [
  {
    id: 'london',
    feedId: 1,
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    lat: 51.5074,
    long: -0.1278,
    flagEmoji: '🇬🇧',
    youtubeChannelId: 'UC_london_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_london_traffic',
    viewerCount: 1420,
    corridorName: 'Chelsea Bridge & Thames Embankment',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'paris',
    feedId: 2,
    name: 'Paris',
    country: 'France',
    countryCode: 'FR',
    lat: 48.8566,
    long: 2.3522,
    flagEmoji: '🇫🇷',
    youtubeChannelId: 'UC_paris_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_paris_traffic',
    viewerCount: 1185,
    corridorName: 'Champs-Élysées & Place de la Concorde',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'berlin',
    feedId: 3,
    name: 'Berlin',
    country: 'Germany',
    countryCode: 'DE',
    lat: 52.52,
    long: 13.405,
    flagEmoji: '🇩🇪',
    youtubeChannelId: 'UC_berlin_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_berlin_traffic',
    viewerCount: 940,
    corridorName: 'Alexanderplatz & Bundesautobahn 100',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'rome',
    feedId: 4,
    name: 'Rome',
    country: 'Italy',
    countryCode: 'IT',
    lat: 41.9028,
    long: 12.4964,
    flagEmoji: '🇮🇹',
    youtubeChannelId: 'UC_rome_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_rome_traffic',
    viewerCount: 810,
    corridorName: 'Piazza Venezia & Via del Corso',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'amsterdam',
    feedId: 5,
    name: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    lat: 52.3676,
    long: 4.9041,
    flagEmoji: '🇳🇱',
    youtubeChannelId: 'UC_amsterdam_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_amsterdam_traffic',
    viewerCount: 1065,
    corridorName: 'A10 Ring Road & Dam Square Junction',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'madrid',
    feedId: 6,
    name: 'Madrid',
    country: 'Spain',
    countryCode: 'ES',
    lat: 40.4168,
    long: -3.7038,
    flagEmoji: '🇪🇸',
    youtubeChannelId: 'UC_madrid_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_madrid_traffic',
    viewerCount: 890,
    corridorName: 'Gran Vía & Cibeles Hub',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'vienna',
    feedId: 7,
    name: 'Vienna',
    country: 'Austria',
    countryCode: 'AT',
    lat: 48.2082,
    long: 16.3738,
    flagEmoji: '🇦🇹',
    youtubeChannelId: 'UC_vienna_traffic_cam',
    youtubeLiveUrl: 'https://www.youtube.com/watch?v=live_vienna_traffic',
    viewerCount: 645,
    corridorName: 'Ringstraße & Karlsplatz Transit',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: true,
  },
  {
    id: 'prague',
    feedId: 8,
    name: 'Prague',
    country: 'Czech Republic',
    countryCode: 'CZ',
    lat: 50.0755,
    long: 14.4378,
    flagEmoji: '🇨🇿',
    youtubeChannelId: 'UC_prague_traffic_cam',
    youtubeLiveUrl: '', // Demonstrates 'Coming Soon' fallback when empty or toggled
    viewerCount: 530,
    corridorName: 'Wenceslas Square & Wilsonova Arterial',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=800&q=80',
    isStreamAvailable: false,
  },
];

export const getCityById = (cityIdOrName: string): CityData | undefined => {
  const normalized = cityIdOrName.toLowerCase().trim();
  return EUROPE_CITIES.find(
    (c) =>
      c.id.toLowerCase() === normalized ||
      c.name.toLowerCase() === normalized ||
      c.countryCode.toLowerCase() === normalized
  );
};

export default EUROPE_CITIES;
