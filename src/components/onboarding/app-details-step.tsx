"use client";

import { useRef } from "react";

interface Props {
  appName: string;
  appImage: File | null;
  onChange: (fields: { appName?: string; appImage?: File | null }) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AppDetailsStep({ appName, appImage, onChange, onBack, onNext }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Customize your bot</h2>
        <p className="text-gray-600 mt-2">
          Choose how your AI assistant appears in Slack.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">App name</label>
          <input
            type="text"
            placeholder="e.g. My AI Assistant"
            value={appName}
            onChange={(e) => onChange({ appName: e.target.value })}
            maxLength={35}
            className="w-full px-4 py-3 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">{appName.length}/35 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">App image</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-gray-400"
          >
            {appImage ? (
              <p className="text-sm text-gray-700">{appImage.name}</p>
            ) : (
              <p className="text-sm text-gray-500">Click to upload an image (PNG or JPG)</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => onChange({ appImage: e.target.files?.[0] || null })}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border rounded-lg hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!appName.trim()}
          className="flex-1 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
