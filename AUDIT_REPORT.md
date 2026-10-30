# Spendy: Workflow Audit for Trilliant Customization

**Date:** 30 Oct 2026 · **Branch audited:** `feat/supabase-sync` · **Application code changed:** none

## How this audit was done

| Evidence type | What it means here |
|---|---|
| **Code inspection** | Read every file listed in the brief: all 6 views, `useStore.ts`, `types.ts`, `recurringMatch.ts`, `api/state.ts`, `src/sync/collections.ts`, `supabase/schema.sql` |
| **Runtime: isolated** | Drove the real app UI in a browser (form fills, clicks, page reload, two tabs at once) against an **in-memory stand-in for `/api/state`** that follows the same upsert-by-id rules as `api/state.ts`. Production Supabase was **not** written to. |
| **Runtime: real Supabase (read-only)** | `GET /api/state` against the real database from the Vercel preview and from `vercel dev`: all 8 tables read successfully, and **all 8 are empty (0 rows)**. |
| **Not verified** | Anything that needs a write to the real Supabase. The `POST` path of `api/state.ts` has never run against the real database. |

The project has **no automated tests** (no test script or test files).

---

## Audit table

| # | Module | Existing behavior | Expected behavior | Status | Issue | Recommended fix |
|---|---|---|---|---|---|---|
| 1 | Request form (`EmployeeView`) | Fields: Requester, Pod (required), Tool/Vendor (one field), Internal/Client toggle, Account/Client name (required), Category, Amount, Currency, Type (One-time / Recurring / Ad Spend), Frequency, Expected date, Notes. **Runtime:** 3 requests created and stored correctly. | Tool, Vendor, Purpose, Cost, Currency, One-time/Recurring, Pod **or** Practice, optional Client | PARTIALLY WORKING | No **Purpose** field (removed earlier; `purpose?` is unused in `types.ts`). Tool and Vendor are one field. No **Practice**. Pod is mandatory. An account name is required even for internal spend. | Add `purpose`, a separate `vendor`, `ownerType` (Pod / Practice), `practice`; make pod and client optional per the rules in §B |
| 2 | Pod list | `Beacons, Nexus, Elite, Dyotha, Alpha, Ajna, TD Internal` hardcoded in `EmployeeView.tsx:11` | Beacon, Nexus, Elite, Dyotha, each with a named head | PARTIALLY WORKING | "Beacons" ≠ "Beacon". Alpha, Ajna and TD Internal aren't Trilliant pods. No pod heads anywhere. | One shared org config (pods + heads, practices, client → pod map) |
| 3 | Practices | None | 7 shared practices; a purchase can belong to a practice only | NOT IMPLEMENTED | **Runtime:** a practice-only purchase had to be filed under pod "TD Internal" with the practice typed into "Account Name" as free text | Add practice to the type and form; validate "pod or practice required" |
| 4 | Client → pod link | Client is free text; pod is picked separately | Client (e.g. Manch Technologies) belongs to Beacon regardless of the purchaser's practice | NOT IMPLEMENTED | Nothing links a client to its pod, so example 1 relies on the user picking the right pod by hand | Client list with its owning pod; fill in the pod when a client is chosen |
| 5 | Approval routing (`ManagerView`) | One shared queue shows every pending request. Approver name hardcoded to "Sarah Chen (Director)". | Route to Pod Head / Practice Head / Management by unit and rules | NOT IMPLEMENTED | No routing, no approver per unit, no amount thresholds | Work out the required approver from the org config; show it on the card; record which role approved |
| 6 | Approve / reject | **Runtime:** Approve sets `Approved`, a `PUR-` id, approver and time. Reject sets `Rejected` with no id. | Same | PASS | Not role-checked (no auth; out of scope) | — |
| 7 | Purchase ID generation | `PUR-YYYY-` + random 1–9999; `SUB-YYYY-` + random 1–999 (`useStore.ts`) | Unique IDs | FAIL (code inspection) | No uniqueness check. About 71% chance of a repeat after 50 subscriptions (birthday maths), and about 12% after 50 purchases. A repeated SUB id makes Confirm roll dates on **both** subscriptions (`confirmTransactionMatch` matches on `subscriptionId`), and Finance search returns the first match. | Generate the next sequential id from existing records, or a longer random id with a collision check |
| 8 | Finance OTP (`FinanceView`) | **Runtime:** search by PUR id, then "Provide OTP" sets `Awaiting Purchase Completion` | Only approved requests get an OTP | PASS | — | — |
| 9 | Finance bank INR confirmation | `updateBankAmount` exists in the store and is passed to `FinanceView`, but **nothing calls it** | Finance confirms the bank INR amount | NOT IMPLEMENTED | Bank verification status stays `Pending` for ever; `Finance Confirmed` can't be reached from the UI | Add an inline "Confirm bank INR" action in Purchase Completions |
| 10 | Purchase completion | **Runtime:** completed one-time purchase created a `purchases` record; completed recurring purchase created a `subscriptions` record | Record actual amount, date, purchased by, vendor, payment reference, invoice details, subscription details | PARTIALLY WORKING | No **payment reference**. Invoice is only a checkbox (`invoiceNumber`/`invoiceDate` exist in the type but not in the form). "Purchased by" is assumed to be the requester. | Add the missing fields to the completion form and copy them into the records |
| 11 | Failed / cancelled purchase | **Runtime:** completing with "Payment Failed" set the request to **`Purchase Completed`** | Should become `Purchase Failed` / `Cancelled` | FAIL | `completePurchase` always sets `Purchase Completed` | Set the status from `details.purchaseStatus` |
| 12 | Purchase record fields | **Runtime:** the created purchase has **no `status`** field | Status shown in Registers | FAIL | The Registers status badge is blank for every purchase created this way | Set `status` when creating the record |
| 13 | Subscription from completion | **Runtime:** created with `startDate`, but **no `nextExpectedCharge`** or `lastChargedDate` | Next charge known for tracking | PARTIALLY WORKING | Registers shows "—" for Next Payment until the first confirmed bank match | Set `nextExpectedCharge = start + 1 cycle` on creation |
| 14 | Past Decisions list (`ManagerView`) | **Runtime:** every status except `Approved` shows a red ✕, including `Purchase Completed` | Accurate result badge | FAIL | Misleading: completed purchases look rejected | Show red only for Rejected / Failed / Cancelled |
| 15 | Draft requests | "Save as Draft" stores a `Draft`. No screen can open, edit or submit a draft. Drafts skip required-field checks. | Drafts can be finished later | PARTIALLY WORKING (code inspection) | Drafts are a dead end | Add "Edit / Submit" for drafts, or remove the button |
| 16 | Storage in Supabase | Every change is sent to `/api/state`, which upserts into Supabase | Completed purchases permanently stored | NOT VERIFIED | Real database: read works, but **0 rows**, so no write has ever reached it. Isolated runtime: writes and reload work. | Run one controlled write test (see §E) |
| 17 | Persistence after refresh | **Runtime (isolated):** after a reload with localStorage empty, all records came back from the API | Data survives refresh | PASS (isolated) / NOT VERIFIED (real DB) | Same caveat as #16 | — |
| 18 | Two people editing at once | **Runtime:** tab A saved a subscription note; tab B (loaded earlier) then deactivated the same subscription. **Tab A's note was erased.** | No silent loss of other people's changes | FAIL | Each save replaces the whole record ("last write wins") with no version check | Send `updated_at` with each record; the API rejects stale saves (409) and the app reloads that record. Uses the existing column; no new table. |
| 19 | Statement import | **Runtime:** pasted tab-separated rows were parsed into Merchant / Fee / Tax rows and stored | Import last month's statement | PARTIALLY WORKING | Paste only, in a fixed 6-column, MM/DD/YYYY format; no file upload. `IGST ON DCC FEE` was classified as **Fee**, not Tax (the "dcc fee" check runs first). Fee rows get `parentTransactionId: 'pending'`, never a real parent. | Check IGST before DCC FEE; link fees to the real parent id after import |
| 20 | Duplicate import | **Runtime:** importing the same 5 lines twice gave **10** rows; once more after closing the month gave 15 | Duplicates prevented or flagged | FAIL | No check on date + serial number + amount; the same purchase can be matched by both copies | Skip or flag rows whose (date, serial no., INR amount) already exist; stop a record being matched to two lines |
| 21 | Matching suggestions | **Runtime:** Semrush purchase matched on exact INR + vendor (99%); Apollo subscription matched on vendor + amount + billing window (97%); unknown merchant left Unidentified | Suggest matches | PASS | Ad spend is never matched (`suggestedAdSpendId` is never set) | Add ad-spend matching later (lower priority) |
| 22 | Human confirmation | **Runtime:** high-confidence suggestions are saved as **`Matched` at import time**, before anyone confirms | Only a person's Confirm finalizes a match | FAIL | Auto-matches and confirmed matches can't be told apart. The Dashboard counts them as reconciled. | Save auto-matches as "Suggested"; only Confirm sets `Matched` |
| 23 | Confirm Match | **Runtime:** on a subscription match, Confirm moved `lastChargedDate` / `nextExpectedCharge` forward (correct). On a line with **no suggestion** ("No Match Found"), Confirm still set **`Matched`, 100%**, linked to nothing. | Confirm only a real suggestion; record who and when | FAIL | No confirmer name or time, **no audit log entry** (`auditLogs` stayed 0). The request never becomes `Reconciled`. | Disable Confirm without a suggestion; store `confirmedBy`/`confirmedAt`; write an audit entry; set the linked request to `Reconciled` |
| 24 | Change Match / Assign to Employee | Buttons render in the side panel but have **no click handlers** | Fix wrong suggestions; route unknown lines to an owner | NOT IMPLEMENTED | — | Add a picker to choose a purchase or subscription; "assign" sets `assignedTo` |
| 25 | Confirmed matches persisted | **Runtime (isolated):** confirmed status saved and reloaded | Persist | PASS (isolated) / NOT VERIFIED (real DB) | — | — |
| 26 | Month closure | **Runtime:** "Close" sets `Closed` and writes an audit entry. **Imports into the closed month still worked**, and Confirm still works. | Closing locks the month | FAIL | The lock is only a label | Block import, confirm and edits when the period is Closed |
| 27 | Dashboard: reconciliation summary | Rate = (Matched + Associated) ÷ all rows | Rate of human-confirmed lines | PARTIALLY WORKING | Counts auto-matches and card header rows as reconciled | Count only confirmed merchant rows |
| 28 | Dashboard: client billing | Adds ad spend + subscriptions + purchases + billable fees | Correct per-client totals | PARTIALLY WORKING (code inspection) | Adds USD and INR amounts together and labels the result ₹. "Related fees" are **all** associated fees in the period, not that client's. Totals cover all time, not the selected month. | Use bank INR amounts; link fees through their parent transaction; filter by period |
| 29 | Dashboard: subscriptions | MRC = monthly subs; ARC = MRC × 12 + annual | Correct recurring cost | PARTIALLY WORKING (code inspection) | Quarterly subscriptions are left out of both; currencies are mixed | Include quarterly (× 4 a year); total in INR |
| 30 | Historical records | Nothing in the app deletes records; all collections are loaded in full (paged in batches of 1000) | Keep history | PASS (code inspection) | Records can be overwritten in place (#18); there's no change history except closure | Fix #18; add audit entries for key status changes |
| 31 | Database security (`schema.sql`) | RLS on, no policies, public roles revoked; only the server key can read or write | Data not publicly writable via Supabase keys | PASS (code inspection + Supabase confirmed RLS) | The **`/api/state` endpoint itself is open**: anyone with the site URL can read or overwrite all data (no auth, by design this phase) | Document it; add auth in a later phase |
| 32 | Dead code | `processPurchase`, `processSubscription`, `processAdSpend` in the store and ~15 unused form states in `FinanceView` | — | — | Not reachable from the UI | Remove when touching those files |

---

## A. Existing workflow (as implemented)

1. **Requester** fills the form. Status `Pending Approval` (or `Draft`). Card type is set automatically: Internal → Internal Card, Client → Client Card.
2. **Approvals** (one shared queue, fixed approver name): Approve gives `Approved` + a random `PUR-YYYY-NNNN`; Reject gives `Rejected`.
3. **Finance** enters the PUR id; for an approved request, "Provide OTP" gives `Awaiting Purchase Completion`.
4. **Requester** clicks "Update Details" and enters the actual amount, currency, date, optional bank INR and an invoice checkbox. The request becomes `Purchase Completed` (even when the payment failed), and depending on type a **purchase**, **subscription** or **ad-spend** record is created.
5. **Registers** list those records. Finance can also add, edit or deactivate subscriptions that existed before Spendy.
6. **Reconciliation**: create a period (name + card), paste the statement, and the app classifies each line and **auto-sets `Matched`** for confident matches. Confirm (inline or in the side panel) sets `Matched`/100% and moves subscription dates forward.
7. **Dashboard**: period summary, closing the month (audit entry), subscription stats, client billing roll-up.
8. **Persistence**: every change is saved to Supabase through `/api/state`; other users' changes appear within about 20 s.

## B. Required Trilliant workflow: differences

| Step | Gap |
|---|---|
| 1. Request | Missing **Purpose**, separate **Vendor**, **Practice**. Pod must become optional when a practice is chosen; client optional for practice-only spend. The pod list doesn't match Trilliant's 4 pods. |
| 2. Approval | No routing to the **Pod Head / Practice Head / Management**. The approver is a fixed name. Suggested rule set (needs your confirmation): client or pod purchase → that pod's head; practice-only purchase → that practice's head; above an amount threshold → also Management. |
| 3. Completion | Missing **payment reference**, **invoice number/date**, an explicit **purchased by**, and the subscription's next charge date. A failed payment is recorded as completed. |
| 4. Reconciliation | Import works (paste only). Duplicates aren't detected. A closed month isn't locked. |
| 5. Confirmation | **Main gap:** the system finalizes matches itself at import. A person's Confirm must be the only way to reach `Matched`, and it must record who and when. |

**Org scenarios:**
- **Example 1** (Umesha, Performance Marketing, buys for Manch Technologies, a Beacon client): there's nowhere to record the purchaser's practice, and nothing ties Manch Technologies to Beacon. It only works if the user picks "Beacons" by hand.
- **Example 2** (practice-only tool): not supported. The form forces a pod, and the practice can only be typed as free text.

## C. Missing features

1. Org config: 4 pods with heads, 7 practices, client → pod mapping
2. Request fields: `purpose`, separate `vendor` and `tool`, `ownerType` (Pod / Practice), `practice`
3. Approval routing and recording the approver role and approver
4. Completion fields: `paymentReference`, `invoiceNumber`, `invoiceDate`, `purchasedBy`
5. Finance bank INR confirmation action (store function exists, no UI)
6. "Suggested" state before human confirmation; `confirmedBy` / `confirmedAt`
7. Change Match and Assign to Employee actions
8. Duplicate statement-line detection
9. Closed-period lock
10. Saves that can't overwrite someone else's newer change
11. Request → `Reconciled` when its bank line is confirmed
12. Ad-spend matching (lower priority)

## D. Bugs and risks (all with evidence)

| Bug | Evidence |
|---|---|
| Failed / cancelled purchase saved as `Purchase Completed` | Runtime (#11) |
| Purchase records have no `status` | Runtime (#12) |
| Past Decisions shows completed purchases as red ✕ | Runtime (#14) |
| Matches finalized without human confirmation | Runtime (#22) |
| Confirm on "No Match Found" gives Matched 100%, linked to nothing; no audit entry | Runtime (#23) |
| Duplicate statement import doubles the rows | Runtime (#20) |
| IGST rows classified as Fee | Runtime (#19) |
| Fee/tax rows never linked to a parent (`'pending'`) | Runtime (#19) |
| Closed month still accepts imports | Runtime (#26) |
| Concurrent edits silently erase each other | Runtime (#18) |
| Random PUR/SUB ids can repeat | Code inspection (#7) |
| Client billing mixes currencies; fees not per client | Code inspection (#28) |
| Quarterly subscriptions excluded from MRC/ARC | Code inspection (#29) |
| `/api/state` is open to anyone with the URL | Code inspection (#31); accepted for this phase (no auth) |

**Accountability limits from having no login** (documented, not to be fixed now): approver and finance names are hardcoded, "My Requests" shows everyone's requests, anyone can act in any role, and the audit trail can't say who really acted.

## E. Recommended implementation order

| Priority | Work | Why first | Depends on |
|---|---|---|---|
| **P0-a** | Real-database write check: one controlled test record, verified, then deleted by you in Supabase | #16 is the only unverified core path | — |
| **P0-b** | Data integrity: unique PUR/SUB ids; saves that can't overwrite a newer change (409 + reload); duplicate-import detection; closed-period lock; failed-purchase status; purchase `status` field | Everything later builds on records being trustworthy | P0-a |
| **P0-c** | Human confirmation: "Suggested" state, Confirm only with a suggestion, `confirmedBy`/`confirmedAt`, audit entry, request → `Reconciled`, dashboard counts confirmed only | Required workflow step 5 | P0-b |
| **P1** | Org structure: config (pods + heads, practices, client → pod); request form fields; pod-or-practice validation | Trilliant scenarios 1 and 2 | — (can run alongside P0-c) |
| **P2** | Approval routing using the org config | Needs P1's unit fields | P1 |
| **P3** | Completion fields (payment ref, invoice no/date, purchased by, next charge) and the Finance bank INR confirm action | Step 3 completeness | P1 |
| **P4** | Change Match / Assign to Employee; IGST and parent-fee fixes; Past Decisions badge; drafts | Reconciliation usability | P0-c |
| **P5** | Dashboard money fixes (INR totals, per-client fees, quarterly MRC/ARC); ad-spend matching | Reporting accuracy | P0-c, P3 |

## F. Files requiring changes

| File | Change |
|---|---|
| `src/types.ts` | Add `purpose`, `vendor`, `ownerType`, `practice`, `approverRole`; completion `paymentReference`, `invoiceNumber`, `invoiceDate`, `purchasedBy`; `BankTransaction.confirmedBy/confirmedAt` and a `Suggested` match status |
| `src/config/org.ts` *(new, code not table)* | Pods + heads, practices, client → pod map, approval rules |
| `src/views/EmployeeView.tsx` | New fields; pod-or-practice selector; client picker that fills in the pod; completion form fields; draft edit/submit |
| `src/views/ManagerView.tsx` | Show the routed approver; record role; fix the Past Decisions badge |
| `src/views/FinanceView.tsx` | Wire up "Confirm bank INR"; remove unused state |
| `src/views/RegistersView.tsx` | Show the new fields; handle purchase status |
| `src/views/ReconciliationView.tsx` | Save matches as Suggested; duplicate detection; IGST before DCC FEE; parent fee link; Confirm guard; Change Match / Assign; closed-period lock |
| `src/views/DashboardView.tsx` | Count confirmed only; INR totals; per-client fees; quarterly MRC/ARC |
| `src/hooks/useStore.ts` | Unique id generation; failed-purchase status; purchase `status`; `confirmTransactionMatch` (confirmer, audit, Reconciled, guard); send `updated_at` for conflict checks |
| `src/utils/recurringMatch.ts` | Probably unchanged; possibly a helper to prevent double matches |
| `api/state.ts` | Reject stale saves (compare `updated_at`, return 409 with the current record); return `updated_at` with each record |
| `supabase/schema.sql` | **No new tables.** Optional unique index on `purchase_id` / `subscription_id` (needs an SQL run in Supabase). |

---

## Recommended next task (not started)

**Task 2: Data integrity and human-confirmed reconciliation (P0-a → P0-c).**
Start with one controlled write test against the real Supabase. Then fix id uniqueness, the overwrite risk between users, duplicate imports, the closed-month lock, failed-purchase status and the purchase `status` field. Then change reconciliation so matches are only **suggested** until a person confirms them, with confirmer, time and an audit entry recorded. These are small, contained changes in `useStore.ts`, `api/state.ts` and `ReconciliationView.tsx`. The Trilliant org-structure work (P1/P2) can then build on records that are reliable.
