"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Creating virtual machine...",
  "Installing dependencies...",
  "Configuring AI gateway...",
  "Starting AI assistant service...",
  "Waiting for gateway to respond...",
];

export function GatewayLoader({ openclawUrl, gatewayToken }: { openclawUrl?: string; gatewayToken?: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 15000);

    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (data.ready) {
          setReady(true);
          clearInterval(pollTimer);
          clearInterval(stepTimer);
          router.refresh();
        } else if (data.status === "active") {
          setStepIndex(STEPS.length - 1);
        } else if (data.status === "error") {
          clearInterval(pollTimer);
          clearInterval(stepTimer);
          router.refresh();
        }
      } catch {}
    }, 5000);

    return () => {
      clearInterval(stepTimer);
      clearInterval(pollTimer);
    };
  }, [router]);

  if (ready) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium">
          Your AI assistant is ready!
        </p>
        {openclawUrl && (
          <a
            href={`${openclawUrl}${gatewayToken ? `?token=${gatewayToken}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Open OpenClaw Dashboard
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 space-y-4">
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {i < stepIndex ? (
              <svg
                className="h-4 w-4 text-green-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : i === stepIndex ? (
              <svg
                className="animate-spin h-4 w-4 text-yellow-700 shrink-0"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
            )}
            <span
              className={i <= stepIndex ? "text-yellow-800" : "text-gray-400"}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-yellow-600">
        This usually takes 3-5 minutes. Please don&apos;t close this page.
      </p>
    </div>
  );
}
