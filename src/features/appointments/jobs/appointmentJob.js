// // ===================================
// // src/jobs/appointmentCronJobs.js
// // ===================================

// const cron = require("node-cron");
// const AppointmentRepository = require("../repositories/appointmentRepository");
// const ZoomMeetingService = require("../services/zoomMeet/zoomMeetingService");
// const GoogleMeetService = require("../services/googleMeet/googleMeetService");
// const JitsiMeetingService = require("../services/Jitsi/jitsiMeetingService");
// const appointmentEmailHelpers = require("../../../shared/services/email/helper/index");
// const NotificationService = require('../services/notificationSocketService');
// const {
//   addHours,
//   isAfter,
//   isBefore,
//   parseISO,
//   format,
//   addMinutes,
//   isWithinInterval,
// } = require("date-fns");

// class AppointmentCronJobs {
//   constructor() {
//     this.appointmentRepository = new AppointmentRepository();
//     this.zoomMeetingService = new ZoomMeetingService();
//     this.googleMeetService = new GoogleMeetService();
//     this.jitsiMeetingService = new JitsiMeetingService();
//     this.appointmentEmailHelpers = appointmentEmailHelpers;
//     this.notificationService = new NotificationService();
//     // Track processed appointments to avoid duplicate reminders/actions
//     this.processedReminders = new Set();
//     this.processedMeetingEnds = new Set();
//   }

//   /**
//    * Initialize all cron jobs
//    */
//   initializeCronJobs() {
//     console.log("🕐 Initializing appointment cron jobs...");

//     // Run appointment reminders every 5 minutes
//     this.scheduleAppointmentReminders();

//     // Run meeting end checks every 2 minutes
//     this.scheduleMeetingEndChecks();

//     // Run meeting preparation checks (for meetings starting in 15 minutes)
//     this.scheduleMeetingPreparationChecks();

//     // Cleanup processed IDs daily at midnight
//     this.scheduleCleanupProcessedIds();

//     // unapproved appointment cancellation cron
//     this.scheduleUnapprovedAppointmentCancellations();

//     console.log("✅ All appointment cron jobs initialized successfully");
//   }

//   /**
//    * Schedule appointment reminders (runs every 5 minutes)
//    * Sends reminders 1 hour before appointments
//    */
//   scheduleAppointmentReminders() {
//     cron.schedule("*/5 * * * *", async () => {
//       try {
//         console.log("🔔 Running appointment reminder check...");
//         await this.checkAppointmentReminders();
//       } catch (error) {
//         console.error("❌ Error in appointment reminder cron:", error);
//       }
//     });

//     console.log("✅ Appointment reminder cron job scheduled (every 5 minutes)");
//   }

//   /**
//    * Schedule meeting end checks (runs every 2 minutes)
//    * Ends meetings that have exceeded their duration
//    */
//   scheduleMeetingEndChecks() {
//     cron.schedule("*/2 * * * *", async () => {
//       try {
//         console.log("⏰ Running meeting end check...");
//         await this.checkMeetingEnds();
//       } catch (error) {
//         console.error("❌ Error in meeting end cron:", error);
//       }
//     });

//     console.log("✅ Meeting end check cron job scheduled (every 2 minutes)");
//   }

//   /**
//    * Schedule meeting preparation checks (runs every 5 minutes)
//    * Prepares meetings starting in 15 minutes
//    */
//   scheduleMeetingPreparationChecks() {
//     cron.schedule("*/5 * * * *", async () => {
//       try {
//         console.log("🚀 Running meeting preparation check...");
//         await this.checkMeetingPreparation();
//       } catch (error) {
//         console.error("❌ Error in meeting preparation cron:", error);
//       }
//     });

//     console.log("✅ Meeting preparation cron job scheduled (every 5 minutes)");
//   }

//   /**
//    * Schedule cleanup of processed IDs (runs daily at midnight)
//    */
//   scheduleCleanupProcessedIds() {
//     cron.schedule("0 0 * * *", () => {
//       console.log("🧹 Cleaning up processed appointment IDs...");
//       this.processedReminders.clear();
//       this.processedMeetingEnds.clear();
//       console.log("✅ Processed IDs cleanup completed");
//     });

//     console.log(
//       "✅ Processed IDs cleanup cron job scheduled (daily at midnight)"
//     );
//   }

//   /**
//    * Check for appointments that need reminders (1 hour before)
//    */
//   async checkAppointmentReminders() {
//     try {
//       const now = new Date();
//       const oneHourFromNow = addHours(now, 1);
//       const twoHoursFromNow = addHours(now, 2);

//       // Get appointments scheduled for the next hour
//       const appointments = await this.appointmentRepository.findAll({
//         status: "scheduled",
//         dateRange: {
//           startDate: format(oneHourFromNow, "yyyy-MM-dd"),
//           endDate: format(twoHoursFromNow, "yyyy-MM-dd"),
//         },
//       });

//       let remindersSent = 0;

//       for (const appointment of appointments) {
//         try {
//           const appointmentDateTime = this.parseAppointmentDateTime(
//             appointment.appointmentDate,
//             appointment.appointmentTime
//           );

//           // Check if appointment is exactly 1 hour away (±5 minutes tolerance)
//           const timeDifference = appointmentDateTime.getTime() - now.getTime();
//           const oneHourInMs = 60 * 60 * 1000;
//           const tolerance = 5 * 60 * 1000; // 5 minutes

//           const isWithinReminderWindow =
//             Math.abs(timeDifference - oneHourInMs) <= tolerance;

//           if (
//             isWithinReminderWindow &&
//             !this.processedReminders.has(appointment.id)
//           ) {
//             await this.sendAppointmentReminder(appointment);
//             this.processedReminders.add(appointment.id);
//             remindersSent++;
//           }
//         } catch (error) {
//           console.error(
//             `❌ Error processing reminder for appointment ${appointment.id}:`,
//             error
//           );
//         }
//       }

//       if (remindersSent > 0) {
//         console.log(`✅ Sent ${remindersSent} appointment reminders`);
//       }
//     } catch (error) {
//       console.error("❌ Error checking appointment reminders:", error);
//     }
//   }

//   /**
//    * Check for meetings that should be ended
//    */
//   async checkMeetingEnds() {
//     try {
//       const now = new Date();
//       const today = format(now, "yyyy-MM-dd");

//       // Get today's appointments that have meeting links
//       const appointments = await this.appointmentRepository.findAll({
//         appointmentDate: today,
//         status: "scheduled",
//       });

//       let meetingsEnded = 0;

//       for (const appointment of appointments) {
//         try {
//           if (
//             !appointment.meetingLink ||
//             this.processedMeetingEnds.has(appointment.id)
//           ) {
//             continue;
//           }

//           const appointmentStart = this.parseAppointmentDateTime(
//             appointment.appointmentDate,
//             appointment.appointmentTime
//           );

//           const appointmentEnd = addMinutes(
//             appointmentStart,
//             appointment.duration || 30
//           );

//           // Check if appointment duration has elapsed
//           if (isAfter(now, appointmentEnd)) {
//             const success = await this.endMeeting(appointment);
//             if (success) {
//               this.processedMeetingEnds.add(appointment.id);
//               meetingsEnded++;

//               // Update appointment status to completed if not already
//               if (appointment.status !== "completed") {
//                 await this.appointmentRepository.update(appointment.id, {
//                   status: "completed",
//                   completedAt: now,
//                   notes:
//                     "Appointment automatically completed after duration elapsed",
//                 });
//               }
//             }
//           }
//         } catch (error) {
//           console.error(
//             `❌ Error processing meeting end for appointment ${appointment.id}:`,
//             error
//           );
//         }
//       }

//       if (meetingsEnded > 0) {
//         console.log(
//           `✅ Ended ${meetingsEnded} meetings that exceeded their duration`
//         );
//       }
//     } catch (error) {
//       console.error("❌ Error checking meeting ends:", error);
//     }
//   }


//   /**
//    * Send appointment reminder to doctor and patient
//    */
//   async sendAppointmentReminder(appointment) {
//     try {
//       console.log(`📧 Sending reminder for appointment ${appointment.id}...`);

//       const doctorData = appointment.doctor;
//       const patientData = appointment.patient;

//       // Format appointment details
//       const appointmentDetails = {
//         id: appointment.id,
//         date: format(
//           this.parseAppointmentDateTime(
//             appointment.appointmentDate,
//             appointment.appointmentTime
//           ),
//           "EEEE, MMMM do, yyyy"
//         ),
//         time: format(
//           this.parseAppointmentDateTime(
//             appointment.appointmentDate,
//             appointment.appointmentTime
//           ),
//           "h:mm a"
//         ),
//         duration: appointment.duration,
//         type: appointment.type,
//         meetingLink: appointment.meetingLink,
//         meetingProvider: appointment.meetingProvider,
//       };

//       // Send reminder to doctor
//       if (doctorData?.email) {
//         await this.appointmentEmailHelpers.sendDoctorAppointmentReminder({
//           email: doctorData.email,
//           doctorName: doctorData.fullName,
//           patientName: patientData.fullName,
//           appointmentDetails,
//         });
//       }

//       // Send reminder to patient
//       if (patientData?.email) {
//         await this.appointmentEmailHelpers.sendPatientAppointmentReminder({
//           email: patientData.email,
//           patientName: patientData.fullName,
//           doctorName: doctorData.fullName,
//           appointmentDetails,
//         });
//       }

//       // Add notifications
//       await this.notificationService.createNotification(
//         appointment.patientId,
//         "notification",
//         `Reminder: Your appointment with Dr. ${appointment.doctor.fullName} is in 1 hour (${appointmentDetails.time}).`,
//         {
//           action: "appointment_reminder",
//           appointmentId: appointment.id,
//           appointmentTime: appointmentDetails.time,
//           meetingLink: appointment.meetingLink,
//           link: "/patients/dashboard/appointments/overview",
//         }
//       );

//       await this.notificationService.createNotification(
//         appointment.doctorId,
//         "notification",
//         `Reminder: Your appointment with ${appointment.patient.fullName} is in 1 hour (${appointmentDetails.time}).`,
//         {
//           action: "appointment_reminder",
//           appointmentId: appointment.id,
//           appointmentTime: appointmentDetails.time,
//           meetingLink: appointment.meetingLink,
//           link: "doctors/dashboard/appointments",
//         }
//       );

//       console.log(
//         `✅ Reminder sent successfully for appointment ${appointment.id}`
//       );
//     } catch (error) {
//       console.error(
//         `❌ Error sending reminder for appointment ${appointment.id}:`,
//         error
//       );
//     }
//   }

//   /**
//    * Send meeting preparation notification (15 minutes before)
//    */
//   async sendMeetingPreparationNotification(appointment) {
//     try {
//       console.log(
//         `🚀 Sending preparation notification for appointment ${appointment.id}...`
//       );

//       const appointmentDetails = {
//         id: appointment.id,
//         time: format(
//           this.parseAppointmentDateTime(
//             appointment.appointmentDate,
//             appointment.appointmentTime
//           ),
//           "h:mm a"
//         ),
//         meetingLink: appointment.meetingLink,
//         meetingProvider: appointment.meetingProvider,
//         meetingPassword: appointment.meetingPassword,
//       };

//       // Send preparation notifications
//       await this.appointmentEmailHelpers.sendDoctorMeetingPreparation({
//         email: appointment.doctor.email,
//         doctorName: appointment.doctor.fullName,
//         patientName: appointment.patient.fullName,
//         appointmentDetails,
//       });

//       await this.appointmentEmailHelpers.sendPatientMeetingPreparation({
//         email: appointment.patient.email,
//         patientName: appointment.patient.fullName,
//         doctorName: appointment.doctor.fullName,
//         appointmentDetails,
//       });

//       // Add notifications
//     await this.notificationService.createNotification(
//       appointment.patientId,
//       "alert",
//       `Your appointment with Dr. ${appointment.doctor.fullName} starts in 15 minutes! Join now.`,
//       {
//         action: "meeting_starting_soon",
//         appointmentId: appointment.id,
//         meetingLink: appointment.meetingLink,
//         meetingProvider: appointment.meetingProvider,
//         link: "/patients/dashboard/appointments/overview"
//       }
//     );

//     await this.notificationService.createNotification(
//       appointment.doctorId,
//       "alert",
//       `Your appointment with ${appointment.patient.fullName} starts in 15 minutes! Join now.`,
//       {
//         action: "meeting_starting_soon",
//         appointmentId: appointment.id,
//         meetingLink: appointment.meetingLink,
//         meetingProvider: appointment.meetingProvider,
//         link: "doctors/dashboard/appointments"
//       }
//     );

//       console.log(
//         `✅ Preparation notification sent for appointment ${appointment.id}`
//       );
//     } catch (error) {
//       console.error(
//         `❌ Error sending preparation notification for appointment ${appointment.id}:`,
//         error
//       );
//     }
//   }

//   /**
//    * End meeting based on provider
//    */


//   /**
//    * Schedule unapproved appointment cancellations (runs every 30 minutes)
//    * Cancels appointments that haven't been approved by doctors when appointment time has passed
//    */
//   scheduleUnapprovedAppointmentCancellations() {
//     cron.schedule("*/30 * * * *", async () => {
//       try {
//         console.log(
//           "🔍 Checking for unapproved appointments that need cancellation..."
//         );
//         await this.checkUnapprovedAppointments();
//       } catch (error) {
//         console.error(
//           "❌ Error in unapproved appointment cancellation cron:",
//           error
//         );
//       }
//     });

//     console.log(
//       "✅ Unapproved appointment cancellation cron job scheduled (every 30 minutes)"
//     );
//   }

//   /**
//    * Check for paid but unapproved appointments that have passed their appointment time
//    */
//   async checkUnapprovedAppointments() {
//     try {
//       const now = new Date();
//       const today = format(now, "yyyy-MM-dd");
//       const currentTime = format(now, "HH:mm");

//       // Get appointments that are:
//       // 1. Payment completed
//       // 2. Not approved by doctor (isDoctorApproved = false or null)
//       // 3. Not cancelled
//       // 4. Appointment time has passed
//       const unapprovedAppointments = await this.appointmentRepository.findAll({
//         paymentStatus: "completed",
//         status: "pending", // Still pending because doctor hasn't approved
//         appointmentDate: today,
//       });

//       let cancellationsProcessed = 0;

//       for (const appointment of unapprovedAppointments) {
//         try {
//           // Skip if already approved or cancelled
//           if (
//             appointment.isDoctorApproved === true ||
//             appointment.isCancelled === true
//           ) {
//             continue;
//           }

//           // Skip if already processed
//           if (this.processedMeetingEnds.has(`unapproved_${appointment.id}`)) {
//             continue;
//           }

//           const appointmentDateTime = this.parseAppointmentDateTime(
//             appointment.appointmentDate,
//             appointment.appointmentTime
//           );

//           // Check if appointment time has passed (with 10 minute grace period)
//           const gracePeridMinutes = 10;
//           const appointmentWithGrace = addMinutes(
//             appointmentDateTime,
//             gracePeridMinutes
//           );

//           if (isAfter(now, appointmentWithGrace)) {
//             await this.cancelUnapprovedAppointment(appointment);
//             this.processedMeetingEnds.add(`unapproved_${appointment.id}`);
//             cancellationsProcessed++;
//           }
//         } catch (error) {
//           console.error(
//             `❌ Error processing unapproved appointment ${appointment.id}:`,
//             error
//           );
//         }
//       }

//       if (cancellationsProcessed > 0) {
//         console.log(
//           `✅ Cancelled ${cancellationsProcessed} unapproved appointments`
//         );
//       }
//     } catch (error) {
//       console.error("❌ Error checking unapproved appointments:", error);
//     }
//   }

/**
 * Cancel an unapproved appointment and process refund
 */
// async cancelUnapprovedAppointment(appointment) {
//   try {
//     console.log(
//       `🚫 Auto-cancelling unapproved appointment ${appointment.id}...`
//     );

//     // Import AppointmentService to access cancellation and refund methods
//     const AppointmentService = require("../services/appointmentService");
//     const appointmentService = new AppointmentService();

//     // Cancel the appointment
//     const cancellationData = {
//       reason:
//         "Appointment automatically cancelled - Doctor did not approve within the scheduled time",
//       cancelledBy: "system",
//       refundAmount: appointment.consultationFee,
//     };

//     const cancelledAppointment = await appointmentService.cancelAppointment(
//       appointment.id,
//       cancellationData
//     );

//     // Process the refund
//     const refundData = {
//       refundAmount: appointment.consultationFee,
//       reason: "Auto-cancellation due to lack of doctor approval",
//       processedBy: "system",
//     };

//     const refundResult = await appointmentService.processRefund(
//       appointment.id,
//       refundData
//     );

//     if (refundResult.success) {

//        // Add notifications for auto-cancellation
//     await this.notificationService.createNotification(
//       appointment.patientId,
//       "alert",
//       `Your appointment with Dr. ${appointment.doctor.fullName} has been automatically cancelled as the doctor did not approve it within the scheduled time. A full refund of $${appointment.consultationFee} is being processed.`,
//       {
//         action: "appointment_auto_cancelled",
//         appointmentId: appointment.id,
//         refundAmount: appointment.consultationFee,
//         reason: "Doctor did not approve within scheduled time",
//         link: "/patients/dashboard/appointments/overview"
//       }
//     );

//     await this.notificationService.createNotification(
//       appointment.doctorId,
//       "alert",
//       `You missed approving an appointment with ${appointment.patient.fullName} scheduled for ${appointment.appointmentDate} at ${appointment.appointmentTime}. The appointment has been cancelled and the patient refunded.`,
//       {
//         action: "missed_appointment_approval",
//         appointmentId: appointment.id,
//         refundAmount: appointment.consultationFee,
//         link: "doctors/dashboard/appointments"
//       }
//     );

//       console.log(
//         `✅ Successfully cancelled and refunded appointment ${appointment.id}`
//       );

//       // Send notification emails
//       await this.sendUnapprovedCancellationNotifications(appointment);
//     } else {
//       console.error(
//         `❌ Failed to process refund for appointment ${appointment.id}:`,
//         refundResult.error
//       );
//     }

//     return {
//       success: true,
//       appointment: cancelledAppointment,
//       refund: refundResult,
//     };
//   } catch (error) {
//     console.error(
//       `❌ Error cancelling unapproved appointment ${appointment.id}:`,
//       error
//     );
//     return {
//       success: false,
//       error: error.message,
//     };
//   }
// }

//   /**
//    * Send notification emails for auto-cancelled unapproved appointments
//    */
//   async sendUnapprovedCancellationNotifications(appointment) {
//     try {
//       const doctorData = appointment.doctor;
//       const patientData = appointment.patient;

//       const notificationDetails = {
//         id: appointment.id,
//         date: appointment.appointmentDate,
//         time: appointment.appointmentTime,
//         cancellationReason:
//           "Doctor did not approve appointment within scheduled time",
//         refundAmount: appointment.consultationFee,
//         processingTime: "3-5 business days",
//       };

//       // Notify patient about cancellation and refund
//       if (patientData?.email) {
//         await this.appointmentEmailHelpers.sendPatientUnapprovedCancellationEmail(
//           {
//             email: patientData.email,
//             patientName: patientData.fullName,
//             doctorName: doctorData.fullName,
//             appointmentDetails: notificationDetails,
//           }
//         );
//       }

//       // Notify doctor about missed approval
//       if (doctorData?.email) {
//         await this.appointmentEmailHelpers.sendDoctorMissedApprovalNotificationEmail(
//           {
//             email: doctorData.email,
//             doctorName: doctorData.fullName,
//             patientName: patientData.fullName,
//             appointmentDetails: notificationDetails,
//           }
//         );
//       }

//       console.log(
//         `✅ Unapproved cancellation notifications sent for appointment ${appointment.id}`
//       );
//     } catch (emailError) {
//       console.error(
//         `❌ Error sending unapproved cancellation notifications for appointment ${appointment.id}:`,
//         emailError
//       );
//     }
//   }

//   /**
//    * Parse appointment date and time into Date object
//    */
//   parseAppointmentDateTime(appointmentDate, appointmentTime) {
//     const dateTimeString = `${appointmentDate}T${appointmentTime}:00`;
//     return parseISO(dateTimeString);
//   }

//   /**
//    * Stop all cron jobs (useful for graceful shutdown)
//    */
//   stopAllCronJobs() {
//     console.log("🛑 Stopping all appointment cron jobs...");
//     // Note: node-cron doesn't provide a direct way to stop individual jobs
//     // You would need to track them individually if you need fine-grained control
//     console.log("✅ All appointment cron jobs stopped");
//   }

//   /**
//    * Get cron job status
//    */
//   getStatus() {
//     return {
//       processedReminders: this.processedReminders.size,
//       processedMeetingEnds: this.processedMeetingEnds.size,
//       lastCheck: new Date().toISOString(),
//     };
//   }
// }

// module.exports = AppointmentCronJobs;


// ===================================
// src/jobs/appointmentCronJobs.js (Updated with Timezone Support)
// ===================================

const cron = require("node-cron");
const AppointmentRepository = require("../repositories/appointmentRepository");
const TimezoneService = require("../../compliance/services/timezoneService");
const ZoomMeetingService = require("../services/zoomMeet/zoomMeetingService");
const GoogleMeetService = require("../services/googleMeet/googleMeetService");
const JitsiMeetingService = require("../services/Jitsi/jitsiMeetingService");
const appointmentEmailHelpers = require("../../../shared/services/email/helper/index");
const NotificationService = require('../../notifications/services/notificationService');
const {
  addHours,
  isAfter,
  isBefore,
  parseISO,
  format,
  addMinutes,
  isWithinInterval,
} = require("date-fns");

class AppointmentCronJobs {
  constructor() {
    this.appointmentRepository = new AppointmentRepository();
    this.zoomMeetingService = new ZoomMeetingService();
    this.googleMeetService = new GoogleMeetService();
    this.jitsiMeetingService = new JitsiMeetingService();
    this.appointmentEmailHelpers = appointmentEmailHelpers;
    this.notificationService = new NotificationService();
    // Track processed appointments to avoid duplicate reminders/actions
    this.processedReminders = new Set();
    this.processedMeetingEnds = new Set();
  }

  /**
   * Initialize all cron jobs
   */
  initializeCronJobs() {
    console.log("🕐 Initializing timezone-aware appointment cron jobs...");

    // Run appointment reminders every 5 minutes
    this.scheduleAppointmentReminders();

    // Run meeting end checks every 2 minutes
    this.scheduleMeetingEndChecks();

    // Run meeting preparation checks (for meetings starting in 15 minutes)
    this.scheduleMeetingPreparationChecks();

    // Cleanup processed IDs daily at midnight
    this.scheduleCleanupProcessedIds();

    // Unapproved appointment cancellation cron
    this.scheduleUnapprovedAppointmentCancellations();

    console.log("✅ All timezone-aware appointment cron jobs initialized successfully");
  }

  /**
   * Check for appointments that need reminders (1 hour before) - TIMEZONE AWARE
   */
  async checkAppointmentReminders() {
    try {
      const now = new Date();
      const oneHourFromNow = addHours(now, 1);
      const twoHoursFromNow = addHours(now, 2);

      console.log(`🔔 Checking reminders between ${oneHourFromNow.toISOString()} and ${twoHoursFromNow.toISOString()}`);

      // Get all scheduled appointments
      const result = await this.appointmentRepository.findAll({
        status: "scheduled",
        limit: 1000
      });

      const appointments = result.data || [];

      let remindersSent = 0;

      for (const appointment of appointments) {
        try {
          // Skip if already processed
          if (this.processedReminders.has(appointment.id)) {
            continue;
          }

          // Use UTC time if available, fallback to original date/time with timezone
          let appointmentUTC;
          if (appointment.appointmentTimeUTC) {
            appointmentUTC = new Date(appointment.appointmentTimeUTC);
          } else {
            // Fallback: convert original time using stored timezone
            const timezone = appointment.patientTimezone || appointment.doctorTimezone || 'UTC';
            appointmentUTC = TimezoneService.convertToUTC(
              appointment.appointmentDate,
              appointment.appointmentTime,
              timezone
            );
          }

          // Check if appointment is exactly 1 hour away (±5 minutes tolerance)
          const timeDifference = appointmentUTC.getTime() - now.getTime();
          const oneHourInMs = 60 * 60 * 1000;
          const tolerance = 5 * 60 * 1000; // 5 minutes

          const isWithinReminderWindow = Math.abs(timeDifference - oneHourInMs) <= tolerance;

          if (isWithinReminderWindow) {
            await this.sendTimezoneAwareAppointmentReminder(appointment);
            this.processedReminders.add(appointment.id);
            remindersSent++;
          }
        } catch (error) {
          console.error(
            `❌ Error processing reminder for appointment ${appointment.id}:`,
            error
          );
        }
      }

      if (remindersSent > 0) {
        console.log(`✅ Sent ${remindersSent} timezone-aware appointment reminders`);
      }
    } catch (error) {
      console.error("❌ Error checking appointment reminders:", error);
    }
  }

  /**
   * Send timezone-aware appointment reminder
   */
  async sendTimezoneAwareAppointmentReminder(appointment) {
    try {
      console.log(`📧 Sending timezone-aware reminder for appointment ${appointment.id}...`);

      const doctorData = appointment.doctor;
      const patientData = appointment.patient;

      // Get UTC appointment time
      const appointmentUTC = appointment.appointmentTimeUTC ?
        new Date(appointment.appointmentTimeUTC) :
        TimezoneService.convertToUTC(
          appointment.appointmentDate,
          appointment.appointmentTime,
          appointment.patientTimezone || 'UTC'
        );

      // Format times for both parties in their respective timezones
      const patientDisplayTime = TimezoneService.formatTimeForDisplay(
        appointmentUTC,
        appointment.patientTimezone || 'UTC'
      );

      const doctorDisplayTime = TimezoneService.formatTimeForDisplay(
        appointmentUTC,
        appointment.doctorTimezone || 'UTC'
      );

      // Appointment details with timezone-aware formatting
      const appointmentDetails = {
        id: appointment.id,
        date: patientDisplayTime.userTime.date,
        time: patientDisplayTime.userTime.time,
        formatted: patientDisplayTime.userTime.formatted,
        duration: appointment.duration,
        type: appointment.type,
        meetingLink: appointment.meetingLink,
        meetingProvider: appointment.meetingProvider,
        // Include dual timezone info
        dualTimeDisplay: TimezoneService.formatDualTimezone(
          appointmentUTC,
          appointment.patientTimezone || 'UTC',
          appointment.doctorTimezone || 'UTC',
          "patient time",
          "doctor time"
        )
      };

      // Send reminder to doctor (in doctor's timezone)
      if (doctorData?.email) {
        const doctorAppointmentDetails = {
          ...appointmentDetails,
          date: doctorDisplayTime.userTime.date,
          time: doctorDisplayTime.userTime.time,
          formatted: doctorDisplayTime.userTime.formatted,
        };

        await this.appointmentEmailHelpers.sendDoctorAppointmentReminder({
          email: doctorData.email,
          doctorName: doctorData.fullName,
          patientName: patientData.fullName,
          appointmentDetails: doctorAppointmentDetails,
        });
      }

      // Send reminder to patient (in patient's timezone)
      if (patientData?.email) {
        await this.appointmentEmailHelpers.sendPatientAppointmentReminder({
          email: patientData.email,
          patientName: patientData.fullName,
          doctorName: doctorData.fullName,
          appointmentDetails,
        });
      }

      // Send timezone-aware notifications
      await this.notificationService.createNotification(
        appointment.patientId,
        "notification",
        `Reminder: Your appointment with Dr. ${appointment.doctor.fullName} is in 1 hour (${patientDisplayTime.userTime.time}).`,
        {
          action: "appointment_reminder",
          appointmentId: appointment.id,
          appointmentTimeUTC: appointmentUTC.toISOString(),
          displayTime: patientDisplayTime,
          meetingLink: appointment.meetingLink,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      await this.notificationService.createNotification(
        appointment.doctorId,
        "notification",
        `Reminder: Your appointment with ${appointment.patient.fullName} is in 1 hour (${doctorDisplayTime.userTime.time}).`,
        {
          action: "appointment_reminder",
          appointmentId: appointment.id,
          appointmentTimeUTC: appointmentUTC.toISOString(),
          displayTime: doctorDisplayTime,
          meetingLink: appointment.meetingLink,
          link: "doctors/dashboard/appointments",
        }
      );

      console.log(`✅ Timezone-aware reminder sent successfully for appointment ${appointment.id}`);
    } catch (error) {
      console.error(`❌ Error sending timezone-aware reminder for appointment ${appointment.id}:`, error);
    }
  }

  /**
   * Check for meetings that should be ended - TIMEZONE AWARE
   */
  async checkMeetingEnds() {
    try {
      const now = new Date();

      // Get all scheduled appointments that might need ending
      const result = await this.appointmentRepository.findAll({
        status: "scheduled",
        limit: 1000
      });

      const appointments = result.data || [];

      let meetingsEnded = 0;

      for (const appointment of appointments) {
        try {
          if (!appointment.meetingLink || this.processedMeetingEnds.has(appointment.id)) {
            continue;
          }

          // Get appointment end time in UTC
          let appointmentEndUTC;
          if (appointment.endTimeUTC) {
            appointmentEndUTC = new Date(appointment.endTimeUTC);
          } else if (appointment.appointmentTimeUTC) {
            appointmentEndUTC = new Date(
              new Date(appointment.appointmentTimeUTC).getTime() + (appointment.duration || 30) * 60000
            );
          } else {
            // Fallback: calculate from original date/time
            const timezone = appointment.patientTimezone || appointment.doctorTimezone || 'UTC';

            console.log(timezone, appointment.appointmentDate, appointment.appointmentTime);
            const appointmentStart = TimezoneService.convertToUTC(
              appointment.appointmentDate,
              appointment.appointmentTime,
              timezone
            );
            appointmentEndUTC = new Date(appointmentStart.getTime() + (appointment.duration || 30) * 60000);
          }

          // Check if appointment duration has elapsed
          if (isAfter(now, appointmentEndUTC)) {
            await this.endMeeting(appointment); // best-effort; don't block completion on it
            this.processedMeetingEnds.add(appointment.id);
            meetingsEnded++;

            if (appointment.status !== "completed") {
              await this.appointmentRepository.update(appointment.id, {
                status: "completed",
                completedAt: now,
                notes: "Appointment automatically completed after duration elapsed",
              });
            }
          }
        } catch (error) {
          console.error(
            `❌ Error processing meeting end for appointment ${appointment.id}:`,
            error
          );
        }
      }

      if (meetingsEnded > 0) {
        console.log(`✅ Ended ${meetingsEnded} meetings that exceeded their duration (timezone-aware)`);
      }
    } catch (error) {
      console.error("❌ Error checking meeting ends:", error);
    }
  }

  /**
   * Check for unapproved appointments that need cancellation - TIMEZONE AWARE
   */
  async checkUnapprovedAppointments() {
    try {
      const now = new Date();

      // Get appointments that are:
      // 1. Not approved by doctor (isDoctorApproved = false or null)
      // 2. Not cancelled
      // 3. Appointment time has passed
      const result = await this.appointmentRepository.findAll({
        status: "pending", // Still pending because doctor hasn't approved
        limit: 1000
      });

      const unapprovedAppointments = result.data || [];

      let cancellationsProcessed = 0;

      for (const appointment of unapprovedAppointments) {
        try {
          // Skip if already approved or cancelled
          if (appointment.isDoctorApproved === true || appointment.isCancelled === true) {
            continue;
          }

          // Skip if already processed
          if (this.processedMeetingEnds.has(`unapproved_${appointment.id}`)) {
            continue;
          }

          // Get appointment time in UTC
          let appointmentUTC;
          if (appointment.appointmentTimeUTC) {
            appointmentUTC = new Date(appointment.appointmentTimeUTC);
          } else {
            // Fallback: convert using stored timezone
            const timezone = appointment.patientTimezone || appointment.doctorTimezone || 'UTC';
            appointmentUTC = TimezoneService.convertToUTC(
              appointment.appointmentDate,
              appointment.appointmentTime,
              timezone
            );
          }

          // Check if appointment time has passed (with 10 minute grace period)
          const gracePeridMinutes = 10;
          const appointmentWithGrace = addMinutes(appointmentUTC, gracePeridMinutes);

          if (isAfter(now, appointmentWithGrace)) {
            await this.cancelUnapprovedAppointment(appointment);
            this.processedMeetingEnds.add(`unapproved_${appointment.id}`);
            cancellationsProcessed++;
          }
        } catch (error) {
          console.error(
            `❌ Error processing unapproved appointment ${appointment.id}:`,
            error
          );
        }
      }

      if (cancellationsProcessed > 0) {
        console.log(`✅ Cancelled ${cancellationsProcessed} unapproved appointments (timezone-aware)`);
      }
    } catch (error) {
      console.error("❌ Error checking unapproved appointments:", error);
    }
  }

  // Keep existing methods but add timezone awareness to notifications and email formatting

  /**
   * Schedule appointment reminders (runs every 5 minutes)
   */
  scheduleAppointmentReminders() {
    cron.schedule("*/5 * * * *", async () => {
      try {
        console.log("🔔 Running timezone-aware appointment reminder check...");
        await this.checkAppointmentReminders();
      } catch (error) {
        console.error("❌ Error in appointment reminder cron:", error);
      }
    });

    console.log("✅ Timezone-aware appointment reminder cron job scheduled (every 5 minutes)");
  }

  /**
   * Schedule meeting end checks (runs every 2 minutes)
   */
  scheduleMeetingEndChecks() {
    cron.schedule("*/2 * * * *", async () => {
      try {
        console.log("⏰ Running timezone-aware meeting end check...");
        await this.checkMeetingEnds();
      } catch (error) {
        console.error("❌ Error in meeting end cron:", error);
      }
    });

    console.log("✅ Timezone-aware meeting end check cron job scheduled (every 2 minutes)");
  }

  /**
   * Schedule meeting preparation checks (runs every 5 minutes)
   */
  scheduleMeetingPreparationChecks() {
    cron.schedule("*/5 * * * *", async () => {
      try {
        console.log("🚀 Running timezone-aware meeting preparation check...");
        await this.checkMeetingPreparation();
      } catch (error) {
        console.error("❌ Error in meeting preparation cron:", error);
      }
    });

    console.log("✅ Timezone-aware meeting preparation cron job scheduled (every 5 minutes)");
  }

  /**
   * Schedule unapproved appointment cancellations (runs every 30 minutes)
   */
  scheduleUnapprovedAppointmentCancellations() {
    cron.schedule("*/30 * * * *", async () => {
      try {
        console.log("🔍 Checking for timezone-aware unapproved appointments that need cancellation...");
        await this.checkUnapprovedAppointments();
      } catch (error) {
        console.error("❌ Error in unapproved appointment cancellation cron:", error);
      }
    });

    console.log("✅ Timezone-aware unapproved appointment cancellation cron job scheduled (every 30 minutes)");
  }

  /**
   * Schedule cleanup of processed IDs (runs daily at midnight)
   */
  scheduleCleanupProcessedIds() {
    cron.schedule("0 0 * * *", () => {
      console.log("🧹 Cleaning up processed appointment IDs...");
      this.processedReminders.clear();
      this.processedMeetingEnds.clear();
      console.log("✅ Processed IDs cleanup completed");
    });

    console.log("✅ Processed IDs cleanup cron job scheduled (daily at midnight)");
  }

  // ... other existing methods with timezone awareness added where needed ...

  async endMeeting(appointment) {
    try {
      console.log(
        `🔚 Ending meeting for appointment ${appointment.id} (${appointment.meetingProvider})...`
      );

      let result = { success: false };

      switch (appointment.meetingProvider) {
        case "zoom":
          if (appointment.zoomMeetingId) {
            result = await this.zoomMeetingService.endMeetingWithWarning(
              appointment.zoomMeetingId,
              "Meeting duration elapsed - automatically ended",
              0
            );
          }
          break;

        case "google":
          if (appointment.calendarEventId) {
            // For Google Meet, we don't typically "end" the meeting programmatically
            // Instead, we can update the calendar event status
            result = {
              success: true,
              message: "Google Meet meeting duration tracked",
            };
          }
          break;

        case "jitsi":
          if (appointment.meetingId) {
            result = await this.jitsiMeetingService.cancelMeetingForAppointment(
              appointment.meetingId,
              "Meeting duration elapsed - automatically ended"
            );
          }
          break;

        default:
          console.log(
            `⚠️ Unknown meeting provider: ${appointment.meetingProvider}`
          );
          result = { success: false, error: "Unknown meeting provider" };
      }

      if (result.success) {
        console.log(
          `✅ Meeting ended successfully for appointment ${appointment.id}`
        );

        // Send meeting ended notifications
        await this.appointmentEmailHelpers.sendDoctorMeetingEndedNotification({
          email: appointment.doctor.email,
          doctorName: appointment.doctor.fullName,
          patientName: appointment.patient.fullName,
          appointmentDetails: {
            appointmentId: appointment.id,
            endReason: "Duration elapsed",
          },
        });

        await this.appointmentEmailHelpers.sendPatientMeetingEndedNotification({
          email: appointment.patient.email,
          patientName: appointment.patient.fullName,
          doctorName: appointment.doctor.fullName,
          appointmentDetails: {
            appointmentId: appointment.id,
            endReason: "Duration elapsed",
          },
        });
      } else if (result.meetingStatus === "waiting") {
        console.log(
          `ℹ️ Meeting for appointment ${appointment.id} was never started (waiting) — skipping end`
        );
      } else {
        console.error(
          `❌ Failed to end meeting for appointment ${appointment.id}:`,
          result.error
        );
      }

      return result.success;
    } catch (error) {
      console.error(
        `❌ Error ending meeting for appointment ${appointment.id}:`,
        error
      );
      return false;
    }
  }


  /**
 * Check for meetings that need preparation (15 minutes before)
 */
  async checkMeetingPreparation() {
    try {
      const now = new Date();
      const fifteenMinutesFromNow = addMinutes(now, 15);
      const twentyMinutesFromNow = addMinutes(now, 20);

      const result = await this.appointmentRepository.findAll({
        status: "scheduled",
        dateRange: {
          startDate: format(fifteenMinutesFromNow, "yyyy-MM-dd"),
          endDate: format(twentyMinutesFromNow, "yyyy-MM-dd"),
        },
        limit: 1000
      });

      const appointments = result.data || [];

      let preparationsSent = 0;

      for (const appointment of appointments) {
        try {
          if (!appointment.meetingLink) continue;

          const appointmentDateTime = this.parseAppointmentDateTime(
            appointment.appointmentDate,
            appointment.appointmentTime
          );

          // Check if appointment is starting in 15 minutes (±2 minutes tolerance)
          const timeDifference = appointmentDateTime.getTime() - now.getTime();
          const fifteenMinutesInMs = 15 * 60 * 1000;
          const tolerance = 2 * 60 * 1000; // 2 minutes

          const isWithinPreparationWindow =
            Math.abs(timeDifference - fifteenMinutesInMs) <= tolerance;

          if (
            isWithinPreparationWindow &&
            !this.processedReminders.has(`prep_${appointment.id}`)
          ) {
            await this.sendMeetingPreparationNotification(appointment);
            this.processedReminders.add(`prep_${appointment.id}`);
            preparationsSent++;
          }
        } catch (error) {
          console.error(
            `❌ Error processing preparation for appointment ${appointment.id}:`,
            error
          );
        }
      }

      if (preparationsSent > 0) {
        console.log(
          `✅ Sent ${preparationsSent} meeting preparation notifications`
        );
      }
    } catch (error) {
      console.error("❌ Error checking meeting preparations:", error);
    }
  }


  async cancelUnapprovedAppointment(appointment) {
    try {
      console.log(
        `🚫 Auto-cancelling unapproved appointment ${appointment.id}...`
      );

      // Import AppointmentService to access cancellation and refund methods
      const AppointmentService = require("../services/appointmentService");
      const appointmentService = new AppointmentService();

      // Cancel the appointment
      const cancellationData = {
        reason:
          "Appointment automatically cancelled - Doctor did not approve within the scheduled time",
        cancelledBy: "system",
        refundAmount: appointment.consultationFee,
      };

      await appointmentService.cancelAppointment(
        appointment.id,
        cancellationData
      );

    } catch (error) {
      console.error(
        `❌ Error cancelling unapproved appointment ${appointment.id}:`,
        error
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendMeetingPreparationNotification(appointment) {
    try {
      const appointmentUTC = appointment.appointmentTimeUTC
        ? new Date(appointment.appointmentTimeUTC)
        : TimezoneService.convertToUTC(
            appointment.appointmentDate,
            appointment.appointmentTime,
            appointment.patientTimezone || appointment.doctorTimezone || "UTC"
          );

      const patientDisplayTime = TimezoneService.formatTimeForDisplay(
        appointmentUTC,
        appointment.patientTimezone || "UTC"
      );
      const doctorDisplayTime = TimezoneService.formatTimeForDisplay(
        appointmentUTC,
        appointment.doctorTimezone || "UTC"
      );

      const appointmentDetails = {
        id: appointment.id,
        time: patientDisplayTime.userTime.time,
        meetingLink: appointment.meetingLink,
        meetingProvider: appointment.meetingProvider,
        meetingPassword: appointment.meetingPassword,
      };

      if (appointment.doctor?.email) {
        await this.appointmentEmailHelpers.sendDoctorMeetingPreparation({
          email: appointment.doctor.email,
          doctorName: appointment.doctor.fullName,
          patientName: appointment.patient.fullName,
          appointmentDetails: { ...appointmentDetails, time: doctorDisplayTime.userTime.time },
        });
      }

      if (appointment.patient?.email) {
        await this.appointmentEmailHelpers.sendPatientMeetingPreparation({
          email: appointment.patient.email,
          patientName: appointment.patient.fullName,
          doctorName: appointment.doctor.fullName,
          appointmentDetails,
        });
      }

      await this.notificationService.createNotification(
        appointment.patientId,
        "alert",
        `Your appointment with Dr. ${appointment.doctor.fullName} starts in 15 minutes! Join now.`,
        {
          action: "meeting_starting_soon",
          appointmentId: appointment.id,
          meetingLink: appointment.meetingLink,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      await this.notificationService.createNotification(
        appointment.doctorId,
        "alert",
        `Your appointment with ${appointment.patient.fullName} starts in 15 minutes! Join now.`,
        {
          action: "meeting_starting_soon",
          appointmentId: appointment.id,
          meetingLink: appointment.meetingLink,
          link: "doctors/dashboard/appointments",
        }
      );
    } catch (error) {
      console.error(
        `❌ Error sending preparation notification for appointment ${appointment.id}:`,
        error
      );
    }
  }

  /**
   * Parse appointment date and time into Date object
   */
  parseAppointmentDateTime(appointmentDate, appointmentTime) {
    const dateTimeString = `${appointmentDate}T${appointmentTime}`;
    return parseISO(dateTimeString);
  }
}

module.exports = AppointmentCronJobs;