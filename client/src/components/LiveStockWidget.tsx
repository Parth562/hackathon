"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

interface LiveStockWidgetProps {
  data: {
    ticker: string;
    name?: string;
  };
  onClose?: (e: React.MouseEvent) => void;
  onOutputChange?: (updates: Record<string, any>) => void;
  onOpenSettings?: () => void;
}

const LiveStockWidget: React.FC<LiveStockWidgetProps> = ({ data, onClose, onOutputChange, onOpenSettings }) => {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('');
  const [source, setSource] = useState<string>('Initializing...');
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [history, setHistory] = useState<{ time: string, price: number }[]>([]);

  const prevPriceRef = useRef(price);

  const fetchQuote = async () => {
    try {
      const res = await fetch(`http://localhost:8261/api/quote/${encodeURIComponent(data.ticker)}`);
      if (!res.ok) throw new Error(`Failed to fetch quote: ${res.status}`);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        return;
      }

      let newPrice = null;
      let ccy = "INR";
      let src = json.source;
      let extractDetails = null;

      if (json.data && json.data.ltp) {
        newPrice = json.data.ltp;
        extractDetails = json.data;
      } else if (json.current_price) {
        newPrice = json.current_price;
        ccy = json.currency || "USD";
        extractDetails = {
          previous_close: json.previous_close
        };
      }

      if (newPrice !== null) {
        setPrevPrice(prevPriceRef.current);

        if (prevPriceRef.current !== null) {
          if (newPrice > prevPriceRef.current) setFlash('up');
          else if (newPrice < prevPriceRef.current) setFlash('down');
        }

        setPrice(newPrice);
        prevPriceRef.current = newPrice;
        setCurrency(ccy);
        setSource(src || 'Unknown');
        setLastUpdated(new Date());
        setDetails(extractDetails);
        setError(null);

        // Propagate outputs to the visual board UNCONDITIONALLY upon fetch
        // so any new edges correctly get the latest state immediately
        if (onOutputChange) {
          const updates: Record<string, any> = {
            'price': newPrice,
            'ticker': data.ticker
          };
          if (extractDetails?.previous_close) {
            updates['change'] = newPrice - extractDetails.previous_close;
          }
          onOutputChange(updates);
        }

        const now = new Date();
        setHistory(prev => {
          const newPoint = { time: now.toLocaleTimeString(), price: newPrice };
          // Keep the last 30 data points
          const updated = [...prev, newPoint];
          return updated.slice(-30);
        });

        setTimeout(() => setFlash(null), 1000);
      }

    } catch (err: any) {
      console.error("Live widget polling error:", err);
      setError("Connection lost. Retrying...");
    }
  };

  useEffect(() => {
    // Reset price state immediately when the ticker changes
    setPrice(null);
    setPrevPrice(null);
    setError(null);
    setDetails(null);
    setHistory([]);
    setSource('Loading...');
    prevPriceRef.current = null;

    if (!data.ticker) return;
    fetchQuote();
    const interval = setInterval(fetchQuote, 3000);
    return () => clearInterval(interval);
  }, [data.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2
    }).format(val);
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', padding: '20px', height: '100%', width: '100%',
    boxSizing: 'border-box', background: 'rgba(15, 20, 30, 0.7)', backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px', color: 'white', position: 'relative', overflow: 'hidden'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', cursor: 'grab'
  };

  const titleStyle: React.CSSProperties = {
    margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#e0e6ed', display: 'flex', alignItems: 'center', gap: '8px'
  };

  const pulseStyle: React.CSSProperties = {
    width: '8px', height: '8px', backgroundColor: '#00ff66', borderRadius: '50%', boxShadow: '0 0 8px #00ff66',
    animation: 'pulse 1.5s infinite' // Note: Keyframes animation won't work perfectly without styled-components/css files, but it's acceptable fallback
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px', padding: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  const getPriceStyle = (): React.CSSProperties => {
    let base: React.CSSProperties = {
      fontSize: '2.5rem', fontWeight: 700, fontFamily: 'Inter, monospace', marginBottom: '8px',
      borderRadius: '8px', padding: '8px 12px', marginLeft: '-12px', transition: 'all 0.3s ease'
    };
    if (flash === 'up') return { ...base, color: '#00ff66', backgroundColor: 'rgba(0, 255, 100, 0.4)' };
    if (flash === 'down') return { ...base, color: '#ff4757', backgroundColor: 'rgba(255, 50, 50, 0.4)' };
    return base;
  };

  const metaDataStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.8, fontSize: '0.9rem', marginTop: 'auto'
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px'
  };

  const tagStyle: React.CSSProperties = {
    fontSize: '0.75rem', color: '#8b949e', marginTop: '12px', textAlign: 'right', fontStyle: 'italic'
  };

  return (
    <div style={containerStyle}>
      <div className="drag-handle" style={headerStyle}>
        <h3 style={titleStyle}><div style={pulseStyle} /> {data.ticker}</h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--primary)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          )}
          <button style={closeButtonStyle} onClick={(e) => onClose && onClose(e)}>✕</button>
        </div>
      </div>

      {error ? (
        <div style={{ color: '#ff4757', padding: '20px 0' }}>{error}</div>
      ) : price === null ? (
        <div style={{ opacity: 0.6, padding: '20px 0' }}>Loading live feed...</div>
      ) : (
        <>
          <div style={getPriceStyle()}>
            {formatCurrency(price)}
          </div>

          {history.length > 1 && (
            <div style={{ height: '60px', width: '100%', marginBottom: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <YAxis domain={['auto', 'auto']} hide />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={price > (history[0]?.price ?? price) ? '#00ff66' : '#ff4757'}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={metaDataStyle}>
            {details && details.high && (
              <div style={rowStyle}><span>High</span> <span>{formatCurrency(details.high)}</span></div>
            )}
            {details && details.low && (
              <div style={rowStyle}><span>Low</span> <span>{formatCurrency(details.low)}</span></div>
            )}
            {details && details.open && (
              <div style={rowStyle}><span>Open</span> <span>{formatCurrency(details.open)}</span></div>
            )}
            {details && details.previous_close && (
              <div style={rowStyle}><span>Prev Close</span> <span>{formatCurrency(details.previous_close)}</span></div>
            )}
            {details && details.volume && (
              <div style={rowStyle}><span>Volume</span> <span>{details.volume.toLocaleString()}</span></div>
            )}
            {prevPrice !== null && (
              <div style={rowStyle}>
                <span>Change</span>
                <span style={{ color: price > prevPrice ? '#00ff66' : price < prevPrice ? '#ff4757' : 'inherit' }}>
                  {price > prevPrice ? '+' : ''}{((price - prevPrice) / prevPrice * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <div style={tagStyle}>
            Updated: {lastUpdated.toLocaleTimeString()} | Source: {source}
          </div>
        </>
      )}
    </div>
  );
};

export default LiveStockWidget;
