import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from "sonner";
import { Toaster as HotToaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
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
      className={`${inter.variable} ${poppins.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0f172a] text-slate-100 font-sans selection:bg-[#14b8a6] selection:text-slate-950">
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
