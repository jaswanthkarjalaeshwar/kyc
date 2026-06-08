import { Router } from "express";
import { z } from "zod";
import { getGapAnalysis } from "../services/claude.js";

const router = Router();

const CATEGORIES = [
  "dining", "groceries", "travel", "gas", "streaming",
  "drugstore", "online_shopping", "entertainment", "transit",
  "home_improvement", "everything_else",
];

const AnalysisSchema = z.object({
  card_ids: z.array(z.string()).min(1, "At least one card required"),
  spend_profile: z
    .record(z.string(), z.number().nonnegative())
    .refine(
      (profile) => Object.keys(profile).every((k) => CATEGORIES.includes(k)),
      { message: "spend_profile keys must be valid categories" }
    ),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = AnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { card_ids, spend_profile } = parsed.data;

    const result = await getGapAnalysis({
      userCardIds: card_ids,
      spendProfile: spend_profile,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
