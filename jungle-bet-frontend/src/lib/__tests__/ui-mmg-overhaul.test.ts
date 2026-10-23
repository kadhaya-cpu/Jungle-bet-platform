import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "../country-codes";
import { authUserService } from "../auth-user-service";

console.log("\n=======================================================");
console.log("🎨 RUSH HOUR BET FRONTEND UI/UX OVERHAUL (MMG) TEST SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------------
// 1. TYPOGRAPHY FIX VERIFICATION
// -------------------------------------------------------------------
console.log("--- 1. Testing Typography Fix & Input Defaults ---");

const globalsCss = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf-8");
assert(
  globalsCss.includes("color: #e5e7eb") || globalsCss.includes("text-gray-200") || globalsCss.includes("color: white"),
  "globals.css must specify text-gray-200 / #e5e7eb default for inputs"
);
assert(
  globalsCss.includes('input[type="text"]') && globalsCss.includes('input[type="password"]'),
  "globals.css must style input text, password, etc."
);
console.log("  ✅ PASS: globals.css contains input typography defaults for dark mode");

const tailwindConfig = fs.readFileSync(path.join(process.cwd(), "tailwind.config.ts"), "utf-8");
assert(
  tailwindConfig.includes("#e5e7eb") || tailwindConfig.includes("text-gray-200"),
  "tailwind.config.ts must configure input default color"
);
console.log("  ✅ PASS: tailwind.config.ts contains base input typography configuration");

// -------------------------------------------------------------------
// 2. HEADER & PROMO TICKER VERIFICATION
// -------------------------------------------------------------------
console.log("\n--- 2. Testing Header, Promo Ticker & Gradient Logo ---");

const headerFile = fs.readFileSync(path.join(process.cwd(), "src/components/Header.tsx"), "utf-8");

// Promo ticker check
const promoTickerText = "🔥 PROMO: 100% deposit bonus on deposits of  and above! Claim now ->";
assert(headerFile.includes(promoTickerText), "Header must contain exact promo ticker string");
assert(headerFile.includes("animate-jungle-marquee"), "Header must include marquee scrolling animation");
console.log("  ✅ PASS: Scrolling promo ticker bar configured with exact text: " + promoTickerText);

// Stylish text logo check
assert(headerFile.includes("RUSH HOUR BET"), "Header must contain text logo 'RUSH HOUR BET'");
assert(
  headerFile.includes("from-blue-500") || headerFile.includes("from-blue-600"),
  "Header logo must use blue-to-green gradient scale"
);
assert(
  headerFile.includes("to-[#00e5b9]") || headerFile.includes("to-emerald"),
  "Header logo must transition to green/teal"
);
console.log("  ✅ PASS: Header text logo 'RUSH HOUR BET' features blue-to-green gradient scale");

// -------------------------------------------------------------------
// 3. AUTH PAGES REDESIGN (LOGIN, SIGNUP, FORGOT PASSWORD)
// -------------------------------------------------------------------
console.log("\n--- 3. Testing Unified Auth Pages Redesign (MMG Inspiration) ---");

// Check Country Code configuration
assert(DEFAULT_COUNTRY_CODE === "+256", "Default country code must be +256 (Uganda)");
assert(COUNTRY_CODES.some((c) => c.code === "+256" && c.name.toLowerCase().includes("uganda")), "Uganda code +256 exists");
assert(COUNTRY_CODES.some((c) => c.code === "+254"), "Kenya code +254 exists");
console.log("  ✅ PASS: Country code selector defaults to +256 (Uganda)");

// Login page checks
const loginPage = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf-8");
assert(loginPage.includes("bg-white"), "Login page must use centered white/light card");
assert(loginPage.includes("RUSH HOUR BET"), "Login page must feature 'RUSH HOUR BET' logo");
assert(loginPage.includes("CountryCodeSelector"), "Login page must include CountryCodeSelector");
assert(!loginPage.includes("type=\"email\""), "Login page must not have email inputs");
assert(loginPage.includes("Forgot Password?"), "Login page must have 'Forgot Password?' link");
assert(loginPage.includes("/forgot-password"), "Forgot Password link must point to /forgot-password");
assert(loginPage.includes("Get Started"), "Login page link to signup must say 'Get Started'");
assert(!loginPage.includes("Starting Bonus"), "Login page must not have 'Starting Bonus' text");
console.log("  ✅ PASS: Login page matches MMG unified layout with phone-only & forgot password link");

// Signup page checks
const signupPage = fs.readFileSync(path.join(process.cwd(), "src/app/signup/page.tsx"), "utf-8");
assert(signupPage.includes("bg-white"), "Signup page must use centered white/light card");
assert(signupPage.includes("RUSH HOUR BET"), "Signup page must feature 'RUSH HOUR BET' logo");
assert(signupPage.includes("CountryCodeSelector"), "Signup page must include CountryCodeSelector");
assert(!signupPage.includes("type=\"email\""), "Signup page must not have email inputs");
assert(signupPage.includes("Get Started"), "Register button must be renamed to 'Get Started'");
assert(!signupPage.includes("Starting Bonus"), "Signup page must remove all '00 Starting Bonus' text");
console.log("  ✅ PASS: Signup page matches MMG unified layout, renamed to 'Get Started', no starting bonus text");

// Forgot Password page checks
const forgotPasswordPage = fs.readFileSync(path.join(process.cwd(), "src/app/forgot-password/page.tsx"), "utf-8");
assert(forgotPasswordPage.includes("bg-white"), "Forgot password page must use centered white/light card");
assert(forgotPasswordPage.includes("RUSH HOUR BET"), "Forgot password page must feature 'RUSH HOUR BET' logo");
assert(forgotPasswordPage.includes("CountryCodeSelector"), "Forgot password page must include CountryCodeSelector");
assert(forgotPasswordPage.includes("verificationCode") || forgotPasswordPage.includes("Verification Code"), "Must include verification code step");
assert(forgotPasswordPage.includes("/api/auth/reset-password"), "Must call reset password API");
console.log("  ✅ PASS: Forgot Password page features phone-code verification flow on unified layout");

// -------------------------------------------------------------------
// 4. PASSWORD RESET LOGIC VERIFICATION
// -------------------------------------------------------------------
console.log("\n--- 4. Testing Password Reset Service Logic ---");

// Register a user to test password reset
const testPhone = `+25677${Math.floor(1000000 + Math.random() * 9000000)}`;
const testUser = authUserService.registerCredentialsUser(testPhone, "oldpass123", "ResetTester");
assert(testUser, "User registered for reset test");

// Verify old password works
assert(authUserService.verifyCredentials(testPhone, "oldpass123") !== null, "Old password verifies");

// Perform reset
const resetSuccess = authUserService.resetPassword(testPhone, "newpass456");
assert(resetSuccess === true, "Password reset must return true");

// Verify old password fails and new password succeeds
assert(authUserService.verifyCredentials(testPhone, "oldpass123") === null, "Old password rejected");
assert(authUserService.verifyCredentials(testPhone, "newpass456") !== null, "New password verified successfully");
console.log(`  ✅ PASS: Password successfully reset and verified for phone: ${testPhone}`);

// -------------------------------------------------------------------
// 5. LANDING PAGE CONTENT VERIFICATION
// -------------------------------------------------------------------
console.log("\n--- 5. Testing Landing Page Content ---");

const homePage = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf-8");

// Main logo check
assert(homePage.includes("RUSH HOUR BET"), "Landing page must feature main logo 'RUSH HOUR BET'");
assert(
  homePage.includes("bg-gradient-to-r") && (homePage.includes("from-blue-500") || homePage.includes("from-blue-600")),
  "Landing page main logo must use blue-to-green gradient"
);

// Description section check
const expectedDescription = "Make a call on how many cars can get by in a specific time. Get paid.";
assert(homePage.includes(expectedDescription), `Landing page must include description: "${expectedDescription}"`);
console.log(`  ✅ PASS: Description section verified under main logo: "${expectedDescription}"`);

// Betting incidents check
const expectedIncidentHeader = "Predict how many cars cross the green line in X seconds.";
assert(homePage.includes(expectedIncidentHeader), `Landing page must include incident phrase: "${expectedIncidentHeader}"`);
assert(homePage.includes("30 seconds") || homePage.includes("30-Second"), "Lists 30s incident");
assert(homePage.includes("60 seconds") || homePage.includes("60-Second"), "Lists 60s incident");
assert(homePage.includes("120 seconds") || homePage.includes("120-Second"), "Lists 120s incident");
console.log(`  ✅ PASS: Betting incidents listed: "${expectedIncidentHeader}"`);

console.log("\n=======================================================");
console.log("🏁 ALL FRONTEND UI/UX OVERHAUL (MMG) TESTS PASSED!");
console.log("=======================================================\n");
