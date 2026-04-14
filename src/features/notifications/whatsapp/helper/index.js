const WhatsAppService = require("../services");

const whatsappService = new WhatsAppService();

function getPhoneNumber(target) {
  return (
    target?.phoneNumber ||
    target?.phone ||
    target?.recipientPhoneNumber ||
    null
  );
}

async function safeSend({
  phoneNumber,
  text,
  recipientName = "Customer",
  serviceType = "service",
  referenceId = "N/A",
}) {
  if (!phoneNumber) {
    return { success: false, skipped: true, error: "No phone number provided." };
  }

  try {
    const result = await whatsappService.sendNotification({
      to: phoneNumber,
      text,
      recipientName,
      serviceType,
      referenceId,
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error(
      `WhatsApp notification failed for ${phoneNumber}:`,
      error.response?.data || error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

async function sendGenericWhatsAppNotification({
  phoneNumber,
  text,
  recipientName,
  serviceType,
  referenceId,
}) {
  return safeSend({ phoneNumber, text, recipientName, serviceType, referenceId });
}

async function sendVerificationWhatsApp(user, expiresInMinutes = 60) {
  return safeSend({
    phoneNumber: getPhoneNumber(user),
    text: `Hello ${user?.fullName || "there"}, please verify your account within ${expiresInMinutes} minutes.`,
    recipientName: user?.fullName || "Customer",
    serviceType: "account verification",
    referenceId: "verification",
  });
}

async function sendPasswordResetWhatsApp(user, expiresInMinutes = 60) {
  return safeSend({
    phoneNumber: getPhoneNumber(user),
    text: `Hello ${user?.fullName || "there"}, your password reset request is active for ${expiresInMinutes} minutes.`,
    recipientName: user?.fullName || "Customer",
    serviceType: "password reset",
    referenceId: "password-reset",
  });
}

async function sendMagicLinkWhatsApp(user, expiresInMinutes, purpose = "login") {
  return safeSend({
    phoneNumber: getPhoneNumber(user),
    text: `Hello ${user?.fullName || "there"}, your ${purpose} magic link is valid for ${expiresInMinutes} minutes.`,
    recipientName: user?.fullName || "Customer",
    serviceType: "magic link",
    referenceId: purpose,
  });
}

async function sendPatientAppointmentApprovedWhatsApp({ phoneNumber, patientName, doctorName, appointmentDetails }) {
  return safeSend({
    phoneNumber,
    text: `Hello ${patientName}, Dr. ${doctorName} approved your appointment for ${appointmentDetails?.date} at ${appointmentDetails?.time}.`,
    recipientName: patientName,
    serviceType: "appointment",
    referenceId: appointmentDetails?.id || "appointment-approved",
  });
}

async function sendDoctorAppointmentCancellationWhatsApp({ phoneNumber, doctorName, patientName, appointmentDetails }) {
  return safeSend({
    phoneNumber,
    text: `Hello Dr. ${doctorName}, ${patientName} cancelled the appointment scheduled for ${appointmentDetails?.date} at ${appointmentDetails?.time}. Reason: ${appointmentDetails?.cancellationReason || "Not provided"}.`,
    recipientName: `Dr. ${doctorName}`,
    serviceType: "appointment",
    referenceId: appointmentDetails?.id || "appointment-cancelled",
  });
}

async function sendPatientAppointmentCancellationWhatsApp({ phoneNumber, patientName, doctorName, appointmentDetails }) {
  return safeSend({
    phoneNumber,
    text: `Hello ${patientName}, your appointment with Dr. ${doctorName} on ${appointmentDetails?.date} at ${appointmentDetails?.time} has been cancelled. Reason: ${appointmentDetails?.cancellationReason || "Not provided"}.`,
    recipientName: patientName,
    serviceType: "appointment",
    referenceId: appointmentDetails?.id || "appointment-cancelled",
  });
}

async function sendDoctorAppointmentRescheduledWhatsApp({ phoneNumber, doctorName, patientName, appointmentDetails }) {
  return safeSend({
    phoneNumber,
    text: `Hello Dr. ${doctorName}, the appointment with ${patientName} moved from ${appointmentDetails?.oldDate} ${appointmentDetails?.oldTime} to ${appointmentDetails?.newDate} ${appointmentDetails?.newTime}.`,
    recipientName: `Dr. ${doctorName}`,
    serviceType: "appointment",
    referenceId: appointmentDetails?.id || "appointment-rescheduled",
  });
}

async function sendPatientAppointmentRescheduledWhatsApp({ phoneNumber, patientName, doctorName, appointmentDetails }) {
  return safeSend({
    phoneNumber,
    text: `Hello ${patientName}, your appointment with Dr. ${doctorName} has been rescheduled to ${appointmentDetails?.newDate} at ${appointmentDetails?.newTime}.`,
    recipientName: patientName,
    serviceType: "appointment",
    referenceId: appointmentDetails?.id || "appointment-rescheduled",
  });
}

async function sendAppointmentPaymentReceiptWhatsApp(user, transaction, appointment) {
  return safeSend({
    phoneNumber: getPhoneNumber(user),
    text: `Hello ${user?.fullName || "there"}, we received your appointment payment of ${transaction?.originalAmount} ${transaction?.originalCurrency} for ${appointment?.appointmentDate} at ${appointment?.appointmentTime}. Receipt ID: ${transaction?.id}.`,
    recipientName: user?.fullName || "Customer",
    serviceType: "payment",
    referenceId: transaction?.id || "payment",
  });
}

async function sendSubscriptionPaymentReceiptWhatsApp(user, transaction, subscription) {
  return safeSend({
    phoneNumber: getPhoneNumber(user),
    text: `Hello ${user?.fullName || "there"}, we received your subscription payment of ${transaction?.originalAmount} ${transaction?.originalCurrency} for plan ${subscription?.planType}. Receipt ID: ${transaction?.id}.`,
    recipientName: user?.fullName || "Customer",
    serviceType: "subscription",
    referenceId: transaction?.id || "subscription-payment",
  });
}

module.exports = {
  whatsappService,
  sendGenericWhatsAppNotification,
  sendVerificationWhatsApp,
  sendPasswordResetWhatsApp,
  sendMagicLinkWhatsApp,
  sendPatientAppointmentApprovedWhatsApp,
  sendDoctorAppointmentCancellationWhatsApp,
  sendPatientAppointmentCancellationWhatsApp,
  sendDoctorAppointmentRescheduledWhatsApp,
  sendPatientAppointmentRescheduledWhatsApp,
  sendAppointmentPaymentReceiptWhatsApp,
  sendSubscriptionPaymentReceiptWhatsApp,
};
