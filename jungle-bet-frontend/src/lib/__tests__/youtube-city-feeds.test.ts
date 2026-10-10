import assert from "node:assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  CITY_FEEDS,
  cityFeeds,
  RAW_CITY_FEEDS,
  getYouTubeStreamUrl,
  extractYouTubeId,
  getYouTubeWatchUrl,
  getYouTubeEmbedUrl,
  getCityFeed,
  CityFeed,
} from "../../data/cityFeeds";
import {
  EUROPEAN_CITIES,
  cityToCameraFeed,
} from "../european-cities";
import { YouTubeStreamError } from "../youtube-stream";
import VideoPlayer, { CompatibleFeed } from "../../components/VideoPlayer";
import InteractiveEuropeMap from "../../components/InteractiveEuropeMap";
import { useStore } from "../store";

console.log("\n=======================================================");
console.log("📺 YOUTUBE LIVE TRAFFIC FEEDS & VIDEO PLAYER TEST SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------------
// 1. Verify src/data/cityFeeds.ts Structure & Major European Cities
// -------------------------------------------------------------------
console.log("--- 1. Testing City Feeds Configuration & Real YouTube Stream IDs ---");

assert(Array.isArray(CITY_FEEDS), "CITY_FEEDS is an exported array");
assert(Array.isArray(cityFeeds), "cityFeeds alias is an exported array");
assert(CITY_FEEDS === cityFeeds, "cityFeeds points to CITY_FEEDS");

const expectedMajorCities = [
  {
    name: "London",
    country: "United Kingdom",
    landmarks: ["Tower Bridge", "Trafalgar Square"],
    expectedId: "2srYSk0_yrE",
  },
  {
    name: "Paris",
    country: "France",
    landmarks: ["Champs-Élysées", "Eiffel Tower"],
    expectedId: "kw0VA9RSIPk",
  },
  {
    name: "Berlin",
    country: "Germany",
    landmarks: ["Brandenburg Gate", "Alexanderplatz"],
    expectedId: "SgeQKaiJGNU",
  },
  {
    name: "Rome",
    country: "Italy",
    landmarks: ["Colosseum", "Spanish Steps"],
    expectedId: "bietemdE8LU",
  },
  {
    name: "Amsterdam",
    country: "Netherlands",
    landmarks: ["Dam Square", "Canal Ring"],
    expectedId: "Gd9d4q6WvUY",
  },
  {
    name: "Madrid",
    country: "Spain",
    landmarks: ["Puerta del Sol", "Gran Vía"],
    expectedId: "5JF-2csxmFs",
  },
  {
    name: "Vienna",
    country: "Austria",
    landmarks: ["Ringstraße", "Stephansdom"],
    expectedId: "BFlsMnd_MFQ",
  },
  {
    name: "Prague",
    country: "Czech Republic",
    landmarks: ["Old Town", "Charles Bridge", "Holešovičkách"],
    expectedId: "Zf1z8h-yD9o",
  },
];

for (const req of expectedMajorCities) {
  const feed = CITY_FEEDS.find(
    (c) =>
      c.city.toLowerCase() === req.name.toLowerCase() ||
      c.cityName.toLowerCase() === req.name.toLowerCase()
  );
  assert(feed, `City feed for ${req.name} must exist`);

  // Verify cityName, country, youtubeVideoId, coordinates {lat, lng}
  assert(
    typeof feed.cityName === "string" && feed.cityName.length > 0,
    `feed.cityName must be defined for ${req.name}`
  );
  assert(
    typeof feed.country === "string" && feed.country.length > 0,
    `feed.country must be defined for ${req.name}`
  );
  assert(
    typeof feed.youtubeVideoId === "string" && feed.youtubeVideoId.length === 11,
    `feed.youtubeVideoId must be 11-char ID for ${req.name}`
  );
  assert(
    feed.coordinates &&
      typeof feed.coordinates.lat === "number" &&
      typeof feed.coordinates.lng === "number",
    `feed.coordinates {lat, lng} must be valid numbers for ${req.name}`
  );

  // Check landmark matches requirements
  const landmarkMatch = req.landmarks.some(
    (lm) =>
      feed.landmark.toLowerCase().includes(lm.toLowerCase()) ||
      feed.junction.toLowerCase().includes(lm.toLowerCase()) ||
      feed.description.toLowerCase().includes(lm.toLowerCase())
  );
  assert(
    landmarkMatch,
    `City ${req.name} landmark must reference one of: ${req.landmarks.join(" or ")} (got: "${feed.landmark}")`
  );

  // Validate YouTube ID is real 11 characters and not a placeholder
  assert(
    typeof feed.youtubeId === "string" && feed.youtubeId.length === 11,
    `Invalid YouTube ID length for ${req.name}: ${feed.youtubeId}`
  );
  assert(
    !feed.youtubeId.includes("placeholder") &&
      !feed.youtubeId.includes("TODO") &&
      !feed.youtubeId.includes("skyline"),
    `YouTube ID for ${req.name} cannot be a placeholder: ${feed.youtubeId}`
  );

  // Validate YouTube URLs
  assert(
    feed.youtubeUrl.startsWith("https://www.youtube.com/watch?v="),
    `Invalid youtubeUrl for ${req.name}: ${feed.youtubeUrl}`
  );
  assert(
    feed.streamUrl.startsWith("https://www.youtube.com/watch?v="),
    `Invalid streamUrl for ${req.name}: ${feed.streamUrl}`
  );

  // Verify YouTube ID extraction matches
  assert(
    extractYouTubeId(feed.youtubeUrl) === feed.youtubeId,
    `extractYouTubeId should extract correct ID from ${feed.youtubeUrl}`
  );
  assert(
    extractYouTubeId(feed.youtubeId) === feed.youtubeId,
    `extractYouTubeId should handle raw ID ${feed.youtubeId}`
  );

  console.log(
    `  ✅ PASS: ${feed.flag} ${feed.cityName} (${feed.country}) [${feed.landmark}] -> YouTube ID: ${feed.youtubeVideoId} at coords (${feed.coordinates.lat}, ${feed.coordinates.lng})`
  );
}

// -------------------------------------------------------------------
// 2. Testing Helper Functions in src/data/cityFeeds.ts
// -------------------------------------------------------------------
console.log("\n--- 2. Testing City Feeds Helper Utilities ---");

// getCityFeed by id and name
const londonById = getCityFeed(1);
assert(londonById?.cityName === "London", "getCityFeed(1) returns London");
const parisByName = getCityFeed("paris");
assert(parisByName?.cityName === "Paris", "getCityFeed('paris') returns Paris");
const amsterdamByName = getCityFeed("Amsterdam");
assert(amsterdamByName?.cityName === "Amsterdam", "getCityFeed('Amsterdam') returns Amsterdam");
const pragueByName = getCityFeed("Prague");
assert(pragueByName?.cityName === "Prague", "getCityFeed('Prague') returns Prague");
const viennaByName = getCityFeed("Vienna");
assert(viennaByName?.cityName === "Vienna", "getCityFeed('Vienna') returns Vienna");

// URL generators
assert(
  getYouTubeWatchUrl("2srYSk0_yrE") === "https://www.youtube.com/watch?v=2srYSk0_yrE",
  "getYouTubeWatchUrl produces standard watch URL"
);
assert(
  getYouTubeEmbedUrl("2srYSk0_yrE") === "https://www.youtube.com/embed/2srYSk0_yrE",
  "getYouTubeEmbedUrl produces standard embed URL"
);
console.log("  ✅ PASS: getCityFeed, getYouTubeWatchUrl, getYouTubeEmbedUrl work as expected");

// -------------------------------------------------------------------
// 3. Testing City Pin Clicks & Dynamic Stream Loading
// -------------------------------------------------------------------
console.log("\n--- 3. Testing City Pin Selection & Dynamic Stream Resolution ---");

// Simulate UI state for active city and clicking each pin
let activeSelectedCity: CityFeed = CITY_FEEDS[0];

function simulatePinClick(cityId: number): {
  selectedCity: CityFeed;
  cameraFeed: ReturnType<typeof cityToCameraFeed>;
  streamUrl: string;
  youtubeId: string;
} {
  const targetCity = CITY_FEEDS.find((c) => c.id === cityId);
  if (!targetCity) throw new Error(`City with ID ${cityId} not found`);

  // State update simulation (like onSelectCity(city))
  activeSelectedCity = targetCity;

  // Adapter conversion
  const cameraFeed = cityToCameraFeed(activeSelectedCity);

  return {
    selectedCity: activeSelectedCity,
    cameraFeed,
    streamUrl: activeSelectedCity.streamUrl,
    youtubeId: activeSelectedCity.youtubeId,
  };
}

for (const city of expectedMajorCities) {
  const targetCity = CITY_FEEDS.find((c) => c.cityName.toLowerCase() === city.name.toLowerCase())!;
  const result = simulatePinClick(targetCity.id);

  assert(result.selectedCity.cityName === targetCity.cityName, `Active city updated to ${targetCity.cityName}`);
  assert(result.cameraFeed.id === targetCity.id, `CameraFeed ID matches ${targetCity.id}`);
  assert(result.cameraFeed.youtube_id === targetCity.youtubeId, `CameraFeed has youtube_id`);
  assert(result.streamUrl === targetCity.streamUrl, `Stream URL matches city YouTube stream`);
  assert(result.youtubeId === targetCity.youtubeId, `YouTube ID matches city ID`);

  console.log(
    `  🎯 PIN CLICK [${targetCity.flag} ${targetCity.cityName}]: Successfully loaded YouTube stream ID [${result.youtubeId}]`
  );
}

// -------------------------------------------------------------------
// 4. Testing InteractiveEuropeMap & VideoPlayer Global Store Sync
// -------------------------------------------------------------------
console.log("\n--- 4. Testing InteractiveEuropeMap & VideoPlayer Global Store Sync ---");

// 4a. Render InteractiveEuropeMap with SVG and city pins
const mapRenderHtml = ReactDOMServer.renderToString(
  React.createElement(InteractiveEuropeMap, {
    selectedCity: CITY_FEEDS[0],
  })
);

assert(
  mapRenderHtml.includes('data-testid="interactive-europe-map-container"'),
  "InteractiveEuropeMap renders root container"
);
assert(
  mapRenderHtml.includes("rsm-svg"),
  "InteractiveEuropeMap renders clean SVG-based Europe map via react-simple-maps"
);
assert(
  mapRenderHtml.includes("London") && mapRenderHtml.includes("Prague") && mapRenderHtml.includes("Vienna"),
  "InteractiveEuropeMap plots city pins including London, Prague, Vienna"
);
console.log("  ✅ PASS: InteractiveEuropeMap renders SVG-based map with clickable city markers");

// 4b. Global store selectedCity updates & VideoPlayer synchronization
useStore.getState().setSelectedCity("Prague");
const storeCity = useStore.getState().selectedCity;
assert(storeCity.cityName === "Prague", "useStore.setSelectedCity('Prague') updates selectedCity in store");
assert(storeCity.youtubeVideoId === "Zf1z8h-yD9o", "Selected Prague feed has YouTube ID Zf1z8h-yD9o");

// 4c. VideoPlayer listens to global selectedCity state and loads YouTube stream
const videoPlayerGlobalHtml = ReactDOMServer.renderToString(
  React.createElement(VideoPlayer, {
    className: "test-video-player-global",
  })
);

assert(
  videoPlayerGlobalHtml.includes('data-testid="video-player-container"'),
  "VideoPlayer root container has data-testid='video-player-container'"
);
assert(
  videoPlayerGlobalHtml.includes("relative") && videoPlayerGlobalHtml.includes("overflow-hidden"),
  "VideoPlayer root container has CSS relative positioning and overflow-hidden for child overlays"
);
assert(
  videoPlayerGlobalHtml.includes('data-testid="react-player-wrapper"'),
  "VideoPlayer contains react-player embed wrapper layer"
);

console.log("  ✅ PASS: Global store selectedCity state synced with VideoPlayer & InteractiveEuropeMap");

// 4d. VideoPlayer container with overlay HUD
const londonFeed = cityToCameraFeed(CITY_FEEDS[0]);
const renderedHtml = ReactDOMServer.renderToString(
  React.createElement(
    VideoPlayer,
    {
      feed: londonFeed,
      className: "custom-video-test",
    },
    React.createElement(
      "div",
      { className: "green-line-optical-counter", id: "green-line-hud" },
      "VEHICLE COUNT: 42"
    )
  )
);

assert(
  renderedHtml.includes('data-testid="green-line-overlay-container"'),
  "VideoPlayer renders CSS overlay container for Green Line counter"
);
assert(
  renderedHtml.includes("green-line-optical-counter"),
  "Green Line optical counter child is mounted inside overlay container"
);
assert(
  renderedHtml.includes("VEHICLE COUNT: 42"),
  "Overlay content is rendered intact"
);

console.log("  ✅ PASS: VideoPlayer overlay container enforces relative positioning & overflow-hidden");
console.log("  ✅ PASS: Green Line counter overlay rendered inside designated CSS overlay container");

// -------------------------------------------------------------------
// 5. Testing getYouTubeStreamUrl & Offline Stream Error Handling
// -------------------------------------------------------------------
console.log("\n--- 5. Testing getYouTubeStreamUrl & Offline Error Handling ---");

async function runAsyncTests() {
  // Verify videoId stored directly instead of full URLs in raw config
  for (const rawFeed of RAW_CITY_FEEDS) {
    assert(
      typeof rawFeed.youtubeVideoId === "string" && rawFeed.youtubeVideoId.length === 11,
      `Raw feed for ${rawFeed.cityName} stores 11-char youtubeVideoId: ${rawFeed.youtubeVideoId}`
    );
    assert(
      !rawFeed.youtubeVideoId.startsWith("http"),
      `Raw feed for ${rawFeed.cityName} stores ID instead of full URL`
    );
    assert(
      typeof rawFeed.fallbackVideoId === "string" && rawFeed.fallbackVideoId.length === 11,
      `Raw feed for ${rawFeed.cityName} stores 11-char fallbackVideoId: ${rawFeed.fallbackVideoId}`
    );
  }
  console.log("  ✅ PASS: All raw city feeds store direct YouTube video IDs instead of full URLs");

  // Test getYouTubeStreamUrl with invalid ID
  let caughtInvalid = false;
  try {
    await getYouTubeStreamUrl("invalid_id", { throwOnError: true });
  } catch (err: any) {
    caughtInvalid = true;
    assert(err instanceof YouTubeStreamError, "Throws YouTubeStreamError for invalid ID");
  }
  assert(caughtInvalid, "getYouTubeStreamUrl properly rejected invalid video ID");
  console.log("  ✅ PASS: getYouTubeStreamUrl throws YouTubeStreamError on invalid ID");

  // Test getYouTubeStreamUrl fallback option
  const fallbackResult = await getYouTubeStreamUrl("invalid_id", {
    fallbackUrl: "https://fallback.m3u8",
    throwOnError: false,
  });
  assert(fallbackResult === "https://fallback.m3u8", "getYouTubeStreamUrl returns fallbackUrl when invalid/offline");
  console.log("  ✅ PASS: getYouTubeStreamUrl returns fallbackUrl cleanly when stream cannot be extracted");

  // Test offline stream error detection
  let offlineCaught = false;
  try {
    await getYouTubeStreamUrl("00000000000", { throwOnError: true });
  } catch (err: any) {
    offlineCaught = true;
    assert(err instanceof YouTubeStreamError, "Throws YouTubeStreamError for unreachable/offline stream");
  }
  assert(offlineCaught, "getYouTubeStreamUrl caught offline / unreachable stream");
  console.log("  ✅ PASS: getYouTubeStreamUrl detects offline/unavailable stream and reports error");

  console.log("\n=======================================================");
  console.log("🏁 ALL YOUTUBE LIVE TRAFFIC & VIDEO PLAYER TESTS PASSED!");
  console.log("=======================================================\n");
}

runAsyncTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
