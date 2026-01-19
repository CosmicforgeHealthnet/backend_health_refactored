
// // ===================================
// // src/controllers/DoctorAvailabilityController.js
// // ===================================

// const DoctorAvailabilityService = require('../../services/appointment/doctorAvailabilityService');

// class DoctorAvailabilityController {
//   constructor() {
//     this.availabilityService = new DoctorAvailabilityService();
//   }

//   async setAvailability(req, res) {
//     try {
//       const { doctorId } = req.params;
//       const availabilityData = req.body;

//       const availability = await this.availabilityService.setWeeklyAvailability(doctorId, availabilityData);

//       res.status(201).json({
//         success: true,
//         availability,
//         message: 'Availability set successfully'
//       });
//     } catch (error) {
//       res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }
//   }

//   async replaceAvailability(req, res) {
//     try {
//       const { doctorId } = req.params;
//       const availabilityData = req.body;
  
//       const availability = await this.availabilityService.replaceWeeklyAvailability(
//         doctorId, 
//         availabilityData
//       );
  
//       res.status(200).json({
//         success: true,
//         availability,
//         message: 'Availability replaced successfully'
//       });
//     } catch (error) {
//       res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }
//   }

//   async getDoctorAvailability(req, res) {
//     try {
//       const { doctorId } = req.params;
//       const availability = await this.availabilityService.getDoctorAvailability(doctorId);

//       res.json({
//         success: true,
//         availability
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         error: error.message
//       });
//     }
//   }

//   async getAvailableSlots(req, res) {
//     try {
//       const { doctorId } = req.params;
//       const { date } = req.query;

//       const slots = await this.availabilityService.getAvailableSlots(doctorId, date);

//       res.json({
//         success: true,
//         ...slots
//       });
//     } catch (error) {
//       res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }
//   }

//   async setUnavailability(req, res) {
//     try {
//       const { doctorId } = req.params;
//       const unavailabilityData = req.body;

//       const unavailability = await this.availabilityService.setUnavailability(doctorId, unavailabilityData);

//       res.status(201).json({
//         success: true,
//         unavailability,
//         message: 'Unavailability period set successfully'
//       });
//     } catch (error) {
//       res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }
//   }


// async updateAvailability(req, res) {
//   try {
//     const { doctorId, availabilityId } = req.params;
//     const updateData = req.body;

//     const availability = await this.availabilityService.updateAvailability(
//       doctorId, 
//       availabilityId, 
//       updateData
//     );

//     res.json({
//       success: true,
//       availability,
//       message: 'Availability updated successfully'
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       error: error.message
//     });
//   }
// }

// async deleteAvailability(req, res) {
//   try {
//     const { doctorId, availabilityId } = req.params;

//     await this.availabilityService.deleteAvailability(doctorId, availabilityId);

//     res.json({
//       success: true,
//       message: 'Availability deleted successfully'
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       error: error.message
//     });
//   }
// }

// async updateUnavailability(req, res) {
//   try {
//     const { doctorId, unavailabilityId } = req.params;
//     const updateData = req.body;

//     const unavailability = await this.availabilityService.updateUnavailability(
//       doctorId, 
//       unavailabilityId, 
//       updateData
//     );

//     res.json({
//       success: true,
//       unavailability,
//       message: 'Unavailability updated successfully'
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       error: error.message
//     });
//   }
// }

// async deleteUnavailability(req, res) {
//   try {
//     const { doctorId, unavailabilityId } = req.params;

//     await this.availabilityService.deleteUnavailability(doctorId, unavailabilityId);

//     res.json({
//       success: true,
//       message: 'Unavailability deleted successfully'
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       error: error.message
//     });
//   }
// }
// }

// module.exports = DoctorAvailabilityController;

// ===================================
// src/controllers/appointment/doctorAvailabilityController.js (Updated with Timezone Support)
// ===================================

const DoctorAvailabilityService = require('../../services/appointment/doctorAvailabilityService');
const TimezoneService = require('../../services/timezoneService');

class DoctorAvailabilityController {
  constructor() {
    this.availabilityService = new DoctorAvailabilityService();
  }

  async setAvailability(req, res) {
    try {
      const { doctorId } = req.params;
      const availabilityData = req.body;

      // Pass request object for timezone context
      const availability = await this.availabilityService.setWeeklyAvailability(
        doctorId, 
        availabilityData, 
        req
      );

      res.status(201).json({
        success: true,
        availability,
        message: 'Availability set successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone,
          availabilityCount: availability.length
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async replaceAvailability(req, res) {
    try {
      const { doctorId } = req.params;
      const availabilityData = req.body;
  
      // Pass request object for timezone context
      const availability = await this.availabilityService.replaceWeeklyAvailability(
        doctorId, 
        availabilityData,
        req
      );
  
      res.status(200).json({
        success: true,
        availability,
        message: 'Availability replaced successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone,
          availabilityCount: availability.length
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getDoctorAvailability(req, res) {
    try {
      const { doctorId } = req.params;
      const availability = await this.availabilityService.getDoctorAvailability(doctorId);

      // Add timezone display information for each availability record
      const enhancedAvailability = availability.map(avail => {
        if (avail.timezone && req.userTimezone && avail.timezone !== req.userTimezone) {
          // Convert times to user's timezone for display
          try {
            const startTimeDisplay = this.convertTimeForDisplay(
              avail.startTime, 
              avail.timezone, 
              req.userTimezone
            );
            const endTimeDisplay = this.convertTimeForDisplay(
              avail.endTime, 
              avail.timezone, 
              req.userTimezone
            );

            return {
              ...avail,
              displayTimes: {
                startTime: startTimeDisplay,
                endTime: endTimeDisplay,
                originalTimezone: avail.timezone,
                displayTimezone: req.userTimezone
              }
            };
          } catch (error) {
            console.error('Error converting availability times:', error);
            return avail;
          }
        }
        return avail;
      });

      res.json({
        success: true,
        availability: enhancedAvailability,
        timezoneContext: {
          userTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAvailableSlots(req, res) {
    try {
      const { doctorId } = req.params;
      const { date, timezone } = req.query;

      // Use provided timezone or user's detected timezone
      const targetTimezone = timezone || req.location.timezone;

      // Validate timezone if provided
      if (timezone && !TimezoneService.isValidTimezone(timezone)) {
        return res.status(400).json({
          success: false,
          error: `Invalid timezone: ${timezone}`
        });
      }

      const slots = await this.availabilityService.getAvailableSlots(
        doctorId, 
        date, 
        targetTimezone, 
        req
      );

      res.json({
        success: true,
        ...slots,
        message: `Available slots for ${date} in ${targetTimezone}`,
        timezoneInfo: {
          requestedTimezone: targetTimezone,
          userDetectedTimezone: req.location?.timezone,
          doctorTimezone: slots.doctorTimezone,
          conversionApplied: slots.doctorTimezone !== targetTimezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async setUnavailability(req, res) {
    try {
      const { doctorId } = req.params;
      const unavailabilityData = req.body;

      const unavailability = await this.availabilityService.setUnavailability(
        doctorId, 
        unavailabilityData
      );

      res.status(201).json({
        success: true,
        unavailability,
        message: 'Unavailability period set successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateAvailability(req, res) {
    try {
      const { doctorId, availabilityId } = req.params;
      const updateData = req.body;

      const availability = await this.availabilityService.updateAvailability(
        doctorId, 
        availabilityId, 
        updateData
      );

      res.json({
        success: true,
        availability,
        message: 'Availability updated successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteAvailability(req, res) {
    try {
      const { doctorId, availabilityId } = req.params;

      await this.availabilityService.deleteAvailability(doctorId, availabilityId);

      res.json({
        success: true,
        message: 'Availability deleted successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUnavailability(req, res) {
    try {
      const { doctorId, unavailabilityId } = req.params;
      const updateData = req.body;

      const unavailability = await this.availabilityService.updateUnavailability(
        doctorId, 
        unavailabilityId, 
        updateData
      );

      res.json({
        success: true,
        unavailability,
        message: 'Unavailability updated successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteUnavailability(req, res) {
    try {
      const { doctorId, unavailabilityId } = req.params;

      await this.availabilityService.deleteUnavailability(doctorId, unavailabilityId);

      res.json({
        success: true,
        message: 'Unavailability deleted successfully',
        timezoneContext: {
          doctorTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // NEW: Get doctor's unavailability periods
  async getUnavailability(req, res) {
    try {
      const { doctorId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const unavailability = await this.availabilityService.findUnavailabilityByDoctor(
        doctorId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        unavailability,
        dateRange: { startDate, endDate },
        timezoneContext: {
          userTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // NEW: Get availability summary with timezone info
  async getAvailabilitySummary(req, res) {
    try {
      const { doctorId } = req.params;
      const { startDate, endDate, timezone } = req.query;

      const targetTimezone = timezone || req.userTimezone;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required for availability summary'
        });
      }

      // Get availability for each date in range
      const dateRange = this.getDateRange(startDate, endDate);
      const availabilitySummary = [];

      for (const date of dateRange) {
        try {
          const slots = await this.availabilityService.getAvailableSlots(
            doctorId,
            date,
            targetTimezone,
            req
          );
          
          availabilitySummary.push({
            date,
            dayOfWeek: slots.dayOfWeek,
            availableCount: slots.availableCount,
            totalSlots: slots.totalSlots,
            hasAvailability: slots.availableCount > 0,
            firstAvailableTime: slots.availableSlots[0] || null,
            lastAvailableTime: slots.availableSlots[slots.availableSlots.length - 1] || null
          });
        } catch (error) {
          availabilitySummary.push({
            date,
            error: error.message,
            hasAvailability: false
          });
        }
      }

      res.json({
        success: true,
        summary: availabilitySummary,
        dateRange: { startDate, endDate },
        totalDays: dateRange.length,
        daysWithAvailability: availabilitySummary.filter(day => day.hasAvailability).length,
        timezoneContext: {
          targetTimezone,
          userTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Utility method to convert time for display
  convertTimeForDisplay(time, fromTimezone, toTimezone) {
    try {
      // Use today's date as reference for time conversion
      const today = new Date().toISOString().split('T')[0];
      const utcTime = TimezoneService.convertToUTC(today, time, fromTimezone);
      const convertedTime = TimezoneService.convertFromUTC(utcTime, toTimezone);
      return convertedTime.time;
    } catch (error) {
      console.error('Error converting time for display:', error);
      return time; // Return original time if conversion fails
    }
  }

  // Utility method to generate date range
  getDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    while (currentDate <= lastDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }
}

module.exports = DoctorAvailabilityController;