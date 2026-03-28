"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  const [profile, setProfile] = useState<{ nickname: string; icon_id: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const ICONS = [
    "🦁", "🐯", "🦊", "🐺", "🦝", "🐻", "🐼", "🦄",
    "🐲", "🦅", "🦉", "🦋", "🐬", "🦈", "🐙", "🦂",
    "🎭", "👑", "🎯", "⚡", "🔥", "💎", "🌙", "⭐"
  ];

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("nickname, icon_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        window.location.href = "/onboarding";
        return;
      }
      setProfile(profile);
      setLoading(false);
    }
    loadProfile();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: "18px" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "56px", marginBottom: "4px" }}>
            {ICONS[profile?.icon_id ?? 0]}
          </div>
          <h2 style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "400" }}>
            Welcome back,
          </h2>
          <h1 style={{ color: "var(--accent-gold)", fontSize: "28px", fontWeight: "800" }}>
            {profile?.nickname}
          </h1>
        </div>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "2px" }}>
            🃏 8 DREAMS
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "40px" }}>
          <button
            className="btn-primary animate-pulse-gold"
            style={{ width: "100%", fontSize: "18px", padding: "16px" }}
            onClick={() => window.location.href = "/create-room"}
          >
            🎮 Create Game
          </button>
          <button
            className="btn-secondary"
            style={{ width: "100%", fontSize: "18px", padding: "16px" }}
            onClick={() => window.location.href = "/join-room"}
          >
            🔑 Join Game
          </button>
        </div>

        {/* How to play */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          padding: "20px",
        }}>
          <h3 style={{ color: "var(--accent-gold)", fontWeight: "700", marginBottom: "12px", fontSize: "14px" }}>
            ❓ How to Play
          </h3>
          <div style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.8" }}>
            <p>🃏 48 cards, 2 players, 8 tricks</p>
            <p>♠ 3 of Spades = 50 pts · A = 25 · K = 20 · Q/J = 15</p>
            <p>🎯 Follow the lead suit or play any card</p>
            <p>🏆 Highest card of lead suit wins the trick</p>
            <p>👑 Most points at the end wins!</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            marginTop: "24px",
            width: "100%",
            textAlign: "center",
          }}
        >
          Sign out
        </button>

      </div>
    </div>
  );
}