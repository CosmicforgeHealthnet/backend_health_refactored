// src/services/emailHelpers.js
const emailService = require("../emailService");

async function sendVerificationEmail(user, token, expiresInMinutes = 60) {
  const link = `${process.env.APP_BASE_URL}/auth/verify-email?token=${token}`;
  await emailService.send(
    "verification",
    user.email,
    "Verify your CosmicForge account",
    { fullName: user.fullName, link, expiresInMinutes }
  );
}

async function sendPasswordResetEmail(user, token, expiresInMinutes = 60) {
  const link = `${process.env.APP_BASE_URL}/auth/reset-password?token=${token}`;
  await emailService.send(
    "reset_password",
    user.email,
    "Reset your CosmicForge password",
    { fullName: user.fullName, link, expiresInMinutes }
  );
}

async function sendVerificationOtpEmail(user, otp, expiresInMinutes = 15) {
  await emailService.send(
    "verification_otp",
    user.email,
    "Your CosmicForge verification code",
    { fullName: user.fullName, otp, expiresInMinutes }
  );
}

async function sendPasswordResetOtpEmail(user, otp, expiresInMinutes = 15) {
  await emailService.send(
    "password_reset_otp",
    user.email,
    "Your CosmicForge password reset code",
    { fullName: user.fullName, otp, expiresInMinutes }
  );
}

// send magiclink
async function sendMagicLinkEmail(user, token, expiresInMinutes, purpose) {
  const link = `${process.env.APP_BASE_URL}/auth/magic-login?token=${token}`;
  await emailService.send(
    "magic_link",
    user.email,
    purpose === "signup"
      ? "Complete your CosmicForge signup"
      : "Your CosmicForge login link",
    { fullName: user.fullName, link, expiresInMinutes }
  );
}

// send mobile magic link (deep link — opens Doctor app directly)
async function sendMobileMagicLinkEmail(user, token, expiresInMinutes, purpose) {
  const deepLink = `cosmicforge-mobile-doctor://magic-link?token=${token}`;
  await emailService.send(
    "magic_link",
    user.email,
    purpose === "signup"
      ? "Complete your CosmicForge Doctor signup"
      : "Your CosmicForge Doctor login link",
    { fullName: user.fullName, link: deepLink, expiresInMinutes }
  );
}

/**
 * Send verification status email to doctor
 */
async function sendVerificationStatusEmail(
  user,
  status,
  verificationRequest,
  additionalData = {}
) {
  const emailData = {
    fullName: user.fullName,
    licenseNumber: verificationRequest.licenseNumber,
    countryCode: verificationRequest.countryCode,
    issuingAuthority: verificationRequest.issuingAuthority,
    submittedAt: verificationRequest.submittedAt,
    verificationId: verificationRequest.id,
    dashboardLink: `${process.env.APP_BASE_URL}/doctor/verification`,
    supportLink: `${process.env.APP_BASE_URL}/support`,
    currentYear: new Date().getFullYear(),
    ...additionalData,
  };

  switch (status) {
    case "pending":
      await emailService.send(
        "verification_submitted",
        user.email,
        "Verification Request Submitted - CosmicForge Health",
        emailData
      );
      break;

    case "in_progress":
      await emailService.send(
        "verification_in_progress",
        user.email,
        "Verification In Progress - CosmicForge Health",
        emailData
      );
      break;

    case "manual_review":
      await emailService.send(
        "verification_manual_review",
        user.email,
        "Verification Under Review - CosmicForge Health",
        emailData
      );
      break;

    case "approved":
      await emailService.send(
        "verification_approved",
        user.email,
        "🎉 Verification Approved - Welcome to CosmicForge Health!",
        {
          ...emailData,
          profileSetupLink: `${process.env.APP_BASE_URL}/doctor/profile/setup`,
          consultationLink: `${process.env.APP_BASE_URL}/doctor/consultations`,
        }
      );
      break;

    case "rejected":
      await emailService.send(
        "verification_rejected",
        user.email,
        "Verification Update Required - CosmicForge Health",
        {
          ...emailData,
          resubmitLink: `${process.env.APP_BASE_URL}/doctor/verification/resubmit`,
          feedbackLink: `${process.env.APP_BASE_URL}/doctor/verification/feedback`,
        }
      );
      break;

    case "expired":
      await emailService.send(
        "verification_expired",
        user.email,
        "Verification Request Expired - CosmicForge Health",
        {
          ...emailData,
          renewLink: `${process.env.APP_BASE_URL}/doctor/verification/renew`,
        }
      );
      break;

    default:
      // Generic status update email
      await emailService.send(
        "verification_status_update",
        user.email,
        "Verification Status Update - CosmicForge Health",
        emailData
      );
  }
}

/**
 * Send document upload confirmation email
 */
async function sendDocumentUploadEmail(user, document, verificationRequest) {
  await emailService.send(
    "document_uploaded",
    user.email,
    "Document Uploaded Successfully - CosmicForge Health",
    {
      fullName: user.fullName,
      documentType: document.documentType,
      originalFileName: document.originalFileName,
      uploadedAt: document.uploadedAt,
      verificationId: verificationRequest.id,
      dashboardLink: `${process.env.APP_BASE_URL}/doctor/verification`,
      processingTime: "Documents are typically processed within 2-4 hours.",
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send verification reminder email
 */
async function sendVerificationReminderEmail(user, verificationRequest) {
  const daysPending = Math.floor(
    (new Date() - new Date(verificationRequest.submittedAt)) /
      (1000 * 60 * 60 * 24)
  );

  await emailService.send(
    "verification_reminder",
    user.email,
    "Complete Your Verification - CosmicForge Health",
    {
      fullName: user.fullName,
      daysPending,
      verificationId: verificationRequest.id,
      dashboardLink: `${process.env.APP_BASE_URL}/doctor/verification`,
      supportLink: `${process.env.APP_BASE_URL}/support`,
      documentsNeeded: verificationRequest.documentsNeeded || [],
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send verification expiry warning email
 */
async function sendVerificationExpiryWarningEmail(
  user,
  verificationRequest,
  daysUntilExpiry
) {
  await emailService.send(
    "verification_expiry_warning",
    user.email,
    `⚠️ Verification Expires in ${daysUntilExpiry} Days - CosmicForge Health`,
    {
      fullName: user.fullName,
      daysUntilExpiry,
      expiryDate: verificationRequest.expiresAt,
      verificationId: verificationRequest.id,
      dashboardLink: `${process.env.APP_BASE_URL}/doctor/verification`,
      renewLink: `${process.env.APP_BASE_URL}/doctor/verification/renew`,
      supportLink: `${process.env.APP_BASE_URL}/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send admin notification for manual review
 */
async function sendAdminVerificationNotificationEmail(
  adminEmail,
  verificationRequest,
  doctor
) {
  await emailService.send(
    "admin_verification_review",
    adminEmail,
    "New Verification Requires Review - CosmicForge Health Admin",
    {
      doctorName: doctor.fullName,
      doctorEmail: doctor.email,
      licenseNumber: verificationRequest.licenseNumber,
      countryCode: verificationRequest.countryCode,
      issuingAuthority: verificationRequest.issuingAuthority,
      submittedAt: verificationRequest.submittedAt,
      priority: verificationRequest.priority || "normal",
      verificationId: verificationRequest.id,
      adminDashboardLink: `${process.env.APP_BASE_URL}/admin/verifications/${verificationRequest.id}`,
      documentsCount: verificationRequest.documentsCount || 0,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send payment receipt email for appointments
 */
async function sendAppointmentPaymentReceiptEmail(
  user,
  transaction,
  appointment,
  splits
) {
  await emailService.send(
    "appointment_payment_receipt",
    user.email,
    "Payment Receipt - Appointment Booking Confirmed",
    {
      fullName: user.fullName,
      transactionId: transaction.id,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      doctorName: appointment.doctor.fullName,
      totalAmount: transaction.originalAmount,
      currency: transaction.originalCurrency,
      vatAmount: splits.find((s) => s.type === "vat")?.originalAmount || 0,
      serviceFee:
        splits.find((s) => s.type === "service_fee")?.originalAmount || 0,
      appointmentFee:
        splits.find((s) => s.type === "appointment_fee")?.originalAmount || 0,
      paymentMethod: transaction.paymentProvider,
      paidAt: transaction.completedAt,
      dashboardLink: `${process.env.APP_BASE_URL}/patient/appointments`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send withdrawal OTP notification email
 */
async function sendWithdrawalOtpNotification(data) {
  await emailService.send(
    "withdrawal_otp_notification",
    data.to,
    "Complete Your Withdrawal - OTP Required",
    {
      fullName: data.doctorName,
      amount: data.amount,
      currency: data.currency,
      accountName: data.accountName,
      withdrawalId: data.withdrawalId,
      otpCompletionUrl: data.otpCompletionUrl,
      currentYear: new Date().getFullYear(),
    }
  );
}

// ADD these functions to your emailHelpers.js:

/**
 * Send wallet password reset email
 */
async function sendWalletPasswordResetEmail(data) {
  await emailService.send(
    'wallet_password_reset',
    data.to,
    'Reset Your Wallet Password - CosmicForge',
    {
      fullName: data.doctorName,
      resetUrl: data.resetUrl,
      expiresInMinutes: data.expiresInMinutes,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send wallet password reset confirmation email
 */
async function sendWalletPasswordResetConfirmationEmail(data) {
  await emailService.send(
    'wallet_password_reset_confirmation',
    data.to,
    'Wallet Password Reset Successful - CosmicForge',
    {
      fullName: data.doctorName,
      resetTime: new Date().toLocaleString(),
      loginUrl: `${process.env.FRONTEND_URL}/login`,
      supportUrl: `${process.env.FRONTEND_URL}/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send custom withdrawal OTP notification email
 */
async function sendCustomWithdrawalOtp(data) {
  await emailService.send(
    'custom_withdrawal_otp',
    data.to,
    'Complete Your Withdrawal - Verification Code',
    {
      fullName: data.doctorName,
      otpCode: data.otpCode,
      amount: data.amount,
      currency: data.currency,
      accountName: data.accountName,
      withdrawalId: data.withdrawalId,
      otpCompletionUrl: data.otpCompletionUrl,
      expiresInMinutes: data.expiresInMinutes || 10,
      currentYear: new Date().getFullYear()
    }
  );
}


/**
 * Send payment receipt email for subscriptions
 */
async function sendSubscriptionPaymentReceiptEmail(
  user,
  transaction,
  subscription
) {
  await emailService.send(
    "subscription_payment_receipt",
    user.email,
    "Payment Receipt - Subscription Upgraded",
    {
      fullName: user.fullName,
      transactionId: transaction.id,
      planName: subscription.planType,
      billingCycle: transaction.billingCycle,
      totalAmount: transaction.originalAmount,
      currency: transaction.originalCurrency,
      paymentMethod: transaction.paymentProvider,
      paidAt: transaction.completedAt,
      nextBillingDate: subscription.nextBillingDate,
      dashboardLink: `${process.env.APP_BASE_URL}/subscription`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send profile completion reminder email to doctor
 */
async function sendProfileCompletionReminderEmail(user) {
  await emailService.send(
    "profile_completion_reminder",
    user.email,
    "Reminder: Complete Your Profile - CosmicForge Health",
    {
      fullName: user.fullName,
      profileSetupLink: `${process.env.APP_BASE_URL}/doctors/dashboard/settings/edit-profile`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear()
    }
  );
}


/**
 * Send appointment reminder email to doctor (1 hour before)
 */
async function sendDoctorAppointmentReminder(data) {
  await emailService.send(
    "doctor_appointment_reminder",
    data.email,
    `Appointment Reminder: ${data.patientName} in 1 Hour`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      consultationType: data.appointmentDetails.type,
      meetingLink: data.appointmentDetails.meetingLink,
      meetingProvider: data.appointmentDetails.meetingProvider,
      meetingPassword: data.appointmentDetails.meetingPassword,
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send appointment reminder email to patient (1 hour before)
 */
async function sendPatientAppointmentReminder(data) {
  await emailService.send(
    "patient_appointment_reminder",
    data.email,
    `Appointment Reminder: Dr. ${data.doctorName} in 1 Hour`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      consultationType: data.appointmentDetails.type,
      meetingLink: data.appointmentDetails.meetingLink,
      meetingProvider: data.appointmentDetails.meetingProvider,
      meetingPassword: data.appointmentDetails.meetingPassword,
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send meeting preparation email to doctor (15 minutes before)
 */
async function sendDoctorMeetingPreparation(data) {
  await emailService.send(
    "doctor_meeting_preparation",
    data.email,
    `Meeting Starting Soon: ${data.patientName} in 15 Minutes`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentTime: data.appointmentDetails.time,
      meetingLink: data.appointmentDetails.meetingLink,
      meetingProvider: data.appointmentDetails.meetingProvider,
      meetingPassword: data.appointmentDetails.meetingPassword,
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send meeting preparation email to patient (15 minutes before)
 */
async function sendPatientMeetingPreparation(data) {
  await emailService.send(
    "patient_meeting_preparation",
    data.email,
    `Meeting Starting Soon: Dr. ${data.doctorName} in 15 Minutes`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentTime: data.appointmentDetails.time,
      meetingLink: data.appointmentDetails.meetingLink,
      meetingProvider: data.appointmentDetails.meetingProvider,
      meetingPassword: data.appointmentDetails.meetingPassword,
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send meeting ended notification to doctor
 */
async function sendDoctorMeetingEndedNotification(data) {
  await emailService.send(
    "doctor_meeting_ended",
    data.email,
    `Meeting Completed: ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.appointmentId,
      endReason: data.appointmentDetails.endReason,
      endTime: new Date().toLocaleString(),
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      addNotesLink: `${process.env.APP_BASE_URL}/doctor/appointments/${data.appointmentDetails.appointmentId}/notes`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send meeting ended notification to patient
 */
async function sendPatientMeetingEndedNotification(data) {
  await emailService.send(
    "patient_meeting_ended",
    data.email,
    `Consultation Completed with Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.appointmentId,
      endReason: data.appointmentDetails.endReason,
      endTime: new Date().toLocaleString(),
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      // feedbackLink: `${process.env.APP_BASE_URL}/patient/appointments/${data.appointmentDetails.appointmentId}/feedback`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send appointment cancellation notification to doctor
 */
async function sendDoctorAppointmentCancellationEmail(data) {
  await emailService.send(
    "doctor_appointment_cancelled",
    data.email,
    `Appointment Cancelled: ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      cancellationReason: data.appointmentDetails.cancellationReason,
      cancelledBy: data.appointmentDetails.cancelledBy,
      refundAmount: data.appointmentDetails.refundAmount,
      currencySymbol: data.appointmentDetails.currencySymbol || '₦',
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send appointment cancellation notification to patient
 */
async function sendPatientAppointmentCancellationEmail(data) {
  await emailService.send(
    "patient_appointment_cancelled",
    data.email,
    `Appointment Cancelled: Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      cancellationReason: data.appointmentDetails.cancellationReason,
      cancelledBy: data.appointmentDetails.cancelledBy,
      refundAmount: data.appointmentDetails.refundAmount,
      currencySymbol: data.appointmentDetails.currencySymbol || '₦',
      refundProcessingTime: "7-9 business days",
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      rebookLink: `${process.env.APP_BASE_URL}/patients/dashboard/explore-doctors`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send appointment approval confirmation to patient
 */
async function sendPatientAppointmentApprovedEmail(data) {
  await emailService.send(
    "patient_appointment_approved",
    data.email,
    `✅ Appointment Confirmed: Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      consultationType: data.appointmentDetails.type,
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send refund confirmation email to patient
 */
async function sendRefundConfirmationEmail(data) {
  await emailService.send(
    "refund_confirmation",
    data.email,
    `💰 Refund Processed: Appointment ${data.appointmentDetails.id}`,
    {
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      refundAmount: data.appointmentDetails.refundAmount,
      currencySymbol: data.appointmentDetails.currencySymbol || '₦',
      refundReason: data.appointmentDetails.refundReason,
      processingTime: data.appointmentDetails.processingTime,
      refundedAt: new Date().toLocaleString(),
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send unapproved cancellation notification to patient
 */
async function sendPatientUnapprovedCancellationEmail(data) {
  await emailService.send(
    "patient_unapproved_cancellation",
    data.email,
    `Appointment Auto-Cancelled: Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      cancellationReason: data.appointmentDetails.cancellationReason,
      refundAmount: data.appointmentDetails.refundAmount,
      currencySymbol: data.appointmentDetails.currencySymbol || '₦',
      processingTime: data.appointmentDetails.processingTime,
      rebookLink: `${process.env.APP_BASE_URL}/patients/dashboard/explore-doctors`,
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send missed approval notification to doctor
 */
async function sendDoctorMissedApprovalNotificationEmail(data) {
  await emailService.send(
    "doctor_missed_approval_notification",
    data.email,
    `Missed Appointment Approval: ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      cancellationReason: data.appointmentDetails.cancellationReason,
      refundAmount: data.appointmentDetails.refundAmount,
      currencySymbol: data.appointmentDetails.currencySymbol || '₦',
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      notificationSettingsLink: `${process.env.APP_BASE_URL}/doctors/dashboard/settings/notifications`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}


async function sendRewardVerificationEmail(email, reward, rewardCode, verificationToken) {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-reward?token=${verificationToken}`;
  
  await emailService.send(
    "reward_verification",
    email,
    "🎉 Congratulations! You've Won a Reward!",
    {
      email,
      rewardCode,
      rewardType: reward.type,
      rewardDescription: reward.description,
      rewardValue: reward.value,
      verificationLink,
      validityDays: reward.validityDays,
      expiresAt: new Date(Date.now() + reward.validityDays * 24 * 60 * 60 * 1000).toLocaleDateString(),
      dashboardLink: `${process.env.FRONTEND_URL}/rewards`,
      supportLink: `${process.env.FRONTEND_URL}/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send reward confirmation email (after email verification)
 */
async function sendRewardConfirmationEmail(email, reward, rewardCode) {
  await emailService.send(
    "reward_confirmation",
    email,
    "✅ Your Reward is Now Active!",
    {
      email,
      rewardCode,
      rewardType: reward.type,
      rewardDescription: reward.description,
      rewardValue: reward.value,
      activatedAt: new Date().toLocaleString(),
      dashboardLink: `${process.env.FRONTEND_URL}/rewards`,
      checkoutLink: `${process.env.FRONTEND_URL}/subscription`,
      supportLink: `${process.env.FRONTEND_URL}/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send reward expiry warning email
 */
async function sendRewardExpiryWarningEmail(email, reward, rewardCode, daysUntilExpiry) {
  await emailService.send(
    "reward_expiry_warning",
    email,
    `⚠️ Your Reward Expires in ${daysUntilExpiry} Days!`,
    {
      email,
      rewardCode,
      rewardType: reward.type,
      rewardDescription: reward.description,
      rewardValue: reward.value,
      daysUntilExpiry,
      expiryDate: new Date(reward.expiresAt).toLocaleDateString(),
      dashboardLink: `${process.env.FRONTEND_URL}/rewards`,
      checkoutLink: `${process.env.FRONTEND_URL}/subscription`,
      supportLink: `${process.env.FRONTEND_URL}/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send reward used confirmation email
 */
async function sendRewardUsedConfirmationEmail(email, reward, rewardCode, transactionDetails = null) {
  await emailService.send(
    "reward_used_confirmation",
    email,
    "🎊 Reward Successfully Applied!",
    {
      email,
      rewardCode,
      rewardType: reward.type,
      rewardDescription: reward.description,
      rewardValue: reward.value,
      usedAt: new Date().toLocaleString(),
      transactionId: transactionDetails?.transactionId || null,
      discountAmount: transactionDetails?.discountAmount || null,
      dashboardLink: `${process.env.FRONTEND_URL}/rewards`,
      supportLink: `${process.env.FRONTEND_URL}/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send spin wheel daily reminder email
 */
async function sendSpinWheelReminderEmail(email, userName = null) {
  await emailService.send(
    "spin_wheel_reminder",
    email,
    "🎰 Ready for Another Spin? Your Daily Reward Awaits!",
    {
      email,
      userName: userName || "Valued User",
      spinLink: `${process.env.FRONTEND_URL}/spin`,
      dashboardLink: `${process.env.FRONTEND_URL}/rewards`,
      supportLink: `${process.env.FRONTEND_URL}/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send appointment rescheduled notification to doctor
 */
async function sendDoctorAppointmentRescheduledEmail(data) {
  await emailService.send(
    "doctor_appointment_rescheduled",
    data.email,
    `Appointment Rescheduled: ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      oldDate: data.appointmentDetails.oldDate,
      oldTime: data.appointmentDetails.oldTime,
      newDate: data.appointmentDetails.newDate,
      newTime: data.appointmentDetails.newTime,
      meetingLink: data.appointmentDetails.meetingLink,
      meetingProvider: data.appointmentDetails.meetingProvider,
      rescheduleReason: data.appointmentDetails.rescheduleReason,
      rescheduledBy: data.appointmentDetails.rescheduledBy,
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send appointment rescheduled notification to patient
 */
async function sendPatientAppointmentRescheduledEmail(data) {
  await emailService.send(
    "patient_appointment_rescheduled",
    data.email,
    `Appointment Rescheduled: Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      oldDate: data.appointmentDetails.oldDate,
      oldTime: data.appointmentDetails.oldTime,
      newDate: data.appointmentDetails.newDate,
      newTime: data.appointmentDetails.newTime,
      meetingLink: data.appointmentDetails.meetingLink,
      meetingProvider: data.appointmentDetails.meetingProvider,
      rescheduleReason: data.appointmentDetails.rescheduleReason,
      rescheduledBy: data.appointmentDetails.rescheduledBy,
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear()
    }
  );
}


/**
 * Send Google Meet link email to patient
 */
async function sendPatientGoogleMeetLinkEmail(data) {
  await emailService.send(
    "patient_google_meet_link",
    data.email,
    `Google Meet Link Ready: Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      meetingLink: data.meetingDetails.joinUrl,
      googleMeetCode: data.meetingDetails.googleMeetCode,
      meetingId: data.meetingDetails.meetingId,
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send Google Meet link email to doctor
 */
async function sendDoctorGoogleMeetLinkEmail(data) {
  await emailService.send(
    "doctor_google_meet_link",
    data.email,
    `Google Meet Setup Complete: ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      meetingLink: data.meetingDetails.joinUrl,
      googleMeetCode: data.meetingDetails.googleMeetCode,
      meetingId: data.meetingDetails.meetingId,
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send Zoom meeting link email to patient
 */
async function sendPatientZoomMeetingLinkEmail(data) {
  await emailService.send(
    "patient_zoom_meeting_link",
    data.email,
    `Zoom Meeting Link Ready with Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      meetingLink: data.meetingDetails.joinUrl,
      zoomMeetingId: data.meetingDetails.meetingId,
      meetingPassword: data.meetingDetails.password,
      dialInNumbers: data.meetingDetails.dialInNumbers || "Available in meeting",
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send Zoom meeting link email to doctor
 */
async function sendDoctorZoomMeetingLinkEmail(data) {
  await emailService.send(
    "doctor_zoom_meeting_link",
    data.email,
    `Zoom Meeting Setup Complete with ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      meetingLink: data.meetingDetails.joinUrl,
      zoomMeetingId: data.meetingDetails.meetingId,
      meetingPassword: data.meetingDetails.password,
      hostKey: data.meetingDetails.hostKey,
      dialInNumbers: data.meetingDetails.dialInNumbers || "Available in meeting",
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send Jitsi meeting link email to patient
 */
async function sendPatientJitsiMeetingLinkEmail(data) {
  await emailService.send(
    "patient_jitsi_meeting_link",
    data.email,
    `Jitsi Meeting Link Ready: Dr. ${data.doctorName}`,
    {
      patientName: data.patientName,
      doctorName: data.doctorName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      meetingLink: data.meetingDetails.joinUrl,
      roomName: data.meetingDetails.roomName,
      meetingPassword: data.meetingDetails.meetingPassword,
      browserRequirement: "Latest Chrome, Firefox, Safari, or Edge browser recommended",
      dashboardLink: `${process.env.APP_BASE_URL}/patients/dashboard/appointments/overview`,
      supportLink: `${process.env.APP_BASE_URL}/patients/dashboard/support`,
      currentYear: new Date().getFullYear()
    }
  );
}

/**
 * Send Jitsi meeting link email to doctor
 */
async function sendDoctorJitsiMeetingLinkEmail(data) {
  await emailService.send(
    "doctor_jitsi_meeting_link",
    data.email,
    `Jitsi Meeting Setup Complete: ${data.patientName}`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      duration: data.appointmentDetails.duration,
      meetingLink: data.meetingDetails.joinUrl,
      roomName: data.meetingDetails.roomName,
      meetingPassword: data.meetingDetails.meetingPassword,
      moderatorControls: "You have moderator privileges to manage the meeting",
      browserRequirement: "Latest Chrome, Firefox, Safari, or Edge browser recommended",
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}


async function sendDoctorPaymentNotificationEmail(data) {
  await emailService.send(
    "doctor_payment_notification",
    data.email,
    `Payment Received - Please Approve ${data.patientName} appointment`,
    {
      doctorName: data.doctorName,
      patientName: data.patientName,
      appointmentId: data.appointmentDetails.id,
      appointmentDate: data.appointmentDetails.date,
      appointmentTime: data.appointmentDetails.time,
      consultationType: data.appointmentDetails.type,
      duration: data.appointmentDetails.duration,
      paymentAmount: data.paymentDetails.amount,
      paymentMethod: data.paymentDetails.method,
      paymentId: data.paymentDetails.paymentId,
      paidAt: data.paymentDetails.paidAt,
      approveLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      dashboardLink: `${process.env.APP_BASE_URL}/doctors/dashboard/appointments`,
      supportLink: `${process.env.APP_BASE_URL}/doctors/dashboard/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}


module.exports = {
  sendVerificationEmail,
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendMagicLinkEmail,
  sendMobileMagicLinkEmail,
  sendWalletPasswordResetConfirmationEmail,
  sendCustomWithdrawalOtp,
  // NEW - Verification email functions
  sendVerificationStatusEmail,
  sendDocumentUploadEmail,
  sendVerificationReminderEmail,
  sendVerificationExpiryWarningEmail,
  sendAdminVerificationNotificationEmail,

  // NEW - Payment receipt emails
  sendAppointmentPaymentReceiptEmail,
  sendSubscriptionPaymentReceiptEmail,
  sendWithdrawalOtpNotification,

  //reminder for profile completion
  sendProfileCompletionReminderEmail,

  // Reminder emails
  sendDoctorAppointmentReminder,
  sendPatientAppointmentReminder,

  // Meeting preparation emails
  sendDoctorMeetingPreparation,
  sendPatientMeetingPreparation,

  // Meeting ended notifications
  sendDoctorMeetingEndedNotification,
  sendPatientMeetingEndedNotification,

  // Cancellation emails
  sendDoctorAppointmentCancellationEmail,
  sendPatientAppointmentCancellationEmail,

  // Reschedule emails
  sendDoctorAppointmentRescheduledEmail,
  sendPatientAppointmentRescheduledEmail,

  sendPatientAppointmentApprovedEmail,
  sendRefundConfirmationEmail,
  sendPatientUnapprovedCancellationEmail,
  sendDoctorMissedApprovalNotificationEmail,


   // Spinning Wheel Email Functions
   sendRewardVerificationEmail,
   sendRewardConfirmationEmail,
   sendRewardExpiryWarningEmail,
   sendRewardUsedConfirmationEmail,
   sendSpinWheelReminderEmail,
   sendWalletPasswordResetEmail,


   sendPatientGoogleMeetLinkEmail,
   sendDoctorGoogleMeetLinkEmail,
   sendPatientZoomMeetingLinkEmail,
   sendDoctorZoomMeetingLinkEmail,
   sendPatientJitsiMeetingLinkEmail,
   sendDoctorJitsiMeetingLinkEmail,

   sendDoctorPaymentNotificationEmail
};
