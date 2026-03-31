"use client";

import { useEffect, useState, useRef } from "react";
import { use } from "react";
import { supabase } from "../../lib/supabase";
import {
  Card, GameState, Suit,
  initializeGame, canPlayCard, determineRoundWinner,
  getSuitSymbol, getSuitColor, getCardPoints,
  calculateScore, dealCards,
} from "../../lib/gameEngine";

// ── Card back ─────────────────────────────────────────────────────────────────

function CardBack({ width = 58, height = 88 }: { width?: number; height?: number }) {
  const inset = 6;
  return (
    <div style={{
      width, height, borderRadius: 8,
      background: "#fff", border: "1px solid #c8b89a",
      boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
      position: "relative", overflow: "hidden", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute",
        top: inset, left: inset, right: inset, bottom: inset,
        borderRadius: 6,
        background: "linear-gradient(135deg, #1a5c2e 0%, #0d3318 50%, #1a5c2e 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 4,
          backgroundImage: `repeating-linear-gradient(45deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 2px,transparent 2px,transparent 10px)`,
        }} />
        <div style={{ fontSize: Math.round(height * 0.28), lineHeight: 1, zIndex: 1, userSelect: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
          ✦
        </div>
      </div>
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

function CardComponent({
  card, onClick, disabled, selected, faceDown, small,
}: {
  card: Card; onClick?: () => void; disabled?: boolean;
  selected?: boolean; faceDown?: boolean; small?: boolean;
}) {
  const w = small ? 36 : 58;
  const h = small ? 54 : 88;
  if (faceDown) return <CardBack width={w} height={h} />;

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const color = isRed ? "#d93f3f" : "#111";
  const points = getCardPoints(card);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: w, height: h, borderRadius: 8, background: "#fffdf8",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        padding: small ? "3px" : "5px 4px", position: "relative",
        border: selected ? "2px solid #c9a84c" : "1px solid #d0c0b0",
        // Selected card rises up — z-index ensures it renders above adjacent elements
        transform: selected ? "translateY(-18px)" : "none",
        zIndex: selected ? 10 : 1,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        boxShadow: selected ? "0 14px 36px rgba(201,168,76,0.55)" : "0 3px 10px rgba(0,0,0,0.45)",
        flexShrink: 0, userSelect: "none",
      }}
    >
      <div style={{ fontSize: small ? 9 : 13, fontWeight: "800", color, alignSelf: "flex-start", lineHeight: 1 }}>{card.rank}</div>
      <div style={{ fontSize: small ? 12 : 22, color, lineHeight: 1 }}>{getSuitSymbol(card.suit)}</div>
      <div style={{ fontSize: small ? 9 : 13, fontWeight: "800", color, alignSelf: "flex-end", transform: "rotate(180deg)", lineHeight: 1 }}>{card.rank}</div>
      {points > 0 && (
        <div style={{
          position: "absolute", top: small ? -5 : -7, right: small ? -5 : -7,
          background: "#c9a84c", borderRadius: "50%",
          width: small ? 14 : 20, height: small ? 14 : 20, fontSize: small ? 7 : 9,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#1a1a0a", fontWeight: "800", boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}>
          {points}
        </div>
      )}
    </div>
  );
}

// ── Won cards modal ───────────────────────────────────────────────────────────

function WonCardsModal({ cards, label, score, onClose }: {
  cards: Card[]; label: string; score: number; onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.78)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-card)", borderRadius: 16,
        border: "1px solid var(--border-color)",
        padding: "20px 16px", width: "100%", maxWidth: 360,
        maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--accent-gold)", fontWeight: "800", fontSize: 15 }}>🏆 {label}'s winnings</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{cards.length} cards · {score} pts total</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
          {cards.map((card, i) => <CardComponent key={i} card={card} small />)}
        </div>
        <button onClick={onClose} className="btn-secondary" style={{ width: "100%", padding: "10px", fontSize: 13 }}>Close</button>
      </div>
    </div>
  );
}

// ── Won pile ──────────────────────────────────────────────────────────────────

function WonPile({ cards, faceUp, label }: { cards: Card[]; faceUp: boolean; label: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const score = calculateScore(cards);
  const count = cards.length;
  const stackDepth = Math.min(count, 4);
  const topCard = faceUp && count > 0 ? cards[count - 1] : null;
  const isRed = topCard && (topCard.suit === "hearts" || topCard.suit === "diamonds");
  const topColor = isRed ? "#d93f3f" : "#111";

  if (count === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ width: 44, height: 64, borderRadius: 6, border: "2px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 18 }}>✦</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>0 pts</div>
    </div>
  );

  return (
    <>
      {modalOpen && faceUp && <WonCardsModal cards={cards} label={label} score={score} onClose={() => setModalOpen(false)} />}
      <div onClick={() => faceUp && setModalOpen(true)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: faceUp ? "pointer" : "default" }}>
        <div style={{ position: "relative", width: 44, height: 64 + (stackDepth - 1) * 4 }}>
          {Array.from({ length: stackDepth - 1 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", top: (stackDepth - 2 - i) * 4,
              width: 44, height: 64, borderRadius: 6,
              background: faceUp ? "#f0ece4" : "linear-gradient(135deg, #1a5c2e, #0d3318)",
              border: faceUp ? "1px solid #d0c0b0" : "1px solid #3a8a4a",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }} />
          ))}
          <div style={{
            position: "absolute", top: (stackDepth - 1) * 4,
            width: 44, height: 64, borderRadius: 6,
            background: faceUp ? "#fffdf8" : "linear-gradient(135deg, #1a5c2e, #0d3318)",
            border: faceUp ? "1px solid #d0c0b0" : "1px solid #3a8a4a",
            boxShadow: "0 3px 8px rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
            padding: faceUp ? "3px" : 0, overflow: "hidden",
          }}>
            {topCard ? (
              <>
                <div style={{ fontSize: 9, fontWeight: "800", color: topColor, alignSelf: "flex-start", lineHeight: 1 }}>{topCard.rank}</div>
                <div style={{ fontSize: 14, color: topColor, lineHeight: 1 }}>{getSuitSymbol(topCard.suit)}</div>
                <div style={{ fontSize: 9, fontWeight: "800", color: topColor, alignSelf: "flex-end", transform: "rotate(180deg)", lineHeight: 1 }}>{topCard.rank}</div>
              </>
            ) : (
              <div style={{ position: "absolute", inset: 3, borderRadius: 4, background: "linear-gradient(135deg, #1a5c2e, #0d3318)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 14 }}>✦</div>
            )}
          </div>
          <div style={{
            position: "absolute", top: (stackDepth - 1) * 4 - 8, right: -10,
            background: faceUp ? "#c9a84c" : "#3a6a3a", borderRadius: 10, padding: "2px 7px",
            fontSize: 11, fontWeight: "800", color: faceUp ? "#1a1a0a" : "#88cc88",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
          }}>
            {score}pts
          </div>
        </div>
        <div style={{ fontSize: 11, color: faceUp ? "var(--accent-gold)" : "var(--text-muted)", fontWeight: "600" }}>
          {label} {faceUp && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>👁</span>}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{count} cards</div>
      </div>
    </>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ICONS = ["🦁","🐯","🦊","🐺","🦝","🐻","🐼","🦄","🐲","🦅","🦉","🦋","🐬","🦈","🐙","🦂","🎭","👑","🎯","⚡","🔥","💎","🌙","⭐"];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [gameStateId, setGameStateId] = useState<string>("");
  const gameStateIdRef = useRef<string>("");
  // Ref so handlePlayCard always reads the latest gameStateId without stale closure
  const gameStateIdStateRef = useRef<string>("");

  const isMyTurn = gameState?.whose_turn === currentUserId;

  const myHand = gameState
    ? (currentUserId === gameState.player1_id ? gameState.player1_hand : gameState.player2_hand) : [];
  const opponentHand = gameState
    ? (currentUserId === gameState.player1_id ? gameState.player2_hand : gameState.player1_hand) : [];
  const myWonCards = gameState
    ? (currentUserId === gameState.player1_id ? gameState.won_cards_p1 : gameState.won_cards_p2) : [];
  const opponentWonCards = gameState
    ? (currentUserId === gameState.player1_id ? gameState.won_cards_p2 : gameState.won_cards_p1) : [];

  function setGameStateIdBoth(val: string) {
    gameStateIdStateRef.current = val;
    setGameStateId(val);
  }

  function rowToGameState(row: any, hostId: string, guestId: string): GameState {
    return {
      deck: row.deck, player1_hand: row.player1_hand, player2_hand: row.player2_hand,
      current_trick: row.current_trick, won_cards_p1: row.won_cards_p1, won_cards_p2: row.won_cards_p2,
      lead_suit: row.lead_suit, whose_turn: row.whose_turn, trick_number: row.trick_number,
      deal_number: row.deal_number, status: row.status ?? "active",
      player1_id: hostId, player2_id: guestId, turn_started_at: row.turn_started_at,
    };
  }

  async function initGame(roomData: any) {
    const startingPlayer = Math.random() < 0.5 ? roomData.host_id : roomData.guest_id;
    const state = initializeGame(roomData.host_id, roomData.guest_id, startingPlayer);
    const { data, error } = await supabase.from("dreams_game_state").insert({
      room_id: id, deck: state.deck, player1_hand: state.player1_hand, player2_hand: state.player2_hand,
      current_trick: state.current_trick, won_cards_p1: state.won_cards_p1, won_cards_p2: state.won_cards_p2,
      lead_suit: state.lead_suit, whose_turn: state.whose_turn, trick_number: state.trick_number,
      deal_number: state.deal_number, turn_started_at: state.turn_started_at,
    }).select().maybeSingle();
    if (!error && data) {
      gameStateIdRef.current = data.id;
      setGameStateIdBoth(data.id);
      setGameState(state);
    }
  }

  async function pollForGameState(roomData: any, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await supabase.from("dreams_game_state").select("*").eq("room_id", id).maybeSingle();
      if (data) {
        gameStateIdRef.current = data.id;
        setGameStateIdBoth(data.id);
        setGameState(rowToGameState(data, roomData.host_id, roomData.guest_id));
        // If game already finished by the time guest loads, redirect immediately
        if (data.status === "finished") {
          window.location.href = `/end/${id}`;
        }
        return;
      }
      await new Promise(res => setTimeout(res, 2000));
    }
    setMessage("Waiting for host to set up the game…");
  }

  useEffect(() => {
    async function setup() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setCurrentUserId(user.id);

      const { data: roomData } = await supabase.from("dreams_rooms").select("*").eq("id", id).maybeSingle();
      if (!roomData) { window.location.href = "/home"; return; }
      setRoom(roomData);

      const opponentId = roomData.host_id === user.id ? roomData.guest_id : roomData.host_id;
      const [{ data: myP }, { data: oppP }] = await Promise.all([
        supabase.from("user_profiles").select("nickname, icon_id").eq("id", user.id).maybeSingle(),
        supabase.from("user_profiles").select("nickname, icon_id").eq("id", opponentId).maybeSingle(),
      ]);
      setMyProfile(myP);
      setOpponentProfile(oppP);

      const { data: existingState } = await supabase.from("dreams_game_state").select("*").eq("room_id", id).maybeSingle();
      if (existingState) {
        gameStateIdRef.current = existingState.id;
        setGameStateIdBoth(existingState.id);
        setGameState(rowToGameState(existingState, roomData.host_id, roomData.guest_id));
        if (existingState.status === "finished") {
          window.location.href = `/end/${id}`;
          return;
        }
        setLoading(false);
      } else if (roomData.host_id === user.id) {
        await initGame(roomData);
        setLoading(false);
      } else {
        setLoading(false);
        await pollForGameState(roomData);
      }
    }
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Realtime subscription
  useEffect(() => {
    if (!gameStateId) return;
    const channel = supabase.channel(`game-state-${gameStateId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "dreams_game_state",
        filter: `id=eq.${gameStateId}`,
      }, (payload) => {
        const s = payload.new;
        setGameState(prev => prev ? {
          ...prev, deck: s.deck, player1_hand: s.player1_hand, player2_hand: s.player2_hand,
          current_trick: s.current_trick, won_cards_p1: s.won_cards_p1, won_cards_p2: s.won_cards_p2,
          lead_suit: s.lead_suit, whose_turn: s.whose_turn, trick_number: s.trick_number,
          deal_number: s.deal_number, status: s.status ?? "active", turn_started_at: s.turn_started_at,
        } : prev);
        setSelectedCard(null);

        // Redirect the player who did NOT play the final card
        if (s.status === "finished") {
          setTimeout(() => { window.location.href = `/end/${id}`; }, 1200);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameStateId, id]);

  async function handlePlayCard(card: Card) {
    if (!gameState || !isMyTurn) return;
    if (!canPlayCard(card, myHand, gameState.lead_suit)) {
      setMessage(`You must follow suit! Play a ${gameState.lead_suit} card.`);
      return;
    }
    setMessage("");
    // Clear selection immediately — no waiting for DB round-trip
    setSelectedCard(null);

    const newTrick = [...gameState.current_trick, { card, playerId: currentUserId }];
    const newMyHand = myHand.filter(c => c.id !== card.id);
    const newP1Hand = currentUserId === gameState.player1_id ? newMyHand : gameState.player1_hand;
    const newP2Hand = currentUserId === gameState.player2_id ? newMyHand : gameState.player2_hand;
    const newLeadSuit: Suit | null = newTrick.length === 1 ? card.suit : gameState.lead_suit;
    const opponentId = currentUserId === gameState.player1_id ? gameState.player2_id : gameState.player1_id;

    let updates: Record<string, any> = {
      current_trick: newTrick, player1_hand: newP1Hand, player2_hand: newP2Hand,
      lead_suit: newLeadSuit, whose_turn: opponentId,
    };

    if (newTrick.length === 6) {
      const winnerId = determineRoundWinner(newTrick, newLeadSuit!);
      const gameCards = newTrick.map(t => t.card);
      const isP1Winner = winnerId === gameState.player1_id;
      const newWonP1 = isP1Winner ? [...gameState.won_cards_p1, ...gameCards] : gameState.won_cards_p1;
      const newWonP2 = !isP1Winner ? [...gameState.won_cards_p2, ...gameCards] : gameState.won_cards_p2;
      const newGameNumber = gameState.trick_number + 1;
      const handsEmpty = newP1Hand.length === 0 && newP2Hand.length === 0;

      if (handsEmpty && gameState.deck.length > 0) {
        const { player1Hand, player2Hand, remaining } = dealCards(gameState.deck);
        const nextDealStarter = winnerId === gameState.player1_id ? gameState.player2_id : gameState.player1_id;
        updates = {
          ...updates, current_trick: [], player1_hand: player1Hand, player2_hand: player2Hand,
          deck: remaining, won_cards_p1: newWonP1, won_cards_p2: newWonP2,
          lead_suit: null, whose_turn: nextDealStarter,
          trick_number: newGameNumber, deal_number: gameState.deal_number + 1,
        };
      } else if (handsEmpty && gameState.deck.length === 0) {
        updates = {
          ...updates, current_trick: [], won_cards_p1: newWonP1, won_cards_p2: newWonP2,
          lead_suit: null, whose_turn: winnerId, trick_number: newGameNumber, status: "finished",
        };
      } else {
        updates = {
          ...updates, current_trick: [], won_cards_p1: newWonP1, won_cards_p2: newWonP2,
          lead_suit: null, whose_turn: winnerId, trick_number: newGameNumber,
        };
      }
    }

    // Optimistic local update so UI responds before DB round-trip
    setGameState(prev => prev ? { ...prev, ...updates } : prev);

    await supabase.from("dreams_game_state").update(updates).eq("id", gameStateIdStateRef.current);

    if (updates.status === "finished") {
      setTimeout(() => { window.location.href = `/end/${id}`; }, 1200);
    }
  }

  // ── Loading states ────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: 18 }}>Setting up the table...</div>
    </div>
  );

  if (!gameState) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ color: "var(--accent-gold)", fontSize: 18 }}>Waiting for host to deal cards…</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>This only takes a moment</div>
      {message && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{message}</div>}
    </div>
  );

  if (gameState.status === "finished") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: 24, textAlign: "center" }}>🎉 Game Over! Calculating results...</div>
    </div>
  );

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="felt" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      padding: "12px", gap: "10px", maxWidth: "480px", margin: "0 auto",
    }}>

      {/* Opponent bar */}
      <div style={{
        background: "var(--bg-card)", borderRadius: 12,
        padding: "10px 14px", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26 }}>{ICONS[opponentProfile?.icon_id ?? 0]}</span>
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: 13 }}>{opponentProfile?.nickname ?? "Opponent"}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{opponentHand.length} cards in hand</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isMyTurn && (
            <div style={{
              background: "rgba(201,168,76,0.15)", border: "1px solid var(--accent-gold)",
              borderRadius: 16, padding: "3px 10px", color: "var(--accent-gold)", fontSize: 11, fontWeight: "700",
            }}>Thinking...</div>
          )}
          <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "right" }}>
            <div>Deal {gameState.deal_number}</div>
            <div>Game {gameState.trick_number}</div>
          </div>
        </div>
      </div>

      {/* Opponent hand — full-size card backs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "nowrap", overflowX: "auto", padding: "2px 0", flexShrink: 0 }}>
        {opponentHand.map((_, i) => <CardBack key={i} width={58} height={88} />)}
      </div>

      {/* Table: won piles + current trick */}
      <div style={{
        background: "var(--bg-felt)", borderRadius: 14,
        border: "1px solid var(--border-color)",
        padding: "12px 16px", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <WonPile cards={myWonCards} faceUp label="You" />
          <div style={{ textAlign: "center", flex: 1 }}>
            {gameState.lead_suit ? (
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Lead suit</div>
                <div style={{ fontSize: 24, color: (gameState.lead_suit === "hearts" || gameState.lead_suit === "diamonds") ? "var(--red-suit)" : "var(--text-primary)" }}>
                  {getSuitSymbol(gameState.lead_suit as Suit)}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>🂠 {gameState.deck.length} left</div>
            )}
          </div>
          <WonPile cards={opponentWonCards} faceUp={false} label={opponentProfile?.nickname ?? "Opp"} />
        </div>

        <div style={{
          borderTop: "1px solid var(--border-color)", paddingTop: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 20, minHeight: 106,
        }}>
          {gameState.current_trick.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              {isMyTurn ? "⚡ Your turn — play a card" : "⏳ Waiting for opponent..."}
            </div>
          ) : (
            gameState.current_trick.map((play, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>
                  {play.playerId === currentUserId ? "You" : (opponentProfile?.nickname ?? "Opp")}
                </div>
                <CardComponent card={play.card} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Error message */}
      {message && (
        <div style={{
          background: "rgba(224,82,82,0.12)", border: "1px solid rgba(224,82,82,0.35)",
          borderRadius: 8, padding: "9px 14px",
          color: "var(--red-suit)", fontSize: 13, textAlign: "center", flexShrink: 0,
        }}>
          {message}
        </div>
      )}

      {/* Turn indicator */}
      <div style={{
        textAlign: "center", fontSize: 12, flexShrink: 0,
        color: isMyTurn ? "var(--accent-gold)" : "var(--text-muted)",
        fontWeight: isMyTurn ? "700" : "400",
      }}>
        {isMyTurn ? "Tap to select · Tap again to play" : "Opponent's turn"}
      </div>

      {/* My hand — position:relative + z-index so raised cards clear the turn text above */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 6,
        flexWrap: "nowrap", overflowX: "auto", padding: "20px 0 8px",
        flexShrink: 0, position: "relative", zIndex: 5,
      }}>
        {myHand.map((card) => {
          const canPlay = isMyTurn && canPlayCard(card, myHand, gameState.lead_suit ?? null);
          const isSelected = selectedCard?.id === card.id;
          return (
            <CardComponent
              key={card.id} card={card} selected={isSelected} disabled={!canPlay}
              onClick={() => {
                if (!isMyTurn) return;
                if (isSelected) { handlePlayCard(card); }
                else { setSelectedCard(card); setMessage(""); }
              }}
            />
          );
        })}
      </div>

      {/* My profile bar */}
      <div style={{
        background: "var(--bg-card)", borderRadius: 12,
        padding: "10px 14px", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26 }}>{ICONS[myProfile?.icon_id ?? 0]}</span>
          <div>
            <div style={{ color: "var(--accent-gold)", fontWeight: "700", fontSize: 13 }}>{myProfile?.nickname ?? "You"}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{myHand.length} cards · {calculateScore(myWonCards)} pts</div>
          </div>
        </div>
        {isMyTurn && selectedCard && (
          <button className="btn-primary" onClick={() => handlePlayCard(selectedCard)} style={{ padding: "8px 18px", fontSize: 13 }}>
            Play {selectedCard.rank}{getSuitSymbol(selectedCard.suit)}
          </button>
        )}
      </div>

    </div>
  );
}
