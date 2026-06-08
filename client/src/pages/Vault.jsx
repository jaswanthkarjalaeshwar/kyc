import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { track, EVENT_TYPES } from "../utils/analytics";
import AddCardModal from "../components/cards/AddCardModal";
import { SPEND_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS } from "../../../shared/schema.js";

function effectiveRate(card, category) {
  const tier = card.reward_tiers?.find((t) => t.category === category);
  if (tier) return tier.earn_rate * (card.cpp || 1);
  return card.base_earn_rate * (card.cpp || 1);
}

function getBestCategory(card) {
  if (!card.reward_tiers?.length) return null;
  let best = null;
  let bestRate = 0;
  for (const tier of card.reward_tiers) {
    const r = tier.earn_rate * (card.cpp || 1);
    if (r > bestRate) { bestRate = r; best = tier.category; }
  }
  return best;
}

function estimateAnnualValue(card, spendProfile) {
  let total = 0;
  for (const [cat, spend] of Object.entries(spendProfile)) {
    if (!spend) continue;
    total += effectiveRate(card, cat) * spend * 12;
  }
  return total - card.annual_fee;
}

function CreditCardVisual({ card }) {
  const bestCat = getBestCategory(card);
  return (
    <div
      className="credit-card-visual"
      style={{ background: `linear-gradient(145deg, ${card.image_color}f0, ${card.image_color}a0)` }}
    >
      <div className="credit-card-chip" />
      <div>
        <div className="credit-card-name">{card.name}</div>
        <div className="credit-card-issuer">{card.issuer} · {card.network}</div>
        {bestCat && (
          <div className="credit-card-meta">Best for: {CATEGORY_LABELS[bestCat]}</div>
        )}
      </div>
    </div>
  );
}

function WalletCard({ card, spendProfile, onRemove }) {
  const hasProfile = Object.values(spendProfile).some((v) => v > 0);
  const annualValue = hasProfile ? estimateAnnualValue(card, spendProfile) : null;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <CreditCardVisual card={card} />
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "3px" }}>{card.name}</div>
        <div className="text-xs text-muted" style={{ marginBottom: "12px" }}>
          {card.annual_fee === 0 ? "No annual fee" : `$${card.annual_fee}/yr`}
          {" · "}{card.reward_currency}
        </div>
        {annualValue !== null && (
          <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
            <span className="text-xs text-muted">Est. annual value</span>
            <span
              className="font-mono"
              style={{ fontSize: "13px", fontWeight: 500, color: annualValue >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {annualValue >= 0 ? "+" : ""}${annualValue.toFixed(0)}
            </span>
          </div>
        )}
        <button
          className="btn btn-danger w-full"
          style={{ justifyContent: "center", marginTop: annualValue === null ? 0 : undefined }}
          onClick={() => onRemove(card.id)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function CategoryCoverage({ wallet }) {
  const rows = SPEND_CATEGORIES.map((cat) => {
    let bestRate = 0;
    let bestCard = null;
    for (const card of wallet) {
      const r = effectiveRate(card, cat);
      if (r > bestRate) { bestRate = r; bestCard = card; }
    }
    const hasBonus = wallet.some((c) => c.reward_tiers?.some((t) => t.category === cat));
    return { category: cat, card: bestCard, rate: bestRate, hasBonus };
  });

  return (
    <div className="card" style={{ marginTop: "24px" }}>
      <div className="section-title">Category Coverage</div>
      <div className="section-subtitle" style={{ marginBottom: "8px" }}>
        Which card in your wallet wins each category
      </div>
      <table className="coverage-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Best Card</th>
            <th style={{ textAlign: "right" }}>Effective Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ category, card, rate, hasBonus }) => (
            <tr key={category}>
              <td>
                <span style={{ marginRight: "7px" }}>{CATEGORY_ICONS[category]}</span>
                {CATEGORY_LABELS[category]}
              </td>
              <td style={{ color: !hasBonus ? "var(--gold)" : "var(--text)" }}>
                {card ? card.name : "—"}
                {card && !hasBonus && (
                  <span className="text-xs" style={{ marginLeft: 6, color: "var(--text-muted)" }}>base only</span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <span
                  className="font-mono"
                  style={{ fontSize: "13px", color: hasBonus ? "var(--text)" : "var(--gold)" }}
                >
                  {(rate * 100).toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Vault() {
  const { wallet, spendProfile, addCard, removeCard } = useWallet();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const handleRemove = (cardId) => {
    const card = wallet.find((c) => c.id === cardId);
    removeCard(cardId);
    track(EVENT_TYPES.CARD_REMOVED, { card_id: cardId });
    showToast(`${card?.name || "Card"} removed from your vault`);
  };

  const handleAdd = (card) => {
    addCard(card);
    setShowModal(false);
    track(EVENT_TYPES.CARD_ADDED, { card_id: card.id });
    showToast(`${card.name} added to your vault`);
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Card Vault</h1>
          <p className="page-subtitle">
            {wallet.length === 0
              ? "Add your credit cards to get started"
              : `${wallet.length} card${wallet.length !== 1 ? "s" : ""} in your wallet`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Card
        </button>
      </div>

      {wallet.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💳</div>
          <div className="empty-state-title">Your vault is empty</div>
          <div className="empty-state-body">
            Add your existing credit cards and KYC will tell you exactly which one to use for every purchase.
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Add your first card
          </button>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {wallet.map((card) => (
              <WalletCard key={card.id} card={card} spendProfile={spendProfile} onRemove={handleRemove} />
            ))}
          </div>
          <CategoryCoverage wallet={wallet} />
        </>
      )}

      {showModal && (
        <AddCardModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
