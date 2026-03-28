# Risk Management API — Internal Documentation

## Overview

Microservice that proxies Tradovate's risk management API, allowing users to get and set daily loss limits (DLL), daily profit targets (DPT), and other auto-liquidation settings on their Tradovate accounts.

**Base URL:** `https://tradesyncer-prod-rm-api.azurewebsites.net/risk-management`
**Local:** `http://localhost:4000/risk-management`
**Scalar Docs:** `/risk-management/docs`
**Swagger UI:** `/risk-management/swagger`

---

## Authentication

All endpoints require a Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase_id_token>
```

The API verifies the token via Firebase Admin SDK, extracts the user's `uid`, then looks up the user's Tradovate access token from the `connection_tdv_access_token` table in Supabase using the `uid` + `connectionRef`.

---

## Endpoints

### GET /risk-management/accounts

List all Tradovate accounts for a connection.

| Param | Location | Type | Required |
|---|---|---|---|
| `connectionRef` | query | string | yes |

**Tradovate calls:** `GET /account/list`

**Response:**
```json
{ "success": true, "accounts": [{ "id": 40962983, "name": "MFFU...", ... }] }
```

---

### GET /risk-management/risk/{accountId}

Get current risk settings for an account.

| Param | Location | Type | Required |
|---|---|---|---|
| `accountId` | path | number | yes |
| `connectionRef` | query | string | yes |

**Tradovate calls:**
1. `GET /userAccountAutoLiq/deps?masterid={accountId}` (owner settings)
2. `GET /permissionedAccountAutoLiq/deps?masterid={accountId}` (permissioned settings)

Results are merged — permissioned data as base, owner data overlaid on top.

**Caching:** Results cached in Redis for 1 hour. Subsequent GETs return cached data.

**Response:**
```json
{
  "success": true,
  "cached": false,
  "autoLiq": {
    "id": 12345,
    "dailyLossAutoLiq": -500,
    "dailyProfitAutoLiq": 1000,
    "weeklyLossAutoLiq": null,
    "trailingMaxDrawdown": null,
    ...
  }
}
```

---

### PUT /risk-management/risk/{accountId}

Set or disable risk settings for an account.

| Param | Location | Type | Required |
|---|---|---|---|
| `accountId` | path | number | yes |
| `connectionRef` | body | string | yes |
| risk fields | body | number or null | at least one |

**Tradovate calls:** `POST /userAccountAutoLiq/updateuserautoliq`

**Caching:** Invalidates and refreshes Redis cache after update.

**Enable a limit:** send a number value
```json
{ "connectionRef": "TS-FE9AD2", "dailyLossAutoLiq": -500, "dailyProfitAutoLiq": 1000 }
```

**Disable a limit:** send `null`
```json
{ "connectionRef": "TS-FE9AD2", "dailyLossAutoLiq": null }
```

**Available fields:**

| Field | Type | Description |
|---|---|---|
| `dailyLossAutoLiq` | number/null | $ Daily Loss Limit |
| `dailyProfitAutoLiq` | number/null | $ Daily Profit Target |
| `weeklyLossAutoLiq` | number/null | $ Weekly Loss Limit |
| `weeklyProfitAutoLiq` | number/null | $ Weekly Profit Target |
| `dailyLossAlert` | number/null | $ Daily Loss Alert threshold |
| `dailyLossPercentageAlert` | number/null | Daily Loss % for Alert |
| `marginPercentageAlert` | number/null | Margin % for Alert |
| `dailyLossLiqOnly` | number/null | $ Daily Loss for Liquidate-Only mode |
| `dailyLossPercentageLiqOnly` | number/null | Daily Loss % for Liq-Only |
| `marginPercentageLiqOnly` | number/null | Margin % for Liq-Only |
| `dailyLossPercentageAutoLiq` | number/null | Daily Loss % for Auto-Liq |
| `marginPercentageAutoLiq` | number/null | Margin % for Auto-Liq |

---

## P-Ticket Handling (Rate Limits)

Tradovate imposes rate limits via a p-ticket mechanism. When rate-limited, Tradovate returns a JSON response with `p-ticket`, `p-time`, and optionally `p-captcha` instead of the actual data.

### POST requests (updateuserautoliq)

Full automatic retry:

```
1. POST /updateuserautoliq → response contains p-ticket + p-time
2. Wait p-time seconds
3. Retry same POST with p-ticket added to request body
4. If still p-ticket → update ticket/time, repeat (max 5 attempts)
5. If p-captcha: true at any point → stop immediately, throw error
6. If 5 retries exhausted → release via GET /user/list?p-ticket=<ticket>, throw error
```

**Max retries:** 5
**Default wait:** 3 seconds (overridden by `p-time` from response)

### GET requests (account/list, autoLiq/deps)

GET requests cannot carry a p-ticket in the body, so retries are not automatic:

```
1. GET /userAccountAutoLiq/deps → response contains p-ticket
2. Log warning with wait time
3. Throw error: "rate limited (p-ticket). Try again in Xs."
4. Frontend should retry after the specified wait time
```

### P-Ticket release (after exhausting retries)

When POST retries are exhausted, we call `GET /user/list?p-ticket=<ticket>` to release the rate limit state on Tradovate's side before throwing the error.

### P-Captcha

If Tradovate returns `p-captcha: true`, the operation cannot be retried from code. The user must wait ~1 hour. We stop immediately and return an error.

---

## Caching (Redis)

| Operation | Cache behavior |
|---|---|
| GET risk settings | Check Redis first → return if hit (skip Tradovate call) |
| PUT risk settings | Invalidate old cache → store new result from Tradovate |
| Cache TTL | 1 hour (3600 seconds) |
| Redis unavailable | Falls back silently — every request hits Tradovate directly |

---

## Logging

All activity is logged to both console (+ Grafana Loki in prod) and daily rotating log files.

**Log files:** `logs/risk-api-YYYY-MM-DD.log` (14-day retention)

**Local:** `./logs/`
**Production:** `/home/site/wwwroot/logs/` (accessible via Kudu at `https://tradesyncer-prod-rm-api.scm.azurewebsites.net`)

**What's logged:**

| Event | Level |
|---|---|
| All incoming HTTP requests (method, path, status, duration) | DEBUG/WARN |
| All outgoing Tradovate API calls with timing | INFO |
| Tradovate API errors | ERROR |
| P-ticket received, retry attempts, resolution | INFO |
| P-captcha blocked | ERROR |
| P-ticket release attempts | INFO/WARN |
| Cache HIT/SET/UPDATE with account ID | INFO |
| Risk settings changes with field values | INFO |
| Firebase auth failures | WARN |
| Controller errors with UID and account ID | ERROR |
| Server startup/shutdown | INFO |
| Unhandled crashes | ERROR |

**Trace a user:** `grep "<firebase_uid>" logs/risk-api-2026-03-26.log`

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `TOKEN_EXPIRED` | 401 | Tradovate access token expired — user needs to reconnect |
| `NOT_OWNER` | 403 | User doesn't own the account |
| `UNSUPPORTED_PARAMS` | 400 | Fields not supported on permissioned accounts |
| — | 400 | Joi validation error (bad input) |
| — | 500 | Unexpected error |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SERVICE_ACCOUNT_KEY` | yes | — | Firebase service account JSON |
| `SUPABASE_URL` | yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | Supabase service role key |
| `PORT` | no | 4000 | Server port |
| `REDIS_URL` | no | — | Redis connection string (caching disabled if not set) |
| `LOG_FILE_PATH` | no | `/home/site/wwwroot` | Base path for log directory |
| `GRAFANA_LOKI_URL` | no | — | Grafana Loki push URL |
| `GRAFANA_LOKI_USER` | no | — | Grafana Loki username |
| `GRAFANA_LOKI_TOKEN` | no | — | Grafana Loki API token |
| `GRAFANA_OTLP_URL` | no | — | Grafana OTLP metrics push URL |

---

## Architecture

```
Frontend (Next.js)
    │
    ▼ Firebase ID token + connectionRef
┌─────────────────────────────┐
│  Risk Management API (Hapi) │
│  Port 4000                  │
├─────────────────────────────┤
│  Firebase Auth (verify JWT) │
│           │                 │
│  Supabase (lookup Tradovate │
│           access token)     │
│           │                 │
│  Redis (cache risk settings)│
│           │                 │
│  Tradovate API              │
│  ├─ GET  /account/list      │
│  ├─ GET  /autoLiq/deps      │
│  └─ POST /updateuserautoliq │
└─────────────────────────────┘
```

---

## Owned vs Permissioned Accounts

Tradovate has two types of accounts:

- **Owned accounts** — accounts the user created/owns
- **Permissioned accounts** — prop firm accounts the user has trading permission on

Both support DLL/DPT via `updateuserautoliq`. The GET merges data from both `userAccountAutoLiq/deps` and `permissionedAccountAutoLiq/deps`.

Fields like `flattenTimestamp` and `doNotUnlock` are NOT supported on permissioned accounts through the user-level API.
