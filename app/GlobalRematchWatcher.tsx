"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "./lib/supabase";

type RoomRow = {
  id: string;
  code: string | null;
  host_id: string;
  guest_id: string | null;
  created_at?: string | null;
  rematch_requested_by: string | null;
  rematch_declined: boolean | null;
  rematch_room_id: string | null;
};

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function GlobalRematchWatcher() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string>("");
  const [incomingRoom, setIncomingRoom] = useState<RoomRow | null>(null);
  const [opponentName, setOpponentName] = useState("your opponent");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lastRedirectRef = useRef<string | null>(null);
  const activeSourceRoomRef = useRef<string | null>(null);
  const isAuthRoute = pathname === "/login" || pathname === "/onboarding";

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        setUserId(data.user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUserId(session?.user?.id ?? "");
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setIncomingRoom(null);
      setOpponentName("your opponent");
      setBusy(false);
      setMessage("");
      lastRedirectRef.current = null;
      activeSourceRoomRef.current = null;
      return;
    }

    if (isAuthRoute) {
      setIncomingRoom(null);
      setBusy(false);
      setMessage("");
      return;
    }

    let cancelled = false;

    async function pollRooms() {
      const { data: rooms, error } = await supabase
        .from("dreams_rooms")
        .select("id, code, host_id, guest_id, created_at, rematch_requested_by, rematch_declined, rematch_room_id")
        .or(`host_id.eq.${userId},guest_id.eq.${userId}`);

      if (cancelled || error || !rooms) return;

      const sortedRooms = [...rooms].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      const relevantRooms = sortedRooms.filter(
        (room) =>
          room.rematch_requested_by ||
          room.rematch_declined === true ||
          room.rematch_room_id ||
          activeSourceRoomRef.current === room.id
      );

      const redirectRoom = relevantRooms.find(
        (room) => room.rematch_room_id && activeSourceRoomRef.current === room.id
      );
      if (redirectRoom?.rematch_room_id && lastRedirectRef.current !== redirectRoom.rematch_room_id) {
        lastRedirectRef.current = redirectRoom.rematch_room_id;
        activeSourceRoomRef.current = null;
        setIncomingRoom(null);
        if (pathname !== `/game/${redirectRoom.rematch_room_id}`) {
          window.location.href = `/game/${redirectRoom.rematch_room_id}`;
          return;
        }
      }

      const pendingIncoming = relevantRooms.find(
        (room) =>
          room.rematch_requested_by &&
          room.rematch_requested_by !== userId &&
          room.rematch_declined !== true &&
          !room.rematch_room_id
      );

      if (!pendingIncoming) {
        setIncomingRoom(null);
        setMessage("");
        return;
      }

      activeSourceRoomRef.current = pendingIncoming.id;
      setIncomingRoom(pendingIncoming);

      const requesterId = pendingIncoming.rematch_requested_by!;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("nickname")
        .eq("id", requesterId)
        .maybeSingle();

      if (!cancelled) {
        setOpponentName(profile?.nickname ?? "your opponent");
      }
    }

    void pollRooms();
    const interval = setInterval(() => {
      void pollRooms();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthRoute, pathname, userId]);

  async function createUniqueRematchCode() {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode();
      const { data } = await supabase
        .from("dreams_rooms")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      if (!data) return code;
    }

    throw new Error("Could not generate a rematch code.");
  }

  async function acceptRematch() {
    if (!incomingRoom) return;

    setBusy(true);
    setMessage("");
    activeSourceRoomRef.current = incomingRoom.id;

    try {
      const code = await createUniqueRematchCode();
      const { data: newRoom, error: createError } = await supabase
        .from("dreams_rooms")
        .insert({
          code,
          host_id: incomingRoom.guest_id,
          guest_id: incomingRoom.host_id,
          status: "active",
          started_at: new Date().toISOString(),
          rematch_requested_by: null,
          rematch_declined: false,
          rematch_room_id: null,
        })
        .select()
        .maybeSingle();

      if (createError || !newRoom) {
        throw createError ?? new Error("Could not create the rematch room.");
      }

      const { error: linkError } = await supabase
        .from("dreams_rooms")
        .update({ rematch_room_id: newRoom.id, rematch_requested_by: null, rematch_declined: false })
        .eq("id", incomingRoom.id);

      if (linkError) {
        throw linkError;
      }

      lastRedirectRef.current = newRoom.id;
      activeSourceRoomRef.current = null;
      window.location.href = `/game/${newRoom.id}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the rematch.");
      setBusy(false);
    }
  }

  async function declineRematch() {
    if (!incomingRoom) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("dreams_rooms")
      .update({ rematch_declined: true, rematch_requested_by: null, rematch_room_id: null })
      .eq("id", incomingRoom.id);

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setIncomingRoom(null);
    activeSourceRoomRef.current = null;
    setBusy(false);
  }

  if (!incomingRoom || pathname.startsWith("/end/") || isAuthRoute || !userId) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 200,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-card)",
          border: "1px solid var(--accent-gold)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>🔄</div>
        <div style={{ color: "var(--accent-gold)", fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Rematch Request
        </div>
        <div style={{ color: "var(--text-secondary)", textAlign: "center", fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>
          {opponentName} wants to play again. Accept to jump straight into the next game.
        </div>

        {message && (
          <div style={{ background: "rgba(224,82,82,0.08)", border: "1px solid var(--red-suit)", borderRadius: 12, padding: 12, textAlign: "center", color: "var(--red-suit)", fontSize: 13, marginBottom: 14 }}>
            {message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn-primary" onClick={acceptRematch} disabled={busy} style={{ width: "100%", padding: 14, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Starting..." : "Accept Rematch"}
          </button>
          <button className="btn-secondary" onClick={declineRematch} disabled={busy} style={{ width: "100%", padding: 14, opacity: busy ? 0.7 : 1 }}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
