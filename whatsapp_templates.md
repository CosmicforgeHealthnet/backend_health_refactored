# WhatsApp Templates for CosmicForge Health

## Authentication Templates

### 1. Email Verification
**Template Name:** `email_verification`
**Category:** Authentication
**Language:** en_US

**Body:**
```
Hi {{1}},

Please verify your CosmicForge account by clicking the link we sent to your email. The verification link expires in {{2}} minutes.

Need help? Contact our support team.
```

### 2. Password Reset
**Template Name:** `password_reset`
**Category:** Authentication
**Language:** en_US

**Body:**
```
Hi {{1}},

We received a request to reset your CosmicForge password. Check your email for the reset link. It expires in {{2}} minutes.

If you didn't request this, please ignore this message.
```

### 3. Magic Link Login
**Template Name:** `magic_link_login`
**Category:** Authentication
**Language:** en_US

**Body:**
```
Hi {{1}},

Your CosmicForge login link has been sent to your email. The link expires in {{2}} minutes.

Click the link in your email to access your account securely.
```

## Doctor Verification Templates

### 4. Verification Submitted
**Template Name:** `verification_submitted`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Your verification request has been submitted successfully. Tracking ID: {{2}}

We'll review your documents and update you within 2-4 business days. Check your dashboard for updates.
```

### 5. Verification In Progress
**Template Name:** `verification_in_progress`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Your verification is now in progress. We're reviewing your submitted documents for license {{2}}.

You'll receive an update once the review is complete.
```

### 6. Verification Under Review
**Template Name:** `verification_manual_review`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Your verification requires manual review. Our team is carefully examining your documents for license {{2}}.

This may take additional time. We'll notify you once complete.
```

### 7. Verification Approved
**Template Name:** `verification_approved`
**Category:** Utility
**Language:** en_US

**Body:**
```
🎉 Congratulations Dr. {{1}}!

Your verification has been approved! You can now:
- Complete your profile setup
- Start accepting consultations
- Access your full dashboard

Welcome to CosmicForge Health!
```

### 8. Verification Rejected
**Template Name:** `verification_rejected`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Your verification requires updates. Please review the feedback in your dashboard and resubmit your documents.

License: {{2}}
Check your email for detailed feedback.
```

### 9. Verification Expired
**Template Name:** `verification_expired`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Your verification request has expired. Please renew your application to continue the verification process.

Visit your dashboard to renew and resubmit documents.
```

### 10. Document Upload Confirmation
**Template Name:** `document_uploaded`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Document uploaded successfully: {{2}}

Processing time: 2-4 hours
Verification ID: {{3}}

Check your dashboard for processing updates.
```

## Appointment Templates

### 11. Doctor Payment Notification
**Template Name:** `doctor_payment_notification`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Payment received for appointment with {{2}} on {{3}} at {{4}}.

Amount: {{5}}
Please approve the appointment in your dashboard.
```

### 12. Patient Appointment Approved
**Template Name:** `patient_appointment_approved`
**Category:** Utility
**Language:** en_US

**Body:**
```
✅ Hi {{1}},

Your appointment with Dr. {{2}} is confirmed!

📅 {{3}} at {{4}}
Type: {{5}}

Meeting details will be sent closer to your appointment time.
```

### 13. Doctor Appointment Reminder
**Template Name:** `doctor_appointment_reminder`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Reminder: Appointment with {{2}} in 1 hour

📅 {{3}} at {{4}}
Duration: {{5}} minutes
Type: {{6}}

Meeting link: {{7}}
```

### 14. Patient Appointment Reminder
**Template Name:** `patient_appointment_reminder`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Reminder: Appointment with Dr. {{2}} in 1 hour

📅 {{3}} at {{4}}
Duration: {{5}} minutes
Type: {{6}}

Meeting link: {{7}}
```

### 15. Doctor Meeting Preparation
**Template Name:** `doctor_meeting_preparation`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Meeting with {{2}} starts in 15 minutes!

Time: {{3}}
Meeting Link: {{4}}
Password: {{5}}

Please join a few minutes early.
```

### 16. Patient Meeting Preparation
**Template Name:** `patient_meeting_preparation`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Your consultation with Dr. {{2}} starts in 15 minutes!

Time: {{3}}
Meeting Link: {{4}}
Password: {{5}}

Please join a few minutes early.
```

### 17. Appointment Cancelled - Doctor
**Template Name:** `doctor_appointment_cancelled`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Appointment with {{2}} has been cancelled.

📅 {{3}} at {{4}}
Cancelled by: {{5}}
Reason: {{6}}

Check your dashboard for details.
```

### 18. Appointment Cancelled - Patient
**Template Name:** `patient_appointment_cancelled`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Your appointment with Dr. {{2}} has been cancelled.

📅 {{3}} at {{4}}
Reason: {{5}}

Refund: {{6}} (processing 3-5 days)
You can rebook from your dashboard.
```

### 19. Appointment Rescheduled - Doctor
**Template Name:** `doctor_appointment_rescheduled`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Appointment with {{2}} has been rescheduled.

From: {{3}} at {{4}}
To: {{5}} at {{6}}

Rescheduled by: {{7}}
Meeting link: {{8}}
```

### 20. Appointment Rescheduled - Patient
**Template Name:** `patient_appointment_rescheduled`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Your appointment with Dr. {{2}} has been rescheduled.

From: {{3}} at {{4}}
To: {{5}} at {{6}}

Reason: {{7}}
Meeting link: {{8}}
```

## Meeting Link Templates

### 21. Google Meet Link - Patient
**Template Name:** `patient_google_meet_link`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Your Google Meet link is ready for Dr. {{2}}:

📅 {{3}} at {{4}}
Meeting Link: {{5}}
Meeting Code: {{6}}

Save this link for your appointment.
```

### 22. Google Meet Link - Doctor
**Template Name:** `doctor_google_meet_link`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Google Meet setup complete for {{2}}:

📅 {{3}} at {{4}}
Meeting Link: {{5}}
Meeting Code: {{6}}

You have host privileges for this meeting.
```

### 23. Zoom Meeting Link - Patient
**Template Name:** `patient_zoom_meeting_link`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Your Zoom meeting is ready for Dr. {{2}}:

📅 {{3}} at {{4}}
Meeting Link: {{5}}
Meeting ID: {{6}}
Password: {{7}}
```

### 24. Zoom Meeting Link - Doctor
**Template Name:** `doctor_zoom_meeting_link`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Zoom meeting setup complete for {{2}}:

📅 {{3}} at {{4}}
Meeting Link: {{5}}
Meeting ID: {{6}}
Password: {{7}}
Host Key: {{8}}
```

## Payment Templates

### 25. Payment Receipt - Appointment
**Template Name:** `appointment_payment_receipt`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Payment confirmed! Appointment booked with Dr. {{2}}.

📅 {{3}} at {{4}}
Amount: {{5}} {{6}}
Transaction ID: {{7}}

Your receipt has been emailed to you.
```

### 26. Payment Receipt - Subscription
**Template Name:** `subscription_payment_receipt`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Subscription upgraded successfully!

Plan: {{2}}
Amount: {{3}} {{4}}
Billing: {{5}}
Next billing: {{6}}

Transaction ID: {{7}}
```

### 27. Refund Confirmation
**Template Name:** `refund_confirmation`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

💰 Refund processed successfully!

Appointment ID: {{2}}
Amount: {{3}}
Processing time: {{4}}

The refund will appear in your account within the processing period.
```

## Wallet Templates

### 28. Withdrawal OTP
**Template Name:** `withdrawal_otp_notification`
**Category:** Authentication
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Withdrawal request initiated:

Amount: {{2}} {{3}}
Account: {{4}}
Withdrawal ID: {{5}}

Check your email for the OTP to complete this withdrawal.
```

### 29. Wallet Password Reset
**Template Name:** `wallet_password_reset`
**Category:** Authentication
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Wallet password reset requested. Check your email for the reset link.

Link expires in {{2}} minutes.

If you didn't request this, please contact support immediately.
```

## Rewards Templates

### 30. Reward Verification
**Template Name:** `reward_verification`
**Category:** Utility
**Language:** en_US

**Body:**
```
🎉 Congratulations!

You've won a reward: {{1}}
Value: {{2}}
Code: {{3}}

Check your email to verify and activate your reward. Valid for {{4}} days.
```

### 31. Reward Confirmation
**Template Name:** `reward_confirmation`
**Category:** Utility
**Language:** en_US

**Body:**
```
✅ Reward activated!

{{1}}: {{2}}
Code: {{3}}
Activated: {{4}}

You can now use this reward for your subscription upgrade.
```

### 32. Reward Expiry Warning
**Template Name:** `reward_expiry_warning`
**Category:** Marketing
**Language:** en_US

**Body:**
```
⚠️ Reward expiring soon!

{{1}}: {{2}}
Code: {{3}}
Expires in: {{4}} days

Use your reward before {{5}} to avoid losing it!
```

### 33. Spin Wheel Reminder
**Template Name:** `spin_wheel_reminder`
**Category:** Marketing
**Language:** en_US

**Body:**
```
🎰 Ready for your daily spin?

Hi {{1}}, your daily reward is waiting!

Spin the wheel now and win exciting prizes including subscription discounts and more.

Don't miss out - spin today!
```

## Lab Facility Templates

### 34. Lab Facility Registration
**Template Name:** `lab_facility_registration`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Lab facility registration submitted successfully!

Facility: {{2}}
Type: {{3}}
Registration: {{4}}

Processing time: 2-5 business days. Track ID: {{5}}
```

### 35. Lab Facility Approved
**Template Name:** `lab_facility_approved`
**Category:** Utility
**Language:** en_US

**Body:**
```
🎉 Hi {{1}},

{{2}} has been approved!

Registration: {{3}}
Approved: {{4}}

Login credentials have been sent to your email. Welcome to CosmicForge Health!
```

### 36. Lab Facility Rejected
**Template Name:** `lab_facility_rejected`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

{{2}} registration requires updates.

Registration: {{3}}
Reason: {{4}}

Please check your email for detailed feedback and resubmission guidelines.
```

### 37. Lab Personnel Invitation
**Template Name:** `lab_personnel_invitation`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

You're invited to join {{2}} as {{3}}.

Invited by: {{4}}
Registration expires: {{5}}

Check your email for registration instructions and temporary credentials.
```

### 38. Lab Personnel Welcome
**Template Name:** `lab_personnel_welcome`
**Category:** Utility
**Language:** en_US

**Body:**
```
Welcome to {{1}}!

Hi {{2}}, you're now registered as {{3}}.

Your dashboard is ready. Check your email for training materials and handbook access.

Welcome to the team!
```

### 39. Lab Waitlist Confirmation
**Template Name:** `lab_waitlist_confirmation`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

You've joined our lab registration waitlist!

Facility: {{2}}
Tracking ID: {{3}}

We'll notify you when registration opens. Check your email for details.
```

### 40. Lab Waitlist Launch
**Template Name:** `lab_waitlist_launch_notification`
**Category:** Marketing
**Language:** en_US

**Body:**
```
🚀 Lab registration is now open!

Hi {{1}}, you can now register {{2}} for CosmicForge Health.

Registration opened: {{3}}
No deadline - ongoing registrations

Start your registration process today!
```

## Reminder Templates

### 41. Profile Completion Reminder
**Template Name:** `profile_completion_reminder`
**Category:** Marketing
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Complete your CosmicForge profile to start receiving patients.

Your profile is the first thing patients see. Add your specialties, experience, and availability.

Complete your profile now!
```

### 42. Verification Reminder
**Template Name:** `verification_reminder`
**Category:** Marketing
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Your verification has been pending for {{2}} days.

Verification ID: {{3}}
Missing documents: {{4}}

Complete your verification to start practicing on CosmicForge.
```

### 43. Verification Expiry Warning
**Template Name:** `verification_expiry_warning`
**Category:** Marketing
**Language:** en_US

**Body:**
```
⚠️ Hi Dr. {{1}},

Your verification expires in {{2}} days!

Expiry date: {{3}}
Verification ID: {{4}}

Renew now to avoid interruption to your services.
```

## Status Update Templates

### 44. Meeting Ended - Doctor
**Template Name:** `doctor_meeting_ended`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi Dr. {{1}},

Meeting with {{2}} completed.

Appointment ID: {{3}}
Ended: {{4}}
Reason: {{5}}

Add consultation notes in your dashboard.
```

### 45. Meeting Ended - Patient
**Template Name:** `patient_meeting_ended`
**Category:** Utility
**Language:** en_US

**Body:**
```
Hi {{1}},

Consultation with Dr. {{2}} completed.

Appointment ID: {{3}}
Ended: {{4}}
Reason: {{5}}

Check your dashboard for consultation summary.
```

---

## Template Usage Notes

1. **Variable Mapping**: Each `{{X}}` corresponds to dynamic data from your email functions
2. **Character Limits**: WhatsApp templates have a 1024 character limit for the body
3. **Categories**:
   - **Authentication**: For login, verification, password resets
   - **Utility**: For transactional updates, confirmations, notifications
   - **Marketing**: For promotional content, reminders, engagement

4. **Template Approval**: All templates need Meta approval before use
5. **Language Codes**: Use proper ISO codes (en_US, es_ES, etc.)
6. **Button Options**: Add quick reply or call-to-action buttons as needed

Each template corresponds to the email functions in your codebase and maintains the same information flow while being optimized for WhatsApp's format and character limitations.