// src/services/whatsappService.js
const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.baseURL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    
    if (!this.accessToken) {
      throw new Error('WHATSAPP_ACCESS_TOKEN is required');
    }
  }

  /**
   * Send a template message
   * @param {string} to - Recipient phone number (with country code, no + sign)
   * @param {string} templateName - Name of the approved template
   * @param {string} languageCode - Language code (e.g., 'en_US')
   * @param {Array} parameters - Array of parameter values for template variables
   * @param {Array} buttons - Optional button parameters for interactive templates
   */
  async sendTemplate(to, templateName, languageCode = 'en_US', parameters = [], buttons = []) {
    try {
      const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      };

      // Add parameters if provided
      if (parameters.length > 0) {
        payload.template.components = [
          {
            type: "body",
            parameters: parameters.map(param => ({
              type: "text",
              text: String(param)
            }))
          }
        ];
      }

      // Add button parameters if provided
      if (buttons.length > 0) {
        if (!payload.template.components) {
          payload.template.components = [];
        }
        payload.template.components.push({
          type: "button",
          sub_type: "quick_reply",
          parameters: buttons
        });
      }

      const response = await axios.post(
        `${this.baseURL}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`WhatsApp template sent successfully to ${to}:`, response.data);
      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };

    } catch (error) {
      console.error('Error sending WhatsApp template:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Format phone number for WhatsApp (remove + and spaces)
   * @param {string} phoneNumber - Phone number with country code
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/[\s+\-()]/g, '');
  }

  /**
   * Send verification email template
   */
  async sendVerificationTemplate(phoneNumber, fullName, expiresInMinutes) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    return await this.sendTemplate(
      formattedPhone,
      'email_verification',
      'en_US',
      [fullName, expiresInMinutes.toString()]
    );
  }

  /**
   * Send password reset template
   */
  async sendPasswordResetTemplate(phoneNumber, fullName, expiresInMinutes) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    return await this.sendTemplate(
      formattedPhone,
      'password_reset',
      'en_US',
      [fullName, expiresInMinutes.toString()]
    );
  }

  /**
   * Send doctor verification status template
   */
  async sendDoctorVerificationStatusTemplate(phoneNumber, doctorName, status, licenseNumber, verificationId) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    const templateMappings = {
      'pending': 'verification_submitted',
      'in_progress': 'verification_in_progress',
      'manual_review': 'verification_manual_review',
      'approved': 'verification_approved',
      'rejected': 'verification_rejected',
      'expired': 'verification_expired'
    };

    const templateName = templateMappings[status] || 'verification_submitted';
    
    let parameters = [doctorName];
    if (licenseNumber) parameters.push(licenseNumber);
    if (verificationId) parameters.push(verificationId);

    return await this.sendTemplate(
      formattedPhone,
      templateName,
      'en_US',
      parameters
    );
  }

  /**
   * Send appointment reminder template
   */
  async sendAppointmentReminderTemplate(phoneNumber, recipientName, otherPersonName, date, time, duration, consultationType, meetingLink, isDoctor = false) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const templateName = isDoctor ? 'doctor_appointment_reminder' : 'patient_appointment_reminder';
    
    return await this.sendTemplate(
      formattedPhone,
      templateName,
      'en_US',
      [recipientName, otherPersonName, date, time, duration.toString(), consultationType, meetingLink]
    );
  }

  /**
   * Send appointment approval template
   */
  async sendAppointmentApprovedTemplate(phoneNumber, patientName, doctorName, date, time, consultationType) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'patient_appointment_approved',
      'en_US',
      [patientName, doctorName, date, time, consultationType]
    );
  }

  /**
   * Send appointment cancellation template
   */
  async sendAppointmentCancellationTemplate(phoneNumber, recipientName, otherPersonName, date, time, reason, cancelledBy, refundAmount, isDoctor = false) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const templateName = isDoctor ? 'doctor_appointment_cancelled' : 'patient_appointment_cancelled';
    
    return await this.sendTemplate(
      formattedPhone,
      templateName,
      'en_US',
      [recipientName, otherPersonName, date, time, reason, cancelledBy, refundAmount]
    );
  }

  /**
   * Send payment receipt template
   */
  async sendPaymentReceiptTemplate(phoneNumber, patientName, doctorName, date, time, amount, currency, transactionId) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'appointment_payment_receipt',
      'en_US',
      [patientName, doctorName, date, time, amount, currency, transactionId]
    );
  }

  /**
   * Send meeting preparation template
   */
  async sendMeetingPreparationTemplate(phoneNumber, recipientName, otherPersonName, time, meetingLink, password, isDoctor = false) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const templateName = isDoctor ? 'doctor_meeting_preparation' : 'patient_meeting_preparation';
    
    return await this.sendTemplate(
      formattedPhone,
      templateName,
      'en_US',
      [recipientName, otherPersonName, time, meetingLink, password]
    );
  }

  /**
   * Send Google Meet link template
   */
  async sendGoogleMeetLinkTemplate(phoneNumber, recipientName, otherPersonName, date, time, meetingLink, meetingCode, isDoctor = false) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const templateName = isDoctor ? 'doctor_google_meet_link' : 'patient_google_meet_link';
    
    return await this.sendTemplate(
      formattedPhone,
      templateName,
      'en_US',
      [recipientName, otherPersonName, date, time, meetingLink, meetingCode]
    );
  }

  /**
   * Send Zoom meeting link template
   */
  async sendZoomMeetingLinkTemplate(phoneNumber, recipientName, otherPersonName, date, time, meetingLink, meetingId, password, hostKey = null, isDoctor = false) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const templateName = isDoctor ? 'doctor_zoom_meeting_link' : 'patient_zoom_meeting_link';
    
    let parameters = [recipientName, otherPersonName, date, time, meetingLink, meetingId, password];
    if (isDoctor && hostKey) {
      parameters.push(hostKey);
    }
    
    return await this.sendTemplate(
      formattedPhone,
      templateName,
      'en_US',
      parameters
    );
  }

  /**
   * Send reward notification template
   */
  async sendRewardNotificationTemplate(phoneNumber, rewardType, rewardValue, rewardCode, validityDays) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'reward_verification',
      'en_US',
      [rewardType, rewardValue, rewardCode, validityDays.toString()]
    );
  }

  /**
   * Send lab facility status template
   */
  async sendLabFacilityStatusTemplate(phoneNumber, adminName, facilityName, facilityType, registrationNumber, trackingId = null) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    let parameters = [adminName, facilityName, facilityType, registrationNumber];
    if (trackingId) parameters.push(trackingId);
    
    return await this.sendTemplate(
      formattedPhone,
      'lab_facility_registration',
      'en_US',
      parameters
    );
  }

  /**
   * Send spin wheel reminder template
   */
  async sendSpinWheelReminderTemplate(phoneNumber, userName) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'spin_wheel_reminder',
      'en_US',
      [userName]
    );
  }

  /**
   * Send withdrawal OTP template
   */
  async sendWithdrawalOtpTemplate(phoneNumber, doctorName, amount, currency, accountName, withdrawalId) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'withdrawal_otp_notification',
      'en_US',
      [doctorName, amount, currency, accountName, withdrawalId]
    );
  }

  /**
   * Send reminder templates
   */
  async sendProfileCompletionReminderTemplate(phoneNumber, doctorName) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'profile_completion_reminder',
      'en_US',
      [doctorName]
    );
  }

  async sendVerificationReminderTemplate(phoneNumber, doctorName, daysPending, verificationId, documentsNeeded) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendTemplate(
      formattedPhone,
      'verification_reminder',
      'en_US',
      [doctorName, daysPending.toString(), verificationId, documentsNeeded.join(', ')]
    );
  }

  /**
   * Send bulk templates (useful for campaigns)
   */
  async sendBulkTemplates(recipients, templateName, languageCode, parametersFunction) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const recipient of recipients) {
      try {
        const parameters = parametersFunction(recipient);
        const result = await this.sendTemplate(
          recipient.phoneNumber,
          templateName,
          languageCode,
          parameters
        );

        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            phoneNumber: recipient.phoneNumber,
            error: result.error
          });
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        results.failed++;
        results.errors.push({
          phoneNumber: recipient.phoneNumber,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = WhatsAppService;