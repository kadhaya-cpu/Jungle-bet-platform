import assert from "node:assert";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/youtube/stream/route";
import { extractYouTubeId, getYouTubeStreamUrl } from "@/lib/youtube-stream";

console.log("\n=======================================================");
console.log("🌐 YOUTUBE STREAM API ROUTE & EXTRACTION TEST SUITE");
console.log("=======================================================\n");

async function runTests() {
  console.log("--- 1. Testing extractYouTubeId Helper ---");
  assert(extractYouTubeId("2srYSk0_yrE") === "2srYSk0_yrE", "Extract raw 11-char ID");
  assert(
    extractYouTubeId("https://www.youtube.com/watch?v=2srYSk0_yrE") === "2srYSk0_yrE",
    "Extract from watch URL"
  );
  assert(
    extractYouTubeId("https://youtu.be/2srYSk0_yrE") === "2srYSk0_yrE",
    "Extract from short youtu.be URL"
  );
  assert(
    extractYouTubeId("https://www.youtube.com/live/2srYSk0_yrE") === "2srYSk0_yrE",
    "Extract from live URL"
  );
  assert(extractYouTubeId("invalid") === null, "Returns null for invalid URL");
  console.log("  ✅ PASS: extractYouTubeId handles raw IDs and various URL formats");

  console.log("\n--- 2. Testing GET /api/youtube/stream Validation ---");
  // Test missing videoId
  const req1 = new NextRequest("http://localhost:3000/api/youtube/stream");
  const res1 = await GET(req1);
  assert(res1.status === 400, "Missing videoId returns 400");
  const json1 = await res1.json();
  assert(json1.success === false, "Returns success: false");
  console.log("  ✅ PASS: Missing videoId returns 400 Bad Request");

  // Test invalid videoId format
  const req2 = new NextRequest("http://localhost:3000/api/youtube/stream?videoId=toolongforanyoutubeid12345");
  const res2 = await GET(req2);
  assert(res2.status === 400, "Invalid videoId format returns 400");
  console.log("  ✅ PASS: Invalid videoId format rejected with 400");

  console.log("\n--- 3. Testing POST /api/youtube/stream Validation ---");
  const reqPostEmpty = new NextRequest("http://localhost:3000/api/youtube/stream", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const resPostEmpty = await POST(reqPostEmpty);
  assert(resPostEmpty.status === 400, "POST missing videoId returns 400");
  console.log("  ✅ PASS: POST missing videoId returns 400 Bad Request");

  console.log("\n--- 4. Testing Offline & Unavailable Stream Handling in API ---");
  const reqOffline = new NextRequest("http://localhost:3000/api/youtube/stream?videoId=00000000000");
  const resOffline = await GET(reqOffline);
  const jsonOffline = await resOffline.json();
  assert(jsonOffline.success === false, "Offline/unavailable video returns success: false");
  assert(jsonOffline.isOffline === true || jsonOffline.error, "Offline stream error indicated");
  console.log("  ✅ PASS: Offline/unavailable video returns structured error response");

  console.log("\n=======================================================");
  console.log("🏁 ALL YOUTUBE STREAM API ROUTE TESTS PASSED!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
