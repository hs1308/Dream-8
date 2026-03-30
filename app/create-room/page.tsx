"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateRoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    async function createRoom() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      // Generate unique code
      let code = "";
      let isUnique = false;
      while (!isUnique) {
        code = generateRoomCode();
        const { data } = await supabase
          .from("dreams_rooms")
          .select("id")
          .eq("code", code)
          .single();
        if (!data) isUnique = true;
      }

      // Create room
      const { data: room, error } = await supabase
        .from("dreams_rooms")
        .insert({ code, host_id: user.id, status: "waiting" })
        .select()
        .single();

      if (error || !room) {
        console.error(error);
        return;
      }

      setRoomCode(code);
      setRoomId(room.id);
      setLoading(false);

      // Listen for guest joining via polling as backup
      const channel = supabase
        .channel(`room-${room.id}`)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "dreams_rooms",
          filter: `id=eq.${room.id}`,
        }, (payload) => {
          console.log("Room update received:", payload.new);
          if (payload.new.guest_id && payload.new.status === "active") {
            window.location.href = `/game/${room.id}`;
          }
        })
        .subscribe((status) => {
          console.log("Subscription status:", status);
        });

      channelRef.current = channel;

      // Polling fallback every 3 seconds
      const pollInterval = setInterval(async () => {
        const { data: updatedRoom } = await supabase
          .from("dreams_rooms")
          .select("*")
          .eq("id", room.id)
          .single();
        
        if (updatedRoom?.guest_id && updatedRoom?.status === "active") {
          clearInterval(pollInterval);
          window.location.href = `/game/${room.id}`;
        }
      }, 3000);

      return () => {
        clearInterval(pollInterval);
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      };
    }
    createRoom();
  }, []);

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: "18px" }}>Creating room...</div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>

        <div style={{ fontSize: "56px", marginBottom: "16px" }}>🃏</div>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--accent-gold)", marginBottom: "8px" }}>
          Game Created!
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>
          Share this code with your friend
        </p>

        <div style={{
          background: "var(--bg-card)",
          border: "2px solid var(--accent-gold)",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "24px",
        }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "12px" }}>
            ROOM CODE
          </p>
          <div style={{
            fontSize: "48px",
            fontWeight: "900",
            color: "var(--accent-gold)",
            letterSpacing: "12px",
            marginBottom: "20px",
            fontFamily: "monospace",
          }}>
            {roomCode}
          </div>
          <button className="btn-secondary" onClick={copyCode} style={{ width: "100%" }}>
            {copied ? "✅ Copied!" : "📋 Copy Code"}
          </button>
        </div>

        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <div style={{
              width: "10px", height: "10px", borderRadius: "50%",
              background: "var(--accent-gold)",
              animation: "pulse-gold 2s infinite",
            }} />
            <span style={{ color: "var(--text-secondary)" }}>
              Waiting for your opponent to join...
            </span>
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={() => window.location.href = "/home"}
          style={{ width: "100%" }}
        >
          ← Back to Home
        </button>

      </div>
    </div>
  );
}