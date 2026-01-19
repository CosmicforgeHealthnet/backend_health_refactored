// ===================================
// src/services/ZoomMeetingService.js (Updated)
// ===================================
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { isValid, parse, parseISO, formatISO } = require("date-fns"); // Add date-fns for robust date handling

const ZoomOAuthService = require("./zoomOAuthService");

class ZoomMeetingService extends ZoomOAuthService {
  constructor() {
    super(); // Initialize OAuth service
  }

  /**
   * Create Zoom meeting for appointment
   * @param {Object} appointmentData - Appointment details
   * @param {Object} doctorData - Doctor information
   * @param {Object} patientData - Patient information
   */
  async createMeetingForAppointment(appointmentData, doctorData, patientData) {
    try {
      // Parse appointment time and create Date objects
      const startDateTime = this.parseAppointmentDateTime(
        appointmentData.appointmentDate,
        appointmentData.appointmentTime,
        appointmentData.timezone || doctorData.timezone || "UTC"
      );

      // Create meeting payload
      const meetingPayload = {
        topic: `Medical Consultation - ${appointmentData.reason}`,
        type: 2, // Scheduled meeting
        start_time: startDateTime.toISOString(),
        duration: appointmentData.duration || 30,
        timezone: appointmentData.timezone || doctorData.timezone || "UTC",
        password: this.generateMeetingPassword(),
        agenda: this.generateMeetingAgenda(
          appointmentData,
          doctorData,
          patientData
        ),
        settings: {
          host_video: true,
          participant_video: true,
          cn_meeting: false,
          in_meeting: false,
          join_before_host: true,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 0, // Automatically approve
          registration_type: 1,
          audio: "both",
          auto_recording: "none", // No automatic recording for privacy
          enforce_login: false,
          enforce_login_domains: "",
          alternative_hosts: "",
          close_registration: false,
          show_share_button: true,
          allow_multiple_devices: false,
          registrants_confirmation_email: true,
          waiting_room: false, // Enable waiting room for security
          registrants_email_notification: true,
          meeting_authentication: false,
          encryption_type: "enhanced_encryption",
          approved_or_denied_countries_or_regions: {
            enable: false,
          },
          breakout_room: {
            enable: false,
          },
          internal_meeting: false,
          continuous_meeting_chat: {
            enable: false,
            auto_add_invited_external_users: false,
          },
          participant_focused_meeting: false,
          push_change_to_calendar: false,
          resources: [],
          auto_start_meeting_summary: false,
          auto_start_ai_companion_questions: false,
        },
        recurrence: null, // One-time meeting
        template_id: null
      };

      // Get headers with OAuth token
      const headers = await this.getZoomHeaders();

      // Use 'me' as the user ID for Server-to-Server OAuth
      const userId = "me";

      // Create meeting via Zoom API
      const response = await axios.post(
        `${this.baseURL}/users/${userId}/meetings`,
        meetingPayload,
        { headers }
      );

      const meetingData = this.extractMeetingData(response.data);

      // Log successful creation
      console.log(
        `✅ Zoom meeting created for appointment ${appointmentData.id}:`,
        {
          meetingId: meetingData.zoomMeetingId,
          joinUrl: meetingData.meetingLink,
        }
      );

      return {
        success: true,
        ...meetingData,
      };
    } catch (error) {
      console.error(
        "❌ Error creating Zoom meeting:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: `Failed to create Zoom meeting: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  }

  /**
   * Update existing Zoom meeting
   */
  async updateMeetingForAppointment(
    zoomMeetingId,
    appointmentData,
    doctorData
  ) {
    try {
      const startDateTime = this.parseAppointmentDateTime(
        appointmentData.appointmentDate,
        appointmentData.appointmentTime,
        appointmentData.timezone || doctorData.timezone || "UTC"
      );

      const updatePayload = {
        topic: `Medical Consultation - ${appointmentData.reason}`,
        start_time: startDateTime.toISOString(),
        duration: appointmentData.duration || 30,
        timezone: appointmentData.timezone || doctorData.timezone || "UTC",
        agenda: appointmentData.notes || "Updated medical consultation",
      };

      const headers = await this.getZoomHeaders();

      const response = await axios.patch(
        `${this.baseURL}/meetings/${zoomMeetingId}`,
        updatePayload,
        { headers }
      );

      return {
        success: true,
        message: "Zoom meeting updated successfully",
        meetingId: zoomMeetingId,
      };
    } catch (error) {
      console.error(
        "❌ Error updating Zoom meeting:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: `Failed to update Zoom meeting: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  }

  /**
   * Cancel/Delete Zoom meeting
   */
  async cancelMeetingForAppointment(zoomMeetingId, cancellationReason) {
    try {
      const headers = await this.getZoomHeaders();

      await axios.delete(`${this.baseURL}/meetings/${zoomMeetingId}`, {
        headers,
      });

      return {
        success: true,
        message: "Zoom meeting cancelled successfully",
      };
    } catch (error) {
      console.error(
        "❌ Error cancelling Zoom meeting:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: `Failed to cancel Zoom meeting: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  }

  /**
   * Get Zoom meeting details
   */
  async getMeetingDetails(zoomMeetingId) {
    try {
      const headers = await this.getZoomHeaders();

      const response = await axios.get(
        `${this.baseURL}/meetings/${zoomMeetingId}`,
        { headers }
      );

      return {
        success: true,
        ...this.extractMeetingData(response.data),
      };
    } catch (error) {
      console.error(
        "❌ Error fetching Zoom meeting details:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: `Failed to fetch Zoom meeting details: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  }

  /**
   * List all meetings for debugging
   */
  async listMeetings() {
    try {
      const headers = await this.getZoomHeaders();

      const response = await axios.get(`${this.baseURL}/users/me/meetings`, {
        headers,
      });

      return {
        success: true,
        meetings: response.data.meetings,
      };
    } catch (error) {
      console.error(
        "❌ Error listing meetings:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: `Failed to list meetings: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  }

  validateAppointmentDateTime(appointmentDate, appointmentTime) {
    if (!appointmentDate || !appointmentTime) {
      throw new Error("Appointment date and time are required");
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(appointmentDate)) {
      throw new Error("Appointment date must be in YYYY-MM-DD format");
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(appointmentTime)) {
      throw new Error("Appointment time must be in HH:MM:SS format (24-hour)");
    }

    // Validate that the date is not in the past
    const now = new Date();
    const appointmentDateTime = parseISO(
      `${appointmentDate} ${appointmentTime}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );
    if (!isValid(appointmentDateTime)) {
      throw new Error(
        `Invalid date/time: ${appointmentDate} ${appointmentTime}`
      );
    }
    if (appointmentDateTime < now) {
      throw new Error("Appointment date/time cannot be in the past");
    }
    return true;
  }

  /**
   * Parse appointment date and time into Date object
   * @param {string} appointmentDate - Date in YYYY-MM-DD format
   * @param {string} appointmentTime - Time in HH:MM format
   * @param {string} timezone - Timezone (e.g., 'UTC')
   * @returns {Date} - Parsed Date object
   */
  parseAppointmentDateTime(appointmentDate, appointmentTime, timezone = "UTC") {
    try {
      // Validate inputs
      this.validateAppointmentDateTime(appointmentDate, appointmentTime);

      // Parse date and time using date-fns
      const dateTimeString = `${appointmentDate} ${appointmentTime}`;
      const parsedDate = parse(
        dateTimeString,
        "yyyy-MM-dd HH:mm:ss",
        new Date()
      );

      if (!isValid(parsedDate)) {
        throw new Error(`Invalid date/time format: ${dateTimeString}`);
      }

      // Return ISO string for Zoom API
      return parsedDate;
    } catch (error) {
      throw new Error(`Failed to parse date/time: ${error.message}`);
    }
  }

  /**
   * Generate secure meeting password
   */
  generateMeetingPassword() {
    // Generate 6-digit numeric password
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate meeting agenda
   */
  generateMeetingAgenda(appointmentData, doctorData, patientData) {
    return `
Medical Consultation Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━

👩‍⚕️ Doctor: Dr. ${doctorData?.name}
📋 Specialization: ${doctorData?.specialization || "General Practice"}
👤 Patient: ${patientData?.name}
🏥 Consultation Type: ${appointmentData.type}
⚡ Priority: ${appointmentData.priority}
🎯 Reason: ${appointmentData.reason}

${
  appointmentData.symptoms && appointmentData.symptoms.length > 0
    ? `🔍 Reported Symptoms: ${appointmentData.symptoms.join(", ")}`
    : ""
}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💻 Virtual consultation via Zoom
🔒 This meeting is private and confidential
⏰ Duration: ${appointmentData.duration} minutes
💰 Consultation Fee: $${appointmentData.consultationFee}

📋 Appointment ID: ${appointmentData.id}
    `.trim();
  }

  /**
   * Extract meeting data from Zoom API response
   */
  extractMeetingData(zoomResponse) {
    return {
      meetingProvider: "zoom",
      meetingLink: zoomResponse.join_url,
      zoomMeetingId: zoomResponse.id.toString(),
      meetingId: zoomResponse.id.toString(),
      meetingPassword: zoomResponse.password,
      hostKey: zoomResponse.host_id,
      startUrl: zoomResponse.start_url,
      joinUrl: zoomResponse.join_url,
      topic: zoomResponse.topic,
      status: zoomResponse.status,
      startTime: zoomResponse.start_time,
      duration: zoomResponse.duration,
      timezone: zoomResponse.timezone,
      agenda: zoomResponse.agenda,
      created: zoomResponse.created_at,
      uuid: zoomResponse.uuid,
    };
  }

  /**
   * Generate meeting join instructions for patients
   */
  generateJoinInstructions(meetingData, appointmentData) {
    return {
      title: "How to Join Your Medical Consultation via Zoom",
      appointmentId: appointmentData.id,
      appointmentDateTime: `${appointmentData.appointmentDate} at ${appointmentData.appointmentTime}`,
      meetingDetails: {
        provider: "Zoom",
        meetingLink: meetingData.meetingLink,
        meetingId: meetingData.zoomMeetingId,
        password: meetingData.meetingPassword,
      },
      instructions: [
        {
          step: 1,
          title: "Click the meeting link 5-10 minutes before your appointment",
          description: `Click this link to join: ${meetingData.meetingLink}`,
          timing: "5-10 minutes before your appointment",
        },
        {
          step: 2,
          title: "Download Zoom if prompted",
          description:
            "If you don't have Zoom installed, you'll be prompted to download it. You can also join via web browser.",
          timing: "When first joining",
        },
        {
          step: 3,
          title: "Enter meeting password if required",
          description: `Meeting Password: ${meetingData.meetingPassword}`,
          timing: "When joining the meeting",
        },
        {
          step: 4,
          title: "Wait in the waiting room",
          description:
            "You'll be placed in a waiting room until the doctor admits you to the meeting.",
          timing: "After joining",
        },
        {
          step: 5,
          title: "Alternative access method",
          description: `If the link doesn't work, open Zoom and enter Meeting ID: ${meetingData.zoomMeetingId}`,
          timing: "If needed",
        },
      ],
      technicalRequirements: [
        "Stable internet connection (minimum 1.5 Mbps upload/download)",
        "Zoom app installed or updated web browser",
        "Camera and microphone (built-in or external)",
        "Quiet, private space for consultation",
        "Good lighting for video quality",
      ],
      troubleshooting: [
        {
          issue: "Cannot join meeting",
          solution:
            "Ensure Zoom is installed, check your internet connection, or try joining via web browser",
        },
        {
          issue: "Audio/video not working",
          solution:
            "Check Zoom permissions for camera and microphone in your device settings",
        },
        {
          issue: "Poor video/audio quality",
          solution:
            "Close other applications, move closer to your router, or use wired internet connection",
        },
        {
          issue: "Forgot meeting password",
          solution: `Your meeting password is: ${meetingData.meetingPassword}`,
        },
      ],
      supportContact:
        "For technical issues during your appointment, contact our support team at support@yourplatform.com or call +1-XXX-XXX-XXXX",
    };
  }

  /**
   * End a live Zoom meeting immediately
   * @param {string} zoomMeetingId - The Zoom meeting ID
   * @param {string} endReason - Reason for ending the meeting (optional)
   * @returns {Object} - Success/failure response
   */
  async endLiveMeeting(zoomMeetingId, endReason = "Meeting ended by system") {
    try {
      const headers = await this.getZoomHeaders();

      // First, check if the meeting is currently live
      const meetingStatus = await this.getMeetingStatus(zoomMeetingId);

      if (!meetingStatus.success) {
        return {
          success: false,
          error: "Could not retrieve meeting status",
          details: meetingStatus.error,
        };
      }

      // If meeting is not live, return appropriate message
      if (meetingStatus.status !== "started") {
        return {
          success: false,
          error: `Meeting is not currently live. Status: ${meetingStatus.status}`,
          meetingStatus: meetingStatus.status,
        };
      }

      // End the live meeting using Zoom's PATCH endpoint to update meeting status
      const endMeetingPayload = {
        action: "end",
      };

      const response = await axios.patch(
        `${this.baseURL}/meetings/${zoomMeetingId}/status`,
        endMeetingPayload,
        { headers }
      );

      console.log(
        `✅ Zoom meeting ${zoomMeetingId} ended successfully. Reason: ${endReason}`
      );

      return {
        success: true,
        message: "Live meeting ended successfully",
        meetingId: zoomMeetingId,
        endReason: endReason,
        endedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `❌ Error ending Zoom meeting ${zoomMeetingId}:`,
        error.response?.data || error.message
      );

      // Handle specific Zoom API errors
      if (error.response?.status === 404) {
        return {
          success: false,
          error: "Meeting not found or already ended",
          meetingId: zoomMeetingId,
        };
      }

      if (error.response?.status === 400) {
        return {
          success: false,
          error: "Meeting cannot be ended (may not be live or already ended)",
          details: error.response.data?.message || "Bad request",
        };
      }

      return {
        success: false,
        error: `Failed to end live meeting: ${
          error.response?.data?.message || error.message
        }`,
        meetingId: zoomMeetingId,
      };
    }
  }

  /**
   * Get current status of a Zoom meeting
   * @param {string} zoomMeetingId - The Zoom meeting ID
   * @returns {Object} - Meeting status information
   */
  async getMeetingStatus(zoomMeetingId) {
    try {
      const headers = await this.getZoomHeaders();

      const response = await axios.get(
        `${this.baseURL}/meetings/${zoomMeetingId}`,
        { headers }
      );

      return {
        success: true,
        status: response.data.status,
        meetingId: zoomMeetingId,
        startTime: response.data.start_time,
        duration: response.data.duration,
        topic: response.data.topic,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get meeting status: ${
          error.response?.data?.message || error.message
        }`,
        meetingId: zoomMeetingId,
      };
    }
  }

  /**
   * End meeting and kick all participants (alternative method)
   * @param {string} zoomMeetingId - The Zoom meeting ID
   * @param {string} endReason - Reason for ending the meeting
   * @returns {Object} - Success/failure response
   */
  async forceEndMeetingAndKickParticipants(
    zoomMeetingId,
    endReason = "Meeting force-ended by system"
  ) {
    try {
      const headers = await this.getZoomHeaders();

      // Get list of current participants
      const participantsResponse = await axios.get(
        `${this.baseURL}/meetings/${zoomMeetingId}/participants`,
        { headers }
      );

      const participants = participantsResponse.data.participants || [];

      if (participants.length === 0) {
        return {
          success: true,
          message: "No participants found, meeting may already be ended",
          meetingId: zoomMeetingId,
        };
      }

      // Remove all participants from the meeting
      const removePromises = participants.map((participant) =>
        axios
          .patch(
            `${this.baseURL}/meetings/${zoomMeetingId}/participants/${participant.id}/status`,
            { action: "remove" },
            { headers }
          )
          .catch((error) => {
            console.warn(
              `Warning: Could not remove participant ${participant.id}:`,
              error.message
            );
            return null; // Continue with other participants
          })
      );

      await Promise.allSettled(removePromises);

      console.log(
        `✅ All participants removed from meeting ${zoomMeetingId}. Reason: ${endReason}`
      );

      return {
        success: true,
        message: "All participants removed from meeting",
        meetingId: zoomMeetingId,
        participantsRemoved: participants.length,
        endReason: endReason,
        endedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `❌ Error force-ending meeting ${zoomMeetingId}:`,
        error.response?.data || error.message
      );

      return {
        success: false,
        error: `Failed to force-end meeting: ${
          error.response?.data?.message || error.message
        }`,
        meetingId: zoomMeetingId,
      };
    }
  }

  /**
   * End meeting with notification to participants (recommended for appointments)
   * @param {string} zoomMeetingId - The Zoom meeting ID
   * @param {string} endReason - Reason for ending the meeting
   * @param {number} warningSeconds - Seconds to wait before ending (default: 30)
   * @returns {Object} - Success/failure response
   */
  async endMeetingWithWarning(
    zoomMeetingId,
    endReason = "Appointment duration completed",
    warningSeconds = 30
  ) {
    try {
      const headers = await this.getZoomHeaders();

      // First, send a message to all participants (if chat is enabled)
      const warningMessage = {
        message: `⚠️ This consultation will end in ${warningSeconds} seconds. ${endReason}`,
        to_all: true,
      };

      try {
        await axios.post(
          `${this.baseURL}/meetings/${zoomMeetingId}/chat`,
          warningMessage,
          { headers }
        );
        console.log(`📢 Warning message sent to meeting ${zoomMeetingId}`);
      } catch (chatError) {
        console.warn("Could not send warning message:", chatError.message);
        // Continue anyway
      }

      // Wait for the specified warning period
      if (warningSeconds > 0) {
        console.log(
          `⏳ Waiting ${warningSeconds} seconds before ending meeting...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, warningSeconds * 1000)
        );
      }

      // Now end the meeting
      const endResult = await this.endLiveMeeting(zoomMeetingId, endReason);

      if (endResult.success) {
        console.log(
          `✅ Meeting ${zoomMeetingId} ended gracefully after ${warningSeconds}s warning`
        );
      }

      return endResult;
    } catch (error) {
      console.error(`❌ Error ending meeting with warning:`, error.message);

      // Fallback to immediate ending
      return await this.endLiveMeeting(zoomMeetingId, endReason);
    }
  }
}

module.exports = ZoomMeetingService;