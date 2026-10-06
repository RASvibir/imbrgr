"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", { login, password, redirect: false });
    if (res?.error) setError("Invalid credentials");
    else window.location.href = "/";
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Email or username"
          className="w-full rounded-lg border px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border px-3 py-2"
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="submit" className="w-full rounded-lg bg-[var(--accent-primary)] py-2 font-semibold text-[var(--on-accent)]">
          Sign in
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        No account? <Link href="/auth/signup">Sign up</Link>
      </p>
    </div>
  );
}
