import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { authUserService } from "./auth-user-service";

export type PaymentRecordStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PaymentRecord {
  id: string;
  userId: string;
  betId?: string;
  amount: number;
  currency: string;
  provider: string;
  status: PaymentRecordStatus;
  phoneNumber?: string;
  customerEmail?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  providerReference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PendingBetRecord {
  id: string;
  userId: string;
  betType: string;
  criteria: Record<string, unknown>;
  amount: number;
  status: "payment_pending" | "pending" | "active" | "won" | "lost";
  paymentId?: string;
  resolutionData?: Record<string, unknown>;
  createdAt?: string;
  resolvedAt?: string;
}

// Optional PostgreSQL Pool
let pool: Pool | null = null;
try {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    "postgresql://trafficuser:mypassword@localhost:5432/trafficracer_db";
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });
  // Test connection silently
  pool.on("error", (err) => {
    console.warn("[PaymentDB] PostgreSQL pool background error:", err.message);
  });
} catch (e) {
  console.warn("[PaymentDB] Could not initialize PostgreSQL pool, using fallback file store:", e);
}

// Fallback JSON persistent files
const PAYMENTS_FILE = path.join(process.cwd(), ".payments-store.json");
const PENDING_BETS_FILE = path.join(process.cwd(), ".pending-bets.json");

function loadJsonFile<T>(filePath: string): Map<string, T> {
  const map = new Map<string, T>();
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.id) {
            map.set(item.id, item);
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[PaymentDB] Error loading ${filePath}:`, e);
  }
  return map;
}

function saveJsonFile<T>(filePath: string, map: Map<string, T>) {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn(`[PaymentDB] Error saving ${filePath}:`, e);
  }
}

class PaymentDatabaseService {
  private payments = loadJsonFile<PaymentRecord>(PAYMENTS_FILE);
  private bets = loadJsonFile<PendingBetRecord>(PENDING_BETS_FILE);

  /**
   * Save a payment record in PostgreSQL and local fallback
   */
  async savePayment(payment: PaymentRecord): Promise<void> {
    const now = new Date().toISOString();
    payment.createdAt = payment.createdAt || now;
    payment.updatedAt = now;

    // Save to memory and JSON file
    this.payments.set(payment.id, payment);
    saveJsonFile(PAYMENTS_FILE, this.payments);

    // Save to PostgreSQL if available
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO payments (id, user_id, bet_id, amount, currency, provider, status, phone_number, customer_email, country, metadata, provider_reference, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             provider_reference = COALESCE(EXCLUDED.provider_reference, payments.provider_reference),
             metadata = COALESCE(EXCLUDED.metadata, payments.metadata),
             updated_at = NOW()`,
          [
            payment.id,
            payment.userId,
            payment.betId || null,
            payment.amount,
            payment.currency,
            payment.provider,
            payment.status,
            payment.phoneNumber || null,
            payment.customerEmail || null,
            payment.country || null,
            payment.metadata ? JSON.stringify(payment.metadata) : null,
            payment.providerReference || null,
          ]
        );
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[PaymentDB] Error writing payment to PostgreSQL:", error.message);
      }
    }
  }

  /**
   * Retrieve a payment by ID or Provider Reference
   */
  async getPayment(paymentIdOrRef: string): Promise<PaymentRecord | null> {
    // Check in PostgreSQL first
    if (pool) {
      try {
        const res = await pool.query(
          `SELECT id, user_id as "userId", bet_id as "betId", amount, currency, provider, status,
                  phone_number as "phoneNumber", customer_email as "customerEmail", country,
                  metadata, provider_reference as "providerReference",
                  created_at as "createdAt", updated_at as "updatedAt"
           FROM payments
           WHERE id = $1 OR provider_reference = $1
           LIMIT 1`,
          [paymentIdOrRef]
        );
        if (res.rows.length > 0) {
          return res.rows[0] as PaymentRecord;
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[PaymentDB] Error reading payment from PostgreSQL:", error.message);
      }
    }

    // Fallback to local memory / JSON
    if (this.payments.has(paymentIdOrRef)) {
      return this.payments.get(paymentIdOrRef) || null;
    }
    for (const p of this.payments.values()) {
      if (p.providerReference === paymentIdOrRef) {
        return p;
      }
    }
    return null;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentRecordStatus,
    providerReference?: string,
    extraMetadata?: Record<string, unknown>
  ): Promise<PaymentRecord | null> {
    const existing = await this.getPayment(paymentId);
    if (!existing) return null;

    existing.status = status;
    if (providerReference) existing.providerReference = providerReference;
    if (extraMetadata) {
      existing.metadata = { ...(existing.metadata || {}), ...extraMetadata };
    }
    existing.updatedAt = new Date().toISOString();

    await this.savePayment(existing);
    return existing;
  }

  /**
   * Create a pending bet in database until payment is confirmed
   */
  async createPendingBet(bet: PendingBetRecord): Promise<string> {
    const now = new Date().toISOString();
    bet.createdAt = bet.createdAt || now;
    bet.status = "payment_pending";

    this.bets.set(bet.id, bet);
    saveJsonFile(PENDING_BETS_FILE, this.bets);

    // Write to PostgreSQL bets table
    if (pool) {
      try {
        // Find numeric user_id if user exists in PostgreSQL users table
        let numericUserId: number | null = null;
        const userRes = await pool.query(
          "SELECT id FROM users WHERE username = $1 OR id::text = $1 LIMIT 1",
          [bet.userId]
        );
        if (userRes.rows.length > 0) {
          numericUserId = userRes.rows[0].id;
        } else {
          // Check demo user 1
          numericUserId = 1;
        }

        // Validate bet_type for postgres enum (which uses uppercase labels)
        const upper = (bet.betType || "count_prediction").toUpperCase();
        const validBetType =
          upper === "TIME_PREDICTION" || upper === "EVENT_TRIGGER"
            ? upper
            : "COUNT_PREDICTION";

        await pool.query(
          `INSERT INTO bets (user_id, bet_type, criteria, amount, status, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            numericUserId,
            validBetType,
            JSON.stringify(bet.criteria),
            bet.amount,
            "payment_pending",
          ]
        );
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[PaymentDB] Error writing bet to PostgreSQL:", error.message);
      }
    }

    return bet.id;
  }

  /**
   * Get pending bet by ID
   */
  async getPendingBet(betId: string): Promise<PendingBetRecord | null> {
    return this.bets.get(betId) || null;
  }

  /**
   * Confirm pending bet once webhook confirms payment
   */
  async confirmPendingBet(betId: string): Promise<PendingBetRecord | null> {
    const bet = this.bets.get(betId);
    if (!bet) return null;

    bet.status = "pending"; // Ready for traffic analysis
    bet.resolvedAt = undefined;
    this.bets.set(betId, bet);
    saveJsonFile(PENDING_BETS_FILE, this.bets);

    if (pool) {
      try {
        await pool.query(
          `UPDATE bets SET status = 'pending' WHERE id = $1 OR (amount = $2 AND status = 'payment_pending')`,
          [isNaN(Number(betId)) ? -1 : Number(betId), bet.amount]
        );
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[PaymentDB] Error updating bet status in PostgreSQL:", error.message);
      }
    }

    return bet;
  }

  /**
   * Credit user balance and log transaction
   */
  async creditUserBalance(userId: string, amount: number, description: string): Promise<number> {
    // 1. Update in authUserService
    let user = authUserService.findUserById(userId);
    let newBalance = amount;
    if (user) {
      newBalance = (user.balance || 0) + amount;
      authUserService.updateUserBalance(user.id, newBalance);
    } else {
      user = {
        id: userId,
        name: userId,
        phone: null,
        email: `${userId}@junglebet.io`,
        provider: "credentials",
        providerAccountId: userId,
        balance: amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      authUserService.saveDirectUser(user);
      newBalance = amount;
    }

    // 2. Update in PostgreSQL
    if (pool) {
      try {
        const userRes = await pool.query(
          "SELECT id, v_coins FROM users WHERE username = $1 OR id::text = $1 OR \"providerAccountId\" = $1 LIMIT 1",
          [userId]
        );
        if (userRes.rows.length > 0) {
          const dbUserId = userRes.rows[0].id;
          const currentVCoins = Number(userRes.rows[0].v_coins || 0);
          const updatedVCoins = currentVCoins + amount;

          await pool.query("UPDATE users SET v_coins = $1 WHERE id = $2", [
            updatedVCoins,
            dbUserId,
          ]);

          await pool.query(
            "INSERT INTO transactions (user_id, amount, type, description, created_at) VALUES ($1, $2, $3, $4, NOW())",
            [dbUserId, amount, "deposit", description]
          );
        } else {
          const insertRes = await pool.query(
            "INSERT INTO users (username, hashed_password, v_coins, provider, \"providerAccountId\") VALUES ($1, $2, $3, 'credentials', $1) RETURNING id",
            [userId, "test_hash", amount]
          );
          const dbUserId = insertRes.rows[0].id;
          await pool.query(
            "INSERT INTO transactions (user_id, amount, type, description, created_at) VALUES ($1, $2, $3, $4, NOW())",
            [dbUserId, amount, "deposit", description]
          );
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[PaymentDB] Error updating PostgreSQL user balance:", error.message);
      }
    }

    return newBalance;
  }

  /**
   * Retrieve current user balance from database or authUserService
   */
  async getUserBalance(userId: string): Promise<number> {
    if (pool) {
      try {
        const res = await pool.query(
          "SELECT v_coins FROM users WHERE username = $1 OR id::text = $1 OR \"providerAccountId\" = $1 LIMIT 1",
          [userId]
        );
        if (res.rows.length > 0) {
          return Number(res.rows[0].v_coins || 0);
        }
      } catch (e) {
        console.warn("[PaymentDB] Error fetching user balance from postgres:", e);
      }
    }
    const user = authUserService.findUserById(userId);
    return user ? user.balance : 0;
  }
}

export const paymentDb = new PaymentDatabaseService();
