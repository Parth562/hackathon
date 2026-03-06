"use client";

import React, { useState, useEffect, useRef } from 'react';

interface LiveStockWidgetProps {
  data: {
    ticker: string;
    name?: string;
  };
  onClose?: (e: React.MouseEvent) => void;
}

const LiveStockWidget: React.FC<LiveStockWidgetProps> = ({ data, onClose }) => {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('');
  const [source, setSource] = useState<string>('Initializing...');
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);

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
        <button style={closeButtonStyle} onClick={(e) => onClose && onClose(e)}>✕</button>
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
