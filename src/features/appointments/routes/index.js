// ===================================
// src/routes/AppointmentRoutes.js
// ===================================
/**
 * Appointment Routes - Handles booking, management, and meeting generation
 *
 * USAGE TRACKING (commented out but available):
 * - maxPatients: Track when doctor approves new patients
 * - consultations: Track when consultations are completed
 *
 * Use requireUsage middleware for usage-limited actions.
 */
const express = require("express");
const AppointmentController = require("../controllers/appointmentController");
const AppointmentValidationMiddleware = require("../middlewares/appointmentValidationMiddleware");
const DoctorGoogleAuthService = require("../services/googleMeet/doctorAuthService");
const TimezoneMiddleware = require("../../../shared/middlewares/timezoneMiddleware");

// Usage tracking middleware (use when needed)
// const requireUsage = require("../../subscriptions/middlewares/requireUsage");

const router = express.Router();
const appointmentController = new AppointmentController();
const doctorAuthService = new DoctorGoogleAuthService();


// ===================================
// TIMEZONE CONTEXT MIDDLEWARE
// Apply timezone context to all appointment routes
// ===================================
router.use(TimezoneMiddleware.ensureTimezoneContext);
router.use(TimezoneMiddleware.addTimezoneToResponse);

// ===================================
// TIMEZONE MANAGEMENT ROUTES
// ===================================

// Update user's timezone preference
router.patch(
  "/timezone",
  appointmentController.updateUserTimezone.bind(appointmentController)
);

// Get available timezones
router.get(
  "/timezones",
  appointmentController.getAvailableTimezones.bind(appointmentController)
);

// Analytics - Place before /:id routes
router.get(
  "/analytics",
  appointmentController.getAnalytics.bind(appointmentController)
);

// ===================================
// MAIN APPOINTMENT ROUTES WITH TIMEZONE VALIDATION
// ===================================

// Main appointment routes with validation
router.get(
  "/",
  AppointmentValidationMiddleware.validateFilters,
  appointmentController.getAllAppointments.bind(appointmentController)
);

router.get(
  "/:id",
  appointmentController.getAppointmentById.bind(appointmentController)
);

// Appointment creation with specialization access control
router.post(
  "/",
  TimezoneMiddleware.validateAppointmentTimezone,
  AppointmentValidationMiddleware.validateCreateAppointment, // Validate appointment data
  // checkDoctorSpecializationAccess, // Check if patient can book with this doctor based on subscription
  appointmentController.createAppointment.bind(appointmentController),
  // ActivityHooksService.trackActivityAfterSuccess
);

// Custom middleware to conditionally track usage only on approvals
// Uses the consolidated usageService for tracking
const trackApprovalUsage = async (req, res, next) => {
  try {
    if (req.shouldTrackUsage && req.usageTracking) {
      const { userId, usageType, increment } = req.usageTracking;
      const usageService = require("../../subscriptions/services/usageService");

      // Track the usage asynchronously (don't block response)
      usageService.consume(userId, usageType, increment).catch((error) => {
        console.error("Post-approval usage tracking failed:", error);
      });
    }

    next();
  } catch (error) {
    console.error("Approval tracking middleware error:", error);
    next(); // Don't fail the request for tracking issues
  }
};

router.patch(
  "/:id/doctor-approval",
  // usageMiddleware("maxPatients"),
  appointmentController.updateDoctorApproval.bind(appointmentController),
  // trackApprovalUsage
);

router.put(
  "/:id",
  TimezoneMiddleware.validateAppointmentTimezone, // NEW: Validate timezone for updates
  AppointmentValidationMiddleware.validateUpdateAppointment,
  appointmentController.updateAppointment.bind(appointmentController)
);

// Add to AppointmentRoutes.js
router.patch(
  "/:id/payment-status",
  appointmentController.updatePaymentStatus.bind(appointmentController)
);

// Appointment status management with validation
router.patch(
  "/:id/cancel",
  AppointmentValidationMiddleware.validateCancel,
  appointmentController.cancelAppointment.bind(appointmentController)
);

router.patch(
  "/:id/reschedule",
  TimezoneMiddleware.validateAppointmentTimezone, // NEW: Validate timezone for reschedule
  AppointmentValidationMiddleware.validateReschedule,
  appointmentController.rescheduleAppointment.bind(appointmentController)
);

router.patch(
  "/:id/complete",
  AppointmentValidationMiddleware.validateComplete,
  // usageMiddleware("consultations"),
  appointmentController.completeAppointment.bind(appointmentController),
  // ActivityHooksService.trackActivityAfterSuccess
);

// Payment processing with validation
router.post(
  "/:id/payment",
  AppointmentValidationMiddleware.validatePayment,
  appointmentController.processPayment.bind(appointmentController)
);

// Meeting link generation with validation
router.post(
  "/:id/meeting/google",
  // AppointmentValidationMiddleware.validateMeeting,
  appointmentController.generateGoogleMeetingLink.bind(appointmentController)
);

// Zoom meeting link generation
router.post(
  "/:id/meeting/zoom",
  appointmentController.generateZoomMeetingLink.bind(appointmentController)
);

// Jitsi meeting link generation
router.post(
  "/:id/meeting/jitsi",
  appointmentController.generateJitsiMeetingLink.bind(appointmentController)
);

router.get(
  "/:id/meeting",

  appointmentController.getMeetingDetails.bind(appointmentController)
);

// Check if patient can book with doctor (utility route for frontend)
router.get(
  "/check-access/:patientId/:doctorId",
  AppointmentValidationMiddleware.validatePatientDoctorParams,
  // checkDoctorSpecializationAccess,
  (req, res) => {
    // If middleware passes, patient has access
    res.json({
      success: true,
      message: "Patient can book appointment with this doctor",
      accessGranted: true,
    });
  }
);

// Get detailed access information (for showing upgrade prompts, etc.)
router.get(
  "/access-info/:patientId/:doctorId",
  AppointmentValidationMiddleware.validatePatientDoctorParams,
  // async (req, res) => {
  //   try {
  //     const { patientId, doctorId } = req.params;

  //     const accessInfo =
  //       await DoctorSpecializationAccessMiddleware.getDoctorAccessInfo(
  //         patientId,
  //         doctorId
  //       );

  //     res.json({
  //       success: true,
  //       data: {
  //         canBook: accessInfo.canBook,
  //         accessType: accessInfo.accessType,
  //         doctorSpecializations: accessInfo.doctorSpecializations,
  //         isGeneralEmergencyDoctor: accessInfo.isGeneralEmergencyDoctor,
  //         patientTier: accessInfo.patientTier,
  //         upgradeRequired: accessInfo.upgradeRequired,
  //         patientFeatures: accessInfo.patientFeatures,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to get access information",
  //       error: error.message,
  //     });
  //   }
  // }
);

// Patient and doctor specific routes
router.get(
  "/patient/:patientId",
  appointmentController.getPatientAppointments.bind(appointmentController)
);
router.get(
  "/doctor/:doctorId",
  appointmentController.getDoctorAppointments.bind(appointmentController)
);

router.get(
  "/patient/:patientId/upcoming",
  appointmentController.getPatientUpcomingAppointments.bind(
    appointmentController
  )
);

router.get(
  "/doctor/:doctorId/upcoming",
  appointmentController.getDoctorUpcomingAppointments.bind(
    appointmentController
  )
);

// Reminder management
router.post(
  "/:id/reminder",
  appointmentController.sendAppointmentReminder.bind(appointmentController)
);

// Route to initiate Google OAuth for doctors
router.get("/auth/google/doctors/:doctorId", (req, res) => {
  const { doctorId } = req.params;
  const authUrl = doctorAuthService.getGoogleAuthUrl(doctorId);
  res.redirect(authUrl);
});

// Google OAuth callback route
router.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect("/dashboard?google_auth=denied");
    }

    const result = await doctorAuthService.handleGoogleCallback(code, state);

    if (result.success) {
      res.redirect("/dashboard?google_auth=success");
    } else {
      res.redirect(
        `/dashboard?google_auth=error&message=${encodeURIComponent(
          result.error
        )}`
      );
    }
  } catch (error) {
    res.redirect("/dashboard?google_auth=error");
  }
});

module.exports = router;
