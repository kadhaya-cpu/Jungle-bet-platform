import { CameraFeed } from "@/components/LiveFeedPreview";
import {
  CITY_FEEDS,
  CityFeed,
  extractYouTubeId,
  getYouTubeWatchUrl,
  getYouTubeEmbedUrl,
  getYouTubeStreamUrl,
} from "@/data/cityFeeds";

export type EuropeanCity = CityFeed;

/**
 * European Cities Mapping configured with real YouTube Live traffic streams
 * for London, Paris, Berlin, Amsterdam, Madrid, Rome, Vienna, Zurich, Brussels.
 */
export const EUROPEAN_CITIES: EuropeanCity[] = CITY_FEEDS;

/**
 * Adapter helper to convert a EuropeanCity into a CameraFeed
 * for seamless integration with VideoPlayer, WebSocket, and LiveFeed components.
 */
export function cityToCameraFeed(city: EuropeanCity): CameraFeed {
  return {
    id: city.id,
    name: city.junction,
    location: `${city.city} - ${city.landmark || city.junction.split("/")[0].trim()}`,
    rtsp_url: city.streamUrl,
    country_code: city.countryCode,
    status: "active",
    lane_mask: { coordinates: [[0.1, 0.45], [0.9, 0.45], [0.95, 0.95], [0.05, 0.95]] },
    youtube_id: city.youtubeId,
    youtubeId: city.youtubeId,
  };
}

export { extractYouTubeId, getYouTubeWatchUrl, getYouTubeEmbedUrl, getYouTubeStreamUrl };
