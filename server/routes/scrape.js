import { Router } from "express";
import { z } from "zod";
import { scrapeCardFromUrl } from "../services/claude.js";

const router = Router();

const ScrapeSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = ScrapeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { url } = parsed.data;

    // Block non-http(s) and known non-card URLs
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Only HTTP/HTTPS URLs are supported" });
    }

    const result = await scrapeCardFromUrl(url);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
