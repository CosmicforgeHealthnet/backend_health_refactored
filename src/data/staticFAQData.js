// =====================================================
// STATIC FAQ DATA
// =====================================================

// src/data/staticFAQData.js
class StaticFAQData {

  /**
   * Get all static FAQ data
   */
  getStaticFAQsData() {
    return [
      ...this.getPatientFAQs(),
      ...this.getDoctorFAQs(),
      ...this.getGeneralFAQs()
    ];
  }

  /**
   * Get patient-specific FAQs
   */
  getPatientFAQs() {
    return [
      {
        title: "How do I book an appointment with a doctor?",
        content: `To book an appointment:
        
1. **Search for doctors** using our search feature or browse by specialty
2. **View doctor profiles** to check their qualifications, availability, and ratings
3. **Select a time slot** that works for your schedule
4. **Provide basic information** about your consultation needs
5. **Complete payment** to confirm your booking
6. **Receive confirmation** via email with appointment details

You can manage all your appointments from your patient dashboard.`,
        slug: "how-to-book-appointment",
        targetRole: "patient",
        searchKeywords: "book appointment scheduling doctor consultation",
        relatedLinks: [
          { text: "Find Doctors", url: "/doctors" },
          { text: "My Appointments", url: "/patient/appointments" }
        ],
        priority: 10
      },
      {
        title: "What payment methods do you accept?",
        content: `We accept the following payment methods:

**Credit/Debit Cards:**
- Visa, Mastercard, American Express
- Secure encryption for all transactions

**Digital Wallets:**
- PayPal
- Apple Pay (iOS devices)
- Google Pay (Android devices)

**Bank Transfers:**
- Direct bank transfers for premium consultations

All payments are processed securely and you'll receive an instant receipt via email.`,
        slug: "payment-methods",
        targetRole: "patient",
        searchKeywords: "payment methods credit card paypal billing",
        priority: 9
      },
      {
        title: "How do I access my medical records?",
        content: `You can access your medical records by:

1. **Login to your account** and go to your patient dashboard
2. **Click on 'Medical Records'** in the sidebar
3. **View your consultation history** including notes, prescriptions, and test results
4. **Download reports** in PDF format for your records
5. **Share with other doctors** using our secure sharing feature

Your medical data is encrypted and only accessible by you and doctors you've consulted with.`,
        slug: "access-medical-records",
        targetRole: "patient",
        searchKeywords: "medical records consultation history prescriptions",
        priority: 8
      },
      {
        title: "How do I cancel or reschedule my appointment?",
        content: `**To Cancel an Appointment:**

1. Go to **Patient Dashboard > My Appointments**
2. Find the appointment you want to cancel
3. Click **"Cancel Appointment"**
4. Provide a reason for cancellation
5. Confirm cancellation

**To Reschedule an Appointment:**

1. Go to **Patient Dashboard > My Appointments**
2. Click **"Reschedule"** on the appointment
3. Select a new available time slot
4. Confirm the new time

**Cancellation Policy:**
- Free cancellation up to 2 hours before appointment
- 50% refund for cancellations within 2 hours
- No refund for no-shows

**Emergency Cancellations:**
If you have a medical emergency, contact our support team immediately.`,
        slug: "cancel-reschedule-appointment",
        targetRole: "patient",
        searchKeywords: "cancel reschedule appointment refund policy",
        relatedLinks: [
          { text: "My Appointments", url: "/patient/appointments" },
          { text: "Contact Support", url: "/support" }
        ],
        priority: 7
      },
      {
        title: "How do video consultations work?",
        content: `**Before Your Video Consultation:**

1. **Test your device** - Ensure camera and microphone work
2. **Check internet connection** - Stable broadband recommended
3. **Prepare your space** - Find a quiet, well-lit room
4. **Have documents ready** - Previous medical records, current medications

**During the Consultation:**

1. **Join the call** 5 minutes before your appointment
2. **Share your screen** if needed to show documents
3. **Take notes** or ask the doctor to summarize key points
4. **Ask questions** - Don't hesitate to clarify anything

**After the Consultation:**

1. **Receive consultation summary** via email
2. **Access prescriptions** in your patient dashboard
3. **Book follow-up** if recommended by the doctor
4. **Rate your experience** to help improve our service

**Technical Requirements:**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Camera and microphone
- Stable internet connection (minimum 1 Mbps)`,
        slug: "video-consultations-how-they-work",
        targetRole: "patient",
        searchKeywords: "video consultation online appointment telemedicine",
        priority: 9
      },
      {
        title: "What if I'm not satisfied with my consultation?",
        content: `We want you to have the best possible experience. If you're not satisfied:

**Immediate Steps:**

1. **Discuss concerns** with your doctor during the consultation
2. **Contact support** within 24 hours of your appointment
3. **Provide specific feedback** about what went wrong

**Our Resolution Process:**

1. **Review your case** within 2 business days
2. **Investigate the issue** with the doctor if needed
3. **Offer appropriate solutions** which may include:
   - Free follow-up consultation
   - Consultation with a different doctor
   - Partial or full refund
   - Additional support resources

**When We Offer Refunds:**
- Technical issues that prevented proper consultation
- Doctor no-show or significant delay
- Consultation was significantly shorter than expected
- Medical advice was clearly inappropriate

**Quality Assurance:**
All consultations are reviewed for quality, and we take feedback seriously to continuously improve our service.`,
        slug: "unsatisfied-consultation-resolution",
        targetRole: "patient",
        searchKeywords: "unsatisfied consultation refund complaint resolution",
        priority: 6
      }
    ];
  }

  /**
   * Get doctor-specific FAQs
   */
  getDoctorFAQs() {
    return [
      {
        title: "How do I get verified as a doctor?",
        content: `To get verified on our platform:

**Step 1: Complete Your Profile**
- Add your medical license number
- Upload your credentials and certificates
- Provide practice information

**Step 2: Document Verification**
- Upload clear photos of your medical license
- Provide proof of current practice
- Submit any specialty certifications

**Step 3: Review Process**
- Our team reviews your credentials (2-5 business days)
- We may contact you for additional information
- You'll receive email updates on your verification status

**After Approval:**
- Your profile gets a verified badge
- You can start accepting patient consultations
- Access to doctor tools and analytics
- Automatic wallet and subscription setup

Need help? Contact our verification team at verify@yourapp.com`,
        slug: "doctor-verification-process",
        targetRole: "doctor",
        searchKeywords: "verification medical license credentials approval",
        relatedLinks: [
          { text: "Submit Verification", url: "/doctor/verification" },
          { text: "Verification Status", url: "/doctor/verification/status" }
        ],
        priority: 10
      },
      {
        title: "How do I set my consultation fees and availability?",
        content: `**Setting Your Consultation Fees:**

1. Go to **Doctor Dashboard > Pricing**
2. Set different rates for:
   - Video consultations
   - Chat consultations
   - Follow-up consultations
3. Choose your currency
4. Set special rates for different consultation types

**Managing Your Availability:**

1. Go to **Doctor Dashboard > Availability**
2. Set your **weekly schedule** with time slots
3. **Block specific dates** for vacations or meetings
4. Set **buffer time** between consultations
5. Enable **emergency availability** for urgent cases

**Pro Tips:**
- Review and adjust rates based on demand
- Keep availability updated to avoid conflicts
- Use our calendar integration for seamless scheduling
- Consider offering different pricing for new vs. returning patients`,
        slug: "set-fees-availability",
        targetRole: "doctor",
        searchKeywords: "consultation fees pricing availability schedule calendar",
        priority: 9
      },
      {
        title: "How do I receive payments and track earnings?",
        content: `**Payment Processing:**

- Patients pay upfront for consultations
- Funds are held securely until consultation completion
- Automatic release 24 hours after consultation (or immediately with patient confirmation)

**Commission Structure:**
- Free Plan: 30% platform commission
- Basic Plan: 20% platform commission  
- Premium Plan: 15% platform commission

**Accessing Your Earnings:**

1. Go to **Doctor Dashboard > Wallet**
2. View your **current balance** and **pending payments**
3. See detailed **transaction history**
4. Track **monthly/yearly earnings**

**Withdrawals:**
- Minimum withdrawal: $50
- Processing time: 3-5 business days
- Direct deposit to your registered bank account
- Detailed earning reports available for tax purposes

**Payment Protection:**
- Dispute resolution system
- Insurance coverage for platform issues
- Secure escrow system protects both parties`,
        slug: "payments-earnings",
        targetRole: "doctor",
        searchKeywords: "payments earnings wallet withdrawal commission fees",
        relatedLinks: [
          { text: "Doctor Wallet", url: "/doctor/wallet" },
          { text: "Subscription Plans", url: "/doctor/subscription" }
        ],
        priority: 8
      },
      {
        title: "What tools are available for consultations?",
        content: `**Video Consultations:**
- HD video calling with screen sharing
- Recording capabilities (with patient consent)
- Multi-device support (desktop, tablet, mobile)
- Virtual whiteboard for explanations

**Chat Consultations:**
- Real-time messaging
- File and image sharing
- Voice message support
- Prescription templates
- Quick response templates

**Patient Management:**
- Complete consultation history
- Digital prescription writing
- Secure file sharing
- Follow-up scheduling
- Patient notes and annotations

**Clinical Tools:**
- Symptom assessment templates
- Treatment plan builders
- Drug interaction checker
- Clinical calculators
- Medical reference library

**Documentation:**
- Automated consultation notes
- Custom templates
- Export to PDF
- Integration with external EMR systems
- Billing and invoice generation`,
        slug: "consultation-tools",
        targetRole: "doctor",
        searchKeywords: "video chat tools consultation features prescriptions",
        priority: 7
      },
      {
        title: "How do I handle difficult patients or situations?",
        content: `**Professional Guidelines:**

**Communication Best Practices:**
- Remain calm and professional
- Listen actively to patient concerns
- Set clear boundaries and expectations
- Document all interactions thoroughly

**Common Difficult Situations:**

**Angry or Upset Patients:**
- Acknowledge their feelings
- Ask specific questions about their concerns
- Explain your recommendations clearly
- Offer alternative solutions when possible

**Patients Seeking Inappropriate Prescriptions:**
- Follow medical guidelines strictly
- Explain why certain medications aren't appropriate
- Suggest alternative treatments
- Document the interaction

**Technical Issues:**
- Have backup communication methods ready
- Reschedule if quality is severely compromised
- Contact technical support immediately
- Follow up with the patient

**When to End a Consultation:**
- Patient becomes abusive or threatening
- Patient requests illegal activities
- Technical issues cannot be resolved
- Patient appears under the influence

**Platform Support:**
- Report concerning behavior immediately
- Use our consultation termination feature
- Contact support for guidance
- All consultations are logged for your protection`,
        slug: "handling-difficult-patients",
        targetRole: "doctor",
        searchKeywords: "difficult patients professional guidelines consultation management",
        priority: 6
      },
      {
        title: "What are my legal responsibilities as a doctor on the platform?",
        content: `**Professional Responsibilities:**

**Medical License:**
- Maintain valid medical license in your jurisdiction
- Only practice within your licensed scope
- Report any license changes or issues immediately

**Standard of Care:**
- Provide care meeting professional standards
- Follow applicable medical guidelines
- Maintain appropriate documentation
- Ensure continuity of care when needed

**Patient Confidentiality:**
- Maintain HIPAA compliance (US) or equivalent
- Use only platform-approved communication methods
- Secure all patient information
- Report any data breaches immediately

**Prescribing Responsibilities:**
- Follow controlled substance regulations
- Verify patient identity before prescribing
- Maintain prescription records
- Only prescribe within your expertise

**Platform Compliance:**
- Follow platform terms of service
- Report safety concerns
- Participate in quality assurance reviews
- Maintain professional conduct

**Malpractice Insurance:**
- Ensure your malpractice insurance covers telemedicine
- Verify coverage for cross-jurisdictional practice
- Keep insurance current and documented

**Emergency Situations:**
- Have protocols for emergency referrals
- Know when to direct patients to emergency care
- Maintain emergency contact procedures

**Legal Protection:**
We provide legal support resources and maintain comprehensive logs of all platform interactions for your protection.`,
        slug: "legal-responsibilities-doctors",
        targetRole: "doctor",
        searchKeywords: "legal responsibilities malpractice license compliance",
        priority: 5
      }
    ];
  }

  /**
   * Get general FAQs for all users
   */
  getGeneralFAQs() {
    return [
      {
        title: "Is my personal information secure?",
        content: `**Data Security Measures:**

- **End-to-end encryption** for all communications
- **HIPAA compliant** data handling
- **SOC 2 certified** infrastructure
- **Regular security audits** by third-party experts

**What We Protect:**
- Personal identification information
- Medical records and consultation history
- Payment and billing information
- All communication between patients and doctors

**Your Privacy Rights:**
- Control who can access your information
- Right to download your data
- Right to delete your account and data
- Transparent privacy policy

**Compliance:**
- GDPR compliant for international users
- HIPAA compliant for US healthcare data
- Regular compliance audits and updates

**Security Features:**
- Two-factor authentication
- Session timeout protection
- Automatic logout on suspicious activity
- Real-time security monitoring

We never sell your personal information to third parties.`,
        slug: "data-security-privacy",
        targetRole: "general",
        searchKeywords: "security privacy HIPAA encryption data protection",
        priority: 9
      },
      {
        title: "How do I contact customer support?",
        content: `**Get Help When You Need It:**

**Live Chat Support:**
- Available 24/7 for urgent issues
- Average response time: 2-3 minutes
- Click the chat icon in the bottom right

**Email Support:**
- General inquiries: support@yourapp.com
- Technical issues: tech@yourapp.com
- Billing questions: billing@yourapp.com
- Response time: 4-6 hours

**Phone Support:**
- Available Monday-Friday, 9 AM - 6 PM EST
- Call: 1-800-HEALTH (1-800-432-5844)

**Help Center:**
- Comprehensive FAQ database
- Video tutorials
- Step-by-step guides
- Downloadable resources

**Submit a Ticket:**
- Detailed issue tracking
- File attachments supported
- Priority escalation available
- Email notifications on updates

**Emergency Medical Issues:**
Please call your local emergency services (911) for immediate medical emergencies. Our platform is not for emergency medical care.`,
        slug: "contact-support",
        targetRole: "general",
        searchKeywords: "support help contact chat email phone emergency",
        priority: 8
      },
      {
        title: "What are your refund and cancellation policies?",
        content: `**Consultation Cancellations:**

**Patient Cancellations:**
- Free cancellation up to 2 hours before appointment
- 50% refund for cancellations within 2 hours
- No refund for no-shows

**Doctor Cancellations:**
- Full refund if doctor cancels
- Priority rebooking with same or similar doctor
- Automatic refund processing within 3-5 business days

**Refund Policies:**

**Eligible for Full Refund:**
- Technical issues preventing consultation
- Doctor no-show or cancellation
- Platform downtime during scheduled appointment

**Partial Refunds:**
- Patient cancellation within 2 hours of appointment
- Consultation shorter than 5 minutes due to technical issues

**No Refunds:**
- Patient no-shows
- Patient dissatisfaction with medical advice
- Cancellations less than 30 minutes before appointment

**Subscription Refunds:**
- Pro-rated refunds for subscription downgrades
- No refunds for monthly subscriptions after 7 days
- Annual subscriptions: refundable within 30 days

**Processing Time:**
- Refunds processed within 3-5 business days
- Original payment method will be credited
- Email confirmation sent when processed

Contact support for refund requests: billing@yourapp.com`,
        slug: "refund-cancellation-policy",
        targetRole: "general",
        searchKeywords: "refund cancellation policy money back billing",
        priority: 7
      },
      {
        title: "What devices and browsers are supported?",
        content: `**Supported Browsers:**

**Desktop/Laptop:**
- Google Chrome (recommended) - Version 90+
- Mozilla Firefox - Version 88+
- Safari - Version 14+
- Microsoft Edge - Version 90+

**Mobile Browsers:**
- Chrome Mobile - Latest version
- Safari Mobile - iOS 14+
- Samsung Internet - Latest version

**Mobile Apps:**
- iOS App - iOS 14.0 or later
- Android App - Android 8.0 (API level 26) or later

**System Requirements:**

**Minimum Requirements:**
- 2GB RAM
- 1 Mbps internet connection
- Camera and microphone for video calls
- Modern processor (2015 or newer)

**Recommended Requirements:**
- 4GB RAM or more
- 5 Mbps internet connection
- HD camera and quality microphone
- Latest browser versions

**Not Supported:**
- Internet Explorer (any version)
- Browsers with JavaScript disabled
- Very old mobile devices (2018 or older)

**Troubleshooting:**
- Clear browser cache if experiencing issues
- Disable browser extensions if problems persist
- Use incognito/private mode for testing
- Contact support for device-specific help`,
        slug: "supported-devices-browsers",
        targetRole: "general",
        searchKeywords: "browsers devices mobile app requirements compatibility",
        priority: 6
      },
      {
        title: "How do I create and manage my account?",
        content: `**Creating Your Account:**

1. **Visit our website** and click "Sign Up"
2. **Choose your role** - Patient or Doctor
3. **Provide basic information** - Name, email, phone
4. **Verify your email** through the confirmation link
5. **Complete your profile** with additional details

**Account Security:**

**Strong Password Requirements:**
- At least 8 characters long
- Include uppercase and lowercase letters
- Include numbers and special characters
- Avoid common words or personal information

**Two-Factor Authentication (2FA):**
- Enable 2FA in account settings
- Use authenticator apps (Google Authenticator, Authy)
- Backup codes for emergency access

**Managing Your Profile:**

**Personal Information:**
- Update contact details anytime
- Change profile picture
- Modify privacy settings
- Update notification preferences

**For Patients:**
- Add emergency contacts
- Update medical history
- Manage insurance information
- Set appointment preferences

**For Doctors:**
- Complete professional profile
- Upload credentials and certifications
- Set practice information
- Configure consultation preferences

**Account Deletion:**
- Request account deletion through settings
- Data retention period: 30 days for recovery
- Complete data removal after 30 days
- Download your data before deletion`,
        slug: "create-manage-account",
        targetRole: "general",
        searchKeywords: "account creation profile management security settings",
        priority: 8
      },
      {
        title: "What is telemedicine and how does it work?",
        content: `**What is Telemedicine?**

Telemedicine is the practice of caring for patients remotely when the provider and patient are not physically present with each other. It uses technology to deliver health services and share medical information.

**Types of Telemedicine:**

**Video Consultations:**
- Real-time video calls with healthcare providers
- Similar to in-person visits but conducted remotely
- Best for consultations, follow-ups, and diagnoses

**Chat Consultations:**
- Text-based communication with doctors
- Ideal for quick questions and advice
- Convenient for non-urgent medical concerns

**Store-and-Forward:**
- Sharing medical information (images, test results)
- Doctor reviews and responds when convenient
- Useful for specialist consultations

**Benefits of Telemedicine:**

**For Patients:**
- Convenient access from home
- Reduced travel time and costs
- Access to specialists regardless of location
- Flexible scheduling options
- Safer during pandemics or illness

**For Healthcare Providers:**
- Expanded reach to patients
- Flexible working arrangements
- Reduced overhead costs
- Better patient engagement
- Efficient use of time

**Limitations:**

**What Telemedicine Cannot Do:**
- Physical examinations requiring touch
- Emergency medical situations
- Complex procedures or surgeries
- Laboratory tests or imaging

**When to Use Telemedicine:**
- Routine follow-up appointments
- Prescription refills
- Minor illness consultations
- Mental health counseling
- Chronic disease management
- Second opinions

**Quality of Care:**
Research shows telemedicine can be as effective as in-person care for many conditions when used appropriately.`,
        slug: "what-is-telemedicine",
        targetRole: "general",
        searchKeywords: "telemedicine definition benefits limitations online healthcare",
        priority: 9
      }
    ];
  }

  /**
   * Get FAQs by category
   */
  getFAQsByCategory(category) {
    const allFAQs = this.getStaticFAQsData();
    
    const categoryMap = {
      'appointments': ['appointment', 'booking', 'schedule', 'cancel'],
      'payments': ['payment', 'billing', 'refund', 'fee'],
      'technical': ['browser', 'device', 'technical', 'support'],
      'verification': ['verification', 'license', 'credential'],
      'security': ['security', 'privacy', 'data', 'HIPAA'],
      'consultation': ['consultation', 'video', 'chat', 'telemedicine']
    };

    if (!categoryMap[category]) {
      return allFAQs;
    }

    return allFAQs.filter(faq => 
      categoryMap[category].some(keyword => 
        faq.searchKeywords.toLowerCase().includes(keyword) ||
        faq.title.toLowerCase().includes(keyword) ||
        faq.content.toLowerCase().includes(keyword)
      )
    );
  }

  /**
   * Get FAQs by target role
   */
  getFAQsByRole(role) {
    const allFAQs = this.getStaticFAQsData();
    
    if (role === 'all') {
      return allFAQs;
    }
    
    return allFAQs.filter(faq => 
      faq.targetRole === role || faq.targetRole === 'general'
    );
  }

  /**
   * Get priority FAQs for homepage/dashboard
   */
  getPriorityFAQs(role = 'general', limit = 5) {
    const faqs = this.getFAQsByRole(role);
    
    return faqs
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, limit);
  }

  /**
   * Search static FAQs
   */
  searchFAQs(query, role = null) {
    const faqs = role ? this.getFAQsByRole(role) : this.getStaticFAQsData();
    
    if (!query || query.trim() === '') {
      return faqs;
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    return faqs.filter(faq => 
      faq.title.toLowerCase().includes(searchTerm) ||
      faq.content.toLowerCase().includes(searchTerm) ||
      faq.searchKeywords.toLowerCase().includes(searchTerm)
    );
  }
}

module.exports = new StaticFAQData();