import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import cardsRouter from "./routes/cards.js";
import recommendRouter from "./routes/recommend.js";
import analysisRouter from "./routes/analysis.js";
import scrapeRouter from "./routes/scrape.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// General rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again shortly." },
});

// Tighter limit on AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "AI request limit reached. Please wait a moment." },
});

app.use("/api", limiter);
app.use("/api/recommend", aiLimiter);
app.use("/api/analysis", aiLimiter);
app.use("/api/scrape", aiLimiter);

app.use("/api/cards", cardsRouter);
app.use("/api/recommend", recommendRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/scrape", scrapeRouter);

app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`KYC server running on port ${PORT}`);
});
