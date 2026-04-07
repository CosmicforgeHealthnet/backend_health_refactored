// src/middlewares/doctorSpecializationAccessMiddleware.js

/**
 * DOCTOR SPECIALIZATION ACCESS MIDDLEWARE
 * =====================================
 *
 * This middleware controls patient access to doctors based on:
 * 1. Patient's subscription tier and features
 * 2. Doctor's areas of specialization
 *
 * ACCESS LEVELS:
 * - Free Tier: General + Emergency specialists only (generalEmergencySpecialists: true)
 * - Basic+ Tiers: All specialists (allSpecialists: true)
 *
 * USAGE:
 * Apply this middleware to appointment booking routes to enforce subscription-based access control
 */

const doctorProfileRepository = require("../../doctor/repositories/doctorProfileRepository");
const SubscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");
const {
  DOCTOR_SPECIALIZATION_ACCESS,
} = require("../utils/subscriptionConstants");

class DoctorSpecializationAccessMiddleware {
  /**
   * Main middleware function to check doctor specialization access
   * Expects patientId and doctorId in req.body or req.params
   */
  static async checkDoctorSpecializationAccess(req, res, next) {
    try {
      // STEP 1: Extract patient and doctor IDs from request
      const patientId = req.body?.patientId || req.params?.patientId;
      const doctorId = req.body?.doctorId || req.params?.doctorId;


      // Validate required IDs
      if (!patientId || !doctorId) {
        return res.status(400).json({
          success: false,
          message: "Patient ID and Doctor ID are required",
          errorCode: "MISSING_REQUIRED_IDS"
        });
      }

      console.log(
        "🔍 Checking doctor specialization access for patient:",
        patientId,
        "doctor:",
        doctorId
      );

      // STEP 2: Get doctor profile with professional license information
      const doctorProfile = await doctorProfileRepository.findByUserId(
        doctorId
      );

      if (!doctorProfile) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found",
          errorCode: "DOCTOR_NOT_FOUND",
        });
      }

      // STEP 3: Extract doctor's specialization areas
      const professionalLicense = doctorProfile.professionalLicense;

      if (!professionalLicense || !professionalLicense.areasOfSpecialization) {
        console.log(
          "⚠️ Doctor has no specialization areas defined, allowing booking"
        );
        return next(); // Allow booking if no specialization restrictions
      }

      const doctorSpecializations = professionalLicense.areasOfSpecialization;
      console.log("👨‍⚕️ Doctor specializations:", doctorSpecializations);

      // STEP 4: Get patient's subscription to determine access level
      const patientSubscription =
        await SubscriptionCompatibilityService.getUserSubscriptionBasic(
          patientId
        );

      if (!patientSubscription) {
        return res.status(404).json({
          success: false,
          message: "Patient subscription not found",
          errorCode: "SUBSCRIPTION_NOT_FOUND",
        });
      }

      console.log("📋 Patient subscription:", {
        tier: patientSubscription.tier,
        planType: patientSubscription.planType,
        features: patientSubscription.features,
      });

      // STEP 5: Determine patient's access level based on subscription features
      const hasAllSpecialistsAccess = !!(
        patientSubscription.features &&
        patientSubscription.features.allSpecialists
      );

      const hasGeneralEmergencyAccess = !!(
        patientSubscription.features &&
        patientSubscription.features.generalEmergencySpecialists
      );

      console.log("🔐 Access levels:", {
        allSpecialists: hasAllSpecialistsAccess,
        generalEmergencySpecialists: hasGeneralEmergencyAccess,
      });

      // STEP 6: Get general/emergency specializations from constants (basic tier access)
      const generalEmergencySpecializations =
        DOCTOR_SPECIALIZATION_ACCESS.GENERAL_EMERGENCY_SPECIALIZATIONS;

      // STEP 7: Check if doctor has any general/emergency specializations
      const hasGeneralEmergencySpecialization = doctorSpecializations.some(
        (spec) =>
          generalEmergencySpecializations.some((generalSpec) => {
            // Normalize both strings by replacing spaces and dashes for comparison
            const normalizedSpec = spec.toLowerCase().replace(/[\s-]/g, "");
            const normalizedGeneralSpec = generalSpec
              .toLowerCase()
              .replace(/[\s-]/g, "");

            return (
              normalizedSpec.includes(normalizedGeneralSpec) ||
              normalizedGeneralSpec.includes(normalizedSpec)
            );
          })
      );

      console.log("🏥 Doctor specialization type:", {
        isGeneralEmergency: hasGeneralEmergencySpecialization,
        specializations: doctorSpecializations,
      });

      // STEP 8: Apply access control logic

      // CASE 1: Premium users (all specialists access)
      if (hasAllSpecialistsAccess) {
        console.log("✅ Patient has all specialists access - booking allowed");
        return next();
      }

      // CASE 2: Basic users with general/emergency doctor
      if (hasGeneralEmergencyAccess && hasGeneralEmergencySpecialization) {
        console.log(
          "✅ Patient has general/emergency access and doctor is general/emergency specialist - booking allowed"
        );
        return next();
      }

      // CASE 3: Users with no specialist access features (should rarely happen with proper subscription setup)
      if (!hasGeneralEmergencyAccess && !hasAllSpecialistsAccess) {
        console.log("❌ Patient has no specialist access features enabled");
        return res.status(403).json({
          success: false,
          message:
            "Your current plan doesn't include access to specialist consultations. Please upgrade your subscription to book appointments with specialists.",
          errorCode: "SPECIALIST_ACCESS_REQUIRED",
          doctorSpecializations,
          patientPlan: {
            tier: patientSubscription.tier,
            planType: patientSubscription.planType,
          },
          upgradeRequired: true,
          accessLevel: "none",
        });
      }

      // CASE 4: Basic users trying to book advanced specialist
      if (hasGeneralEmergencyAccess && !hasGeneralEmergencySpecialization) {
        console.log(
          "❌ Patient has general access but doctor is advanced specialist"
        );
        return res.status(403).json({
          success: false,
          message:
            "Your current plan only includes access to general and emergency medicine specialists. This doctor specializes in advanced medical fields that require a premium subscription.",
          errorCode: "PREMIUM_SPECIALIST_ACCESS_REQUIRED",
          doctorSpecializations,
          patientPlan: {
            tier: patientSubscription.tier,
            planType: patientSubscription.planType,
          },
          upgradeRequired: true,
          accessLevel: "general_emergency_only",
          requiredFeature: "allSpecialists",
        });
      }

      // FALLBACK: Should not reach here normally
      console.log("⚠️ Unexpected access control scenario, denying access");
      return res.status(403).json({
        success: false,
        message:
          "Unable to determine appointment booking access. Please contact support.",
        errorCode: "ACCESS_DETERMINATION_ERROR",
      });
    } catch (error) {
      console.error(
        "❌ Error in doctor specialization access middleware:",
        error
      );

      // Log additional error details
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        patientId: req.body?.patientId,
        doctorId: req.body?.doctorId,
      });

      return res.status(500).json({
        success: false,
        message:
          "An error occurred while checking appointment booking access. Please try again.",
        errorCode: "ACCESS_CHECK_ERROR",
      });
    }
  }

  /**
   * Utility method to get detailed access info for frontend
   */
  static async getDoctorAccessInfo(patientId, doctorId) {
    try {
      const doctorProfile = await doctorProfileRepository.findByUserId(
        doctorId
      );
      const patientSubscription =
        await SubscriptionCompatibilityService.getUserSubscriptionBasic(
          patientId
        );

      if (!doctorProfile?.professionalLicense?.areasOfSpecialization) {
        return {
          canBook: true,
          accessType: "unrestricted",
          doctorSpecializations: [],
          patientFeatures: patientSubscription.features,
        };
      }

      const doctorSpecializations =
        doctorProfile.professionalLicense.areasOfSpecialization;
      const hasAllSpecialists = !!patientSubscription.features?.allSpecialists;
      const hasGeneralEmergency =
        !!patientSubscription.features?.generalEmergencySpecialists;

      const generalEmergencySpecs =
        DOCTOR_SPECIALIZATION_ACCESS.GENERAL_EMERGENCY_SPECIALIZATIONS;

      const isGeneralEmergencyDoctor = doctorSpecializations.some((spec) =>
        generalEmergencySpecs.some((genSpec) => {
          // Normalize both strings by replacing spaces and dashes for comparison
          const normalizedSpec = spec.toLowerCase().replace(/[\s-]/g, "");
          const normalizedGenSpec = genSpec.toLowerCase().replace(/[\s-]/g, "");

          return (
            normalizedSpec.includes(normalizedGenSpec) ||
            normalizedGenSpec.includes(normalizedSpec)
          );
        })
      );

      let canBook = false;
      let accessType = "none";
      let upgradeRequired = null;

      if (hasAllSpecialists) {
        canBook = true;
        accessType = "all_specialists";
      } else if (hasGeneralEmergency && isGeneralEmergencyDoctor) {
        canBook = true;
        accessType = "general_emergency";
      } else if (hasGeneralEmergency && !isGeneralEmergencyDoctor) {
        canBook = false;
        accessType = "general_emergency_only";
        upgradeRequired = "allSpecialists";
      } else {
        canBook = false;
        accessType = "none";
        upgradeRequired = "generalEmergencySpecialists";
      }

      return {
        canBook,
        accessType,
        doctorSpecializations,
        isGeneralEmergencyDoctor,
        patientFeatures: patientSubscription.features,
        patientTier: patientSubscription.tier,
        upgradeRequired,
      };
    } catch (error) {
      console.error("❌ Error getting doctor access info:", error);
      return {
        canBook: false,
        accessType: "error",
        error: error.message,
      };
    }
  }
}

module.exports = DoctorSpecializationAccessMiddleware;
module.exports.checkDoctorSpecializationAccess = DoctorSpecializationAccessMiddleware.checkDoctorSpecializationAccess;

/**
 * ========================================
 * HOW TO USE THIS MIDDLEWARE IN ROUTES
 * ========================================
 *
 * EXAMPLE 1: Basic Appointment Booking Route
 * -------------------------------------------
 *
 * const { checkDoctorSpecializationAccess } = require('../middlewares/doctorSpecializationAccessMiddleware');
 * const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');
 *
 * // POST /api/appointments/book
 * router.post('/book',
 *   authenticateJWT,                           // Ensure user is authenticated
 *   checkDoctorSpecializationAccess,          // Check if patient can book with this doctor
 *   appointmentController.bookAppointment     // Process the booking
 * );
 *
 * // Request body should contain:
 * // { patientId: "user123", doctorId: "doc456", appointmentDate: "2024-01-15T10:00:00Z" }
 *
 *
 * EXAMPLE 2: Using with Parameters Instead of Body
 * ------------------------------------------------
 *
 * // GET /api/appointments/check-access/:patientId/:doctorId
 * router.get('/check-access/:patientId/:doctorId',
 *   authenticateJWT,
 *   checkDoctorSpecializationAccess,
 *   (req, res) => {
 *     res.json({ success: true, message: "Access granted" });
 *   }
 * );
 *
 *
 * EXAMPLE 3: Get Access Information (Utility Method)
 * ---------------------------------------------------
 *
 * const DoctorSpecializationAccessMiddleware = require('../middlewares/doctorSpecializationAccessMiddleware');
 *
 * // In your controller:
 * async function checkDoctorAccess(req, res) {
 *   const { patientId, doctorId } = req.params;
 *
 *   const accessInfo = await DoctorSpecializationAccessMiddleware.getDoctorAccessInfo(patientId, doctorId);
 *
 *   res.json({
 *     success: true,
 *     canBook: accessInfo.canBook,
 *     accessType: accessInfo.accessType,
 *     doctorSpecializations: accessInfo.doctorSpecializations,
 *     upgradeRequired: accessInfo.upgradeRequired
 *   });
 * }
 *
 *
 * EXAMPLE 4: Complete Appointment Routes Setup
 * ---------------------------------------------
 *
 * const express = require('express');
 * const router = express.Router();
 * const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');
 * const { checkDoctorSpecializationAccess } = require('../middlewares/doctorSpecializationAccessMiddleware');
 * const appointmentController = require('../../appointments/controllers/appointmentController');
 *
 * // Apply authentication to all routes
 * router.use(authenticateJWT);
 *
 * // Book appointment with specialization check
 * router.post('/book',
 *   checkDoctorSpecializationAccess,
 *   appointmentController.bookAppointment
 * );
 *
 * // Check if patient can book with doctor (before showing booking form)
 * router.get('/can-book/:patientId/:doctorId',
 *   checkDoctorSpecializationAccess,
 *   (req, res) => res.json({ success: true, message: "Booking allowed" })
 * );
 *
 * // Get detailed access information
 * router.get('/access-info', async (req, res) => {
 *   const accessInfo = await DoctorSpecializationAccessMiddleware.getDoctorAccessInfo(
 *     req.params.patientId,
 *     req.params.doctorId
 *   );
 *   res.json({ success: true, data: accessInfo });
 * });
 *
 * module.exports = router;
 *
 *
 * EXPECTED RESPONSES:
 * ===================
 *
 * SUCCESS (Access Granted):
 * - Status: 200
 * - Middleware calls next() to continue to appointment booking
 *
 * FREE TIER (No Access):
 * - Status: 403
 * - errorCode: "SPECIALIST_ACCESS_REQUIRED"
 * - upgradeRequired: true
 *
 * BASIC TIER (Advanced Specialist):
 * - Status: 403
 * - errorCode: "PREMIUM_SPECIALIST_ACCESS_REQUIRED"
 * - upgradeRequired: true
 * - requiredFeature: "allSpecialists"
 *
 * ERRORS:
 * - Status: 404 - Doctor/Patient not found
 * - Status: 400 - Missing required IDs
 * - Status: 500 - Server error
 */
