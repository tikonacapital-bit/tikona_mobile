"""
Portfolio IRR Calculator — Tikona Mobile Backend Script
========================================================
Triggered by: n8n webhook on portfolio_holdings table INSERT/DELETE
Does:
  1. Reads all holdings for a portfolio_id from Supabase
  2. Fetches historical Nifty 50 closing prices from Yahoo Finance (yfinance)
  3. Computes XIRR for the user's portfolio and for a "Nifty equivalent" portfolio
  4. Writes results back to portfolio_metrics table in Supabase

Usage:
  python calculate_irr.py <portfolio_id>
  OR called by n8n "Execute Command" node with portfolio_id as argv[1]

Dependencies (install once):
  pip install supabase pyxirr yfinance python-dotenv
"""

import sys
import os
import logging
from datetime import date, datetime, timedelta
from typing import Optional

# Third-party
import yfinance as yf
from pyxirr import xirr as compute_xirr
from supabase import create_client, Client
from dotenv import load_dotenv

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

load_dotenv()  # Reads .env in the script's directory

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")  # use service_role key — NOT anon key

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the .env file")
    sys.exit(1)

TODAY: date = date.today()

# ──────────────────────────────────────────────
# Supabase client (service role — bypasses RLS)
# ──────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ──────────────────────────────────────────────
# Helper: fetch Nifty 50 closing price on or before a given date
# ──────────────────────────────────────────────
_nifty_cache: dict[str, Optional[float]] = {}

def get_nifty_close(target_date: date) -> Optional[float]:
    """
    Returns the Nifty 50 closing price on the nearest past trading day
    to target_date. Results are cached in memory for this run.
    """
    key = target_date.isoformat()
    if key in _nifty_cache:
        return _nifty_cache[key]

    # Download 10 days of data to handle weekends + holidays
    start = (target_date - timedelta(days=10)).isoformat()
    end = (target_date + timedelta(days=1)).isoformat()

    try:
        df = yf.download("^NSEI", start=start, end=end, interval="1d", progress=False, auto_adjust=True)
        if df.empty:
            _nifty_cache[key] = None
            return None

        # Get the last row on or before target_date
        df = df[df.index.date <= target_date]  # type: ignore[attr-defined]
        if df.empty:
            _nifty_cache[key] = None
            return None

        price = float(df["Close"].iloc[-1])
        _nifty_cache[key] = price
        log.info(f"  Nifty close on {target_date}: {price:.2f}")
        return price
    except Exception as e:
        log.warning(f"  yfinance failed for Nifty on {target_date}: {e}")
        _nifty_cache[key] = None
        return None


def get_nifty_current() -> Optional[float]:
    """Returns today's (or last trading day's) Nifty 50 price."""
    return get_nifty_close(TODAY)


# ──────────────────────────────────────────────
# Helper: get current stock price from Supabase equity_universe
# ──────────────────────────────────────────────
def get_current_prices(symbols: list[str]) -> dict[str, Optional[float]]:
    """Fetch current_price for all symbols from equity_universe."""
    if not symbols:
        return {}

    result = (
        supabase.table("equity_universe")
        .select("nse_code, current_price")
        .in_("nse_code", symbols)
        .execute()
    )
    price_map: dict[str, Optional[float]] = {}
    for row in (result.data or []):
        price_map[row["nse_code"]] = row.get("current_price")

    # For any symbol not in equity_universe, try Yahoo Finance as fallback
    missing = [s for s in symbols if price_map.get(s) is None]
    for sym in missing:
        try:
            ticker = yf.Ticker(f"{sym}.NS")
            info = ticker.fast_info
            price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
            if price and price > 0:
                price_map[sym] = float(price)
                log.info(f"  Yahoo fallback price for {sym}: {price:.2f}")
        except Exception as e:
            log.warning(f"  Yahoo fallback failed for {sym}: {e}")
            price_map[sym] = None

    return price_map


# ──────────────────────────────────────────────
# Main calculator
# ──────────────────────────────────────────────
def calculate_portfolio_metrics(portfolio_id: str) -> dict:
    """
    Full IRR calculation pipeline for a given portfolio.
    Returns a dict with portfolio_irr, nifty_irr, alpha, avg_holding_days, valid_count.
    """
    log.info(f"Calculating metrics for portfolio: {portfolio_id}")

    # ── 1. Fetch all holdings ──
    result = (
        supabase.table("portfolio_holdings")
        .select("id, nse_symbol, quantity, buy_price, buy_date, investment_thesis, created_at")
        .eq("portfolio_id", portfolio_id)
        .execute()
    )
    holdings = result.data or []

    if not holdings:
        log.info("No holdings found. Skipping.")
        return {}

    # ── 2. Separate BUYs from SELLs ──
    # SELL rows are identified by [SELL] prefix in investment_thesis (same convention as the app)
    buy_holdings = [h for h in holdings if not (h.get("investment_thesis") or "").startswith("[SELL]")]
    sell_holdings = [h for h in holdings if (h.get("investment_thesis") or "").startswith("[SELL]")]

    log.info(f"  BUY rows: {len(buy_holdings)}, SELL rows: {len(sell_holdings)}")

    # ── 3. Fetch current prices ──
    symbols = list({h["nse_symbol"] for h in buy_holdings})
    current_prices = get_current_prices(symbols)

    # ── 4. Build cash flow lists ──
    portfolio_cfs: list[tuple[date, float]] = []  # (date, amount)
    nifty_cfs: list[tuple[date, float]] = []

    # Track aggregated buy quantities and accumulated Nifty units per symbol
    buy_qty_map: dict[str, float] = {}
    nifty_units_map: dict[str, float] = {}

    total_holding_days = 0.0
    valid_count = 0

    for h in buy_holdings:
        buy_date_str = (h.get("buy_date") or h.get("created_at") or "")[:10]
        if not buy_date_str:
            continue

        buy_date = date.fromisoformat(buy_date_str)
        holding_days = (TODAY - buy_date).days

        if holding_days < 1:
            log.debug(f"  Skipping {h['nse_symbol']} — buy date is today")
            continue   # XIRR undefined for 0-day holdings

        invested = float(h["quantity"]) * float(h["buy_price"])

        # Portfolio: outflow (negative)
        portfolio_cfs.append((buy_date, -invested))
        total_holding_days += holding_days
        valid_count += 1

        # Nifty equivalent: how many Nifty units could we have bought on that day?
        nifty_buy_price = get_nifty_close(buy_date)
        if nifty_buy_price and nifty_buy_price > 0:
            units = invested / nifty_buy_price
            nifty_cfs.append((buy_date, -invested))
            sym = h["nse_symbol"]
            buy_qty_map[sym] = buy_qty_map.get(sym, 0.0) + float(h["quantity"])
            nifty_units_map[sym] = nifty_units_map.get(sym, 0.0) + units

    if valid_count == 0:
        log.info("No valid holdings (all bought today). Returning empty metrics.")
        return {}

    # ── 5. SELL inflows ──
    sold_qty_map: dict[str, float] = {}

    for h in sell_holdings:
        sell_date_str = (h.get("buy_date") or h.get("created_at") or "")[:10]
        if not sell_date_str:
            continue
        sell_date = date.fromisoformat(sell_date_str)
        proceeds = float(h["quantity"]) * float(h["buy_price"])  # qty × sell_price

        portfolio_cfs.append((sell_date, proceeds))
        sold_qty_map[h["nse_symbol"]] = sold_qty_map.get(h["nse_symbol"], 0.0) + float(h["quantity"])

        # Nifty: liquidate proportional units
        sym = h["nse_symbol"]
        nifty_sell_price = get_nifty_close(sell_date)
        total_buy_qty = buy_qty_map.get(sym, 0.0)
        total_nifty_units = nifty_units_map.get(sym, 0.0)
        if nifty_sell_price and nifty_sell_price > 0 and total_buy_qty > 0 and total_nifty_units > 0:
            sell_ratio = min(float(h["quantity"]) / total_buy_qty, 1.0)
            units_sold = sell_ratio * total_nifty_units
            nifty_cfs.append((sell_date, units_sold * nifty_sell_price))
            nifty_units_map[sym] = max(0.0, total_nifty_units - units_sold)

    # ── 6. Terminal inflow — current market value of net open positions ──
    portfolio_current_value = 0.0
    nifty_current_value = 0.0
    nifty_current = get_nifty_current()

    for sym, total_buy_qty in buy_qty_map.items():
        sold_qty = sold_qty_map.get(sym, 0.0)
        net_qty = max(0.0, total_buy_qty - sold_qty)

        if net_qty > 0:
            cp = current_prices.get(sym)
            if cp is not None:
                portfolio_current_value += net_qty * cp

        remaining_nifty_units = nifty_units_map.get(sym, 0.0)
        if remaining_nifty_units > 0 and nifty_current:
            nifty_current_value += remaining_nifty_units * nifty_current

    has_sell_inflow = any(amt > 0 for _, amt in portfolio_cfs)
    if portfolio_current_value == 0 and not has_sell_inflow:
        log.warning("No positive cashflows — cannot compute IRR.")
        return {}

    if portfolio_current_value > 0:
        portfolio_cfs.append((TODAY, portfolio_current_value))

    # ── 7. Compute XIRR ──
    try:
        portfolio_irr = compute_xirr(
            [dt for dt, _ in portfolio_cfs],
            [amt for _, amt in portfolio_cfs],
        )
        if portfolio_irr is None or not isinstance(portfolio_irr, (int, float)):
            raise ValueError("XIRR returned None")
        portfolio_irr = round(float(portfolio_irr) * 100, 2)  # convert to percentage
        log.info(f"  Portfolio IRR: {portfolio_irr:.2f}%")
    except Exception as e:
        log.error(f"  Portfolio XIRR failed: {e}")
        return {}

    nifty_irr: Optional[float] = None
    alpha: Optional[float] = None

    # Only compute Nifty IRR if we have enough data (≥50% of legs)
    if nifty_cfs and len([x for x in nifty_cfs if x[1] < 0]) >= (valid_count + 1) // 2:
        if nifty_current_value > 0:
            nifty_cfs.append((TODAY, nifty_current_value))

        if any(amt > 0 for _, amt in nifty_cfs):
            try:
                raw_nifty = compute_xirr(
                    [dt for dt, _ in nifty_cfs],
                    [amt for _, amt in nifty_cfs],
                )
                if raw_nifty is not None:
                    nifty_irr = round(float(raw_nifty) * 100, 2)
                    alpha = round(portfolio_irr - nifty_irr, 2)
                    log.info(f"  Nifty IRR: {nifty_irr:.2f}% | Alpha: {alpha:.2f}%")
            except Exception as e:
                log.warning(f"  Nifty XIRR failed: {e}")

    avg_holding_days = round(total_holding_days / valid_count) if valid_count > 0 else 0
    avg_holding_years = round(avg_holding_days / 365.25, 2)

    return {
        "portfolio_irr": portfolio_irr,
        "nifty_irr": nifty_irr,
        "alpha": alpha,
        "avg_holding_days": avg_holding_days,
        "avg_holding_years": avg_holding_years,
        "valid_count": valid_count,
        "calculated_at": datetime.utcnow().isoformat(),
    }


# ──────────────────────────────────────────────
# Write results back to Supabase
# ──────────────────────────────────────────────
def upsert_metrics(portfolio_id: str, metrics: dict) -> None:
    """Upsert the calculated metrics into portfolio_metrics table."""
    if not metrics:
        return

    payload = {
        "portfolio_id": portfolio_id,
        **metrics,
    }

    log.info(f"Upserting metrics: {payload}")
    supabase.table("portfolio_metrics").upsert(
        payload,
        on_conflict="portfolio_id",
    ).execute()
    log.info("Metrics saved successfully.")


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python calculate_irr.py <portfolio_id>")
        sys.exit(1)

    portfolio_id = sys.argv[1].strip()
    metrics = calculate_portfolio_metrics(portfolio_id)

    if metrics:
        upsert_metrics(portfolio_id, metrics)
        print(f"SUCCESS: {metrics}")
    else:
        print("SKIPPED: No metrics calculated (not enough data or holding period too short).")
