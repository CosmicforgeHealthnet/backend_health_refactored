# The Vendor / Shop / Hybrid-Pharmacy System — Explained in Plain English

This is your cheat sheet for talking about the e-commerce ("shop") side of the CosmicForge health backend in an interview. It's written the way you'd explain it out loud to someone, not like code documentation.

---

## 1. The elevator pitch

CosmicForge is mainly a telehealth app (patients book doctors, get prescriptions, use pharmacies). On top of that, we bolted on a **mini e-commerce marketplace** — like a small Amazon/Jumia — where people can sell health-related physical products (vitamins, baby care, fitness gear, medical supplies, and — for pharmacies only — actual medication).

There are two ways to become a seller ("vendor") in this shop:

1. **A regular business signs up as a vendor from scratch** — goes through ID/document verification like opening a seller account on Jumia.
2. **A pharmacy that's already on the platform flips a switch called "vendor mode"** and instantly becomes a shop too — because it was already verified as a licensed pharmacy, it skips re-verification. We call this a **hybrid pharmacy**.

Whichever way someone becomes a vendor, once approved they can list products, patients can browse and add to cart, checkout happens through Paystack/Flutterwave, and the platform takes a cut (7%) of every sale before the vendor gets paid.

---

## 2. The three types of sellers

| Type | How they get in | What they can sell |
|---|---|---|
| **Standalone vendor** | Registers directly, uploads ID + business registration docs, waits for admin approval | Anything except medication |
| **Pharmacy (normal mode)** | Already verified through the separate pharmacy-licensing pipeline | Not a "shop" seller at all — sells through prescriptions/invoices, not the cart system |
| **Hybrid pharmacy (vendor mode ON)** | Already-approved pharmacy flips "vendor mode" on | Everything a normal vendor can, **plus medication** — the only seller type allowed to list drugs in the shop |

This is the single most important design decision to be able to explain: **only pharmacies are allowed to sell medication in the shop, and they earn that right automatically because they were already licensed and verified as a pharmacy.** No other vendor — no matter how long they've been approved — can ever list a medication product. That rule is enforced directly in the product-creation code, not just a UI restriction.

---

## 3. How someone becomes a standalone vendor (step by step)

Think of it like applying for a seller account on an online marketplace:

1. **Register** — business name, category (health & wellness, medical supplies, baby/mother care, fitness, nutrition, or "other"), contact info, address. This creates a user account with role `vendor` and a vendor profile that starts life as `pending`.
2. **Verify email** — standard email confirmation link. (Interesting detail: confirming the email does *not* move you forward in the vendor approval process — it's a separate gate.)
3. **Upload documents** — a government ID and a business registration document. Once both are uploaded, the profile is marked "documents submitted."
4. **Wait for admin review** — in theory an admin reviews the documents and approves/rejects. In practice (see Section 7, "honest gaps") this admin approval step isn't fully wired up yet in the code — it's the kind of thing a real reviewer or interviewer might ask about, and it's fine to say so.
5. **Approved** — only once `verificationStatus` is `approved` can the vendor actually list products or run promotions.

There's also a "state machine" helper in the code that translates all this into a friendly message for the frontend, e.g. "Please verify your email," "Your documents are under review," etc. — like the progress tracker you'd see applying for a bank account online.

---

## 4. How a pharmacy becomes a "hybrid pharmacy"

This is the neat part, and probably the best thing to lead with in an interview because it shows a real product/business decision, not just CRUD:

- A pharmacy that's **already fully approved** (through its own separate, stricter pharmacy-licensing verification) can call one endpoint: `POST /pharmacy/vendor-mode/enable`.
- The system takes the pharmacy's existing business info (name, email, phone, address, logo) and **auto-creates a vendor profile that is instantly marked "approved"** — no waiting, no re-uploading documents, no admin review.
- **Why this makes business sense:** the pharmacy already proved who they are and that they're licensed to handle medication. Making them go through vendor KYC again would be redundant and annoying. This is a classic "trust propagation" pattern — reuse an existing verified identity instead of re-verifying from zero.
- Turning vendor mode **off** just deactivates the shop presence — the pharmacy keeps operating normally as a pharmacy (prescriptions, invoices), it just stops appearing in the shop.

If asked "why would a pharmacy want to do this?" — answer: so they can sell things like vitamins, baby formula, or over-the-counter medication directly through the shop/cart experience, in addition to fulfilling doctor-issued prescriptions the traditional way.

---

## 5. Products, categories, and the cart

- **Products** belong to a vendor, have a price, stock count, category/subcategory, and images. Every new product (and every edit to one) has to be **approved by an admin** before it's visible to shoppers — this is a moderation step, similar to how Amazon or Etsy reviews new listings.
- **Categories** are fixed: health & wellness, medical supplies, baby & mother care, fitness & lifestyle, nutrition, others — and a hidden **medications** category that only hybrid pharmacies can even see or use.
- **Cart** — each patient gets a separate cart *per vendor* (if you're buying from two different shops, that's two carts, like separate Amazon "sold by" baskets). When you submit your cart, the price is locked in at that moment (a "price snapshot") so the vendor can't change the price on you after you've committed to buy.
- **Checkout** — goes through the same payment providers used elsewhere in the app (Paystack/Flutterwave), converted to the patient's local currency if needed.

---

## 6. Where the money goes (the fee model)

This is the part interviewers love asking about, because it's a real business-logic question, not just "how do you code a for-loop."

The platform makes money by adding a **7% platform fee on top** of most transactions. Here's the breakdown by transaction type:

| Who's selling | What the patient pays | What the platform keeps | What the seller keeps |
|---|---|---|---|
| **Doctor appointment** | base fee + 7% | 7% + a doctor commission (10–30%, depending on the doctor's subscription tier) | base fee minus their commission |
| **Vendor selling a product** | subtotal + 7% | 7% (+ a vendor commission, currently set to 0%, but the admin can turn it on) | subtotal minus commission |
| **Pharmacy selling via prescription/invoice** | base + 7% | 7% only | **100%** of the invoice — pharmacies are fee-exempt because health services are VAT-exempt in Nigeria, and we didn't want to eat into a licensed pharmacy's margin |

**One cool detail worth mentioning:** doctor commission is *inverted* from what you'd expect — doctors on cheaper subscription tiers (free tier) actually pay the platform a **higher** commission (30%), while doctors paying for premium subscriptions pay a **lower** commission (10%). It's designed so the platform earns money either way — either through the subscription fee, or through a bigger cut of each appointment — and it rewards doctors for investing in a paid plan.

All these percentages aren't hardcoded forever — they live in an admin-configurable settings table, so the business can adjust the platform fee or vendor commission without a code deploy (there's even a "preview fees" endpoint that shows what a split would look like before it's applied).

---

## 7. Honest gaps — great material for "what would you improve?" questions

Real codebases have rough edges, and being able to point to them (calmly, not apologetically) is a strong interview signal. Here are real ones found in this system:

1. **Vendor admin-approval isn't fully built.** The states exist in the database (`pending` → `documents_required` → `under_review` → `approved`), but there's no admin screen/endpoint that actually moves a vendor through those states — right now that seems to happen manually. This is in contrast to the doctor-verification flow, which does have a full admin review console. If asked "how would you fix this," the answer is: build the missing admin controller/routes to mirror what already exists for doctors.
2. **Two different checkout paths exist for buying from a vendor** — one newer path that reads the fee percentages from the admin settings table, and one older path where the 7%/93% split is hardcoded directly in the payment code. Both are still live in the codebase. This is the kind of duplication that happens naturally as a system evolves, and the fix would be to pick one path, migrate the other, and delete the dead one.
3. **A couple of small inconsistencies** — e.g., a code comment claiming pharmacies pay a platform fee when the actual logic gives them 100%, and a status field (`paid`) that exists in the code's cart model but was never added to the actual database. Small things, but the kind of drift that happens when documentation/comments lag behind changing requirements — and a good instinct to have is that comments should be periodically checked against the code doing the actual work, not trusted at face value.

None of this is a red flag — it's completely normal for a fast-moving product to have an MVP feature (hybrid pharmacy, fee splits) shipped and working, sitting next to a not-quite-finished feature (vendor admin approval) and some duplicated logic from an earlier iteration. Being able to describe *which parts are solid* vs. *which parts are still evolving* is exactly what a senior engineer sounds like in an interview.

---

## 8. Likely interview questions & how to answer them

**"Walk me through how a pharmacy would start selling products online."**
→ Pharmacy is already verified through pharmacy licensing → calls one "enable vendor mode" action → instantly gets a shop profile, pre-filled from their existing pharmacy info, auto-approved because they're already a trusted, licensed entity → they can now list products including medication, which no other seller type is allowed to do.

**"How do you stop random vendors from selling medication?"**
→ It's enforced at the point where a product is created — the system checks a flag on the product category (medications are marked "hybrid-pharmacy only") and rejects the request server-side if the vendor isn't a hybrid pharmacy. It's not just hidden in the UI — it's blocked on the backend, so it can't be bypassed by calling the API directly.

**"How does the platform make money?"**
→ A 7% fee added on top of most transactions (appointments, product orders, pharmacy invoices), plus commission on doctor appointments that scales with the doctor's subscription tier, plus optional vendor commission (currently off, but toggleable). All rates live in an admin settings table so they can be changed without redeploying code.

**"What would you change about this system?"**
→ Finish the vendor admin-approval workflow (it's scaffolded but not wired up), consolidate the two competing checkout/payment paths into one, and clean up a few stale code comments that no longer match what the code actually does.

**"Why separate 'vendor' and 'pharmacy' as concepts instead of just making everyone a vendor?"**
→ Because pharmacies go through a much stricter, health-specific licensing check (since they can dispense actual medication), while a vendor selling vitamins or baby products just needs basic KYC (ID + business registration). Keeping them as separate identities lets the verification bar match the risk — and the "hybrid" bridge lets pharmacies opt into the lighter-weight shop experience without redoing verification.
