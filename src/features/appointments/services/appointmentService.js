// ===================================
// src/services/AppointmentService.js
// ===================================
const AppointmentRepository = require("../repositories/appointmentRepository");
const GoogleMeetService = require("./googleMeet/googleMeetService");
const DoctorGoogleAuthService = require("./googleMeet/doctorAuthService");
const doctorService = require("../../doctor/services/doctorService");
const patientService = require("../../patient/services/patientService");

const ZoomMeetingService = require("./zoomMeet/zoomMeetingService");
const JitsiMeetingService = require("./Jitsi/jitsiMeetingService");
const DoctorPricingService = require("../../doctor/services/doctorPricingService");
const DoctorAvailabilityService = require("../../doctor/services/doctorAvailabilityService");
const userRepository = require("../../auth/repositories/userRepository");
const { USER_ROLES } = require("../../../shared/utils/constants");
const AppointmentChatService = require("../../chat/services/appointmentChatService");
const appointmentEmailHelpers = require("../../../shared/services/email/emailHelpers");
const NotificationService = require("../../notifications/services/notificationService");
const {
  sendPatientAppointmentApprovedWhatsApp,
  sendDoctorAppointmentCancellationWhatsApp,
  sendPatientAppointmentCancellationWhatsApp,
  sendDoctorAppointmentRescheduledWhatsApp,
  sendPatientAppointmentRescheduledWhatsApp,
} = require("../../notifications/whatsapp/helper");

const TimezoneService = require("../../compliance/services/timezoneService");

class AppointmentService {
  constructor() {
    this.appointmentRepository = new AppointmentRepository();
    this.doctorPricingService = new DoctorPricingService();
    this.doctorAvailabilityService = new DoctorAvailabilityService();
    this.googleMeetService = new GoogleMeetService();
    this.doctorAuthService = new DoctorGoogleAuthService();
    this.zoomMeetingService = new ZoomMeetingService();
    this.jitsiMeetingService = new JitsiMeetingService();
    this.appointChatService = new AppointmentChatService();
    this.notificationService = new NotificationService();
  }



  /**
   * Create appointment with timezone awareness
   */
  async createAppointment(appointmentData, req) {
    try {
      // Get user data with timezone context
      const patientData = await userRepository.findById(
        appointmentData.patientId
      );
      const doctorData = await userRepository.findById(
        appointmentData.doctorId
      );

      // Determine timezones for both parties
      const patientTimezone = TimezoneService.getUserTimezone(patientData, req);
      const doctorTimezone = TimezoneService.getUserTimezone(doctorData, req);

      console.log(`🕐 Creating appointment with timezones:`, {
        patient: patientTimezone,
        doctor: doctorTimezone,
        originalDate: appointmentData.appointmentDate,
        originalTime: appointmentData.appointmentTime,
      });

      // Update user's detected timezone if needed
      if (
        req?.location?.timezone &&
        req.location.timezone !== patientData.lastDetectedTimezone
      ) {
        await TimezoneService.updateUserTimezone(
          appointmentData.patientId,
          null,
          req
        );
      }

      // Convert appointment time to UTC
      const appointmentTimeUTC = TimezoneService.convertToUTC(
        appointmentData.appointmentDate,
        appointmentData.appointmentTime,
        patientTimezone // Use patient's timezone as the input timezone
      );

      // Calculate local times for both parties
      const doctorLocalTime = TimezoneService.convertFromUTC(
        appointmentTimeUTC,
        doctorTimezone
      );
      const patientLocalTime = TimezoneService.convertFromUTC(
        appointmentTimeUTC,
        patientTimezone
      );

      // Calculate end time in UTC
      const endTimeUTC = new Date(
        appointmentTimeUTC.getTime() + (appointmentData.duration || 30) * 60000
      );

      // Validate appointment is not in the past and is at least 1 hour in advance
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      if (appointmentTimeUTC < now) {
        throw new Error("Cannot create appointment in the past");
      }

      if (appointmentTimeUTC < oneHourFromNow) {
        throw new Error("Appointment must be scheduled at least 1 hour in advance");
      }


      // Existing validation logic...
      const isPatient = await userRepository.hasRole(
        appointmentData.patientId,
        USER_ROLES.PATIENT
      );
      const isDoctor = await userRepository.hasRole(
        appointmentData.doctorId,
        USER_ROLES.DOCTOR
      );
      const isDoctorVerified = await doctorService.isDoctorVerified(
        appointmentData.doctorId
      );

      if (!isPatient) throw new Error("patient does not exist");
      if (!isDoctor) throw new Error("doctor does not exist");
      if (!isDoctorVerified) throw new Error("doctor is not verified yet");

      // Pricing validation...
      const pricing = await this.validateAndGetPricing(
        appointmentData.doctorId,
        appointmentData.type || "consultation",
        appointmentData.duration
      );

      appointmentData.consultationFee = pricing.price;
      appointmentData.consultationFeeCurrency = pricing.currency;

      appointmentData.duration = appointmentData.duration || pricing.duration;

      // Timezone-aware availability validation
      await this.validateDoctorAvailabilityWithTimezone(
        appointmentData.doctorId,
        appointmentData.appointmentDate,
        appointmentData.appointmentTime,
        appointmentData.duration,
        patientTimezone,
        doctorTimezone
      );

      // Enhanced appointment data with timezone info
      const enhancedAppointmentData = {
        ...appointmentData,

        // UTC timestamp for storage
        appointmentTimeUTC,
        endTimeUTC,

        // Timezone context
        doctorTimezone,
        patientTimezone,

        // Local times for reference
        doctorLocalTime: doctorLocalTime.time,
        patientLocalTime: patientLocalTime.time,

        // Original fields (for backward compatibility)
        endTime: this.calculateEndTime(
          appointmentData.appointmentTime,
          appointmentData.duration
        ),
      };

      const appointment = await this.appointmentRepository.create(
        enhancedAppointmentData
      );

      const fetchAppointment = await this.appointmentRepository.findById(
        appointment.id
      );

      // Existing notification logic...
      await this.sendTimezoneAwareNotifications(fetchAppointment, "created");

      return {
        success: true,
        appointment,
        timezoneInfo: {
          patientTimezone,
          doctorTimezone,
          appointmentUTC: appointmentTimeUTC.toISOString(),
          displayTimes: {
            patient: TimezoneService.formatTimeForDisplay(
              appointmentTimeUTC,
              patientTimezone
            ),
            doctor: TimezoneService.formatTimeForDisplay(
              appointmentTimeUTC,
              doctorTimezone
            ),
          },
        },
        pricing: {
          consultationType: appointmentData.type,
          fee: pricing.price,
          currency: pricing.currency,
          duration: pricing.duration,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateDoctorApproval(appointmentId, approvalData) {
    const appointment = await this.appointmentRepository.findById(
      appointmentId
    );
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Validate doctor owns this appointment
    if (appointment.doctorId !== approvalData.doctorId) {
      throw new Error("Doctor can only approve their own appointments");
    }

    // Check if payment is completed before allowing approval
    if (appointment.paymentStatus !== "completed") {
      throw new Error(
        "Payment must be completed before doctor can approve appointment"
      );
    }

    // If doctor is rejecting the appointment, cancel it and initiate refund
    if (approvalData.isDoctorApproved === false) {
      const cancellationData = {
        reason:
          approvalData.rejectionReason || "Doctor declined the appointment",
        cancelledBy: "doctor",
        refundAmount: appointment.consultationFee,
      };

      // Cancel the appointment and handle refund
      const cancelledAppointment = await this.cancelAppointment(
        appointmentId,
        cancellationData
      );

      //// Notify patient about rejection and refund
      // await this.notificationService.createNotification(
      //   appointment.patientId,
      //   "alert",
      //   `Your appointment with Dr. ${appointment.doctor?.fullName} has been declined. A full refund of $${appointment.consultationFee} is being processed.`,
      //   {
      //     action: "appointment_rejected",
      //     appointmentId: appointment.id,
      //     refundAmount: appointment.consultationFee,
      //     link: "/patients/dashboard/appointments/overview",
      //   }
      // );

      return {
        ...cancelledAppointment,
        message:
          "Appointment cancelled due to doctor rejection. Refund will be processed.",
      };
    }

    const updateData = {
      isDoctorApproved: approvalData.isDoctorApproved,
      status: "scheduled", // Update status to scheduled when approved
      updatedAt: new Date(),
    };

    const updatedAppointment = await this.appointmentRepository.update(
      appointmentId,
      updateData
    );

    // Notify patient about approval
    await this.notificationService.createNotification(
      appointment.patientId,
      "notification",
      `Great news! Dr. ${appointment.doctor?.fullName} has approved your appointment for ${appointment.appointmentDate} at ${appointment.appointmentTime}.`,
      {
        action: "appointment_approved",
        appointmentId: appointment.id,
        link: "/patients/dashboard/appointments/overview",
      }
    );

    // Send approval confirmation emails
    try {
      const doctorData = appointment.doctor;
      const patientData = appointment.patient;

      if (doctorData?.email && patientData?.email) {
        await appointmentEmailHelpers.sendPatientAppointmentApprovedEmail({
          email: patientData.email,
          patientName: patientData.fullName,
          doctorName: doctorData.fullName,
          appointmentDetails: {
            id: appointment.id,
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            type: appointment.type,
          },
        });
      }

      if (patientData?.phoneNumber) {
        await sendPatientAppointmentApprovedWhatsApp({
          phoneNumber: patientData.phoneNumber,
          patientName: patientData.fullName,
          doctorName: doctorData?.fullName || "your doctor",
          appointmentDetails: {
            id: appointment.id,
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
          },
        });
      }
    } catch (emailError) {
      console.error(
        `Failed to send approval email/WhatsApp for appointment ${appointmentId}:`,
        emailError
      );
    }

    return updatedAppointment;
  }

  // async getAppointmentById(id) {
  //   const appointment = await this.appointmentRepository.findById(id);
  //   if (!appointment) {
  //     throw new Error("Appointment not found");
  //   }
  //   return appointment;
  // }

  /**
   * Get appointment with timezone-aware display
   */
  async getAppointmentById(id, req) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // If appointment has UTC time, convert for display
    if (appointment.appointmentTimeUTC) {
      const userTimezone = TimezoneService.getUserTimezone(null, req);

      appointment.displayTime = TimezoneService.formatTimeForDisplay(
        appointment.appointmentTimeUTC,
        userTimezone,
        appointment.doctorTimezone !== appointment.patientTimezone
          ? userTimezone === appointment.patientTimezone
            ? appointment.doctorTimezone
            : appointment.patientTimezone
          : null
      );

      appointment.timeUntilAppointment =
        TimezoneService.getTimeUntilAppointment(appointment.appointmentTimeUTC);
    }

    return appointment;
  }

  async getAppointments(filters) {
    return await this.appointmentRepository.findAll(filters);
  }

  async getAnalytics(filters) {
    return await this.appointmentRepository.getAnalytics(filters);
  }

  async updateAppointment(id, updateData) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    updateData.lastModifiedBy = updateData.modifiedBy;
    updateData.updatedAt = new Date();

    // Check if date/time changed
    const dateTimeChanged =
      (updateData.appointmentDate &&
        updateData.appointmentDate !== appointment.appointmentDate) ||
      (updateData.appointmentTime &&
        updateData.appointmentTime !== appointment.appointmentTime) ||
      (updateData.duration && updateData.duration !== appointment.duration);

    // Auto-update meeting if date/time changed and meeting exists
    if (dateTimeChanged && appointment.meetingLink) {
      await this.autoUpdateMeetingLink({
        ...appointment,
        ...updateData,
        id: appointment.id,
      });
    }

    return await this.appointmentRepository.update(id, updateData);
  }

  async cancelAppointment(id, cancellationData) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Map currency code to symbol
    const currencySymbols = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: '₵', KES: 'KSh', ZAR: 'R' };
    const currencyCode = appointment.consultationFeeCurrency || 'NGN';
    const currencySymbol = currencySymbols[currencyCode] || currencyCode + ' ';

    // Cancel meeting based on provider
    if (appointment.meetingProvider == "zoom") {
      await this.cancelZoomMeetingAppointment(id, cancellationData.reason);
    } else if (appointment.meetingProvider == "google") {
      await this.cancelGoogleMeetAppointment(id, cancellationData.reason);
    } else if (appointment.meetingProvider == "jitsi") {
      await this.cancelJitsiMeetingAppointment(id, cancellationData.reason);
    }

    const updateData = {
      isCancelled: true,
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: cancellationData.reason,
      cancelledBy: cancellationData.cancelledBy,
    };

    const updatedAppointment = await this.appointmentRepository.update(
      id,
      updateData
    );

      // Send cancellation emails to both doctor and patient
      try {
        const doctorData = appointment.doctor;
        const patientData = appointment.patient;

      const cancellationDetails = {
        id: appointment.id,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime,
        cancellationReason: cancellationData.reason,
        cancelledBy: cancellationData.cancelledBy,
        refundAmount: cancellationData.refundAmount || null,
        currencySymbol,
      };

      // Send cancellation email to doctor
      if (doctorData?.email) {
        await appointmentEmailHelpers.sendDoctorAppointmentCancellationEmail({
          email: doctorData.email,
          doctorName: doctorData.fullName,
          patientName: patientData.fullName,
          appointmentDetails: cancellationDetails,
        });
      }

      // Send cancellation email to patient
      if (patientData?.email) {
        await appointmentEmailHelpers.sendPatientAppointmentCancellationEmail({
          email: patientData.email,
          patientName: patientData.fullName,
          doctorName: doctorData.fullName,
          appointmentDetails: cancellationDetails,
        });
      }

      if (doctorData?.phoneNumber) {
        await sendDoctorAppointmentCancellationWhatsApp({
          phoneNumber: doctorData.phoneNumber,
          doctorName: doctorData.fullName,
          patientName: patientData?.fullName || "your patient",
          appointmentDetails: cancellationDetails,
        });
      }

      if (patientData?.phoneNumber) {
        await sendPatientAppointmentCancellationWhatsApp({
          phoneNumber: patientData.phoneNumber,
          patientName: patientData.fullName,
          doctorName: doctorData?.fullName || "your doctor",
          appointmentDetails: cancellationDetails,
        });
      }
    } catch (emailError) {
      console.error(
        `❌ Error sending cancellation emails/WhatsApp for appointment ${id}:`,
        emailError
      );
      // Don't fail the cancellation if email sending fails
    }

    // Determine who to notify and refund based on who cancelled
    if (cancellationData.cancelledBy === "patient") {
      // Notify doctor about patient cancellation
      await this.notificationService.createNotification(
        appointment.doctorId,
        "notification",
        `${appointment.patient?.fullName || "Patient"
        } has cancelled their appointment scheduled for ${appointment.appointmentDate
        } at ${appointment.appointmentTime}.`,
        {
          action: "appointment_cancelled_by_patient",
          appointmentId: appointment.id,
          reason: cancellationData.reason,
          link: "/doctors/dashboard/appointments",
        }
      );
    } else if (cancellationData.cancelledBy === "doctor") {
      // Notify patient about doctor cancellation
      await this.notificationService.createNotification(
        appointment.patientId,
        "alert",
        `Dr. ${appointment.doctor?.fullName
        } has cancelled your appointment for ${appointment.appointmentDate
        } at ${appointment.appointmentTime}. ${cancellationData.refundAmount
          ? `A refund of ${currencySymbol}${cancellationData.refundAmount} is being processed.`
          : ""
        }`,
        {
          action: "appointment_cancelled_by_doctor",
          appointmentId: appointment.id,
          reason: cancellationData.reason,
          refundAmount: cancellationData.refundAmount,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      // - Payment service for refund processing
      if (appointment.paymentId) {
        await this.refundAppointmentPaymentToPatient(
          appointment.paymentId,
          cancellationData
        );
      }
    } else if (cancellationData.cancelledBy === "system") {
      // For auto-cancellations, notify both parties
      await this.notificationService.createNotification(
        appointment.patientId,
        "alert",
        `Your appointment with Dr. ${appointment.doctor?.fullName} has been automatically cancelled. A full refund of ${currencySymbol}${appointment.consultationFee} is being processed.`,
        {
          action: "appointment_auto_cancelled",
          appointmentId: appointment.id,
          reason: cancellationData.reason,
          refundAmount: cancellationData.refundAmount,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      await this.notificationService.createNotification(
        appointment.doctorId,
        "alert",
        `Appointment with ${appointment.patient?.fullName} was automatically cancelled due to lack of approval within the scheduled time.`,
        {
          action: "appointment_auto_cancelled",
          appointmentId: appointment.id,
          reason: cancellationData.reason,
          link: "/doctors/dashboard/appointments",
        }
      );

      // - Payment service for refund processing
      if (appointment.paymentId) {
        await this.refundAppointmentPaymentToPatient(
          appointment.paymentId,
          cancellationData
        );
      }
    }

    return updatedAppointment;
  }

  async refundAppointmentPaymentToPatient(transactionId, cancellationData) {
    const paymentServicePath = "../../payments/services/paymentService";
    const paymentService = require(paymentServicePath);
    paymentService.cancelAppointmentPayment(transactionId, cancellationData);
  }

  async rescheduleAppointment(id, rescheduleData, req) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const rescheduledById = rescheduleData.rescheduledBy || req?.user?.sub;
    const isDoctor = rescheduledById === appointment.doctorId;
    const isPatient = rescheduledById === appointment.patientId;

    if (isDoctor && appointment.type !== "follow-up") {
      throw new Error("Doctors can only reschedule follow-up appointments.");
    }

    // Store old appointment details for email
    const oldAppointmentDetails = {
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
    };

    // const updateData = {
    //   appointmentDate: rescheduleData.newDate,
    //   appointmentTime: rescheduleData.newTime,
    //   duration: rescheduleData.duration || appointment.duration,
    //   status: "rescheduled",
    //   endTime: this.calculateEndTime(
    //     rescheduleData.newTime,
    //     rescheduleData.duration || appointment.duration
    //   ),
    //   rescheduledAt: new Date(),
    //   rescheduledBy: rescheduleData.rescheduledBy,
    //   rescheduleReason: rescheduleData.reason,
    // };

    // Get current timezone (could be different if user is traveling)
    const currentUserTimezone = TimezoneService.getUserTimezone(null, req);

    // Convert new time to UTC
    const newAppointmentUTC = TimezoneService.convertToUTC(
      rescheduleData.newDate,
      rescheduleData.newTime,
      currentUserTimezone
    );

    // Calculate new local times
    const doctorLocalTime = TimezoneService.convertFromUTC(
      newAppointmentUTC,
      appointment.doctorTimezone
    );
    const patientLocalTime = TimezoneService.convertFromUTC(
      newAppointmentUTC,
      appointment.patientTimezone
    );

    // Validate new slot availability server-side
    await this.validateDoctorAvailabilityWithTimezone(
      appointment.doctorId,
      rescheduleData.newDate,
      rescheduleData.newTime,
      appointment.duration,
      appointment.patientTimezone,
      appointment.doctorTimezone
    );

    const updateData = {
      appointmentDate: rescheduleData.newDate,
      appointmentTime: rescheduleData.newTime,
      appointmentTimeUTC: newAppointmentUTC,
      doctorLocalTime: doctorLocalTime.time,
      patientLocalTime: patientLocalTime.time,
      duration: appointment.duration,
      status: isPatient ? "pending" : "rescheduled",
      isDoctorApproved: isPatient ? false : appointment.isDoctorApproved,
      endTime: this.calculateEndTime(
        rescheduleData.newTime,
        appointment.duration
      ),
      endTimeUTC: new Date(
        newAppointmentUTC.getTime() + appointment.duration * 60000
      ),
      rescheduledAt: new Date(),
      rescheduledBy: rescheduledById,
      rescheduleReason: rescheduleData.reason,
    };

    const updatedAppointment = await this.appointmentRepository.update(
      id,
      updateData
    );

    // Auto-update meeting if meeting exists
    if (appointment.meetingLink) {
      await this.autoUpdateMeetingLink({
        ...appointment,
        ...updateData,
        id: appointment.id,
      });
    }

    // Send reschedule emails to both doctor and patient
    try {
      const doctorData = appointment.doctor;
      const patientData = appointment.patient;

      const rescheduleDetails = {
        id: appointment.id,
        oldDate: oldAppointmentDetails.date,
        oldTime: oldAppointmentDetails.time,
        newDate: rescheduleData.newDate,
        newTime: rescheduleData.newTime,
        meetingLink: appointment.meetingLink,
        meetingProvider: appointment.meetingProvider,
        rescheduleReason: rescheduleData.reason,
        rescheduledBy: rescheduleData.rescheduledBy || null,
      };

      // Send reschedule email to doctor
      if (doctorData?.email) {
        await appointmentEmailHelpers.sendDoctorAppointmentRescheduledEmail({
          email: doctorData.email,
          doctorName: doctorData.fullName,
          patientName: patientData.fullName,
          appointmentDetails: rescheduleDetails,
        });
      }

      // Send reschedule email to patient
      if (patientData?.email) {
        await appointmentEmailHelpers.sendPatientAppointmentRescheduledEmail({
          email: patientData.email,
          patientName: patientData.fullName,
          doctorName: doctorData.fullName,
          appointmentDetails: rescheduleDetails,
        });
      }

      if (doctorData?.phoneNumber) {
        await sendDoctorAppointmentRescheduledWhatsApp({
          phoneNumber: doctorData.phoneNumber,
          doctorName: doctorData.fullName,
          patientName: patientData?.fullName || "your patient",
          appointmentDetails: rescheduleDetails,
        });
      }

      if (patientData?.phoneNumber) {
        await sendPatientAppointmentRescheduledWhatsApp({
          phoneNumber: patientData.phoneNumber,
          patientName: patientData.fullName,
          doctorName: doctorData?.fullName || "your doctor",
          appointmentDetails: rescheduleDetails,
        });
      }

      console.log(`✅ Reschedule emails sent for appointment ${id}`);
    } catch (emailError) {
      console.error(
        `❌ Error sending reschedule emails/WhatsApp for appointment ${id}:`,
        emailError
      );
      // Don't fail the reschedule if email sending fails
    }

    if (isPatient || !isDoctor) {
      await this.notificationService.createNotification(
        appointment.doctorId,
        "notification",
        `Appointment with ${appointment.patient?.fullName} has been rescheduled from ${oldAppointmentDetails.date} at ${oldAppointmentDetails.time} to ${rescheduleData.newDate} at ${rescheduleData.newTime} and requires approval.`,
        {
          action: "appointment_rescheduled",
          appointmentId: appointment.id,
          oldDate: oldAppointmentDetails.date,
          oldTime: oldAppointmentDetails.time,
          newDate: rescheduleData.newDate,
          newTime: rescheduleData.newTime,
          link: "/doctors/dashboard/appointments",
        }
      );
    }

    if (isDoctor) {
      await this.notificationService.createNotification(
        appointment.patientId,
        "alert",
        `Your appointment with Dr. ${appointment.doctor?.fullName} has been rescheduled from ${oldAppointmentDetails.date} at ${oldAppointmentDetails.time} to ${rescheduleData.newDate} at ${rescheduleData.newTime}.`,
        {
          action: "appointment_rescheduled",
          appointmentId: appointment.id,
          oldDate: oldAppointmentDetails.date,
          oldTime: oldAppointmentDetails.time,
          newDate: rescheduleData.newDate,
          newTime: rescheduleData.newTime,
          link: "/patients/dashboard/appointments/overview",
        }
      );
    }
    // Note: External service integrations will be called here:
    // - Meeting service for meeting update (already handled above)

    // Emit websocket event for real-time dashboard updates
    try {
      const { getIO } = require("../../../config/websocket");
      const io = getIO();
      if (io) {
        io.to(`user_${appointment.patientId}`).emit("APPOINTMENT_RESCHEDULED", {
          appointmentId: appointment.id,
          status: updatedAppointment.status,
          newDate: rescheduleData.newDate,
          newTime: rescheduleData.newTime
        });
        io.to(`user_${appointment.doctorId}`).emit("APPOINTMENT_RESCHEDULED", {
          appointmentId: appointment.id,
          status: updatedAppointment.status,
          newDate: rescheduleData.newDate,
          newTime: rescheduleData.newTime
        });
      }
    } catch (socketError) {
      console.error("❌ Failed to emit APPOINTMENT_RESCHEDULED socket event:", socketError);
    }

    return updatedAppointment;
  }

  async completeAppointment(id, completionData) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const updateData = {
      status: "completed",
      completedAt: new Date(),
      notes: completionData.notes,
      prescriptions: completionData.prescriptions,
      followUpRequired: completionData.followUpRequired,
      followUpDate: completionData.followUpDate,
      labOrdersRequired: completionData.labOrdersRequired,
    };

    // Notify patient about completion
    const notification = await this.notificationService.createNotification(
      appointment.patientId,
      "notification",
      `Your consultation with Dr. ${
        appointment.doctor?.fullName
      } has been completed. ${
        completionData.followUpRequired
          ? "A follow-up appointment may be needed."
          : ""
      }`,
      {
        action: "appointment_completed",
        appointmentId: appointment.id,
        followUpRequired: completionData.followUpRequired,
        followUpDate: completionData.followUpDate,
        link: "/patients/dashboard/appointments/overview",
      }
    );

    // Emit websocket event for real-time rating popup
    try {
      const { getIO } = require("../../../config/websocket");
      const io = getIO();
      if (io) {
        io.to(`user_${appointment.patientId}`).emit("APPOINTMENT_COMPLETED", {
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          doctorName: appointment.doctor?.fullName || "Doctor",
          notificationId: notification.id
        });
        console.log(`✉️ Emitted APPOINTMENT_COMPLETED to patient ${appointment.patientId}`);
      }
    } catch (socketError) {
      console.error("❌ Failed to emit APPOINTMENT_COMPLETED socket event:", socketError);
    }

    return await this.appointmentRepository.update(id, updateData);
  }

  async processPayment(id, paymentData) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Note: External payment service integration will be called here
    // For now, we'll update the payment status
    const updateData = {
      paymentStatus: "completed",
      paymentId: paymentData.paymentToken,
      paymentMethod: paymentData.paymentMethod,
      // status: "scheduled", // Move from pending to scheduled after payment
    };

    return await this.appointmentRepository.update(id, updateData);
  }

  async generateMeetingLink(id, meetingData) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.paymentStatus !== "completed") {
      throw new Error("Payment must be completed before creating meeting link");
    }

    // Note: External meeting service integration will be called here
    // This is a placeholder for the actual meeting service integration
    const updateData = {
      meetingProvider: meetingData.provider,
      meetingLink: `https://${meetingData.provider}.com/meeting/${appointment.id}`,
      meetingId: `meeting_${appointment.id}`,
      meetingPassword: meetingData.requirePassword ? "SecurePass123" : null,
    };

    return await this.appointmentRepository.update(id, updateData);
  }

  calculateEndTime(startTime, durationInMinutes) {
    const [hours, minutes] = startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationInMinutes;

    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    return `${endHours.toString().padStart(2, "0")}:${endMins
      .toString()
      .padStart(2, "0")}`;
  }

  async getPatientAppointments(patientId) {
    return await this.appointmentRepository.findByPatientId(patientId);
  }

  async getDoctorAppointments(doctorId) {
    return await this.appointmentRepository.findByDoctorId(doctorId);
  }

  async getPatientAppointmentsUpcoming(patientId) {
    return await this.appointmentRepository.findUpcomingAppointmentsForPatient(
      patientId
    );
  }

  async getDoctorAppointmentsUpcoming(doctorId) {
    return await this.appointmentRepository.findUpcomingAppointmentsForDoctor(
      doctorId
    );
  }

  // async getDoctorAvailability(doctorId, date) {
  //   const appointments =
  //     await this.appointmentRepository.findDoctorAvailability(doctorId, date);

  //   // Generate available time slots (assuming 9 AM - 5 PM, 30-minute slots)
  //   const workingHours = this.generateWorkingHours();
  //   const bookedTimes = appointments.map((apt) => apt.appointmentTime);

  //   const availableSlots = workingHours.filter(
  //     (time) => !bookedTimes.includes(time)
  //   );

  //   return {
  //     date,
  //     doctorId,
  //     availableSlots,
  //     bookedSlots: bookedTimes,
  //   };
  // }

  async getMeetingDetails(id) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    return {
      meetingProvider: appointment.meetingProvider,
      meetingDetails: {
        joinUrl: appointment.meetingLink,
        meetingId: appointment.meetingId,
        password: appointment.meetingPassword,
        googleMeetCode: appointment.googleMeetCode,
        zoomMeetingId: appointment.zoomMeetingId,
        status: appointment.status,
        startTime: `${appointment.appointmentDate}T${appointment.appointmentTime}:00Z`,
        duration: appointment.duration,
      },
    };
  }

  async sendAppointmentReminder(id) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Note: External notification service integration will be called here
    const updateData = {
      reminderSent: true,
      reminderSentAt: new Date(),
    };

    await this.appointmentRepository.update(id, updateData);

    return {
      success: true,
      message: "Appointment reminder sent successfully",
    };
  }

  generateWorkingHours() {
    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  }

  //GOOGLE MEET
  async generateGoogleMeetLink(appointmentId, doctorId) {
    try {
      // Get appointment details
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment) {
        throw new Error("Appointment not found");
      }

      // Validate appointment status and approval
      if (appointment.paymentStatus !== "completed") {
        throw new Error(
          "Payment must be completed before creating meeting link"
        );
      }

      if (!appointment.isDoctorApproved) {
        throw new Error(
          "Doctor must approve the appointment before meeting link can be generated"
        );
      }

      // Get doctor's Google tokens
      const doctorTokens = await this.doctorAuthService.getDoctorGoogleTokens(
        doctorId
      );
      if (!doctorTokens) {
        return {
          success: false,
          error: "Doctor must authenticate with Google first",
          requiresAuth: true,
          authUrl: this.doctorAuthService.getGoogleAuthUrl(doctorId),
        };
      }

      // Get doctor and patient data
      const doctorData = await doctorService.getDoctorProfileById(doctorId);
      const patientData = await patientService.getPatientProfileById(
        appointment.patientId
      );

      // Create Google Meet
      const meetingResult =
        await this.googleMeetService.createMeetingForAppointment(
          appointment,
          doctorData,
          patientData,
          doctorTokens
        );

      if (!meetingResult.success) {
        return meetingResult;
      }

      // Update appointment with meeting data
      const updateData = {
        meetingProvider: "google",
        meetingLink: meetingResult.meetingLink,
        googleMeetCode: meetingResult.googleMeetCode,
        meetingId: meetingResult.meetingId,
        calendarEventId: meetingResult.calendarEventId,
      };

      await this.appointmentRepository.update(appointmentId, updateData);

      // Generate join instructions for patient
      const joinInstructions = this.googleMeetService.generateJoinInstructions(
        meetingResult,
        appointment
      );

      return {
        success: true,
        meetingData: meetingResult,
        joinInstructions,
      };
    } catch (error) {
      throw new Error(`❌ Error generating Google Meet link: ${error.message}`);
    }
  }

  async updateGoogleMeetAppointment(appointmentId, updateData) {
    try {
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment || !appointment.calendarEventId) {
        return {
          success: false,
          error: "Appointment or calendar event not found",
        };
      }

      const doctorTokens = await this.doctorAuthService.getDoctorGoogleTokens(
        appointment.doctorId
      );
      if (!doctorTokens) {
        return {
          success: false,
          error: "Doctor Google authentication required",
        };
      }

      const result = await this.googleMeetService.updateMeetingForAppointment(
        appointment.calendarEventId,
        { ...appointment, ...updateData },
        doctorTokens
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cancelGoogleMeetAppointment(appointmentId, cancellationReason) {
    try {
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment || !appointment.calendarEventId) {
        return {
          success: false,
          error: "Appointment or calendar event not found",
        };
      }

      const doctorTokens = await this.doctorAuthService.getDoctorGoogleTokens(
        appointment.doctorId
      );
      if (!doctorTokens) {
        return {
          success: false,
          error: "Doctor Google authentication required",
        };
      }

      const result = await this.googleMeetService.cancelMeetingForAppointment(
        appointment.calendarEventId,
        cancellationReason,
        doctorTokens
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async generateZoomMeetingLink(appointmentId, doctorId) {
    try {
      // Get appointment details
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (
        !appointment ||
        appointment.status == "cancelled" ||
        appointment.status == "completed"
      ) {
        return {
          success: false,
          error: "No active appointment found",
        };
      }

      // Validate appointment status and approval
      if (appointment.paymentStatus !== "completed") {
        throw new Error(
          "Payment must be completed before creating meeting link"
        );
      }

      if (!appointment.isDoctorApproved) {
        throw new Error(
          "Doctor must approve the appointment before meeting link can be generated"
        );
      }
      // Validate Zoom credentials first
      const credentialsValid =
        await this.zoomMeetingService.validateCredentials();
      if (!credentialsValid.valid) {
        return {
          success: false,
          error: `Zoom configuration error: ${credentialsValid.error}`,
        };
      }

      console.log(appointment.patientId);
      // Get doctor and patient data
      const doctorData = await doctorService.getDoctorProfileByUserId(doctorId);

      // const patientData = await userService.getPatientProfileByUserId(
      //   appointment.patientId
      // );
      const patientData = await userRepository.findById(appointment.patientId);

      console.log(patientData);

      // Create Zoom meeting
      const meetingResult =
        await this.zoomMeetingService.createMeetingForAppointment(
          appointment,
          doctorData,
          patientData
        );

      if (!meetingResult.success) {
        return meetingResult;
      }

      // Update appointment with meeting data
      const updateData = {
        meetingProvider: "zoom",
        meetingLink: meetingResult.meetingLink,
        zoomMeetingId: meetingResult.zoomMeetingId,
        meetingId: meetingResult.meetingId,
        meetingPassword: meetingResult.meetingPassword,
        hostKey: meetingResult.hostKey,
      };

      await this.appointmentRepository.update(appointmentId, updateData);

      // Send email notifications to both patient and doctor
      try {
        const appointmentDetails = {
          id: appointment.id,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime,
          duration: appointment.duration,
        };

        const meetingDetails = {
          joinUrl: meetingResult.meetingLink,
          meetingId: meetingResult.zoomMeetingId,
          password: meetingResult.meetingPassword,
          hostKey: meetingResult.hostKey,
          dialInNumbers: meetingResult.dialInNumbers || [],
        };

        console.log(meetingDetails);

        // Send to patient
        if (patientData?.email) {
          await appointmentEmailHelpers.sendPatientZoomMeetingLinkEmail({
            email: patientData.email,
            patientName: patientData.fullName,
            doctorName: doctorData.user.fullName,
            appointmentDetails,
            meetingDetails,
          });
        }

        // Send to doctor
        if (doctorData?.user.email) {
          await appointmentEmailHelpers.sendDoctorZoomMeetingLinkEmail({
            email: doctorData.user.email,
            doctorName: doctorData.user.fullName,
            patientName: patientData.fullName,
            appointmentDetails,
            meetingDetails,
          });
        }
      } catch (emailError) {
        console.error(
          `Error sending Zoom meeting emails for appointment ${appointmentId}:`,
          emailError
        );
      }

      // Add notification
      await this.notificationService.createNotification(
        appointment.patientId,
        "notification",
        `Your Zoom meeting link is ready! Your appointment with Dr. ${doctorData.user.fullName} is on ${appointment.appointmentDate} at ${appointment.appointmentTime}.`,
        {
          action: "meeting_link_generated",
          appointmentId: appointment.id,
          meetingProvider: "zoom",
          meetingLink: meetingResult.meetingLink,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      // Generate join instructions for patient
      const joinInstructions = this.zoomMeetingService.generateJoinInstructions(
        meetingResult,
        appointment
      );

      return {
        success: true,
        meetingData: meetingResult,
        joinInstructions,
      };
    } catch (error) {
      console.error("❌ Error generating Zoom meeting link:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateZoomMeetingAppointment(appointmentId, updateData) {
    try {
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment || !appointment.zoomMeetingId) {
        return {
          success: false,
          error: "Appointment or Zoom meeting not found",
        };
      }

      const doctorData = await doctorService.getDoctorProfileByUserId(
        appointment.doctorId
      );

      const result = await this.zoomMeetingService.updateMeetingForAppointment(
        appointment.zoomMeetingId,
        { ...appointment, ...updateData },
        doctorData
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cancelZoomMeetingAppointment(appointmentId, cancellationReason) {
    try {
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment || !appointment.zoomMeetingId) {
        throw new Error("Appointment or Zoom meeting not found");
      }

      const result = await this.zoomMeetingService.cancelMeetingForAppointment(
        appointment.zoomMeetingId,
        cancellationReason
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async generateJitsiMeetingLink(appointmentId, doctorId) {
    try {
      // Get appointment details
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment) {
        return {
          success: false,
          error: "Appointment not found",
        };
      }

      // Validate appointment status and approval
      if (appointment.paymentStatus !== "completed") {
        throw new Error(
          "Payment must be completed before creating meeting link"
        );
      }

      if (!appointment.isDoctorApproved) {
        throw new Error(
          "Doctor must approve the appointment before meeting link can be generated"
        );
      }
      // Get doctor and patient data
      const doctorData = await doctorService.getDoctorProfileByUserId(doctorId);
      const patientData = await patientService.getPatientProfileByUserId(
        appointment.patientId
      );

      // Create Jitsi meeting
      const meetingResult =
        await this.jitsiMeetingService.createMeetingForAppointment(
          appointment,
          doctorData,
          patientData
        );

      if (!meetingResult.success) {
        return meetingResult;
      }

      // Update appointment with meeting data
      const updateData = {
        meetingProvider: "jitsi",
        meetingLink: meetingResult.meetingLink,
        meetingId: meetingResult.meetingId,
        meetingPassword: meetingResult.meetingPassword,
      };

      await this.appointmentRepository.update(appointmentId, updateData);

      // Generate join instructions for patient and doctor
      const patientInstructions =
        this.jitsiMeetingService.generateJoinInstructions(
          meetingResult,
          appointment
        );

      const doctorInstructions =
        this.jitsiMeetingService.generateDoctorJoinInstructions(
          meetingResult,
          appointment
        );

      return {
        success: true,
        meetingData: meetingResult,
        patientInstructions,
        doctorInstructions,
      };
    } catch (error) {
      console.error("❌ Error generating Jitsi meeting link:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateJitsiMeetingAppointment(appointmentId, updateData) {
    try {
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment || !appointment.roomName) {
        return {
          success: false,
          error: "Appointment or Jitsi meeting not found",
        };
      }

      const doctorData = await this.getDoctorData(appointment.doctorId);

      const result = await this.jitsiMeetingService.updateMeetingForAppointment(
        appointment.roomName,
        { ...appointment, ...updateData },
        doctorData
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cancelJitsiMeetingAppointment(appointmentId, cancellationReason) {
    try {
      const appointment = await this.appointmentRepository.findById(
        appointmentId
      );
      if (!appointment || !appointment.roomName) {
        return {
          success: false,
          error: "Appointment or Jitsi meeting not found",
        };
      }

      const result = await this.jitsiMeetingService.cancelMeetingForAppointment(
        appointment.roomName,
        cancellationReason
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async autoUpdateMeetingLink(appointment) {
    try {
      if (appointment.meetingProvider === "zoom" && appointment.zoomMeetingId) {
        await this.updateZoomMeetingAppointment(appointment.id, appointment);
      } else if (
        appointment.meetingProvider === "google" &&
        appointment.calendarEventId
      ) {
        await this.updateGoogleMeetingAppointment(appointment.id, appointment);
      } else if (appointment.meetingProvider === "jitsi") {
        await this.updateJitsiMeetingAppointment(appointment.id, appointment);
      }
      console.log(`✅ Meeting updated for appointment ${appointment.id}`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to update meeting for appointment ${appointment.id}:`,
        error.message
      );
      // Don't fail the appointment update if meeting update fails
    }
  }
  async updatePaymentStatus(appointmentId, paymentData) {
    const appointment = await this.appointmentRepository.findById(
      appointmentId
    );
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const updateData = {
      paymentStatus: paymentData.paymentStatus,
      paymentId: paymentData.paymentId,
      paymentMethod: paymentData.paymentMethod,
      updatedAt: new Date(),
    };

    // If payment completed, update appointment status
    if (
      paymentData.paymentStatus === "completed" &&
      appointment.status === "pending"
    ) {
      updateData.status = "scheduled";

      // Send email notification to doctor about payment and approval request
      try {
        const doctorData = appointment.doctor;
        const patientData = appointment.patient;

        if (doctorData?.email) {
          await appointmentEmailHelpers.sendDoctorPaymentNotificationEmail({
            email: doctorData.email,
            doctorName: doctorData.fullName,
            patientName: patientData.fullName,
            appointmentDetails: {
              id: appointment.id,
              date: appointment.appointmentDate,
              time: appointment.appointmentTime,
              type: appointment.type || "consultation",
              duration: appointment.duration,
            },
            paymentDetails: {
              amount: appointment.consultationFee,
              method: paymentData.paymentMethod,
              paymentId: paymentData.paymentId,
              paidAt: new Date().toLocaleString(),
            },
          });
        }
      } catch (emailError) {
        console.error(
          `Error sending payment notification email for appointment ${appointmentId}:`,
          emailError
        );
        // Don't fail the payment update if email sending fails
      }

      // Notify patient about successful payment
      await this.notificationService.createNotification(
        appointment.patientId,
        "notification",
        `Payment confirmed! Your appointment with Dr. ${appointment.doctor?.fullName} is pending doctor approval.`,
        {
          action: "payment_completed",
          appointmentId: appointment.id,
          amount: appointment.consultationFee,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      // Notify doctor that payment is completed and needs approval
      await this.notificationService.createNotification(
        appointment.doctorId,
        "alert",
        `Payment received for appointment with ${appointment.patient?.fullName}. Please review and approve the appointment.`,
        {
          action: "payment_completed_needs_approval",
          appointmentId: appointment.id,
          link: "/doctors/dashboard/appointments",
        }
      );

      //CREATE APPOINTMENT CHAT
      // Convert appointment start time
      const appointmentStart = new Date(
        `${appointment.appointmentDate}T${appointment.appointmentTime}`
      );

      // scheduledStartTime = 15 mins before actual appointment
      const scheduledStartTime = new Date(
        appointmentStart.getTime() - 15 * 60 * 1000
      );

      // scheduledEndTime = actual start time + duration
      const scheduledEndTime = new Date(
        appointmentStart.getTime() + appointment.duration * 60 * 1000
      );

      this.appointChatService.createAppointmentChat(
        appointmentId,
        appointment.doctorId,
        appointment.patientId,
        {
          scheduledStartTime,
          scheduledEndTime,
        }
      );
    }

    return await this.appointmentRepository.update(appointmentId, updateData);
  }

  async validateAndGetPricing(doctorId, consultationType, duration) {
    try {
      const pricing =
        await this.doctorPricingService.getPricingForConsultationType(
          doctorId,
          consultationType,
          duration
        );

      if (!pricing) {
        throw new Error(
          `Doctor has not set pricing for ${consultationType} appointments`
        );
      }

      if (!pricing.isActive) {
        throw new Error(
          `Pricing for ${consultationType} is currently inactive`
        );
      }

      return pricing;
    } catch (error) {
      throw new Error(`Pricing validation failed: ${error.message}`);
    }
  }

  async validateDoctorAvailability(
    doctorId,
    appointmentDate,
    appointmentTime,
    duration
  ) {
    try {
      // Get available slots for the date
      const availabilityData =
        await this.doctorAvailabilityService.getAvailableSlots(
          doctorId,
          appointmentDate
        );

      if (!availabilityData.availableSlots.length) {
        throw new Error(`Doctor is not available on ${appointmentDate}`);
      }

      // Check if requested time slot is available
      const requestedSlot = appointmentTime;
      if (!availabilityData.availableSlots.includes(requestedSlot)) {
        throw new Error(
          `Time slot ${appointmentTime} is not available. Available slots: ${availabilityData.availableSlots.join(
            ", "
          )}`
        );
      }

      // Validate duration fits within doctor's schedule
      const endTime = this.calculateEndTime(appointmentTime, duration);
      const dayOfWeek = this.getDayOfWeek(appointmentDate);

      const doctorSchedule =
        await this.doctorAvailabilityService.getDoctorAvailability(doctorId);
      const daySchedule = doctorSchedule.find(
        (schedule) => schedule.dayOfWeek === dayOfWeek
      );

      if (
        daySchedule &&
        this.timeToMinutes(endTime) > this.timeToMinutes(daySchedule.endTime)
      ) {
        throw new Error(
          `Appointment duration extends beyond doctor's working hours`
        );
      }

      return true;
    } catch (error) {
      throw new Error(`Availability validation failed: ${error.message}`);
    }
  }

  async validateSlotAvailability(
    doctorId,
    appointmentDate,
    appointmentTime,
    duration
  ) {
    try {
      // Get existing appointments for doctor on that date
      const existingAppointments =
        await this.appointmentRepository.findDoctorAvailability(
          doctorId,
          appointmentDate
        );

      // Calculate new appointment time range
      const newStartMinutes = this.timeToMinutes(appointmentTime);
      const newEndMinutes = newStartMinutes + duration;

      // Check for conflicts with existing appointments
      for (const appointment of existingAppointments) {
        if (appointment.status === "cancelled") continue;

        // For pending appointments, only block if created within last 10 minutes
        if (appointment.status === "pending") {
          const createdAt = new Date(appointment.createdAt);
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

          // If pending appointment is older than 10 minutes, don't block the slot
          if (createdAt <= tenMinutesAgo) continue;
        }

        const existingStartMinutes = this.timeToMinutes(
          appointment.appointmentTime
        );
        const existingEndMinutes = existingStartMinutes + appointment.duration;

        // Check for overlap
        if (
          newStartMinutes < existingEndMinutes &&
          newEndMinutes > existingStartMinutes
        ) {
          throw new Error(
            `Time slot conflicts with existing appointment at ${appointment.appointmentTime
            }-${this.minutesToTime(existingEndMinutes)}`
          );
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Slot validation failed: ${error.message}`);
    }
  }

  async validateNotInUnavailabilityPeriod(
    doctorId,
    appointmentDate,
    appointmentTime
  ) {
    try {
      // Check if doctor has marked this time as unavailable
      const unavailabilityPeriods =
        await this.doctorAvailabilityService.findUnavailabilityByDoctor(
          doctorId,
          appointmentDate,
          appointmentDate
        );

      for (const period of unavailabilityPeriods) {
        // Check if entire day is unavailable
        if (!period.startTime && !period.endTime) {
          throw new Error(
            `Doctor is unavailable on ${appointmentDate} (${period.reason || period.type
            })`
          );
        }

        // Check if specific time is unavailable
        if (period.startTime && period.endTime) {
          const appointmentMinutes = this.timeToMinutes(appointmentTime);
          const unavailableStart = this.timeToMinutes(period.startTime);
          const unavailableEnd = this.timeToMinutes(period.endTime);

          if (
            appointmentMinutes >= unavailableStart &&
            appointmentMinutes < unavailableEnd
          ) {
            throw new Error(
              `Doctor is unavailable at ${appointmentTime} on ${appointmentDate} (${period.reason || period.type
              })`
            );
          }
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Unavailability validation failed: ${error.message}`);
    }
  }

  // Helper methods
  getDayOfWeek(date) {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[new Date(date).getDay()];
  }

  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Validate doctor availability with timezone awareness
   */
  async validateDoctorAvailabilityWithTimezone(
    doctorId,
    appointmentDate,
    appointmentTime,
    duration,
    patientTimezone,
    doctorTimezone
  ) {
    try {
      // Convert patient's requested time to doctor's timezone for validation
      const patientUTC = TimezoneService.convertToUTC(
        appointmentDate,
        appointmentTime,
        patientTimezone
      );
      const doctorLocalTime = TimezoneService.convertFromUTC(
        patientUTC,
        doctorTimezone
      );

      console.log(`🕐 Timezone validation:`, {
        patientInput: `${appointmentDate} ${appointmentTime} (${patientTimezone})`,
        utc: patientUTC.toISOString(),
        doctorLocal: `${doctorLocalTime.date} ${doctorLocalTime.time} (${doctorTimezone})`,
      });

      // Validate against doctor's availability using doctor's local time
      await this.validateDoctorAvailability(
        doctorId,
        doctorLocalTime.date,
        doctorLocalTime.time,
        duration
      );

      // Validate slot availability using UTC time for consistency
      await this.validateSlotAvailabilityWithTimezone(
        doctorId,
        patientUTC,
        duration
      );

      return true;
    } catch (error) {
      throw new Error(
        `Timezone-aware availability validation failed: ${error.message}`
      );
    }
  }

  /**
   * Validate slot availability using UTC time
   */
  async validateSlotAvailabilityWithTimezone(
    doctorId,
    appointmentUTC,
    duration
  ) {
    try {
      // Get existing appointments for the doctor around this time
      const startOfDay = new Date(appointmentUTC);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(appointmentUTC);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const result = await this.appointmentRepository.findAll({
        doctorId,
        dateRange: {
          startDate: startOfDay.toISOString().split("T")[0],
          endDate: endOfDay.toISOString().split("T")[0],
        },
        limit: 1000
      });

      const existingAppointments = result.data || [];

      const newStartUTC = appointmentUTC.getTime();
      const newEndUTC = newStartUTC + duration * 60 * 1000;

      // Check for conflicts using UTC times
      for (const appointment of existingAppointments) {
        if (appointment.status === "cancelled") continue;

        // For pending appointments, only block if created within last 10 minutes
        if (appointment.status === "pending") {
          const createdAt = new Date(appointment.createdAt);
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          if (createdAt <= tenMinutesAgo) continue;
        }

        const existingStartUTC = appointment.appointmentTimeUTC
          ? new Date(appointment.appointmentTimeUTC).getTime()
          : // Fallback to original date/time if UTC not available
          TimezoneService.convertToUTC(
            appointment.appointmentDate,
            appointment.appointmentTime,
            appointment.patientTimezone || "UTC"
          ).getTime();

        const existingEndUTC =
          existingStartUTC + appointment.duration * 60 * 1000;

        // Check for overlap
        if (newStartUTC < existingEndUTC && newEndUTC > existingStartUTC) {
          const conflictTime = TimezoneService.convertFromUTC(
            new Date(existingStartUTC),
            appointment.doctorTimezone || "UTC"
          );
          throw new Error(
            `Time slot conflicts with existing appointment at ${conflictTime.time} (${appointment.doctorTimezone})`
          );
        }
      }

      return true;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Send timezone-aware notifications
   */
  async sendTimezoneAwareNotifications(appointment, action) {
    try {
      const patientDisplayTime = TimezoneService.formatTimeForDisplay(
        appointment.appointmentTimeUTC,
        appointment.patientTimezone
      );

      const doctorDisplayTime = TimezoneService.formatTimeForDisplay(
        appointment.appointmentTimeUTC,
        appointment.doctorTimezone
      );

      // Patient notification (in their timezone)
      await this.notificationService.createNotification(
        appointment.patientId,
        "notification",
        `Your appointment with Dr. ${appointment.doctor?.fullName
        } has been ${action} for ${patientDisplayTime.userTime.formatted}. ${action == "created"
          ? "Please make payment, else the slot will be revoked in 10mins"
          : ""
        }`,
        {
          action: `appointment_${action}`,
          appointmentId: appointment.id,
          appointmentTimeUTC: appointment.appointmentTimeUTC,
          displayTime: patientDisplayTime,
          link: "/patients/dashboard/appointments/overview",
        }
      );

      if (action != "created") {
        // Doctor notification (in their timezone)
        await this.notificationService.createNotification(
          appointment.doctorId,
          "alert",
          `${action === "created" ? "New" : "Updated"
          } appointment request from ${appointment.patient?.fullName} for ${doctorDisplayTime.userTime.formatted
          }.`,
          {
            action: `appointment_${action}`,
            appointmentId: appointment.id,
            appointmentTimeUTC: appointment.appointmentTimeUTC,
            displayTime: doctorDisplayTime,
            link: "/doctors/dashboard/appointments/pending",
          }
        );
      }
    } catch (error) {
      console.error(`Failed to send timezone-aware notifications:`, error);
    }
  }
}

module.exports = AppointmentService;
