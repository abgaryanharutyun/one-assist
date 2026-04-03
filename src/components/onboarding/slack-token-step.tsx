"use client";

interface Props {
  configToken: string;
  configRefreshToken: string;
  onChange: (fields: { configToken?: string; configRefreshToken?: string }) => void;
  onNext: () => void;
}

export function SlackTokenStep({ configToken, configRefreshToken, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect Slack</h2>
        <p className="text-gray-600 mt-2">
          Paste your Slack App Configuration Token and Refresh Token to get started.
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
        <p className="font-medium">How to get your tokens:</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">api.slack.com/apps</a></li>
          <li>Select your workspace from the top right</li>
          <li>Scroll to &quot;Your App Configuration Tokens&quot;</li>
          <li>Click &quot;Generate Token&quot; and copy both the access token and refresh token</li>
        </ol>
        <p className="text-gray-500">Access token starts with <code>xoxe-</code> and expires in 12 hours.</p>
      </div>

      <div className="space-y-3">
        <textarea
          placeholder="Access token (xoxe-...)"
          value={configToken}
          onChange={(e) => onChange({ configToken: e.target.value })}
          className="w-full px-4 py-3 border rounded-lg font-mono text-sm h-20 resize-none"
        />
        <textarea
          placeholder="Refresh token (xoxe-...)"
          value={configRefreshToken}
          onChange={(e) => onChange({ configRefreshToken: e.target.value })}
          className="w-full px-4 py-3 border rounded-lg font-mono text-sm h-20 resize-none"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!configToken.trim() || !configRefreshToken.trim()}
        className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
