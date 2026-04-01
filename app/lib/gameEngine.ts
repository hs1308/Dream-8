export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3";

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface GameState {
  deck: Card[];
  player1_hand: Card[];
  player2_hand: Card[];
  current_trick: { card: Card; playerId: string }[];
  won_cards_p1: Card[];
  won_cards_p2: Card[];
  lead_suit: Suit | null;
  whose_turn: string;
  trick_number: number;
  deal_number: number;
  status: "active" | "finished";
  player1_id: string;
  player2_id: string;
  turn_started_at: string;
  // Tracks who started deal 1 so we can alternate strictly by deal number
  deal1_starter_id: string;
}

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: Rank[] = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3"];

const RANK_ORDER: Record<Rank, number> = {
  "A": 13, "K": 12, "Q": 11, "J": 10,
  "10": 9, "9": 8, "8": 7, "7": 6,
  "6": 5, "5": 4, "4": 3, "3": 2
};

export const CARD_POINTS: Partial<Record<string, number>> = {
  "A": 25, "K": 20, "Q": 15, "J": 15
};

export function getCardPoints(card: Card): number {
  if (card.suit === "spades" && card.rank === "3") return 50;
  return CARD_POINTS[card.rank] ?? 0;
}

export function calculateScore(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + getCardPoints(card), 0);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[]): {
  player1Hand: Card[];
  player2Hand: Card[];
  remaining: Card[];
} {
  const player1Hand = deck.slice(0, 6);
  const player2Hand = deck.slice(6, 12);
  const remaining = deck.slice(12);
  return { player1Hand, player2Hand, remaining };
}

export function determineRoundWinner(
  trick: { card: Card; playerId: string }[],
  leadSuit: Suit
): string {
  const leadCards = trick.filter(t => t.card.suit === leadSuit);
  if (leadCards.length === 0) return trick[0].playerId;
  let winner = leadCards[0];
  for (const play of leadCards) {
    if (RANK_ORDER[play.card.rank] > RANK_ORDER[winner.card.rank]) {
      winner = play;
    }
  }
  return winner.playerId;
}

export function canPlayCard(
  card: Card,
  hand: Card[],
  leadSuit: Suit | null
): boolean {
  if (!leadSuit) return true;
  const hasSuit = hand.some(c => c.suit === leadSuit);
  if (!hasSuit) return true;
  return card.suit === leadSuit;
}

export function getSuitSymbol(suit: Suit): string {
  const symbols = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
  return symbols[suit];
}

export function getSuitColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds" ? "#e05252" : "#1a1a1a";
}

/**
 * Given the deal number and who started deal 1, return who starts this deal.
 * Odd deals (1, 3, 5, 7...) → deal1_starter_id
 * Even deals (2, 4, 6, 8...) → the other player
 */
export function getDealStarter(
  dealNumber: number,
  deal1StarterId: string,
  player1Id: string,
  player2Id: string
): string {
  const otherId = deal1StarterId === player1Id ? player2Id : player1Id;
  return dealNumber % 2 === 1 ? deal1StarterId : otherId;
}

export function initializeGame(
  player1Id: string,
  player2Id: string,
  startingPlayer: string
): GameState {
  const deck = shuffleDeck(createDeck());
  const { player1Hand, player2Hand, remaining } = dealCards(deck);

  return {
    deck: remaining,
    player1_hand: player1Hand,
    player2_hand: player2Hand,
    current_trick: [],
    won_cards_p1: [],
    won_cards_p2: [],
    lead_suit: null,
    whose_turn: startingPlayer,
    trick_number: 1,
    deal_number: 1,
    status: "active",
    player1_id: player1Id,
    player2_id: player2Id,
    turn_started_at: new Date().toISOString(),
    deal1_starter_id: startingPlayer,
  };
}
