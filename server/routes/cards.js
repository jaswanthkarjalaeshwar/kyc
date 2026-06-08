import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(readFileSync(join(__dirname, "../data/cards.json"), "utf-8"));

// GET /api/cards — full catalog
router.get("/", (req, res) => {
  const { issuer, network, max_fee, reward_currency } = req.query;

  let results = [...cards];

  if (issuer) {
    results = results.filter((c) => c.issuer.toLowerCase() === issuer.toLowerCase());
  }
  if (network) {
    results = results.filter((c) => c.network.toLowerCase() === network.toLowerCase());
  }
  if (max_fee !== undefined) {
    results = results.filter((c) => c.annual_fee <= Number(max_fee));
  }
  if (reward_currency) {
    results = results.filter((c) => c.reward_currency === reward_currency);
  }

  res.json({ cards: results, total: results.length });
});

// GET /api/cards/:id — single card
router.get("/:id", (req, res) => {
  const card = cards.find((c) => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: "Card not found" });
  res.json(card);
});

export default router;
