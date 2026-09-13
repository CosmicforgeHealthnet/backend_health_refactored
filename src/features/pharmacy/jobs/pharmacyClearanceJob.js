/**
 * Pharmacy Escrow Clearance Job
 *
 * Runs daily. Finds wallet transactions with:
 *  - status: "pending" (in escrow)
 *  - category: "invoice_payment"
 *  - createdAt older than 3 business days
 *  - No open dispute on the related invoice
 *
 * On clearance:
 *  - Moves amount from pendingClearanceUsd → availableBalanceUsd on the wallet
 *  - Sets transaction status → "completed", settledAt → now
 */

const walletTxnRepo   = require("../repositories/pharmacyWalletTransactionRepository");
const pharmacyWalletRepo = require("../repositories/pharmacyWalletRepository");
const pharmacyDisputeRepo = require("../repositories/pharmacyDisputeRepository");
// BUG FIX: config/database.js does `module.exports = AppDataSource` (a plain
// TypeORM DataSource instance, not `{ AppDataSource }`). Destructuring made
// this AppDataSource undefined, so `AppDataSource.transaction(...)` below
// threw on every run — the daily escrow clearance job was completely broken.
const AppDataSource = require("../../../config/database");

/**
 * Calculate the date N business days ago (skips Saturday & Sunday).
 */
function businessDaysAgo(n) {
  const date = new Date();
  let remaining = n;

  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }

  return date;
}

async function runClearanceJob() {
  console.log("[PharmacyClearance] Starting escrow clearance job...");

  try {
    const cutoffDate = businessDaysAgo(3);
    const pending    = await walletTxnRepo.findPendingForClearance(cutoffDate);

    if (pending.length === 0) {
      console.log("[PharmacyClearance] No transactions pending clearance.");
      return;
    }

    console.log(`[PharmacyClearance] Found ${pending.length} transaction(s) to clear.`);

    let cleared = 0;
    let skipped = 0;

    for (const txn of pending) {
      try {
        // Skip if there is an open/under_review dispute on this invoice
        if (txn.invoiceId) {
          const hasDispute = await pharmacyDisputeRepo.hasOpenDispute(txn.invoiceId);
          if (hasDispute) {
            console.log(`[PharmacyClearance] Skipping txn ${txn.id} — open dispute on invoice ${txn.invoiceId}`);
            skipped++;
            continue;
          }
        }

        await AppDataSource.transaction(async (trx) => {
          const amountUsd = parseFloat(txn.amountUsd);

          // Move from pendingClearance → available
          await trx.update("PharmacyWallet", { id: txn.walletId }, {
            pendingClearanceUsd: () => `GREATEST("pendingClearanceUsd" - ${amountUsd}, 0)`,
            availableBalanceUsd: () => `"availableBalanceUsd" + ${amountUsd}`,
          });

          // Mark transaction completed
          await trx.update("PharmacyWalletTransaction", { id: txn.id }, {
            status:    "completed",
            settledAt: new Date(),
          });
        });

        console.log(`[PharmacyClearance] Cleared txn ${txn.id} — ${txn.amountUsd} USD for pharmacy ${txn.pharmacyId}`);
        cleared++;
      } catch (err) {
        console.error(`[PharmacyClearance] Failed to clear txn ${txn.id}:`, err.message);
      }
    }

    console.log(`[PharmacyClearance] Done. Cleared: ${cleared}, Skipped (open dispute): ${skipped}`);
  } catch (err) {
    console.error("[PharmacyClearance] Job failed:", err.message);
  }
}

module.exports = { runClearanceJob };
