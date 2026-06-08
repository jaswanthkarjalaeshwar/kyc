/**
 * KYC — Know Your Card
 * Shared schema definitions and constants
 */

export const SPEND_CATEGORIES = [
  "dining",
  "groceries",
  "travel",
  "gas",
  "streaming",
  "drugstore",
  "online_shopping",
  "entertainment",
  "transit",
  "home_improvement",
  "everything_else",
];

export const CATEGORY_LABELS = {
  dining: "Dining & Restaurants",
  groceries: "Groceries",
  travel: "Travel (Flights & Hotels)",
  gas: "Gas & EV Charging",
  streaming: "Streaming Services",
  drugstore: "Drugstore & Pharmacy",
  online_shopping: "Online Shopping",
  entertainment: "Entertainment",
  transit: "Transit & Rideshare",
  home_improvement: "Home Improvement",
  everything_else: "Everything Else",
};

export const CATEGORY_ICONS = {
  dining: "🍽️",
  groceries: "🛒",
  travel: "✈️",
  gas: "⛽",
  streaming: "📺",
  drugstore: "💊",
  online_shopping: "📦",
  entertainment: "🎭",
  transit: "🚇",
  home_improvement: "🔨",
  everything_else: "💳",
};

export const NETWORKS = ["Visa", "Mastercard", "Amex", "Discover"];

export const REWARD_CURRENCIES = ["cashback", "points", "miles"];

export const CREDIT_SCORE_TIERS = ["fair", "good", "excellent"];

export const CAP_PERIODS = ["quarterly", "annual"];

/**
 * RewardTier — one card can have many of these
 * {
 *   category: string,
 *   earn_rate: number,       // multiplier e.g. 3 = 3x
 *   cap_amount: number|null, // spend cap before rate drops to base
 *   cap_period: string|null, // "quarterly" | "annual"
 *   notes: string|null       // human-readable edge case notes
 * }
 *
 * Card — the core card model
 * {
 *   id: string,
 *   name: string,
 *   issuer: string,
 *   network: string,
 *   annual_fee: number,
 *   reward_currency: string,
 *   reward_program: string|null,
 *   base_earn_rate: number,
 *   cpp: number,             // cents per point, for value normalization
 *   reward_tiers: RewardTier[],
 *   apr_range: { low: number, high: number },
 *   credit_score_required: string,
 *   card_url: string,
 *   image_color: string,     // hex, for card UI rendering
 * }
 *
 * SpendProfile — per user, stored in Firestore
 * {
 *   user_id: string,
 *   category: string,
 *   monthly_avg: number,
 *   last_updated: timestamp
 * }
 *
 * UserCard — a card in a user's wallet, stored in Firestore
 * {
 *   user_id: string,
 *   card_id: string,         // references static card catalog
 *   added_at: timestamp,
 *   nickname: string|null
 * }
 */

/**
 * Normalize any card's reward to effective cashback rate for comparison.
 * effective_rate = earn_rate × cpp
 */
export function effectiveCashbackRate(earnRate, cpp) {
  return earnRate * cpp;
}

/**
 * Get the best earn rate for a given card + category combo.
 * Falls back to base_earn_rate if no tier matches.
 */
export function getBestTierForCategory(card, category) {
  const tier = card.reward_tiers.find((t) => t.category === category);
  if (!tier) {
    return {
      earn_rate: card.base_earn_rate,
      cap_amount: null,
      cap_period: null,
      notes: null,
    };
  }
  return tier;
}
