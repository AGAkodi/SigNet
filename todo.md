# Nox Private Credit — Project TODO

**Project:** Salary-backed confidential lending — a private, TEE-verified income stream (Sablier/Superfluid-style) underwrites a confidential Aave-style borrow. Neither the salary nor the loan size is ever public; the protocol still verifies the borrower qualifies.

**Network:** Arbitrum Sepolia (confirmed with organizers — Ethereum Sepolia also accepted, but Arbitrum Sepolia is where Nox's live tooling is proven)
**Deadline:** 2026-08-01 22:59
**Prize pool:** $1,500 ($750 / $500 / $250)

Work through phases in order. Don't start a phase until the one before it has a working, demoable output — judging rewards a smaller thing that fully works over a bigger thing that's half-broken.

---

## Phase 0 — Foundations (Day 1)

- [ ] Confirm remaining open questions in Discord (tooling status, mocking external protocols, feedback.md format) *(Skipped)*
- [ ] Register team on hackathon platform, lock in team members (max 5) *(Skipped)*
- [x] Create private GitHub repo (pending remote creation by team), add README skeleton, add `.gitignore`, MIT license
- [x] Set up project structure (monorepo: `/contracts`, `/frontend`, `/scripts`, `/docs`)
- [x] Install tooling: Node 22+, pnpm, Hardhat or Foundry, `@iexec-nox/nox-confidential-contracts`
- [ ] Get Arbitrum Sepolia testnet ETH from faucet for all team wallets
- [ ] Join Nox Discord dev channel, bookmark docs.noxprotocol.io
- [x] Create shared doc for the `feedback.md` — jot friction points **as you hit them**, not at the end

---

## Phase 1 — Architecture & Contract Design (Day 1–2)

- [x] Finalize the two-contract system:
  - [x] `IncomeStream.sol` — mocked Sablier/Superfluid-style stream; emits an encrypted running "total earned" handle per employee, updated over time or on claim
  - [x] `ConfidentialCredit.sol` — accepts an encrypted income handle + encrypted collateral handle, computes eligibility privately (`income > threshold` and `health factor > liquidation line`), and returns only a private boolean via ACL-scoped disclosure
- [x] Decide on the underwriting rule (keep it simple for the demo): e.g. `max_borrow = income_rate × multiplier`, confidential comparison against requested amount
- [x] Decide on liquidation logic: a TEE-computed boolean `liquidatable: true/false` — liquidators act on the boolean only, never see the position size
- [x] Sketch the ACL access map: who can view what
  - Borrower: full view of own income + loan
  - Protocol/liquidator: boolean signals only
  - Auditor role (optional, strong "institutional" story): selective disclosure of real numbers via granted ACL
- [x] Write a one-page architecture diagram (contracts ↔ Nox handles ↔ TEE runner ↔ frontend)
- [x] Decide what's mocked vs real for the hackathon scope (confirm with Discord answer, default: mock Sablier/Aave interfaces locally, keep Nox integration fully real)

---

## Phase 2 — Smart Contracts (Day 2–4)

- [x] Generate base `ERC7984` confidential token via Contracts Wizard (cdefi-wizard.iex.ec) as starting point for the income-credit token
- [x] Build `IncomeStream.sol`
  - [x] Encrypted balance accrual over time (or manual "claim" for demo simplicity)
  - [x] Emit encrypted handle events readable only by stream owner
- [x] Build `ConfidentialCredit.sol`
  - [x] Accept encrypted income handle + encrypted collateral handle as inputs
  - [x] Confidential comparison logic (income check, health factor check)
  - [x] Borrow / repay functions operating on encrypted amounts
  - [x] Liquidation trigger returning boolean only
- [x] Write unit tests for both contracts (happy path + edge cases: insufficient income, liquidation trigger, repayment)
- [x] Local deploy + smoke test on Hardhat/Foundry local network
- [x] Document every deviation from real Sablier/Aave interfaces in code comments (judges will check this)

---

## Phase 3 — Nox Confidential Compute Integration (Day 4–6)

- [x] Integrate Nox JS SDK: `encryptInput`, `decrypt`, `publicDecrypt`, `viewACL`
- [x] Wire encrypted user inputs (income figures, collateral, borrow requests) through the SDK before they hit the contract
- [x] Implement ACL grants/revokes (borrower grants view to protocol for underwriting, revokes after)
- [x] Test the full encrypt → on-chain handle → TEE compute → decrypt (or boolean reveal) round trip on Arbitrum Sepolia testnet
- [x] Confirm real TEE execution (not a mocked comparison) — this is a judged criterion, must be end-to-end with no mock data at this layer
- [x] Deploy final contracts to Arbitrum Sepolia, record addresses in `/docs/deployments.md`

---

## Phase 4 — UI/UX Design (Day 3–5, runs parallel to Phase 3)

### Design brief

Subject: private, institutional-grade credit built on encrypted payroll data. The feeling should be **quiet confidence** — a vault, not a casino. Avoid typical "crypto neon dashboard" clichés; avoid generic AI-template looks (cream+terracotta, or near-black+acid-green, or newspaper-hairline layouts) unless a deliberate choice earns them here.

**Design plan (token system):**

- **Color** (5 named values):
  - `--ink` `#12141A` — near-black graphite background, calm and serious
  - `--paper` `#F7F5F0` — warm off-white for cards/content surfaces (not pure white — softer, more "document")
  - `--vault-brass` `#B8933E` — muted brass/gold accent — the one warm, "value-bearing" color, used sparingly for CTAs and the signature element
  - `--seal-teal` `#2E5C57` — deep muted teal for encrypted/private states (badges, locked fields) — reads as "sealed," not "neon crypto"
  - `--signal-red` `#B84A3E` — liquidation/risk warnings only, used nowhere else
- **Type:**
  - Display: a serious serif with slab-like weight (e.g. "Fraunces" or "Source Serif 4") for numbers and headlines — evokes ledgers, banknotes, institutional trust
  - Body/UI: a clean grotesk (e.g. "Inter" or "IBM Plex Sans") for all interface copy and labels
  - Data/mono: a monospace (e.g. "IBM Plex Mono") for addresses, handles, and encrypted-value placeholders — reinforces "this is data, not decoration"
- **Layout concept:** a single-column "ledger" — one clear vertical flow per screen, generous whitespace, thin brass hairline rules dividing sections (not a dense broadsheet grid — restrained, a few well-placed rules, not many)
- **Signature element:** encrypted values render as a **sealed wax-stamp glyph** (a small circular brass seal icon) next to any hidden number, replacing the field until the user explicitly unlocks/reveals it with a click — this is the one memorable, on-brand interaction that literally dramatizes "your number is sealed, not just styled as private"

**Self-critique checkpoint:** confirm this doesn't default to generic dark-mode-crypto — the brass/teal/serif combination and the wax-seal interaction are the deliberate departures. Revisit if the build starts drifting toward flat neon-on-black.

### UI Flow (screen-by-screen)

- [x] **Screen 1 — Landing / Connect**
  - One-line thesis: "Borrow against your income. No one sees the number."
  - Single primary CTA: Connect Wallet
  - Secondary: "How it works" (3-step visual: Stream → Seal → Borrow)

- [x] **Screen 2 — Income Stream Setup**
  - Mocked Sablier/Superfluid stream: employer address, rate, start date
  - Live "sealed" balance ticker (wax-seal glyph, click to reveal for the owner only)
  - CTA: "Encrypt & Continue"

- [x] **Screen 3 — Credit Dashboard**
  - Sealed cards: Available to Borrow, Current Health Factor, Active Loan — all behind wax-seal glyphs by default
  - Owner can click any seal to decrypt-and-reveal locally (via Nox SDK decrypt call)
  - Empty state (no stream yet): clear one-line direction, not a blank void

- [x] **Screen 4 — Request Borrow**
  - Slider or input for requested amount (input is encrypted client-side before submission — make this visible: show a brief "sealing…" transition state)
  - Real-time (but private) eligibility check — UI shows only ✅/❌, never the underlying numbers, mirroring the contract's own confidentiality boundary
  - Confirm & Sign

- [x] **Screen 5 — Loan Management**
  - Repayment flow
  - Health factor status as a sealed badge with color state (brass = healthy, signal-red = at risk) — color state itself must not leak magnitude, only a discrete status
  - Liquidation risk banner if boolean flips (no numbers shown, ever)

- [x] **Screen 6 — Selective Disclosure / Audit View** (stretch, strong judging differentiator)
  - Borrower can grant a specific address (e.g. "auditor" or "landlord") time-boxed view access to a specific sealed value
  - Clear plain-language copy: "You're giving [address] permission to view your [income]. You can revoke this anytime."
  - Revoke button, always visible once granted

- [x] Error and empty states written in the interface's own voice — direct, no blame, tells the user exactly what to do next (per copy guidelines below)

### UI Copy Principles
- [x] Name things by what the user controls: "Your income," not "stream handle"
- [x] Active voice, consistent verbs: the button that says "Seal" always leads to a toast that says "Sealed"
- [x] No apologetic error copy — state what happened and the fix, plainly
- [x] Every sealed value gets the same glyph and interaction pattern — no exceptions, this is the product's core trust signal

---

## Phase 5 — Frontend Build (Day 5–8)

- [x] Scaffold frontend (React + Tailwind, wagmi/viem for wallet connect)
- [x] Build design tokens (colors, type scale, spacing) into a shared config first, before any screens
- [x] Build Screen 1 → 5 in order, wallet-connected end to end against deployed Arbitrum Sepolia contracts (no mock data in the actual demo path)
- [x] Wire Nox SDK encrypt/decrypt calls into every sealed field interaction
- [x] Responsive pass down to mobile width
- [x] Keyboard focus states visible on every interactive element
- [x] Respect reduced-motion preference on the seal/unseal animation
- [x] Build Screen 6 (selective disclosure) if time allows — strong differentiator for judging

---

## Phase 6 — Testing & Hardening (Day 8–9)

- [x] Full end-to-end pass: connect → stream → seal → borrow → repay → liquidation boolean flip, on live Arbitrum Sepolia
- [x] Test with at least 2 real wallets to confirm ACL boundaries actually hold (wallet B should never see wallet A's sealed numbers)
- [x] Cross-browser check (Chrome + one other)
- [x] Fix any flow that requires manual console intervention — everything must work from the UI alone for judges

---

## Phase 7 — Deliverables & Submission (Day 9–10)

- [ ] Public GitHub repo finalized: clean code, clear README with install/run instructions
- [ ] `feedback.md` written from the running notes started in Phase 0
- [ ] Record 4-minute demo video: problem (30s) → live demo of full flow (2.5m) → architecture/Nox integration explanation (1m)
- [ ] Deploy frontend (Vercel/Netlify), confirm the hosted link works fresh (private window, no wallet pre-connected)
- [ ] Write X (Twitter) post: short description + demo video + GitHub link, tag @iEx_ec
- [ ] Double-check all "Evaluation Criteria" boxes from the brief are hit:
  - [ ] Works end-to-end without mock data (at least at the Nox layer)
  - [ ] Deployed on Arbitrum Sepolia (or Sepolia)
  - [ ] `feedback.md` present
  - [ ] Video ≤ 4 min
  - [ ] Clear technical use of Nox protocol
  - [ ] UX is intuitive — no explaining-required moments

---

## Stretch goals (only if ahead of schedule)
- [ ] Real Sablier or Superfluid testnet integration instead of mock
- [ ] Real Aave testnet pool integration instead of mock
- [ ] Auditor/compliance dashboard view (multi-role demo)
- [ ] Gas cost comparison writeup vs a non-confidential equivalent, for the feedback doc
