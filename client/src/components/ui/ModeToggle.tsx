/**
 * ui/ModeToggle.tsx — Quick / Deep segmented control pill.
 */
"use client";
import React from "react";

export type ResearchMode = "QUICK" | "DEEP";

interface ModeToggleProps {
    value: ResearchMode;
    onChange: (mode: ResearchMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
    return (
        <div className="mode-toggle" role="group" aria-label="Research depth">
            {(["QUICK", "DEEP"] as ResearchMode[]).map((mode) => {
                const isActive = value === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(mode)}
                        className={`mode-toggle-btn${isActive ? " active" + (mode === "DEEP" ? " deep" : "") : ""}`}
                    >
                        {mode === "QUICK" ? (
                            <><span aria-hidden>⚡</span> Quick</>
                        ) : (
                            <><span aria-hidden>🧠</span> Deep</>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
