/**
 * Funnel event tracking.
 * Fires to the server which logs to Firestore.
 * Fails silently — never block user flows on analytics.
 */

const EVENT_TYPES = {
  RECOMMENDATION_VIEWED: "recommendation_viewed",
  RECOMMENDATION_ACCEPTED: "recommendation_accepted",
  CARD_ADDED: "card_added",
  CARD_REMOVED: "card_removed",
  GAP_ANALYSIS_RUN: "gap_analysis_run",
  UPGRADE_CLICKED: "upgrade_clicked",
  SCRAPE_ATTEMPTED: "scrape_attempted",
  SCRAPE_CONFIRMED: "scrape_confirmed",
};

export { EVENT_TYPES };

export async function track(eventType, payload = {}) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, payload, timestamp: Date.now() }),
    });
  } catch {
    // Silent fail
  }
}
