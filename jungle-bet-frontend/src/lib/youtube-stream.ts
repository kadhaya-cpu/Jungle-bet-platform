import ytdl from "ytdl-core";

export class YouTubeStreamError extends Error {
  constructor(
    message: string,
    public readonly videoId: string,
    public readonly isOffline: boolean = false
  ) {
    super(message);
    this.name = "YouTubeStreamError";
  }
}

/**
 * Extracts a valid 11-character YouTube video ID from a URL or raw ID.
 */
export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export interface YouTubeStreamOptions {
  fallbackUrl?: string;
  throwOnError?: boolean;
}

export interface YouTubeStreamDetails {
  videoId: string;
  streamUrl: string;
  isLive: boolean;
  title?: string;
  author?: string;
}

/**
 * Extracts the direct HLS (.m3u8) stream URL from YouTube using ytdl-core.
 * Includes comprehensive error handling for offline or unavailable streams.
 *
 * @param videoIdOrUrl - YouTube video ID or full YouTube URL
 * @param options - Optional fallback URL and throwOnError flag
 * @returns Direct HLS stream URL or null if offline/unavailable
 */
export async function getYouTubeStreamUrl(
  videoIdOrUrl: string,
  options?: YouTubeStreamOptions
): Promise<string | null> {
  const videoId = extractYouTubeId(videoIdOrUrl);
  if (!videoId) {
    if (options?.throwOnError) {
      throw new YouTubeStreamError(
        `Invalid YouTube video ID or URL: "${videoIdOrUrl}"`,
        videoIdOrUrl,
        false
      );
    }
    return options?.fallbackUrl || null;
  }

  try {
    // 1. In browser environments where ytdl-core cannot run directly,
    // proxy request to our internal API route
    if (typeof window !== "undefined") {
      const response = await fetch(`/api/youtube/stream?videoId=${encodeURIComponent(videoId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new YouTubeStreamError(
          errorData.error || `Stream request failed with status ${response.status}`,
          videoId,
          Boolean(errorData.isOffline)
        );
      }
      const data = await response.json();
      if (data.streamUrl) {
        return data.streamUrl;
      }
      throw new YouTubeStreamError(
        `No direct HLS stream returned for "${videoId}"`,
        videoId,
        true
      );
    }

    // 2. In Node.js environment, use ytdl-core directly
    let info: ytdl.videoInfo;
    try {
      info = await ytdl.getBasicInfo(videoId, {
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          },
        },
      });
    } catch {
      // Fallback to getInfo if getBasicInfo fails
      info = await ytdl.getInfo(videoId);
    }

    // 3. Playability & offline validation
    const playerResponse = info.player_response as any;
    const playability = playerResponse?.playabilityStatus;
    if (playability && playability.status !== "OK") {
      const reason = playability.reason || playability.status;
      const isOffline =
        playability.status === "LIVE_STREAM_OFFLINE" ||
        String(reason).toLowerCase().includes("offline") ||
        String(reason).toLowerCase().includes("ended") ||
        String(reason).toLowerCase().includes("unavailable");
      throw new YouTubeStreamError(
        `YouTube stream "${videoId}" is ${isOffline ? "offline" : "unavailable"}: ${reason}`,
        videoId,
        isOffline
      );
    }

    // Check if video is flagged as non-live content
    if (info.videoDetails && info.videoDetails.isLiveContent === false) {
      // Check if any HLS formats exist before declaring offline
      const hasHlsFormat = info.formats?.some(
        (f) =>
          f.isHLS ||
          f.mimeType?.includes("application/x-mpegURL") ||
          f.url?.includes(".m3u8")
      );
      if (!hasHlsFormat && !playerResponse?.streamingData?.hlsManifestUrl) {
        throw new YouTubeStreamError(
          `YouTube stream "${videoId}" is offline (broadcast is not active or has concluded).`,
          videoId,
          true
        );
      }
    }

    // 4. Extract direct HLS manifest URL from player_response.streamingData
    const streamingData = playerResponse?.streamingData;
    if (streamingData?.hlsManifestUrl) {
      return streamingData.hlsManifestUrl;
    }

    // 5. Look for HLS format in formats list
    const hlsFormat = info.formats?.find(
      (f) =>
        Boolean(f.url) &&
        (f.isHLS ||
          f.mimeType?.includes("application/x-mpegURL") ||
          f.mimeType?.includes("vnd.apple.mpegurl") ||
          f.url?.includes(".m3u8"))
    );
    if (hlsFormat?.url) {
      return hlsFormat.url;
    }

    // 6. Check for adaptive ABR stream URL
    if (streamingData?.serverAbrStreamingUrl) {
      return streamingData.serverAbrStreamingUrl;
    }

    // 7. If no direct stream found
    throw new YouTubeStreamError(
      `No direct HLS stream available for YouTube video ID "${videoId}". Stream may be offline.`,
      videoId,
      true
    );
  } catch (err: any) {
    if (options?.throwOnError) {
      if (err instanceof YouTubeStreamError) throw err;
      const isOffline =
        err.message?.toLowerCase().includes("offline") ||
        err.message?.toLowerCase().includes("unavailable") ||
        err.message?.toLowerCase().includes("not active");
      throw new YouTubeStreamError(
        `Failed to resolve YouTube stream for "${videoId}": ${err.message}`,
        videoId,
        isOffline
      );
    }
    console.warn(`[getYouTubeStreamUrl] Error for video "${videoId}":`, err.message);
    return options?.fallbackUrl || null;
  }
}
