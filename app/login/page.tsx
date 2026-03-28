"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email for a confirmation link!");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else if (data.user) {
        // Check if profile exists
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id, nickname")
          .eq("id", data.user.id)
          .single();

        if (profile?.nickname) {
          window.location.href = "/home";
        } else {
          window.location.href = "/onboarding";
        }
      }
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div
            style={{
              fontSize: "64px",
              marginBottom: "8px",
              filter: "drop-shadow(0 4px 12px rgba(201,168,76,0.4))",
            }}
          >
            🃏
          </div>
          <h1
            style={{
              fontSize: "42px",
              fontWeight: "800",
              color: "var(--accent-gold)",
              letterSpacing: "-1px",
              lineHeight: 1,
            }}
          >
            8 Dreams
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "14px" }}>
            The card game of tricks & glory
          </p>
        </div>

        {/* Form */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "16px",
            padding: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "700",
              marginBottom: "24px",
              color: "var(--text-primary)",
            }}
          >
            {isSignUp ? "Create account" : "Welcome back"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                  fontWeight: "500",
                }}
              >
                Email
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                  fontWeight: "500",
                }}
              >
                Password
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(224,82,82,0.1)",
                  border: "1px solid rgba(224,82,82,0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: "var(--red-suit)",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            {message && (
              <div
                style={{
                  background: "rgba(45,90,45,0.3)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: "var(--accent-gold)",
                  fontSize: "14px",
                }}
              >
                {message}
              </div>
            )}

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: "100%", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            {isSignUp ? "Already have an account?" : "New here?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setMessage("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent-gold)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              {isSignUp ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}