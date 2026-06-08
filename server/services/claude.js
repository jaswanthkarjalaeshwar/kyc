import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getBestTierForCategory, effectiveCashbackRate } from "../../shared/schema.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARD_CATALOG = JSON.parse(readFileSync(join(__dirname, "../data/cards.json"), "utf-8"));

/**
 * Build a minimal card summary for prompt context.
 * Avoids dumping the full JSON into the prompt.
 */
function summarizeCard(card) {
  const tiers = card.reward_tiers
    .map((t) => {
      const rate =
        card.reward_currency === "cashback"
          ? `${(t.earn_rate * 100).toFixed(0)}%`
          : `${t.earn_rate}x ${card.reward_currency}`;
      const cap = t.cap_amount
        ? ` (up to $${t.cap_amount.toLocaleString()}/${t.cap_period})`
        : "";
      return `  - ${t.category}: ${rate}${cap}${t.notes ? ` — ${t.notes}` : ""}`;
    })
    .join("\n");

  const baseRate =
    card.reward_currency === "cashback"
      ? `${(card.base_earn_rate * 100).toFixed(1)}% cashback`
      : `${card.base_earn_rate}x ${card.reward_program || card.reward_currency}`;

  return [
    `${card.name} (${card.issuer}, $${card.annual_fee}/yr annual fee)`,
    `Base: ${baseRate} | CPP: $${card.cpp}`,
    `APR: ${card.apr_range.low}–${card.apr_range.high}% | Requires: ${card.credit_score_required} credit`,
    tiers ? `Category bonuses:\n${tiers}` : "No category bonuses (flat rate)",
  ].join("\n");
}

/**
 * Optimizer: which card in the user's wallet should they use for this purchase?
 *
 * @param {Object} params
 * @param {string[]} params.userCardIds - IDs of cards in user's wallet
 * @param {string} params.category - spend category
 * @param {number} params.amount - purchase amount in USD
 * @param {string} [params.merchant] - optional merchant name for context
 * @returns {Promise<Object>} ranked recommendations with reasoning
 */
export async function getCardRecommendation({ userCardIds, category, amount, merchant }) {
  const userCards = userCardIds
    .map((id) => CARD_CATALOG.find((c) => c.id === id))
    .filter(Boolean);

  if (userCards.length === 0) {
    throw Object.assign(new Error("No valid cards found in wallet"), { status: 400 });
  }

  // Pre-compute effective rates so Claude has concrete numbers to reason from
  const cardSummaries = userCards.map((card) => {
    const tier = getBestTierForCategory(card, category);
    const effectiveRate = effectiveCashbackRate(tier.earn_rate, card.cpp);
    const estimatedValue = (amount * effectiveRate).toFixed(2);
    return {
      summary: summarizeCard(card),
      effectiveRate: (effectiveRate * 100).toFixed(2),
      estimatedValue,
      cardId: card.id,
      cardName: card.name,
    };
  });

  const prompt = `You are a credit card rewards expert. A user wants to make a purchase and needs to know which of their cards maximizes rewards.

PURCHASE DETAILS:
- Category: ${category}
- Amount: $${amount}
${merchant ? `- Merchant: ${merchant}` : ""}

RULE: Base your recommendation purely on the card's reward tier for the stated spend category. Do not reference specific merchants, store brands, or chain names in your reasoning. Do not assume which specific retailer the user is shopping at. Reason only from category earn rates. The merchant field is user context — do not use it to infer which card-specific merchant bonuses apply.

USER'S CARDS:
${cardSummaries.map((c) => `[${c.cardId}]\n${c.summary}\nPre-computed effective rate for this category: ${c.effectiveRate}% | Estimated value: $${c.estimatedValue}`).join("\n\n---\n\n")}

Return a JSON object with this exact structure:
{
  "winner": {
    "card_id": "string",
    "card_name": "string",
    "earn_rate_display": "string (e.g. '3x points' or '5% cashback')",
    "estimated_value": "string (e.g. '$12.00')",
    "reasoning": "string (2-3 sentences, plain English, explain why this card wins for this specific purchase)"
  },
  "alternatives": [
    {
      "card_id": "string",
      "card_name": "string",
      "earn_rate_display": "string",
      "estimated_value": "string",
      "gap": "string (e.g. '$3.20 less than winner')"
    }
  ],
  "compliance_note": "string (mention APR and annual fee context if relevant to this decision. Keep it one sentence.)",
  "confidence": "high" | "medium" | "low"
}

Respond with valid JSON only. No markdown, no preamble.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Failed to parse AI recommendation"), { status: 500, raw });
  }
}

/**
 * Gap Analysis: given the user's spend profile and current wallet,
 * where are they losing rewards and what new cards should they get?
 *
 * @param {Object} params
 * @param {string[]} params.userCardIds - IDs of cards in user's wallet
 * @param {Object} params.spendProfile - { category: monthly_avg } map
 * @returns {Promise<Object>} gap analysis with upgrade recommendations
 */
export async function getGapAnalysis({ userCardIds, spendProfile }) {
  const userCards = userCardIds
    .map((id) => CARD_CATALOG.find((c) => c.id === id))
    .filter(Boolean);

  const allCards = CARD_CATALOG;

  // Compute current annual value from user's wallet
  const currentWalletValue = {};
  for (const [category, monthlyAvg] of Object.entries(spendProfile)) {
    const annualSpend = monthlyAvg * 12;
    let bestRate = 0;
    let bestCard = null;

    for (const card of userCards) {
      const tier = getBestTierForCategory(card, category);
      const rate = effectiveCashbackRate(tier.earn_rate, card.cpp);
      if (rate > bestRate) {
        bestRate = rate;
        bestCard = card.name;
      }
    }

    currentWalletValue[category] = {
      annual_spend: annualSpend,
      best_rate: bestRate,
      best_card: bestCard,
      annual_value: annualSpend * bestRate,
    };
  }

  const totalCurrentValue = Object.values(currentWalletValue)
    .reduce((sum, v) => sum + v.annual_value, 0)
    .toFixed(2);

  // Cards not in user's wallet — potential upgrades
  const notOwned = allCards.filter((c) => !userCardIds.includes(c.id));

  const prompt = `You are a credit card portfolio optimizer. Analyze this user's current reward capture and identify where they're leaving money on the table.

CURRENT WALLET:
${userCards.map((c) => summarizeCard(c)).join("\n\n---\n\n")}

ANNUAL SPEND PROFILE:
${Object.entries(spendProfile)
  .filter(([, v]) => v > 0)
  .map(([cat, monthly]) => `- ${cat}: $${monthly}/mo ($${(monthly * 12).toLocaleString()}/yr)`)
  .join("\n")}

CURRENT ESTIMATED ANNUAL VALUE: $${totalCurrentValue}

CATEGORY-BY-CATEGORY BREAKDOWN:
${Object.entries(currentWalletValue)
  .filter(([, v]) => v.annual_spend > 0)
  .map(
    ([cat, v]) =>
      `- ${cat}: $${v.annual_spend.toLocaleString()}/yr spend | Best card: ${v.best_card || "none"} at ${(v.best_rate * 100).toFixed(2)}% effective | $${v.annual_value.toFixed(2)}/yr value`
  )
  .join("\n")}

CARDS NOT IN WALLET (available for recommendation):
${notOwned.map((c) => summarizeCard(c)).join("\n\n---\n\n")}

Return a JSON object with this exact structure:
{
  "summary": "string (2-3 sentences: overall health of their wallet, biggest opportunity)",
  "current_annual_value": number,
  "projected_annual_value": number,
  "annual_uplift": number,
  "leakage_by_category": [
    {
      "category": "string",
      "annual_spend": number,
      "current_rate": "string",
      "current_value": number,
      "best_available_rate": "string",
      "best_available_card": "string",
      "potential_value": number,
      "leakage": number
    }
  ],
  "recommendations": [
    {
      "card_id": "string",
      "card_name": "string",
      "annual_fee": number,
      "why": "string (2-3 sentences: specifically which categories and how much extra value)",
      "net_annual_uplift": number,
      "best_for_categories": ["string"],
      "apr_range": "string",
      "credit_score_required": "string"
    }
  ],
  "keep_cards": ["string (card names to keep and why, one sentence each)"]
}

Limit recommendations to the top 3 cards with the clearest ROI. Be specific with dollar amounts.
Respond with valid JSON only. No markdown, no preamble.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Failed to parse gap analysis"), { status: 500, raw });
  }
}

/**
 * URL Scraper: fetch a bank card page and extract reward structure
 *
 * @param {string} url - bank card page URL
 * @returns {Promise<Object>} pre-filled card schema
 */
export async function scrapeCardFromUrl(url) {
  const fetchResponse = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!fetchResponse.ok) {
    throw Object.assign(
      new Error(`Failed to fetch page: ${fetchResponse.status} ${fetchResponse.statusText}`),
      { status: 422 }
    );
  }

  const html = await fetchResponse.text();

  // Strip scripts, styles, nav, footer — keep meaningful content
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 12000); // Token budget

  const prompt = `You are extracting credit card reward data from a bank's marketing page. The user will review and edit this before saving — be accurate but flag uncertainty.

PAGE CONTENT:
${stripped}

SOURCE URL: ${url}

Extract the card's reward structure and return a JSON object matching this schema exactly:
{
  "name": "string (full card name)",
  "issuer": "string (bank name)",
  "network": "Visa" | "Mastercard" | "Amex" | "Discover",
  "annual_fee": number,
  "reward_currency": "cashback" | "points" | "miles",
  "reward_program": "string or null (e.g. 'Chase Ultimate Rewards')",
  "base_earn_rate": number (flat rate for all purchases not in a bonus category),
  "cpp": number (cents per point — use 0.01 for cashback, estimate for points/miles),
  "apr_range": { "low": number, "high": number },
  "credit_score_required": "fair" | "good" | "excellent",
  "card_url": "${url}",
  "reward_tiers": [
    {
      "category": one of ["dining","groceries","travel","gas","streaming","drugstore","online_shopping","entertainment","transit","home_improvement","everything_else"],
      "earn_rate": number,
      "cap_amount": number or null,
      "cap_period": "quarterly" | "annual" | "monthly" | null,
      "notes": "string or null"
    }
  ],
  "extraction_confidence": "high" | "medium" | "low",
  "extraction_notes": "string (flag anything ambiguous or that the user should double-check)"
}

Important:
- For cashback cards, earn_rate is a decimal (0.05 = 5%). For points/miles, earn_rate is a multiplier (3 = 3x).
- Only include reward_tiers for categories with a bonus rate above the base rate.
- If you can't find a value, use null and note it in extraction_notes.

Respond with valid JSON only. No markdown, no preamble.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Failed to parse card extraction"), { status: 500, raw });
  }
}
