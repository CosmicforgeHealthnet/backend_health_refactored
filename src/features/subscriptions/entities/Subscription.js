// src/entities/Subscription.js
const { EntitySchema } = require("typeorm");

// Plan type enum
const PlanType = {
  DOCTOR: "doctor",
  PATIENT: "patient"
};

// Enhanced tier enum (backward compatible)
const SubscriptionTier = {
  // Legacy tiers (keep existing)
  BASIC: "basic",
  PRO: "pro", 
  ENTERPRISE: "enterprise",
  
  // New patient tiers
  FREE: "free",
  STANDARD: "standard",
  MEDIUM: "medium",
  PREMIUM: "premium",
  GOLD_ELITE: "gold_elite",
  
  // New doctor tiers  
  PROFESSIONAL: "professional"
};

const SubscriptionStatus = {
  ACTIVE: "active",
  PENDING: "pending", 
  EXPIRED: "expired",
  CANCELED: "canceled",
  PAUSED: "paused"
};

module.exports = new EntitySchema({
  name: "Subscription",
  tableName: "subscriptions",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },
    
    // ADD MISSING userId COLUMN
    userId: {
      type: "uuid",
      nullable: false
    },
    
    // EXISTING COLUMNS (unchanged for backward compatibility)
    tier: {
      type: "enum",
      enum: ["basic", "pro", "enterprise", "free", "standard", "medium", "premium", "gold_elite", "professional"],
    },
    status: {
      type: "enum",
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.ACTIVE,
    },
    startDate: {
      type: "timestamp",
    },
    endDate: {
      type: "timestamp",
    },
    nextBillingDate: {
      type: "timestamp",
      nullable: true,
    },
    autoRenew: {
      type: "boolean",
      default: false,
    },
    price: {
      type: "float",
    },
    currency: {
      type: "varchar",
      length: 3,
      default: "USD",
    },
    createdAt: {
      type: "timestamp",
      createDate: true,
    },

    // NEW COLUMNS (with defaults for backward compatibility)
    planType: {
      type: "enum",
      enum: Object.values(PlanType),
      default: PlanType.PATIENT,
      nullable: true,
      comment: "Distinguishes between doctor and patient plans"
    },
    
    commissionRate: {
      type: "decimal",
      precision: 5,
      scale: 2,
      nullable: true,
      comment: "Commission rate for doctors (percentage)"
    },
    // Auto-billing fields (add these to your existing columns)
    autoBillingEnabled: {
      type: "boolean",
      default: false,
      comment: "Whether user has enabled auto-billing for this subscription"
    },

    preferredPaymentMethodId: {
      type: "uuid",
      nullable: true,
      comment: "Payment method to use for auto-billing"
    },

    autoBillingFailureCount: {
      type: "integer",
      default: 0,
      comment: "Number of consecutive auto-billing failures"
    },

    lastAutoBillingAttempt: {
      type: "timestamp",
      nullable: true,
      comment: "When auto-billing was last attempted"
    },

    autoBillingGracePeriod: {
      type: "integer",
      default: 7,
      comment: "Days of grace period after failed auto-billing"
    },
    
    features: {
      type: "jsonb",
      nullable: true,
      default: () => "'[]'",
      comment: "Array of enabled features for this subscription"
    },
    // serviceType: {
    //   type: "enum",
    //   enum: ["appointment", "consultation", "subscription", "subscription_upgrade", "subscription_renewal", "other"],
    //   nullable: false
    // },
    
    monthlyLimits: {
      type: "jsonb",
      nullable: true,
      default: () => "'{}'",
      comment: "Monthly usage limits (AI responses, consultations, etc.)"
    },
    
    currentUsage: {
      type: "jsonb", 
      nullable: true,
      default: () => "'{}'",
      comment: "Current month usage tracking"
    },
    
    familyMembers: {
      type: "integer",
      default: 1,
      comment: "Number of family members allowed (for patient plans)"
    },
    
    originalTier: {
      type: "varchar",
      nullable: true,
      comment: "Track legacy tier for migration purposes"
    },
    
    billingCycle: {
      type: "enum",
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly"
    },
    
    metadata: {
      type: "jsonb",
      nullable: true,
      default: () => "'{}'",
      comment: "Additional subscription metadata"
    },

    // Timestamps
    updatedAt: {
      type: "timestamp",
      updateDate: true
    },
    
    canceledAt: {
      type: "timestamp",
      nullable: true
    },
    
    pausedAt: {
      type: "timestamp", 
      nullable: true
    }
  },
  
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",

      inverseSide: "subscriptions",
      joinColumn: { name: "userId" }
    }
  },
  
  indices: [
    { columns: ["userId"] },
    { columns: ["status"] },
    { columns: ["tier"] },
    { columns: ["planType"] },
    { columns: ["nextBillingDate"] },
    { columns: ["createdAt"] }
  ]
});