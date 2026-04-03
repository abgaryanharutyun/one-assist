"use client";

interface Props {
  appName: string;
  onChange: (fields: { appName?: string }) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AppDetailsStep({ appName, onChange, onBack, onNext }: Props) {
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

        <div className="bg-gray-50 border rounded-lg p-4">
          <p className="text-sm text-gray-600">
            You can set a custom app icon after setup in your{" "}
            <span className="font-medium">Slack app settings</span> under Display Information.
          </p>
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
