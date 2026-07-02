const AppDataSource = require('../../../config/database');
const { USER_ROLES } = require('../../../shared/utils/constants');

const PLATFORM_OVERVIEW = `You are CosmicForge Health's AI support assistant. CosmicForge is a comprehensive digital health platform operating in Nigeria that connects patients, doctors, pharmacies, labs, and health vendors.

PLATFORM FEATURES:
- Doctor-patient appointment booking (video via Jitsi/Zoom/Google Meet, or in-person)
- Pharmacy order management with prescription-based and direct purchase workflows
- Lab test booking with sample collection and digital results delivery
- Vendor e-commerce shops for health/wellness products with cart, checkout, and delivery
- Wallet and payment system (Paystack integration; 7% platform fee added on top of order subtotals — paid by the customer, not deducted from vendors)
- Referral program with reward draws
- Subscription tiers: Free, Basic, Standard, Medium, Premium, Gold Elite, Professional
- Real-time chat during doctor-patient appointments
- Document management and FHIR-compliant health records
- First Aid and SOS emergency feature
- Compliance and data governance tools
- Admin verification workflows for doctors, pharmacies, labs, and vendors

ESCALATION RULES:
You MUST escalate by responding with ONLY this exact JSON (no other text before or after) when:
1. User explicitly asks for a human agent, live support, or real person
2. User has a complaint about staff, service quality, or a transaction that went wrong
3. Issue involves account suspension, ban, or unauthorized access
4. Billing dispute, refund request, or failed payment that standard information cannot resolve
5. You genuinely cannot answer the question accurately AFTER checking all the context and platform stats provided
6. User appears very frustrated (repeating the same issue multiple times)
7. Legal, compliance, or medical emergency issues

DO NOT escalate for:
- Questions about how many doctors, pharmacies, labs, or vendors are on the platform — the exact numbers are in the Live Data section, use them
- General how-to questions about platform features
- Questions the user's own data can answer (orders, appointments, profile)

ESCALATION JSON FORMAT (use EXACTLY this — no extra text):
{"escalate":true,"reason":"<one sentence reason>","message":"<friendly message telling the user you are connecting them to a live agent>"}

For all other questions: answer directly, specifically, and helpfully. Be concise. Use plain language. Reference the user's actual data where available.`;

const ROLE_GUIDES = {
  [USER_ROLES.PATIENT]: `This user is a PATIENT. They use the platform to:
- Book appointments with doctors (video or in-person)
- Order medicines from pharmacies (with or without prescription)
- Request lab tests and view results
- Track their orders and delivery status
- Manage their health profile: genotype, blood group, medical history, allergies, medications
- Pay via wallet or card; view payment history
- Access their prescriptions
Common patient questions: order status, appointment booking, how to upload prescriptions, how to top up wallet, lab test results, how to find a doctor.`,

  [USER_ROLES.DOCTOR]: `This user is a DOCTOR. They use the platform to:
- Manage their appointment schedule and availability
- Conduct video consultations with patients
- Write and issue digital prescriptions
- View patient records during active appointments
- Manage their professional profile, specialty, and certifications
- Receive consultation fees credited to their wallet
Common doctor questions: how to set availability, how to start a video call, how to write a prescription, wallet withdrawal, profile verification status.`,

  [USER_ROLES.PHARMACY]: `This user is a PHARMACY OWNER. They use the platform to:
- Manage their pharmacy shop, products, and pricing
- Manage multiple branches
- Process incoming prescription orders from patients
- Add, edit, and remove pharmacy staff (pharmacists, managers, assistants, dispatchers)
- Track and fulfill orders; update order status
- Receive payments and manage pharmacy wallet
- View pharmacy analytics
Common pharmacy owner questions: how to add staff, how to add products, order management, verification status, wallet and payments, branch management.`,

  [USER_ROLES.PHARMACIST]: `This user is a PHARMACIST at a registered pharmacy. They can:
- View and process incoming prescription orders
- Fill and update order statuses
- View patient prescriptions assigned to their pharmacy
Common questions: how to view orders, how to update order status, how to access prescriptions.`,

  [USER_ROLES.PHARMACY_MANAGER]: `This user is a PHARMACY MANAGER. They oversee:
- Day-to-day pharmacy operations
- Order flow and inventory
- Staff coordination
Common questions: order reports, staff management, how to escalate issues to pharmacy owner.`,

  [USER_ROLES.PHARMACY_ADMIN]: `This user is a PHARMACY ADMIN handling administrative pharmacy tasks including documentation, compliance, and reporting.`,

  [USER_ROLES.PHARMACY_ASSISTANT]: `This user is a PHARMACY ASSISTANT. They help with order processing and customer service at the pharmacy counter.`,

  [USER_ROLES.DISPATCHER]: `This user is a DISPATCHER at a pharmacy. They handle delivery logistics and order dispatch. Common questions: how to update delivery status, how to view assigned dispatches.`,

  [USER_ROLES.LAB]: `This user is a LAB OWNER/ADMIN. They use the platform to:
- Register and manage their lab facility
- Onboard lab personnel (managers, technicians, radiologists, collectors, reviewers)
- View and manage test requests
- Publish and manage test results
- Handle lab billing and subscriptions
Common questions: lab verification status, how to add personnel, how to manage test types, result delivery, billing.`,

  [USER_ROLES.LAB_ADMIN]: `This user is a LAB ADMIN managing lab operations, personnel management, and test workflows on behalf of the lab facility.`,

  [USER_ROLES.LAB_MANAGER]: `This user is a LAB MANAGER. They oversee daily lab operations, staff scheduling, and test processing workflows.`,

  [USER_ROLES.LAB_TECHNICIAN]: `This user is a LAB TECHNICIAN. They process and analyze patient test samples and enter results into the system.`,

  [USER_ROLES.SAMPLE_COLLECTOR]: `This user is a SAMPLE COLLECTOR. They collect patient samples for lab tests (at lab location or via home collection).`,

  [USER_ROLES.RADIOLOGIST]: `This user is a RADIOLOGIST. They review, interpret, and report on radiology and imaging test results.`,

  [USER_ROLES.RESULT_REVIEWER]: `This user is a RESULT REVIEWER. They review and approve lab test results before they are delivered to patients.`,

  [USER_ROLES.VENDOR]: `This user is a VENDOR selling health and wellness products. They use the platform to:
- Manage their product shop (add, edit, remove products with images and pricing)
- View and fulfill customer orders
- Track their earnings and withdraw from vendor wallet
- Run product promotions and discount campaigns
- View sales analytics and performance reports
- Manage their hybrid pharmacy mode (if enabled)
Common vendor questions: how to add products, order management, how to set up promotions, wallet withdrawal, shop verification status, platform fee (7% added on top of order subtotals).`,

  [USER_ROLES.MARKETER]: `This user is a MARKETER managing the platform's referral program, marketing campaigns, and user acquisition initiatives.`
};

class AiSupportContextService {
  buildSystemPrompt(userRole, userData, liveContext) {
    const roleGuide = ROLE_GUIDES[userRole] || `This user has the role: ${userRole}.`;
    const liveDataSection = this._formatLiveContext(liveContext);

    return `${PLATFORM_OVERVIEW}

${'═'.repeat(60)}
CURRENT USER
${'═'.repeat(60)}
Name:           ${userData?.fullName || 'Unknown'}
Email:          ${userData?.email || 'Unknown'}
Role:           ${userRole?.toUpperCase()}
Account Status: ${userData?.status || 'active'}
Member Since:   ${userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-GB') : 'Unknown'}

ROLE CAPABILITIES:
${roleGuide}

${liveDataSection}
${'═'.repeat(60)}
Answer the user's question based on their role and data above. Be specific. Be helpful.`;
  }

  _formatLiveContext(liveContext) {
    if (!liveContext || Object.keys(liveContext).length === 0) {
      return 'LIVE DATA: No additional context loaded.';
    }

    const lines = ['LIVE DATA:'];

    if (liveContext.recentAppointments?.length > 0) {
      lines.push('\nRecent Appointments:');
      for (const a of liveContext.recentAppointments) {
        const date = a.scheduledAt ? new Date(a.scheduledAt).toLocaleString('en-GB') : 'N/A';
        lines.push(`  • ${a.type || 'Appointment'} | Status: ${a.status} | Date: ${date}`);
      }
    }

    if (liveContext.recentOrders?.length > 0) {
      lines.push('\nRecent Orders:');
      for (const o of liveContext.recentOrders) {
        const amount = o.grossAmount || o.totalAmount || o.subtotal || 0;
        lines.push(`  • Order #${String(o.id).slice(0, 8)} | Status: ${o.status} | Amount: ₦${amount}`);
      }
    }

    if (liveContext.pharmacyInfo) {
      const p = liveContext.pharmacyInfo;
      lines.push(`\nPharmacy: ${p.name || 'N/A'} | Verification: ${p.verificationStatus || 'N/A'}`);
    }

    if (liveContext.vendorInfo) {
      const v = liveContext.vendorInfo;
      lines.push(`\nVendor Shop: ${v.businessName || 'N/A'} | Verification: ${v.verificationStatus || 'N/A'}${v.isHybridPharmacy ? ' | Hybrid Pharmacy: Yes' : ''}`);
    }

    if (liveContext.labInfo) {
      const l = liveContext.labInfo;
      lines.push(`\nLab Facility: ${l.name || 'N/A'} | Type: ${l.facilityType || 'N/A'} | Status: ${l.status || 'N/A'}`);
    }

    if (liveContext.walletBalance !== undefined) {
      lines.push(`\nWallet Balance: ₦${liveContext.walletBalance}`);
    }

    if (liveContext.platformStats) {
      const s = liveContext.platformStats;
      lines.push('\nPlatform Stats (use these to answer platform-level questions):');
      lines.push(`  • Active Doctors: ${s.doctors}`);
      lines.push(`  • Active Pharmacies: ${s.pharmacies}`);
      lines.push(`  • Active Vendors: ${s.vendors}`);
      lines.push(`  • Active Labs: ${s.labs}`);
    }

    return lines.join('\n');
  }

  async fetchLiveContext(userId, userRole) {
    const context = {};

    try {
      // Patient: recent appointments + recent orders
      if (userRole === USER_ROLES.PATIENT) {
        await this._safeRun(async () => {
          const repo = AppDataSource.getRepository('Appointment');
          context.recentAppointments = await repo.find({
            where: { patientId: userId },
            order: { createdAt: 'DESC' },
            take: 5,
            select: ['id', 'status', 'scheduledAt', 'type']
          });
        });
      }

      // Doctor: upcoming appointments
      if (userRole === USER_ROLES.DOCTOR) {
        await this._safeRun(async () => {
          const repo = AppDataSource.getRepository('Appointment');
          context.recentAppointments = await repo.find({
            where: { doctorId: userId },
            order: { createdAt: 'DESC' },
            take: 5,
            select: ['id', 'status', 'scheduledAt', 'type']
          });
        });
      }

      // Pharmacy roles: fetch pharmacy profile
      const pharmacyRoles = [
        USER_ROLES.PHARMACY, USER_ROLES.PHARMACIST, USER_ROLES.PHARMACY_MANAGER,
        USER_ROLES.PHARMACY_ADMIN, USER_ROLES.PHARMACY_ASSISTANT, USER_ROLES.DISPATCHER
      ];
      if (pharmacyRoles.includes(userRole)) {
        await this._safeRun(async () => {
          const repo = AppDataSource.getRepository('PharmacyProfile');
          const profile = await repo.findOne({
            where: { userId },
            select: ['id', 'name', 'verificationStatus']
          });
          if (profile) context.pharmacyInfo = profile;
        });
      }

      // Vendor: vendor profile + recent orders
      if (userRole === USER_ROLES.VENDOR) {
        await this._safeRun(async () => {
          const repo = AppDataSource.getRepository('VendorProfile');
          const profile = await repo.findOne({
            where: { userId },
            select: ['id', 'businessName', 'verificationStatus', 'isHybridPharmacy']
          });
          if (profile) {
            context.vendorInfo = profile;
            const orderRepo = AppDataSource.getRepository('VendorOrder');
            context.recentOrders = await orderRepo.find({
              where: { vendorId: profile.id },
              order: { createdAt: 'DESC' },
              take: 5,
              select: ['id', 'status', 'grossAmount', 'createdAt']
            });
          }
        });
      }

      // Lab roles: fetch lab facility
      const labRoles = [
        USER_ROLES.LAB, USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_MANAGER,
        USER_ROLES.LAB_TECHNICIAN, USER_ROLES.SAMPLE_COLLECTOR,
        USER_ROLES.RADIOLOGIST, USER_ROLES.RESULT_REVIEWER
      ];
      if (labRoles.includes(userRole)) {
        await this._safeRun(async () => {
          const repo = AppDataSource.getRepository('LabFacility');
          const facility = await repo.findOne({
            where: { adminId: userId },
            select: ['id', 'name', 'status', 'facilityType']
          });
          if (facility) context.labInfo = facility;
        });
      }

      // Platform-wide stats — fetched for every user so AI can answer platform questions
      await this._safeRun(async () => {
        const userRepo = AppDataSource.getRepository('User');
        const [doctors, pharmacies, vendors, labs] = await Promise.all([
          userRepo.count({ where: { role: USER_ROLES.DOCTOR } }),
          userRepo.count({ where: { role: USER_ROLES.PHARMACY } }),
          userRepo.count({ where: { role: USER_ROLES.VENDOR } }),
          userRepo.count({ where: { role: USER_ROLES.LAB } }),
        ]);
        context.platformStats = { doctors, pharmacies, vendors, labs };
      });

    } catch (error) {
      // Context fetch errors must never block the chat response
      console.error('[AiSupportContext] Non-blocking context fetch error:', error.message);
    }

    return context;
  }

  async _safeRun(fn) {
    try {
      await fn();
    } catch {
      // Silently skip — table may not exist or schema differs
    }
  }
}

module.exports = AiSupportContextService;
