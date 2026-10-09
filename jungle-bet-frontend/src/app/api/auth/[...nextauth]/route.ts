import { handlers } from "@/auth";

/**
 * NextAuth v5 Route Handler
 * Handles Google OAuth, Apple Sign In, and Phone/Password Credentials authentication.
 */
export const { GET, POST } = handlers;
