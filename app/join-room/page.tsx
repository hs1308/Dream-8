"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function JoinRoomPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
    });
  }, []);

  async function handleJoin() {
    if (code.trim().length !== 5) {
      setError("Please enter a valid 5-character room code");
      return;
    }
    setLoading(true);
    setError("");

    // Find room
    const { data: room, error: roomError } = await supabase
      .from("dreams_rooms")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("status", "waiting")
      .maybeSingle();

    console.log("Room found:", room, "Error:", roomError);

    if (roomError || !room) {
      setError("Room not found or game already started. Check your code!");
      setLoading(false);
      return;
    }

    if (room.host_id === userId) {
      setError("You can't join your own room!");
      setLoading(false);
      return;
    }

    // Update room
    const { error: joinError } = await supabase
      .from("dreams_rooms")
      .update({ guest_id: userId, status: "active" })
      .eq("id", room.id);

    console.log("Join error:", joinError);

    if (joinError) {
      setError(`Failed to join: ${joinError.message}`);
      setLoading(false);
      return;
    }

    window.location.href = `/game/${room.id}`;
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "56px", marginBottom: "16px" }}>🔑</div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--accent-gold)" }}>
            Join a Game
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
            Enter the 5-character code from your friend
          </p>
        </div>

        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          padding: "32px",
        }}>
          <input
            className="input-field"
            type="text"
            placeholder="e.g. AB3KX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            style={{
              fontSize: "32px",
              fontWeight: "800",
              letterSpacing: "8px",
              textAlign: "center",
              fontFamily: "monospace",
              marginBottom: "16px",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />

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
            onClick={handleJoin}
            disabled={loading || code.length !== 5}
            style={{ width: "100%", opacity: loading || code.length !== 5 ? 0.7 : 1 }}
          >
            {loading ? "Joining..." : "Join Game 🎮"}
          </button>
        </div>

        <button
          onClick={() => window.location.href = "/home"}
          style={{
            background: "none", border: "none",
            color: "var(--text-muted)", cursor: "pointer",
            fontSize: "14px", marginTop: "20px",
            width: "100%", textAlign: "center",
          }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}