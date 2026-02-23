// src/shared/utils/constants.js
// Centralized constants used across all features

const USER_ROLES = {
    PATIENT: "patient",
    DOCTOR: "doctor",
    PHARMACY: "pharmacy",
    PHARMACIST: "pharmacist",
    PHARMACY_MANAGER: "pharmacy_manager",
    PHARMACY_ADMIN: "pharmacy_admin",
    PHARMACY_ASSISTANT: "pharmacy_assistant",
    DISPATCHER: "dispatcher",
    LAB: "lab",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin",
    MARKETER: 'marketer',
    LAB_ADMIN: "lab_admin",
    LAB_MANAGER: "lab_manager",
    SAMPLE_COLLECTOR: "sample_collector",
    LAB_TECHNICIAN: "lab_technician",
    RADIOLOGIST: "radiologist",
    RESULT_REVIEWER: "result_reviewer"
};

const APPOINTMENT_STATUS = {
    SCHEDULED: 'scheduled',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show'
};

const MESSAGE_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file',
    SYSTEM: 'system'
};

const SOCKET_EVENTS = {
    // Client to server
    AUTHENTICATE: 'authenticate',
    SEND_MESSAGE: 'send_message',
    TYPING: 'typing',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',

    // Server to client
    AUTHENTICATED: 'authenticated',
    NEW_MESSAGE: 'new_message',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',
    USER_TYPING: 'user_typing',
    APPOINTMENT_INACTIVE: 'appointment_inactive',
    APPOINTMENT_ENDED: 'appointment_ended',
    ERROR: 'error'
};

const VALIDATION_RULES = {
    MESSAGE_MAX_LENGTH: 500,
    APPOINTMENT_MAX_DURATION_HOURS: 4,
    APPOINTMENT_MIN_DURATION_MINUTES: 15,
    USERNAME_MIN_LENGTH: 2,
    USERNAME_MAX_LENGTH: 100,
    TITLE_MAX_LENGTH: 200
};

const ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    APPOINTMENT_NOT_FOUND: 'Appointment not found',
    APPOINTMENT_NOT_ACTIVE: 'Appointment is not currently active',
    UNAUTHORIZED_ACCESS: 'User not authorized for this appointment',
    INVALID_MESSAGE: 'Invalid message content',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error'
};

const SUCCESS_MESSAGES = {
    USER_CREATED: 'User created successfully',
    APPOINTMENT_CREATED: 'Appointment created successfully',
    MESSAGE_SENT: 'Message sent successfully',
    APPOINTMENT_UPDATED: 'Appointment updated successfully'
};

const RewardType = {
    DISCOUNT: "discount",
    FREE_GIFT: "free_gift",
    TRY_AGAIN: "try_again",
    NO_REWARD: "no_reward"
};

const RewardStatus = {
    ACTIVE: "active",
    USED: "used",
    EXPIRED: "expired"
};

module.exports = {
    USER_ROLES,
    APPOINTMENT_STATUS,
    MESSAGE_TYPES,
    SOCKET_EVENTS,
    VALIDATION_RULES,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    RewardType,
    RewardStatus
};
