"use client";

interface Props {
  provider: string;
  apiKey: string;
  onChange: (fields: { provider?: string; apiKey?: string }) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ApiKeyStep({ provider, apiKey, onChange, onBack, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Provider</h2>
        <p className="text-gray-600 mt-2">
          Choose your AI provider and enter your API key.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange({ provider: "anthropic" })}
            className={`flex-1 py-3 border rounded-lg text-sm font-medium ${
              provider === "anthropic"
                ? "border-black bg-black text-white"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            Anthropic (Claude)
          </button>
          <button
            type="button"
            onClick={() => onChange({ provider: "openai" })}
            className={`flex-1 py-3 border rounded-lg text-sm font-medium ${
              provider === "openai"
                ? "border-black bg-black text-white"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            OpenAI (GPT)
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
          {provider === "anthropic" ? (
            <>
              <p className="font-medium">Get your Anthropic API key:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">console.anthropic.com</a></li>
                <li>Create a new API key</li>
                <li>Copy and paste it below</li>
              </ol>
              <p className="text-gray-500">Key starts with <code>sk-ant-</code></p>
            </>
          ) : (
            <>
              <p className="font-medium">Get your OpenAI API key:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">platform.openai.com</a></li>
                <li>Create a new API key</li>
                <li>Copy and paste it below</li>
              </ol>
              <p className="text-gray-500">Key starts with <code>sk-</code></p>
            </>
          )}
        </div>

        <input
          type="password"
          placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
          value={apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
          className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border rounded-lg hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!apiKey.trim()}
          className="flex-1 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
