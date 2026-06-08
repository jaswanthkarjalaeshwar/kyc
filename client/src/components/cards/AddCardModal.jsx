import { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { track, EVENT_TYPES } from "../../utils/analytics";

const TABS = ["Browse Catalog", "Paste Card URL"];

function CatalogTab({ onSelect }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getCards().then((data) => {
      setCards(data.cards);
      setLoading(false);
    });
  }, []);

  const filtered = cards.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.issuer.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        Loading catalog...
      </div>
    );
  }

  return (
    <div>
      <input
        className="form-input mb-4"
        placeholder="Search cards..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map((card) => (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "border-color 0.15s",
              textAlign: "left",
              width: "100%",
              color: "var(--text)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{card.name}</div>
              <div className="text-xs text-muted mt-2">
                {card.issuer} · {card.network} ·{" "}
                {card.annual_fee === 0 ? "No fee" : `$${card.annual_fee}/yr`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                className="badge"
                style={{
                  background: card.reward_currency === "cashback" ? "var(--green-dim)" : "var(--accent-glow)",
                  color: card.reward_currency === "cashback" ? "var(--green)" : "var(--accent)",
                }}
              >
                {card.reward_currency}
              </div>
              <div className="text-xs text-muted mt-2">{card.credit_score_required} credit</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-muted" style={{ padding: "24px", textAlign: "center" }}>
            No cards match "{search}"
          </div>
        )}
      </div>
    </div>
  );
}

function ScrapeTab({ onSelect }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState(null);

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setExtracted(null);
    track(EVENT_TYPES.SCRAPE_ATTEMPTED, { url });

    try {
      const data = await api.scrapeCard(url.trim());
      setExtracted(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const card = {
      ...extracted,
      id: `custom-${Date.now()}`,
      image_color: "#2d2d2d",
      reward_tiers: extracted.reward_tiers || [],
    };
    track(EVENT_TYPES.SCRAPE_CONFIRMED, { card_name: card.name });
    onSelect(card);
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4" style={{ lineHeight: "1.6" }}>
        Paste the URL of your card's page on your bank's website. KYC will extract the reward structure automatically — you'll review before saving.
      </p>
      <div className="flex gap-2 mb-4">
        <input
          className="form-input"
          placeholder="https://www.chase.com/credit-cards/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScrape()}
        />
        <button
          className="btn btn-primary"
          onClick={handleScrape}
          disabled={!url.trim() || loading}
          style={{ whiteSpace: "nowrap" }}
        >
          {loading ? <><span className="spinner" /></> : "Extract"}
        </button>
      </div>

      {error && (
        <div className="text-sm" style={{ color: "var(--red)", padding: "12px", background: "var(--red-dim)", borderRadius: "var(--radius-sm)" }}>
          {error}
        </div>
      )}

      {extracted && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <div style={{ fontWeight: 700, marginBottom: "12px" }}>Review extracted data</div>

          {extracted.extraction_confidence && (
            <div className="flex gap-2 mb-3">
              <span
                className="badge"
                style={{
                  background: extracted.extraction_confidence === "high" ? "var(--green-dim)" : "var(--gold-dim)",
                  color: extracted.extraction_confidence === "high" ? "var(--green)" : "var(--gold)",
                }}
              >
                {extracted.extraction_confidence} confidence
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            {[
              ["Card name", extracted.name],
              ["Issuer", extracted.issuer],
              ["Network", extracted.network],
              ["Annual fee", extracted.annual_fee != null ? `$${extracted.annual_fee}` : "—"],
              ["Reward type", extracted.reward_currency],
              ["Program", extracted.reward_program || "—"],
              ["Base rate", extracted.reward_currency === "cashback"
                ? `${((extracted.base_earn_rate || 0) * 100).toFixed(1)}%`
                : `${extracted.base_earn_rate}x`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span>{value || "—"}</span>
              </div>
            ))}
          </div>

          {extracted.reward_tiers?.length > 0 && (
            <div>
              <div className="text-xs text-muted mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Bonus categories
              </div>
              {extracted.reward_tiers.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm" style={{ padding: "4px 0" }}>
                  <span className="text-muted" style={{ textTransform: "capitalize" }}>
                    {t.category?.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-xs" style={{ color: "var(--gold)" }}>
                    {extracted.reward_currency === "cashback"
                      ? `${((t.earn_rate || 0) * 100).toFixed(0)}%`
                      : `${t.earn_rate}x`}
                    {t.cap_amount ? ` (up to $${t.cap_amount.toLocaleString()}/${t.cap_period})` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {extracted.extraction_notes && (
            <div className="text-xs text-muted mt-3" style={{ padding: "8px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", lineHeight: "1.6" }}>
              ⚠️ {extracted.extraction_notes}
            </div>
          )}

          <button className="btn btn-primary w-full mt-4" style={{ justifyContent: "center" }} onClick={handleConfirm}>
            Looks good — Add to Vault
          </button>
        </div>
      )}
    </div>
  );
}

export default function AddCardModal({ onAdd, onClose }) {
  const [tab, setTab] = useState(0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "24px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div style={{ fontWeight: 800, fontSize: "18px" }}>Add a Card</div>
          <button className="btn btn-ghost" style={{ padding: "6px 10px" }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {TABS.map((label, i) => (
            <button
              key={label}
              className={`btn ${tab === i ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 0 ? (
          <CatalogTab onSelect={onAdd} />
        ) : (
          <ScrapeTab onSelect={onAdd} />
        )}
      </div>
    </div>
  );
}
