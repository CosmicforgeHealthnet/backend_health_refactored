// config/searchConfig.js

const ENTITY_PERMISSIONS = {
  User: {
    patient: ['fullName', 'specialty', 'isAvailable', 'profilePicture'],
    doctor: ['fullName', 'email', 'phone', 'lastVisit'],
    admin: ['*']
  },
  Appointment: {
    patient: ['title', 'appointmentDate', 'status', 'duration'],
    doctor: ['title', 'appointmentDate', 'status', 'patientName', 'notes'],
    admin: ['*']
  },
  Transaction: {
    patient: ['originalAmount', 'originalCurrency', 'status', 'serviceType', 'createdAt'],
    doctor: ['originalAmount', 'originalCurrency', 'status', 'serviceType', 'createdAt'],
    admin: ['*']
  },
  Subscription: {
    patient: [],
    doctor: ['tier', 'status', 'price', 'endDate', 'commissionRate'],
    admin: ['*']
  }
};

const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'salt', 'socialSecurityNumber',
  'creditCardNumber', 'bankDetails', 'privateNotes', 'internalComments',
  'adminNotes', 'debugInfo', 'apiKeys', 'tokens', 'secrets'
];

const SENSITIVE_ENTITIES = [
  // Original sensitive entities
  'UserSession', 'AuditLog', 'SystemConfig', 'BackupRecord',
  'SecurityLog', 'PaymentToken', 'ApiKey', 'InternalNote',
  
  // 🔒 SECURITY: Add highly sensitive entities that should NEVER be searchable
  'RefreshToken',           // Contains token hashes, device fingerprints
  'DocumentFile',           // Contains encryption keys, file hashes, paths
  'Consent',                // Personal medical consent data
  'Notification',           // Private user notifications
  'AuthEvent',              // Authentication logs with IPs, user agents
  'VerificationDocument',   // Sensitive verification documents
  'VerificationStatusHistory', // Internal verification process data
  'VerificationApiLog',     // API logs with sensitive request/response data
  'FolderAccessLog',        // File access logs with IPs
  'FileAccessLog',          // File access tracking
  'WalletWithdrawal',       // Financial withdrawal data
  'DoctorWallet',           // Wallet balances and bank details
  'UserPaymentMethod',      // Payment method tokens and details
  'TransactionSplit',       // Financial transaction splits
  'Dispute',                // Dispute details and admin notes
  'ProfessionalLicense',    // Medical license data
  'DoctorAvailability',     // Doctor schedule data
  'DoctorPricing',          // Doctor pricing information
  'DoctorUnavailability'    // Doctor unavailability reasons
];

const SEARCHABLE_COLUMN_TYPES = [
  'varchar', 'text', 'string', 'character varying'
];

const SEARCHABLE_COLUMN_NAMES = [
  // Core identifiers
  'name', 'title', 'description', 'email', 'phone', 'address',
  
  // Medical terms
  'specialty', 'reason', 'notes', 'type', 'status', 'symptoms',
  'diagnosis', 'treatment', 'condition', 'comment', 'message',
  
  // Dynamic patterns - any column containing these words will be searchable
  'text', 'info', 'detail', 'content', 'value', 'data',
  'label', 'tag', 'category', 'subject', 'topic', 'keyword',
  'summary', 'overview', 'review', 'feedback', 'response',
  'instruction', 'guidance', 'recommendation', 'advice',
  'history', 'background', 'experience', 'qualification',
  'skill', 'expertise', 'knowledge', 'education', 'training',
  'certification', 'license', 'credential', 'achievement',
  'goal', 'objective', 'purpose', 'intention', 'plan',
  'procedure', 'protocol', 'method', 'approach', 'strategy',
  'result', 'outcome', 'finding', 'observation', 'report',
  'analysis', 'assessment', 'evaluation', 'measurement',
  'medication', 'prescription', 'dosage', 'allergy', 'reaction',
  'vitals', 'weight', 'height', 'pressure', 'temperature',
  'preference', 'setting', 'option', 'choice', 'selection',
  'location', 'position', 'place', 'venue', 'facility',
  'contact', 'communication', 'correspondence', 'notification'
];

// Add this new function to make it truly dynamic
const isDynamicallySearchable = (columnName) => {
  const name = columnName.toLowerCase();
  
  // Always exclude sensitive patterns
  const sensitivePatterns = ['password', 'hash', 'token', 'key', 'secret', 'private'];
  if (sensitivePatterns.some(pattern => name.includes(pattern))) {
    return false;
  }
  
  // Include if it matches any searchable pattern
  return SEARCHABLE_COLUMN_NAMES.some(pattern => name.includes(pattern)) ||
         // Include common suffixes that suggest searchable content
         name.endsWith('name') || name.endsWith('text') || name.endsWith('info') ||
         name.endsWith('description') || name.endsWith('note') || name.endsWith('comment') ||
         // Include common prefixes
         name.startsWith('primary') || name.startsWith('secondary') || name.startsWith('main') ||
         // Include if it's likely to contain text content (length suggests text field)
         name.length > 3; // Most meaningful searchable fields have names longer than 3 chars
};

const COLUMN_WEIGHTS = {
  name: 10,
  title: 9,
  fullName: 10,
  email: 8,
  description: 5,
  specialty: 7,
  address: 3,
  phone: 6
};

const USER_FILTERS = {
  patient: {
    User: { role: 'doctor', status: 'active' },
    Appointment: { patientId: 'USER_ID' },
    Transaction: { patientId: 'USER_ID' },
    // Subscription: { userId: 'USER_ID' }
  },
  doctor: {
    Appointment: { doctorId: 'USER_ID' },
    Transaction: { doctorId: 'USER_ID' },
    User: 'CUSTOM_FUNCTION' // Will be handled by custom function
  },
  admin: {
    // Admins have broader access but still exclude sensitive data
  }
};

const COMMON_SEARCH_TERMS = {
  patient: [
    'doctor', 'appointment', 'consultation', 'prescription',
    'cardiology', 'dermatology', 'pediatrics', 'neurology'
  ],
  doctor: [
    'patient', 'appointment', 'schedule', 'prescription',
    'treatment', 'diagnosis', 'follow-up', 'consultation'
  ],
  admin: [
    'user', 'transaction', 'payment', 'subscription',
    'analytics', 'report', 'system', 'configuration'
  ]
};

const SEARCH_SETTINGS = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS_PER_ENTITY: 10,
  MAX_SUGGESTIONS: 5,
  CACHE_TTL: 3600, // 1 hour
  MAX_QUERY_LENGTH: 50
};

const SENSITIVE_PATTERNS = [
  /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // Credit card pattern
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
  /@.*\.com/, // Email pattern (might be sensitive)
];

module.exports = {
  ENTITY_PERMISSIONS,
  SENSITIVE_FIELDS,
  SENSITIVE_ENTITIES,
  SEARCHABLE_COLUMN_TYPES,
  SEARCHABLE_COLUMN_NAMES,
  COLUMN_WEIGHTS,
  USER_FILTERS,
  COMMON_SEARCH_TERMS,
  SEARCH_SETTINGS,
  SENSITIVE_PATTERNS,
  isDynamicallySearchable
};