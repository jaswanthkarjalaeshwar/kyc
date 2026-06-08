import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { api } from "../utils/api";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "../../../shared/schema.js";

function effectiveRate(card, category) {
  const tier = card.reward_tiers?.find((t) => t.category === category);
  if (tier) return tier.earn_rate * (card.cpp || 1);
  return card.base_earn_rate * (card.cpp || 1);
}

function computeHealthScore(wallet, spendProfile, catalogCards) {
  const categories = Object.entries(spendProfile).filter(([, v]) => v > 0);
  if (!categories.length || !wallet.length || !catalogCards.length) return 0;

  let totalWeight = 0;
  let weightedScore = 0;

  for (const [cat, spend] of categories) {
    const walletBest = wallet.reduce((best, card) => Math.max(best, effectiveRate(card, cat)), 0);
    const catalogBest = catalogCards.reduce((best, card) => Math.max(best, effectiveRate(card, cat)), 0);
    if (catalogBest === 0) continue;
    const score = Math.min(100, (walletBest / catalogBest) * 100);
    weightedScore += score * spend;
    totalWeight += spend;
  }

  if (!totalWeight) return 0;
  return Math.min(100, Math.max(0, weightedScore / totalWeight));
}

function computeEstimatedAnnualRewards(wallet, spendProfile) {
  let total = 0;
  for (const [cat, spend] of Object.entries(spendProfile)) {
    if (!spend) continue;
    const best = wallet.reduce((b, card) => Math.max(b, effectiveRate(card, cat)), 0);
    total += best * spend * 12;
  }
  return total;
}

function computeOpportunities(wallet, spendProfile, catalogCards) {
  const results = [];
  for (const [cat, spend] of Object.entries(spendProfile)) {
    if (!spend || spend <= 0) continue;
    const walletBest = wallet.reduce((b, card) => Math.max(b, effectiveRate(card, cat)), 0);
    let catalogBestRate = 0;
    let catalogBestCard = null;
    for (const card of catalogCards) {
      const r = effectiveRate(card, cat);
      if (r > catalogBestRate) { catalogBestRate = r; catalogBestCard = card; }
    }
    const gap = catalogBestRate - walletBest;
    if (gap > 0.005) {
      results.push({ category: cat, spend, currentRate: walletBest, bestRate: catalogBestRate, bestCard: catalogBestCard, annualUplift: gap * spend * 12 });
    }
  }
  return results.sort((a, b) => b.annualUplift - a.annualUplift);
}

function computeThisMonthStats(purchaseLog) {
  const now = new Date();
  const thisMonth = now.getFullYear() * 100 + now.getMonth();
  const entries = purchaseLog.filter((e) => {
    const d = new Date(e.timestamp);
    return d.getFullYear() * 100 + d.getMonth() === thisMonth;
  });
  const spend = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const rewards = entries.reduce((s, e) => {
    const val = parseFloat((e.estimatedValue || "0").replace(/[$,]/g, ""));
    return s + (isNaN(val) ? 0 : val);
  }, 0);
  return { spend, rewards };
}

function scoreColor(score) {
  if (score >= 75) return "var(--green)";
  if (score >= 45) return "var(--gold)";
  return "var(--red)";
}

function scoreLabel(score) {
  if (score >= 80) return "Excellent — your wallet is well-optimized for your spending";
  if (score >= 60) return "Good — a few categories have room to improve";
  if (score >= 40) return "Fair — significant reward gaps exist across your spending";
  return "Low — your wallet isn't earning near its potential";
}

function WalletHealthScore({ score, annualRewards }) {
  const color = scoreColor(score);
  return (
    <div className="card" style={{ padding: "24px" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="result-label">Wallet Health Score</div>
          <div style={{ fontSize: "44px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color, lineHeight: 1, marginTop: 6 }}>
            {Math.round(score)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="result-label">Est. Annual Rewards</div>
          <div className="result-value" style={{ fontSize: "28px" }}>${annualRewards.toFixed(0)}</div>
        </div>
      </div>
      <div className="health-score-bar" style={{ marginBottom: "10px" }}>
        <div className="health-score-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="text-sm text-muted">{scoreLabel(Math.round(score))}</div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-xs text-muted mt-2">{sub}</div>}
    </div>
  );
}

function OpportunityRow({ opp }) {
  return (
    <div className="opportunity-row">
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500 }}>
          {CATEGORY_ICONS[opp.category]} {CATEGORY_LABELS[opp.category]}
        </div>
        <div className="text-xs text-muted mt-2">
          Add <strong style={{ color: "var(--text)", fontWeight: 600 }}>{opp.bestCard?.name}</strong>
          {" · "}{(opp.bestRate * 100).toFixed(1)}% effective vs your current {(opp.currentRate * 100).toFixed(1)}%
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
        <div className="font-mono" style={{ fontSize: "15px", fontWeight: 500, color: "var(--green)" }}>
          +${opp.annualUplift.toFixed(0)}/yr
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { wallet, spendProfile, purchaseLog } = useWallet();
  const [catalogCards, setCatalogCards] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (wallet.length > 0) {
      api.getCards().then((data) => setCatalogCards(data.cards || [])).catch(() => {});
    }
  }, [wallet.length]);

  if (wallet.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Home</h1>
        </div>
        <div className="onboarding-card">
          <div style={{ fontSize: "40px", marginBottom: "18px" }}>💳</div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "10px" }}>Welcome to KYC</div>
          <p className="text-sm text-muted" style={{ lineHeight: "1.65", marginBottom: "28px" }}>
            Add your credit cards to your vault and KYC will score your wallet, surface reward gaps, and tell you exactly which card to use for every purchase.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/vault")}>
            Add your first card
          </button>
        </div>
      </div>
    );
  }

  const score = computeHealthScore(wallet, spendProfile, catalogCards);
  const annualRewards = computeEstimatedAnnualRewards(wallet, spendProfile);
  const opportunities = computeOpportunities(wallet, spendProfile, catalogCards);
  const { spend, rewards } = computeThisMonthStats(purchaseLog);
  const hasSpendProfile = Object.values(spendProfile).some((v) => v > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1 className="page-title">Home</h1>
        <p className="page-subtitle">Your rewards snapshot</p>
      </div>

      {hasSpendProfile ? (
        <WalletHealthScore score={score} annualRewards={annualRewards} />
      ) : (
        <div className="card" style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Set your spend profile</div>
            <div className="text-sm text-muted">Enter your monthly spend in Insights to unlock your health score and reward opportunities.</div>
          </div>
          <button className="btn btn-ghost" style={{ flexShrink: 0 }} onClick={() => navigate("/insights")}>
            Set up →
          </button>
        </div>
      )}

      <div className="stat-grid">
        <StatCard label="This Month Spend" value={`$${spend.toFixed(0)}`} sub="logged via Optimizer" />
        <StatCard label="Rewards Earned" value={`$${rewards.toFixed(2)}`} sub="this month, estimated" />
        <StatCard label="Cards in Wallet" value={String(wallet.length)} sub={wallet.length === 1 ? "1 card tracked" : `${wallet.length} cards tracked`} />
      </div>

      {opportunities.length > 0 && (
        <div className="card">
          <div className="section-title">Opportunities</div>
          <div className="section-subtitle">Categories where a card upgrade would earn you more</div>
          {opportunities.map((opp) => (
            <OpportunityRow key={opp.category} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
