import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

export interface JungleUser {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  image?: string | null;
  passwordHash?: string | null;
  provider: string;
  providerAccountId: string;
  balance: number;
  twoFactorEnabled?: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  isBanned?: boolean;
  bannedAt?: string;
  role?: "admin" | "user";
  createdAt: string;
  updatedAt: string;
}

// In-memory cache + file-backed persistent store for development & runtime
const USERS_FILE = path.join(process.cwd(), ".auth-users.json");

// Default initial demo accounts
const INITIAL_DEMO_USERS: JungleUser[] = [
  {
    id: "usr_demo_vip_001",
    name: "Jungle VIP Racer",
    phone: "+1234567890",
    email: "racer@junglebet.io",
    passwordHash: bcrypt.hashSync("password123", 10),
    provider: "credentials",
    providerAccountId: "+1234567890",
    balance: 500.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "usr_demo_kenya_002",
    name: "Nairobi Speedster",
    phone: "+254700000000",
    email: "speedster@junglebet.io",
    passwordHash: bcrypt.hashSync("password123", 10),
    provider: "credentials",
    providerAccountId: "+254700000000",
    balance: 250.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "test_user_01",
    name: "test_user_01",
    phone: "+256700000001",
    email: "test_user_01@junglebet.io",
    passwordHash: bcrypt.hashSync("password123", 10),
    provider: "credentials",
    providerAccountId: "test_user_01",
    balance: 0.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class AuthUserService {
  private users: Map<string, JungleUser> = new Map();
  private isLoaded = false;
  private lastMtime = 0;

  constructor() {
    this.loadUsers();
  }

  public reloadUsers() {
    this.isLoaded = false;
    this.loadUsers();
  }

  private loadUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const stat = fs.statSync(USERS_FILE);
        if (this.isLoaded && stat.mtimeMs <= this.lastMtime) {
          return;
        }
        this.lastMtime = stat.mtimeMs;
        const raw = fs.readFileSync(USERS_FILE, "utf-8");
        const list: JungleUser[] = JSON.parse(raw);
        for (const u of list) {
          this.users.set(u.id, u);
        }
      }
    } catch (e) {
      console.warn("[AuthUserService] Failed to load users file, using initial data:", e);
    }

    // Ensure demo accounts always exist
    for (const demo of INITIAL_DEMO_USERS) {
      if (!this.users.has(demo.id)) {
        this.users.set(demo.id, demo);
      }
    }
    this.isLoaded = true;
  }

  private saveUsers() {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (e) {
      console.warn("[AuthUserService] Could not persist users to file (read-only filesystem or serverless):", e);
    }
  }

  public normalizePhone(phone: string): string {
    // Keep numbers and leading plus sign
    const cleaned = phone.replace(/[^\d+]/g, "").trim();
    if (!cleaned.startsWith("+") && cleaned.length >= 10) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  public findUserById(id: string): JungleUser | null {
    this.loadUsers();
    if (this.users.has(id)) return this.users.get(id) || null;
    for (const u of this.users.values()) {
      if (u.id === id || u.providerAccountId === id || u.name === id) {
        return u;
      }
    }
    return null;
  }

  public saveDirectUser(user: JungleUser): void {
    this.loadUsers();
    this.users.set(user.id, user);
    this.saveUsers();
  }

  public findUserByPhone(phone: string): JungleUser | null {
    this.loadUsers();
    const normalized = this.normalizePhone(phone);
    for (const user of this.users.values()) {
      if (user.phone && this.normalizePhone(user.phone) === normalized) {
        return user;
      }
    }
    return null;
  }

  public findUserByEmail(email: string): JungleUser | null {
    this.loadUsers();
    const lower = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email && user.email.toLowerCase().trim() === lower) {
        return user;
      }
    }
    return null;
  }

  public findUserByProviderAccount(provider: string, providerAccountId: string): JungleUser | null {
    this.loadUsers();
    for (const user of this.users.values()) {
      if (user.provider === provider && user.providerAccountId === providerAccountId) {
        return user;
      }
    }
    return null;
  }

  public registerCredentialsUser(phone: string, password: string, name?: string): JungleUser {
    this.loadUsers();
    const normalized = this.normalizePhone(phone);
    if (!normalized || normalized.length < 7) {
      throw new Error("Invalid phone number format");
    }

    if (this.findUserByPhone(normalized)) {
      throw new Error("This phone number is already registered. Please log in.");
    }

    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newUser: JungleUser = {
      id,
      name: name?.trim() || `Racer_${normalized.slice(-4)}`,
      phone: normalized,
      email: null,
      passwordHash,
      provider: "credentials",
      providerAccountId: normalized,
      balance: 100.0, // Initial bonus credits
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(id, newUser);
    this.saveUsers();
    return newUser;
  }

  public verifyCredentials(phone: string, password: string): JungleUser | null {
    this.loadUsers();
    const user = this.findUserByPhone(phone);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return null;
    }
    return user;
  }

  public upsertOAuthUser({
    provider,
    providerAccountId,
    email,
    name,
    image,
  }: {
    provider: string;
    providerAccountId: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  }): JungleUser {
    this.loadUsers();
    
    // Check if account already exists with this provider and account ID
    const existing = this.findUserByProviderAccount(provider, providerAccountId);
    if (existing) {
      existing.name = name || existing.name;
      existing.image = image || existing.image;
      existing.updatedAt = new Date().toISOString();
      this.users.set(existing.id, existing);
      this.saveUsers();
      return existing;
    }

    // Check by email if present to link
    if (email) {
      const byEmail = this.findUserByEmail(email);
      if (byEmail) {
        byEmail.provider = provider;
        byEmail.providerAccountId = providerAccountId;
        byEmail.name = name || byEmail.name;
        byEmail.image = image || byEmail.image;
        byEmail.updatedAt = new Date().toISOString();
        this.users.set(byEmail.id, byEmail);
        this.saveUsers();
        return byEmail;
      }
    }

    // Create new OAuth user
    const id = `usr_oauth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: JungleUser = {
      id,
      name: name || (email ? email.split("@")[0] : `Jungle_${provider}_User`),
      phone: null,
      email: email || null,
      image: image || null,
      passwordHash: null,
      provider,
      providerAccountId,
      balance: 100.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(id, newUser);
    this.saveUsers();
    return newUser;
  }

  public updateUserBalance(userId: string, newBalance: number): boolean {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return false;
    user.balance = newBalance;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    return true;
  }

  public flagUser(userId: string, reason: string): boolean {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return false;
    user.isFlagged = true;
    user.flagReason = reason;
    user.flaggedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    console.warn(`[FRAUD ALERT] User ${userId} (${user.name}) flagged as Suspicious: ${reason}`);
    return true;
  }

  public unflagUser(userId: string): boolean {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return false;
    user.isFlagged = false;
    user.flagReason = undefined;
    user.flaggedAt = undefined;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    return true;
  }

  public banUser(userId: string): boolean {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return false;
    user.isBanned = true;
    user.bannedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    console.warn(`[SECURITY BAN] User ${userId} (${user.name}) has been BANNED.`);
    return true;
  }

  public unbanUser(userId: string): boolean {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return false;
    user.isBanned = false;
    user.bannedAt = undefined;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    return true;
  }

  public toggleTwoFactor(userId: string, enabled?: boolean): boolean {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return false;
    user.twoFactorEnabled = enabled !== undefined ? enabled : !user.twoFactorEnabled;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    return user.twoFactorEnabled;
  }

  public updateUserProfile(userId: string, updates: Partial<JungleUser>): JungleUser | null {
    this.loadUsers();
    const user = this.users.get(userId);
    if (!user) return null;
    if (updates.name) user.name = updates.name.trim();
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.phone !== undefined) user.phone = updates.phone;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.saveUsers();
    return user;
  }

  public deleteUser(userId: string): boolean {
    this.loadUsers();
    if (!this.users.has(userId)) return false;
    this.users.delete(userId);
    this.saveUsers();
    return true;
  }

  public getFlaggedUsers(): JungleUser[] {
    this.loadUsers();
    return Array.from(this.users.values()).filter((u) => u.isFlagged || u.isBanned);
  }

  public getAllUsers(): JungleUser[] {
    this.loadUsers();
    return Array.from(this.users.values());
  }
}

export const authUserService = new AuthUserService();
