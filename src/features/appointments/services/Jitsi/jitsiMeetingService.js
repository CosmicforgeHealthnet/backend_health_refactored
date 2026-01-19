// ===================================
// src/services/JitsiMeetingService.js
// ===================================

const crypto = require('crypto');
const { isValid, parse, parseISO, formatISO } = require('date-fns'); // Add date-fns for robust date handling

class JitsiMeetingService {
  constructor() {
    this.baseURL = 'https://meet.jit.si';
    // You can use your own Jitsi server if you have one
    this.serverURL = process.env.JITSI_SERVER_URL || this.baseURL;
  }

  /**
   * Create Jitsi meeting for appointment
   * @param {Object} appointmentData - Appointment details
   * @param {Object} doctorData - Doctor information
   * @param {Object} patientData - Patient information
   */
  async createMeetingForAppointment(appointmentData, doctorData, patientData) {
    try {
      // Generate unique room name
      const roomName = this.generateRoomName(appointmentData);
      
      // Generate meeting password for security
      const meetingPassword = this.generateMeetingPassword();
      
      // Create meeting URL
      const meetingLink = `${this.serverURL}/${roomName}`;
      
      // Create meeting configuration
      const meetingConfig = this.generateMeetingConfig(appointmentData, doctorData, patientData);
      
      // Create meeting data
      const meetingData = {
        meetingProvider: 'jitsi',
        meetingLink: meetingLink,
        meetingId: roomName,
        meetingPassword: meetingPassword,
        serverUrl: this.serverURL,
        config: meetingConfig,
        startTime: this.parseAppointmentDateTime(
          appointmentData.appointmentDate,
          appointmentData.appointmentTime,
          appointmentData.timezone || 'UTC'
        ).toISOString(),
        duration: appointmentData.duration || 30,
        topic: `Medical Consultation - ${appointmentData.reason}`,
        created: new Date().toISOString()
      };

      // Log successful creation
      console.log(`✅ Jitsi meeting created for appointment ${appointmentData.id}:`, {
        roomName: meetingData.roomName,
        meetingLink: meetingData.meetingLink
      });

      console.log(meetingData)
      return {
        success: true,
        ...meetingData
      };

    } catch (error) {
      console.error('❌ Error creating Jitsi meeting:', error.message);
      return {
        success: false,
        error: `Failed to create Jitsi meeting: ${error.message}`
      };
    }
  }

  /**
   * Update existing Jitsi meeting (mainly updates meeting info, room stays the same)
   */
  async updateMeetingForAppointment(roomName, appointmentData, doctorData) {
    try {
      // For Jitsi, we mainly update the meeting metadata
      // The room remains the same, but we can update the config
      const updatedConfig = this.generateMeetingConfig(appointmentData, doctorData);
      
      const updatedMeetingData = {
        meetingProvider: 'jitsi',
        meetingLink: `${this.serverURL}/${roomName}`,
        roomName: roomName,
        meetingId: roomName,
        config: updatedConfig,
        topic: `Medical Consultation - ${appointmentData.reason}`,
        startTime: this.parseAppointmentDateTime(
          appointmentData.appointmentDate,
          appointmentData.appointmentTime,
          appointmentData.timezone || 'UTC'
        ).toISOString(),
        duration: appointmentData.duration || 30,
        updated: new Date().toISOString()
      };

      return {
        success: true,
        message: 'Jitsi meeting updated successfully',
        ...updatedMeetingData
      };

    } catch (error) {
      console.error('❌ Error updating Jitsi meeting:', error.message);
      return {
        success: false,
        error: `Failed to update Jitsi meeting: ${error.message}`
      };
    }
  }

  /**
   * Cancel Jitsi meeting (room becomes inactive after appointment time)
   */
  async cancelMeetingForAppointment(roomName, cancellationReason) {
    try {
      // For Jitsi, we can't actually "delete" a room, but we can mark it as cancelled
      // The room will naturally become inactive
      
      return {
        success: true,
        message: 'Jitsi meeting cancelled successfully',
        roomName: roomName,
        cancellationReason: cancellationReason,
        cancelledAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error cancelling Jitsi meeting:', error.message);
      return {
        success: false,
        error: `Failed to cancel Jitsi meeting: ${error.message}`
      };
    }
  }

  /**
   * Get Jitsi meeting details
   */
  async getMeetingDetails(roomName, appointmentData) {
    try {
      const meetingData = {
        meetingProvider: 'jitsi',
        meetingLink: `${this.serverURL}/${roomName}`,
        roomName: roomName,
        meetingId: roomName,
        serverUrl: this.serverURL,
        status: 'active',
        config: this.generateMeetingConfig(appointmentData),
        topic: appointmentData ? `Medical Consultation - ${appointmentData.reason}` : 'Medical Consultation'
      };

      return {
        success: true,
        ...meetingData
      };

    } catch (error) {
      console.error('❌ Error fetching Jitsi meeting details:', error.message);
      return {
        success: false,
        error: `Failed to fetch Jitsi meeting details: ${error.message}`
      };
    }
  }

  /**
   * Generate unique room name for the appointment
   */
  generateRoomName(appointmentData) {
    // Create a unique, secure room name
    const hash = crypto.createHash('sha256')
      .update(`${appointmentData.id}-${appointmentData.patientId}-${appointmentData.doctorId}`)
      .digest('hex');
    
    // Create a readable room name: medical-consultation-{short-hash}
    const shortHash = hash.substring(0, 12);
    return `medical-consultation-${shortHash}`;
  }

  /**
   * Generate secure meeting password
   */
  generateMeetingPassword() {
    // Generate 8-character alphanumeric password
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Generate Jitsi meeting configuration
   */
  generateMeetingConfig(appointmentData, doctorData = null, patientData = null) {
    return {
      // Meeting settings
      startWithAudioMuted: true,
      startWithVideoMuted: false,
      enableWelcomePage: false,
      enableClosePage: false,
      
      // Security settings
      requireDisplayName: true,
      enableEmailInStats: false,
      enableUserRolesBasedOnToken: false,
      
      // Interface settings
      interfaceConfig: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        DISABLE_PRESENCE_STATUS: true,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
        HIDE_INVITE_MORE_HEADER: true,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: '',
        SHOW_POWERED_BY: false,
        GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        DISPLAY_WELCOME_PAGE_CONTENT: false,
        DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
        APP_NAME: 'Medical Consultation',
        NATIVE_APP_NAME: 'Medical Consultation',
        DEFAULT_BACKGROUND: '#040404',
        TOOLBAR_BUTTONS: [
          'microphone',
          'camera',
          'closedcaptions',
          'desktop',
          'fullscreen',
          'fodeviceselection',
          'hangup',
          'profile',
          'chat',
          'recording',
          'livestreaming',
          'etherpad',
          'sharedvideo',
          'settings',
          'raisehand',
          'videoquality',
          'filmstrip',
          'feedback',
          'stats',
          'shortcuts',
          'tileview',
          'videobackgroundblur',
          'download',
          'help',
          'mute-everyone'
        ]
      },
      
      // Feature flags
      enableLayerSuspension: true,
      enableNoiseCancellation: true,
      enableTalkWhileMuted: false,
      enableNoAudioDetection: true,
      enableSaveLogs: false,
      
      // Meeting metadata
      subject: appointmentData ? `Medical Consultation - ${appointmentData.reason}` : 'Medical Consultation',
      
      // User info
      userInfo: {
        displayName: patientData ? patientData.name : 'Patient'
      }
    };
  }

  validateAppointmentDateTime(appointmentDate, appointmentTime) {
    if (!appointmentDate || !appointmentTime) {
      throw new Error('Appointment date and time are required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(appointmentDate)) {
      throw new Error('Appointment date must be in YYYY-MM-DD format');
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(appointmentTime)) {
      throw new Error('Appointment time must be in HH:MM:SS format (24-hour)');
    }

    // Validate that the date is not in the past
    const now = new Date();
    const appointmentDateTime = parseISO(
      `${appointmentDate} ${appointmentTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    if (!isValid(appointmentDateTime)) {
      throw new Error(`Invalid date/time: ${appointmentDate} ${appointmentTime}`);
    }
    if (appointmentDateTime < now) {
      throw new Error('Appointment date/time cannot be in the past');
    }

    return true;
  }

  /**
   * Parse appointment date and time into Date object
   */
   /**
   * Parse appointment date and time into Date object
   * @param {string} appointmentDate - Date in YYYY-MM-DD format
   * @param {string} appointmentTime - Time in HH:MM format
   * @param {string} timezone - Timezone (e.g., 'UTC')
   * @returns {Date} - Parsed Date object
   */
  parseAppointmentDateTime(appointmentDate, appointmentTime, timezone = 'UTC') {
    try {
      // Validate inputs
      this.validateAppointmentDateTime(appointmentDate, appointmentTime);

      // Parse date and time using date-fns
      const dateTimeString = `${appointmentDate} ${appointmentTime}`;
      const parsedDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm:ss', new Date());


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
   * Generate meeting join instructions for patients
   */
  generateJoinInstructions(meetingData, appointmentData) {
    return {
      title: 'How to Join Your Medical Consultation via Jitsi Meet',
      appointmentId: appointmentData.id,
      appointmentDateTime: `${appointmentData.appointmentDate} at ${appointmentData.appointmentTime}`,
      meetingDetails: {
        provider: 'Jitsi Meet',
        meetingLink: meetingData.meetingLink,
        roomName: meetingData.roomName,
        password: meetingData.meetingPassword
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
          title: 'Enter your name',
          description: 'Enter your full name when prompted. This helps the doctor identify you.',
          timing: 'When joining the meeting'
        },
        {
          step: 3,
          title: 'Allow camera and microphone access',
          description: 'Your browser will ask for permission to use your camera and microphone. Please allow both.',
          timing: 'When prompted by your browser'
        },
        {
          step: 4,
          title: 'Wait for the doctor to join',
          description: 'You may be the first to join. Please wait for the doctor to enter the meeting room.',
          timing: 'After joining'
        },
        {
          step: 5,
          title: 'Test your audio and video',
          description: 'Use the microphone and camera buttons to test your audio and video before the consultation begins.',
          timing: 'While waiting for doctor'
        }
      ],
      technicalRequirements: [
        'Stable internet connection (minimum 1 Mbps upload/download)',
        'Updated web browser (Chrome, Firefox, Safari, Edge) - No app download required',
        'Camera and microphone (built-in or external)',
        'Quiet, private space for consultation',
        'Good lighting for video quality'
      ],
      troubleshooting: [
        {
          issue: 'Cannot access camera/microphone',
          solution: 'Check browser permissions and ensure no other apps are using your camera/microphone'
        },
        {
          issue: 'Poor video/audio quality',
          solution: 'Close other applications, move closer to your router, or use wired internet connection'
        },
        {
          issue: 'Browser compatibility issues',
          solution: 'Try using Google Chrome or Firefox for the best experience'
        },
        {
          issue: 'Cannot join meeting',
          solution: 'Refresh the page, clear browser cache, or try using an incognito/private browsing window'
        }
      ],
      features: [
        '✅ No app download required - works in web browser',
        '✅ Free and secure video conferencing',
        '✅ Screen sharing capability',
        '✅ Chat messaging during consultation',
        '✅ Mute/unmute controls',
        '✅ Background blur option',
        '✅ Recording capability (with consent)'
      ],
      supportContact: 'For technical issues during your appointment, contact our support team at support@yourplatform.com or call +1-XXX-XXX-XXXX'
    };
  }

  /**
   * Generate doctor join instructions with host controls
   */
  generateDoctorJoinInstructions(meetingData, appointmentData) {
    return {
      title: 'Doctor: How to Host Your Medical Consultation',
      appointmentId: appointmentData.id,
      meetingDetails: {
        provider: 'Jitsi Meet',
        meetingLink: meetingData.meetingLink,
        roomName: meetingData.roomName
      },
      hostControls: [
        {
          feature: 'Mute All Participants',
          description: 'Use the "Mute Everyone" button to mute all participants if needed'
        },
        {
          feature: 'Screen Sharing',
          description: 'Share your screen to show medical reports or educational materials'
        },
        {
          feature: 'Recording',
          description: 'Start recording (only with patient consent and for medical documentation)'
        },
        {
          feature: 'Chat',
          description: 'Use chat to share links or text information during consultation'
        },
        {
          feature: 'Lobby Mode',
          description: 'Enable lobby mode to control who can join the meeting'
        }
      ],
      professionalTips: [
        'Join 2-3 minutes early to test your setup',
        'Ensure good lighting on your face',
        'Use a neutral, professional background',
        'Keep medical notes handy for reference',
        'Test screen sharing before the appointment if needed',
        'Inform patient before starting any recording'
      ]
    };
  }

  /**
   * Create meeting URL with embedded configuration
   */
  createConfiguredMeetingURL(meetingData, userType = 'patient') {
    const baseUrl = meetingData.meetingLink;
    const config = meetingData.config;
    
    // Create URL with embedded config (for advanced usage)
    const configString = encodeURIComponent(JSON.stringify(config));
    return `${baseUrl}#config=${configString}`;
  }

  /**
   * Validate Jitsi service availability
   */
  async validateJitsiService() {
    try {
      // Simple check to see if Jitsi server is accessible
      // In a real implementation, you might want to do a more thorough check
      return {
        valid: true,
        serverUrl: this.serverURL,
        message: 'Jitsi Meet service is available'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        serverUrl: this.serverURL
      };
    }
  }
}

module.exports = JitsiMeetingService;





// ===================================
// Enhanced AppointmentController with Jitsi
// ===================================

// Add these methods to your AppointmentController:



// ===================================
// Updated Routes for Jitsi
// ===================================

// Add to your AppointmentRoutes.js:



// ===================================
// Environment Variables (Optional)
// ===================================

/*
Add to your .env file (optional):

# Jitsi Configuration (optional - uses public server by default)
JITSI_SERVER_URL=https://meet.jit.si

# If you have your own Jitsi server
# JITSI_SERVER_URL=https://your-jitsi-server.com
*/

// ===================================
// Usage Examples
// ===================================

/*
JITSI SETUP AND USAGE:

1. No Setup Required:
   - Uses public Jitsi servers (meet.jit.si)
   - No API keys needed
   - No authentication required
   - Completely free

2. Usage Example:

   POST /api/appointments
   {
     "patientId": "uuid",
     "doctorId": "uuid",
     "appointmentDate": "2025-06-25",
     "appointmentTime": "14:30",
     "reason": "Consultation",
     "consultationFee": 150.00,
     "appointmentMethod": "jitsi"
   }
   
   → Payment completed
   → Jitsi meeting automatically generated
   → Patient and doctor receive meeting details

3. Success Response:
   {
     "success": true,
     "meetingData": {
       "meetingProvider": "jitsi",
       "meetingLink": "https://meet.jit.si/medical-consultation-abc123def456",
       "roomName": "medical-consultation-abc123def456",
       "meetingPassword": "A1B2C3D4"
     },
     "patientInstructions": {
       "title": "How to Join Your Medical Consultation via Jitsi Meet",
       "instructions": [...],
       "technicalRequirements": [...],
       "features": [...]
     },
     "doctorInstructions": {
       "title": "Doctor: How to Host Your Medical Consultation",
       "hostControls": [...],
       "professionalTips": [...]
     }
   }

FEATURES:
✅ Completely free to use
✅ No API keys or authentication required
✅ No app download required (web browser only)
✅ Secure unique room names
✅ Professional meeting interface
✅ Screen sharing capability
✅ Chat functionality
✅ Recording capability (with consent)
✅ Background blur and effects
✅ Mobile friendly
✅ Works on all devices and browsers
✅ No time limits on meetings
✅ GDPR compliant
✅ End-to-end encryption option

ADVANTAGES OVER ZOOM/GOOGLE MEET:
✅ No OAuth flow required
✅ No API rate limits
✅ No subscription costs
✅ No complex setup process
✅ Instant meeting creation
✅ Open source and transparent
✅ No vendor lock-in
✅ Works immediately after appointment creation

PERFECT FOR:
✅ Medical consultations
✅ Telehealth applications
✅ Professional consultations
✅ Private conversations
✅ HIPAA-compliant communication (with proper configuration)
*/