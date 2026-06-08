import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { api } from "../utils/api";
import { track, EVENT_TYPES } from "../utils/analytics";
import { CATEGORY_LABELS, CATEGORY_ICONS, SPEND_CATEGORIES } from "../../../shared/schema.js";

function SpendInput({ profile, onChange }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: "16px" }}>Monthly Spend Profile</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {SPEND_CATEGORIES.filter((c) => c !== "everything_else").map((cat) => (
          <div key={cat} className="flex items-center gap-3">
            <span style={{ fontSize: "18px", width: "24px" }}>{CATEGORY_ICONS[cat]}</span>
            <label
              className="text-sm"
              style={{ flex: 1, color: "var(--text-muted)", textTransform: "capitalize" }}
            >
              {CATEGORY_LABELS[cat]}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="text-sm text-muted">$</span>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="0"
                style={{ width: "90px", textAlign: "right" }}
                value={profile[cat] || ""}
                onChange={(e) =>
                  onChange({ ...profile, [cat]: parseFloat(e.target.value) || 0 })
                }
              />
              <span className="text-xs text-muted">/mo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisResult({ result }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary */}
      <div className="result-winner">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <div className="result-label">Current annual value</div>
            <div className="result-value">${result.current_annual_value?.toFixed(0)}</div>
          </div>
          <div style={{ fontSize: "20px", color: "var(--text-dim)" }}>→</div>
          <div>
            <div className="result-label">Potential annual value</div>
            <div className="result-value" style={{ color: "var(--accent)" }}>
              ${result.projected_annual_value?.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="result-label">Uplift</div>
            <div className="font-mono" style={{ fontSize: "22px", color: "var(--gold)" }}>
              +${result.annual_uplift?.toFixed(0)}
            </div>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
          {result.summary}
        </p>
      </div>

      {/* Leakage by category */}
      {result.leakage_by_category?.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: "16px" }}>Reward Leakage by Category</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {result.leakage_by_category
              .sort((a, b) => b.leakage - a.leakage)
              .map((item, i) => (
                <div
                  key={item.category}
                  style={{
                    padding: "12px 0",
                    borderBottom: i < result.leakage_by_category.length - 1 ? "1px solid var(--border)" : "none",
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: "16px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, textTransform: "capitalize" }}>
                      {item.category.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted mt-2">
                      ${item.annual_spend?.toLocaleString()}/yr · currently {item.current_rate}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="text-xs text-muted">Best available</div>
                    <div className="text-sm" style={{ color: "var(--accent)" }}>{item.best_available_rate}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="text-xs text-muted">via</div>
                    <div className="text-sm">{item.best_available_card}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {item.leakage > 0 ? (
                      <span className="badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>
                        -${item.leakage?.toFixed(0)}
                      </span>
                    ) : (
                      <span className="badge badge-green">Optimized</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations?.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, marginBottom: "16px", fontSize: "16px" }}>
            Recommended Upgrades
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {result.recommendations.map((rec) => (
              <div key={rec.card_id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700 }}>{rec.card_name}</div>
                    <div className="text-xs text-muted mt-2">
                      {rec.annual_fee === 0 ? "No annual fee" : `$${rec.annual_fee}/yr`} ·{" "}
                      {rec.credit_score_required} credit · APR {rec.apr_range}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="result-label">Net annual uplift</div>
                    <div className="font-mono" style={{ fontSize: "20px", color: "var(--green)" }}>
                      +${rec.net_annual_uplift?.toFixed(0)}
                    </div>
                  </div>
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "12px" }}>
                  {rec.why}
                </p>
                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                  {rec.best_for_categories?.map((cat) => (
                    <span key={cat} className="badge badge-accent">
                      {CATEGORY_ICONS[cat]} {cat.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                <button
                  className="btn btn-ghost mt-4"
                  onClick={() => track(EVENT_TYPES.UPGRADE_CLICKED, { card_id: rec.card_id })}
                >
                  Learn more ↗
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Analysis() {
  const { wallet, walletCardIds, spendProfile, updateSpendProfile } = useWallet();
  const [localProfile, setLocalProfile] = useState(spendProfile);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const totalMonthly = Object.values(localProfile).reduce((s, v) => s + (v || 0), 0);
  const canSubmit = wallet.length > 0 && totalMonthly > 0 && !loading;

  const handleRun = async () => {
    if (!canSubmit) return;
    updateSpendProfile(localProfile);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.analyze({ cardIds: walletCardIds, spendProfile: localProfile });
      setResult(data);
      track(EVENT_TYPES.GAP_ANALYSIS_RUN, { total_monthly_spend: totalMonthly });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (wallet.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Gap Analysis</h1>
          <p className="page-subtitle">See where you're leaving rewards on the table.</p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No cards in your vault</div>
          <div className="empty-state-body">Add your cards first, then run a gap analysis to see your annual reward leakage.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Gap Analysis</h1>
        <p className="page-subtitle">Enter your monthly spend and KYC will find where you're losing rewards.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "32px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SpendInput profile={localProfile} onChange={setLocalProfile} />

          {totalMonthly > 0 && (
            <div className="text-sm text-muted" style={{ padding: "0 4px" }}>
              Total: <span className="font-mono" style={{ color: "var(--text)" }}>${totalMonthly.toLocaleString()}/mo</span>
              {" "}(${(totalMonthly * 12).toLocaleString()}/yr)
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            style={{ justifyContent: "center" }}
            onClick={handleRun}
            disabled={!canSubmit}
          >
            {loading ? (
              <><span className="spinner" /> Running analysis...</>
            ) : (
              "Run Gap Analysis"
            )}
          </button>
        </div>

        <div>
          {error && (
            <div className="card" style={{ borderColor: "var(--red)", background: "var(--red-dim)" }}>
              <div style={{ color: "var(--red)", fontWeight: 600 }}>Something went wrong</div>
              <div className="text-sm text-muted mt-2">{error}</div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="empty-state" style={{ paddingTop: "80px" }}>
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">Ready to analyze</div>
              <div className="empty-state-body">
                Fill in your monthly spend across categories. KYC will calculate your annual reward leakage and surface the top 3 cards that would close the gap.
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              Analyzing your reward capture...
            </div>
          )}

          {result && !loading && <AnalysisResult result={result} />}
        </div>
      </div>
    </div>
  );
}
