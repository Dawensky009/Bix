import { useState, type FormEvent } from "react";
import { supabase } from "./supabase";

type Mode = "signin" | "signup";

export function Auth() {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setLoading(true);
    setError("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSent(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">b.</span>BIX
          <span className="brand-dot">●</span>
        </div>
        <p className="auth-tagline">Track your edge. Keep your data.</p>

        {sent ? (
          <div className="auth-sent">
            <div className="auth-sent-icon">✓</div>
            <strong>Check your inbox.</strong>
            <p>
              We sent a confirmation link to your email. Click it to activate
              your account, then sign in here.
            </p>
            <button
              className="secondary"
              onClick={() => {
                setSent(false);
                switchMode("signin");
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab${mode === "signin" ? " active" : ""}`}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                className={`auth-tab${mode === "signup" ? " active" : ""}`}
                onClick={() => switchMode("signup")}
              >
                Create account
              </button>
            </div>

            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="auth-form">
              <label>
                Email
                <input
                  autoFocus
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder={
                    mode === "signup" ? "Min. 6 characters" : "Your password"
                  }
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
              <button className="primary" type="submit" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
