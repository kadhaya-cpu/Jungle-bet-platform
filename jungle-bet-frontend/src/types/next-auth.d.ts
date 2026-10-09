import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone?: string | null;
      provider?: string;
      providerAccountId?: string | null;
      balance?: number;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    phone?: string | null;
    provider?: string;
    providerAccountId?: string | null;
    balance?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    phone?: string | null;
    provider?: string;
    providerAccountId?: string | null;
    balance?: number;
  }
}
