"use client";

interface Props {
  value: string;
  onChange: (token: string) => void;
  onNext: () => void;
}

export function SlackTokenStep({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect Slack</h2>
        <p className="text-gray-600 mt-2">
          Paste your Slack App Configuration Token to get started.
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
        <p className="font-medium">How to get your token:</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">api.slack.com/apps</a></li>
          <li>Select your workspace from the top right</li>
          <li>Scroll to &quot;Your App Configuration Tokens&quot;</li>
          <li>Click &quot;Generate Token&quot; and copy it</li>
        </ol>
        <p className="text-gray-500">Token starts with <code>xoxe-</code> and expires in 12 hours.</p>
      </div>

      <textarea
        placeholder="Paste your configuration token here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg font-mono text-sm h-24 resize-none"
      />

      <button
        onClick={onNext}
        disabled={!value.trim()}
        className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
