"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSignup} className="space-y-6">
      <h1 className="text-3xl font-bold text-center">Create account</h1>
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
        placeholder="Password (min 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg"
        minLength={6}
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-gray-600">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </form>
  );
}
