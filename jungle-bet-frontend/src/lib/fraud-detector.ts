import { authUserService, JungleUser } from "./auth-user-service";

export interface BetRecord {
  userId: string;
  amount: number;
  betId?: string;
  timestamp: number;
}

export interface FraudCheckResult {
  isSuspicious: boolean;
  reason?: string;
  flagged: boolean;
  recentBetsCount?: number;
  winAmount?: number;
  user?: JungleUser | null;
}

export interface FraudAlertItem {
  id: string | number;
  userId: string;
  username: string;
  alertType: "rapid_bets" | "large_win" | "rate_anomaly";
  reason: string;
  amount?: number;
  recentBetsCount?: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  timestamp: string;
}

class FraudDetectionService {
  // In-memory ring buffer of bet timestamps keyed by userId
  private betLogs: Map<string, BetRecord[]> = new Map();
  private alerts: FraudAlertItem[] = [];
  private listeners: Set<(alert: FraudAlertItem) => void> = new Set();

  public subscribe(listener: (alert: FraudAlertItem) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAlerts(): FraudAlertItem[] {
    return [...this.alerts];
  }

  public addAlert(alert: FraudAlertItem): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > 100) this.alerts.pop();
    this.listeners.forEach((fn) => {
      try {
        fn(alert);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  /**
   * Logic Hook 1: Evaluate Bet Placement Frequency
   * If a user places >5 bets within 1 minute (60,000ms), flag them as "Suspicious" in the database.
   */
  public recordBet(userId: string, amount: number, betId?: string): FraudCheckResult {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    const userBets = this.betLogs.get(userId) || [];
    // Keep only bets placed within the last 60 seconds
    const activeBets = userBets.filter((b) => now - b.timestamp <= windowMs);

    // Add current bet to log
    activeBets.push({
      userId,
      amount,
      betId,
      timestamp: now,
    });
    this.betLogs.set(userId, activeBets);

    // Hook Rule: If a user places >5 bets in 1 minute
    if (activeBets.length > 5) {
      const reason = `High-frequency betting anomaly: ${activeBets.length} bets placed in 1 minute (Threshold: >5)`;
      authUserService.flagUser(userId, reason);
      const user = authUserService.findUserById(userId);

      const alert: FraudAlertItem = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        username: user?.name || `user_${userId}`,
        alertType: "rapid_bets",
        reason,
        amount,
        recentBetsCount: activeBets.length,
        severity: "HIGH",
        timestamp: new Date().toISOString(),
      };
      this.addAlert(alert);

      return {
        isSuspicious: true,
        reason,
        flagged: true,
        recentBetsCount: activeBets.length,
        user,
      };
    }

    return {
      isSuspicious: false,
      flagged: false,
      recentBetsCount: activeBets.length,
    };
  }

  /**
   * Logic Hook 2: Evaluate Instant Large Wins
   * If a user wins >$1000 instantly, flag them as "Suspicious" in the database.
   */
  public recordWin(userId: string, winAmount: number, betId?: string): FraudCheckResult {
    const threshold = 1000.0;

    // Hook Rule: If a user wins >$1000 instantly
    if (winAmount > threshold) {
      const reason = `Large instant win anomaly: Won $${winAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} (Threshold: >$1,000)`;
      authUserService.flagUser(userId, reason);
      const user = authUserService.findUserById(userId);

      const alert: FraudAlertItem = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        username: user?.name || `user_${userId}`,
        alertType: "large_win",
        reason,
        amount: winAmount,
        severity: "CRITICAL",
        timestamp: new Date().toISOString(),
      };
      this.addAlert(alert);

      return {
        isSuspicious: true,
        reason,
        flagged: true,
        winAmount,
        user,
      };
    }

    return {
      isSuspicious: false,
      flagged: false,
      winAmount,
    };
  }

  /**
   * Get bet history count in the last minute for a user
   */
  public getRecentBetsCount(userId: string): number {
    const now = Date.now();
    const userBets = this.betLogs.get(userId) || [];
    return userBets.filter((b) => now - b.timestamp <= 60000).length;
  }

  /**
   * Reset bet logs (useful for automated testing)
   */
  public clearLogs(): void {
    this.betLogs.clear();
    this.alerts = [];
  }

  /**
   * Manually flag an account for testing or admin operations
   */
  public flagAccount(userId: string, reason: string): boolean {
    return authUserService.flagUser(userId, reason);
  }

  /**
   * Ban an account
   */
  public banAccount(userId: string): boolean {
    return authUserService.banUser(userId);
  }

  /**
   * Unban / clear flag on account
   */
  public unbanAccount(userId: string): boolean {
    return authUserService.unbanUser(userId);
  }
}

export const fraudDetector = new FraudDetectionService();
