"use client";

import React, { useState, useEffect, useRef } from "react";

interface ScrambleNumberProps {
  value: string;
  revealed: boolean;
  className?: string;
  placeholderLength?: number;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>{}" ;

export const ScrambleNumber: React.FC<ScrambleNumberProps> = ({
  value,
  revealed,
  className = "",
  placeholderLength,
}) => {
  const targetLength = value ? value.length : placeholderLength || 10;
  const [displayText, setDisplayText] = useState<string>("");
  const animFrameIdRef = useRef<number | null>(null);
  const isReducedMotionRef = useRef<boolean>(false);

  // Helper to get random glyph
  const getRandomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

  // Helper to generate full random string
  const getRandomString = (len: number) => {
    let res = "";
    for (let i = 0; i < len; i++) {
      res += getRandomGlyph();
    }
    return res;
  };

  useEffect(() => {
    // Detect prefers-reduced-motion preference
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      isReducedMotionRef.current = mediaQuery.matches;
    }

    // If reduced motion is enabled, snap directly without animation
    if (isReducedMotionRef.current) {
      if (revealed) {
        setDisplayText(value);
      } else {
        setDisplayText("█".repeat(targetLength));
      }
      return;
    }

    // Cancel any existing animation frame loop
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (!revealed) {
      // Living Cipher Effect: continuously reshuffle random glyphs every 120ms
      let lastTick = performance.now();
      setDisplayText(getRandomString(targetLength));

      const continuousLoop = (now: number) => {
        if (now - lastTick >= 120) {
          setDisplayText(getRandomString(targetLength));
          lastTick = now;
        }
        animFrameIdRef.current = requestAnimationFrame(continuousLoop);
      };

      animFrameIdRef.current = requestAnimationFrame(continuousLoop);
    } else {
      // Reveal Animation: staggered per-character resolution over ~780ms
      const startTime = performance.now();
      const totalDuration = 780; // ms
      const valLen = value.length;

      const charDelays = Array.from({ length: valLen }, (_, i) => {
        const charRatio = valLen > 1 ? i / (valLen - 1) : 0;
        const baseDelay = charRatio * 450;
        const jitter = Math.random() * 180;
        return Math.min(totalDuration - 50, baseDelay + jitter);
      });

      let lastScrambleTick = performance.now();

      const animateReveal = (now: number) => {
        const elapsed = now - startTime;
        const isTick = now - lastScrambleTick >= 40;

        if (isTick) {
          lastScrambleTick = now;
        }

        let result = "";
        let allResolved = true;

        for (let i = 0; i < valLen; i++) {
          const char = value[i];
          if (elapsed >= charDelays[i] || elapsed >= totalDuration) {
            result += char;
          } else {
            allResolved = false;
            result += isTick ? getRandomGlyph() : displayText[i] || getRandomGlyph();
          }
        }

        setDisplayText(result);

        if (!allResolved && elapsed < totalDuration + 50) {
          animFrameIdRef.current = requestAnimationFrame(animateReveal);
        } else {
          setDisplayText(value);
          animFrameIdRef.current = null;
        }
      };

      animFrameIdRef.current = requestAnimationFrame(animateReveal);
    }

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [revealed, value, targetLength]);

  return (
    <span
      className={`font-mono inline-block tracking-wider select-none ${className}`}
      aria-label={revealed ? value : "Sealed Encrypted Value"}
    >
      {displayText}
    </span>
  );
};
