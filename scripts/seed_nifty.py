"""
Fetch Nifty 50 historical closing prices and upsert into Supabase nifty_history table.

Run once to backfill, then run daily (or add to cron on VPS).

Usage:
    python seed_nifty.py              # backfill last 5 years
    python seed_nifty.py --days 30    # last 30 days only
"""

import sys
import os
import argparse
from datetime import date, timedelta
from dotenv import load_dotenv
import yfinance as yf
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def seed(days: int = 1825):  # default 5 years
    end = date.today()
    start = end - timedelta(days=days)

    print(f"Fetching Nifty 50 from {start} to {end}...")
    df = yf.download("^NSEI", start=str(start), end=str(end), interval="1d",
                     progress=True, auto_adjust=True)

    if df.empty:
        print("No data returned from Yahoo Finance.")
        return

    rows = []
    for ts, row in df.iterrows():
        close_val = row["Close"]
        # Handle both scalar and Series (multi-level column) responses
        if hasattr(close_val, 'iloc'):
            close_val = float(close_val.iloc[0])
        else:
            close_val = float(close_val)
        if close_val and close_val > 0:
            rows.append({"date": ts.strftime("%Y-%m-%d"), "close": round(close_val, 2)})

    print(f"Upserting {len(rows)} rows into nifty_history...")
    # Upsert in batches of 500
    for i in range(0, len(rows), 500):
        batch = rows[i:i+500]
        client.table("nifty_history").upsert(batch, on_conflict="date").execute()
        print(f"  Batch {i//500 + 1}: {len(batch)} rows done")

    print(f"Done. Latest date: {rows[-1]['date']} → close {rows[-1]['close']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=1825, help="How many days back to fetch")
    args = parser.parse_args()
    seed(args.days)
