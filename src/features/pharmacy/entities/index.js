module.exports = {
    PharmacyProfile:             require('./PharmacyProfile'),
    PharmacyBranch:              require('./PharmacyBranch'),
    PharmacyVerificationRequest: require('./PharmacyVerificationRequest'),
    PharmacyDocument:            require('./PharmacyDocument'),
    PharmacyPricing:             require('./PharmacyPricing'),
    Prescription:                require('./Prescription'),
    LabPharmWaitlist:            require('./LabPharmWaitlist'),

    // Payment & wallet system
    Invoice:                   require('./Invoice'),
    InvoiceLineItem:           require('./InvoiceLineItem'),
    PharmacyWallet:            require('./PharmacyWallet'),
    PharmacyWalletTransaction: require('./PharmacyWalletTransaction'),
    PharmacyBankAccount:       require('./PharmacyBankAccount'),
    PharmacyPayoutRequest:     require('./PharmacyPayoutRequest'),
    PharmacyPayment:           require('./PharmacyPayment'),
    PharmacyDispute:           require('./PharmacyDispute'),

    // Patient wallet system
    PatientWallet:            require('./PatientWallet'),
    PatientWalletTransaction: require('./PatientWalletTransaction'),
};
