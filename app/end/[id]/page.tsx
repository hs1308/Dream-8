"use client";

import { useEffect, useState, useRef } from "react";
import { use } from "react";
import { supabase } from "../../lib/supabase";
import { calculateScore } from "../../lib/gameEngine";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const ICONS = ["🦁","🐯","🦊","🐺","🦝","🐻","🐼","🦄","🐲","🦅","🦉","🦋","🐬","🦈","🐙","🦂","🎭","👑","🎯","⚡","🔥","💎","🌙","⭐"];
type RematchStatus = "idle" | "requesting" | "incoming" | "accepted" | "declined";

export default function EndPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [room, setRoom] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>("idle");
  const [rematchMessage, setRematchMessage] = useState("");
  const loadedRef = useRef(false);
  const rematchRequesterRef = useRef<string | null>(null);

  const isHost = room?.host_id === currentUserId;
  const myWonCards = gameState ? (isHost ? gameState.won_cards_p1 : gameState.won_cards_p2) : [];
  const oppWonCards = gameState ? (isHost ? gameState.won_cards_p2 : gameState.won_cards_p1) : [];
  const myScore = calculateScore(myWonCards);
  const oppScore = calculateScore(oppWonCards);
  const iWon = myScore > oppScore;
  const isDraw = myScore === oppScore;

  function applyFinishedGameState(gs: any, roomData: any, userId: string) {
    setGameState(gs);
    loadedRef.current = true;
    setLoading(false);
    rematchRequesterRef.current = roomData?.rematch_requested_by ?? null;

    if (roomData?.rematch_requested_by && roomData.rematch_requested_by !== userId) {
      setRematchStatus("incoming");
    } else if (roomData?.rematch_requested_by === userId) {
      setRematchStatus("requesting");
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setCurrentUserId(user.id);

      const { data: roomData } = await supabase
        .from("dreams_rooms").select("*").eq("id", id).maybeSingle();
      if (!roomData) { window.location.href = "/home"; return; }
      setRoom(roomData);

      const opponentId = roomData.host_id === user.id ? roomData.guest_id : roomData.host_id;
      const [{ data: myP }, { data: oppP }] = await Promise.all([
        supabase.from("user_profiles").select("nickname, icon_id").eq("id", user.id).maybeSingle(),
        supabase.from("user_profiles").select("nickname, icon_id").eq("id", opponentId).maybeSingle(),
      ]);
      setMyProfile(myP);
      setOpponentProfile(oppP);

      // Poll until we have a finished game state row — retry every 800ms up to 30 times (~24s)
      for (let i = 0; i < 30; i++) {
        const { data: gs } = await supabase
          .from("dreams_game_state").select("*").eq("room_id", id).maybeSingle();
        if (gs && gs.status === "finished") {
          applyFinishedGameState(gs, roomData, user.id);
          return;
        }
        await new Promise(r => setTimeout(r, 800));
      }
      // If still not finished after retries, show whatever we have
      const { data: gs } = await supabase
        .from("dreams_game_state").select("*").eq("room_id", id).maybeSingle();
      if (gs) setGameState(gs);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!room || !currentUserId || loadedRef.current) return;

    const channel = supabase.channel(`end-game-state-${id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "dreams_game_state",
        filter: `room_id=eq.${id}`,
      }, (payload) => {
        const next = payload.new;
        if (next?.status === "finished") {
          applyFinishedGameState(next, room, currentUserId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, id, room]);

  // Rematch realtime
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel(`rematch-${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "dreams_rooms", filter: `id=eq.${id}`,
      }, (payload) => {
        const u = payload.new;
        const previousRequester = rematchRequesterRef.current;
        setRoom(u);

        if (u.rematch_room_id) { window.location.href = `/game/${u.rematch_room_id}`; return; }
        if (u.rematch_declined === true) {
          if (previousRequester === currentUserId) {
            setRematchStatus("declined");
          } else {
            setRematchStatus("idle");
          }
          rematchRequesterRef.current = null;
          return;
        }

        rematchRequesterRef.current = u.rematch_requested_by ?? null;

        if (u.rematch_requested_by === currentUserId) {
          setRematchStatus("requesting");
          return;
        }

        if (u.rematch_requested_by && u.rematch_requested_by !== currentUserId) {
          setRematchStatus("incoming");
          return;
        }

        setRematchStatus("idle");
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, id, rematchStatus]);

  async function requestRematch() {
    setRematchMessage("");
    rematchRequesterRef.current = currentUserId;
    setRematchStatus("requesting");
    const { error } = await supabase
      .from("dreams_rooms")
      .update({ rematch_requested_by: currentUserId, rematch_declined: false, rematch_room_id: null })
      .eq("id", id);

    if (error) {
      setRematchStatus("idle");
      setRematchMessage(error.message);
    }
  }

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
    setRematchMessage("");
    setRematchStatus("accepted");

    try {
      const code = await createUniqueRematchCode();
      const { data: newRoom, error: createError } = await supabase
        .from("dreams_rooms")
        .insert({
          code,
          host_id: room.guest_id,
          guest_id: room.host_id,
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
        .eq("id", id);

      if (linkError) {
        throw linkError;
      }

      rematchRequesterRef.current = null;
      window.location.href = `/game/${newRoom.id}`;
    } catch (error) {
      setRematchStatus("incoming");
      setRematchMessage(error instanceof Error ? error.message : "Could not start the rematch.");
    }
  }

  async function declineRematch() {
    setRematchMessage("");
    rematchRequesterRef.current = null;
    setRematchStatus("idle");
    const { error } = await supabase
      .from("dreams_rooms")
      .update({ rematch_declined: true, rematch_requested_by: null, rematch_room_id: null })
      .eq("id", id);

    if (error) {
      setRematchStatus("incoming");
      setRematchMessage(error.message);
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg-primary)" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: 18 }}>Loading results...</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Tallying up the scores</div>
    </div>
  );

  return (
    <div className="felt" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{isDraw ? "🤝" : iWon ? "🏆" : "😔"}</div>
        <div style={{ fontSize: 32, fontWeight: "800", letterSpacing: 1, color: isDraw ? "var(--text-primary)" : iWon ? "var(--accent-gold)" : "var(--text-muted)" }}>
          {isDraw ? "It's a Draw!" : iWon ? "You Won!" : "You Lost"}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Game over · {gameState?.deal_number ?? "4"} deals played</div>
      </div>

      <div style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-color)", padding: "20px 24px", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 30 }}>{ICONS[myProfile?.icon_id ?? 0]}</span>
            <div>
              <div style={{ color: "var(--accent-gold)", fontWeight: "700", fontSize: 15 }}>{myProfile?.nickname ?? "You"}{iWon && !isDraw ? " 👑" : ""}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{myWonCards.length} cards won</div>
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: "800", color: iWon && !isDraw ? "var(--accent-gold)" : "var(--text-primary)" }}>{myScore}</div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 0", color: "var(--text-muted)", fontSize: 11, letterSpacing: 3 }}>VS</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 30 }}>{ICONS[opponentProfile?.icon_id ?? 0]}</span>
            <div>
              <div style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: 15 }}>{opponentProfile?.nickname ?? "Opponent"}{!iWon && !isDraw ? " 👑" : ""}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{oppWonCards.length} cards won</div>
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: "800", color: !iWon && !isDraw ? "var(--accent-gold)" : "var(--text-primary)" }}>{oppScore}</div>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
        {rematchMessage && (
          <div style={{ background: "rgba(224,82,82,0.08)", border: "1px solid var(--red-suit)", borderRadius: 12, padding: 14, textAlign: "center", color: "var(--red-suit)", fontSize: 13 }}>
            {rematchMessage}
          </div>
        )}
        {rematchStatus === "idle" && (<>
          <button className="btn-primary" onClick={requestRematch} style={{ width: "100%", padding: 14 }}>🔄 Request Rematch</button>
          <button className="btn-secondary" onClick={() => window.location.href = "/home"} style={{ width: "100%", padding: 14 }}>🏠 Go to Home</button>
        </>)}
        {rematchStatus === "requesting" && (<>
          <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid var(--accent-gold)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ color: "var(--accent-gold)", fontWeight: "700", marginBottom: 4 }}>⏳ Waiting for {opponentProfile?.nickname ?? "opponent"}...</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Rematch request sent</div>
          </div>
          <button className="btn-secondary" onClick={() => window.location.href = "/home"} style={{ width: "100%", padding: 14 }}>🏠 Go to Home</button>
        </>)}
        {rematchStatus === "incoming" && (<>
          <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid var(--accent-gold)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ color: "var(--accent-gold)", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>🔄 {opponentProfile?.nickname ?? "Opponent"} wants a rematch!</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Do you accept?</div>
          </div>
          <button className="btn-primary" onClick={acceptRematch} style={{ width: "100%", padding: 14 }}>✅ Accept Rematch</button>
          <button className="btn-secondary" onClick={declineRematch} style={{ width: "100%", padding: 14 }}>❌ Decline</button>
        </>)}
        {rematchStatus === "accepted" && (
          <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid var(--accent-gold)", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ color: "var(--accent-gold)", fontWeight: "700", fontSize: 16 }}>🚀 Starting rematch...</div>
          </div>
        )}
        {rematchStatus === "declined" && (<>
          <div style={{ background: "rgba(224,82,82,0.08)", border: "1px solid var(--red-suit)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ color: "var(--red-suit)", fontWeight: "700", marginBottom: 4 }}>Rematch declined</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{opponentProfile?.nickname ?? "Opponent"} isn't up for another round</div>
          </div>
          <button className="btn-primary" onClick={() => window.location.href = "/home"} style={{ width: "100%", padding: 14 }}>🏠 Go to Home</button>
        </>)}
      </div>
    </div>
  );
}
