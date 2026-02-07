# Tradovate Risk Management

Set daily loss limits and daily profit targets on your Tradovate accounts via the API. When either threshold is hit, the account is auto-liquidated and stays closed for the remainder of the day.

## Prerequisites

- Node.js 18+ (for native `fetch` and `parseArgs`)
- A Tradovate account with API access
- An API Key (`cid` + `sec`) from Tradovate

## Setup

```bash
# Install dependencies
npm install

# Copy the example env file and fill in your credentials
cp .env.example .env
```

Edit `.env` with your Tradovate credentials:

```env
TRADOVATE_USERNAME=your_username
TRADOVATE_PASSWORD=your_password
TRADOVATE_APP_ID=SampleApp
TRADOVATE_APP_VERSION=1.0
TRADOVATE_CID=8
TRADOVATE_SEC=your_api_secret_key
TRADOVATE_DEVICE_ID=your_unique_device_id
TRADOVATE_ENV=demo
```

Set `TRADOVATE_ENV=live` when you're ready to target your live account.

## Usage

```bash
# Set $500 daily loss limit and $1000 daily profit target on all active accounts
npx tsx src/main.ts --daily-loss 500 --daily-profit 1000

# View current auto-liq settings without changing anything
npx tsx src/main.ts --view

# Target a specific account by ID
npx tsx src/main.ts --daily-loss 500 --daily-profit 1000 --account-id 12345

# Allow the account to re-open after being triggered (default is to stay closed)
npx tsx src/main.ts --daily-loss 500 --daily-profit 1000 --no-lock
```

## How It Works

1. **Authenticates** with the Tradovate REST API using your credentials and API key
2. **Fetches** all accounts associated with your user
3. **Reads** existing `UserAccountAutoLiq` settings for each account
4. **Sets** `dailyLossAutoLiq` and `dailyProfitAutoLiq` via the `/userAccountAutoLiq/updateuserautoliq` endpoint
5. **Locks** the account after trigger (`doNotUnlock: true`) so it stays closed for the day

## Key API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `POST /auth/accesstokenrequest` | Authenticate and get access token |
| `GET /auth/renewaccesstoken` | Renew token before expiry |
| `GET /account/list` | List all accounts |
| `GET /userAccountAutoLiq/deps` | Get auto-liq settings for an account |
| `POST /userAccountAutoLiq/updateuserautoliq` | Create/update auto-liq settings |

## Auto-Liq Fields Reference

| Field | Description |
|---|---|
| `dailyLossAutoLiq` | Dollar amount of daily loss that triggers auto-liquidation |
| `dailyProfitAutoLiq` | Dollar amount of daily profit that triggers auto-liquidation |
| `doNotUnlock` | If true, account stays locked after trigger |
| `weeklyLossAutoLiq` | Dollar amount of weekly loss that triggers auto-liquidation |
| `trailingMaxDrawdown` | Trailing max drawdown in dollars |
| `flattenTimestamp` | Specific time to flatten and cancel all positions |

## Building (optional)

```bash
npm run build      # Compile TypeScript to dist/
npm run start      # Run compiled JS from dist/
```

## Project Structure

```
src/
  config.ts     — Environment variables and API URL configuration
  auth.ts       — Authentication, token management, HTTP helpers
  accounts.ts   — Account listing
  risk.ts       — Auto-liquidation settings (get/set)
  main.ts       — CLI entry point
```
