# Doctor Verification System — Review & Recommendations

**Prepared for:** Director
**Date:** 2026-07-14
**Scope:** Technical review of the doctor verification module (`src/features/doctor`) and a check of how manual verification for Nigerian health professionals actually works via MDCN (Medical and Dental Council of Nigeria).

---

## 1. Executive Summary

The platform's doctor verification system is a tiered pipeline: doctors submit license details, the system routes them to automated (API), hybrid, or manual verification based on country, and admins review and approve/reject through a separate admin console. The overall design is sound and correctly anticipates that **Nigeria has no automated verification API** — but the code review surfaced several concrete defects that reduce the reliability and integrity of the verification process. Separately, research into MDCN's actual process shows our data model is missing fields that MDCN's own verification method depends on (folio number, date of birth), and there is a real cost and manual-effort implication per Nigerian doctor that should be budgeted for.

---

## 2. How the System Currently Works

1. **Submission** — Doctor submits license number, country, issuing authority, dates.
2. **Tiering** — Country determines tier:
   - **Tier 1** (South Africa, Kenya): automated via API.
   - **Tier 2** (Nigeria, Ghana, Tanzania, Uganda): "hybrid," but no API exists — falls through to manual review after documents are uploaded.
   - **Tier 3** (Ethiopia, Zambia, Zimbabwe): manual only.
3. **Confidence scoring** — For tier 1, an API result plus document count produces a confidence score that auto-approves (≥85), sends to manual review (≥50), or auto-rejects (<50).
4. **Document upload & processing** — Documents are OCR'd (Tesseract / Google Vision / AWS Textract) and passed through a heuristic scoring pass for fraud risk and authenticity.
5. **Admin review** — A separate, properly role-gated admin console (`/api/admin/verification/*`) lets admins view the queue, assign reviewers, and approve/reject.
6. **On approval** — The doctor's account is activated, and a wallet + default subscription are auto-provisioned.

---

## 3. Code Review Findings

Findings are ranked by practical impact. All were verified directly against the code (file:line references retained for engineering follow-up).

| # | Finding | Impact |
|---|---------|--------|
| 1 | **OCR pipeline crashes on Word documents** (`documentProcessingService.js`) — `.doc`/`.docx` are an allowed upload type, but the code only builds an OCR result for PDFs/images, then reads a property off that result unconditionally. Uploading a Word doc silently fails OCR every time. | Documents uploaded in Word format never get processed; doctor may appear "stuck" with no clear reason. |
| 2 | **Two admin recovery endpoints are unreachable.** `fixDoctorSetup` and `fixAllIncompleteSetups` are fully implemented and documented in the API docs, but no route in the app actually wires them up. | Support/ops staff following the documented API to repair a doctor's wallet/subscription setup will get a 404 — the tool they think exists doesn't. |
| 3 | **No duplicate-license or license-format validation**, despite the controller having dedicated error handling that implies this check exists. The repository method for checking existing license numbers is never called. | Two different accounts could submit the same license number with no detection. This is a meaningful integrity gap for a credential-verification system. |
| 4 | **Confidence-score thresholds are hardcoded**, bypassing the configuration values meant to control auto-approve / manual-review / auto-reject cutoffs. | Changing the intended thresholds in config has no effect on actual behavior — a silent configuration/code mismatch. |
| 5 | **No safeguard against re-approving a rejected verification.** The reject path checks that a request is in a rejectable state first; the approve path has no equivalent check. | An admin (or a bug in the admin UI) could approve a previously-rejected verification, bypassing the intended workflow. |
| 6 | **Duplicate route registration** for document uploads — harmless today (dead code), but a maintenance trap for whoever edits it next. | Low risk, but worth cleaning up. |
| 7 | **The "AI fraud/authenticity analysis" is not AI** — it is hand-written keyword and file-size heuristics, despite code comments describing it as "real AI analysis." | Not a bug, but a materially important thing for leadership to know: the fraud-detection signal should not be treated as more rigorous than it is. |

**Recommendation:** Items 1, 3, and 5 should be prioritized — they affect data integrity and the reliability of a process whose entire purpose is trust and credential verification. Item 7 should inform how much weight is placed on the automated fraud score versus human review.

---

## 4. How Nigerian Doctor Verification Actually Works (MDCN)

Research into MDCN's real-world process confirms the system's architectural assumption — **there is no automated/API path for Nigeria** — but shows gaps in what data we capture versus what MDCN's own process requires.

### The real process
- MDCN registers doctors under a **folio number** — a permanent, unique identifier, distinct from a general "license number." Format follows a prefix + number structure (e.g. `MDCN/R/xxxxx`-style).
- Registration itself has categories (full registration vs. provisional/temporary for foreign-trained doctors), separate from the **Annual Practising Licence (APL)**, which must be renewed every year via the Remita payment platform. A doctor can have a valid, permanent folio number but a **lapsed APL** — meaning "registered" and "currently licensed to practice this year" are not the same fact.
- To verify a specific doctor, there are two routes:
  1. **MDCN's "Confirm Doctor Status" portal** (`portal.mdcn.gov.ng/confirm-doctor-status`) — enter practice type, folio prefix, and folio number; pay a fee; receive a status result.
  2. **Direct contact with MDCN** (phone or email) with the doctor's full name, date of birth, folio number, and passport photo, for manual confirmation by MDCN staff.
- MDCN explicitly states it is **the employer's responsibility** to verify that any doctor they engage is properly registered and licensed.

### Gaps versus our current data model
- We store a generic `licenseNumber` string; MDCN's process is built around a distinct **folio prefix + folio number**.
- We capture `dateOfBirth` on the doctor's profile, but it is **not linked to the verification request itself**, even though MDCN's manual-contact route requires name + DOB + folio number together — an admin doing the check today has to separately dig up the DOB.
- We have no mechanism to periodically re-check a doctor's **Annual Practising Licence** status after initial approval — a doctor could be verified once and have a lapsed license the following year with nothing in the system flagging it.
- There is no admin-facing checklist/runbook step documenting what to actually do for a Nigerian verification (i.e., "go pay the fee on MDCN's portal, or email/call MDCN with these details").

---

## 5. Licensing / Verification Cost — Needs Direct Confirmation

Two figures came up in research, and they appear to describe **different things that may have been conflated** in some sources:

- **₦20,000** was cited as the fee for a single check on MDCN's "Confirm Doctor Status" portal (i.e., the cost each time we'd verify one doctor).
- Separately, a more official MDCN notice ("Increase in Annual Practising Licence Fee," effective 8 Jan 2025) states the **Annual Practising Licence fee** — which is what a *doctor* pays MDCN yearly to remain licensed — is **₦20,000 for practitioners with under 10 years' experience** and **₦40,000 for 10+ years**.

These may be the same figure by coincidence, or the "per verification check" claim may be a misattribution of the APL fee. **I could not confirm this from a first-party MDCN source** (their fee-schedule pages block automated access), so:

**Recommendation:** Before this number is used for budgeting or built into any process (e.g., passed on to doctors, or budgeted as an internal verification cost per doctor), confirm directly with MDCN:
- Email: info@mdcn.gov.ng
- Phone: 09130519156 / 09077062051 (Mon–Fri, 8am–4pm)

---

## 6. Recommendations Summary

1. **Fix the OCR null-reference bug** so Word-document uploads don't silently fail (low effort, high value).
2. **Add a real duplicate-license and format check** before creating a verification request — this is a basic integrity requirement for a system whose job is to verify credentials.
3. **Add a status guard to the approval path** so a rejected/approved request cannot be re-approved without going through resubmission.
4. **Wire the config-driven confidence thresholds into the actual approval logic**, or remove the unused config values to avoid confusion.
5. **Register the two orphaned admin recovery routes**, or remove them and their documentation if they're no longer needed.
6. **Capture folio number and link DOB to the verification request** to match what MDCN's manual process actually requires, making the admin review step faster and less error-prone.
7. **Confirm the actual per-verification cost directly with MDCN** before using it in any financial or operational planning.
8. **Do not represent the current fraud-detection scoring as AI-driven** in any internal or external communication — it is rule-based heuristics, useful as a signal but not a substitute for human review.
