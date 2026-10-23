"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      router.replace("/admin/mobile");
    } else {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center p-4">
      <div className="flex items-center gap-3 text-sm text-gray-400 font-mono">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--jungle-green)] animate-ping" />
        <span>Routing to RUSH HOUR BET Admin Ops...</span>
      </div>
    </div>
  );
}
