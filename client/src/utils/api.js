const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error || `Request failed: ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status, data });
  }

  return data;
}

export const api = {
  // Card catalog
  getCards: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/cards${params ? `?${params}` : ""}`);
  },
  getCard: (id) => request(`/cards/${id}`),

  // AI optimizer
  recommend: ({ cardIds, category, amount, merchant }) =>
    request("/recommend", {
      method: "POST",
      body: JSON.stringify({ card_ids: cardIds, category, amount, merchant }),
    }),

  // AI gap analysis
  analyze: ({ cardIds, spendProfile }) =>
    request("/analysis", {
      method: "POST",
      body: JSON.stringify({ card_ids: cardIds, spend_profile: spendProfile }),
    }),

  // URL scraper
  scrapeCard: (url) =>
    request("/scrape", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
};
