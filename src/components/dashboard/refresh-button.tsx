"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="ml-2 underline"
    >
      Refresh
    </button>
  );
}

export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
