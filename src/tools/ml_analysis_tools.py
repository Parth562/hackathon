"""
Advanced ML-based financial analysis tools:
  1. Logistic regression trade signal classifier (Up/Down)
  2. Facebook Prophet-style trend decomposition (via statsmodels)
  3. Momentum + RSI + MACD technical indicator suite
  4. Bollinger Band breakout detector
"""
from typing import List
from langchain_core.tools import tool
import json


# ── helpers ───────────────────────────────────────────────────────────────────

def _history(ticker: str, period: str = "1y"):
    import yfinance as yf
    return yf.Ticker(ticker).history(period=period)


# ── 1. Logistic Regression Trade-Signal Classifier ────────────────────────────

@tool
def classify_trade_signal(ticker: str, period: str = "1y") -> str:
    """
    Run a logistic regression classifier on a stock's recent price history to
    predict whether the NEXT trading day is likely to be UP (1) or DOWN (0).

    Features used:
      - Past 5-day returns (momentum features)
      - RSI-14
      - Volume change %

    Returns the predicted signal, probability score, and feature importances.
    Use when the user asks for a buy/sell signal, directional prediction, or
    ML-based classification of a stock's next move.
    """
    try:
        import numpy as np
        import pandas as pd
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import cross_val_score

        hist = _history(ticker, period)
        if hist.empty or len(hist) < 60:
            return json.dumps({"error": f"Insufficient data for {ticker}. Need at least 60 trading days."})

        df = hist[["Close", "Volume"]].copy()
        df["return_1d"] = df["Close"].pct_change()

        # Momentum features: 1-5 day lagged returns
        for lag in range(1, 6):
            df[f"lag_{lag}"] = df["return_1d"].shift(lag)

        # RSI-14
        delta = df["Close"].diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, 1e-9)
        df["rsi_14"] = 100 - (100 / (1 + rs))

        # Volume change
        df["vol_chg"] = df["Volume"].pct_change()

        # Target: next day up (1) or down (0)
        df["target"] = (df["return_1d"].shift(-1) > 0).astype(int)
        df.dropna(inplace=True)

        feature_cols = [f"lag_{i}" for i in range(1, 6)] + ["rsi_14", "vol_chg"]
        X = df[feature_cols].values
        y = df["target"].values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = LogisticRegression(max_iter=500, C=0.5, random_state=42)
        # Cross-validate
        cv_scores = cross_val_score(model, X_scaled, y, cv=5, scoring="accuracy")
        model.fit(X_scaled, y)

        # Predict NEXT day using LAST row of features
        last_features = scaler.transform(X[-1:])
        pred_class = int(model.predict(last_features)[0])
        pred_prob = float(model.predict_proba(last_features)[0][pred_class])

        # Feature importances (logistic coefficients)
        coef_map = {col: round(float(c), 4) for col, c in zip(feature_cols, model.coef_[0])}

        signal_label = "BUY ↑" if pred_class == 1 else "SELL ↓"
        conviction = "High" if pred_prob > 0.65 else "Medium" if pred_prob > 0.55 else "Low"

        return json.dumps({
            "widget_type": "prediction",
            "ticker": ticker,
            "name": ticker,
            "model": "Logistic Regression Classifier",
            "signal": f"{signal_label} — {conviction} conviction ({pred_prob*100:.1f}%)",
            "predicted_direction": "UP" if pred_class == 1 else "DOWN",
            "probability": round(pred_prob, 4),
            "cv_accuracy": round(float(cv_scores.mean()), 4),
            "cv_std": round(float(cv_scores.std()), 4),
            "feature_coefficients": coef_map,
            "rsi_14_current": round(float(df["rsi_14"].iloc[-1]), 2),
            "sma50": None,
            "sma200": None,
            "std_band": None,
            "historical": [],
            "forecast": [],
        })
    except ImportError:
        return json.dumps({"error": "scikit-learn not installed. Run: pip install scikit-learn"})
    except Exception as e:
        return json.dumps({"error": f"Logistic regression failed for {ticker}: {e}"})


# ── 2. Prophet-style Trend Decomposition ─────────────────────────────────────

@tool
def forecast_price_prophet(ticker: str, days: int = 60) -> str:
    """
    Forecast stock prices using Facebook Prophet's time-series decomposition.
    Decomposes price history into trend + weekly seasonality + yearly seasonality,
    then extrapolates N days into the future with uncertainty intervals.

    Falls back to statsmodels ExponentialSmoothing if Prophet is not installed.
    Use when the user asks for trend forecasting, seasonality analysis, Prophet
    modelling, or longer-horizon price projections.
    Arguments:
    - ticker: Stock ticker symbol (e.g. 'AAPL')
    - days: Forecast horizon in trading days (default 60)
    """
    try:
        import pandas as pd

        hist = _history(ticker, "2y")
        if hist.empty or len(hist) < 90:
            return json.dumps({"error": f"Need at least 90 days of data for {ticker}."})

        hist = hist.reset_index()
        hist["Date"] = pd.to_datetime(hist["Date"]).dt.tz_localize(None)
        df_prophet = hist[["Date", "Close"]].rename(columns={"Date": "ds", "Close": "y"})

        try:
            from prophet import Prophet  # type: ignore
            m = Prophet(
                daily_seasonality=False,
                weekly_seasonality=True,
                yearly_seasonality=True,
                uncertainty_samples=200,
            )
            m.fit(df_prophet)
            future = m.make_future_dataframe(periods=days, freq="B")
            fc = m.predict(future)

            hist_out = [
                {"date": str(r["ds"].date()), "close": round(r["yhat"], 2)}
                for _, r in fc[fc["ds"] <= df_prophet["ds"].max()].iterrows()
            ]
            forecast_out = [
                {
                    "date": str(r["ds"].date()),
                    "predicted": round(r["yhat"], 2),
                    "upper": round(r["yhat_upper"], 2),
                    "lower": round(r["yhat_lower"], 2),
                }
                for _, r in fc[fc["ds"] > df_prophet["ds"].max()].iterrows()
            ]
            trend_note = "Fit using Facebook Prophet (trend + weekly + yearly seasonality)"

        except ImportError:
            # Fallback: Holt-Winters Exponential Smoothing
            from statsmodels.tsa.holtwinters import ExponentialSmoothing  # type: ignore
            import numpy as np
            from datetime import timedelta

            y = df_prophet["y"].values
            model = ExponentialSmoothing(y, trend="add", seasonal="add", seasonal_periods=52)
            fit = model.fit(optimized=True)
            forecast_vals = fit.forecast(days)
            std_dev = float(np.std(y[-30:]))

            last_date = df_prophet["ds"].max()
            future_dates = pd.bdate_range(start=last_date + timedelta(days=1), periods=days)

            hist_out = [
                {"date": str(r["ds"].date()), "close": round(r["y"], 2)}
                for _, r in df_prophet.iterrows()
            ]
            forecast_out = [
                {
                    "date": str(d.date()),
                    "predicted": round(float(v), 2),
                    "upper": round(float(v) + std_dev, 2),
                    "lower": round(float(v) - std_dev, 2),
                }
                for d, v in zip(future_dates, forecast_vals)
            ]
            trend_note = "Fit using Holt-Winters Exponential Smoothing (Prophet not installed)"

        return json.dumps({
            "widget_type": "prediction",
            "ticker": ticker,
            "name": ticker,
            "model": trend_note,
            "signal": "Trend decomposition — see forecast band",
            "sma50": None,
            "sma200": None,
            "std_band": None,
            "historical": hist_out[-120:],   # send last 120 days of actuals
            "forecast": forecast_out,
        })
    except Exception as e:
        return json.dumps({"error": f"Trend forecast failed for {ticker}: {e}"})


# ── 3. Technical Indicator Suite (RSI, MACD, Bollinger, Momentum) ─────────────

@tool
def get_technical_indicators(ticker: str, period: str = "6mo") -> str:
    """
    Compute a full suite of technical analysis indicators for a stock:
      - RSI-14 (Relative Strength Index)
      - MACD (12/26/9 EMA crossover) + Signal line + Histogram
      - Bollinger Bands (20-day SMA ± 2σ)
      - Momentum (10-day price rate-of-change)
      - ATR-14 (Average True Range — volatility)
      - Stochastic Oscillator %K/%D (14-period)

    Returns current values and actionable signals.
    Use whenever the user asks for technical analysis, RSI, MACD, Bollinger bands,
    overbought/oversold conditions, or momentum indicators.
    """
    try:
        import numpy as np

        hist = _history(ticker, period)
        if hist.empty or len(hist) < 30:
            return json.dumps({"error": f"Not enough data for {ticker}."})

        close = hist["Close"]
        high  = hist["High"]
        low   = hist["Low"]
        n = len(close)

        # ── RSI-14 ────────────────────────────────────────────────────────────
        delta = close.diff()
        gain  = delta.clip(lower=0).rolling(14).mean()
        loss  = (-delta.clip(upper=0)).rolling(14).mean()
        rs    = gain / loss.replace(0, 1e-9)
        rsi   = (100 - (100 / (1 + rs))).iloc[-1]

        if rsi >= 70:
            rsi_signal = "Overbought ⚠️"
        elif rsi <= 30:
            rsi_signal = "Oversold 🟢"
        else:
            rsi_signal = "Neutral"

        # ── MACD ─────────────────────────────────────────────────────────────
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line   = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        histogram   = macd_line - signal_line

        macd_val  = round(float(macd_line.iloc[-1]), 4)
        sig_val   = round(float(signal_line.iloc[-1]), 4)
        hist_val  = round(float(histogram.iloc[-1]), 4)

        if macd_val > sig_val and histogram.iloc[-1] > 0:
            macd_signal = "Bullish crossover 🟢"
        elif macd_val < sig_val and histogram.iloc[-1] < 0:
            macd_signal = "Bearish crossover 🔴"
        else:
            macd_signal = "Neutral"

        # ── Bollinger Bands (20, 2σ) ──────────────────────────────────────────
        sma20    = close.rolling(20).mean()
        std20    = close.rolling(20).std()
        bb_upper = sma20 + 2 * std20
        bb_lower = sma20 - 2 * std20
        price_now = float(close.iloc[-1])

        if price_now >= float(bb_upper.iloc[-1]):
            bb_signal = "At upper band — potential reversal ⚠️"
        elif price_now <= float(bb_lower.iloc[-1]):
            bb_signal = "At lower band — potential bounce 🟢"
        else:
            bb_band_pct = round((price_now - float(bb_lower.iloc[-1])) /
                                (float(bb_upper.iloc[-1]) - float(bb_lower.iloc[-1])) * 100, 1)
            bb_signal = f"Mid-band ({bb_band_pct}% of range)"

        # ── Momentum (10-day ROC) ─────────────────────────────────────────────
        momentum = round((price_now / float(close.iloc[-10]) - 1) * 100, 2) if n >= 10 else None

        # ── ATR-14 ───────────────────────────────────────────────────────────
        tr = (high - low).combine(
            (high - close.shift()).abs(), max
        ).combine(
            (low - close.shift()).abs(), max
        )
        atr14 = round(float(tr.rolling(14).mean().iloc[-1]), 4)

        # ── Stochastic Oscillator ─────────────────────────────────────────────
        low14  = low.rolling(14).min()
        high14 = high.rolling(14).max()
        stoch_k = round(float(((close - low14) / (high14 - low14 + 1e-9) * 100).iloc[-1]), 2)
        stoch_d = round(float(((close - low14) / (high14 - low14 + 1e-9) * 100).rolling(3).mean().iloc[-1]), 2)

        if stoch_k >= 80:
            stoch_signal = "Overbought ⚠️"
        elif stoch_k <= 20:
            stoch_signal = "Oversold 🟢"
        else:
            stoch_signal = "Neutral"

        return json.dumps({
            "widget_type": "kpi_dashboard",
            "ticker": ticker,
            "name": f"{ticker} Technical Indicators",
            "sector": "Technical Analysis",
            "current_price": round(price_now, 2),
            "market_cap": None,
            "kpis": {
                "RSI-14":            f"{round(float(rsi), 2)} — {rsi_signal}",
                "MACD":              f"{macd_val} (Signal: {sig_val}, Hist: {hist_val}) — {macd_signal}",
                "Bollinger Band":    f"Upper: {round(float(bb_upper.iloc[-1]),2)} | Lower: {round(float(bb_lower.iloc[-1]),2)} — {bb_signal}",
                "Momentum (10d)":   f"{momentum}%" if momentum is not None else "N/A",
                "ATR-14":           f"{atr14} (daily avg range)",
                "Stoch %K/%D":      f"{stoch_k} / {stoch_d} — {stoch_signal}",
                "SMA-20":           f"{round(float(sma20.iloc[-1]),2)}",
                "50-day SMA":       f"{round(float(close.rolling(50).mean().iloc[-1]),2)}" if n >= 50 else "N/A",
                "200-day SMA":      f"{round(float(close.rolling(200).mean().iloc[-1]),2)}" if n >= 200 else "N/A",
            }
        })
    except Exception as e:
        return json.dumps({"error": f"Technical indicators failed for {ticker}: {e}"})


# ── 4. Bollinger Band Breakout Detector ───────────────────────────────────────

@tool
def detect_bollinger_breakout(ticker: str, lookback_days: int = 90) -> str:
    """
    Scan the last N trading days to detect Bollinger Band breakout events.
    A breakout occurs when price closes outside the ±2σ band.
    Returns a chronological list of breakout dates (upper/lower), the current
    band position, and a squeeze alert if band width is historically narrow.

    Use when the user asks for volatility breakouts, squeeze setups, or
    Bollinger Band trading signals.
    """
    try:
        import numpy as np

        hist = _history(ticker, "1y")
        if hist.empty or len(hist) < 30:
            return json.dumps({"error": f"Not enough data for {ticker}."})

        close = hist["Close"]
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        bb_upper = sma20 + 2 * std20
        bb_lower = sma20 - 2 * std20
        band_width = ((bb_upper - bb_lower) / sma20 * 100).round(2)

        lookback = hist.tail(lookback_days)
        breakouts = []
        for i, (date, row) in enumerate(lookback.iterrows()):
            price = float(row["Close"])
            u = float(bb_upper.loc[date])
            l = float(bb_lower.loc[date])
            if price > u:
                breakouts.append({"date": str(date.date()), "type": "UPPER", "price": round(price, 2), "band": round(u, 2)})
            elif price < l:
                breakouts.append({"date": str(date.date()), "type": "LOWER", "price": round(price, 2), "band": round(l, 2)})

        # Squeeze: band width in bottom 10th percentile
        current_bw = float(band_width.iloc[-1])
        squeeze_threshold = float(np.percentile(band_width.dropna(), 10))
        squeeze_alert = current_bw <= squeeze_threshold

        current_price = float(close.iloc[-1])
        current_upper = float(bb_upper.iloc[-1])
        current_lower = float(bb_lower.iloc[-1])
        current_sma   = float(sma20.iloc[-1])

        return json.dumps({
            "widget_type": "custom",
            "title": f"{ticker} — Bollinger Band Breakouts ({lookback_days}d)",
            "content_type": "metrics",
            "data": {
                "metrics": {
                    "Current Price":     f"${round(current_price, 2)}",
                    "Upper Band (2σ)":   f"${round(current_upper, 2)}",
                    "SMA-20":            f"${round(current_sma, 2)}",
                    "Lower Band (2σ)":   f"${round(current_lower, 2)}",
                    "Band Width %":      f"{current_bw:.2f}%",
                    "Squeeze Alert":     "⚠️ YES — breakout likely imminent" if squeeze_alert else "No squeeze",
                    "Breakouts Found":   str(len(breakouts)),
                    "Recent Breakouts":  " | ".join(
                        f"{b['date']} {b['type']}" for b in breakouts[-5:]
                    ) if breakouts else "None in lookback window",
                }
            }
        })
    except Exception as e:
        return json.dumps({"error": f"Bollinger breakout detection failed for {ticker}: {e}"})
