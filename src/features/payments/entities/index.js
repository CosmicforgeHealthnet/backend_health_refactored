const DoctorWallet = require("./DoctorWallet");
const UserPaymentMethod = require("./UserPaymentMethod");
const WalletWithdrawal = require("./WalletWithdrawal");
// Moved from transactions
const Transaction = require("./Transaction");
const Dispute = require("./Dispute");
const TransactionSplit = require("./TransactionSplit");

module.exports = {
    DoctorWallet,
    UserPaymentMethod,
    WalletWithdrawal,
    Transaction,
    Dispute,
    TransactionSplit
};
