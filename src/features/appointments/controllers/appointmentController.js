// ===================================
// src/controllers/AppointmentController.js
// ===================================

const AppointmentService = require('../services/appointmentService');
const TimezoneService = require('../../compliance/services/timezoneService');


class AppointmentController {
  constructor() {
    this.appointmentService = new AppointmentService();
  }
  // async getAllAppointments(req, res) {
  //   try {
  //     const filters = {
  //       patientId: req.query.patientId,
  //       doctorId: req.query.doctorId,
  //       status: req.query.status,
  //       appointmentDate: req.query.appointmentDate,
  //       paymentStatus: req.query.paymentStatus,
  //       dateRange: req.query.startDate && req.query.endDate ? {
  //         startDate: req.query.startDate,
  //         endDate: req.query.endDate
  //       } : null
  //     };

  //     const appointments = await this.appointmentService.getAppointments(filters);
  //     res.json(appointments);
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }
  async getAllAppointments(req, res) {
    try {
      const filters = {
        patientId: req.query.patientId,
        doctorId: req.query.doctorId,
        status: req.query.status,
        appointmentDate: req.query.appointmentDate,
        paymentStatus: req.query.paymentStatus,
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: req.query.startDate,
          endDate: req.query.endDate
        } : null,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };

      const result = await this.appointmentService.getAppointments(filters);

      // Add timezone-aware display times for each appointment
      // const enhancedAppointments = appointments.map(appointment => {
      //   if (appointment.appointmentTimeUTC) {
      //     const userTimezone = req.userTimezone || 'UTC';
      //     appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //       appointment.appointmentTimeUTC,
      //       userTimezone,
      //       appointment.doctorTimezone !== appointment.patientTimezone ? 
      //         (userTimezone === appointment.patientTimezone ? appointment.doctorTimezone : appointment.patientTimezone) : 
      //         null
      //     );
      //     appointment.timeUntilAppointment = TimezoneService.getTimeUntilAppointment(appointment.appointmentTimeUTC);
      //   }
      //   return appointment;
      // });

      res.json({
        success: true,
        appointments: result.data,
        meta: result.meta,
        timezoneContext: {
          userTimezone: req.userTimezone,
          // count: enhancedAppointments.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAnalytics(req, res) {
    try {
      const filters = {
        patientId: req.query.patientId,
        doctorId: req.query.doctorId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const analytics = await this.appointmentService.getAnalytics(filters);

      res.json({
        success: true,
        analytics,
        // timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


  // async getAppointmentById(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const appointment = await this.appointmentService.getAppointmentById(id);
  //     res.json(appointment);
  //   } catch (error) {
  //     res.status(404).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;
      const appointment = await this.appointmentService.getAppointmentById(id, req);

      res.json({
        success: true,
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // async createAppointment(req, res) {
  //   try {
  //     const result = await this.appointmentService.createAppointment(req.body);

  //     if (result.success) {
  //       res.status(201).json(result);
  //     } else {
  //       res.status(400).json(result);
  //     }
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async createAppointment(req, res) {
    try {
      // Pass request object for timezone context
      const result = await this.appointmentService.createAppointment(req.body, req);

      if (result.success) {
        res.status(201).json({
          ...result,
          timezoneContext: req.userTimezoneData
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // async updateDoctorApproval(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const { isDoctorApproved, doctorId } = req.body;

  //     const appointment = await this.appointmentService.updateDoctorApproval(id, {
  //       isDoctorApproved,
  //       doctorId
  //     });

  //     res.json({
  //       success: true,
  //       appointment,
  //       message: `Appointment ${isDoctorApproved ? 'approved' : 'rejected'} by doctor`
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async updateDoctorApproval(req, res) {
    try {
      const { id } = req.params;
      const { isDoctorApproved, doctorId } = req.body;

      const appointment = await this.appointmentService.updateDoctorApproval(id, {
        isDoctorApproved,
        doctorId
      });

      // Add timezone-aware display time
      // if (appointment.appointmentTimeUTC) {
      //   const userTimezone = req.userTimezone || 'UTC';
      //   appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //     appointment.appointmentTimeUTC,
      //     userTimezone
      //   );
      // }

      // Only track usage if doctor actually approved (not rejected)
      if (isDoctorApproved === true && req.usageTracking) {
        req.shouldTrackUsage = true;
      } else if (req.usageTracking) {
        req.shouldTrackUsage = false;
      }

      res.json({
        success: true,
        appointment,
        message: `Appointment ${isDoctorApproved ? 'approved' : 'rejected'} by doctor`,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // async updateAppointment(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const appointment = await this.appointmentService.updateAppointment(id, req.body);
  //     res.json({
  //       success: true,
  //       appointment
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async updateAppointment(req, res) {
    try {
      const { id } = req.params;

      let appointment;

      // Check if this is a reschedule (date/time change)
      if (req.body.appointmentDate || req.body.appointmentTime) {
        // Handle as reschedule with timezone awareness
        const rescheduleData = {
          newDate: req.body.appointmentDate,
          newTime: req.body.appointmentTime,
          duration: req.body.duration,
          reason: req.body.reason || 'Appointment time updated',
          rescheduledBy: req.user?.sub || 'system'
        };

        appointment = await this.appointmentService.rescheduleAppointment(id, rescheduleData, req);
      } else {
        // Regular update
        appointment = await this.appointmentService.updateAppointment(id, req.body);
      }

      // Add timezone display information
      // if (appointment.appointmentTimeUTC) {
      //   const userTimezone = req.userTimezone || 'UTC';
      //   appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //     appointment.appointmentTimeUTC,
      //     userTimezone,
      //     appointment.doctorTimezone !== appointment.patientTimezone ? 
      //       (userTimezone === appointment.patientTimezone ? appointment.doctorTimezone : appointment.patientTimezone) : 
      //       null
      //   );
      // }

      res.json({
        success: true,
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // async cancelAppointment(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const appointment = await this.appointmentService.cancelAppointment(id, req.body);
  //     res.json({
  //       success: true,
  //       message: 'Appointment cancelled successfully',
  //       appointment
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async cancelAppointment(req, res) {
    try {
      const { id } = req.params;
      const appointment = await this.appointmentService.cancelAppointment(id, req.body);
      res.json({
        success: true,
        message: 'Appointment cancelled successfully',
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // async rescheduleAppointment(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const appointment = await this.appointmentService.rescheduleAppointment(id, req.body);
  //     res.json({
  //       success: true,
  //       message: 'Appointment rescheduled successfully',
  //       appointment
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async rescheduleAppointment(req, res) {
    try {
      const { id } = req.params;
      const appointment = await this.appointmentService.rescheduleAppointment(id, req.body, req);

      // Add timezone display information
      // if (appointment.appointmentTimeUTC) {
      //   const userTimezone = req.userTimezone || 'UTC';
      //   appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //     appointment.appointmentTimeUTC,
      //     userTimezone,
      //     appointment.doctorTimezone !== appointment.patientTimezone ? 
      //       (userTimezone === appointment.patientTimezone ? appointment.doctorTimezone : appointment.patientTimezone) : 
      //       null
      //   );
      // }

      res.json({
        success: true,
        message: 'Appointment rescheduled successfully',
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // async completeAppointment(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const appointment = await this.appointmentService.completeAppointment(id, req.body);
  //     res.json({
  //       success: true,
  //       message: 'Appointment completed successfully',
  //       appointment
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async completeAppointment(req, res) {
    try {
      const { id } = req.params;
      const appointment = await this.appointmentService.completeAppointment(id, req.body);
      res.json({
        success: true,
        message: 'Appointment completed successfully',
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // async processPayment(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const appointment = await this.appointmentService.processPayment(id, req.body);
  //     res.json({
  //       success: true,
  //       message: 'Payment processed successfully',
  //       appointment
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  async processPayment(req, res) {
    try {
      const { id } = req.params;
      const appointment = await this.appointmentService.processPayment(id, req.body);
      res.json({
        success: true,
        message: 'Payment processed successfully',
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async generateMeetingLink(req, res) {
    try {
      const { id } = req.params;
      const appointment = await this.appointmentService.generateMeetingLink(id, req.body);
      res.json({
        success: true,
        message: 'Meeting link generated successfully',
        appointment
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // async generateGoogleMeetingLink(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const {doctorId} = req.body;
  //     const appointment = await this.appointmentService.generateGoogleMeetLink(id, doctorId);
  //     res.json({
  //       success: true,
  //       message: 'Google Meeting link generated successfully',
  //       appointment
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }



  // async getPatientAppointments(req, res) {
  //   try {
  //     const { patientId } = req.params;
  //     const appointments = await this.appointmentService.getPatientAppointments(patientId);
  //     res.json(appointments);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  // async getDoctorAppointments(req, res) {
  //   try {
  //     const { doctorId } = req.params;
  //     const appointments = await this.appointmentService.getDoctorAppointments(doctorId);
  //     res.json(appointments);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  // async getPatientUpcomingAppointments(req, res) {
  //   try {
  //     const { patientId } = req.params;
  //     const appointments = await this.appointmentService.getPatientAppointmentsUpcoming(patientId);
  //     res.json(appointments);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  // async getDoctorUpcomingAppointments(req, res) {
  //   try {
  //     const { doctorId } = req.params;
  //     const appointments = await this.appointmentService.getDoctorAppointmentsUpcoming(doctorId);
  //     res.json(appointments);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  // async getDoctorAvailability(req, res) {
  //   try {
  //     const { doctorId } = req.params;
  //     const { date } = req.query;
  //     const availability = await this.appointmentService.getDoctorAvailability(doctorId, date);
  //     res.json(availability);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  // async getMeetingDetails(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const meetingDetails = await this.appointmentService.getMeetingDetails(id);
  //     res.json(meetingDetails);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }

  // async sendAppointmentReminder(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const result = await this.appointmentService.sendAppointmentReminder(id);
  //     res.json(result);
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }


  //   async generateGoogleMeetLink(req, res) {
  //     try {
  //       const { id } = req.params;
  //       const { doctorId } = req.body; // or get from auth context

  //       const result = await this.appointmentService.generateGoogleMeetLink(id, doctorId);

  //       if (result.success) {
  //         res.json(result);
  //       } else {
  //         const statusCode = result.requiresAuth ? 401 : 400;
  //         res.status(statusCode).json(result);
  //       }
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         error: error.message
  //       });
  //     }
  //   }

  //   async generateZoomMeetingLink(req, res) {
  //     try {
  //       const { id } = req.params;
  //       const { doctorId } = req.body; // or get from auth context

  //       const result = await this.appointmentService.generateZoomMeetingLink(id, doctorId);

  //       if (result.success) {
  //         res.json(result);
  //       } else {
  //         res.status(400).json(result);
  //       }
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         error: error.message
  //       });
  //     }
  //   }

  //   async generateJitsiMeetingLink(req, res) {
  //     try {
  //       const { id } = req.params;
  //       const { doctorId } = req.body; // or get from auth context

  //       const result = await this.appointmentService.generateJitsiMeetingLink(id, doctorId);

  //       if (result.success) {
  //         res.json(result);
  //       } else {
  //         res.status(400).json(result);
  //       }
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         error: error.message
  //       });
  //     }
  //   }

  //   async updatePaymentStatus(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const { paymentStatus, paymentId, paymentMethod } = req.body;

  //     const appointment = await this.appointmentService.updatePaymentStatus(id, {
  //       paymentStatus,
  //       paymentId,
  //       paymentMethod
  //     });

  //     res.json({
  //       success: true,
  //       appointment,
  //       message: 'Payment status updated successfully'
  //     });
  //   } catch (error) {
  //     res.status(400).json({
  //       success: false,
  //       error: error.message
  //     });
  //   }
  // }



  async generateGoogleMeetingLink(req, res) {
    try {
      const { id } = req.params;
      const { doctorId } = req.body;
      const appointment = await this.appointmentService.generateGoogleMeetLink(id, doctorId);
      res.json({
        success: true,
        message: 'Google Meeting link generated successfully',
        appointment,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async generateZoomMeetingLink(req, res) {
    try {
      const { id } = req.params;
      const { doctorId } = req.body;

      const result = await this.appointmentService.generateZoomMeetingLink(id, doctorId);

      if (result.success) {
        res.json({
          ...result,
          timezoneContext: req.userTimezoneData
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async generateJitsiMeetingLink(req, res) {
    try {
      const { id } = req.params;
      const { doctorId } = req.body;

      const result = await this.appointmentService.generateJitsiMeetingLink(id, doctorId);

      if (result.success) {
        res.json({
          ...result,
          timezoneContext: req.userTimezoneData
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getMeetingDetails(req, res) {
    try {
      const { id } = req.params;
      const meetingDetails = await this.appointmentService.getMeetingDetails(id);
      res.json({
        ...meetingDetails,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async sendAppointmentReminder(req, res) {
    try {
      const { id } = req.params;
      const result = await this.appointmentService.sendAppointmentReminder(id);
      res.json({
        ...result,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPatientAppointments(req, res) {
    try {
      const { patientId } = req.params;
      const appointments = await this.appointmentService.getPatientAppointments(patientId);

      // Add timezone-aware display times
      // const enhancedAppointments = appointments.map(appointment => {
      //   if (appointment.appointmentTimeUTC) {
      //     const userTimezone = req.userTimezone || 'UTC';
      //     appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //       appointment.appointmentTimeUTC,
      //       userTimezone
      //     );
      //     appointment.timeUntilAppointment = TimezoneService.getTimeUntilAppointment(appointment.appointmentTimeUTC);
      //   }
      //   return appointment;
      // });

      res.json({
        success: true,
        // appointments: enhancedAppointments,
        appointments: appointments,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getDoctorAppointments(req, res) {
    try {
      const { doctorId } = req.params;
      const appointments = await this.appointmentService.getDoctorAppointments(doctorId);


      // Add timezone-aware display times
      // const enhancedAppointments = appointments.map(appointment => {
      //   if (appointment.appointmentTimeUTC) {
      //     const userTimezone = req.userTimezone || 'UTC';
      //     appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //       appointment.appointmentTimeUTC,
      //       userTimezone
      //     );
      //     appointment.timeUntilAppointment = TimezoneService.getTimeUntilAppointment(appointment.appointmentTimeUTC);
      //   }
      //   return appointment;
      // });

      res.json({
        success: true,
        // appointments: enhancedAppointments,
        appointments: appointments,

        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPatientUpcomingAppointments(req, res) {
    try {
      const { patientId } = req.params;
      const appointments = await this.appointmentService.getPatientAppointmentsUpcoming(patientId);

      // Add timezone-aware display times
      // const enhancedAppointments = appointments.map(appointment => {
      //   if (appointment.appointmentTimeUTC) {
      //     const userTimezone = req.userTimezone || 'UTC';
      //     appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //       appointment.appointmentTimeUTC,
      //       userTimezone
      //     );
      //     appointment.timeUntilAppointment = TimezoneService.getTimeUntilAppointment(appointment.appointmentTimeUTC);
      //   }
      //   return appointment;
      // });

      res.json({
        success: true,
        // appointments: enhancedAppointments,
        appointments: appointments,
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getDoctorUpcomingAppointments(req, res) {
    try {
      const { doctorId } = req.params;
      const appointments = await this.appointmentService.getDoctorAppointmentsUpcoming(doctorId);

      // Add timezone-aware display times
      // const enhancedAppointments = appointments.map(appointment => {
      //   if (appointment.appointmentTimeUTC) {
      //     const userTimezone = req.userTimezone || 'UTC';
      //     appointment.displayTime = TimezoneService.formatTimeForDisplay(
      //       appointment.appointmentTimeUTC,
      //       userTimezone
      //     );
      //     appointment.timeUntilAppointment = TimezoneService.getTimeUntilAppointment(appointment.appointmentTimeUTC);
      //   }
      //   return appointment;
      // });

      res.json({
        success: true,
        // appointments: enhancedAppointments,
        appointments: appointments,

        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { paymentStatus, paymentId, paymentMethod } = req.body;

      const appointment = await this.appointmentService.updatePaymentStatus(id, {
        paymentStatus,
        paymentId,
        paymentMethod
      });

      res.json({
        success: true,
        appointment,
        message: 'Payment status updated successfully',
        timezoneContext: req.userTimezoneData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // NEW TIMEZONE-SPECIFIC METHODS

  async updateUserTimezone(req, res) {
    try {
      const { timezone } = req.body;
      const userId = req.user.sub;

      // Validate timezone
      if (!TimezoneService.isValidTimezone(timezone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timezone provided'
        });
      }

      const result = await TimezoneService.updateUserTimezone(userId, timezone, req);

      res.json({
        success: true,
        message: 'Timezone preference updated successfully',
        timezone: result.timezone,
        detected: req.location?.timezone,
        previousTimezone: req.userTimezone
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAvailableTimezones(req, res) {
    try {
      const commonTimezones = TimezoneService.getCommonTimezones();

      res.json({
        success: true,
        timezones: {
          common: commonTimezones,
          user: {
            current: req.userTimezone,
            detected: req.location?.timezone,
            saved: req.userTimezoneData?.preferred
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = AppointmentController;