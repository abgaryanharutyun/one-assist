"use client";

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
