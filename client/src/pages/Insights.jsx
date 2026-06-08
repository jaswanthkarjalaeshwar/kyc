import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { api } from "../utils/api";
import { track, EVENT_TYPES } from "../utils/analytics";
import { SPEND_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS } from "../../../shared/schema.js";

function effectiveRate(card, category) {
  const tier = card.reward_tiers?.find((t) => t.category === category);
  if (tier) return tier.earn_rate * (card.cpp || 1);
  return card.base_earn_rate * (card.cpp || 1);
}

// ── Spend Profile Input ───────────────────────────────────────────

function SpendProfileInput({ profile, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {SPEND_CATEGORIES.filter((c) => c !== "everything_else").map((cat) => (
        <div key={cat} className="flex items-center gap-3">
          <span style={{ fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 }}>{CATEGORY_ICONS[cat]}</span>
          <span className="text-sm text-muted" style={{ flex: 1 }}>{CATEGORY_LABELS[cat]}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="text-sm text-muted">$</span>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder="0"
              style={{ width: "86px", textAlign: "right", padding: "7px 10px" }}
              value={profile[cat] || ""}
              onChange={(e) => onChange({ ...profile, [cat]: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-xs text-muted">/mo</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section 1: Horizontal Bar Chart ──────────────────────────────

function RewardBarChart({ wallet, spendProfile, catalogCards }) {
  const rows = SPEND_CATEGORIES.filter((cat) => (spendProfile[cat] || 0) > 0).map((cat) => {
    const spend = spendProfile[cat] || 0;
    const currentRate = wallet.reduce((b, card) => Math.max(b, effectiveRate(card, cat)), 0);
    const potentialRate = catalogCards.reduce((b, card) => Math.max(b, effectiveRate(card, cat)), 0);
    return {
      category: cat,
      currentAnnual: currentRate * spend * 12,
      potentialAnnual: potentialRate * spend * 12,
    };
  });

  if (!rows.length) {
    return (
      <div style={{ padding: "24px 0", color: "var(--text-muted)", fontSize: "14px" }}>
        Enter your monthly spend above to see your reward capture by category.
      </div>
    );
  }

  const maxValue = Math.max(...rows.map((r) => r.potentialAnnual), 1);

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div style={{ width: 12, height: 10, borderRadius: 3, background: "var(--accent)" }} />
          <span className="text-xs text-muted">Your current capture</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 12, height: 10, borderRadius: 3, background: "var(--green)", opacity: 0.4 }} />
          <span className="text-xs text-muted">Catalog potential</span>
        </div>
      </div>

      {rows.map(({ category, currentAnnual, potentialAnnual }) => (
        <div key={category} className="bar-row">
          <div className="text-sm" style={{ lineHeight: 1.3 }}>
            {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "4px", height: "10px", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div
                  className="bar-fill bar-fill-current"
                  style={{ width: `${(currentAnnual / maxValue) * 100}%`, height: "100%" }}
                />
              </div>
              <span className="font-mono" style={{ fontSize: "11px", width: "48px", textAlign: "right", color: "var(--accent)", flexShrink: 0 }}>
                ${currentAnnual.toFixed(0)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "4px", height: "10px", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div
                  className="bar-fill bar-fill-potential"
                  style={{ width: `${(potentialAnnual / maxValue) * 100}%`, height: "100%" }}
                />
              </div>
              <span className="font-mono" style={{ fontSize: "11px", width: "48px", textAlign: "right", color: "var(--green)", flexShrink: 0 }}>
                ${potentialAnnual.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section 2: AI Recommendations ────────────────────────────────

function AIRecommendations({ wallet, spendProfile, walletCardIds }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const totalMonthly = Object.values(spendProfile).reduce((s, v) => s + (v || 0), 0);
  const canRun = wallet.length > 0 && totalMonthly > 0;

  const handleRun = async () => {
    if (!canRun || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.analyze({ cardIds: walletCardIds, spendProfile });
      setResult(data);
      track(EVENT_TYPES.GAP_ANALYSIS_RUN, { total_monthly_spend: totalMonthly });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: 16 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>AI Analysis</div>
          <div className="text-sm text-muted">Full gap analysis and card recommendations powered by Claude</div>
        </div>
        <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={handleRun} disabled={!canRun || loading}>
          {loading ? <><span className="spinner" /> Running...</> : "Run full AI analysis"}
        </button>
      </div>

      {!canRun && !result && (
        <div className="text-sm text-muted" style={{ padding: "14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          {!wallet.length ? "Add cards to your vault to run analysis." : "Set your monthly spend profile above to run analysis."}
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: "var(--red)", background: "var(--red-dim)" }}>
          <div style={{ color: "var(--red)", fontWeight: 600 }}>Something went wrong</div>
          <div className="text-sm text-muted mt-2">{error}</div>
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="triple-grid">
            <div className="stat-card" style={{ padding: "16px" }}>
              <div className="result-label">Current annual value</div>
              <div className="font-mono" style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)" }}>
                ${result.current_annual_value?.toFixed(0)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: "16px" }}>
              <div className="result-label">Potential value</div>
              <div className="font-mono" style={{ fontSize: "22px", fontWeight: 600, color: "var(--accent)" }}>
                ${result.projected_annual_value?.toFixed(0)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: "16px" }}>
              <div className="result-label">Annual uplift</div>
              <div className="font-mono" style={{ fontSize: "22px", fontWeight: 600, color: "var(--green)" }}>
                +${result.annual_uplift?.toFixed(0)}
              </div>
            </div>
          </div>

          {result.summary && (
            <p className="text-sm text-muted" style={{ lineHeight: "1.65" }}>{result.summary}</p>
          )}

          {result.recommendations?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {result.recommendations.map((rec) => (
                <div key={rec.card_id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 700 }}>{rec.card_name}</div>
                      <div className="text-xs text-muted mt-2">
                        {rec.annual_fee === 0 ? "No annual fee" : `$${rec.annual_fee}/yr`}
                        {" · "}{rec.credit_score_required} credit
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="result-label">Net uplift</div>
                      <div className="font-mono" style={{ fontSize: "20px", color: "var(--green)", fontWeight: 600 }}>
                        +${rec.net_annual_uplift?.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted" style={{ lineHeight: "1.65", marginBottom: "12px" }}>{rec.why}</p>
                  <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                    {rec.best_for_categories?.map((cat) => (
                      <span key={cat} className="badge badge-accent">
                        {CATEGORY_ICONS[cat]} {cat.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section 3: Card Comparison Tool ──────────────────────────────

function ComparisonTool({ catalogCards, spendProfile }) {
  const [cardAId, setCardAId] = useState("");
  const [cardBId, setCardBId] = useState("");

  const cardA = catalogCards.find((c) => c.id === cardAId) || null;
  const cardB = catalogCards.find((c) => c.id === cardBId) || null;
  const hasProfile = Object.values(spendProfile).some((v) => v > 0);

  function annualValue(card) {
    if (!card) return 0;
    let total = 0;
    for (const [cat, spend] of Object.entries(spendProfile)) {
      if (!spend) continue;
      total += effectiveRate(card, cat) * spend * 12;
    }
    return total - card.annual_fee;
  }

  const valueA = annualValue(cardA);
  const valueB = annualValue(cardB);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
        <div className="form-group">
          <label className="form-label">Card A</label>
          <select className="form-select" value={cardAId} onChange={(e) => setCardAId(e.target.value)}>
            <option value="">Select card...</option>
            {catalogCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Card B</label>
          <select className="form-select" value={cardBId} onChange={(e) => setCardBId(e.target.value)}>
            <option value="">Select card...</option>
            {catalogCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {(cardA || cardB) && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="coverage-table">
              <thead>
                <tr>
                  <th>Category</th>
                  {cardA && <th style={{ textAlign: "right" }}>{cardA.name}</th>}
                  {cardB && <th style={{ textAlign: "right" }}>{cardB.name}</th>}
                </tr>
              </thead>
              <tbody>
                {SPEND_CATEGORIES.map((cat) => {
                  const rA = cardA ? effectiveRate(cardA, cat) : null;
                  const rB = cardB ? effectiveRate(cardB, cat) : null;
                  const aWins = rA !== null && rB !== null && rA > rB;
                  const bWins = rA !== null && rB !== null && rB > rA;
                  return (
                    <tr key={cat}>
                      <td>{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}</td>
                      {cardA && (
                        <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", fontWeight: aWins ? 700 : 400, color: aWins ? "var(--accent)" : "var(--text)" }}>
                          {(rA * 100).toFixed(1)}%
                        </td>
                      )}
                      {cardB && (
                        <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", fontWeight: bWins ? 700 : 400, color: bWins ? "var(--accent)" : "var(--text)" }}>
                          {(rB * 100).toFixed(1)}%
                        </td>
                      )}
                    </tr>
                  );
                })}
                {hasProfile && cardA && cardB && (
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td style={{ fontWeight: 600 }}>Est. annual value</td>
                    <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: valueA >= valueB ? "var(--green)" : "var(--text)" }}>
                      ${valueA.toFixed(0)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: valueB > valueA ? "var(--green)" : "var(--text)" }}>
                      ${valueB.toFixed(0)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasProfile && cardA && cardB && (
            <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", fontSize: "13px", color: "var(--text-muted)", border: "1px solid var(--border)", lineHeight: "1.65" }}>
              Based on your spend profile, <strong style={{ color: "var(--text)" }}>{cardA.name}</strong> earns{" "}
              <strong className="font-mono" style={{ color: "var(--accent)" }}>${valueA.toFixed(0)}/yr</strong>, while{" "}
              <strong style={{ color: "var(--text)" }}>{cardB.name}</strong> earns{" "}
              <strong className="font-mono" style={{ color: "var(--accent)" }}>${valueB.toFixed(0)}/yr</strong>.{" "}
              {valueA > valueB
                ? `${cardA.name} comes out ahead by $${(valueA - valueB).toFixed(0)}/yr.`
                : valueB > valueA
                ? `${cardB.name} comes out ahead by $${(valueB - valueA).toFixed(0)}/yr.`
                : "They are essentially tied for your spend profile."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function Insights() {
  const { wallet, walletCardIds, spendProfile, updateSpendProfile } = useWallet();
  const [catalogCards, setCatalogCards] = useState([]);
  const [localProfile, setLocalProfile] = useState(spendProfile);
  const [profileSaved, setProfileSaved] = useState(true);

  useEffect(() => {
    api.getCards().then((data) => setCatalogCards(data.cards || [])).catch(() => {});
  }, []);

  const handleProfileChange = (profile) => {
    setLocalProfile(profile);
    setProfileSaved(false);
  };

  const handleSaveProfile = () => {
    updateSpendProfile(localProfile);
    setProfileSaved(true);
  };

  const totalMonthly = Object.values(localProfile).reduce((s, v) => s + (v || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Understand your reward capture and find your next best card</p>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", gap: 16 }}>
          <div>
            <div className="section-title" style={{ marginBottom: 4 }}>Monthly Spend Profile</div>
            {totalMonthly > 0 && (
              <div className="text-sm text-muted">
                Total: <span className="font-mono" style={{ color: "var(--text)" }}>${totalMonthly.toLocaleString()}/mo</span>
              </div>
            )}
          </div>
          <button
            className={`btn ${profileSaved ? "btn-ghost" : "btn-primary"}`}
            onClick={handleSaveProfile}
            disabled={profileSaved}
            style={{ flexShrink: 0 }}
          >
            {profileSaved ? "Saved" : "Save Profile"}
          </button>
        </div>
        <SpendProfileInput profile={localProfile} onChange={handleProfileChange} />
      </div>

      <div className="card">
        <div className="section-title">Reward Capture by Category</div>
        <div className="section-subtitle">Annual rewards at current rates vs catalog maximum potential</div>
        {!wallet.length ? (
          <div className="text-sm text-muted">Add cards to your vault to see your reward capture chart.</div>
        ) : (
          <RewardBarChart wallet={wallet} spendProfile={localProfile} catalogCards={catalogCards} />
        )}
      </div>

      <div className="card">
        <AIRecommendations wallet={wallet} spendProfile={localProfile} walletCardIds={walletCardIds} />
      </div>

      <div className="card">
        <div className="section-title">Card Comparison</div>
        <div className="section-subtitle">Compare any two cards from the full catalog side-by-side</div>
        {!catalogCards.length ? (
          <div className="loading-state" style={{ padding: "24px" }}>
            <div className="spinner" />
            Loading catalog...
          </div>
        ) : (
          <ComparisonTool catalogCards={catalogCards} spendProfile={localProfile} />
        )}
      </div>
    </div>
  );
}
