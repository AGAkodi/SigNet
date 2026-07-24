"use client";

import React, { useState, useEffect, useRef } from "react";

interface ScrambleCycleProps {
  words: string[];
  className?: string;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>[]{}?";

export const ScrambleCycle: React.FC<ScrambleCycleProps> = ({
  words,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayWord, setDisplayWord] = useState(words[0] || "");
  const animFrameRef = useRef<number | null>(null);
  const isReducedMotionRef = useRef<boolean>(false);

  const getRandomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      isReducedMotionRef.current = mediaQuery.matches;
    }

    if (words.length <= 1) return;

    const holdDuration = 2000; // ms to display word
    const transitionDuration = 900; // ms to scramble transition

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % words.length;
      const targetWord = words[nextIndex];
      const sourceWord = words[currentIndex];

      if (isReducedMotionRef.current) {
        setCurrentIndex(nextIndex);
        setDisplayWord(targetWord);
        return;
      }

      // Start 900ms scramble transition to targetWord
      const startTime = performance.now();
      const maxLen = Math.max(sourceWord.length, targetWord.length);

      const delays = Array.from({ length: maxLen }, (_, i) => {
        const ratio = maxLen > 1 ? i / (maxLen - 1) : 0;
        return Math.min(transitionDuration - 100, ratio * 500 + Math.random() * 200);
      });

      let lastTick = performance.now();

      const animateTransition = (now: number) => {
        const elapsed = now - startTime;
        const isTick = now - lastTick >= 40;

        if (isTick) {
          lastTick = now;
        }

        let result = "";
        let allDone = true;

        for (let i = 0; i < targetWord.length; i++) {
          if (elapsed >= delays[i] || elapsed >= transitionDuration) {
            result += targetWord[i];
          } else {
            allDone = false;
            result += getRandomGlyph();
          }
        }

        setDisplayWord(result);

        if (!allDone && elapsed < transitionDuration + 50) {
          animFrameRef.current = requestAnimationFrame(animateTransition);
        } else {
          setDisplayWord(targetWord);
          setCurrentIndex(nextIndex);
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(animateTransition);
    }, holdDuration + transitionDuration);

    return () => {
      clearInterval(interval);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentIndex, words]);

  return (
    <span className={`inline-block font-display ${className}`}>
      {displayWord}
    </span>
  );
};
