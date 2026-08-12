/**
 * ui/ModeToggle.tsx — Auto / Quick / Context / Deep segmented control pill.
 */
"use client";
import React from "react";
import { Zap, Search, Brain, Sparkles } from "lucide-react";

export type ResearchMode = "AUTO" | "QUICK" | "CONTEXT" | "DEEP";

interface ModeToggleProps {
    value: ResearchMode;
    onChange: (mode: ResearchMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
    return (
        <div className="mode-toggle" role="group" aria-label="Research depth">
            {(["AUTO", "QUICK", "CONTEXT", "DEEP"] as ResearchMode[]).map((mode) => {
                const isActive = value === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(mode)}
                        className={`mode-toggle-btn${isActive ? " active" + (mode === "DEEP" ? " deep" : mode === "CONTEXT" ? " context" : mode === "AUTO" ? " auto" : "") : ""}`}
                    >
                        {mode === "AUTO" ? (
                            <><Sparkles size={14} className="opacity-70" /> Auto</>
                        ) : mode === "QUICK" ? (
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
