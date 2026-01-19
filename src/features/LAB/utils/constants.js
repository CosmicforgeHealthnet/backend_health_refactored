const LAB_ROLES = {
    LAB_ADMIN: "lab_admin",
    LAB_MANAGER: "lab_manager", 
    SAMPLE_COLLECTOR: "sample_collector",
    LAB_TECHNICIAN: "lab_technician",
    RADIOLOGIST: "radiologist",
    RESULT_REVIEWER: "result_reviewer"
  };
  
  const FACILITY_STATUS = {
    DRAFT: 'draft',
    PENDING_APPROVAL: "pending_approval",
    APPROVED: "approved", 
    REJECTED: "rejected",
    SUSPENDED: "suspended",
    ACTIVE: "active"
  };
  
  const FACILITY_TYPES = {
    DIAGNOSTIC_LAB: "diagnostic_lab",
    PATHOLOGY_LAB: "pathology_lab", 
    RADIOLOGY_CENTER: "radiology_center",
    MEDICAL_CENTER: "medical_center",
    HOSPITAL_LAB: "hospital_lab"
  };


  const PERSONNEL_ROLE = {
    LAB_MANAGER: "lab_manager", 
    SAMPLE_COLLECTOR: "sample_collector",
    LAB_TECHNICIAN: "lab_technician",
    RADIOLOGIST: "radiologist",
    RESULT_REVIEWER: "result_reviewer"
  };
  
  const PERSONNEL_STATUS = {
    PENDING_REGISTRATION: "pending_registration", // User account not created yet
    INVITATION_SENT: "invitation_sent",           // Registration email sent
    REGISTERED: "registered",                     // User registered but not confirmed
    ACTIVE: "active",                            // Fully active
    SUSPENDED: "suspended",
    TERMINATED: "terminated"
  };
  const ORDER_STATUS = {
    CREATED: "created",                    // Patient created order
    PENDING_PAYMENT: "pending_payment",   // Invoice sent, awaiting payment
    PAYMENT_CONFIRMED: "payment_confirmed", // Payment received
    ASSIGNED: "assigned",                  // Personnel assigned
    SCHEDULED: "scheduled",               // Appointment scheduled
    IN_PROGRESS: "in_progress",           // Collection/radiology in progress
    SAMPLE_COLLECTED: "sample_collected", // Sample collected or radiology completed
    PROCESSING: "processing",             // Lab technician processing
    RESULTS_READY: "results_ready",       // Results generated, pending review
    UNDER_REVIEW: "under_review",         // Result reviewer checking
    REVISION_REQUIRED: "revision_required", // Sent back for corrections
    RESULTS_APPROVED: "results_approved", // Quality control passed
    COMPLETED: "completed",               // Results delivered to patient
    CANCELLED: "cancelled"                // Order cancelled
  };
  
  const SERVICE_TYPE = {
    LAB_VISIT: "lab_visit",              // Patient visits lab
    HOME_COLLECTION: "home_collection"   // Sample collected at home
  };
  
  const ORDER_TYPE = {
    LAB_TEST: "lab_test",                // Blood work, urine analysis, etc.
    RADIOLOGY: "radiology"               // X-rays, MRI, CT scans, etc.
  };
  
  const PAYMENT_STATUS = {
    PENDING: "pending",
    PAID: "paid",
    FAILED: "failed",
    REFUNDED: "refunded"
  };

  // Constants for wallet system
const WALLET_TYPE = {
  PATIENT: "patient",
  FACILITY: "facility"
};

const WALLET_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  FROZEN: "frozen",
  CLOSED: "closed"
};

const TRANSACTION_TYPE = {
  CREDIT: "credit",           // Money added to wallet
  DEBIT: "debit",            // Money removed from wallet
  PAYMENT: "payment",        // Payment for lab order
  REFUND: "refund",          // Refund from cancelled order
  TOPUP: "topup",           // Wallet top-up
  TRANSFER: "transfer",      // Transfer between wallets
  FEE: "fee",               // Platform/processing fee
  EARNING: "earning",        // Facility earnings
  WITHDRAWAL: "withdrawal"   // Facility withdrawal
};

const TRANSACTION_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REVERSED: "reversed"
};

const PAYMENT_METHOD = {
  CREDIT_CARD: "credit_card",
  DEBIT_CARD: "debit_card",
  BANK_TRANSFER: "bank_transfer",
  DIGITAL_WALLET: "digital_wallet",
  PAYPAL: "paypal",
  STRIPE: "stripe",
  WALLET_BALANCE: "wallet_balance"
};

const TOPUP_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled"
};

  
  module.exports = {
    LAB_ROLES,
    FACILITY_STATUS, 
    FACILITY_TYPES,
    PERSONNEL_STATUS,
    PERSONNEL_ROLE,
    ORDER_STATUS,
    ORDER_TYPE,
    SERVICE_TYPE,
    PAYMENT_STATUS,
    WALLET_TYPE,
    WALLET_STATUS,
    TRANSACTION_TYPE,
    TRANSACTION_STATUS,
    PAYMENT_METHOD,
    TOPUP_STATUS
  };