import assert from "node:assert";
import { fraudDetector } from "../fraud-detector";
import { authUserService } from "../auth-user-service";
import { POST as leoChatRoute } from "../../app/api/leo-chat/route";
import { POST as fraudCheckRoute } from "../../app/api/fraud/check/route";
import { GET as adminFlaggedRoute } from "../../app/api/admin/flagged/route";
import { POST as adminBanRoute } from "../../app/api/admin/ban/route";
import { POST as userSettingsRoute } from "../../app/api/user/settings/route";
import { NextRequest } from "next/server";

async function runTests() {
  console.log("\n=======================================================");
  console.log("🦁 TESTING LEO AI ASSISTANT, FRAUD SYSTEM & SETTINGS");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function test(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `-> ${detail}` : ""}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // 1. FRAUD HOOK 1: > 5 BETS IN 1 MINUTE
  // ------------------------------------------------------------------
  console.log("--- 1. Testing Fraud Hook: >5 Bets in 1 Minute ---");
  const testUserId = `usr_test_speedster_${Date.now()}`;
  fraudDetector.clearLogs();

  // Create temporary test user
  const initialUser = authUserService.registerCredentialsUser(
    "+15550001111",
    "password123",
    "Speedy Gambler"
  );

  // Place 5 bets within 1 minute (should NOT flag yet)
  for (let i = 1; i <= 5; i++) {
    const res = fraudDetector.recordBet(initialUser.id, 50, `bet_normal_${i}`);
    test(!res.isSuspicious && !res.flagged, `Bet #${i} placed: Account remains clean`);
  }

  // 6th bet within 1 minute (triggers >5 threshold!)
  const sixthBet = fraudDetector.recordBet(initialUser.id, 50, "bet_threshold_6");
  test(sixthBet.isSuspicious === true, "6th bet in 1 min triggers isSuspicious flag");
  test(sixthBet.flagged === true, "Account flagged in database");
  test(sixthBet.recentBetsCount === 6, `Recorded 6 recent bets (got ${sixthBet.recentBetsCount})`);

  // Verify in authUserService database
  const userInDb = authUserService.findUserById(initialUser.id);
  test(userInDb?.isFlagged === true, "User status in database has isFlagged: true");
  test(
    userInDb?.flagReason?.includes(">5") === true,
    `Flag reason records threshold: [${userInDb?.flagReason}]`
  );

  // ------------------------------------------------------------------
  // 2. FRAUD HOOK 2: INSTANT WIN > $1,000
  // ------------------------------------------------------------------
  console.log("\n--- 2. Testing Fraud Hook: Instant Win > $1,000 ---");
  const winUser = authUserService.registerCredentialsUser(
    "+15550002222",
    "password123",
    "Lucky Winner"
  );

  // Normal win ($500) -> should not flag
  const smallWin = fraudDetector.recordWin(winUser.id, 500, "bet_win_small");
  test(!smallWin.isSuspicious && !smallWin.flagged, "Win of $500 does NOT flag account");

  // Big win ($1,500 > $1000) -> triggers hook!
  const bigWin = fraudDetector.recordWin(winUser.id, 1500, "bet_win_jackpot");
  test(bigWin.isSuspicious === true, "Instant win of $1,500 triggers isSuspicious flag");
  test(bigWin.flagged === true, "Account flagged in database for large win");

  const winUserInDb = authUserService.findUserById(winUser.id);
  test(winUserInDb?.isFlagged === true, "Winner user status in database has isFlagged: true");
  test(
    winUserInDb?.flagReason?.includes("$1,500") === true,
    `Flag reason records large payout: [${winUserInDb?.flagReason}]`
  );

  // ------------------------------------------------------------------
  // 3. ADMIN DASHBOARD ACTIONS: LIST FLAGGED & BAN USER
  // ------------------------------------------------------------------
  console.log("\n--- 3. Testing Admin Dashboard APIs ---");
  const flaggedListReq = new NextRequest("http://localhost:3000/api/admin/flagged", {
    headers: { "x-admin-key": "jungleadmin2026" },
  });
  const flaggedRes = await adminFlaggedRoute(flaggedListReq);
  const flaggedData = await flaggedRes.json();
  test(flaggedRes.status === 200, "GET /api/admin/flagged returns 200 OK");
  test(flaggedData.flaggedCount >= 2, `Admin retrieved flagged accounts (found: ${flaggedData.flaggedCount})`);

  // Test "BAN USER" button action
  const banReq = new NextRequest("http://localhost:3000/api/admin/ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: initialUser.id, action: "ban" }),
  });
  const banRes = await adminBanRoute(banReq);
  const banData = await banRes.json();
  test(banRes.status === 200 && banData.success === true, "POST /api/admin/ban bans user successfully");

  const bannedUserInDb = authUserService.findUserById(initialUser.id);
  test(bannedUserInDb?.isBanned === true, "User status in database has isBanned: true");

  // Test "UNBAN USER"
  const unbanReq = new NextRequest("http://localhost:3000/api/admin/ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: initialUser.id, action: "unban" }),
  });
  const unbanRes = await adminBanRoute(unbanReq);
  const unbanData = await unbanRes.json();
  test(unbanRes.status === 200 && unbanData.success === true, "POST /api/admin/ban unbans user successfully");
  test(authUserService.findUserById(initialUser.id)?.isBanned === false, "User status is unbanned");

  // ------------------------------------------------------------------
  // 4. LEO AI ASSISTANT API ROUTE: /api/leo-chat
  // ------------------------------------------------------------------
  console.log("\n--- 4. Testing Leo AI Assistant (/api/leo-chat) ---");

  // Query 1: Green line explanation
  const greenLineReq = new NextRequest("http://localhost:3000/api/leo-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "How does the Green Line work?" }),
  });
  const greenLineRes = await leoChatRoute(greenLineReq);
  const greenLineData = await greenLineRes.json();
  test(greenLineRes.status === 200, "Leo Chat returns 200 OK for Green Line query");
  test(
    greenLineData.reply.includes("Green Line") && greenLineData.reply.includes("YOLOv8"),
    "Leo properly explains Green Line & YOLOv8 vehicle detection"
  );
  test(Array.isArray(greenLineData.suggestions) && greenLineData.suggestions.length > 0, "Leo provides suggestion chips");

  // Query 2: Odds explanation
  const oddsReq = new NextRequest("http://localhost:3000/api/leo-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What are the odds for OVER 13?" }),
  });
  const oddsRes = await leoChatRoute(oddsReq);
  const oddsData = await oddsRes.json();
  test(
    oddsData.reply.includes("OVER 13") && oddsData.reply.includes("3.60x"),
    "Leo properly returns current betting odds for OVER 13 (3.60x)"
  );

  // ------------------------------------------------------------------
  // 5. USER SETTINGS API: 2FA TOGGLE & ACCOUNT DELETION
  // ------------------------------------------------------------------
  console.log("\n--- 5. Testing User Settings (2FA Toggle & Delete) ---");
  // Toggle 2FA
  const toggle2faReq = new NextRequest("http://localhost:3000/api/user/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "toggle_2fa", userId: winUser.id, enabled: true }),
  });
  const toggle2faRes = await userSettingsRoute(toggle2faReq);
  const toggle2faData = await toggle2faRes.json();
  test(toggle2faRes.status === 200 && toggle2faData.twoFactorEnabled === true, "Toggle 2FA enabled for user");

  // Delete Account
  const deleteReq = new NextRequest("http://localhost:3000/api/user/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete_account", userId: winUser.id }),
  });
  const deleteRes = await userSettingsRoute(deleteReq);
  const deleteData = await deleteRes.json();
  test(deleteRes.status === 200 && deleteData.success === true, "Delete account permanently removes user from database");
  test(authUserService.findUserById(winUser.id) === null, "Deleted user no longer found in database");

  // Clean up initialUser
  authUserService.deleteUser(initialUser.id);

  console.log("\n=======================================================");
  console.log(`🏁 FRAUD & AI SUITE: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
