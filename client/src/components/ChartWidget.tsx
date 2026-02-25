"use client";

import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Bar, PieChart, Pie, Cell // Removed RadialBar due to complexity with re-exports for now
} from 'recharts';

interface ChartWidgetProps {
    data: any;
    onClose: () => void;
}

export default function ChartWidget({ data, onClose }: ChartWidgetProps) {
    // Determine if this is a comparison chart or advanced single stock chart
    const isComparison = data.chart_type === "comparison";
    const isPie = data.chart_type === "pie";
    const isBar = data.chart_type === "bar";

    if (data.error) {
        return (
            <div className="glass-panel" style={{ borderLeft: '4px solid #f85149' }}>
                <h3 style={{ color: '#f85149', marginBottom: '8px' }}>Error rendering chart</h3>
                <p>{data.error}</p>
            </div>
        );
    }

    // Pre-process data for specific chart types
    let chartContent = null;
    const colors = ["#58a6ff", "#bc8cff", "#238636", "#d2a8ff", "#3fb950", "#f78166", "#e3b341"]; // Extended palette

    if (isPie && data.data) {
        chartContent = (
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={data.data}
                        cx="50%"
                        cy="50%"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {data.data.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(13, 17, 23, 0.9)', borderRadius: '8px', border: 'none' }} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        );
    } else if (isBar && data.data) {
        chartContent = (
             <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={data.data} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="#444" strokeDasharray="3 3" horizontal={false} />
                     <XAxis type="number" stroke="#8b949e" />
                     <YAxis dataKey="name" type="category" stroke="#8b949e" width={100} />
                     <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d' }} cursor={{fill: 'rgba(255,255,255,0.1)'}} />
                     <Bar dataKey="value" fill="#58a6ff" radius={[0, 4, 4, 0]} barSize={20}>
                        {data.data.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                     </Bar>
                </ComposedChart>
            </ResponsiveContainer>
        );
    } else if (isComparison && data.series) {
        // Transform arrays of {date, value} per ticker into one array of {date, AAPL_val, MSFT_val} for recharts
        const dateMap = new Map();
        data.series.forEach((s: any) => {
            s.data.forEach((p: any) => {
                if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
                const entry = dateMap.get(p.date);
                entry[s.ticker] = p.value;
            });
        });

        const chartData = Array.from(dateMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        chartContent = (
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="date" stroke="#8b949e" tick={{ fill: '#8b949e', fontSize: 12 }} dy={10} />
                    <YAxis stroke="#8b949e" tick={{ fill: '#8b949e', fontSize: 12 }} dx={-10} domain={['auto', 'auto']} tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(13, 17, 23, 0.9)', borderColor: 'rgba(48, 54, 61, 1)', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#c9d1d9' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {data.series.map((s: any, idx: number) => (
                        <Line
                            key={s.ticker}
                            type="monotone"
                            dataKey={s.ticker}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        );
    } else if (!isComparison && data.data) {
        // Handle Advanced Stock Graph 
        const title = data.title || `${data.ticker} - Advanced Analysis (${data.period})`;

        // Basic line chart mapping for advanced single stock right now (candlestick requires custom shape in recharts or complex composed)
        chartContent = (
            <div style={{ width: '100%' }}>
                <h3 style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--primary)' }}>{title}</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={data.data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                        <XAxis dataKey="date" stroke="#8b949e" tick={{ fill: '#8b949e', fontSize: 12 }} />
                        <YAxis yAxisId="price" stroke="#8b949e" domain={['auto', 'auto']} tickFormatter={(val) => `$${val}`} />
                        <YAxis yAxisId="vol" orientation="right" stroke="#8b949e" tick={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(13, 17, 23, 0.9)', borderColor: 'rgba(48, 54, 61, 1)', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar yAxisId="vol" dataKey="volume" fill="rgba(88, 166, 255, 0.2)" name="Volume" />
                        <Line yAxisId="price" type="monotone" dataKey="close" stroke="var(--primary)" strokeWidth={3} dot={false} name="Close Price" />
                        {data.supplier_series && data.supplier_series.map((s: any, idx: number) => (
                             <Line key={s.ticker} yAxisId="price" type="monotone" dataKey={s.ticker} stroke={colors[(idx + 1) % colors.length]} strokeDasharray="5 5" name={`Supplier: ${s.ticker}`} dot={false} />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="glass-panel" style={{ position: 'relative', width: '100%', marginBottom: '24px', animation: 'fadeIn 0.5s ease-out' }}>
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
            >
                ✕
            </button>
            <div style={{ padding: '16px 8px 8px 8px' }}>
                {chartContent || <p>Unsupported chart format.</p>}
            </div>
        </div>
    );
}
