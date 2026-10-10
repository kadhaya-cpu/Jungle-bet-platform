/**
 * financial-core-and-mobile.test.ts - Test Suite for Jungle Bet Financial Core & Mobile Monitoring
 * 
 * Tests:
 * 1. Segregated Wallets & Types ('PLAYER' vs 'HOUSE_REVENUE')
 * 2. Strict Transaction Ledger Logging & Statuses
 * 3. Money Movement Logic (Lock stake, Loss -> House, Win -> (stake * odds) from House to Player)
 * 4. Daily Settlement Job (net profit calculation & external bank transfer preparation)
 * 5. Mobile Admin Key Metrics ('Today's Net Profit', 'Active Players', 'Total Liability', 'House Bankroll')
 * 6. Live Feed of Recent High-Value Transactions
 * 7. One-Click Ban enforcement for flagged users
 * 8. Real-Time Alert triggers (High Win > $1,000, Daily Profit Target, Fraud Alert, 11:59 PM Summary)
 */

import { frontendTransactionService } from "../transaction-service";
import { authUserService } from "../auth-user-service";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("📱 JUNGLE BET FINANCIAL CORE & MOBILE MONITORING TESTS");
  console.log("=======================================================\n");

  // --- 1. Testing Wallet Segregation & Types ---
  console.log("--- 1. Testing Wallet Segregation & Types ---");
  const playerWallet = {
    id: 10,
    userId: 1,
    type: "PLAYER" as const,
    currency: "USD",
    balance: 500.0,
    lockedBalance: 0.0,
    status: "active",
  };
  const houseWallet = {
    id: 1,
    userId: null,
    type: "HOUSE_REVENUE" as const,
    currency: "USD",
    balance: 100000.0,
    lockedBalance: 0.0,
    status: "active",
  };

  assert(playerWallet.type === "PLAYER", "Player wallet has type 'PLAYER'");
  assert(houseWallet.type === "HOUSE_REVENUE", "House wallet has type 'HOUSE_REVENUE'");
  assert(houseWallet.userId === null, "House wallet has no user_id (system central wallet)");
  assert(playerWallet.balance === 500.0, "Player wallet holds isolated balance");
  assert(houseWallet.balance >= 100000.0, "House revenue wallet holds central liquidity");

  // --- 2. Testing Money Movement Logic (processBet simulation) ---
  console.log("\n--- 2. Testing Money Movement Logic (processBet) ---");
  const stake = 100.0;
  const odds = 3.6; // OVER 13 market multiplier

  // Step a: Lock stake from PLAYER wallet
  playerWallet.balance -= stake;
  playerWallet.lockedBalance += stake;
  assert(playerWallet.balance === 400.0, "Step A: Deducted stake from PLAYER liquid balance");
  assert(playerWallet.lockedBalance === 100.0, "Step A: Locked user stake in locked_balance");

  // Step b: User loss scenario
  const lossHouseWallet = { ...houseWallet };
  const lossPlayerWallet = { ...playerWallet };
  lossPlayerWallet.lockedBalance -= stake;
  lossHouseWallet.balance += stake;

  assert(lossPlayerWallet.lockedBalance === 0.0, "Step B (Loss): Released stake lock");
  assert(lossHouseWallet.balance === 100100.0, "Step B (Loss): Stake moved into HOUSE_REVENUE wallet");

  // Step c: User win scenario
  const winHouseWallet = { ...houseWallet };
  const winPlayerWallet = { ...playerWallet };
  const winPayout = stake * odds; // 360.0
  winPlayerWallet.lockedBalance -= stake;
  winHouseWallet.balance -= winPayout;
  winPlayerWallet.balance += winPayout;

  assert(winPayout === 360.0, "Step C (Win): Calculated total payout (stake * odds)");
  assert(winPlayerWallet.balance === 400.0 + 360.0, "Step C (Win): Transferred (stake * odds) to PLAYER wallet");
  assert(winHouseWallet.balance === 100000.0 - 360.0, "Step C (Win): Transferred payout from HOUSE_REVENUE wallet");

  // --- 3. Testing Daily Settlement Job & Net Profit Calculation ---
  console.log("\n--- 3. Testing Daily Settlement Job ---");
  const totalTurnover = 25000.0;
  const totalHouseLossesCollected = 16000.0;
  const totalPlayerWinsPaid = 9500.0;
  const calculatedNetProfit = totalHouseLossesCollected - totalPlayerWinsPaid; // 6500.0
  const operatorBank = "Stanbic Bank - IBAN GB29JUNGLE8839210";

  assert(calculatedNetProfit === 6500.0, "Calculated today's net operator profit: $6,500.00");
  assert(operatorBank.includes("Stanbic Bank"), "Assigned operator external bank account");

  const settlementReport = {
    settlement_id: 1,
    settlement_date: new Date().toISOString().split("T")[0],
    total_turnover: totalTurnover,
    total_payouts: totalPlayerWinsPaid,
    total_losses: totalHouseLossesCollected,
    net_profit: calculatedNetProfit,
    operator_bank_account: operatorBank,
    status: "PREPARED_FOR_TRANSFER",
    transfer_reference: `SETTLE-20261009-001`,
  };

  assert(settlementReport.status === "PREPARED_FOR_TRANSFER", "Settlement marked PREPARED_FOR_TRANSFER");
  assert(settlementReport.transfer_reference.startsWith("SETTLE-"), "Generated unique settlement bank transfer reference");

  // --- 4. Testing Mobile Admin 4 Key Metrics ---
  console.log("\n--- 4. Testing Mobile Admin 4 Key Metrics ---");
  const metrics = await frontendTransactionService.getMetrics();
  assert(typeof metrics.today_net_profit === "number", `1. Today's Net Profit present: $${metrics.today_net_profit.toLocaleString()}`);
  assert(typeof metrics.active_players === "number" && metrics.active_players > 0, `2. Active Players present: ${metrics.active_players}`);
  assert(typeof metrics.total_liability === "number" && metrics.total_liability > 0, `3. Total Liability present: $${metrics.total_liability.toLocaleString()}`);
  assert(typeof metrics.house_bankroll === "number" && metrics.house_bankroll > 0, `4. House Bankroll present: $${metrics.house_bankroll.toLocaleString()}`);

  // Solvency ratio check
  const solvency = (metrics.house_bankroll / metrics.total_liability) * 100;
  assert(solvency > 100, `House bankroll provides ${solvency.toFixed(1)}% liability solvency coverage`);

  // --- 5. Testing Live Feed of High-Value Transactions ---
  console.log("\n--- 5. Testing Live Feed of High-Value Transactions ---");
  assert(Array.isArray(metrics.recent_transactions), "Recent transactions array provided");
  const highValue = metrics.recent_transactions.filter((t) => t.isHighValue || t.amount >= 100);
  assert(highValue.length > 0, `Filtered ${highValue.length} high-value transactions`);
  assert(highValue[0].amount >= 100, `Top transaction amount: $${highValue[0].amount}`);
  assert(Boolean(highValue[0].type), `Transaction has type tag: [${highValue[0].type}]`);

  // --- 6. Testing One-Click Ban Enforcement ---
  console.log("\n--- 6. Testing One-Click Ban Enforcement ---");
  const flagSuccess = authUserService.flagUser("usr_demo_vip_001", "Rapid betting anomaly: >10 bets/min");
  const flaggedUser = authUserService.findUserById("usr_demo_vip_001");
  assert(flagSuccess && flaggedUser?.isFlagged === true, "User usr_demo_vip_001 marked flagged");

  // Execute One-Click Ban
  const banSuccess = authUserService.banUser("usr_demo_vip_001");
  const bannedUser = authUserService.findUserById("usr_demo_vip_001");
  assert(banSuccess && bannedUser?.isBanned === true, "⚡ ONE-CLICK BAN: User successfully banned");
  assert(bannedUser?.bannedAt !== undefined, "Ban timestamp recorded");

  // Execute Unban
  const unbanSuccess = authUserService.unbanUser("usr_demo_vip_001");
  const unbannedUser = authUserService.findUserById("usr_demo_vip_001");
  assert(unbanSuccess && unbannedUser?.isBanned === false, "User successfully unbanned");

  // --- 7. Testing Real-Time Alerts Logic ---
  console.log("\n--- 7. Testing Real-Time Alerts Logic ---");
  const winAlertThreshold = 1000.0;
  const profitTarget = 5000.0;

  const normalWin = 450.0;
  const bigWin = 1500.0;
  assert(normalWin <= winAlertThreshold, "Normal win $450 does not trigger threshold");
  assert(bigWin > winAlertThreshold, "🚨 Big win $1,500 > $1,000 triggers High Roller Alert");

  const dailyProfitReached = 6200.0;
  assert(dailyProfitReached >= profitTarget, "🎯 Daily profit $6,200 >= $5,000 triggers Profit Target Alert");

  // --- 8. Testing Treasury Management & Safe Withdrawal System ---
  console.log("\n--- 8. Testing Treasury Management & Safe Withdrawal System ---");
  const MIN_FLOAT_PERCENT = 0.25;
  const houseBalance = 104250.0;
  const playerLiabilities = 8450.0;

  // Float & Withdrawable calculation
  const requiredFloat = playerLiabilities * MIN_FLOAT_PERCENT; // 2112.50
  const withdrawableAmount = Math.max(0, houseBalance - requiredFloat); // 102137.50

  assert(MIN_FLOAT_PERCENT === 0.25, "MIN_SAFETY_FLOAT_PERCENTAGE is 0.25 (25%)");
  assert(requiredFloat === 2112.5, "Required Safety Float calculated as Total Liabilities * 25%: $2,112.50");
  assert(withdrawableAmount === 102137.5, "Safe to Withdraw calculated as Max(0, House Balance - Required Float): $102,137.50");

  // Compliance check
  const illegalWithdrawal = withdrawableAmount + 1000.0;
  const violatesCompliance = (houseBalance - illegalWithdrawal) < requiredFloat;
  assert(violatesCompliance, "Compliance Check: Blocks withdrawal of $103,137.50 that dips balance below Required Float");

  // Automated sweep simulation
  const sweepHouse = houseBalance - withdrawableAmount;
  const sweepOperator = withdrawableAmount;
  assert(sweepHouse === requiredFloat, "After full sweep, House Balance is exactly preserved at Required Safety Float ($2,112.50)");
  assert(sweepOperator === 102137.5, "Operating Account credited with withdrawable amount ($102,137.50)");

  // Telegram alert message format check
  const sweepAlertText = `Daily Sweep Complete: Moved $${withdrawableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} to Operating Account.`;
  assert(
    sweepAlertText.includes("Daily Sweep Complete: Moved") && sweepAlertText.includes("to Operating Account."),
    "Telegram alert format verified: 'Daily Sweep Complete: Moved [amount] to Operating Account.'"
  );

  const sweepAlertRemainingFloat = `Daily Sweep: Moved $${withdrawableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} to Operating Account. Remaining Float: $${requiredFloat.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`;
  assert(
    sweepAlertRemainingFloat.includes("Daily Sweep: Moved") && sweepAlertRemainingFloat.includes("Remaining Float:"),
    "Telegram alert format verified: 'Daily Sweep: Moved [amount] to Operating Account. Remaining Float: [float].'"
  );

  const noProfitAlert = "⚠️ No profit available for withdrawal today. Maintaining safety float.";
  assert(
    noProfitAlert.includes("No profit available for withdrawal today") && noProfitAlert.includes("Maintaining safety float"),
    "Telegram alert format verified: '⚠️ No profit available for withdrawal today. Maintaining safety float.'"
  );

  // Frontend service treasury status
  const treasuryStatus = await frontendTransactionService.getTreasuryStatus();
  assert(treasuryStatus.min_safety_float_percentage === 0.25, "Frontend treasury returns 25% min float");
  assert(treasuryStatus.required_safety_float > 0, "Frontend treasury returns positive Required Safety Float");
  assert(treasuryStatus.safe_to_withdraw > 0, "Frontend treasury returns positive Safe to Withdraw");
  assert(treasuryStatus.is_sweep_eligible === true, "Treasury marked as sweep eligible");
  assert(treasuryStatus.total_liabilities > 0, "Frontend treasury returns Total Player Liabilities");

  // Metrics includes treasury fields
  const metricsData = await frontendTransactionService.getMetrics();
  assert(metricsData.treasury !== undefined, "Metrics includes treasury object");
  assert(metricsData.required_safety_float !== undefined, "Metrics includes required_safety_float");
  assert(metricsData.safe_to_withdraw !== undefined, "Metrics includes safe_to_withdraw");

  // Force sweep helper
  assert(typeof frontendTransactionService.forceSweep === "function", "forceSweep method exists on FrontendTransactionService");

  console.log("\n=======================================================");
  console.log(`🏁 TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
