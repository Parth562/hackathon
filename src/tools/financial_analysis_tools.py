"""
New financial analysis tools: KPI dashboard, peer benchmarking, risk score,
bull/bear thesis, scenario analysis, and stock price prediction.
"""
from typing import Dict, Any, List
from langchain_core.tools import tool
import json


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_info(ticker: str):
    import yfinance as yf
    return yf.Ticker(ticker).info

def _fmt(v, prefix="", suffix="", decimals=2):
    if v is None:
        return "N/A"
    if isinstance(v, float):
        return f"{prefix}{v:,.{decimals}f}{suffix}"
    return f"{prefix}{v}{suffix}"


# ── 1. KPI Dashboard ──────────────────────────────────────────────────────────

@tool
def get_kpi_dashboard(ticker: str) -> str:
    """
    Fetch a comprehensive KPI dashboard for a given stock ticker.
    Returns EBITDA, ROE, FCF, Net Margin, Gross Margin, Operating Margin,
    EV/EBITDA, P/E, P/FCF, Debt/Equity, Current Ratio, and Revenue growth.
    Use this any time the user asks for fundamentals, KPIs, financial overview,
    or ratio analysis of a single company.
    """
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        info = t.info
        cf = t.cashflow
        inc = t.income_stmt
        bs = t.balance_sheet

        # FCF
        fcf = None
        if not cf.empty and "Free Cash Flow" in cf.index:
            fcf = float(cf.loc["Free Cash Flow"].iloc[0])

        # EBITDA
        ebitda = info.get("ebitda")

        # Revenue
        rev = info.get("totalRevenue")

        # EV/EBITDA
        ev = info.get("enterpriseValue")
        ev_ebitda = round(ev / ebitda, 2) if ev and ebitda and ebitda != 0 else None

        # P/FCF
        mktcap = info.get("marketCap")
        p_fcf = round(mktcap / fcf, 2) if mktcap and fcf and fcf > 0 else None

        kpis = {
            "Revenue":          _fmt(rev, "$", "", 0),
            "EBITDA":           _fmt(ebitda, "$", "", 0),
            "Free Cash Flow":   _fmt(fcf, "$", "", 0),
            "Net Margin":       _fmt(info.get("profitMargins"), "", "%", 2),
            "Gross Margin":     _fmt(info.get("grossMargins"), "", "%", 2),
            "Operating Margin": _fmt(info.get("operatingMargins"), "", "%", 2),
            "ROE":              _fmt(info.get("returnOnEquity"), "", "%", 2),
            "ROA":              _fmt(info.get("returnOnAssets"), "", "%", 2),
            "P/E (TTM)":        _fmt(info.get("trailingPE"), "", "x"),
            "Forward P/E":      _fmt(info.get("forwardPE"), "", "x"),
            "EV/EBITDA":        _fmt(ev_ebitda, "", "x"),
            "P/FCF":            _fmt(p_fcf, "", "x"),
            "Debt/Equity":      _fmt(info.get("debtToEquity"), "", "x"),
            "Current Ratio":    _fmt(info.get("currentRatio"), "", "x"),
        }

        return json.dumps({
            "widget_type": "kpi_dashboard",
            "ticker": ticker,
            "name": info.get("longName", ticker),
            "sector": info.get("sector", ""),
            "current_price": info.get("currentPrice"),
            "market_cap": info.get("marketCap"),
            "kpis": kpis,
        })
    except Exception as e:
        return json.dumps({"error": f"KPI dashboard failed for {ticker}: {e}"})


# ── 2. Peer Benchmarking ───────────────────────────────────────────────────────

@tool
def get_peer_benchmarking(ticker: str, peers: List[str]) -> str:
    """
    Compare a primary ticker to a list of peer companies across key financial metrics.
    Produces a side-by-side table useful for competitive analysis, sector comparisons,
    or identifying relative value. Use whenever the user wants to benchmark or compare companies.
    Arguments:
    - ticker: The primary/focus company (e.g. 'AAPL')
    - peers: List of 2–5 peer tickers (e.g. ['MSFT', 'GOOGL', 'META'])
    """
    try:
        import yfinance as yf
        all_tickers = [ticker] + peers
        METRICS = [
            ("Revenue",        "totalRevenue",       "$",  "B", 1e9),
            ("Net Margin",     "profitMargins",       "",   "%", 100),
            ("Gross Margin",   "grossMargins",        "",   "%", 100),
            ("ROE",            "returnOnEquity",      "",   "%", 100),
            ("P/E (TTM)",      "trailingPE",          "",   "x", 1),
            ("EV/EBITDA",      "enterpriseToEbitda",  "",   "x", 1),
            ("Debt/Equity",    "debtToEquity",        "",   "x", 1),
            ("Market Cap",     "marketCap",           "$",  "B", 1e9),
        ]

        rows = {}
        for m_label, _, _, _, _ in METRICS:
            rows[m_label] = {}

        for t in all_tickers:
            info = yf.Ticker(t).info
            for m_label, key, prefix, suffix, scale in METRICS:
                val = info.get(key)
                if val is not None:
                    scaled = val / scale
                    rows[m_label][t] = f"{prefix}{scaled:.2f}{suffix}"
                else:
                    rows[m_label][t] = "N/A"

        return json.dumps({
            "widget_type": "peer_benchmark",
            "primary": ticker,
            "peers": peers,
            "columns": all_tickers,
            "rows": rows,
        })
    except Exception as e:
        return json.dumps({"error": f"Peer benchmarking failed: {e}"})


# ── 3. Risk Score ─────────────────────────────────────────────────────────────

@tool
def get_risk_score(ticker: str, period: str = "1y") -> str:
    """
    Calculate a comprehensive risk profile for a stock.
    Returns: overall risk score (0–100, higher = riskier), Beta, annualised volatility,
    95% Value-at-Risk (VaR), and Altman Z-Score (bankruptcy risk).
    Use when user asks about risk, volatility, VaR, or financial health / distress of a company.
    """
    try:
        import yfinance as yf
        import numpy as np

        t = yf.Ticker(ticker)
        info = t.info
        hist = t.history(period=period)

        if hist.empty:
            return json.dumps({"error": f"No price history for {ticker}"})

        returns = hist["Close"].pct_change().dropna()
        ann_vol = float(returns.std() * np.sqrt(252))
        var_95  = float(np.percentile(returns, 5))      # daily VaR at 95% confidence
        beta    = info.get("beta", None)

        # ── Altman Z-Score (for non-financials) ──────────────────────────────
        bs  = t.balance_sheet
        inc = t.income_stmt
        cf  = t.cashflow
        z_score = None

        try:
            total_assets      = float(bs.loc["Total Assets"].iloc[0])
            current_assets    = float(bs.loc["Current Assets"].iloc[0])
            current_liab      = float(bs.loc["Current Liabilities"].iloc[0])
            total_liab        = float(bs.loc["Total Liabilities Net Minority Interest"].iloc[0])
            retained_earnings = float(bs.loc["Retained Earnings"].iloc[0])
            ebit              = float(inc.loc["EBIT"].iloc[0])
            revenue           = float(inc.loc["Total Revenue"].iloc[0])
            market_cap        = info.get("marketCap", 0)

            wc   = current_assets - current_liab
            x1   = wc / total_assets
            x2   = retained_earnings / total_assets
            x3   = ebit / total_assets
            x4   = market_cap / total_liab if total_liab else 0
            x5   = revenue / total_assets

            z_score = round(1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5, 2)
        except Exception:
            z_score = None

        # ── Composite risk score 0–100 ────────────────────────────────────────
        score = 0
        if beta is not None:
            score += min(40, max(0, beta * 20))         # max 40 pts from beta
        score += min(30, ann_vol * 100)                  # max 30 pts from vol
        if z_score is not None:
            if z_score < 1.81:
                score += 30                             # distress zone
            elif z_score < 2.99:
                score += 15                             # grey zone
        score = round(min(100, score))

        z_label = "N/A"
        if z_score is not None:
            if z_score < 1.81:   z_label = f"{z_score} (Distress)"
            elif z_score < 2.99: z_label = f"{z_score} (Grey zone)"
            else:                z_label = f"{z_score} (Safe)"

        return json.dumps({
            "widget_type": "risk_score",
            "ticker": ticker,
            "name":   info.get("longName", ticker),
            "risk_score": score,
            "metrics": {
                "Beta":              round(beta, 2) if beta else "N/A",
                "Annualised Vol":    f"{ann_vol*100:.1f}%",
                "Daily VaR (95%)":  f"{var_95*100:.2f}%",
                "Altman Z-Score":    z_label,
            }
        })
    except Exception as e:
        return json.dumps({"error": f"Risk score failed for {ticker}: {e}"})


# ── 4. Bull / Bear Thesis ────────────────────────────────────────────────────

@tool
def generate_bull_bear_thesis(ticker: str) -> str:
    """
    Generate a structured bull and bear investment thesis for a given stock.
    Uses fundamental data (growth rates, margins, valuation) to produce
    3–4 key catalysts for each side, plus an overall verdict.
    Use whenever the user asks for a thesis, investment case, or bull/bear analysis.
    """
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info

        name    = info.get("longName", ticker)
        pe      = info.get("trailingPE")
        fpe     = info.get("forwardPE")
        roe     = info.get("returnOnEquity")
        margin  = info.get("profitMargins")
        growth  = info.get("revenueGrowth")
        dte     = info.get("debtToEquity")
        beta    = info.get("beta")
        target  = info.get("targetMeanPrice")
        price   = info.get("currentPrice")

        # Build catalysts from data
        bull_catalysts = []
        bear_catalysts = []

        if growth and growth > 0.15:
            bull_catalysts.append(f"Strong top-line growth ({growth*100:.1f}% YoY) suggests durable demand")
        elif growth and growth < 0:
            bear_catalysts.append(f"Revenue declining ({growth*100:.1f}% YoY) — execution risk")

        if roe and roe > 0.2:
            bull_catalysts.append(f"High ROE ({roe*100:.1f}%) indicates capital-efficient business model")
        elif roe and roe < 0.05:
            bear_catalysts.append(f"Weak ROE ({roe*100:.1f}%) raises concerns about capital allocation")

        if pe and fpe and fpe < pe * 0.85:
            bull_catalysts.append(f"Forward P/E ({fpe:.1f}x) well below TTM ({pe:.1f}x) — earnings re-rating potential")
        elif pe and pe > 40:
            bear_catalysts.append(f"High TTM P/E ({pe:.1f}x) leaves little margin of safety")

        if dte and dte < 50:
            bull_catalysts.append(f"Low leverage (D/E {dte/100:.2f}x) provides financial flexibility")
        elif dte and dte > 200:
            bear_catalysts.append(f"High leverage (D/E {dte/100:.2f}x) amplifies downside risk")

        if margin and margin > 0.2:
            bull_catalysts.append(f"Healthy net margin ({margin*100:.1f}%) reflects pricing power")
        elif margin and margin < 0.05:
            bear_catalysts.append(f"Thin net margin ({margin*100:.1f}%) — vulnerable to cost shocks")

        if beta and beta < 0.8:
            bull_catalysts.append(f"Low beta ({beta:.2f}) — defensive characteristics in volatile markets")
        elif beta and beta > 1.5:
            bear_catalysts.append(f"High beta ({beta:.2f}) — amplified downside in risk-off environments")

        if target and price:
            upsde = (target - price) / price * 100
            if upsde > 15:
                bull_catalysts.append(f"Analyst consensus target ${target:.2f} implies {upsde:.1f}% upside")
            elif upsde < -10:
                bear_catalysts.append(f"Analyst consensus target ${target:.2f} implies {abs(upsde):.1f}% downside")

        # Pad if sparse
        while len(bull_catalysts) < 3:
            bull_catalysts.append("Potential for operational improvements and margin expansion")
        while len(bear_catalysts) < 3:
            bear_catalysts.append("Macro headwinds — interest rates and FX could pressure results")

        bull_score = min(90, max(40, 50 + len(bull_catalysts) * 8))
        bear_score = min(90, max(40, 50 + len(bear_catalysts) * 8))

        if bull_score > bear_score + 10:
            verdict, verdict_color = "Cautiously Bullish", "green"
        elif bear_score > bull_score + 10:
            verdict, verdict_color = "Cautiously Bearish", "red"
        else:
            verdict, verdict_color = "Neutral / Hold", "amber"

        return json.dumps({
            "widget_type": "thesis",
            "ticker": ticker,
            "name":   name,
            "bull": {
                "catalysts":   bull_catalysts[:4],
                "confidence":  bull_score,
            },
            "bear": {
                "catalysts":   bear_catalysts[:4],
                "confidence":  bear_score,
            },
            "verdict":       verdict,
            "verdict_color": verdict_color,
            "current_price": price,
            "analyst_target": target,
        })
    except Exception as e:
        return json.dumps({"error": f"Thesis generation failed for {ticker}: {e}"})


# ── 5. Scenario / Sensitivity Analysis ───────────────────────────────────────

@tool
def run_scenario_analysis(ticker: str) -> str:
    """
    Run a three-scenario DCF sensitivity analysis (Bear / Base / Bull) for a stock.
    Each scenario uses different FCF growth rates and discount rates to show
    a range of implied intrinsic values and upside/downside vs current price.
    Use when the user asks for scenario analysis, sensitivity, or range of outcomes.
    """
    try:
        import yfinance as yf
        t     = yf.Ticker(ticker)
        info  = t.info
        cf    = t.cashflow
        bs    = t.balance_sheet

        if cf.empty or "Free Cash Flow" not in cf.index:
            return json.dumps({"error": f"FCF data unavailable for {ticker}"})

        base_fcf   = float(cf.loc["Free Cash Flow"].iloc[0])
        shares     = info.get("sharesOutstanding", 1)
        price      = info.get("currentPrice", 0)
        total_debt = float(bs.loc["Total Debt"].iloc[0]) if "Total Debt" in bs.index else 0
        cash       = float(bs.loc["Cash And Cash Equivalents"].iloc[0]) if "Cash And Cash Equivalents" in bs.index else 0
        net_debt   = total_debt - cash

        SCENARIOS = {
            "Bear":  {"growth": 0.02, "discount": 0.12, "terminal": 0.01},
            "Base":  {"growth": 0.07, "discount": 0.09, "terminal": 0.02},
            "Bull":  {"growth": 0.14, "discount": 0.08, "terminal": 0.03},
        }
        YEARS = 5

        results = {}
        for label, params in SCENARIOS.items():
            g, r, tg = params["growth"], params["discount"], params["terminal"]
            projected = [base_fcf * ((1 + g) ** y) for y in range(1, YEARS + 1)]
            pv_fcf    = sum(p / ((1 + r) ** y) for y, p in enumerate(projected, 1))
            tv        = projected[-1] * (1 + tg) / (r - tg)
            pv_tv     = tv / ((1 + r) ** YEARS)
            ev        = pv_fcf + pv_tv
            eq        = ev - net_debt
            implied   = round(eq / shares, 2)
            upside    = round((implied - price) / price * 100, 1) if price else 0

            results[label] = {
                "growth_rate":     f"{g*100:.0f}%",
                "discount_rate":   f"{r*100:.0f}%",
                "terminal_growth": f"{tg*100:.0f}%",
                "implied_price":   implied,
                "upside_pct":      upside,
            }

        return json.dumps({
            "widget_type":    "scenario",
            "ticker":         ticker,
            "name":           info.get("longName", ticker),
            "current_price":  price,
            "scenarios":      results,
        })
    except Exception as e:
        return json.dumps({"error": f"Scenario analysis failed for {ticker}: {e}"})


# ── 6. Stock Price Prediction ─────────────────────────────────────────────────

@tool
def predict_stock_price(ticker: str, days: int = 30) -> str:
    """
    Predict the stock price over the next N days (default 30) using a linear regression
    trend model fitted on the past 180 days. Also computes 50/200-day SMA crossover signal.
    Returns historical data + forecasted points for charting.
    Use when the user asks for stock price prediction, forecast, or future price estimate.
    IMPORTANT: This is a simplified model. Always caveat predictions as estimates.
    """
    try:
        import yfinance as yf
        import numpy as np

        t    = yf.Ticker(ticker)
        hist = t.history(period="6mo")

        if hist.empty or len(hist) < 30:
            return json.dumps({"error": f"Insufficient price history for {ticker}"})

        closes  = hist["Close"].values
        dates   = [str(d.date()) for d in hist.index]
        n       = len(closes)

        # Linear regression on trailing 180 days
        x      = np.arange(n)
        coeffs = np.polyfit(x, closes, 1)
        slope, intercept = coeffs

        # Forecast
        future_x     = np.arange(n, n + days)
        future_preds = [round(slope * xi + intercept, 2) for xi in future_x]

        # Standard deviation for confidence band
        residuals  = closes - (slope * x + intercept)
        std_resid  = float(residuals.std())

        # SMAs
        sma50  = round(float(np.mean(closes[-50:])), 2) if n >= 50 else None
        sma200 = round(float(np.mean(closes[-200:])), 2) if n >= 200 else None

        if sma50 and sma200:
            signal = "BULLISH (Golden Cross)" if sma50 > sma200 else "BEARISH (Death Cross)"
        else:
            signal = "Insufficient data for crossover signal"

        # Build forecast dates (business days approximate)
        from datetime import timedelta, date
        last_date = hist.index[-1].date()
        future_dates = []
        d = last_date
        for _ in range(days):
            d += timedelta(days=1)
            while d.weekday() >= 5:
                d += timedelta(days=1)
            future_dates.append(str(d))

        return json.dumps({
            "widget_type": "prediction",
            "ticker":      ticker,
            "name":        t.info.get("longName", ticker),
            "signal":      signal,
            "sma50":       sma50,
            "sma200":      sma200,
            "std_band":    round(std_resid, 2),
            "historical":  [{"date": d, "close": round(float(c), 2)} for d, c in zip(dates, closes)],
            "forecast":    [{"date": d, "predicted": p, "upper": round(p + std_resid, 2), "lower": round(p - std_resid, 2)}
                            for d, p in zip(future_dates, future_preds)],
        })
    except Exception as e:
        return json.dumps({"error": f"Prediction failed for {ticker}: {e}"})
