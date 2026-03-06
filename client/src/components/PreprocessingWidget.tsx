"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Calculator } from 'lucide-react';
import { computeIndicator, type IndicatorId, type OHLCV } from '@/lib/indicatorEngine';

const FUNCTIONS: IndicatorId[] = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA'];
const INTERVALS = ['daily', 'weekly', 'monthly', '60min', '30min', '15min', '5min'];
const SERIES_TYPES = ['close', 'open', 'high', 'low'];

const HISTORY_PERIODS: Record<string, string> = {
    daily: '1y', weekly: '2y', monthly: '5y',
    '60min': '60d', '30min': '30d', '15min': '15d', '5min': '5d',
};
const INTERVAL_MAP: Record<string, string> = {
    daily: '1d', weekly: '1wk', monthly: '1mo',
    '60min': '60m', '30min': '30m', '15min': '15m', '5min': '5m',
};

interface PreprocessingWidgetProps {
    data: {
        ticker?: string;
        function?: string;
        time_period?: number;
        interval?: string;
        series_type?: string;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
}

export default function PreprocessingWidget({ data, onClose, onOutputChange }: PreprocessingWidgetProps) {
    const [fn, setFn] = useState<IndicatorId>((data.function as IndicatorId) || 'SMA');
    const [period, setPeriod] = useState(data.time_period || 20);
    const [interval, setInterval] = useState(data.interval || 'daily');
    const [seriesType, setSeries] = useState<'close' | 'open' | 'high' | 'low'>((data.series_type as any) || 'close');

    const [ohlcv, setOhlcv] = useState<OHLCV[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chartData, setChart] = useState<{ time: string; value: number }[]>([]);
    const [latest, setLatest] = useState<number | null>(null);

    // Reactive sync from props
    useEffect(() => {
        if (data.function) setFn(data.function as IndicatorId);
        if (data.time_period) setPeriod(data.time_period);
        if (data.interval) setInterval(data.interval);
        if (data.series_type) setSeries(data.series_type as any);
    }, [data.function, data.time_period, data.interval, data.series_type]);

    const ticker = data.ticker;

    // Fetch OHLCV whenever ticker or interval changes
    useEffect(() => {
        if (!ticker) { setOhlcv([]); setChart([]); setLatest(null); return; }
        let cancelled = false;
        setLoading(true);
        setError(null);
        const histPeriod = HISTORY_PERIODS[interval] ?? '1y';
        const yInterval = INTERVAL_MAP[interval] ?? '1d';
        fetch(`http://localhost:8261/api/history/${ticker}?period=${histPeriod}&interval=${yInterval}`)
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(json => { if (!cancelled) { setOhlcv(json.data || []); setLoading(false); } })
            .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });
        return () => { cancelled = true; };
    }, [ticker, interval]);

    // Run indicator locally whenever OHLCV / settings change
    useEffect(() => {
        if (ohlcv.length === 0) { setChart([]); setLatest(null); return; }
        const result = computeIndicator(fn, ohlcv, period, seriesType);
        const pts = result.series.slice(-80);
        setChart(pts);
        setLatest(result.latestValue);
        if (result.latestValue !== null) {
            onOutputChange?.({ result: result.latestValue, series: pts, ticker, function: fn });
        }
    }, [ohlcv, fn, period, seriesType]); // eslint-disable-line

    const InputStyle: React.CSSProperties = {
        background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)',
        color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
        fontFamily: 'var(--font-base)', width: '100%',
    };

    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                    <Calculator size={17} />
                    Math Preprocessing
                    <span style={{ fontSize: '0.68rem', color: '#3fb950', marginLeft: 2 }}>⚡ Local</span>
                    {ticker && <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)' }}>{ticker}</span>}
                </h3>
                {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Indicator</label>
                    <select value={fn} onChange={e => setFn(e.target.value as IndicatorId)} style={InputStyle}>
                        {FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Period</label>
                    <input type="number" value={period} onChange={e => setPeriod(Number(e.target.value))} style={InputStyle} min={2} max={500} />
                </div>
                <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Interval</label>
                    <select value={interval} onChange={e => setInterval(e.target.value)} style={InputStyle}>
                        {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Series</label>
                    <select value={seriesType} onChange={e => setSeries(e.target.value as any)} style={InputStyle}>
                        {SERIES_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '12px' }}>
                {!ticker ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Connect a Ticker to calculate.</div>
                ) : loading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching {ticker} OHLCV…</div>
                ) : error ? (
                    <div style={{ color: '#ff4757', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>
                ) : (
                    <>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            {ticker} {fn}({period}) — {ohlcv.length} bars
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                            {latest !== null ? latest.toFixed(4) : '--'}
                        </div>
                        {chartData.length > 0 && (
                            <div style={{ width: '100%', height: '80px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <YAxis domain={['auto', 'auto']} hide />
                                        <Tooltip contentStyle={{ background: '#1c2128', border: '1px solid #30363d', fontSize: '12px' }} />
                                        <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
