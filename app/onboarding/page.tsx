"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const ICONS = [
  "🦁", "🐯", "🦊", "🐺", "🦝", "🐻", "🐼", "🦄",
  "🐲", "🦅", "🦉", "🦋", "🐬", "🦈", "🐙", "🦂",
  "🎭", "👑", "🎯", "⚡", "🔥", "💎", "🌙", "⭐"
];

export default function OnboardingPage() {
  const [nickname, setNickname] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = "/login";
      } else {
        setUserId(data.user.id);
      }
    });
  }, []);

  async function handleSubmit() {
    if (!nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }
    if (nickname.trim().length < 2) {
      setError("Nickname must be at least 2 characters");
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await supabase.from("user_profiles").insert({
      id: userId,
      nickname: nickname.trim(),
      icon_id: selectedIcon,
      coins: 100,
    });

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        setError("This nickname is taken, try another!");
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      window.location.href = "/home";
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: "480px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>
            {ICONS[selectedIcon]}
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--accent-gold)" }}>
            Set up your profile
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
            Choose how you appear at the table
          </p>
        </div>

        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          padding: "32px",
        }}>
          {/* Nickname */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{
              display: "block",
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginBottom: "6px",
              fontWeight: "500",
            }}>
              Your nickname
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. CardShark99"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Max 20 characters. This is what other players will see.
            </p>
          </div>

          {/* Icon picker */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{
              display: "block",
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginBottom: "12px",
              fontWeight: "500",
            }}>
              Pick your icon
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "8px",
            }}>
              {ICONS.map((icon, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIcon(index)}
                  style={{
                    fontSize: "24px",
                    padding: "8px",
                    borderRadius: "8px",
                    border: selectedIcon === index
                      ? "2px solid var(--accent-gold)"
                      : "2px solid transparent",
                    background: selectedIcon === index
                      ? "rgba(201,168,76,0.15)"
                      : "var(--bg-secondary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    transform: selectedIcon === index ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              background: "rgba(224,82,82,0.1)",
              border: "1px solid rgba(224,82,82,0.3)",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
              color: "var(--red-suit)",
              fontSize: "14px",
            }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: "100%", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Setting up..." : "Let's play! 🃏"}
          </button>
        </div>
      </div>
    </div>
  );
}