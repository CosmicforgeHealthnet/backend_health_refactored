const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "PharmacyBankAccount",
  tableName: "pharmacy_bank_accounts",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    pharmacyId: { type: "uuid", nullable: false },
    walletId:   { type: "uuid", nullable: false },

    bankName:      { type: "varchar", length: 100, nullable: false },
    accountNumber: { type: "varchar", length: 20, nullable: false },
    accountName:   { type: "varchar", length: 255, nullable: false },
    bankCode:      { type: "varchar", length: 10, nullable: false },

    // Paystack transfer recipient code — stored after account is verified
    recipientCode: { type: "varchar", length: 100, nullable: true },

    isDefault: { type: "boolean", default: false, nullable: false },
    isActive:  { type: "boolean", default: true, nullable: false },

    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    wallet: {
      type: "many-to-one",
      target: "PharmacyWallet",
      joinColumn: { name: "walletId" },
      onDelete: "CASCADE",
      inverseSide: "bankAccounts",
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["walletId"] },
    { columns: ["isDefault"] },
    { columns: ["accountNumber", "bankCode", "pharmacyId"], unique: true },
  ],
});
