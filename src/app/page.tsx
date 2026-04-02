import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">OpenClaw</h1>
        <p className="text-xl text-gray-600">
          Your personal AI assistant in Slack. Set up in 2 minutes.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border rounded-lg hover:bg-gray-50 font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
