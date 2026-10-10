"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "register") {
      router.replace("/signup");
    } else {
      router.replace("/login");
    }
  }, [router, searchParams]);

  return (
    <div className="w-8 h-8 border-2 border-[#14b8a6] border-t-transparent rounded-full animate-spin" />
  );
}

export default function AuthRedirectPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <Suspense
        fallback={
          <div className="w-8 h-8 border-2 border-[#14b8a6] border-t-transparent rounded-full animate-spin" />
        }
      >
        <AuthRedirectContent />
      </Suspense>
    </div>
  );
}
