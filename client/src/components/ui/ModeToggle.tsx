/**
 * ui/ModeToggle.tsx — Quick / Deep segmented control pill.
 */
"use client";
import React from "react";
import { Zap, Search, Brain } from "lucide-react";

export type ResearchMode = "QUICK" | "CONTEXT" | "DEEP";

interface ModeToggleProps {
    value: ResearchMode;
    onChange: (mode: ResearchMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
    return (
        <div className="mode-toggle" role="group" aria-label="Research depth">
            {(["QUICK", "CONTEXT", "DEEP"] as ResearchMode[]).map((mode) => {
                const isActive = value === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(mode)}
                        className={`mode-toggle-btn${isActive ? " active" + (mode === "DEEP" ? " deep" : mode === "CONTEXT" ? " context" : "") : ""}`}
                    >
                        {mode === "QUICK" ? (
                            <><Zap size={14} className="opacity-70" /> Quick</>
                        ) : mode === "CONTEXT" ? (
                            <><Search size={14} className="opacity-70" /> Context</>
                        ) : (
                            <><Brain size={14} className="opacity-70" /> Deep</>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
