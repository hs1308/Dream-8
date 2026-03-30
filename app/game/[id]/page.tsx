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

function CardComponent({
  card, onClick, disabled, selected, faceDown, small
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  small?: boolean;
}) {
  const w = small ? "36px" : "60px";
  const h = small ? "54px" : "90px";

  if (faceDown) {
    return (
      <div style={{
        width: w, height: h, borderRadius: "6px",
        background: "linear-gradient(135deg, #1a4a2a, #0d2d1a)",
        border: "2px solid #2d6a3a", cursor: "default",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: small ? "14px" : "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        flexShrink: 0,
      }}>
        🂠
      </div>
    );
  }

  const color = getSuitSymbol(card.suit) === "♥" || getSuitSymbol(card.suit) === "♦"
    ? "#e05252" : "#1a1a1a";
  const points = getCardPoints(card);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={selected ? "playing-card selected" : "playing-card"}
      style={{
        width: w, height: h, borderRadius: "6px",
        background: "#fff", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: small ? "2px" : "4px", position: "relative",
        border: selected ? "2px solid #c9a84c" : "1px solid #ddd",
        transform: selected ? "translateY(-16px)" : "none",
        transition: "transform 0.15s ease",
        boxShadow: selected
          ? "0 12px 32px rgba(201,168,76,0.5)"
          : "0 4px 12px rgba(0,0,0,0.4)",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: small ? "9px" : "12px", fontWeight: "800", color, alignSelf: "flex-start" }}>
        {card.rank}
      </div>
      <div style={{ fontSize: small ? "12px" : "20px", color }}>{getSuitSymbol(card.suit)}</div>
      <div style={{ fontSize: small ? "9px" : "12px", fontWeight: "800", color, alignSelf: "flex-end", transform: "rotate(180deg)" }}>
        {card.rank}
      </div>
      {points > 0 && (
        <div style={{
          position: "absolute", top: "-5px", right: "-5px",
          background: "#c9a84c", borderRadius: "50%",
          width: small ? "14px" : "18px", height: small ? "14px" : "18px",
          fontSize: small ? "7px" : "9px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#1a1a0a", fontWeight: "800",
        }}>
          {points}
        </div>
      )}
    </div>
  );
}

const ICONS = ["🦁","🐯","🦊","🐺","🦝","🐻","🐼","🦄","🐲","🦅","🦉","🦋","🐬","🦈","🐙","🦂","🎭","👑","🎯","⚡","🔥","💎","🌙","⭐"];

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

  const isMyTurn = gameState?.whose_turn === currentUserId;

  const myHand = gameState
    ? (currentUserId === gameState.player1_id ? gameState.player1_hand : gameState.player2_hand)
    : [];
  const opponentHand = gameState
    ? (currentUserId === gameState.player1_id ? gameState.player2_hand : gameState.player1_hand)
    : [];
  const myWonCards = gameState
    ? (currentUserId === gameState.player1_id ? gameState.won_cards_p1 : gameState.won_cards_p2)
    : [];
  const opponentWonCards = gameState
    ? (currentUserId === gameState.player1_id ? gameState.won_cards_p2 : gameState.won_cards_p1)
    : [];

  function rowToGameState(row: any, hostId: string, guestId: string): GameState {
    return {
      deck: row.deck,
      player1_hand: row.player1_hand,
      player2_hand: row.player2_hand,
      current_trick: row.current_trick,
      won_cards_p1: row.won_cards_p1,
      won_cards_p2: row.won_cards_p2,
      lead_suit: row.lead_suit,
      whose_turn: row.whose_turn,
      trick_number: row.trick_number,
      deal_number: row.deal_number,
      status: row.status ?? "active",
      player1_id: hostId,
      player2_id: guestId,
      turn_started_at: row.turn_started_at,
    };
  }

  async function initGame(roomData: any) {
    const startingPlayer = Math.random() < 0.5 ? roomData.host_id : roomData.guest_id;
    const state = initializeGame(roomData.host_id, roomData.guest_id, startingPlayer);

    const { data, error } = await supabase
      .from("dreams_game_state")
      .insert({
        room_id: id,
        deck: state.deck,
        player1_hand: state.player1_hand,
        player2_hand: state.player2_hand,
        current_trick: state.current_trick,
        won_cards_p1: state.won_cards_p1,
        won_cards_p2: state.won_cards_p2,
        lead_suit: state.lead_suit,
        whose_turn: state.whose_turn,
        trick_number: state.trick_number,
        deal_number: state.deal_number,
        turn_started_at: state.turn_started_at,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      gameStateIdRef.current = data.id;
      setGameStateId(data.id);
      setGameState(state);
    }
  }

  async function pollForGameState(roomData: any, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await supabase
        .from("dreams_game_state")
        .select("*")
        .eq("room_id", id)
        .maybeSingle();

      if (data) {
        gameStateIdRef.current = data.id;
        setGameStateId(data.id);
        setGameState(rowToGameState(data, roomData.host_id, roomData.guest_id));
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

      const { data: roomData } = await supabase
        .from("dreams_rooms")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!roomData) { window.location.href = "/home"; return; }
      setRoom(roomData);

      const opponentId = roomData.host_id === user.id ? roomData.guest_id : roomData.host_id;

      const [{ data: myP }, { data: oppP }] = await Promise.all([
        supabase.from("user_profiles").select("nickname, icon_id").eq("id", user.id).maybeSingle(),
        supabase.from("user_profiles").select("nickname, icon_id").eq("id", opponentId).maybeSingle(),
      ]);
      setMyProfile(myP);
      setOpponentProfile(oppP);

      const { data: existingState } = await supabase
        .from("dreams_game_state")
        .select("*")
        .eq("room_id", id)
        .maybeSingle();

      if (existingState) {
        gameStateIdRef.current = existingState.id;
        setGameStateId(existingState.id);
        setGameState(rowToGameState(existingState, roomData.host_id, roomData.guest_id));
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

    const channel = supabase
      .channel(`game-state-${gameStateId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dreams_game_state",
          filter: `id=eq.${gameStateId}`,
        },
        (payload) => {
          const s = payload.new;
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              deck: s.deck,
              player1_hand: s.player1_hand,
              player2_hand: s.player2_hand,
              current_trick: s.current_trick,
              won_cards_p1: s.won_cards_p1,
              won_cards_p2: s.won_cards_p2,
              lead_suit: s.lead_suit,
              whose_turn: s.whose_turn,
              trick_number: s.trick_number,
              deal_number: s.deal_number,
              status: s.status ?? "active",
              turn_started_at: s.turn_started_at,
            };
          });
          setSelectedCard(null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameStateId]);

  async function handlePlayCard(card: Card) {
    if (!gameState || !isMyTurn) return;
    if (!canPlayCard(card, myHand, gameState.lead_suit)) {
      setMessage(`You must follow suit! Play a ${gameState.lead_suit} card.`);
      return;
    }

    setMessage("");

    const newTrick = [...gameState.current_trick, { card, playerId: currentUserId }];
    const newMyHand = myHand.filter(c => c.id !== card.id);
    const newP1Hand = currentUserId === gameState.player1_id ? newMyHand : gameState.player1_hand;
    const newP2Hand = currentUserId === gameState.player2_id ? newMyHand : gameState.player2_hand;

    // Lead suit is set by the very first card of each game
    const newLeadSuit: Suit | null = newTrick.length === 1 ? card.suit : gameState.lead_suit;

    // Always switch turn to the other player after every card
    const opponentId = currentUserId === gameState.player1_id
      ? gameState.player2_id : gameState.player1_id;

    let updates: Record<string, any> = {
      current_trick: newTrick,
      player1_hand: newP1Hand,
      player2_hand: newP2Hand,
      lead_suit: newLeadSuit,
      whose_turn: opponentId, // default: switch turn
    };

    // A game ends when both players have played 3 cards each = 6 cards in trick
    if (newTrick.length === 6) {
      const winnerId = determineRoundWinner(newTrick, newLeadSuit!);
      const gameCards = newTrick.map(t => t.card);
      const isP1Winner = winnerId === gameState.player1_id;

      const newWonP1 = isP1Winner
        ? [...gameState.won_cards_p1, ...gameCards]
        : gameState.won_cards_p1;
      const newWonP2 = !isP1Winner
        ? [...gameState.won_cards_p2, ...gameCards]
        : gameState.won_cards_p2;

      const newGameNumber = gameState.trick_number + 1;
      const handsEmpty = newP1Hand.length === 0 && newP2Hand.length === 0;

      if (handsEmpty && gameState.deck.length > 0) {
        // Both hands empty, deal 6 more cards each
        // The OTHER player (not the winner) starts the next deal
        const { player1Hand, player2Hand, remaining } = dealCards(gameState.deck);
        const nextDealStarter = winnerId === gameState.player1_id
          ? gameState.player2_id : gameState.player1_id;
        updates = {
          ...updates,
          current_trick: [],
          player1_hand: player1Hand,
          player2_hand: player2Hand,
          deck: remaining,
          won_cards_p1: newWonP1,
          won_cards_p2: newWonP2,
          lead_suit: null,
          whose_turn: nextDealStarter,
          trick_number: newGameNumber,
          deal_number: gameState.deal_number + 1,
        };
      } else if (handsEmpty && gameState.deck.length === 0) {
        // Deck exhausted — game over
        updates = {
          ...updates,
          current_trick: [],
          won_cards_p1: newWonP1,
          won_cards_p2: newWonP2,
          lead_suit: null,
          whose_turn: winnerId,
          trick_number: newGameNumber,
          status: "finished",
        };
      } else {
        // Still cards in hand — winner starts the next game
        updates = {
          ...updates,
          current_trick: [],
          won_cards_p1: newWonP1,
          won_cards_p2: newWonP2,
          lead_suit: null,
          whose_turn: winnerId,
          trick_number: newGameNumber,
        };
      }
    }

    await supabase
      .from("dreams_game_state")
      .update(updates)
      .eq("id", gameStateId);

    if (updates.status === "finished") {
      setTimeout(() => { window.location.href = `/end/${id}`; }, 1500);
    }

    setSelectedCard(null);
  }

  // ── Loading states ───────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: "18px" }}>Setting up the table...</div>
    </div>
  );

  if (!gameState) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: "18px" }}>Waiting for host to deal cards…</div>
      <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>This only takes a moment</div>
      {message && <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{message}</div>}
    </div>
  );

  if (gameState.status === "finished") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent-gold)", fontSize: "24px", textAlign: "center" }}>
        🎉 Game Over! Calculating results...
      </div>
    </div>
  );

  // How many cards each player has played in the current game
  const myCardsPlayedThisGame = gameState.current_trick.filter(p => p.playerId === currentUserId).length;
  const oppCardsPlayedThisGame = gameState.current_trick.filter(p => p.playerId !== currentUserId).length;

  // ── Main UI ──────────────────────────────────────────────────────────────────

  return (
    <div className="felt" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      padding: "16px", gap: "12px", maxWidth: "600px", margin: "0 auto",
    }}>

      {/* Opponent profile */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "12px",
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "28px" }}>{ICONS[opponentProfile?.icon_id ?? 0]}</span>
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "14px" }}>
              {opponentProfile?.nickname ?? "Opponent"}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {opponentHand.length} cards · {calculateScore(opponentWonCards)} pts
            </div>
          </div>
        </div>
        {!isMyTurn && (
          <div style={{
            background: "rgba(201,168,76,0.2)", border: "1px solid var(--accent-gold)",
            borderRadius: "20px", padding: "4px 12px",
            color: "var(--accent-gold)", fontSize: "12px", fontWeight: "700",
          }}>
            Thinking...
          </div>
        )}
      </div>

      {/* Opponent hand (face down) */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
        {opponentHand.map((card, i) => (
          <CardComponent key={i} card={card} faceDown />
        ))}
      </div>

      {/* Game info bar */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "12px",
        padding: "10px 16px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
          Deal {gameState.deal_number} · Game {gameState.trick_number}
        </div>
        {gameState.lead_suit && (
          <div style={{
            fontSize: "14px", fontWeight: "700",
            color: getSuitColor(gameState.lead_suit as Suit) === "#e05252" ? "var(--red-suit)" : "var(--text-primary)",
          }}>
            Lead: {getSuitSymbol(gameState.lead_suit as Suit)} {gameState.lead_suit}
          </div>
        )}
        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
          Deck: {gameState.deck.length}
        </div>
      </div>

      {/* Table — current trick cards + won piles */}
      <div style={{
        background: "var(--bg-felt)", borderRadius: "16px",
        border: "1px solid var(--border-color)",
        padding: "16px", minHeight: "160px",
        display: "flex", flexDirection: "column", gap: "12px",
      }}>

        {/* Current trick cards in play */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "24px", minHeight: "100px",
        }}>
          {gameState.current_trick.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              {isMyTurn ? "Your turn — play a card" : "Waiting for opponent..."}
            </div>
          ) : (
            gameState.current_trick.map((play, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
                  {play.playerId === currentUserId ? "You" : (opponentProfile?.nickname ?? "Opponent")}
                </div>
                <CardComponent card={play.card} />
              </div>
            ))
          )}
        </div>

        {/* Won cards piles — shown after each game (when current_trick is empty but won cards exist) */}
        {gameState.current_trick.length === 0 && (myWonCards.length > 0 || opponentWonCards.length > 0) && (
          <div style={{
            borderTop: "1px solid var(--border-color)",
            paddingTop: "12px",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            gap: "12px",
          }}>
            {/* My won cards — face up */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "var(--accent-gold)", marginBottom: "6px", fontWeight: "700" }}>
                🏆 Your wins · {calculateScore(myWonCards)} pts
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {myWonCards.map((card, i) => (
                  <CardComponent key={i} card={card} small />
                ))}
              </div>
            </div>

            {/* Opponent won cards — face down */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textAlign: "right" }}>
                {calculateScore(opponentWonCards)} pts · {opponentProfile?.nickname ?? "Opponent"} 🏆
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                {opponentWonCards.map((card, i) => (
                  <CardComponent key={i} card={card} faceDown small />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error / follow-suit message */}
      {message && (
        <div style={{
          background: "rgba(224,82,82,0.15)", border: "1px solid rgba(224,82,82,0.4)",
          borderRadius: "8px", padding: "10px 16px",
          color: "var(--red-suit)", fontSize: "13px", textAlign: "center",
        }}>
          {message}
        </div>
      )}

      {/* Turn indicator */}
      <div style={{
        textAlign: "center", fontSize: "13px",
        color: isMyTurn ? "var(--accent-gold)" : "var(--text-muted)",
        fontWeight: isMyTurn ? "700" : "400",
      }}>
        {isMyTurn ? "⚡ Your turn — tap a card to select, tap again to play" : "⏳ Opponent's turn"}
      </div>

      {/* My hand */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
        {myHand.map((card) => {
          const canPlay = isMyTurn && canPlayCard(card, myHand, gameState.lead_suit ?? null);
          const isSelected = selectedCard?.id === card.id;
          return (
            <CardComponent
              key={card.id}
              card={card}
              selected={isSelected}
              disabled={!canPlay}
              onClick={() => {
                if (!isMyTurn) return;
                if (isSelected) {
                  handlePlayCard(card);
                } else {
                  setSelectedCard(card);
                  setMessage("");
                }
              }}
            />
          );
        })}
      </div>

      {/* My profile + play button */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "12px",
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "28px" }}>{ICONS[myProfile?.icon_id ?? 0]}</span>
          <div>
            <div style={{ color: "var(--accent-gold)", fontWeight: "700", fontSize: "14px" }}>
              {myProfile?.nickname ?? "You"}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {myHand.length} cards · {calculateScore(myWonCards)} pts
            </div>
          </div>
        </div>
        {isMyTurn && selectedCard && (
          <button
            className="btn-primary"
            onClick={() => handlePlayCard(selectedCard)}
            style={{ padding: "8px 20px", fontSize: "13px" }}
          >
            Play {selectedCard.rank}{getSuitSymbol(selectedCard.suit)}
          </button>
        )}
      </div>

    </div>
  );
}
