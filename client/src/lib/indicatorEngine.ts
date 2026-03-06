/**
 * indicatorEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure-TypeScript, zero-dependency implementations of all major technical
 * indicators. Runs entirely in the browser from raw OHLCV data.
 *
 * All functions return arrays of { time, value } (+ extras where needed)
 * aligned to the LAST available index.
 */

export interface OHLCV {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IndicatorPoint {
    time: string;
    value: number;
    [key: string]: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function closes(data: OHLCV[], series: 'close' | 'open' | 'high' | 'low' = 'close'): number[] {
    return data.map(d => d[series]);
}

function times(data: OHLCV[]): string[] {
    return data.map(d => d.time);
}

// ── SMA ───────────────────────────────────────────────────────────────────────

export function computeSMA(data: OHLCV[], period = 20, series: 'close' | 'open' | 'high' | 'low' = 'close'): IndicatorPoint[] {
    const prices = closes(data, series);
    const t = times(data);
    const result: IndicatorPoint[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const window = prices.slice(i - period + 1, i + 1);
        const value = window.reduce((a, b) => a + b, 0) / period;
        result.push({ time: t[i], value });
    }
    return result;
}

// ── EMA ───────────────────────────────────────────────────────────────────────

export function computeEMA(data: OHLCV[], period = 20, series: 'close' | 'open' | 'high' | 'low' = 'close'): IndicatorPoint[] {
    const prices = closes(data, series);
    const t = times(data);
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    // Seed with SMA of first `period` values
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const result: IndicatorPoint[] = [{ time: t[period - 1], value: ema }];
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
        result.push({ time: t[i], value: ema });
    }
    return result;
}

// ── WMA ───────────────────────────────────────────────────────────────────────

export function computeWMA(data: OHLCV[], period = 10, series: 'close' | 'open' | 'high' | 'low' = 'close'): IndicatorPoint[] {
    const prices = closes(data, series);
    const t = times(data);
    const denominator = (period * (period + 1)) / 2;
    const result: IndicatorPoint[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        let num = 0;
        for (let j = 0; j < period; j++) {
            num += prices[i - (period - 1 - j)] * (j + 1);
        }
        result.push({ time: t[i], value: num / denominator });
    }
    return result;
}

// ── DEMA ──────────────────────────────────────────────────────────────────────

export function computeDEMA(data: OHLCV[], period = 20, series: 'close' | 'open' | 'high' | 'low' = 'close'): IndicatorPoint[] {
    // DEMA = 2*EMA1 - EMA(EMA1)
    // Build synthetic dataset for EMA of EMA
    const ema1Arr = computeEMA(data, period, series);
    if (ema1Arr.length < period) return [];

    const ema1Prices: OHLCV[] = ema1Arr.map(pt => ({
        time: pt.time, open: pt.value, high: pt.value, low: pt.value, close: pt.value, volume: 0,
    }));
    const ema2Arr = computeEMA(ema1Prices, period, 'close');

    // Align and compute DEMA
    const offset = ema1Arr.length - ema2Arr.length;
    return ema2Arr.map((pt, i) => {
        const e1 = ema1Arr[i + offset].value;
        return { time: pt.time, value: 2 * e1 - pt.value };
    });
}

// ── TEMA ──────────────────────────────────────────────────────────────────────

export function computeTEMA(data: OHLCV[], period = 20, series: 'close' | 'open' | 'high' | 'low' = 'close'): IndicatorPoint[] {
    const ema1Arr = computeEMA(data, period, series);
    if (ema1Arr.length < period) return [];
    const toSynth = (arr: IndicatorPoint[]): OHLCV[] =>
        arr.map(pt => ({ time: pt.time, open: pt.value, high: pt.value, low: pt.value, close: pt.value, volume: 0 }));
    const ema2Arr = computeEMA(toSynth(ema1Arr), period, 'close');
    const ema3Arr = computeEMA(toSynth(ema2Arr), period, 'close');

    const off1 = ema1Arr.length - ema3Arr.length;
    const off2 = ema2Arr.length - ema3Arr.length;
    return ema3Arr.map((pt, i) => ({
        time: pt.time,
        value: 3 * ema1Arr[i + off1].value - 3 * ema2Arr[i + off2].value + pt.value,
    }));
}

// ── TRIMA ─────────────────────────────────────────────────────────────────────

export function computeTRIMA(data: OHLCV[], period = 20, series: 'close' | 'open' | 'high' | 'low' = 'close'): IndicatorPoint[] {
    // TRIMA = SMA of SMA
    const sma1 = computeSMA(data, Math.round(period / 2), series);
    const toSynth = (arr: IndicatorPoint[]): OHLCV[] =>
        arr.map(pt => ({ time: pt.time, open: pt.value, high: pt.value, low: pt.value, close: pt.value, volume: 0 }));
    return computeSMA(toSynth(sma1), Math.ceil(period / 2), 'close');
}

// ── RSI ───────────────────────────────────────────────────────────────────────

export function computeRSI(data: OHLCV[], period = 14): IndicatorPoint[] {
    const prices = closes(data, 'close');
    const t = times(data);
    if (prices.length < period + 1) return [];

    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) avgGain += diff;
        else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;

    const result: IndicatorPoint[] = [];
    const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push({ time: t[period], value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0) });

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        result.push({ time: t[i], value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
    }
    return result;
}

// ── MACD ──────────────────────────────────────────────────────────────────────

export interface MACDPoint {
    time: string;
    value: number;   // MACD line
    signal: number;  // Signal line
    histogram: number;
}

export function computeMACD(data: OHLCV[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDPoint[] {
    const ema12 = computeEMA(data, fastPeriod);
    const ema26 = computeEMA(data, slowPeriod);

    // Align: ema26 starts later
    const offset = ema12.length - ema26.length;
    const macdLine = ema26.map((pt, i) => ({
        time: pt.time, close: ema12[i + offset].value - pt.value,
        open: 0, high: 0, low: 0, volume: 0,
    })) as OHLCV[];

    const signalArr = computeEMA(macdLine, signalPeriod, 'close');
    const off2 = macdLine.length - signalArr.length;

    return signalArr.map((pt, i) => {
        const macd = macdLine[i + off2].close;
        return {
            time: pt.time,
            value: macd,
            signal: pt.value,
            histogram: macd - pt.value,
        };
    });
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────

export interface BollingerPoint {
    time: string;
    value: number;   // Middle (SMA)
    upper: number;
    lower: number;
    bandwidth: number;
}

export function computeBBands(data: OHLCV[], period = 20, devMultiplier = 2): BollingerPoint[] {
    const prices = closes(data, 'close');
    const t = times(data);
    const result: BollingerPoint[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const window = prices.slice(i - period + 1, i + 1);
        const mean = window.reduce((a, b) => a + b, 0) / period;
        const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = mean + devMultiplier * std;
        const lower = mean - devMultiplier * std;
        result.push({ time: t[i], value: mean, upper, lower, bandwidth: (upper - lower) / mean });
    }
    return result;
}

// ── ATR ───────────────────────────────────────────────────────────────────────

export function computeATR(data: OHLCV[], period = 14): IndicatorPoint[] {
    if (data.length < period + 1) return [];
    const t = times(data);
    const trs = data.slice(1).map((d, i) => {
        const prev = data[i].close;
        return Math.max(d.high - d.low, Math.abs(d.high - prev), Math.abs(d.low - prev));
    });

    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const result: IndicatorPoint[] = [{ time: t[period], value: atr }];
    for (let i = period; i < trs.length; i++) {
        atr = (atr * (period - 1) + trs[i]) / period;
        result.push({ time: t[i + 1], value: atr });
    }
    return result;
}

// ── NATR ──────────────────────────────────────────────────────────────────────

export function computeNATR(data: OHLCV[], period = 14): IndicatorPoint[] {
    const atr = computeATR(data, period);
    return atr.map((pt, i) => {
        const closeIdx = data.findIndex(d => d.time === pt.time);
        const c = closeIdx >= 0 ? data[closeIdx].close : 1;
        return { time: pt.time, value: (pt.value / c) * 100 };
    });
}

// ── Stochastic ────────────────────────────────────────────────────────────────

export interface StochPoint { time: string; K: number; D: number; value: number; }

export function computeStoch(data: OHLCV[], kPeriod = 14, dPeriod = 3): StochPoint[] {
    const t = times(data);
    const kArr: { time: string; value: number }[] = [];
    for (let i = kPeriod - 1; i < data.length; i++) {
        const window = data.slice(i - kPeriod + 1, i + 1);
        const hh = Math.max(...window.map(d => d.high));
        const ll = Math.min(...window.map(d => d.low));
        const K = hh === ll ? 0 : ((data[i].close - ll) / (hh - ll)) * 100;
        kArr.push({ time: t[i], value: K });
    }
    const synth = kArr.map(pt => ({ time: pt.time, open: pt.value, high: pt.value, low: pt.value, close: pt.value, volume: 0 })) as OHLCV[];
    const dArr = computeSMA(synth, dPeriod, 'close');
    const off = kArr.length - dArr.length;
    return dArr.map((pt, i) => ({
        time: pt.time,
        K: kArr[i + off].value,
        D: pt.value,
        value: kArr[i + off].value,
    }));
}

// ── CCI ───────────────────────────────────────────────────────────────────────

export function computeCCI(data: OHLCV[], period = 14): IndicatorPoint[] {
    const t = times(data);
    const result: IndicatorPoint[] = [];
    for (let i = period - 1; i < data.length; i++) {
        const window = data.slice(i - period + 1, i + 1);
        const tps = window.map(d => (d.high + d.low + d.close) / 3);
        const mean = tps.reduce((a, b) => a + b, 0) / period;
        const mad = tps.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
        result.push({ time: t[i], value: mad === 0 ? 0 : (tps[tps.length - 1] - mean) / (0.015 * mad) });
    }
    return result;
}

// ── Williams %R ───────────────────────────────────────────────────────────────

export function computeWillR(data: OHLCV[], period = 14): IndicatorPoint[] {
    const t = times(data);
    const result: IndicatorPoint[] = [];
    for (let i = period - 1; i < data.length; i++) {
        const window = data.slice(i - period + 1, i + 1);
        const hh = Math.max(...window.map(d => d.high));
        const ll = Math.min(...window.map(d => d.low));
        const value = hh === ll ? -50 : ((hh - data[i].close) / (hh - ll)) * -100;
        result.push({ time: t[i], value });
    }
    return result;
}

// ── ROC ───────────────────────────────────────────────────────────────────────

export function computeROC(data: OHLCV[], period = 10): IndicatorPoint[] {
    const prices = closes(data, 'close');
    const t = times(data);
    const result: IndicatorPoint[] = [];
    for (let i = period; i < prices.length; i++) {
        const value = ((prices[i] - prices[i - period]) / prices[i - period]) * 100;
        result.push({ time: t[i], value });
    }
    return result;
}

// ── Momentum ──────────────────────────────────────────────────────────────────

export function computeMOM(data: OHLCV[], period = 10): IndicatorPoint[] {
    const prices = closes(data, 'close');
    const t = times(data);
    return prices.slice(period).map((p, i) => ({ time: t[i + period], value: p - prices[i] }));
}

// ── OBV ───────────────────────────────────────────────────────────────────────

export function computeOBV(data: OHLCV[]): IndicatorPoint[] {
    const t = times(data);
    let obv = 0;
    return data.map((d, i) => {
        if (i === 0) return { time: d.time, value: 0 };
        const diff = d.close - data[i - 1].close;
        obv += diff > 0 ? d.volume : diff < 0 ? -d.volume : 0;
        return { time: t[i], value: obv };
    });
}

// ── A/D Line ──────────────────────────────────────────────────────────────────

export function computeAD(data: OHLCV[]): IndicatorPoint[] {
    let ad = 0;
    return data.map(d => {
        const range = d.high - d.low;
        const mfm = range === 0 ? 0 : ((d.close - d.low) - (d.high - d.close)) / range;
        ad += mfm * d.volume;
        return { time: d.time, value: ad };
    });
}

// ── A/D Oscillator ────────────────────────────────────────────────────────────

export function computeADOSC(data: OHLCV[], fast = 3, slow = 10): IndicatorPoint[] {
    const adLine = computeAD(data);
    const toSynth = (): OHLCV[] => adLine.map(pt => ({ time: pt.time, open: pt.value, high: pt.value, low: pt.value, close: pt.value, volume: 0 }));
    const emaFast = computeEMA(toSynth(), fast);
    const emaSlow = computeEMA(toSynth(), slow);
    const offset = emaFast.length - emaSlow.length;
    return emaSlow.map((pt, i) => ({ time: pt.time, value: emaFast[i + offset].value - pt.value }));
}

// ── Master dispatch ───────────────────────────────────────────────────────────

export type IndicatorId =
    | 'SMA' | 'EMA' | 'WMA' | 'DEMA' | 'TEMA' | 'TRIMA'
    | 'RSI' | 'MACD' | 'STOCH' | 'CCI' | 'WILLR' | 'ROC' | 'MOM'
    | 'BBANDS' | 'ATR' | 'NATR'
    | 'OBV' | 'AD' | 'ADOSC';

export interface IndicatorResult {
    series: IndicatorPoint[];
    /** Extra series for multi-line indicators (MACD signal, Bollinger upper/lower) */
    extra?: Record<string, IndicatorPoint[]>;
    latestValue: number | null;
    latestExtra?: Record<string, number>;
}

export function computeIndicator(
    id: IndicatorId,
    data: OHLCV[],
    period = 20,
    series: 'close' | 'open' | 'high' | 'low' = 'close'
): IndicatorResult {
    if (!data || data.length === 0) return { series: [], latestValue: null };

    switch (id) {
        case 'SMA': { const s = computeSMA(data, period, series); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'EMA': { const s = computeEMA(data, period, series); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'WMA': { const s = computeWMA(data, period, series); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'DEMA': { const s = computeDEMA(data, period, series); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'TEMA': { const s = computeTEMA(data, period, series); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'TRIMA': { const s = computeTRIMA(data, period, series); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'RSI': { const s = computeRSI(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'MOM': { const s = computeMOM(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'ROC': { const s = computeROC(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'CCI': { const s = computeCCI(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'WILLR': { const s = computeWillR(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'ATR': { const s = computeATR(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'NATR': { const s = computeNATR(data, period); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'OBV': { const s = computeOBV(data); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'AD': { const s = computeAD(data); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'ADOSC': { const s = computeADOSC(data); return { series: s, latestValue: s.at(-1)?.value ?? null }; }
        case 'MACD': {
            const s = computeMACD(data, 12, 26, 9);
            const last = s.at(-1);
            return {
                series: s.map(p => ({ time: p.time, value: p.value })),
                extra: {
                    signal: s.map(p => ({ time: p.time, value: p.signal })),
                    histogram: s.map(p => ({ time: p.time, value: p.histogram })),
                },
                latestValue: last?.value ?? null,
                latestExtra: last ? { signal: last.signal, histogram: last.histogram } : undefined,
            };
        }
        case 'STOCH': {
            const s = computeStoch(data, period, 3);
            const last = s.at(-1);
            return {
                series: s.map(p => ({ time: p.time, value: p.K })),
                extra: { D: s.map(p => ({ time: p.time, value: p.D })) },
                latestValue: last?.K ?? null,
                latestExtra: last ? { D: last.D } : undefined,
            };
        }
        case 'BBANDS': {
            const s = computeBBands(data, period);
            const last = s.at(-1);
            return {
                series: s.map(p => ({ time: p.time, value: p.value })),
                extra: {
                    upper: s.map(p => ({ time: p.time, value: p.upper })),
                    lower: s.map(p => ({ time: p.time, value: p.lower })),
                },
                latestValue: last?.value ?? null,
                latestExtra: last ? { upper: last.upper, lower: last.lower, bandwidth: last.bandwidth } : undefined,
            };
        }
        default: return { series: [], latestValue: null };
    }
}
