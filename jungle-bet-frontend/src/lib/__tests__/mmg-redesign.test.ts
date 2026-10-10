import assert from "node:assert";
import {
  EUROPEAN_CITIES,
  cityToCameraFeed,
  EuropeanCity,
} from "../european-cities";
import { authUserService } from "../auth-user-service";
import { PRESET_MARKETS } from "@/components/StickyBettingPanel";

console.log("\n=======================================================");
console.log("🏙️ JUNGLE BET MMG REDESIGN & EUROPE RADAR TEST SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------------
// 1. European Cities Data Structure Verification
// -------------------------------------------------------------------
console.log("--- 1. Testing European Cities & Video URL Mappings ---");
assert(Array.isArray(EUROPEAN_CITIES), "EUROPEAN_CITIES is an array");
assert(EUROPEAN_CITIES.length >= 9, `Expected at least 9 cities, got ${EUROPEAN_CITIES.length}`);

const requiredCities = ["London", "Paris", "Berlin", "Amsterdam", "Madrid", "Rome"];
for (const cityName of requiredCities) {
  const city = EUROPEAN_CITIES.find((c) => c.city.toLowerCase() === cityName.toLowerCase());
  assert(city, `Missing city: ${cityName}`);
  assert(city.streamUrl && city.streamUrl.length > 5, `Missing stream URL for ${cityName}`);
  assert(city.flag && city.flag.length > 0, `Missing flag for ${cityName}`);
  assert(city.countryCode && city.countryCode.length >= 2, `Missing country code for ${cityName}`);
  assert(typeof city.mapCoords.x === "number" && typeof city.mapCoords.y === "number", `Invalid mapCoords for ${cityName}`);
  assert(city.junction && city.junction.length > 0, `Missing junction for ${cityName}`);
  console.log(`  ✅ PASS: ${city.flag} ${city.city} (${city.junction}) -> ${city.streamUrl.slice(0, 42)}...`);
}

// Test cityToCameraFeed adapter
const london = EUROPEAN_CITIES.find((c) => c.city === "London")!;
const londonCameraFeed = cityToCameraFeed(london);
assert(londonCameraFeed.id === london.id, "ID matches");
assert(londonCameraFeed.location.includes("London"), "Location includes London");
assert(londonCameraFeed.rtsp_url === london.streamUrl, "RTSP URL matches streamUrl");
console.log("  ✅ PASS: cityToCameraFeed successfully adapted EuropeanCity to CameraFeed");

// -------------------------------------------------------------------
// 2. Auth Service Phone & Email Verification
// -------------------------------------------------------------------
console.log("\n--- 2. Testing Phone & Email Authentication Logic ---");

// Demo VIP user verification with phone
const vipUserByPhone = authUserService.verifyCredentials("+1234567890", "password123");
assert(vipUserByPhone, "Should verify VIP user by phone");
assert(vipUserByPhone.phone === "+1234567890", "Phone matches");
console.log("  ✅ PASS: Verified login by Phone (+1234567890)");

// Demo VIP user verification with email
const vipUserByEmail = authUserService.verifyCredentials("racer@junglebet.io", "password123");
assert(vipUserByEmail, "Should verify VIP user by email");
assert(vipUserByEmail.email === "racer@junglebet.io", "Email matches");
console.log("  ✅ PASS: Verified login by Email (racer@junglebet.io)");

// Test registering with email
const testEmail = `racer_mmg_${Date.now()}@junglebet.io`;
const registeredByEmail = authUserService.registerCredentialsUser(
  testEmail,
  "password123",
  "MMG_Speedster"
);
assert(registeredByEmail, "Should register user by email");
assert(registeredByEmail.email === testEmail, "Registered email matches");
assert(registeredByEmail.balance === 100.0, "Initial bonus balance granted");

// Verify login with newly registered email
const verifiedNewEmail = authUserService.verifyCredentials(testEmail, "password123");
assert(verifiedNewEmail, "Should verify newly registered email");
assert(verifiedNewEmail.id === registeredByEmail.id, "Verified user ID matches");
console.log(`  ✅ PASS: Registered and verified new user with email (${testEmail})`);

// -------------------------------------------------------------------
// 3. Preset Optical Betting Markets & Calculations
// -------------------------------------------------------------------
console.log("\n--- 3. Testing Optical Betting Markets & Multipliers ---");
const over13 = PRESET_MARKETS.find((m) => m.id === "over_13");
assert(over13, "OVER 13 market exists");
assert(over13.multiplier === 3.6, "OVER 13 multiplier is 3.6x");

const under10 = PRESET_MARKETS.find((m) => m.id === "under_10");
assert(under10, "UNDER 10 market exists");
assert(under10.multiplier === 2.25, "UNDER 10 multiplier is 2.25x");

const starPick = PRESET_MARKETS.find((m) => m.id === "star_pick");
assert(starPick, "STAR PICK market exists");
assert(starPick.multiplier === 18.0, "STAR PICK multiplier is 18.0x");

const exact20 = PRESET_MARKETS.find((m) => m.id === "exact_20");
assert(exact20, "EXACT 20 market exists");
assert(exact20.multiplier === 36.0, "EXACT 20 multiplier is 36.0x");

// Payout calculation tests
const stake = 100;
assert(stake * over13.multiplier === 360, "100 stake on OVER 13 = 360 payout");
assert(stake * under10.multiplier === 225, "100 stake on UNDER 10 = 225 payout");
assert(stake * starPick.multiplier === 1800, "100 stake on STAR PICK = 1800 payout");
assert(stake * exact20.multiplier === 3600, "100 stake on EXACT 20 = 3600 payout");
console.log("  ✅ PASS: Verified 4 core optical prediction markets & payout math");

console.log("\n=======================================================");
console.log("🏁 ALL MMG REDESIGN VERIFICATION TESTS PASSED!");
console.log("=======================================================\n");
