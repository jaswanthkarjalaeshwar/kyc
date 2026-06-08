# KYC — Know Your Card

A credit card optimizer that tells you which card in your wallet to use for any purchase, and surfaces the reward leakage in your portfolio so you know when a new card actually pays for itself.

## What it does

**Card Vault** — add your existing cards from a curated catalog of 25 major cards, or paste any bank's card page URL and let the AI extract the reward structure automatically.

**Optimizer** — pick a spend category, enter an amount, and get a ranked recommendation across your wallet with the reasoning behind it and estimated dollar value per card.

**Gap Analysis** — enter your monthly spend by category. The analysis engine identifies where you're leaving money on the table and recommends net-new cards with projected annual value uplift.

## Tech

- React + Vite (client)
- Node.js + Express (server)
- Claude API (Sonnet) for optimizer recommendations, gap analysis, and card data extraction from URLs
- Firebase Firestore for user wallet and spend profile persistence
- Zod for API request validation

## Running locally

**Prerequisites:** Node 18+, an Anthropic API key, and a Firebase project (optional — wallet falls back to localStorage without it).

```bash
# Install dependencies
npm run install:all

# Set up environment
cp server/.env.example server/.env
# Edit server/.env with your ANTHROPIC_API_KEY

# Start both client and server
npm run dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:3001`.

## Project structure

```
kyc/
├── client/                  # React app
│   └── src/
│       ├── components/
│       │   └── cards/       # AddCardModal (catalog + URL scraper)
│       ├── context/         # WalletContext
│       ├── pages/           # Vault, Optimizer, Analysis
│       └── utils/           # api.js, analytics.js
├── server/
│   ├── data/
│   │   └── cards.json       # Curated card catalog (25 cards)
│   ├── middleware/          # Error handling
│   ├── routes/              # cards, recommend, analysis, scrape
│   └── services/
│       ├── claude.js        # AI services (optimizer, gap analysis, scraper)
│       └── firebase.js      # Firestore operations
└── shared/
    └── schema.js            # Shared types, category constants, normalization helpers
```

## API

```
GET  /api/cards              # Card catalog (filterable by issuer, network, fee, reward type)
GET  /api/cards/:id          # Single card
POST /api/recommend          # Card optimizer — { card_ids, category, amount, merchant? }
POST /api/analysis           # Gap analysis — { card_ids, spend_profile }
POST /api/scrape             # URL extraction — { url }
```

## Reward normalization

All cards are compared using effective cashback rate: `earn_rate × cpp (cents per point)`. This converts points, miles, and cashback to a common basis so the optimizer can rank them accurately. The cpp values in the catalog reflect typical redemption value for each program.

## Card catalog

The catalog covers the most common cards in US consumer wallets: Chase Sapphire Preferred/Reserve, Amex Gold/Platinum, Citi Double Cash/Custom Cash, Discover it, Capital One Venture X/SavorOne, Wells Fargo Active Cash, Blue Cash Preferred, Chase Freedom Unlimited/Flex, Bilt, Amazon Prime Rewards, Costco Visa, and a handful of others. Custom cards can be added via URL extraction.

## Firebase setup

The app works without Firebase — wallet and spend profile persist to localStorage. To enable cloud sync, create a Firebase project, generate a service account key, and paste the JSON into `FIREBASE_SERVICE_ACCOUNT` in your `.env`.
