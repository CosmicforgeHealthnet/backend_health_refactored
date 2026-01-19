
const router = require("express").Router();


const ChatController = require('../controllers/chatController');
const { validateRoomCreation, validateMessage } = require('../middlewares/chatValidationMiddleware');

const chatController = new ChatController();

// Apply authentication to all routes

// Room routes
router.post('/rooms', validateRoomCreation, chatController.createRoom.bind(chatController));
router.post('/direct', chatController.createDirectChat.bind(chatController));
router.get('/rooms', chatController.getUserRooms.bind(chatController));
router.get('/rooms/:roomId', chatController.getRoomDetails.bind(chatController));
router.post('/rooms/:roomId/join', chatController.joinRoom.bind(chatController));
router.post('/rooms/:roomId/leave', chatController.leaveRoom.bind(chatController));

// Message routes
router.post('/rooms/:roomId/messages', validateMessage, chatController.sendMessage.bind(chatController));
router.get('/rooms/:roomId/messages', chatController.getMessages.bind(chatController));
router.put('/messages/:messageId', chatController.editMessage.bind(chatController));
router.delete('/messages/:messageId', chatController.deleteMessage.bind(chatController));
router.post('/rooms/:roomId/read', chatController.markAsRead.bind(chatController));
router.get('/rooms/:roomId/search', chatController.searchMessages.bind(chatController));

// Appointment chat routes
router.post('/appointment', chatController.createAppointmentChat.bind(chatController));
router.get('/appointment', chatController.getAppointmentChats.bind(chatController));
router.get('/appointment/:appointmentChatId/status', chatController.getAppointmentChatStatus.bind(chatController));
router.post('/appointment/:appointmentChatId/join', chatController.joinAppointmentChat.bind(chatController));
router.post('/appointment/:appointmentChatId/end', chatController.endAppointmentChat.bind(chatController));


module.exports = router;