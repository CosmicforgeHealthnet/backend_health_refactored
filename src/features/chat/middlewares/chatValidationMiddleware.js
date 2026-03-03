
// src/middleware/chat/chatMiddleware.js
const { body, param, validationResult } = require('express-validator');

const validateRoomCreation = [
  body('name')
    .notEmpty()
    .withMessage('Room name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Room name must be between 1 and 255 characters'),
  body('type')
    .optional()
    .isIn(['direct', 'group', 'appointment', 'support'])
    .withMessage('Invalid room type'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 2, max: 100 })
    .withMessage('Max participants must be between 2 and 100'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

const validateMessage = [
  body('content')
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message content must be between 1 and 4000 characters'),
  body('type')
    .optional()
    .isIn(['text', 'image', 'file', 'system'])
    .withMessage('Invalid message type'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

const validateRoomAccess = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.sub;

    const chatService = new (require('../../lab/websocket/chat').ChatService)();
    const room = await chatService.getRoomWithDetails(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const hasAccess = room.participants.some(p => p.user.id === userId && p.isActive);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this room'
      });
    }

    req.room = room;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
//   ChatSocketHandler,
  validateRoomCreation,
  validateMessage,
  validateRoomAccess
};