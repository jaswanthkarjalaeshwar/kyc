import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { api } from "../utils/api";
import { track, EVENT_TYPES } from "../utils/analytics";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "../../../shared/schema.js";

const CATEGORIES = Object.entries(CATEGORY_LABELS);

function RecentLogs({ log }) {
  const recent = log.slice(0, 5);
  if (!recent.length) return null;

  return (
    <div className="card" style={{ marginTop: "16px" }}>
      <div className="section-title" style={{ marginBottom: "12px" }}>Recent Logs</div>
      {recent.map((entry, i) => (
        <div
          key={entry.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", fontWeight: 500 }}>{entry.cardName}</div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              {CATEGORY_LABELS[entry.category] || entry.category}
              {" · "}${entry.amount?.toFixed(2)}
            </div>
          </div>
          <div className="font-mono text-sm text-green">{entry.estimatedValue}</div>
        </div>
      ))}
    </div>
  );
}

function RecommendationResult({ result, onUseCard }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="result-winner">
        <div className="result-label">Best card for this purchase</div>
        <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
          {result.winner.card_name}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div>
            <div className="result-label">Earn rate</div>
            <div className="font-mono" style={{ fontSize: "15px", color: "var(--accent)" }}>
              {result.winner.earn_rate_display}
            </div>
          </div>
          <div style={{ width: "1px", height: "32px", background: "var(--border)" }} />
          <div>
            <div className="result-label">Estimated value</div>
            <div className="result-value">{result.winner.estimated_value}</div>
          </div>
          <div style={{ width: "1px", height: "32px", background: "var(--border)" }} />
          <div>
            <div className="result-label">Confidence</div>
            <span
              className="badge"
              style={{
                background: result.confidence === "high" ? "var(--green-dim)" : "var(--gold-dim)",
                color: result.confidence === "high" ? "var(--green)" : "var(--gold)",
              }}
            >
              {result.confidence}
            </span>
          </div>
        </div>
        <p className="text-sm text-muted" style={{ marginTop: "14px", lineHeight: "1.65" }}>
          {result.winner.reasoning}
        </p>
        <button className="btn btn-primary mt-4" onClick={onUseCard}>
          ✓ Use this card
        </button>
      </div>

      {result.alternatives?.length > 0 && (
        <div className="card">
          <div className="result-label mb-4">Alternatives</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {result.alternatives.map((alt) => (
              <div key={alt.card_id} className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>{alt.card_name}</div>
                  <div className="text-xs text-muted mt-2">{alt.earn_rate_display}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="font-mono text-sm">{alt.estimated_value}</div>
                  <div className="text-xs text-red">{alt.gap}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.compliance_note && (
        <div
          className="text-xs text-muted"
          style={{ padding: "12px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", lineHeight: "1.6", border: "1px solid var(--border)" }}
        >
          ℹ️ {result.compliance_note}
        </div>
      )}
    </div>
  );
}

export default function Optimizer() {
  const { wallet, walletCardIds, purchaseLog, logPurchase } = useWallet();
  const { showToast } = useToast();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const canSubmit = wallet.length > 0 && category && amount && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.recommend({
        cardIds: walletCardIds,
        category,
        amount: parseFloat(amount),
        merchant: merchant || undefined,
      });
      setResult(data);
      track(EVENT_TYPES.RECOMMENDATION_VIEWED, { category, amount, merchant });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCard = () => {
    if (!result) return;
    logPurchase({
      cardId: result.winner.card_id,
      cardName: result.winner.card_name,
      category,
      amount: parseFloat(amount),
      estimatedValue: result.winner.estimated_value,
      merchant: merchant || null,
    });
    track(EVENT_TYPES.RECOMMENDATION_ACCEPTED, { card_id: result.winner.card_id, category, amount });
    showToast(`Logged — ${result.winner.card_name} · ${result.winner.estimated_value} earned`);
  };

  if (wallet.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Optimizer</h1>
          <p className="page-subtitle">Which card should you use for this purchase?</p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🤔</div>
          <div className="empty-state-title">No cards in your vault</div>
          <div className="empty-state-body">Add at least one card in your Vault to get purchase recommendations.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Optimizer</h1>
        <p className="page-subtitle">Tell KYC what you're buying and get an instant recommendation.</p>
      </div>

      <div className="split-grid">
        <div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setResult(null); }}
              >
                <option value="">Select a category...</option>
                {CATEGORIES.map(([key, label]) => (
                  <option key={key} value={key}>{CATEGORY_ICONS[key]} {label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Amount ($)</label>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="85.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setResult(null); }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Merchant (optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Whole Foods"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary w-full"
              style={{ justifyContent: "center" }}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? <><span className="spinner" /> Analyzing...</> : "Find Best Card"}
            </button>
          </div>

          <RecentLogs log={purchaseLog} />
        </div>

        <div>
          {error && (
            <div className="card" style={{ borderColor: "var(--red)", background: "var(--red-dim)" }}>
              <div style={{ color: "var(--red)", fontWeight: 600 }}>Something went wrong</div>
              <div className="text-sm text-muted mt-2">{error}</div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="empty-state" style={{ paddingTop: "72px" }}>
              <div className="empty-state-icon">✨</div>
              <div className="empty-state-title">Ready to optimize</div>
              <div className="empty-state-body">
                Fill in the purchase details and KYC will rank your {wallet.length} card{wallet.length !== 1 ? "s" : ""} by actual dollar value.
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              Comparing your cards...
            </div>
          )}

          {result && !loading && (
            <RecommendationResult result={result} onUseCard={handleUseCard} />
          )}
        </div>
      </div>
    </div>
  );
}
