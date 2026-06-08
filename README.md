# KYC — Know Your Card

> AI-powered credit card optimizer. Know which card to use for every purchase and where your portfolio is leaking rewards.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Claude API](https://img.shields.io/badge/Claude-Sonnet-D97706?style=flat)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat)

-----

## What is KYC?

Most people own 2-4 credit cards but use the wrong one for most purchases — leaving hundreds of dollars in rewards on the table every year.

KYC solves this in three ways:

- **Optimizer** — tell it what you’re buying, get the best card in your wallet ranked by actual dollar value earned
- **Gap Analysis** — enter your monthly spend by category, see exactly where you’re losing rewards and which card would close the gap
- **Card Vault** — manage your wallet, add cards from a curated catalog of 29 major US cards, or paste any bank’s card URL and let the AI extract the reward structure automatically

-----

## Demo

|Optimizer                                                      |Gap Analysis                                                           |Card Vault                                 |
|---------------------------------------------------------------|-----------------------------------------------------------------------|-------------------------------------------|
|Pick a category + amount → ranked recommendation with reasoning|Monthly spend profile → annual reward leakage + upgrade recommendations|Curated catalog + AI-powered URL extraction|

-----

## Tech Stack

|Layer     |Technology                   |
|----------|-----------------------------|
|Frontend  |React 18, Vite, React Router |
|Backend   |Node.js, Express             |
|AI        |Anthropic Claude API (Sonnet)|
|Database  |Firebase Firestore (optional)|
|Validation|Zod                          |

The AI does three jobs: ranks cards for a specific purchase, runs gap analysis against the full card catalog, and extracts reward structures from bank URLs. All reward math (health score, opportunities feed, card comparison) runs client-side — Claude is only called when the user explicitly requests it.

-----

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com)
- Firebase project (optional — app works fully without it, wallet persists to localStorage)

### Installation

```bash
# Clone the repo
git clone https://github.com/jaswanthkarjalaeshwar/kyc.git
cd kyc

# Install all dependencies (root + client + server)
npm run install:all

# Set up environment (Mac/Linux)
cp server/.env.example server/.env

# Set up environment (Windows)
copy server\.env.example server\.env

# Open server/.env and add your ANTHROPIC_API_KEY

# Start client and server concurrently
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3001`

### Environment Variables

```bash
# server/.env
ANTHROPIC_API_KEY=your_key_here
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # optional
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

Firebase is optional. Without it, wallet and spend profile persist to localStorage automatically.

-----

## Project Structure

```
kyc/
├── client/                        # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── cards/             # AddCardModal (catalog browser + URL scraper)
│       │   └── shared/            # Toast notifications
│       ├── context/               # WalletContext, ToastContext
│       ├── pages/
│       │   ├── Home.jsx           # Dashboard — health score, opportunities feed
│       │   ├── Vault.jsx          # Card wallet management
│       │   ├── Optimizer.jsx      # Purchase optimizer
│       │   └── Insights.jsx       # Gap analysis + card comparison tool
│       └── utils/
│           ├── api.js             # Typed API client
│           └── analytics.js       # Funnel event tracking
├── server/
│   ├── data/
│   │   └── cards.json             # Curated catalog — 29 US credit cards
│   ├── middleware/                # Error handling
│   ├── routes/                    # REST endpoints
│   └── services/
│       ├── claude.js              # AI: optimizer, gap analysis, URL scraper
│       └── firebase.js            # Firestore: wallet, spend profile, events
└── shared/
    └── schema.js                  # Types, category constants, reward normalization
```

-----

## API Reference

```
GET  /api/cards                    # Full card catalog (filter by issuer, network, fee, type)
GET  /api/cards/:id                # Single card details
POST /api/recommend                # Card optimizer
                                   # body: { card_ids, category, amount, merchant? }
POST /api/analysis                 # Gap analysis
                                   # body: { card_ids, spend_profile }
POST /api/scrape                   # Extract card data from a URL
                                   # body: { url }
```

-----

## How Reward Normalization Works

Cards earn in different currencies — cashback, Chase points, Amex Membership Rewards, airline miles. To rank them accurately, KYC normalizes everything to **effective cashback rate**:

```
effective_rate = earn_rate × cpp

Chase Sapphire Preferred dining:   3 points × $0.020 = 6.0% effective
Amex Gold dining:                  4 points × $0.020 = 8.0% effective
Citi Double Cash everywhere:       2% cashback        = 2.0% effective
```

`cpp` (cents per point) reflects typical redemption value for each program — transfer partners for Chase/Amex, statement credit for cashback cards. These values are stored per card in `cards.json` and are the single most important data quality lever in the system.

-----

## Card Catalog

29 cards covering the most common cards in US consumer wallets across all major issuers:

**Chase** — Sapphire Preferred, Sapphire Reserve, Freedom Unlimited, Freedom Flex, Ink Business Preferred, Ink Business Cash, Marriott Bonvoy Boundless, United Explorer

**American Express** — Gold, Platinum, Blue Cash Preferred, Blue Cash Everyday, EveryDay

**Citi** — Double Cash, Custom Cash, Premier, Costco Anywhere Visa

**Capital One** — Venture X, SavorOne

**Others** — Wells Fargo Active Cash, Discover it Cash Back, Bilt Mastercard, Apple Card, Amazon Prime Rewards, U.S. Bank Altitude Go, Bank of America Premium Rewards, PNC Cash Rewards, USAA Cashback Rewards Plus, Navy Federal More Rewards

Cards not in the catalog can be added by pasting the bank’s card page URL — Claude extracts the reward structure and pre-fills a confirmation form.

-----

## Funnel Tracking

KYC instruments a conversion funnel out of the box:

|Event                    |Trigger                          |
|-------------------------|---------------------------------|
|`recommendation_viewed`  |Optimizer returns a result       |
|`recommendation_accepted`|User clicks “Use this card”      |
|`card_added`             |Card saved to wallet             |
|`gap_analysis_run`       |Gap analysis completes           |
|`upgrade_clicked`        |User clicks a card recommendation|
|`scrape_attempted`       |URL submitted for extraction     |
|`scrape_confirmed`       |Scraped card saved to wallet     |

Events log to Firestore when Firebase is configured, enabling product experiment analysis across recommendation acceptance rate, card-add rate, and upgrade click-through.

-----

## License

MIT