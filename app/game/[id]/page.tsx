"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { use } from "react";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoom() {
      const { data } = await supabase
        .from("dreams_rooms")
        .select("*")
        .eq("id", id)
        .single();
      setRoom(data);
      setLoading(false);
    }
    loadRoom();
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: "18px" }}>Loading game...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "var(--accent-gold)" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>🃏</div>
        <h1 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "8px" }}>
          Game Room
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
          Room code: <strong style={{ color: "var(--accent-gold)" }}>{room?.code}</strong>
        </p>
        <p style={{ color: "var(--text-secondary)" }}>
          Both players connected! Game coming soon...
        </p>
      </div>
    </div>
  );
}