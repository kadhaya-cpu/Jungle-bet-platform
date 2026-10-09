import assert from "node:assert";
import {
  CURRENCY_CONFIGS,
  formatCurrencyAmount,
  detectGeoCurrencyFromContext,
} from "../store";
import {
  VERIFIED_WORKING_FEEDS,
  filterOnlyVerifiedFeeds,
  CameraFeed,
} from "@/components/LiveFeedPreview";

console.log("\n=======================================================");
console.log("🚀 JUNGLE BET UI/UX OVERHAUL & CURRENCY SYSTEM VERIFICATION");
console.log("=======================================================\n");

// 1. SMART CURRENCY SYSTEM VERIFICATION
console.log("--- 1. Testing Smart Currency Configurations & Rates ---");
assert(CURRENCY_CONFIGS.USD.rate === 1.0, "USD rate is 1.0");
assert(CURRENCY_CONFIGS.GBP.rate === 0.79, "GBP rate is 0.79");
assert(CURRENCY_CONFIGS.UGX.rate === 3750, "UGX rate is 3750");
assert(CURRENCY_CONFIGS.KES.rate === 130, "KES rate is 130");
assert(CURRENCY_CONFIGS.NGN.rate === 1500, "NGN rate is 1500");
assert(CURRENCY_CONFIGS.EUR.rate === 0.92, "EUR rate is 0.92");
console.log("  ✅ PASS: Verified 6 supported currency configurations");

console.log("\n--- 2. Testing Currency Conversions & Formatting ---");
// $100 conversions
const usdFormatted = formatCurrencyAmount(100, "USD");
assert(usdFormatted === "$100.00", `USD format expected $100.00, got ${usdFormatted}`);
console.log("  ✅ PASS: $100.00 in USD ->", usdFormatted);

const gbpFormatted = formatCurrencyAmount(100, "GBP");
assert(gbpFormatted === "£79.00", `GBP format expected £79.00, got ${gbpFormatted}`);
console.log("  ✅ PASS: $100.00 in GBP ->", gbpFormatted);

const ugxFormatted = formatCurrencyAmount(100, "UGX");
assert(ugxFormatted === "UGX 375,000", `UGX format expected UGX 375,000, got ${ugxFormatted}`);
console.log("  ✅ PASS: $100.00 in UGX ->", ugxFormatted);

const kesFormatted = formatCurrencyAmount(100, "KES");
assert(kesFormatted === "KES 13,000", `KES format expected KES 13,000, got ${kesFormatted}`);
console.log("  ✅ PASS: $100.00 in KES ->", kesFormatted);

const ngnFormatted = formatCurrencyAmount(100, "NGN");
assert(ngnFormatted === "₦150,000", `NGN format expected ₦150,000, got ${ngnFormatted}`);
console.log("  ✅ PASS: $100.00 in NGN ->", ngnFormatted);

const eurFormatted = formatCurrencyAmount(100, "EUR");
assert(eurFormatted === "€92.00", `EUR format expected €92.00, got ${eurFormatted}`);
console.log("  ✅ PASS: $100.00 in EUR ->", eurFormatted);

console.log("\n--- 3. Testing Geo-Location Detection by User Phone ---");
assert(detectGeoCurrencyFromContext("+14155552671") === "USD", "Detect USD from +1 US phone");
console.log("  ✅ PASS: +1 (USA) -> USD");

assert(detectGeoCurrencyFromContext("+447911123456") === "GBP", "Detect GBP from +44 UK phone");
console.log("  ✅ PASS: +44 (UK) -> GBP");

assert(detectGeoCurrencyFromContext("+256772123456") === "UGX", "Detect UGX from +256 Uganda phone");
console.log("  ✅ PASS: +256 (Uganda) -> UGX");

assert(detectGeoCurrencyFromContext("+254712345678") === "KES", "Detect KES from +254 Kenya phone");
console.log("  ✅ PASS: +254 (Kenya) -> KES");

assert(detectGeoCurrencyFromContext("+2348031234567") === "NGN", "Detect NGN from +234 Nigeria phone");
console.log("  ✅ PASS: +234 (Nigeria) -> NGN");

console.log("\n--- 4. Testing Verified Working Feeds Only Filter ---");
assert(VERIFIED_WORKING_FEEDS.length === 3, "Default verified feeds has exactly 3 streams");
assert(
  VERIFIED_WORKING_FEEDS.some((f) => f.location.includes("I-405")),
  "Contains Los Angeles - I-405"
);
assert(
  VERIFIED_WORKING_FEEDS.some((f) => f.location.includes("Chelsea Bridge")),
  "Contains London - Chelsea Bridge"
);
assert(
  VERIFIED_WORKING_FEEDS.some((f) => f.location.includes("A10")),
  "Contains Amsterdam - A10"
);
console.log("  ✅ PASS: Default feeds strictly contain only LA, London, and Amsterdam");

// Test filtering noisy backend payload containing simulation & test feeds
const mockBackendFeeds: CameraFeed[] = [
  {
    id: 1,
    name: "Caltrans I-405 Culver Overpass",
    location: "Los Angeles - I-405",
    rtsp_url: "https://stream.la.gov/live.m3u8",
    country_code: "US",
    status: "active",
  },
  {
    id: 2,
    name: "TfL Chelsea Bridge Junction",
    location: "London - Chelsea Bridge",
    rtsp_url: "https://jamcams.tfl.gov.uk/cam.mp4",
    country_code: "UK",
    status: "active",
  },
  {
    id: 3,
    name: "Rijkswaterstaat A1 Hoevelaken Overpass",
    location: "Amsterdam - A10 / A1",
    rtsp_url: "https://stream.inmoves.nl/live.m3u8",
    country_code: "NL",
    status: "active",
  },
  {
    id: 4,
    name: "Ultralytics Speedway Camera",
    location: "Simulation - Ultralytics Speedway",
    rtsp_url: "https://sim.mp4",
    country_code: "SIM",
    status: "active",
  },
  {
    id: 5,
    name: "Highway Flow Simulator",
    location: "Simulation - Highway Loop",
    rtsp_url: "https://sim2.mp4",
    country_code: "SIM",
    status: "active",
  },
  {
    id: 6,
    name: "Test Offline Stream",
    location: "Test-Unreachable-Cam",
    rtsp_url: "rtsp://offline",
    country_code: "US",
    status: "offline",
  },
  {
    id: 7,
    name: "Active Test Feed",
    location: "Test-Active-Road",
    rtsp_url: "/test.mp4",
    country_code: "US",
    status: "active",
  },
];

const filtered = filterOnlyVerifiedFeeds(mockBackendFeeds);
assert(filtered.length === 3, `Expected exactly 3 verified feeds, got ${filtered.length}`);
assert(
  !filtered.some((f) => f.location.toLowerCase().includes("simulat")),
  "Simulation feeds completely removed"
);
assert(
  !filtered.some((f) => f.location.toLowerCase().includes("test")),
  "Test feeds completely removed"
);
console.log("  ✅ PASS: Filtered noisy list of 7 feeds down to ONLY 3 verified live feeds");
console.log(
  "         Retained:",
  filtered.map((f) => f.location).join(", ")
);

console.log("\n=======================================================");
console.log("🏁 ALL OVERHAUL & CURRENCY SYSTEM TESTS PASSED PERFECTLY!");
console.log("=======================================================\n");
