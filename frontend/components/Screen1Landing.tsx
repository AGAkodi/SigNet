"use client";

import React, { useEffect, useRef, useState } from "react";
import { ScrambleCycle } from "./ScrambleCycle";

interface Screen1LandingProps {
  onConnect: () => void;
  onExplore: () => void;
}

// Custom Scroll Reveal wrapper using IntersectionObserver
const StorySection: React.FC<{
  children: React.ReactNode;
  id?: string;
  className?: string;
}> = ({ children, id, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      id={id}
      className={`transition-all duration-700 ease-out transform ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      } ${className}`}
    >
      {children}
    </div>
  );
};

// 01. STREAM — Animated SVG Line-Art Illustration (Cream Palette)
const StreamDiagram: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[220px] sm:min-h-[260px] flex items-center justify-center p-4 bg-[#E7E1D2] rounded-xl border border-cream-border relative overflow-hidden group shadow-inner">
      <svg
        viewBox="0 0 400 240"
        className="w-full h-full max-w-[360px] text-cream-text select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="streamGradCream" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9C7F30" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#1B1610" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#9C7F30" stopOpacity="0.5" />
          </linearGradient>
          <filter id="glowCream" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Grid Lines */}
        <path d="M 40 40 H 360 M 40 80 H 360 M 40 120 H 360 M 40 160 H 360 M 40 200 H 360" stroke="#D2C9B8" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M 80 20 V 220 M 160 20 V 220 M 240 20 V 220 M 320 20 V 220" stroke="#D2C9B8" strokeWidth="1" strokeDasharray="4 4" />

        {/* Primary Stream Flow Path */}
        <path
          d="M 50 120 C 120 40, 180 200, 250 120 C 290 80, 320 160, 350 120"
          stroke="url(#streamGradCream)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Flow Dots */}
        <circle cx="50" cy="120" r="4" fill="#9C7F30" filter="url(#glowCream)">
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        </circle>
        
        <circle cx="150" cy="140" r="3.5" fill="#1B1610">
          <animate attributeName="cx" values="100;250;100" dur="6s" repeatCount="indefinite" />
          <animate attributeName="cy" values="90;120;90" dur="6s" repeatCount="indefinite" />
        </circle>

        <circle cx="250" cy="120" r="5" fill="#9C7F30" filter="url(#glowCream)">
          <animate attributeName="r" values="4;6;4" dur="2.5s" repeatCount="indefinite" />
        </circle>

        <circle cx="350" cy="120" r="4" fill="#1B1610">
          <animate attributeName="r" values="3;5;3" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Node Labels */}
        <g textAnchor="middle" className="font-mono text-[10px]">
          <rect x="25" y="140" width="50" height="18" rx="4" fill="#EFE9DA" stroke="#C8C0B0" />
          <text x="50" y="152" fill="#1B1610" fontWeight="600">PAYROLL</text>

          <rect x="225" y="145" width="50" height="18" rx="4" fill="#EFE9DA" stroke="#9C7F30" />
          <text x="250" y="157" fill="#9C7F30" fontWeight="700">STREAM</text>

          <rect x="325" y="140" width="50" height="18" rx="4" fill="#EFE9DA" stroke="#C8C0B0" />
          <text x="350" y="152" fill="#1B1610" fontWeight="600">CIPHER</text>
        </g>
      </svg>
    </div>
  );
};

// 02. SEAL — Animated SVG Lock & Matrix Cipher Illustration (Cream Palette)
const SealDiagram: React.FC = () => {
  const [cipherText, setCipherText] = useState("0x9F82A4...B7C1");

  useEffect(() => {
    const chars = "0123456789ABCDEF8b9a7c";
    const interval = setInterval(() => {
      let res = "0x";
      for (let i = 0; i < 6; i++) {
        res += chars[Math.floor(Math.random() * chars.length)];
      }
      res += "...";
      for (let i = 0; i < 4; i++) {
        res += chars[Math.floor(Math.random() * chars.length)];
      }
      setCipherText(res);
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-[220px] sm:min-h-[260px] flex items-center justify-center p-4 bg-[#E7E1D2] rounded-xl border border-cream-border relative overflow-hidden group shadow-inner">
      <svg
        viewBox="0 0 400 240"
        className="w-full h-full max-w-[360px] text-cream-text select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Vault Box */}
        <rect x="60" y="30" width="280" height="180" rx="12" stroke="#C8C0B0" strokeWidth="1.5" fill="#EFE9DA" />
        <rect x="75" y="45" width="250" height="150" rx="8" stroke="#D8D0BF" strokeWidth="1" fill="#E2DAC9" />

        {/* Lock Motif Center */}
        <g transform="translate(200, 95)" textAnchor="middle">
          {/* Shackle */}
          <path d="M -18 -5 V -20 C -18 -32, 18 -32, 18 -20 V -5" stroke="#1B1610" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Body */}
          <rect x="-30" y="-5" width="60" height="45" rx="6" fill="#EFE9DA" stroke="#1B1610" strokeWidth="1.5" />
          {/* Keyhole */}
          <circle cx="0" cy="12" r="4" fill="#9C7F30" />
          <path d="M -2 12 L -3 22 H 3 L 2 12 Z" fill="#9C7F30" />
        </g>

        {/* Encrypted Living Cipher Bar */}
        <g transform="translate(200, 165)" textAnchor="middle">
          <rect x="-100" y="-12" width="200" height="24" rx="6" fill="#EFE9DA" stroke="#9C7F30" strokeWidth="1" />
          <text x="0" y="4" className="font-mono text-xs fill-cream-text font-bold tracking-widest">
            {cipherText}
          </text>
        </g>
      </svg>
    </div>
  );
};

// 03. BORROW — Animated SVG TEE Enclave Shield & Boolean Verdict Illustration (Cream Palette)
const BorrowDiagram: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[220px] sm:min-h-[260px] flex items-center justify-center p-4 bg-[#E7E1D2] rounded-xl border border-cream-border relative overflow-hidden group shadow-inner">
      <svg
        viewBox="0 0 400 240"
        className="w-full h-full max-w-[360px] text-cream-text select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Concentric Enclave Shield Rings */}
        <circle cx="200" cy="115" r="75" stroke="#C8C0B0" strokeWidth="1" strokeDasharray="6 6">
          <animateTransform attributeName="transform" type="rotate" from="0 200 115" to="360 200 115" dur="25s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="115" r="55" stroke="#9C7F30" strokeWidth="1.5" strokeOpacity="0.5" />

        {/* Shield Icon */}
        <path
          d="M 200 65 L 240 85 V 125 C 240 150, 200 170, 200 170 C 200 170, 160 150, 160 125 V 85 Z"
          fill="#EFE9DA"
          stroke="#1B1610"
          strokeWidth="2"
        />

        {/* Boolean Verdict Checkmark */}
        <path
          d="M 185 115 L 196 126 L 218 104"
          stroke="#9C7F30"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Enclave Hardware Badge */}
        <g transform="translate(200, 195)" textAnchor="middle">
          <rect x="-85" y="-10" width="170" height="20" rx="4" fill="#EFE9DA" stroke="#C8C0B0" strokeWidth="1" />
          <text x="0" y="4" className="font-mono text-[10px] fill-cream-text font-semibold tracking-wider">
            VERDICT: HEALTHY (TRUE)
          </text>
        </g>
      </svg>
    </div>
  );
};

export const Screen1Landing: React.FC<Screen1LandingProps> = ({
  onConnect,
  onExplore,
}) => {
  const scrollToStories = () => {
    const el = document.getElementById("story-sections");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      onExplore();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16 sm:space-y-24">
      {/* Hero Section (Preserved Dark Mist Palette) */}
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto pt-4">
        {/* Badge Header */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-mist-900 border border-mist-700 rounded-full text-xs font-mono text-halo-DEFAULT mb-8 shadow-panel">
          <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
          <span>Confidential Credit Vault</span>
          <span className="text-mist-500">•</span>
          <span className="text-patina-300">Arbitrum Sepolia TEE</span>
        </div>

        {/* Thesis Headline with ScrambleCycle */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-halo-soft max-w-3xl leading-tight mb-6">
          Borrow against your income. <br />
          <ScrambleCycle
            words={[
              "No one sees the number.",
              "Fully Encrypted.",
              "TEE Verified.",
              "Zero On-Chain Leakage.",
            ]}
            className="italic text-patina-300"
          />
        </h1>

        {/* Narrative Subtitle */}
        <p className="text-base sm:text-lg text-halo-dim max-w-2xl mb-10 leading-relaxed font-sans">
          Salary-backed institutional lending powered by Nox TEE confidential compute.
          Your payroll streaming data underwrites loan eligibility without ever exposing salary magnitude or debt size on-chain.
        </p>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <button
            onClick={onConnect}
            className="w-full sm:w-auto px-8 py-3.5 bg-patina-400 hover:bg-patina-500 text-mist-950 font-semibold text-xs font-mono rounded-lg transition-all shadow-panel focus:outline-none focus:ring-1 focus:ring-patina-300"
          >
            Connect Wallet & Open Vault
          </button>
          <button
            onClick={scrollToStories}
            className="w-full sm:w-auto px-6 py-3.5 bg-mist-900 hover:bg-mist-850 text-halo-soft border border-mist-700 font-mono text-xs rounded-lg transition-colors"
          >
            How It Works (3-Step Architecture)
          </button>
        </div>
      </div>

      {/* Expanded 3-Story Sections Container — Wraith Warm Cream Panel Treatment */}
      <div
        id="story-sections"
        className="w-full bg-cream text-cream-text rounded-3xl p-6 sm:p-10 md:p-14 border border-cream-border shadow-2xl space-y-10 sm:space-y-14 my-8 transition-colors"
      >
        
        {/* STORY 01 — STREAM */}
        <StorySection>
          <div className="rounded-2xl bg-cream-card border border-cream-border p-6 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Narrative Text */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-mono tracking-widest text-cream-muted uppercase font-semibold">
                01. STREAM — PAYROLL → SEALED HANDLE
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold leading-snug text-cream-text">
                Continuous income streaming replaces static payroll.{" "}
                <span className="text-cream-muted font-normal block mt-1">
                  Real-time earned value emitted directly to chain.
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-cream-text/90 leading-relaxed font-sans">
                Sablier and Superfluid-style payroll streams emit continuous on-chain handles representing real-time earned income.
                Rather than relying on outdated paper pay stubs or delayed monthly bank statements, SigNet taps into active payroll flows as they accrue per second.
                This turns static employment verification into a dynamic, tamper-proof income signal.
              </p>
              <div className="pt-2 text-xs font-mono text-cream-muted tracking-wider font-medium">
                [ SABLIER · SUPERFLUID · REAL-TIME ]
              </div>
            </div>

            {/* Right Column: Animated Line-Art Diagram */}
            <div className="lg:col-span-5 w-full">
              <StreamDiagram />
            </div>
          </div>
        </StorySection>

        {/* STORY 02 — SEAL */}
        <StorySection>
          <div className="rounded-2xl bg-cream-card border border-cream-border p-6 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Narrative Text */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-mono tracking-widest text-cream-muted uppercase font-semibold">
                02. SEAL — PUBLIC LEDGER → SHIELDED LAYER
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold leading-snug text-cream-text">
                Public chains remember everything.{" "}
                <span className="text-cream-muted font-normal block mt-1">
                  The shielded layer forgets.
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-cream-text/90 leading-relaxed font-sans">
                The Nox JS SDK encrypts raw salary stream figures client-side before any data leaves your browser.
                Encrypted handles render as living scrambled cipher glyphs that can only be unsealed with your private key.
                Your earnings remain completely confidential on public ledgers while preserving full cryptographic provability.
              </p>
              <div className="pt-2 text-xs font-mono text-cream-muted tracking-wider font-medium">
                [ NOX SDK · CLIENT-SIDE · LIVING CIPHER ]
              </div>
            </div>

            {/* Right Column: Animated Line-Art Diagram */}
            <div className="lg:col-span-5 w-full">
              <SealDiagram />
            </div>
          </div>
        </StorySection>

        {/* STORY 03 — BORROW */}
        <StorySection>
          <div className="rounded-2xl bg-cream-card border border-cream-border p-6 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Narrative Text */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-mono tracking-widest text-cream-muted uppercase font-semibold">
                03. BORROW — TEE COPROCESSOR → BOOLEAN VERDICT
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold leading-snug text-cream-text">
                Solvency verified inside TEE enclaves.{" "}
                <span className="text-cream-muted font-normal block mt-1">
                  Zero exposure of salary magnitude or debt.
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-cream-text/90 leading-relaxed font-sans">
                The Arbitrum Sepolia TEE coprocessor evaluates borrowing capacity and health factors privately within hardware-secured enclaves.
                The enclave inspects encrypted income handles and debt balances to emit a discrete boolean verdict.
                The protocol enforces institutional solvency without ever learning the borrower's actual salary or total debt.
              </p>
              <div className="pt-2 text-xs font-mono text-cream-muted tracking-wider font-medium">
                [ ARBITRUM SEPOLIA · TEE ENCLAVE · ZERO-LEAKAGE ]
              </div>
            </div>

            {/* Right Column: Animated Line-Art Diagram */}
            <div className="lg:col-span-5 w-full">
              <BorrowDiagram />
            </div>
          </div>
        </StorySection>

      </div>

      {/* STORY 04 — BOTTOM CALLOUT (DARK PALETTE FOR ALTERNATING RHYTHM) */}
      <StorySection className="w-full">
        <div className="card text-center p-8 sm:p-12 space-y-6">
          <div className="eyebrow-tag mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
            <span>[ READY TO UNDERWRITE ]</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft max-w-2xl mx-auto">
            Enter the confidential credit engine on Arbitrum Sepolia.
          </h2>
          <p className="text-xs sm:text-sm text-halo-dim max-w-xl mx-auto font-sans leading-relaxed">
            Connect your Web3 wallet, encrypt your payroll income stream with Nox TEE primitives, and unlock confidential credit lines in seconds.
          </p>
          <div className="pt-2">
            <button onClick={onConnect} className="btn-primary">
              Connect Wallet & Open Vault
            </button>
          </div>
        </div>
      </StorySection>
    </div>
  );
};
