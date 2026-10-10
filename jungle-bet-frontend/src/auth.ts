import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import { authUserService } from "@/lib/auth-user-service";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID || process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_SECRET || process.env.AUTH_GOOGLE_SECRET || "",
    }),
    Apple({
      clientId: process.env.APPLE_ID || process.env.AUTH_APPLE_ID || "",
      clientSecret: process.env.APPLE_SECRET || process.env.AUTH_APPLE_SECRET || "",
    }),
    Credentials({
      name: "Phone/Email and Password",
      credentials: {
        identifier: { label: "Phone or Email", type: "text", placeholder: "+1234567890 or racer@junglebet.io" },
        phone: { label: "Phone Number", type: "text" },
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(
          credentials?.identifier || credentials?.phone || credentials?.email || ""
        ).trim();
        const password = String(credentials?.password || "");

        if (!identifier || !password) {
          return null;
        }

        const user = authUserService.verifyCredentials(identifier, password);
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          image: user.image,
          provider: "credentials",
          providerAccountId: user.phone || user.email || user.id,
          balance: user.balance,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "apple") {
        const oauthUser = authUserService.upsertOAuthUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user.email,
          name: user.name,
          image: user.image,
        });
        user.id = oauthUser.id;
        user.phone = oauthUser.phone;
        user.balance = oauthUser.balance;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone || null;
        token.provider = account?.provider || user.provider || "credentials";
        token.providerAccountId =
          account?.providerAccountId || user.providerAccountId || user.phone || user.id;
        token.balance = user.balance ?? 100.0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.phone = (token.phone as string) || null;
        session.user.provider = (token.provider as string) || "credentials";
        session.user.providerAccountId = (token.providerAccountId as string) || null;
        session.user.balance = typeof token.balance === "number" ? token.balance : 100.0;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "jungle-bet-super-secret-jwt-key-2026-production",
  trustHost: true,
});
