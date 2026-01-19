// src/services/whatsappHelpers.js
const WhatsAppService = require('../services');

// Initialize WhatsApp service
const whatsappService = new WhatsAppService();

/**
 * Send verification WhatsApp message
 */
async function sendVerificationWhatsApp(user, expiresInMinutes = 60) {
  if (!user.phoneNumber) {
    console.log(`No phone number for user ${user.email}, skipping WhatsApp`);
    return { success: false, error: 'No phone number' };
  }

  return await whatsappService.sendVerificationTemplate(
    user.phoneNumber,
    user.fullName,
    expiresInMinutes
  );
}

/**
 * Send password reset WhatsApp message
 */
async function sendPasswordResetWhatsApp(user, expiresInMinutes = 60) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendPasswordResetTemplate(
    user.phoneNumber,
    user.fullName,
    expiresInMinutes
  );
}

/**
 * Send magic link WhatsApp message
 */
async function sendMagicLinkWhatsApp(user, expiresInMinutes, purpose) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    user.phoneNumber,
    'magic_link_login',
    'en_US',
    [user.fullName, expiresInMinutes.toString()]
  );
}

/**
 * Send verification status WhatsApp to doctor
 */
async function sendVerificationStatusWhatsApp(user, status, verificationRequest) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendDoctorVerificationStatusTemplate(
    user.phoneNumber,
    user.fullName,
    status,
    verificationRequest.licenseNumber,
    verificationRequest.id
  );
}

/**
 * Send document upload confirmation WhatsApp
 */
async function sendDocumentUploadWhatsApp(user, document, verificationRequest) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    user.phoneNumber,
    'document_uploaded',
    'en_US',
    [user.fullName, document.documentType, verificationRequest.id]
  );
}

/**
 * Send verification reminder WhatsApp
 */
async function sendVerificationReminderWhatsApp(user, verificationRequest) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  const daysPending = Math.floor(
    (new Date() - new Date(verificationRequest.submittedAt)) / (1000 * 60 * 60 * 24)
  );

  return await whatsappService.sendVerificationReminderTemplate(
    user.phoneNumber,
    user.fullName,
    daysPending,
    verificationRequest.id,
    verificationRequest.documentsNeeded || []
  );
}

/**
 * Send verification expiry warning WhatsApp
 */
async function sendVerificationExpiryWarningWhatsApp(user, verificationRequest, daysUntilExpiry) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    user.phoneNumber,
    'verification_expiry_warning',
    'en_US',
    [
      user.fullName,
      daysUntilExpiry.toString(),
      new Date(verificationRequest.expiresAt).toLocaleDateString(),
      verificationRequest.id
    ]
  );
}

/**
 * Send appointment payment receipt WhatsApp
 */
async function sendAppointmentPaymentReceiptWhatsApp(user, transaction, appointment) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendPaymentReceiptTemplate(
    user.phoneNumber,
    user.fullName,
    appointment.doctor.fullName,
    new Date(appointment.appointmentDate).toLocaleDateString(),
    appointment.appointmentTime,
    transaction.originalAmount,
    transaction.originalCurrency,
    transaction.id
  );
}

/**
 * Send withdrawal OTP WhatsApp notification
 */
async function sendWithdrawalOtpWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendWithdrawalOtpTemplate(
    data.phoneNumber,
    data.doctorName,
    data.amount,
    data.currency,
    data.accountName,
    data.withdrawalId
  );
}

/**
 * Send wallet password reset WhatsApp
 */
async function sendWalletPasswordResetWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'wallet_password_reset',
    'en_US',
    [data.doctorName, data.expiresInMinutes.toString()]
  );
}

/**
 * Send subscription payment receipt WhatsApp
 */
async function sendSubscriptionPaymentReceiptWhatsApp(user, transaction, subscription) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    user.phoneNumber,
    'subscription_payment_receipt',
    'en_US',
    [
      user.fullName,
      subscription.planType,
      transaction.originalAmount,
      transaction.originalCurrency,
      transaction.billingCycle,
      new Date(subscription.nextBillingDate).toLocaleDateString(),
      transaction.id
    ]
  );
}

/**
 * Send profile completion reminder WhatsApp to doctor
 */
async function sendProfileCompletionReminderWhatsApp(user) {
  if (!user.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendProfileCompletionReminderTemplate(
    user.phoneNumber,
    user.fullName
  );
}

/**
 * Send appointment reminder WhatsApp to doctor (1 hour before)
 */
async function sendDoctorAppointmentReminderWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendAppointmentReminderTemplate(
    data.phoneNumber,
    data.doctorName,
    data.patientName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.appointmentDetails.duration,
    data.appointmentDetails.type,
    data.appointmentDetails.meetingLink,
    true // isDoctor = true
  );
}

/**
 * Send appointment reminder WhatsApp to patient (1 hour before)
 */
async function sendPatientAppointmentReminderWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendAppointmentReminderTemplate(
    data.phoneNumber,
    data.patientName,
    data.doctorName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.appointmentDetails.duration,
    data.appointmentDetails.type,
    data.appointmentDetails.meetingLink,
    false // isDoctor = false
  );
}

/**
 * Send meeting preparation WhatsApp to doctor (15 minutes before)
 */
async function sendDoctorMeetingPreparationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendMeetingPreparationTemplate(
    data.phoneNumber,
    data.doctorName,
    data.patientName,
    data.appointmentDetails.time,
    data.appointmentDetails.meetingLink,
    data.appointmentDetails.meetingPassword || 'No password required',
    true // isDoctor = true
  );
}

/**
 * Send meeting preparation WhatsApp to patient (15 minutes before)
 */
async function sendPatientMeetingPreparationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendMeetingPreparationTemplate(
    data.phoneNumber,
    data.patientName,
    data.doctorName,
    data.appointmentDetails.time,
    data.appointmentDetails.meetingLink,
    data.appointmentDetails.meetingPassword || 'No password required',
    false // isDoctor = false
  );
}

/**
 * Send meeting ended notification WhatsApp to doctor
 */
async function sendDoctorMeetingEndedNotificationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'doctor_meeting_ended',
    'en_US',
    [
      data.doctorName,
      data.patientName,
      data.appointmentDetails.appointmentId,
      data.appointmentDetails.endReason,
      new Date().toLocaleString()
    ]
  );
}

/**
 * Send meeting ended notification WhatsApp to patient
 */
async function sendPatientMeetingEndedNotificationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'patient_meeting_ended',
    'en_US',
    [
      data.patientName,
      data.doctorName,
      data.appointmentDetails.appointmentId,
      data.appointmentDetails.endReason,
      new Date().toLocaleString()
    ]
  );
}

/**
 * Send appointment cancellation WhatsApp to doctor
 */
async function sendDoctorAppointmentCancellationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendAppointmentCancellationTemplate(
    data.phoneNumber,
    data.doctorName,
    data.patientName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.appointmentDetails.cancellationReason,
    data.appointmentDetails.cancelledBy,
    data.appointmentDetails.refundAmount,
    true // isDoctor = true
  );
}

/**
 * Send appointment cancellation WhatsApp to patient
 */
async function sendPatientAppointmentCancellationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendAppointmentCancellationTemplate(
    data.phoneNumber,
    data.patientName,
    data.doctorName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.appointmentDetails.cancellationReason,
    data.appointmentDetails.cancelledBy,
    data.appointmentDetails.refundAmount,
    false // isDoctor = false
  );
}

/**
 * Send appointment approval WhatsApp to patient
 */
async function sendPatientAppointmentApprovedWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendAppointmentApprovedTemplate(
    data.phoneNumber,
    data.patientName,
    data.doctorName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.appointmentDetails.type
  );
}

/**
 * Send refund confirmation WhatsApp to patient
 */
async function sendRefundConfirmationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'refund_confirmation',
    'en_US',
    [
      data.patientName,
      data.appointmentDetails.id,
      data.appointmentDetails.refundAmount,
      data.appointmentDetails.processingTime
    ]
  );
}

/**
 * Send appointment rescheduled WhatsApp to doctor
 */
async function sendDoctorAppointmentRescheduledWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'doctor_appointment_rescheduled',
    'en_US',
    [
      data.doctorName,
      data.patientName,
      new Date(data.appointmentDetails.oldDate).toLocaleDateString(),
      data.appointmentDetails.oldTime,
      new Date(data.appointmentDetails.newDate).toLocaleDateString(),
      data.appointmentDetails.newTime,
      data.appointmentDetails.rescheduledBy,
      data.appointmentDetails.meetingLink
    ]
  );
}

/**
 * Send appointment rescheduled WhatsApp to patient
 */
async function sendPatientAppointmentRescheduledWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'patient_appointment_rescheduled',
    'en_US',
    [
      data.patientName,
      data.doctorName,
      new Date(data.appointmentDetails.oldDate).toLocaleDateString(),
      data.appointmentDetails.oldTime,
      new Date(data.appointmentDetails.newDate).toLocaleDateString(),
      data.appointmentDetails.newTime,
      data.appointmentDetails.rescheduleReason,
      data.appointmentDetails.meetingLink
    ]
  );
}

/**
 * Send Google Meet link WhatsApp to patient
 */
async function sendPatientGoogleMeetLinkWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendGoogleMeetLinkTemplate(
    data.phoneNumber,
    data.patientName,
    data.doctorName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.meetingDetails.joinUrl,
    data.meetingDetails.googleMeetCode,
    false // isDoctor = false
  );
}

/**
 * Send Google Meet link WhatsApp to doctor
 */
async function sendDoctorGoogleMeetLinkWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendGoogleMeetLinkTemplate(
    data.phoneNumber,
    data.doctorName,
    data.patientName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.meetingDetails.joinUrl,
    data.meetingDetails.googleMeetCode,
    true // isDoctor = true
  );
}

/**
 * Send Zoom meeting link WhatsApp to patient
 */
async function sendPatientZoomMeetingLinkWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendZoomMeetingLinkTemplate(
    data.phoneNumber,
    data.patientName,
    data.doctorName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.meetingDetails.joinUrl,
    data.meetingDetails.meetingId,
    data.meetingDetails.password,
    null,
    false // isDoctor = false
  );
}

/**
 * Send Zoom meeting link WhatsApp to doctor
 */
async function sendDoctorZoomMeetingLinkWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendZoomMeetingLinkTemplate(
    data.phoneNumber,
    data.doctorName,
    data.patientName,
    new Date(data.appointmentDetails.date).toLocaleDateString(),
    data.appointmentDetails.time,
    data.meetingDetails.joinUrl,
    data.meetingDetails.meetingId,
    data.meetingDetails.password,
    data.meetingDetails.hostKey,
    true // isDoctor = true
  );
}

/**
 * Send Jitsi meeting link WhatsApp to patient
 */
async function sendPatientJitsiMeetingLinkWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'patient_jitsi_meeting_link',
    'en_US',
    [
      data.patientName,
      data.doctorName,
      new Date(data.appointmentDetails.date).toLocaleDateString(),
      data.appointmentDetails.time,
      data.meetingDetails.joinUrl,
      data.meetingDetails.roomName,
      data.meetingDetails.meetingPassword
    ]
  );
}

/**
 * Send Jitsi meeting link WhatsApp to doctor
 */
async function sendDoctorJitsiMeetingLinkWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'doctor_jitsi_meeting_link',
    'en_US',
    [
      data.doctorName,
      data.patientName,
      new Date(data.appointmentDetails.date).toLocaleDateString(),
      data.appointmentDetails.time,
      data.meetingDetails.joinUrl,
      data.meetingDetails.roomName,
      data.meetingDetails.meetingPassword
    ]
  );
}

/**
 * Send doctor payment notification WhatsApp
 */
async function sendDoctorPaymentNotificationWhatsApp(data) {
  if (!data.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    data.phoneNumber,
    'doctor_payment_notification',
    'en_US',
    [
      data.doctorName,
      data.patientName,
      new Date(data.appointmentDetails.date).toLocaleDateString(),
      data.appointmentDetails.time,
      data.paymentDetails.amount
    ]
  );
}

/**
 * Send reward verification WhatsApp
 */
async function sendRewardVerificationWhatsApp(phoneNumber, reward, rewardCode) {
  if (!phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendRewardNotificationTemplate(
    phoneNumber,
    reward.type,
    reward.value,
    rewardCode,
    reward.validityDays
  );
}

/**
 * Send reward confirmation WhatsApp
 */
async function sendRewardConfirmationWhatsApp(phoneNumber, reward, rewardCode) {
  if (!phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    phoneNumber,
    'reward_confirmation',
    'en_US',
    [
      phoneNumber, // email placeholder
      rewardCode,
      reward.type,
      reward.value,
      new Date().toLocaleString()
    ]
  );
}

/**
 * Send reward expiry warning WhatsApp
 */
async function sendRewardExpiryWarningWhatsApp(phoneNumber, reward, rewardCode, daysUntilExpiry) {
  if (!phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    phoneNumber,
    'reward_expiry_warning',
    'en_US',
    [
      phoneNumber, // email placeholder
      rewardCode,
      reward.type,
      reward.value,
      daysUntilExpiry.toString(),
      new Date(reward.expiresAt).toLocaleDateString()
    ]
  );
}

/**
 * Send spin wheel reminder WhatsApp
 */
async function sendSpinWheelReminderWhatsApp(phoneNumber, userName = null) {
  if (!phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendSpinWheelReminderTemplate(
    phoneNumber,
    userName || 'Valued User'
  );
}

/**
 * Send lab facility registration WhatsApp
 */
async function sendLabFacilityRegistrationWhatsApp(facility) {
  if (!facility.adminPhoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendLabFacilityStatusTemplate(
    facility.adminPhoneNumber,
    facility.adminFullName,
    facility.facilityName,
    facility.facilityType.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    facility.registrationNumber,
    facility.id
  );
}

/**
 * Send lab facility approval WhatsApp
 */
async function sendLabFacilityApprovalWhatsApp(facility) {
  if (!facility.adminPhoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    facility.adminPhoneNumber,
    'lab_facility_approved',
    'en_US',
    [
      facility.adminFullName,
      facility.facilityName,
      facility.registrationNumber,
      new Date(facility.approvedAt).toLocaleString()
    ]
  );
}

/**
 * Send lab facility rejection WhatsApp
 */
async function sendLabFacilityRejectionWhatsApp(facility, rejectionReason) {
  if (!facility.adminPhoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    facility.adminPhoneNumber,
    'lab_facility_rejected',
    'en_US',
    [
      facility.adminFullName,
      facility.facilityName,
      facility.registrationNumber,
      rejectionReason
    ]
  );
}

/**
 * Send lab personnel invitation WhatsApp
 */
async function sendLabPersonnelInvitationWhatsApp(invitationData) {
  if (!invitationData.phoneNumber) return { success: false, error: 'No phone number' };

  const expiresInDays = Math.ceil(
    (new Date(invitationData.tokenExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return await whatsappService.sendTemplate(
    invitationData.phoneNumber,
    'lab_personnel_invitation',
    'en_US',
    [
      invitationData.personnelName,
      invitationData.facilityName,
      invitationData.roleName,
      invitationData.invitedByName,
      expiresInDays.toString()
    ]
  );
}

/**
 * Send lab personnel welcome WhatsApp
 */
async function sendLabPersonnelWelcomeWhatsApp(welcomeData) {
  if (!welcomeData.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    welcomeData.phoneNumber,
    'lab_personnel_welcome',
    'en_US',
    [welcomeData.personnelName, welcomeData.facilityName, welcomeData.roleName]
  );
}

/**
 * Send lab waitlist confirmation WhatsApp
 */
async function sendLabWaitlistConfirmationWhatsApp(waitlistEntry) {
  if (!waitlistEntry.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    waitlistEntry.phoneNumber,
    'lab_waitlist_confirmation',
    'en_US',
    [
      waitlistEntry.fullName,
      waitlistEntry.facilityName,
      waitlistEntry.id
    ]
  );
}

/**
 * Send lab waitlist launch notification WhatsApp
 */
async function sendLabWaitlistLaunchNotificationWhatsApp(waitlistEntry) {
  if (!waitlistEntry.phoneNumber) return { success: false, error: 'No phone number' };

  return await whatsappService.sendTemplate(
    waitlistEntry.phoneNumber,
    'lab_waitlist_launch_notification',
    'en_US',
    [
      waitlistEntry.fullName,
      waitlistEntry.facilityName,
      new Date().toLocaleDateString()
    ]
  );
}

// Export all functions
module.exports = {
  // Authentication
  sendVerificationWhatsApp,
  sendPasswordResetWhatsApp,
  sendMagicLinkWhatsApp,

  // Doctor Verification
  sendVerificationStatusWhatsApp,
  sendDocumentUploadWhatsApp,
  sendVerificationReminderWhatsApp,
  sendVerificationExpiryWarningWhatsApp,

  // Payments
  sendAppointmentPaymentReceiptWhatsApp,
  sendSubscriptionPaymentReceiptWhatsApp,
  sendWithdrawalOtpWhatsApp,
  sendWalletPasswordResetWhatsApp,

  // Profile and Reminders
  sendProfileCompletionReminderWhatsApp,

  // Appointment Reminders
  sendDoctorAppointmentReminderWhatsApp,
  sendPatientAppointmentReminderWhatsApp,

  // Meeting Preparation
  sendDoctorMeetingPreparationWhatsApp,
  sendPatientMeetingPreparationWhatsApp,

  // Meeting Ended
  sendDoctorMeetingEndedNotificationWhatsApp,
  sendPatientMeetingEndedNotificationWhatsApp,

  // Cancellations
  sendDoctorAppointmentCancellationWhatsApp,
  sendPatientAppointmentCancellationWhatsApp,

  // Rescheduling
  sendDoctorAppointmentRescheduledWhatsApp,
  sendPatientAppointmentRescheduledWhatsApp,

  // Approvals and Refunds
  sendPatientAppointmentApprovedWhatsApp,
  sendRefundConfirmationWhatsApp,

  // Meeting Links
  sendPatientGoogleMeetLinkWhatsApp,
  sendDoctorGoogleMeetLinkWhatsApp,
  sendPatientZoomMeetingLinkWhatsApp,
  sendDoctorZoomMeetingLinkWhatsApp,
  sendPatientJitsiMeetingLinkWhatsApp,
  sendDoctorJitsiMeetingLinkWhatsApp,

  // Payment Notifications
  sendDoctorPaymentNotificationWhatsApp,

  // Rewards
  sendRewardVerificationWhatsApp,
  sendRewardConfirmationWhatsApp,
  sendRewardExpiryWarningWhatsApp,
  sendSpinWheelReminderWhatsApp,

  // Lab Facilities
  sendLabFacilityRegistrationWhatsApp,
  sendLabFacilityApprovalWhatsApp,
  sendLabFacilityRejectionWhatsApp,
  sendLabPersonnelInvitationWhatsApp,
  sendLabPersonnelWelcomeWhatsApp,
  sendLabWaitlistConfirmationWhatsApp,
  sendLabWaitlistLaunchNotificationWhatsApp
};