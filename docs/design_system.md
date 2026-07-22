# Nox Private Credit — UI/UX Design System & Specification

## 1. Design Thesis: "Quiet Confidence"
Nox Private Credit is an institutional-grade vault for private, income-backed borrowing. The interface rejects typical "neon crypto casino" aesthetics and generic AI-template looks. It feels like a high-security private bank ledger—deliberate, restrained, and authoritative.

---

## 2. Design Tokens System

### 2.1 Core Color System (5 Named Tokens)
```css
:root {
  /* Graphite background — calm and serious */
  --ink: #12141A;
  
  /* Warm off-white content surfaces */
  --paper: #F7F5F0;
  
  /* Muted brass accent — value-bearing CTAs & signature wax seal */
  --vault-brass: #B8933E;
  
  /* Deep muted teal — sealed / encrypted handles & badges */
  --seal-teal: #2E5C57;
  
  /* Liquidation & high risk warning ONLY */
  --signal-red: #B84A3E;

  /* Derived System Tokens */
  --ink-surface: #1A1D26;
  --paper-text: #12141A;
  --paper-muted: #6B7280;
  --brass-glow: rgba(184, 147, 62, 0.15);
  --teal-glow: rgba(46, 92, 87, 0.2);
}
```

### 2.2 Typography Scale
- **Display / Headlines:** `Source Serif 4`, serif slab-weight (28px - 44px). Evokes banknotes, institutional trust, and balance ledgers.
- **Body / Labels:** `Inter` or `IBM Plex Sans` (14px - 16px). Clean grotesk readability.
- **Data / Handles:** `IBM Plex Mono` (12px - 14px). Monospace for hex handles, addresses, and sealed placeholders.

---

## 3. Signature Element: The Sealed Wax-Stamp Glyph

The core brand interaction is the **Sealed Wax-Stamp Glyph** (`<WaxSealValue />`).

```
+-------------------------------------------------------------+
| Available to Borrow                                         |
| [ 🪙 SEALED ] ••••••••••••  [ Click to Unseal ]             |
+-------------------------------------------------------------+
```

### Behavior & Interaction Protocol:
1. **Default State (Sealed):**
   - The value is rendered as a circular brass wax-seal icon next to masked data points (`••••••••••••`).
   - Styled with `--seal-teal` background, `--vault-brass` border, and monospace handle placeholder.
2. **Click / Reveal Interaction:**
   - Triggers client-side Nox SDK `decrypt(handle, signer)` call.
   - Micro-animation: A subtle 300ms wax-unseal transition reveals the local dollar amount.
   - Respects `prefers-reduced-motion` settings.
3. **Copy Consistency:**
   - Button states: `Seal` → `Sealed` → `Unseal` → `Unsealed`.

---

## 4. UI Flow & Screen Architecture (Screens 1 – 6)

### Screen 1 — Landing / Connect
- **Headline:** *"Borrow against your income. No one sees the number."*
- **Primary Action:** `[ Connect Wallet ]` (Brass button with subtle glow)
- **Visual:** 3-step Ledger Flow (`Income Stream` → `Wax Seal` → `Confidential Borrow`).

### Screen 2 — Income Stream Setup
- **Mocked Sablier/Superfluid Stream:** Employer wallet address, monthly salary rate input, start date.
- **Live Sealed Ticker:** Encrypted balance handle accrual.
- **CTA:** `[ Encrypt & Continue ]`

### Screen 3 — Credit Dashboard (Main Vault Ledger)
- **Cards:**
  - `Available to Borrow` (Sealed by default)
  - `Health Factor Status` (Sealed status badge: Brass = Healthy, Red = At Risk)
  - `Active Loan Balance` (Sealed by default)
- **Owner Action:** Click wax-seal on any card to decrypt locally.

### Screen 4 — Request Borrow
- **Controls:** Requested borrow slider with live range limit ($1,000 to $50,000).
- **Transition State:** Showing `Sealing input...` step animation during Nox client-side encryption.
- **Private Eligibility Indicator:** Displays ✅ `Qualifies (TEE Verified)` or ❌ `Insufficient Capacity` (numbers remain 100% hidden).

### Screen 5 — Loan Management
- **Repayment Panel:** Repay principal input operating on encrypted handles.
- **Health Factor Badge:** Discrete color status without leaking exact position magnitude.
- **Liquidation Banner:** Appears only when `liquidatable: true` boolean signal is emitted.

### Screen 6 — Selective Disclosure / Audit View (Stretch)
- **Permission Panel:** Borrower can grant time-boxed view access to auditor/landlord address.
- **Copy:** *"You're giving [address] permission to view your [income]. You can revoke this anytime."*
- **Control:** `[ Revoke View Access ]` button with active ACL status table.
