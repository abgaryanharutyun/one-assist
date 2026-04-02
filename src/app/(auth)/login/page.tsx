"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      <h1 className="text-3xl font-bold text-center">Sign in</h1>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </form>
  );
}
