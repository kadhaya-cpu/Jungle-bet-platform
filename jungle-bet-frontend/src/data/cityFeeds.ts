/**
 * Jungle Bet — Major European Cities Live Traffic Feed Configuration
 * Real YouTube Live Traffic & Landmark Streams.
 *
 * Configured with YouTube video IDs stored directly instead of full URLs.
 * Features major European cities: London, Paris, Berlin, Rome, Amsterdam, Madrid, Vienna, Prague.
 */

import { getYouTubeStreamUrl, extractYouTubeId } from "@/lib/youtube-stream";

export interface CityFeedConfig {
  id: number;
  cityName: string;
  city: string; // Alias for backward compatibility
  country: string;
  countryCode: string;
  flag: string;
  landmark: string;
  junction: string;
  description: string;
  // YouTube video IDs stored directly instead of full URLs
  youtubeVideoId: string;
  videoId: string; // Alias for backward compatibility
  fallbackVideoId: string;
  // Geographic coordinates { lat, lng }
  coordinates: {
    lat: number;
    lng: number;
  };
  geo: {
    lat: number;
    lng: number;
  }; // Alias for backward compatibility
  // SVG Europe Map Coordinates (percentage within viewBox 0 0 1000 800)
  mapCoords: {
    x: number; // 0 - 100%
    y: number; // 0 - 100%
  };
  opticalSettings: {
    greenLineYPercent: number; // Position of the optical detection green line
    defaultInitialCount: number;
    averageSpeedKmh: number;
    trafficDensity: "Light" | "Moderate" | "Heavy" | "Dense Flow" | "High Velocity";
  };
}

export interface CityFeed extends CityFeedConfig {
  youtubeId: string;
  fallbackId: string;
  youtubeUrl: string;
  streamUrl: string; // Watch URL generated from video ID
  fallbackUrl: string; // Fallback URL generated from fallback video ID
}

/**
 * Generates standard YouTube watch URL for a video ID
 */
export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Generates standard YouTube embed URL for a video ID
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Re-export extractYouTubeId and getYouTubeStreamUrl
 */
export { extractYouTubeId, getYouTubeStreamUrl };

/**
 * Raw city traffic feeds storing clean 11-char YouTube video IDs instead of full URLs.
 * Includes all major European cities: London, Paris, Berlin, Rome, Amsterdam, Madrid, Vienna, Prague.
 */
export const RAW_CITY_FEEDS: CityFeedConfig[] = [
  {
    id: 1,
    cityName: "London",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    flag: "🇬🇧",
    landmark: "Tower Bridge & Trafalgar Square",
    junction: "Tower Bridge Live Cam",
    description: "Iconic Thames river crossing and central London vehicular corridor.",
    youtubeVideoId: "2srYSk0_yrE",
    videoId: "2srYSk0_yrE",
    fallbackVideoId: "IJdzev5gHgM",
    coordinates: { lat: 51.5074, lng: -0.1278 },
    geo: { lat: 51.5074, lng: -0.1278 },
    mapCoords: { x: 30.5, y: 44.5 },
    opticalSettings: {
      greenLineYPercent: 65,
      defaultInitialCount: 16,
      averageSpeedKmh: 48,
      trafficDensity: "Moderate",
    },
  },
  {
    id: 2,
    cityName: "Paris",
    city: "Paris",
    country: "France",
    countryCode: "FR",
    flag: "🇫🇷",
    landmark: "Champs-Élysées & Eiffel Tower",
    junction: "Avenue des Champs-Élysées Live Cam",
    description: "Prestigious avenue connecting Place de la Concorde to the Arc de Triomphe.",
    youtubeVideoId: "kw0VA9RSIPk",
    videoId: "kw0VA9RSIPk",
    fallbackVideoId: "34n8tGCULQM",
    coordinates: { lat: 48.8566, lng: 2.3522 },
    geo: { lat: 48.8566, lng: 2.3522 },
    mapCoords: { x: 35.5, y: 56.5 },
    opticalSettings: {
      greenLineYPercent: 62,
      defaultInitialCount: 22,
      averageSpeedKmh: 68,
      trafficDensity: "Heavy",
    },
  },
  {
    id: 3,
    cityName: "Berlin",
    city: "Berlin",
    country: "Germany",
    countryCode: "DE",
    flag: "🇩🇪",
    landmark: "Brandenburg Gate & Alexanderplatz",
    junction: "Brandenburg Gate Live Cam",
    description: "Neoclassical monument and historic urban artery through central Mitte.",
    youtubeVideoId: "SgeQKaiJGNU",
    videoId: "SgeQKaiJGNU",
    fallbackVideoId: "4Xg-wkPazp4",
    coordinates: { lat: 52.52, lng: 13.405 },
    geo: { lat: 52.52, lng: 13.405 },
    mapCoords: { x: 53.5, y: 42.0 },
    opticalSettings: {
      greenLineYPercent: 68,
      defaultInitialCount: 19,
      averageSpeedKmh: 82,
      trafficDensity: "High Velocity",
    },
  },
  {
    id: 4,
    cityName: "Rome",
    city: "Rome",
    country: "Italy",
    countryCode: "IT",
    flag: "🇮🇹",
    landmark: "Colosseum & Spanish Steps",
    junction: "Colosseum Live Cam",
    description: "Ancient amphitheatre forum and surrounding vehicular corridor in central Rome.",
    youtubeVideoId: "bietemdE8LU",
    videoId: "bietemdE8LU",
    fallbackVideoId: "JIvzUvK7t3E",
    coordinates: { lat: 41.9028, lng: 12.4964 },
    geo: { lat: 41.9028, lng: 12.4964 },
    mapCoords: { x: 53.0, y: 77.0 },
    opticalSettings: {
      greenLineYPercent: 66,
      defaultInitialCount: 25,
      averageSpeedKmh: 58,
      trafficDensity: "Dense Flow",
    },
  },
  {
    id: 5,
    cityName: "Amsterdam",
    city: "Amsterdam",
    country: "Netherlands",
    countryCode: "NL",
    flag: "🇳🇱",
    landmark: "Dam Square & Canal Ring",
    junction: "Dam Square Live Cam",
    description: "Central historic town square and arterial bicycle/tram junction in Amsterdam.",
    youtubeVideoId: "Gd9d4q6WvUY",
    videoId: "Gd9d4q6WvUY",
    fallbackVideoId: "FHJH2yMe6Hw",
    coordinates: { lat: 52.3676, lng: 4.9041 },
    geo: { lat: 52.3676, lng: 4.9041 },
    mapCoords: { x: 39.5, y: 43.5 },
    opticalSettings: {
      greenLineYPercent: 64,
      defaultInitialCount: 14,
      averageSpeedKmh: 75,
      trafficDensity: "Dense Flow",
    },
  },
  {
    id: 6,
    cityName: "Madrid",
    city: "Madrid",
    country: "Spain",
    countryCode: "ES",
    flag: "🇪🇸",
    landmark: "Puerta del Sol & Gran Vía",
    junction: "Puerta del Sol Live Cam",
    description: "Heart of Madrid's radial roads and bustling Gran Vía commercial artery.",
    youtubeVideoId: "5JF-2csxmFs",
    videoId: "5JF-2csxmFs",
    fallbackVideoId: "8coUE-v93_o",
    coordinates: { lat: 40.4168, lng: -3.7038 },
    geo: { lat: 40.4168, lng: -3.7038 },
    mapCoords: { x: 23.5, y: 78.5 },
    opticalSettings: {
      greenLineYPercent: 65,
      defaultInitialCount: 18,
      averageSpeedKmh: 64,
      trafficDensity: "Moderate",
    },
  },
  {
    id: 7,
    cityName: "Vienna",
    city: "Vienna",
    country: "Austria",
    countryCode: "AT",
    flag: "🇦🇹",
    landmark: "Ringstraße & Stephansdom",
    junction: "Ringstraße Boulevard Live Cam",
    description: "Historic grand boulevard ringing Vienna's imperial inner city.",
    youtubeVideoId: "BFlsMnd_MFQ",
    videoId: "BFlsMnd_MFQ",
    fallbackVideoId: "BFlsMnd_MFQ",
    coordinates: { lat: 48.2082, lng: 16.3738 },
    geo: { lat: 48.2082, lng: 16.3738 },
    mapCoords: { x: 60.5, y: 57.5 },
    opticalSettings: {
      greenLineYPercent: 63,
      defaultInitialCount: 12,
      averageSpeedKmh: 71,
      trafficDensity: "Moderate",
    },
  },
  {
    id: 8,
    cityName: "Prague",
    city: "Prague",
    country: "Czech Republic",
    countryCode: "CZ",
    flag: "🇨🇿",
    landmark: "Old Town & Charles Bridge",
    junction: "V Holešovičkách Arterial Cam",
    description: "Historic capital crossroads and major arterial V Holešovičkách highway corridor.",
    youtubeVideoId: "Zf1z8h-yD9o",
    videoId: "Zf1z8h-yD9o",
    fallbackVideoId: "kYJ3J2Z9_0c",
    coordinates: { lat: 50.0755, lng: 14.4378 },
    geo: { lat: 50.0755, lng: 14.4378 },
    mapCoords: { x: 57.0, y: 49.5 },
    opticalSettings: {
      greenLineYPercent: 65,
      defaultInitialCount: 16,
      averageSpeedKmh: 68,
      trafficDensity: "Moderate",
    },
  },
  {
    id: 9,
    cityName: "Zurich",
    city: "Zurich",
    country: "Switzerland",
    countryCode: "CH",
    flag: "🇨🇭",
    landmark: "Bahnhofstrasse & Lake Zurich",
    junction: "Bahnhofstrasse Live Cam",
    description: "Major financial district thoroughfare and alpine transit crossroads.",
    youtubeVideoId: "enYFXf8u7Lc",
    videoId: "enYFXf8u7Lc",
    fallbackVideoId: "enYFXf8u7Lc",
    coordinates: { lat: 47.3769, lng: 8.5417 },
    geo: { lat: 47.3769, lng: 8.5417 },
    mapCoords: { x: 46.5, y: 63.5 },
    opticalSettings: {
      greenLineYPercent: 65,
      defaultInitialCount: 15,
      averageSpeedKmh: 80,
      trafficDensity: "High Velocity",
    },
  },
  {
    id: 10,
    cityName: "Brussels",
    city: "Brussels",
    country: "Belgium",
    countryCode: "BE",
    flag: "🇧🇪",
    landmark: "Grand Place & Boulevard Anspach",
    junction: "Grand Place Live Cam",
    description: "Central plaza artery connecting the European quarter and downtown Brussels.",
    youtubeVideoId: "TfhntMe0qys",
    videoId: "TfhntMe0qys",
    fallbackVideoId: "TfhntMe0qys",
    coordinates: { lat: 50.8503, lng: 4.3517 },
    geo: { lat: 50.8503, lng: 4.3517 },
    mapCoords: { x: 36.5, y: 48.5 },
    opticalSettings: {
      greenLineYPercent: 64,
      defaultInitialCount: 17,
      averageSpeedKmh: 65,
      trafficDensity: "Heavy",
    },
  },
];

/**
 * Hydrated CITY_FEEDS with both YouTube video IDs and standard URLs
 */
export const CITY_FEEDS: CityFeed[] = RAW_CITY_FEEDS.map((feed) => ({
  ...feed,
  youtubeId: feed.youtubeVideoId,
  fallbackId: feed.fallbackVideoId,
  youtubeUrl: getYouTubeWatchUrl(feed.youtubeVideoId),
  streamUrl: getYouTubeWatchUrl(feed.youtubeVideoId),
  fallbackUrl: getYouTubeWatchUrl(feed.fallbackVideoId),
}));

export const cityFeeds: CityFeed[] = CITY_FEEDS;

/**
 * Find city feed by ID or City Name (case-insensitive)
 */
export function getCityFeed(query: number | string): CityFeed | undefined {
  if (typeof query === "number") {
    return CITY_FEEDS.find((f) => f.id === query);
  }
  const clean = query.trim().toLowerCase();
  return CITY_FEEDS.find(
    (f) =>
      f.cityName.toLowerCase() === clean ||
      f.city.toLowerCase() === clean ||
      f.country.toLowerCase() === clean
  );
}

export default CITY_FEEDS;
