# n8n Workflow: Portfolio IRR Auto-Calculator

## What This Does

When a user adds or deletes a stock holding (via the app UI or via CSV import), the workflow automatically:
1. Receives an event from Supabase (via Webhook)
2. Extracts the `portfolio_id` from the payload
3. Calls the Python FastAPI server via HTTP POST
4. Python fetches historical Nifty 50 data (Yahoo Finance), calculates XIRR, writes results to `portfolio_metrics`
5. The mobile app reads the updated `portfolio_metrics` row and displays the IRR vs Nifty benchmark

---

## Architecture

```
User adds stock in App
        │
        ▼
portfolio_holdings (Supabase INSERT)
        │
        ▼
Supabase Webhook (fires HTTP POST to n8n)
        │
        ▼
n8n Workflow (receives webhook payload)
        │ Extract portfolio_id
        ▼
HTTP POST → Python FastAPI /calculate
        │
        ▼
Python: fetch holdings → fetch Nifty prices → compute XIRR
        │
        ▼
Supabase UPSERT → portfolio_metrics table
        │
        ▼
React Native App reads portfolio_metrics → shows IRR / Alpha
```

---

## Step 1 — Deploy the Python API

### Local (testing)
```bash
cd scripts
pip install -r requirements.txt fastapi uvicorn
cp .env.example .env      # fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, N8N_SECRET
uvicorn api:app --host 0.0.0.0 --port 8000
ngrok http 8000           # expose publicly for n8n
```

### Railway (production – free tier)
1. Push `scripts/` to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `N8N_SECRET`
4. Start command: `uvicorn api:app --host 0.0.0.0 --port $PORT`
5. Copy the public URL

Test:
```bash
curl -X POST https://your-app.railway.app/calculate \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: YOUR_SECRET" \
  -d '{"portfolio_id": "your-uuid"}'
```

---

## Step 2 — Run SQL Migration

Run in **Supabase Dashboard → SQL Editor**:
```
supabase/migrations/20260401_portfolio_metrics.sql
```
(already created in your project)

---

## Step 3 — Supabase Webhook Setup

Dashboard → Database → Webhooks → Create webhook:

| Field | Value |
|-------|-------|
| Name | `portfolio_holdings_change` |
| Table | `portfolio_holdings` |
| Events | ✅ INSERT  ✅ DELETE |
| Type | HTTP Request |
| URL | *(n8n webhook URL from Step 4)* |
| Method | POST |
| Header | `Content-Type: application/json` |

Supabase sends this payload:
```json
{
  "type": "INSERT",
  "table": "portfolio_holdings",
  "record": { "id": "...", "portfolio_id": "abc-123", "nse_symbol": "TCS" }
}
```

---

## Step 4 — Build the n8n Workflow

Go to n8n → New Workflow

### Node 1: Webhook (Trigger)
- Type: **Webhook**
- Method: POST
- Path: `portfolio-holding-change`
- Response Mode: Respond Immediately

> 📋 Copy the generated URL → paste into Supabase Webhook URL

---

### Node 2: Code (extract portfolio_id)
- Type: **Code** → JavaScript

```javascript
const payload = $input.first().json.body ?? $input.first().json;
const record = payload.record ?? payload.old_record ?? {};
const portfolioId = record.portfolio_id;
if (!portfolioId) throw new Error('No portfolio_id: ' + JSON.stringify(payload));
return [{ json: { portfolio_id: portfolioId } }];
```

---

### Node 3: HTTP Request (call Python API)
- Type: **HTTP Request**
- Method: POST
- URL: `https://your-python-api.railway.app/calculate`
- Timeout: 60000 ms

Headers:
```
Content-Type: application/json
x-n8n-secret: YOUR_N8N_SECRET
```

Body (JSON):
```json
{ "portfolio_id": "={{ $json.portfolio_id }}" }
```

---

### Node 4 (Optional): IF — error handler
- Condition: `{{ $json.status }}` equals `success`
- True → End
- False → Slack/email error alert

---

### Node 5 (Optional): Slack notification
```
✅ IRR recalculated: Portfolio IRR {{ $json.metrics.portfolio_irr }}%  |  Alpha {{ $json.metrics.alpha }}%
```

---

## Step 5 — Test End-to-End

1. Add a holding in the app with buy date **≥1 day ago** (use "1M ago")
2. n8n Executions → should trigger within seconds
3. Supabase `portfolio_metrics` → row appears with calculated IRR
4. Pull-to-refresh in app → **IRR vs Nifty 50** card shows live data ✅

---

## CSV Bulk Import

Each CSV row fires its own INSERT webhook. Python is idempotent — it always
recalculates from all current holdings. So 50 webhook calls = 50 runs, last one wins.
No data corruption. Optionally add a 5-second **Wait** node after Node 2 to let all
rows insert before Python runs.

---

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/calculate_irr.py` | IRR calculation engine (pyxirr + yfinance) |
| `scripts/api.py` | FastAPI server — n8n calls POST /calculate |
| `scripts/requirements.txt` | pip dependencies |
| `scripts/.env.example` | Env vars template |
| `supabase/migrations/20260401_portfolio_metrics.sql` | DB table |
| `lib/types.ts` | PortfolioMetrics TS type |
| `app/(tabs)/portfolio.tsx` | Reads metrics from Supabase |

---

## Environment Variables

### `scripts/.env`
```env
SUPABASE_URL=https://bmpvcjbfeyvkkbvclwkb.supabase.co
SUPABASE_SERVICE_KEY=eyJ...    # service_role — NEVER commit this
N8N_SECRET=random-secret-here
```

### n8n HTTP Request header
```
x-n8n-secret: random-secret-here
```

> ⚠️ Use `service_role` key in Python only. Never commit it to git.
