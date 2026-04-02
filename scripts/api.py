"""
FastAPI wrapper for the IRR calculator.
n8n calls POST /calculate with {"portfolio_id": "..."}
The script fetches holdings from Supabase, computes IRR, writes back, and responds.

Start locally:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Deploy to Railway / Render / Fly.io and set the public URL in n8n.

Install:
    pip install -r requirements.txt fastapi uvicorn
"""

from fastapi import FastAPI, HTTPException, Header, status
from pydantic import BaseModel
import os
from dotenv import load_dotenv

from calculate_irr import calculate_portfolio_metrics, upsert_metrics

load_dotenv()

app = FastAPI(title="Tikona IRR Calculator API", version="1.0.0")

# Simple shared secret so only n8n can call this endpoint.
# Set N8N_SECRET=your-random-string in .env AND in n8n HTTP Request headers.
N8N_SECRET: str = os.getenv("N8N_SECRET", "")


class CalcRequest(BaseModel):
    portfolio_id: str


class CalcResponse(BaseModel):
    status: str
    portfolio_id: str
    metrics: dict | None = None
    message: str = ""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculate", response_model=CalcResponse)
def calculate(
    body: CalcRequest,
    x_n8n_secret: str = Header(default=""),
):
    # Auth check — reject requests without the shared secret
    if N8N_SECRET and x_n8n_secret != N8N_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid secret")

    portfolio_id = body.portfolio_id.strip()
    if not portfolio_id:
        raise HTTPException(status_code=400, detail="portfolio_id is required")

    try:
        metrics = calculate_portfolio_metrics(portfolio_id)
        if metrics:
            upsert_metrics(portfolio_id, metrics)
            return CalcResponse(
                status="success",
                portfolio_id=portfolio_id,
                metrics=metrics,
                message=f"IRR calculated: {metrics.get('portfolio_irr')}%",
            )
        else:
            return CalcResponse(
                status="skipped",
                portfolio_id=portfolio_id,
                message="Not enough data (holdings too new or no prices available)",
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
