const emailService = require("../emailService");

/**
 * Send lab facility registration confirmation email
 */
async function sendLabFacilityRegistrationEmail(facility) {
  await emailService.send(
    "lab_facility_registration",
    facility.adminEmail,
    "Lab Facility Registration Submitted - CosmicForge Health",
    {
      adminName: facility.adminFullName,
      facilityName: facility.facilityName,
      facilityType: facility.facilityType
        .replace("_", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      registrationNumber: facility.registrationNumber,
      licenseNumber: facility.licenseNumber,
      submittedAt: new Date().toLocaleString(),
      processingTime: "2-5 business days",
      trackingId: facility.id,
      supportLink: `${process.env.APP_BASE_URL}/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send lab facility approval email with login instructions
 */
async function sendLabFacilityApprovalEmail(facility, adminUser) {
  await emailService.send(
    "lab_facility_approved",
    facility.adminEmail,
    `🎉 ${facility.facilityName} Approved - Welcome to CosmicForge Health!`,
    {
      adminName: facility.adminFullName,
      facilityName: facility.facilityName,
      facilityType: facility.facilityType
        .replace("_", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      registrationNumber: facility.registrationNumber,
      approvedAt: new Date(facility.approvedAt).toLocaleString(),
      dashboardLink: `${process.env.APP_BASE_URL}/lab/dashboard`,
      personnelLink: `${process.env.APP_BASE_URL}/lab/personnel/manage`,
      setupGuideLink: `${process.env.APP_BASE_URL}/lab/setup-guide`,
      supportLink: `${process.env.APP_BASE_URL}/support`,
      loginEmail: facility.adminEmail,
      tempPassword: adminUser.tempPassword,
      loginUrl: `${process.env.APP_BASE_URL}/login`,
      dashboardUrl: `${process.env.APP_BASE_URL}/lab/dashboard`,
      changePasswordUrl: `${process.env.APP_BASE_URL}/change-password`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send lab admin registration email with login credentials
 */
async function sendLabAdminRegistrationEmail(emailData) {
  await emailService.send(
    "lab_admin_registration",
    emailData.to,
    `Welcome to CosmicForge Health - Your Lab Admin Account is Ready!`,
    {
      adminName: emailData.adminName,
      facilityName: emailData.facilityName,
      loginEmail: emailData.loginEmail,
      tempPassword: emailData.tempPassword,
      loginUrl: emailData.loginUrl,
      dashboardUrl: emailData.dashboardUrl,
      changePasswordUrl: emailData.changePasswordUrl,
      securityNote:
        "Please change your password immediately after your first login for security.",
      supportLink: `${process.env.APP_BASE_URL}/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send lab facility rejection email
 */
async function sendLabFacilityRejectionEmail(facility, rejectionReason) {
  await emailService.send(
    "lab_facility_rejected",
    facility.adminEmail,
    "Lab Facility Registration Update Required - CosmicForge Health",
    {
      adminName: facility.adminFullName,
      facilityName: facility.facilityName,
      registrationNumber: facility.registrationNumber,
      rejectionReason,
      rejectedAt: new Date(facility.rejectedAt).toLocaleString(),
      resubmitLink: `${process.env.APP_BASE_URL}/lab/facilities/register`,
      guidelinesLink: `${process.env.APP_BASE_URL}/lab/registration-guidelines`,
      supportLink: `${process.env.APP_BASE_URL}/support`,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send personnel invitation email with registration instructions
 */
async function sendLabPersonnelInvitationEmail(invitationData) {
  await emailService.send(
    "lab_personnel_invitation",
    invitationData.to,
    `Invitation to Join ${invitationData.facilityName} - CosmicForge Health`,
    {
      personnelName: invitationData.personnelName,
      facilityName: invitationData.facilityName,
      roleName: invitationData.roleName,
      invitedByName: invitationData.invitedByName,
      facilityAddress: invitationData.facilityAddress,
      facilityPhone: invitationData.facilityPhone,

      // Registration details
      registrationUrl: invitationData.registrationUrl,
      loginEmail: invitationData.loginEmail,
      tempPassword: invitationData.tempPassword,
      tokenExpiresAt: new Date(
        invitationData.tokenExpiresAt
      ).toLocaleDateString(),
      expiresInDays: Math.ceil(
        (new Date(invitationData.tokenExpiresAt) - new Date()) /
          (1000 * 60 * 60 * 24)
      ),

      // Platform URLs
      loginUrl: invitationData.loginUrl,
      supportUrl: invitationData.supportUrl,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send personnel welcome email after successful registration
 */
async function sendLabPersonnelWelcomeEmail(welcomeData) {
  await emailService.send(
    "lab_personnel_welcome",
    welcomeData.to,
    `Welcome to ${welcomeData.facilityName} - CosmicForge Health`,
    {
      personnelName: welcomeData.personnelName,
      facilityName: welcomeData.facilityName,
      roleName: welcomeData.roleName,
      dashboardUrl: welcomeData.dashboardUrl,
      trainingUrl: welcomeData.trainingUrl,
      handbookUrl: welcomeData.handbookUrl,
      supportUrl: welcomeData.supportUrl,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send personnel status change notification
 */
async function sendLabPersonnelStatusChangeEmail(statusData) {
  const statusMessages = {
    active:
      "Your account has been activated and you now have full access to the system.",
    suspended:
      "Your account has been temporarily suspended. Please contact your administrator.",
    terminated:
      "Your employment has been terminated and your account has been deactivated.",
  };

  await emailService.send(
    "lab_personnel_status_change",
    statusData.to,
    `Account Status Update - ${statusData.facilityName}`,
    {
      personnelName: statusData.personnelName,
      facilityName: statusData.facilityName,
      oldStatus: statusData.oldStatus,
      newStatus: statusData.newStatus,
      statusMessage:
        statusMessages[statusData.newStatus.toLowerCase()] ||
        "Your account status has been updated.",
      updatedBy: statusData.updatedBy,
      updatedAt: new Date().toLocaleString(),
      dashboardUrl: statusData.dashboardUrl,
      supportUrl: statusData.supportUrl,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send personnel role change notification
 */
async function sendLabPersonnelRoleChangeEmail(roleData) {
  await emailService.send(
    "lab_personnel_role_change",
    roleData.to,
    `Role Updated - ${roleData.facilityName}`,
    {
      personnelName: roleData.personnelName,
      facilityName: roleData.facilityName,
      oldRole: roleData.oldRole,
      newRole: roleData.newRole,
      updatedBy: roleData.updatedBy,
      updatedAt: new Date().toLocaleString(),
      dashboardUrl: roleData.dashboardUrl,
      trainingUrl: roleData.trainingUrl,
      supportUrl: roleData.supportUrl,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send admin notification for new facility registration
 */
async function sendAdminLabFacilityNotificationEmail(adminEmail, facility) {
  await emailService.send(
    "admin_lab_facility_review",
    adminEmail,
    "New Lab Facility Registration Requires Review - CosmicForge Health Admin",
    {
      facilityName: facility.facilityName,
      facilityType: facility.facilityType
        .replace("_", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      adminName: facility.adminFullName,
      adminEmail: facility.adminEmail,
      registrationNumber: facility.registrationNumber,
      licenseNumber: facility.licenseNumber,
      submittedAt: new Date(facility.createdAt).toLocaleString(),
      facilityAddress: `${facility.address}, ${facility.city}, ${facility.state}`,
      adminDashboardLink: `${process.env.APP_BASE_URL}/admin/lab-facilities/${facility.id}`,
      approveLink: `${process.env.APP_BASE_URL}/admin/lab-facilities/${facility.id}/approve`,
      rejectLink: `${process.env.APP_BASE_URL}/admin/lab-facilities/${facility.id}/reject`,
      currentYear: new Date().getFullYear(),
    }
  );
}


/**
 * Send waitlist confirmation email
 */
async function sendLabWaitlistConfirmationEmail(waitlistEntry) {
  await emailService.send(
    "lab_waitlist_confirmation",
    waitlistEntry.email,
    "Thank you for joining our Lab Registration Waitlist - CosmicForge Health",
    {
      fullName: waitlistEntry.fullName,
      facilityName: waitlistEntry.facilityName,
      email: waitlistEntry.email,
      joinedAt: new Date(waitlistEntry.createdAt).toLocaleString(),
      trackingId: waitlistEntry.id,
      facilityType: waitlistEntry.facilityType || "Not specified",
      city: waitlistEntry.city || "Not specified",
      state: waitlistEntry.state || "Not specified",
      
      // Platform URLs
      updatesUrl: `${process.env.APP_BASE_URL}/lab/waitlist/updates`,
      unsubscribeUrl: `${process.env.APP_BASE_URL}/lab/waitlist/unsubscribe?id=${waitlistEntry.id}`,
      supportUrl: `${process.env.APP_BASE_URL}/support`,
      websiteUrl: process.env.APP_BASE_URL,
      currentYear: new Date().getFullYear(),
    }
  );
}


async function sendPharmWaitlistConfirmationEmail(waitlistEntry) {
  await emailService.send(
    "pharm_waitlist_confirmation",
    waitlistEntry.email,
    "Thank you for joining our Lab Registration Waitlist - CosmicForge Health",
    {
      fullName: waitlistEntry.fullName,
      facilityName: waitlistEntry.facilityName,
      email: waitlistEntry.email,
      joinedAt: new Date(waitlistEntry.createdAt).toLocaleString(),
      trackingId: waitlistEntry.id,
      facilityType: waitlistEntry.facilityType || "Not specified",
      city: waitlistEntry.city || "Not specified",
      state: waitlistEntry.state || "Not specified",
      
      // Platform URLs
      updatesUrl: `${process.env.APP_BASE_URL}/lab/waitlist/updates`,
      unsubscribeUrl: `${process.env.APP_BASE_URL}/lab/waitlist/unsubscribe?id=${waitlistEntry.id}`,
      supportUrl: `${process.env.APP_BASE_URL}/support`,
      websiteUrl: process.env.APP_BASE_URL,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send launch notification email to waitlist entry
 */
async function sendLabWaitlistLaunchNotificationEmail(waitlistEntry) {
  await emailService.send(
    "lab_waitlist_launch_notification",
    waitlistEntry.email,
    "Lab Registration is Now Open! - CosmicForge Health",
    {
      fullName: waitlistEntry.fullName,
      facilityName: waitlistEntry.facilityName,
      email: waitlistEntry.email,
      joinedAt: new Date(waitlistEntry.createdAt).toLocaleString(),
      
      // Registration URLs
      registerUrl: `${process.env.APP_BASE_URL}/lab/facilities/register`,
      stepByStepUrl: `${process.env.APP_BASE_URL}/lab/facilities/register/step1`,
      guidelinesUrl: `${process.env.APP_BASE_URL}/lab/registration-guidelines`,
      requirementsUrl: `${process.env.APP_BASE_URL}/lab/registration-requirements`,
      
      // Support and info
      supportUrl: `${process.env.APP_BASE_URL}/support`,
      faqUrl: `${process.env.APP_BASE_URL}/lab/faq`,
      
      // Launch details
      launchDate: new Date().toLocaleDateString(),
      registrationDeadline: "No deadline - ongoing registrations",
      
      // Platform info
      websiteUrl: process.env.APP_BASE_URL,
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send admin notification for new waitlist entry
 */
async function sendAdminWaitlistNotificationEmail(adminEmail, waitlistEntry) {
  await emailService.send(
    "admin_waitlist_notification",
    adminEmail,
    "New Lab Waitlist Registration - CosmicForge Health Admin",
    {
      fullName: waitlistEntry.fullName,
      email: waitlistEntry.email,
      facilityName: waitlistEntry.facilityName,
      facilityType: waitlistEntry.facilityType || "Not specified",
      phone: waitlistEntry.phone || "Not provided",
      city: waitlistEntry.city || "Not specified",
      state: waitlistEntry.state || "Not specified",
      joinedAt: new Date(waitlistEntry.createdAt).toLocaleString(),
      trackingId: waitlistEntry.id,
      
      // Admin dashboard URLs
      waitlistDashboardUrl: `${process.env.APP_BASE_URL}/admin/lab-waitlist`,
      entryDetailsUrl: `${process.env.APP_BASE_URL}/admin/lab-waitlist/${waitlistEntry.id}`,
      waitlistStatsUrl: `${process.env.APP_BASE_URL}/admin/lab-waitlist/stats`,
      
      currentYear: new Date().getFullYear(),
    }
  );
}

/**
 * Send bulk launch notification completion summary to admin
 */
async function sendLaunchNotificationSummaryEmail(adminEmail, results) {
  await emailService.send(
    "admin_launch_notification_summary",
    adminEmail,
    `Launch Notification Campaign Complete - ${results.successful}/${results.total} Sent`,
    {
      totalEntries: results.total,
      successfulSent: results.successful,
      failedSent: results.failed,
      successRate: ((results.successful / results.total) * 100).toFixed(1),
      completedAt: new Date().toLocaleString(),
      
      // Error details if any
      hasErrors: results.failed > 0,
      errorCount: results.failed,
      errors: results.errors || [],
      
      // Dashboard URLs
      waitlistDashboardUrl: `${process.env.APP_BASE_URL}/admin/lab-waitlist`,
      waitlistStatsUrl: `${process.env.APP_BASE_URL}/admin/lab-waitlist/stats`,
      
      currentYear: new Date().getFullYear(),
    }
  );
}

// ADD THESE TO YOUR EXISTING MODULE.EXPORTS
module.exports = {
  sendLabFacilityRegistrationEmail,
  sendLabFacilityApprovalEmail,
  sendLabAdminRegistrationEmail,
  sendLabFacilityRejectionEmail,
  sendLabPersonnelInvitationEmail,
  sendLabPersonnelWelcomeEmail,
  sendLabPersonnelStatusChangeEmail,
  sendLabPersonnelRoleChangeEmail,
  sendAdminLabFacilityNotificationEmail,
  sendLabWaitlistConfirmationEmail,
  sendPharmWaitlistConfirmationEmail,
  sendLabWaitlistLaunchNotificationEmail,
  sendAdminWaitlistNotificationEmail,
  sendLaunchNotificationSummaryEmail
};
