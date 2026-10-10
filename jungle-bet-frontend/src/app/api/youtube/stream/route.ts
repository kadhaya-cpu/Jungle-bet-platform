import { NextRequest, NextResponse } from "next/server";
import { getYouTubeStreamUrl, YouTubeStreamError } from "@/lib/youtube-stream";
import { extractYouTubeId } from "@/data/cityFeeds";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json(
      { success: false, error: "Missing videoId parameter" },
      { status: 400 }
    );
  }

  const cleanId = extractYouTubeId(videoId);
  if (!cleanId) {
    return NextResponse.json(
      { success: false, error: `Invalid YouTube video ID: ${videoId}` },
      { status: 400 }
    );
  }

  try {
    const streamUrl = await getYouTubeStreamUrl(cleanId, { throwOnError: true });
    return NextResponse.json({
      success: true,
      videoId: cleanId,
      streamUrl,
    });
  } catch (err: any) {
    const isOffline = err instanceof YouTubeStreamError ? err.isOffline : false;
    return NextResponse.json(
      {
        success: false,
        videoId: cleanId,
        error: err.message || "Failed to extract YouTube stream",
        isOffline,
      },
      { status: isOffline ? 404 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoId = body.videoId;

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "Missing videoId in request body" },
        { status: 400 }
      );
    }

    const cleanId = extractYouTubeId(videoId);
    if (!cleanId) {
      return NextResponse.json(
        { success: false, error: `Invalid YouTube video ID: ${videoId}` },
        { status: 400 }
      );
    }

    const streamUrl = await getYouTubeStreamUrl(cleanId, { throwOnError: true });
    return NextResponse.json({
      success: true,
      videoId: cleanId,
      streamUrl,
    });
  } catch (err: any) {
    const isOffline = err instanceof YouTubeStreamError ? err.isOffline : false;
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to extract YouTube stream",
        isOffline,
      },
      { status: isOffline ? 404 : 500 }
    );
  }
}
