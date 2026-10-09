import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from "sonner";
import { Toaster as HotToaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jungle Bet | High Octane Live Racing & Wagering",
  description: "Experience high-speed live street racing odds with Jungle Green neon energy and instant NextAuth authentication.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050505] text-white">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            theme="dark"
            toastOptions={{
              style: {
                background: "#121214",
                border: "1px solid rgba(204, 255, 0, 0.2)",
                color: "#fff",
              },
            }}
          />
          <HotToaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#121214",
                border: "1px solid rgba(204, 255, 0, 0.3)",
                color: "#fff",
                boxShadow: "0 0 20px rgba(204, 255, 0, 0.2)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
