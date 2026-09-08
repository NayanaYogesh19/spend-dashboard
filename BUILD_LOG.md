# Spendy (SpendControl) — Build Log

Brief record of what the app is, how it was set up, and every change made in this session.

## What it is

A finance-ops single-page app for a digital marketing agency: employees submit purchase
requests, managers approve them, finance verifies and releases OTPs, employees report back
actual purchase details, and finance reconciles the resulting credit card statement against
the requests each month. Also tracks recurring subscriptions, client ad spend, and rolls
everything up into client billing.

**Stack:** React 19 + TypeScript, Vite 6, Tailwind CSS v4, lucide-react icons.
**Persistence:** client-side only — `src/hooks/useStore.ts` keeps all state in `localStorage`
under the key `spendy_data`. No backend, no auth, single browser = single source of truth.
**Origin:** scaffolded from Google AI Studio (`metadata.json`, `.env.example` reference a
`GEMINI_API_KEY`), though no Gemini calls are currently wired into the UI.

## Environment setup (this machine)

The machine had no Node.js/npm/Homebrew at all.

- Homebrew install needs sudo/admin rights — not available non-interactively, so skipped.
- Installed **nvm** instead (no sudo required): cloned to `~/.nvm`, hooked into `~/.zshrc`.
- Installed **Node v24.20.0 / npm v11.19.0** via `nvm install --lts`.
- Ran `npm install` for project dependencies.
- Installed **Playwright + Chromium** (via `npx playwright install chromium`) to drive the
  app headlessly and screenshot changes for verification, since `chromium-cli` wasn't
  available on this machine.

**Start the dev server:**
```bash
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd "/Users/umeshbhat/Documents/Claude project/finance_tracker_reconciliation"
npm run dev
```
App runs at `http://localhost:3000`.

**Stop it:**
```bash
lsof -ti:3000 -sTCP:LISTEN | xargs kill
```

## App structure

| View | Route in UI | Purpose |
|---|---|---|
| `DashboardView` | Dashboard | Reconciliation summary, subscription intelligence, client billing rollup, month closure |
| `EmployeeView` | Requester | Submit new purchase requests, track status, report actual purchase details post-approval |
| `ManagerView` | Approvals | Review, approve, or reject pending requests |
| `FinanceView` | Finance | Verify a Purchase ID before releasing an OTP; track requests awaiting purchase completion |
| `RegistersView` | Registers | Master logs: one-time purchases, subscriptions, ad spend |
| `ReconciliationView` | Reconciliation | Import bank statement rows, auto-match to purchases/subscriptions, manually resolve the rest |

**Data model** (`src/types.ts`): `PurchaseRequest` moves through a status lifecycle —
Draft → Submitted/Pending Approval → Approved → OTP Requested/Verified → Awaiting Purchase
Completion → Purchase Completed → Pending Bank Amount Confirmation → Ready for
Reconciliation → Reconciled (or Rejected/Cancelled/Purchase Failed along the way). Approved
purchases fan out into `PurchaseRecord`, `SubscriptionRecord`, or `AdSpendRecord` depending on
`purchaseType`. Bank statement rows become `BankTransaction`s with a matching engine that
scores confidence (exact INR match → exact vendor amount match → active subscription match)
and assigns a `MatchStatus`.

## Changes made this session

1. **Got the app running** — installed the toolchain above, started the Vite dev server,
   verified all six views render and navigate cleanly with a headless-browser pass (zero
   console errors).

2. **Git hygiene** — committed and pushed `package-lock.json` (from `npm install`) and an
   empty `requirements.txt` to `origin/main` at the user's request.

3. **Requester → New Request form rework** (`src/views/EmployeeView.tsx`,
   `src/views/ManagerView.tsx`, `src/types.ts`):
   - POD options replaced with the agency's actual pods: `Beacons`, `Nexus`, `Elite`,
     `Dyotha`, `Alpha`, `Ajna`, `TD Internal`.
   - **Purpose** field removed.
   - New **Account Name / Client Name** field added in its place — one field, label and
     placeholder switch based on the Internal/Client toggle (`Account Name` vs `Client
     Name`), removing the old duplicate Client Name field that only appeared for Client
     Expense.
   - **Card Required** field removed from the form — it's still set automatically behind the
     scenes based on the Internal/Client toggle (unchanged downstream behavior).
   - **Currency** now defaults to **INR**, and the amount field's prefix symbol switches with
     the selected currency (₹ / $ / € / £ / A$ / C$) instead of a hardcoded `$`.
   - `PurchaseRequest.purpose` made optional in the shared type since it's no longer
     collected; Manager's approval card now shows "Account Name"/"Client Name" where it used
     to show "Purpose".

4. **Finance → Purchase Completions**: removed the **Bank INR** column and its inline
   pencil-to-edit affordance (`editingInrReqId`/`financeInrAmount`/`submitFinanceInr`), which
   is now dead code, per request.

5. **Reconciliation table**: added an inline **Confirm** action next to the status badge for
   any merchant row with a suggested match, so a match can be confirmed (locks it to
   `Matched` / High / 100%) directly from the table instead of requiring the side panel.

All changes verified with `tsc --noEmit` (clean) and a scripted Playwright pass through the
full lifecycle (submit → approve → OTP → complete → reconcile) with screenshots and a
console-error check at each step.

## Known gaps / things to flag

- **No backend, no auth, no multi-user support** — this is a client-only demo. Manager/
  Finance actions hardcode a name (`"Sarah Chen (Director)"`, `"Finance Admin"`) rather than
  reading a logged-in user.
- **Gemini API key referenced but unused** — `.env.example` and `metadata.json` reference
  `GEMINI_API_KEY`/`majorCapabilities: SERVER_SIDE_GEMINI_API`, but no AI feature currently
  calls it.
- **Currency conversion is manual** — INR bank amounts and foreign vendor currencies are
  entered by hand at each step (employee completion form, and previously Finance's now-
  removed Bank INR edit); there's no live FX conversion.
- **Reconciliation matching is heuristic** — string-matching on vendor names, exact/near
  amount matches, and a handful of hardcoded merchant aliases (DigitalOcean, OpenAI, Adobe,
  Waalaxy, Anthropic). No fuzzy matching beyond that.
