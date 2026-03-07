"use client";

import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, BarChart, Bar, YAxis, XAxis, ResponsiveContainer,
    Tooltip, ReferenceLine,
} from 'recharts';
import { FlaskConical, TrendingUp, BarChart2, Sigma, Activity, Zap } from 'lucide-react';
import { computeIndicator, type IndicatorId, type OHLCV } from '@/lib/indicatorEngine';

// ── Registry ──────────────────────────────────────────────────────────────────
const COMPUTE_OPS = [
    // Trend
    { id: 'SMA', label: 'SMA', category: 'trend', desc: 'Simple Moving Average' },
    { id: 'EMA', label: 'EMA', category: 'trend', desc: 'Exponential Moving Average' },
    { id: 'WMA', label: 'WMA', category: 'trend', desc: 'Weighted Moving Average' },
    { id: 'DEMA', label: 'DEMA', category: 'trend', desc: 'Double EMA' },
    { id: 'TEMA', label: 'TEMA', category: 'trend', desc: 'Triple EMA' },
    { id: 'TRIMA', label: 'TRIMA', category: 'trend', desc: 'Triangular Moving Average' },
    // Momentum
    { id: 'RSI', label: 'RSI', category: 'momentum', desc: 'Relative Strength Index' },
    { id: 'MACD', label: 'MACD', category: 'momentum', desc: 'MACD (12, 26, 9)' },
    { id: 'STOCH', label: 'Stochastic', category: 'momentum', desc: 'Stochastic Oscillator %K/%D' },
    { id: 'CCI', label: 'CCI', category: 'momentum', desc: 'Commodity Channel Index' },
    { id: 'WILLR', label: 'Williams %R', category: 'momentum', desc: "Williams' %R" },
    { id: 'ROC', label: 'ROC', category: 'momentum', desc: 'Rate of Change' },
    { id: 'MOM', label: 'Momentum', category: 'momentum', desc: 'Price Momentum' },
    // Volatility
    { id: 'BBANDS', label: 'Bollinger', category: 'volatility', desc: 'Bollinger Bands (SMA ± 2σ)' },
    { id: 'ATR', label: 'ATR', category: 'volatility', desc: 'Average True Range' },
    { id: 'NATR', label: 'NATR', category: 'volatility', desc: 'Normalised ATR (%)' },
    // Volume
    { id: 'OBV', label: 'OBV', category: 'volume', desc: 'On-Balance Volume' },
    { id: 'AD', label: 'A/D Line', category: 'volume', desc: 'Accumulation/Distribution' },
    { id: 'ADOSC', label: 'A/D Osc', category: 'volume', desc: 'Chaikin A/D Oscillator' },
] as const;

const CAT_COLOR: Record<string, string> = {
    trend: '#3fb950', momentum: '#f0883e', volatility: '#ff4757', volume: '#58a6ff',
};
const CAT_ICON: Record<string, any> = {
    trend: Activity, momentum: TrendingUp, volatility: BarChart2, volume: Sigma,
};

const PERIODS = [
    { label: '20 MA (short)', value: 20 },
    { label: '50 MA (medium)', value: 50 },
    { label: '100 MA (intermediate)', value: 100 },
    { label: '200 MA (long-term)', value: 200 },
    { label: 'Custom…', value: -1 },
];

const HISTORY_PERIODS: Record<string, string> = {
    daily: '1y', weekly: '2y', monthly: '5y',
    '60min': '60d', '30min': '30d', '15min': '15d',
    '5min': '5d', '1min': '2d',
};
const INTERVAL_MAP: Record<string, string> = {
    daily: '1d', weekly: '1wk', monthly: '1mo',
    '60min': '60m', '30min': '30m', '15min': '15m',
    '5min': '5m', '1min': '1m',
};

interface Props {
    data: {
        ticker?: string;
        operation?: string;
        time_period?: number;
        interval?: string;
        series_type?: string;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
}

export default function ComputationalWidget({ data, onClose, onOutputChange }: Props) {
    const [opId, setOpId] = useState<IndicatorId>((data.operation as IndicatorId) || 'SMA');
    const [period, setPeriod] = useState(data.time_period || 20);
    const [customPeriod, setCustom] = useState(data.time_period || 20);
    const [interval, setInterval] = useState(data.interval || 'daily');
    const [series, setSeries] = useState<'close' | 'open' | 'high' | 'low'>(
        (data.series_type as any) || 'close'
    );
    const [catFilter, setCatFilter] = useState('all');

    // Reactive sync from props
    useEffect(() => {
        if (data.operation) setOpId(data.operation as IndicatorId);
        if (data.time_period) {
            setPeriod(data.time_period);
            setCustom(data.time_period);
        }
        if (data.interval) setInterval(data.interval);
        if (data.series_type) setSeries(data.series_type as any);
    }, [data.operation, data.time_period, data.interval, data.series_type]);

    const [ohlcv, setOhlcv] = useState<OHLCV[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ReturnType<typeof computeIndicator> | null>(null);

    const ticker = data.ticker;
    const op = COMPUTE_OPS.find(o => o.id === opId) ?? COMPUTE_OPS[0];
    const catColor = CAT_COLOR[op.category] ?? '#58a6ff';
    const Icon = CAT_ICON[op.category] ?? FlaskConical;

    // 1. Fetch OHLCV whenever ticker / interval changes
    useEffect(() => {
        if (!ticker) { setOhlcv([]); setResult(null); return; }
        let cancelled = false;
        setLoading(true);
        setError(null);
        const histPeriod = HISTORY_PERIODS[interval] ?? '1y';
        const yInterval = INTERVAL_MAP[interval] ?? '1d';
        fetch(`http://localhost:8261/api/history/${ticker}?period=${histPeriod}&interval=${yInterval}`)
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(json => {
                if (!cancelled) {
                    setOhlcv(json.data || []);
                    setLoading(false);
                }
            })
            .catch(e => {
                if (!cancelled) { setError(String(e)); setLoading(false); }
            });
        return () => { cancelled = true; };
    }, [ticker, interval]);

    // 2. Compute indicator locally whenever OHLCV or indicator settings change
    useEffect(() => {
        if (ohlcv.length === 0) { setResult(null); return; }
        const r = computeIndicator(opId, ohlcv, period, series);
        setResult(r);
        if (r.latestValue !== null) {
            onOutputChange?.({ result: r.latestValue, ticker, operation: opId, ...r.latestExtra });
        }
    }, [ohlcv, opId, period, series]); // eslint-disable-line

    const effectivePeriod = period;
    const chartSeries = (result?.series ?? []).slice(-80);
    const showBars = ['OBV', 'AD', 'ADOSC', 'MACD'].includes(opId);
    const isOsc = ['RSI', 'CCI', 'WILLR', 'STOCH'].includes(opId);

    const s: React.CSSProperties = {
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        color: '#fff', padding: '4px 8px', borderRadius: '5px',
        fontSize: '0.78rem', fontFamily: 'var(--font-base)', width: '100%',
    };

    const filteredOps = COMPUTE_OPS.filter(o => catFilter === 'all' || o.category === catFilter);

    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: catColor, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                    <Icon size={15} />
                    Computational Block
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: catColor + '22', border: `1px solid ${catColor}44`, borderRadius: '10px' }}>{op.category}</span>
                    <span style={{ fontSize: '0.68rem', color: '#3fb95088', marginLeft: 2, display: 'flex', alignItems: 'center', gap: '2px' }}><Zap size={10} /> Local</span>
                    {ticker && <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)' }}>{ticker}</span>}
                </h3>
                {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
            </div>

            {/* Category filter pills */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {['all', 'trend', 'momentum', 'volatility', 'volume'].map(cat => (
                    <button key={cat} onClick={() => setCatFilter(cat)} style={{
                        padding: '2px 8px', fontSize: '0.68rem', borderRadius: '10px', cursor: 'pointer',
                        border: `1px solid ${cat !== 'all' ? CAT_COLOR[cat] : '#555'}`,
                        background: catFilter === cat ? (CAT_COLOR[cat] ?? '#ffffff22') + '33' : 'transparent',
                        color: cat !== 'all' ? CAT_COLOR[cat] : '#aaa',
                        fontFamily: 'var(--font-base)',
                    }}>{cat}</button>
                ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '8px' }}>
                <div>
                    <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Operation</label>
                    <select value={opId} onChange={e => setOpId(e.target.value as IndicatorId)} style={s}>
                        {filteredOps.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Period</label>
                    <select value={period} onChange={e => {
                        const v = Number(e.target.value);
                        if (v === -1) setPeriod(customPeriod);
                        else setPeriod(v);
                    }} style={s}>
                        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Interval</label>
                    <select value={interval} onChange={e => setInterval(e.target.value)} style={s}>
                        {Object.keys(INTERVAL_MAP).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Series</label>
                    <select value={series} onChange={e => setSeries(e.target.value as any)} style={s}>
                        {['close', 'open', 'high', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
                {op.desc} — computed locally from {ohlcv.length} OHLCV bars
            </div>

            {/* Result area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px', minHeight: 0 }}>
                {!ticker ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>
                        🔗 Connect a <strong style={{ color: '#3fb950' }}>Ticker</strong> input port
                    </div>
                ) : loading ? (
                    <div style={{ color: catColor, fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>
                        Fetching {ticker} OHLCV…
                    </div>
                ) : error ? (
                    <div style={{ color: '#ff4757', fontSize: '0.8rem', textAlign: 'center', margin: 'auto' }}>{error}</div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ticker} · {opId}({effectivePeriod})</span>
                            {result?.latestExtra?.signal !== undefined && (
                                <span style={{ fontSize: '0.72rem', color: '#a855f7' }}>Signal: {Number(result.latestExtra.signal).toFixed(3)}</span>
                            )}
                            {result?.latestExtra?.upper !== undefined && (
                                <span style={{ fontSize: '0.72rem', color: '#ff4757' }}>↑{Number(result.latestExtra.upper).toFixed(2)}</span>
                            )}
                            {result?.latestExtra?.lower !== undefined && (
                                <span style={{ fontSize: '0.72rem', color: '#3fb950' }}>↓{Number(result.latestExtra.lower).toFixed(2)}</span>
                            )}
                        </div>

                        <div style={{ fontSize: '2rem', fontWeight: 700, color: catColor, letterSpacing: '-1px', marginBottom: '8px' }}>
                            {result?.latestValue !== null && result?.latestValue !== undefined ? Number(result.latestValue).toFixed(3) : '--'}
                        </div>

                        {/* RSI band */}
                        {opId === 'RSI' && result?.latestValue !== null && (
                            <div style={{ marginBottom: '8px' }}>
                                <span style={{
                                    fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px',
                                    background: (result?.latestValue ?? 50) > 70 ? '#ff475733' : (result?.latestValue ?? 50) < 30 ? '#3fb95033' : '#ffffff11',
                                    color: (result?.latestValue ?? 50) > 70 ? '#ff4757' : (result?.latestValue ?? 50) < 30 ? '#3fb950' : '#aaa'
                                }}>
                                    {(result?.latestValue ?? 50) > 70 ? '🔴 Overbought' : (result?.latestValue ?? 50) < 30 ? '🟢 Oversold' : '⚪ Neutral'}
                                </span>
                            </div>
                        )}

                        {/* Chart */}
                        {chartSeries.length > 0 && (
                            <div style={{ flex: 1, minHeight: '80px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    {showBars ? (
                                        <BarChart data={chartSeries}>
                                            <YAxis domain={['auto', 'auto']} hide />
                                            <Tooltip contentStyle={{ background: '#1c2128', border: `1px solid ${catColor}44`, fontSize: '11px' }} />
                                            <Bar dataKey="value" fill={catColor} />
                                        </BarChart>
                                    ) : (
                                        <LineChart data={chartSeries}>
                                            <YAxis domain={['auto', 'auto']} hide />
                                            <Tooltip contentStyle={{ background: '#1c2128', border: `1px solid ${catColor}44`, fontSize: '11px' }} />
                                            {isOsc && opId === 'RSI' && <ReferenceLine y={70} stroke="#ff475755" strokeDasharray="3 3" />}
                                            {isOsc && opId === 'RSI' && <ReferenceLine y={30} stroke="#3fb95055" strokeDasharray="3 3" />}
                                            <Line type="monotone" dataKey="value" stroke={catColor} strokeWidth={2} dot={false} />
                                            {/* Signal/extra line */}
                                            {result?.extra?.signal && (() => {
                                                const sig = result.extra!.signal.slice(-80);
                                                return <Line data={sig} type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={1.5} dot={false} />;
                                            })()}
                                            {result?.extra?.upper && (() => {
                                                const up = result.extra!.upper.slice(-80);
                                                return <Line data={up} type="monotone" dataKey="value" stroke="#ff4757aa" strokeDasharray="4 2" strokeWidth={1} dot={false} />;
                                            })()}
                                            {result?.extra?.lower && (() => {
                                                const lo = result.extra!.lower.slice(-80);
                                                return <Line data={lo} type="monotone" dataKey="value" stroke="#3fb950aa" strokeDasharray="4 2" strokeWidth={1} dot={false} />;
                                            })()}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
