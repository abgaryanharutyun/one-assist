"use client";

import { useState } from "react";

interface Props {
  data: {
    configToken: string;
    appName: string;
    appImage: File | null;
  };
  onBack: () => void;
}

export function AuthorizeStep({ data, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateApp() {
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("configToken", data.configToken);
      formData.append("appName", data.appName);
      if (data.appImage) formData.append("appImage", data.appImage);

      const res = await fetch("/api/onboarding/create-slack-app", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to create Slack app");
        setLoading(false);
        return;
      }

      // Redirect to Slack OAuth authorization
      window.location.href = result.oauthUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Create &amp; authorize</h2>
        <p className="text-gray-600 mt-2">
          We&apos;ll create your Slack app and redirect you to authorize it.
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg space-y-2 text-sm">
        <p><span className="font-medium">App name:</span> {data.appName}</p>
        <p><span className="font-medium">Image:</span> {data.appImage?.name || "None"}</p>
        <p><span className="font-medium">Token:</span> {data.configToken.slice(0, 12)}...</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={loading} className="flex-1 py-3 border rounded-lg hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={handleCreateApp}
          disabled={loading}
          className="flex-1 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Creating app..." : "Create & Authorize"}
        </button>
      </div>
    </div>
  );
}
