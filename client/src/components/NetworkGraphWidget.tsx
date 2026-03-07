"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Network } from 'lucide-react';

interface NodeData {
    id: string;
    group?: number;
    label?: string;
    val?: number;
}

interface LinkData {
    source: string;
    target: string;
    label?: string;
}

interface NetworkGraphWidgetProps {
    data: {
        nodes?: NodeData[];
        links?: LinkData[];
        title?: string;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
    onOpenSettings?: () => void;
}

export default function NetworkGraphWidget({ data, onClose, onOutputChange, onOpenSettings }: NetworkGraphWidgetProps) {
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const nodes = data.nodes || [];
    const links = data.links || [];
    const title = data.title || "Network Graph";

    // Simple custom force-directed layout implementation
    useEffect(() => {
        if (!canvasRef.current || nodes.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width;
        let height = canvas.height;

        // Handle resize
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                width = canvas.width;
                height = canvas.height;
            }
        };
        resize();
        window.addEventListener('resize', resize);

        // Initialize positions
        const nodePos = new Map<string, { x: number, y: number, vx: number, vy: number, group: number }>();
        nodes.forEach((n, i) => {
            nodePos.set(n.id, {
                x: width / 2 + (Math.random() - 0.5) * 50,
                y: height / 2 + (Math.random() - 0.5) * 50,
                vx: 0,
                vy: 0,
                group: n.group || 1
            });
        });

        // Resolve string array or object array links into string keys
        const edges = links.map(l => ({
            source: typeof l.source === 'string' ? l.source : (l.source as any).id,
            target: typeof l.target === 'string' ? l.target : (l.target as any).id,
            label: l.label
        })).filter(e => nodePos.has(e.source) && nodePos.has(e.target));

        let animationFrameId: number;
        let iteration = 0;

        const colors = ['#58a6ff', '#3fb950', '#f0883e', '#d2a8ff', '#ff7b72', '#a5d6ff'];

        const tick = () => {
            if (iteration > 300) return; // Stop simulating after 300 ticks to save CPU
            iteration++;

            // Repulsion
            const posArray = Array.from(nodePos.entries());
            for (let i = 0; i < posArray.length; i++) {
                for (let j = i + 1; j < posArray.length; j++) {
                    const [id1, p1] = posArray[i];
                    const [id2, p2] = posArray[j];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) dist = 0.01;

                    if (dist < 150) {
                        const force = (150 - dist) / dist * 0.05;
                        p1.vx -= dx * force;
                        p1.vy -= dy * force;
                        p2.vx += dx * force;
                        p2.vy += dy * force;
                    }
                }
            }

            // Attraction (Springs)
            edges.forEach(e => {
                const p1 = nodePos.get(e.source)!;
                const p2 = nodePos.get(e.target)!;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    const force = (dist - 80) * 0.02; // Target edge length 80
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    p1.vx += fx;
                    p1.vy += fy;
                    p2.vx -= fx;
                    p2.vy -= fy;
                }
            });

            // Center gravity
            posArray.forEach(([id, p]) => {
                const dx = width / 2 - p.x;
                const dy = height / 2 - p.y;
                p.vx += dx * 0.01;
                p.vy += dy * 0.01;

                // Friction
                p.vx *= 0.85;
                p.vy *= 0.85;

                p.x += p.vx;
                p.y += p.vy;

                // Bounds
                p.x = Math.max(20, Math.min(width - 20, p.x));
                p.y = Math.max(20, Math.min(height - 20, p.y));
            });

            // Render
            ctx.clearRect(0, 0, width, height);

            // Draw Edges
            edges.forEach(e => {
                const p1 = nodePos.get(e.source)!;
                const p2 = nodePos.get(e.target)!;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            // Draw Nodes
            posArray.forEach(([id, p]) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
                const color = colors[p.group % colors.length];
                ctx.fillStyle = id === selectedNode ? "#ffffff" : color;
                ctx.fill();
                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Labels
                ctx.fillStyle = "rgba(255,255,255,0.7)";
                ctx.font = "10px var(--font-base)";
                ctx.textAlign = "center";
                ctx.fillText(id, p.x, p.y + 18);
            });

            animationFrameId = requestAnimationFrame(tick);
        };

        tick();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, [nodes, links, selectedNode]);

    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                    <Network size={17} />
                    {title}
                </h3>
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
                    {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
                {nodes.length === 0 ? (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No graph data connected.
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                )}
            </div>
            {nodes.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {nodes.length} Nodes | {links.length} Edges
                </div>
            )}
        </div>
    );
}
