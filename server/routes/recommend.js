import { Router } from "express";
import { z } from "zod";
import { getCardRecommendation } from "../services/claude.js";

const router = Router();

const RecommendSchema = z.object({
  card_ids: z.array(z.string()).min(1, "At least one card required"),
  category: z.enum([
    "dining", "groceries", "travel", "gas", "streaming",
    "drugstore", "online_shopping", "entertainment", "transit",
    "home_improvement", "everything_else",
  ]),
  amount: z.number().positive("Amount must be positive"),
  merchant: z.string().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = RecommendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { card_ids, category, amount, merchant } = parsed.data;

    const result = await getCardRecommendation({
      userCardIds: card_ids,
      category,
      amount,
      merchant,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
