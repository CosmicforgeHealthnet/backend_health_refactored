# NIN Verification for Nigerian Doctors — Requirements & Rollout Plan

**Prepared for:** Director
**Date:** 2026-07-14
**Scope:** Adding National Identification Number (NIN) identity verification to the Nigerian doctor onboarding flow, on top of the existing MDCN license verification, plus a migration plan for doctors already on the platform.

---

## 1. Why This Is Needed

Today, the "government ID" a Nigerian doctor uploads during verification is just a document image — it gets OCR'd, but nobody actually confirms that ID against a government database, and nobody checks that the **name on the ID matches the name the doctor registered under**. Someone could upload any ID image, or a genuine ID under a different name, and it would pass through the current flow undetected.

**NIN verification closes that gap.** It confirms that the National Identification Number the doctor provides:
1. Is a real, valid NIN issued by NIMC (National Identity Management Commission), and
2. Belongs to a person whose government-registered name **matches the name the doctor is operating under on the platform**.

This sits alongside — not instead of — the existing MDCN professional license check. MDCN confirms someone is a licensed doctor; NIN confirms they are who they say they are.

---

## 2. How NIN Verification Actually Works (Nigeria)

NIMC does not give businesses direct API access to its database. In practice, everyone (banks, fintechs, healthtech platforms) goes through a **licensed third-party verification provider** that has an agreement with NIMC. The commonly used ones are:

- **Dojah**
- **Smile ID**
- **Prembly**
- **VerifyMe**
- **YouVerify**

The flow with all of them is broadly the same:
1. We submit the doctor's **NIN** (or a **virtual NIN / vNIN**, a privacy-preserving version the doctor generates via the NIMC app instead of exposing their real NIN).
2. The provider returns identity data straight from the government record: **first name, surname, middle name, gender, date of birth, phone number, photo**.
3. **The name-matching is on us, not the provider.** These providers return the raw government data — they don't automatically tell you "yes, this matches." We need to compare the returned name against what the doctor entered, using fuzzy matching (to tolerate things like "Muhammed" vs "Mohammed", middle name order, etc.), not an exact string match.
4. Pricing is not publicly listed by any of these providers — it works on a prepaid wallet/per-verification-call basis, and actual per-check cost needs to come from their sales teams directly.

**Action needed from leadership:** pick a provider and get pricing before we build against a specific API. I'd suggest requesting quotes from at least two (e.g. Dojah and Smile ID) since neither publishes pricing.

---

## 3. What Needs to Be Built

### New data captured
- `nin` (or `vnin`) — encrypted at rest, the same way we already encrypt uploaded verification documents. NIN is sensitive personal data under Nigeria's Data Protection Regulation (NDPR) and must be treated accordingly — not stored in plain text, not logged, access-restricted to admins reviewing verification.
- `ninVerificationStatus` — pending / verified / failed / name_mismatch.
- `ninVerifiedData` — the raw response from the provider (name, DOB, gender, photo) for admin review if a mismatch needs a human decision.
- `nameMatchScore` — the result of comparing the doctor's registered name against the NIN record, plus the threshold used to decide pass/fail.

### New verification step
- Add NIN submission as a required step in the Nigerian (tier 2) verification flow, alongside the existing document upload requirement.
- Call the chosen provider's API, run the name-match comparison, and:
  - **High match confidence** → proceed automatically to the existing manual review stage (this doesn't replace human review, it feeds into it).
  - **Low match / mismatch** → flag clearly for admin attention with the government-returned name displayed side-by-side with what the doctor entered, so a human makes the final call (names legitimately differ sometimes — married names, nicknames, transliteration).

### Admin-facing
- Surface NIN verification result (matched / mismatch / not yet submitted) in the admin verification review screen, next to the existing document and license info.

---

## 4. Backward Propagation — Handling Doctors Already on the Platform

We already have active, verified Nigerian doctors in the system who were approved before this requirement existed. We cannot silently require NIN and lock everyone out — that would suspend currently practicing doctors with no warning. This needs a phased rollout:

**Phase 1 — New signups only (immediate on launch)**
Any *new* Nigerian doctor verification submitted after this feature ships must include NIN verification with a passing name match before they can be approved. No backward compatibility needed here — it's a new gate on new users.

**Phase 2 — Notify existing doctors (grace period)**
For Nigerian doctors already `doctor_active`:
- Do **not** suspend or downgrade anyone immediately.
- Send a notification/email campaign asking them to submit their NIN retroactively, with a clear deadline (recommend 60–90 days — leadership should set the exact number).
- Track completion via the same `ninVerificationStatus` field, so we can report on how many existing doctors have completed it at any time.

**Phase 3 — Enforcement (after the grace period)**
- Doctors who haven't submitted a matching NIN by the deadline get flagged (not silently deactivated) for admin follow-up.
- Leadership decides the consequence for non-compliance after the deadline (e.g. temporary listing suspension until submitted, versus a soft warning banner) — this is a policy decision, not a technical one, and should be decided before Phase 2 starts so the notification email can say what actually happens.

**Why phase it this way:** it avoids disrupting currently active doctors and any patients mid-treatment with them, while still closing the gap for everyone going forward, and gives us a clean audit trail of who has/hasn't completed it.

---

## 5. Decisions Needed From Leadership Before Building This

1. **Provider selection and budget approval** — need quotes from at least two providers (e.g. Dojah, Smile ID) since pricing isn't public; per-verification cost affects both onboarding cost and the cost of retroactively checking the existing doctor base.
2. **Grace period length** for existing doctors to submit their NIN (recommend 60–90 days).
3. **Consequence for non-compliance** after the grace period — what happens to an existing doctor's account if they don't submit a matching NIN in time.
4. **Name-mismatch policy** — when the government name doesn't match what's on the platform, does it go to manual admin review (recommended) or auto-reject? Legitimate mismatches happen (married names, spelling variants), so a hard auto-reject risks blocking real doctors.
5. **NDPR/legal sign-off** on storing NIN data — confirm our encryption-at-rest approach and access controls satisfy Nigeria's data protection requirements before we start collecting NIN from doctors.
6. **Scope** — confirm this applies to Nigeria only for now, or whether other countries in tier 2/3 (Ghana, Tanzania, Uganda, Ethiopia, Zambia, Zimbabwe) should get an equivalent national-ID check later using each country's own ID authority.
