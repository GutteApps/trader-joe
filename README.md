# TraderJew

A visually-clean tracker for **paper (fake)** and **real** trading portfolios,
driven by an external "claw bot". The bot posts daily asset signals; the group
approves buys in WhatsApp; the bot (or you) records the buys/sells here through a
simple REST API. The dashboard shows each holding's price chart with your entry
points, allocation, P&L, and total portfolio value over time.

> The bot is a **separate project**. This app just exposes a clean HTTP API it
> can read from and write to.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS 4**
- **Prisma** → **Postgres** (Supabase / Neon)
- **Recharts** for charts
- Prices: **CoinGecko** (crypto, no key) · **Finnhub**/**Stooq** (stocks)

## Setup

```bash
# 1. Install deps
npm install

# 2. Configure env (copy the example and fill in DATABASE_URL)
cp .env.example .env
#   - DATABASE_URL   -> your Supabase/Neon Postgres URI
#   - BOT_API_KEY    -> already generated for you in .env (or: openssl rand -hex 32)
#   - FINNHUB_API_KEY-> optional; enables live stock quotes (free at finnhub.io)

# 3. Create the schema + seed sample data
npm run db:push
npm run db:seed

# 4. Run
npm run dev        # http://localhost:3000
```

## Pages

| Route                 | What it shows                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `/`                   | All portfolios with live value + P&L, "paper/real" badges, create   |
| `/recommendations`    | Pending bot signals — approve (→ records a buy) or dismiss           |
| `/portfolios/[id]`    | Value curve, holdings, per-asset charts w/ entry markers, trade log  |

## Bot API

All bot endpoints live under `/api/bot/*` and require the API key, sent as
**either**:

```
Authorization: Bearer <BOT_API_KEY>
# or
X-API-Key: <BOT_API_KEY>
```

Responses are `{ "ok": true, "data": ... }` or `{ "ok": false, "error": ... }`.

### List portfolios — `GET /api/bot/portfolios`

```bash
curl -H "Authorization: Bearer $BOT_API_KEY" \
  http://localhost:3000/api/bot/portfolios
```

### Read one portfolio (holdings + values) — `GET /api/bot/portfolios/:id`

Use this before selling so the bot knows current holdings.

```bash
curl -H "Authorization: Bearer $BOT_API_KEY" \
  http://localhost:3000/api/bot/portfolios/<id>
```

### Post a daily signal — `POST /api/bot/recommendations`

```bash
curl -X POST -H "Authorization: Bearer $BOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "symbol": "SOL",
        "name": "Solana",
        "assetType": "CRYPTO",
        "rationale": "Breakout above range; rising DEX volume.",
        "targetPrice": 210,
        "suggestedQty": 15
      }' \
  http://localhost:3000/api/bot/recommendations
```

`priceAtRec` is optional — if omitted the current market price is snapshotted.
Signals appear on `/recommendations` for the group to approve.

### Record a buy or sell — `POST /api/bot/trades`

This is the main write. Send it once the group approves a pick (buy) or decides
to exit (sell). `price` is optional (falls back to the live market price);
`approvedBy` records who signed off.

```bash
# BUY
curl -X POST -H "Authorization: Bearer $BOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "portfolioId": "<id>",
        "symbol": "SOL",
        "assetType": "CRYPTO",
        "side": "BUY",
        "quantity": 15,
        "price": 152.30,
        "approvedBy": "Matan",
        "recommendationId": "<optional-signal-id>"
      }' \
  http://localhost:3000/api/bot/trades

# SELL
curl -X POST -H "Authorization: Bearer $BOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "portfolioId": "<id>",
        "symbol": "SOL",
        "assetType": "CRYPTO",
        "side": "SELL",
        "quantity": 5,
        "approvedBy": "Dana"
      }' \
  http://localhost:3000/api/bot/trades
```

Positions, average cost, realized/unrealized P&L, and open/closed status are all
updated automatically. Passing `recommendationId` also marks that signal as
approved and links it to the trade.

### Field reference — `POST /api/bot/trades`

| Field              | Type                | Notes                                    |
| ------------------ | ------------------- | ---------------------------------------- |
| `portfolioId`      | string (required)   | Target portfolio                         |
| `symbol`           | string (required)   | e.g. `BTC`, `AAPL`                        |
| `assetType`        | `CRYPTO` \| `STOCK` | required                                 |
| `side`             | `BUY` \| `SELL`     | required                                 |
| `quantity`         | number (required)   | > 0                                      |
| `price`            | number (optional)   | omit → live market price                 |
| `fee`              | number (optional)   | folded into cost basis                   |
| `approvedBy`       | string (optional)   | who approved in the group                |
| `note`             | string (optional)   |                                          |
| `executedAt`       | ISO string (opt.)   | defaults to now                          |
| `recommendationId` | string (optional)   | link + mark the originating signal       |
| `source`           | `BOT` \| `MANUAL`   | defaults to `BOT`                        |

## Data model

`Portfolio` (FAKE/REAL) → `Position` (one per symbol, avg cost + realized P&L)
→ `Trade` (every BUY/SELL). `Recommendation` holds the bot's daily picks.

## Notes

- Money/quantities are stored as `Float` for clean JSON + charting during dummy
  trading. When moving to **real money**, tighten these to `Decimal` in
  `prisma/schema.prisma` and re-migrate.
- Crypto prices need no API key. Stock **history** uses Stooq (free); live stock
  **quotes** use Finnhub if `FINNHUB_API_KEY` is set, otherwise last close.
