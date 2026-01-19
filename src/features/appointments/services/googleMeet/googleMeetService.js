// ===================================
// src/services/GoogleMeetService.js
// ===================================
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');


class GoogleMeetService {
  constructor() {

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_APPOINTMENT_URI
    );

    this.calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client
    });

    // Required scopes for Google Meet integration
    this.scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
  }

  /**
   * Get Google OAuth authorization URL for doctor
   */
  getAuthUrl(doctorId, state = null) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent',
      state: state || doctorId // Use doctorId as state for callback identification
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(authCode) {
    try {
      const { tokens } = await this.oauth2Client.getToken(authCode);
      return {
        success: true,
        tokens
      };
    } catch (error) {
      console.error('Error exchanging auth code:', error);
      return {
        success: false,
        error: `Failed to exchange auth code: ${error.message}`
      };
    }
  }

  /**
   * Set credentials for the OAuth client
   */
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(refreshToken) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return {
        success: true,
        credentials
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      return {
        success: false,
        error: `Failed to refresh token: ${error.message}`
      };
    }
  }

  /**
   * Create Google Meet appointment
   * @param {Object} appointmentData - Appointment details
   * @param {Object} doctorData - Doctor information
   * @param {Object} patientData - Patient information
   * @param {Object} doctorTokens - Doctor's Google OAuth tokens
   */
  async createMeetingForAppointment(appointmentData, doctorData, patientData, doctorTokens) {
    try {
      // Set up OAuth credentials
      this.setCredentials(doctorTokens);

      // Check if tokens need refresh
      if (doctorTokens.refresh_token && this.isTokenExpired(doctorTokens)) {
        const refreshResult = await this.refreshTokenIfNeeded(doctorTokens.refresh_token);
        if (!refreshResult.success) {
          throw new Error('Failed to refresh expired tokens');
        }
        // Update tokens
        doctorTokens = refreshResult.credentials;
        this.setCredentials(doctorTokens);
      }

      // Parse appointment time and create Date objects
      const startDateTime = this.parseAppointmentDateTime(
        appointmentData.appointmentDate,
        appointmentData.appointmentTime,
        appointmentData.timezone || doctorData.timezone || 'UTC'
      );

      const endDateTime = this.calculateEndDateTime(
        startDateTime,
        appointmentData.duration || 30
      );

      // Generate unique request ID for conference
      const conferenceRequestId = `meet_${appointmentData.id}_${Date.now()}`;

      // Create calendar event with Google Meet
      const event = {
        summary: `Medical Consultation - ${appointmentData.reason}`,
        description: this.generateEventDescription(appointmentData, doctorData, patientData),
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: appointmentData.timezone || doctorData.timezone || 'UTC',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: appointmentData.timezone || doctorData.timezone || 'UTC',
        },
        attendees: [
          {
            email: doctorData.email,
            displayName: `Dr. ${doctorData.name}`,
            responseStatus: 'accepted',
            organizer: true
          },
          {
            email: patientData.email,
            displayName: patientData.name,
            responseStatus: 'needsAction'
          }
        ],
        conferenceData: {
          createRequest: {
            requestId: conferenceRequestId,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'email', minutes: 60 }, // 1 hour before
            { method: 'popup', minutes: 15 } // 15 minutes before
          ]
        },
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: false,
        // Security settings
        privateCopy: false,
        locked: true,
        // Add appointment metadata
        extendedProperties: {
          private: {
            appointmentId: appointmentData.id,
            appointmentType: appointmentData.type,
            priority: appointmentData.priority
          }
        }
      };

      // Create the event with conference data
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1,
        sendNotifications: true,
        sendUpdates: 'all'
      });

      // Extract meeting information
      const meetingData = this.extractMeetingData(response.data);

      // Log successful creation
      console.log(`✅ Google Meet created for appointment ${appointmentData.id}:`, {
        meetingLink: meetingData.meetingLink,
        calendarEventId: meetingData.calendarEventId
      });

      return {
        success: true,
        ...meetingData,
        refreshedTokens: doctorTokens // Return potentially refreshed tokens
      };

    } catch (error) {
      console.error('❌ Error creating Google Meet:', error);
      return {
        success: false,
        error: `Failed to create Google Meet: ${error.message}`
      };
    }
  }

  /**
   * Update existing Google Meet appointment
   */
  async updateMeetingForAppointment(calendarEventId, appointmentData, doctorTokens) {
    try {
      this.setCredentials(doctorTokens);

      const startDateTime = this.parseAppointmentDateTime(
        appointmentData.appointmentDate,
        appointmentData.appointmentTime,
        appointmentData.timezone
      );

      const endDateTime = this.calculateEndDateTime(
        startDateTime,
        appointmentData.duration
      );

      const updatedEvent = {
        summary: `Medical Consultation - ${appointmentData.reason}`,
        description: appointmentData.notes || 'Updated medical consultation',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: appointmentData.timezone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: appointmentData.timezone,
        }
      };

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: calendarEventId,
        resource: updatedEvent,
        sendNotifications: true,
        sendUpdates: 'all'
      });

      return {
        success: true,
        ...this.extractMeetingData(response.data)
      };

    } catch (error) {
      console.error('❌ Error updating Google Meet:', error);
      return {
        success: false,
        error: `Failed to update Google Meet: ${error.message}`
      };
    }
  }

  /**
   * Cancel Google Meet appointment
   */
  async cancelMeetingForAppointment(calendarEventId, cancellationReason, doctorTokens) {
    try {
      this.setCredentials(doctorTokens);

      // Update event as cancelled
      const cancelledEvent = {
        status: 'cancelled',
        summary: '[CANCELLED] Medical Consultation',
        description: `This appointment has been cancelled.\nReason: ${cancellationReason}`
      };

      await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: calendarEventId,
        resource: cancelledEvent,
        sendNotifications: true,
        sendUpdates: 'all'
      });

      return {
        success: true,
        message: 'Google Meet cancelled successfully'
      };

    } catch (error) {
      console.error('❌ Error cancelling Google Meet:', error);
      return {
        success: false,
        error: `Failed to cancel Google Meet: ${error.message}`
      };
    }
  }

  /**
   * Get meeting details by calendar event ID
   */
  async getMeetingDetails(calendarEventId, doctorTokens) {
    try {
      this.setCredentials(doctorTokens);

      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: calendarEventId
      });

      return {
        success: true,
        ...this.extractMeetingData(response.data)
      };

    } catch (error) {
      console.error('❌ Error fetching meeting details:', error);
      return {
        success: false,
        error: `Failed to fetch meeting details: ${error.message}`
      };
    }
  }

  /**
   * Parse appointment date and time into Date object
   */
  parseAppointmentDateTime(appointmentDate, appointmentTime, timezone = 'UTC') {
    // appointmentDate format: "2025-06-20"
    // appointmentTime format: "14:00"
    const dateTimeString = `${appointmentDate}T${appointmentTime}:00`;
    return new Date(dateTimeString);
  }

  /**
   * Calculate end date time based on duration
   */
  calculateEndDateTime(startDateTime, durationInMinutes) {
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + durationInMinutes);
    return endDateTime;
  }

  /**
   * Generate event description
   */
  generateEventDescription(appointmentData, doctorData, patientData) {
    return `
      Medical Consultation Details:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━

        👩‍⚕️ Doctor: Dr. ${doctorData.name}
        📋 Specialization: ${doctorData.specialization || 'General Practice'}
        📧 Doctor Email: ${doctorData.email}

        👤 Patient: ${patientData.name}
        📧 Patient Email: ${patientData.email}
        ${patientData.phone ? `📞 Patient Phone: ${patientData.phone}` : ''}

        🏥 Consultation Type: ${appointmentData.type}
        ⚡ Priority: ${appointmentData.priority}
        🎯 Reason: ${appointmentData.reason}

        ${appointmentData.symptoms && appointmentData.symptoms.length > 0 ?
          `🔍 Reported Symptoms: ${appointmentData.symptoms.join(', ')}` :
          ''
        }

        ${appointmentData.notes ? `📝 Notes: ${appointmentData.notes}` : ''}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━

        💻 This is a virtual consultation via Google Meet
        🔒 This meeting is private and confidential
        ⏰ Duration: ${appointmentData.duration} minutes
        💰 Consultation Fee: $${appointmentData.consultationFee}

        📋 Appointment ID: ${appointmentData.id}

        For technical support, contact: support@yourplatform.com
            `.trim();
  }

  /**
   * Extract meeting data from Google Calendar API response
   */
  extractMeetingData(eventData) {
    const conferenceData = eventData.conferenceData;

    if (!conferenceData || !conferenceData.entryPoints) {
      throw new Error('No Google Meet conference data found in event');
    }

    // Find the video entry point (Google Meet link)
    const videoEntryPoint = conferenceData.entryPoints.find(
      entry => entry.entryPointType === 'video'
    );

    if (!videoEntryPoint) {
      throw new Error('No video entry point found in conference data');
    }

    return {
      meetingProvider: 'google',
      meetingLink: videoEntryPoint.uri,
      googleMeetCode: conferenceData.conferenceId,
      calendarEventId: eventData.id,
      hangoutLink: videoEntryPoint.uri,
      meetingId: conferenceData.conferenceId,
      eventStatus: eventData.status,
      eventHtmlLink: eventData.htmlLink,
      created: eventData.created,
      updated: eventData.updated,
      startTime: eventData.start?.dateTime,
      endTime: eventData.end?.dateTime
    };
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokens) {
    if (!tokens.expiry_date) return false;
    return Date.now() >= tokens.expiry_date;
  }

  /**
   * Validate doctor has necessary Google permissions
   */
  async validateDoctorPermissions(doctorTokens) {
    try {
      this.setCredentials(doctorTokens);

      // Test calendar access
      await this.calendar.calendarList.list({
        maxResults: 1
      });

      return {
        valid: true,
        message: 'Google permissions are valid'
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        needsReauth: error.code === 401 || error.code === 403
      };
    }
  }

  /**
   * Generate meeting join instructions for patients
   */
  generateJoinInstructions(meetingData, appointmentData) {
    return {
      title: 'How to Join Your Medical Consultation',
      appointmentId: appointmentData.id,
      appointmentDateTime: `${appointmentData.appointmentDate} at ${appointmentData.appointmentTime}`,
      meetingDetails: {
        provider: 'Google Meet',
        meetingLink: meetingData.meetingLink,
        meetingCode: meetingData.googleMeetCode
      },
      instructions: [
        {
          step: 1,
          title: 'Click the meeting link 5-10 minutes before your appointment',
          description: `Click this link to join: ${meetingData.meetingLink}`,
          timing: '5-10 minutes before your appointment'
        },
        {
          step: 2,
          title: 'Allow camera and microphone access',
          description: 'Your browser will ask for permission to use your camera and microphone. Please allow both for the best consultation experience.',
          timing: 'When prompted by your browser'
        },
        {
          step: 3,
          title: 'Wait for the doctor to join',
          description: 'You may need to wait in a virtual waiting room until the doctor joins the meeting.',
          timing: 'During the appointment time'
        },
        {
          step: 4,
          title: 'Alternative access method',
          description: `If the link doesn't work, go to meet.google.com and enter meeting code: ${meetingData.googleMeetCode}`,
          timing: 'If needed'
        }
      ],
      technicalRequirements: [
        'Stable internet connection (minimum 1 Mbps upload/download)',
        'Updated web browser (Chrome, Firefox, Safari, Edge)',
        'Camera and microphone (built-in or external)',
        'Quiet, private space for consultation',
        'Good lighting for video quality'
      ],
      troubleshooting: [
        {
          issue: 'Camera/microphone not working',
          solution: 'Check browser permissions and ensure no other apps are using your camera/microphone'
        },
        {
          issue: 'Poor video/audio quality',
          solution: 'Close other applications, move closer to your router, or use wired internet connection'
        },
        {
          issue: 'Cannot join meeting',
          solution: 'Try refreshing the page, clearing browser cache, or using the meeting code instead'
        }
      ],
      supportContact: 'For technical issues during your appointment, contact our support team at support@yourplatform.com or call +1-XXX-XXX-XXXX'
    };
  }
}

module.exports = GoogleMeetService;


// ===================================
// Usage Example and Installation
// ===================================

/*
INSTALLATION STEPS:

1. Install Google APIs client:
   npm install googleapis

2. Set up Google Cloud Project:
   - Create project in Google Cloud Console
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

3. Environment Variables (.env):
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

4. Update your main app.js to include auth routes:
   const authRoutes = require('./routes/AuthRoutes');
   app.use('/auth', authRoutes);

USAGE FLOW:

1. Doctor Authentication:
   GET /auth/google/doctors/{doctorId}
   -> Redirects to Google OAuth
   -> User grants permissions
   -> Redirects back to /auth/google/callback
   -> Tokens stored for doctor

2. Create Appointment with Google Meet (Auto-generated):
   POST /api/appointments
   {
     "patientId": "uuid",
     "doctorId": "uuid",
     "appointmentDate": "2025-06-25",
     "appointmentTime": "14:30",
     "reason": "Consultation",
     "consultationFee": 150.00
   }
   -> Payment completed
   -> Google Meet link automatically generated (if doctor authenticated)

3. Manual Google Meet Generation:
   POST /api/appointments/{id}/meeting/google
   {
     "doctorId": "uuid"
   }

SUCCESS RESPONSE:
{
  "success": true,
  "meetingData": {
    "meetingProvider": "google",
    "meetingLink": "https://meet.google.com/abc-defg-hij",
    "googleMeetCode": "abc-defg-hij",
    "calendarEventId": "google_cal_event_123"
  },
  "joinInstructions": {
    "title": "How to Join Your Medical Consultation",
    "instructions": [...],
    "technicalRequirements": [...],
    "troubleshooting": [...]
  }
}

ERROR RESPONSES:
{
  "success": false,
  "error": "Doctor must authenticate with Google first",
  "requiresAuth": true,
  "authUrl": "https://accounts.google.com/oauth/authorize?..."
}

SECURITY FEATURES:
✅ OAuth 2.0 authentication
✅ Token refresh handling
✅ Encrypted token storage
✅ Meeting access control
✅ Automatic calendar integration
✅ Email notifications
✅ Meeting security settings
✅ Privacy controls
*/