# Medical Platform Chat System - Complete Integration Guide

## Overview

This chat system is built as an independent module within your medical platform. It uses your existing PostgreSQL database with TypeORM and integrates seamlessly with your current authentication system.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install socket.io uuid
```

### 2. Database Setup

Run the migrations in order:

```bash
# Run chat migrations
npm run typeorm migration:run
```

### 3. Environment Variables

Add to your `.env` file:

```env
# Chat System Configuration
CHAT_MAX_ROOMS=1000
CHAT_MAX_USERS_PER_ROOM=100
CHAT_MESSAGE_RETENTION=1000
CHAT_ENABLE_LOGGING=true
```

### 4. Server Integration

Add to your existing `server.js`:

```javascript
const socketIo = require('socket.io');
const { ChatSocketHandler } = require('./src/websocket/chatSocket');
const chatRoutes = require('./src/routes/chat');

// Add WebSocket support
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize chat
const chatSocketHandler = new ChatSocketHandler(io);
chatSocketHandler.initialize();

// Make io available to routes
app.set('io', io);

// Mount chat routes
app.use('/api/chat', chatRoutes);
```

## 📡 API Endpoints

### Core Chat APIs

```
GET    /api/chat/rooms                    # Get user's chat rooms
POST   /api/chat/rooms                    # Create new room
{
    "success": true,
    "data": {
        "id": "3753b1b4-b57a-4dbb-afbb-16187261a65b",
        "name": "ap_room",
        "description": "room for appointment",
        "type": "group",
        "isPrivate": false,
        "maxParticipants": 50,
        "settings": {},
        "metadata": {},
        "createdAt": "2025-06-13T05:44:21.151Z",
        "updatedAt": "2025-06-13T05:44:21.151Z",
        "deletedAt": null,
        "participants": [
            {
                "id": "b4baf502-277a-49bc-bf2f-e1717392760c",
                "role": "admin",
                "permissions": null,
                "isActive": true,
                "lastReadAt": null,
                "joinedAt": "2025-06-13T05:44:23.915Z",
                "leftAt": null,
                "metadata": null,
                "user": {
                    "id": "77e25533-5aa8-4fcc-8f16-cb65f28f50fd",
                    "fullName": "Moses Benjamin",
                    "email": "benmos16@gmail.com",
                    "passwordHash": "$2b$12$qNG7PdsAySBbrC.5jeusz.LsESgnX7vsUl3MjlF.bxQSGIg0KNHk2",
                    "role": "patient",
                    "status": "pending_email_verification",
                    "provider": "local",
                    "providerId": null,
                    "profileImageUrl": null,
                    "mfaEnabled": false,
                    "mfaSecret": null,
                    "createdAt": "2025-06-01T01:50:36.194Z",
                    "updatedAt": "2025-06-01T01:50:36.194Z",
                    "tier": "free"
                }
            }
        ],
        "createdBy": {
            "id": "77e25533-5aa8-4fcc-8f16-cb65f28f50fd",
            "fullName": "Moses Benjamin",
            "email": "benmos16@gmail.com",
            "passwordHash": "$2b$12$qNG7PdsAySBbrC.5jeusz.LsESgnX7vsUl3MjlF.bxQSGIg0KNHk2",
            "role": "patient",
            "status": "pending_email_verification",
            "provider": "local",
            "providerId": null,
            "profileImageUrl": null,
            "mfaEnabled": false,
            "mfaSecret": null,
            "createdAt": "2025-06-01T01:50:36.194Z",
            "updatedAt": "2025-06-01T01:50:36.194Z",
            "tier": "free"
        }
    },
    "message": "Room created successfully"
}
POST   /api/chat/direct                   # Create direct chat
GET    /api/chat/rooms/:id                # Get room details
POST   /api/chat/rooms/:id/join           # Join room
POST   /api/chat/rooms/:id/leave          # Leave room

GET    /api/chat/rooms/:id/messages       # Get messages
POST   /api/chat/rooms/:id/messages       # Send message
PUT    /api/chat/messages/:id             # Edit message
DELETE /api/chat/messages/:id             # Delete message
POST   /api/chat/rooms/:id/read           # Mark as read
GET    /api/chat/rooms/:id/search         # Search messages
```

### Medical-Specific APIs (Appointment Chat Plugin)

```
POST   /api/chat/appointment              # Create appointment chat
GET    /api/chat/appointment              # Get user's appointment chats
GET    /api/chat/appointment/:id/status   # Get appointment chat status
POST   /api/chat/appointment/:id/join     # Join appointment chat
POST   /api/chat/appointment/:id/end      # End appointment chat
```

## 🔌 WebSocket Events

### Client to Server

```javascript
// Authentication & Room Management
socket.emit('join_room', { roomId });
socket.emit('leave_room', { roomId });

// Messaging
socket.emit('send_message', { roomId, content, type });
socket.emit('edit_message', { messageId, content });
socket.emit('delete_message', { messageId });

// Typing Indicators
socket.emit('typing_start', { roomId });
socket.emit('typing_stop', { roomId });

// Read Status
socket.emit('mark_read', { roomId, messageId });

// Appointment Chat
socket.emit('join_appointment_chat', { appointmentChatId });
socket.emit('check_appointment_status', { appointmentChatId });
```

### Server to Client
```javascript
// Room Events
socket.on('room_joined', (data) => {});
socket.on('user_joined_room', (data) => {});
socket.on('user_left_room', (data) => {});

// Message Events
socket.on('new_message', (message) => {});
socket.on('message_edited', (message) => {});
socket.on('message_deleted', (data) => {});

// Typing Events
socket.on('user_typing', (data) => {});

// User Status
socket.on('user_online', (data) => {});
socket.on('user_offline', (data) => {});

// Appointment Events
socket.on('appointment_joined', (data) => {});
socket.on('appointment_ended', (data) => {});
```

## 🏥 Medical Platform Integration

### 1. Creating Appointment Chats

```javascript
const { MedicalChatIntegration } = require('./src/services/medicalChatIntegration');

const medicalChat = new MedicalChatIntegration();

// When booking an appointment
const appointmentChat = await medicalChat.createConsultationChat(
  appointmentId,
  doctorId,
  patientId,
  scheduledDateTime
);
```

### 2. Frontend Integration

```javascript
// React component example
import ChatWidget from './components/ChatWidget';

function AppointmentPage({ appointment }) {
  return (
    <div>
      <h1>Medical Consultation</h1>
      <ChatWidget
        user={currentUser}
        appointmentChatId={appointment.chatId}
      />
    </div>
  );
}
```

### 3. Real-time Notifications

```javascript
// Send system notifications
await medicalChat.sendAppointmentNotification(
  appointmentChatId,
  'Your consultation will begin in 5 minutes'
);
```

## 🔧 Configuration Options

### Room Types

- **direct**: One-on-one conversations
- **group**: Multiple participants
- **appointment**: Scheduled medical consultations
- **support**: Customer support chats

### Appointment Chat Settings

```javascript
{
  preJoinAllowed: false,        // Can join before scheduled time
  autoCloseEnabled: true,       // Auto-close after end time
  postChatDuration: 300,        // Seconds to keep open after end
  maxParticipants: 2            // Doctor + Patient only
}
```

## 🛡️ Security Features

### Authentication
- Uses your existing JWT authentication
- Socket connections are authenticated
- User permissions are checked for all operations

### Authorization
- Room access control
- Message editing/deletion permissions
- Appointment chat access validation

### Rate Limiting
- Message sending limits
- File upload restrictions
- API endpoint protection

## 📊 Monitoring & Analytics

### Health Check
```
GET /api/chat/health
```

### Usage Statistics
```javascript
// Get online users count
const onlineCount = chatSocketHandler.getOnlineUsersCount();

// Get room statistics
const roomStats = await chatService.getRoomStats(roomId);
```

## 🚀 Deployment Considerations

### Production Setup

1. **Environment Variables**
```env
NODE_ENV=production
CHAT_ENABLE_LOGGING=false
CHAT_MAX_ROOMS=10000
```

2. **Database Optimization**
- Add indexes for message search
- Set up message archiving
- Configure connection pooling

3. **Scaling**
- Use Redis for WebSocket scaling
- Implement message queue for notifications
- Add CDN for file uploads

### Performance Tips

1. **Message Pagination**: Limit message history
2. **File Storage**: Use cloud storage for attachments
3. **Cleanup**: Regular cleanup of old messages
4. **Caching**: Cache frequently accessed rooms

## 🔄 Plugin System

The chat system supports plugins for extended functionality:

### Available Plugins
- **Appointment Scheduler**: Medical consultation timing
- **File Sharing**: Document and image sharing
- **Typing Indicators**: Real-time typing status
- **Message Encryption**: End-to-end encryption

### Creating Custom Plugins

```javascript
class CustomPlugin {
  constructor(chatEngine) {
    this.chatEngine = chatEngine;
    this.name = 'custom-plugin';
  }

  initialize() {
    // Plugin initialization
  }

  hooks = {
    'message:before_send': this.validateMessage,
    'user:joined': this.onUserJoined
  }

  validateMessage = async (data) => {
    // Custom message validation
    return data;
  }

  onUserJoined = async (data) => {
    // Handle user joining
  }
}
```

## 📱 Client Examples

### Vanilla JavaScript
```javascript
const socket = io('/api/chat', {
  auth: { token: localStorage.getItem('jwt_token') }
});

socket.on('new_message', (message) => {
  displayMessage(message);
});
```

### React Hook
```javascript
import { useSocket } from './hooks/useSocket';

function ChatComponent() {
  const { socket, sendMessage, messages } = useSocket(roomId);
  
  return (
    <div>
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

## 🤝 Contributing

1. Follow existing code structure
2. Add tests for new features
3. Update documentation
4. Use TypeScript for type safety (optional)

## 📝 License

This chat system is part of your medical platform and follows your existing licensing terms.

---

## ✅ Ready to Use!

Your chat system is now fully integrated and ready for medical consultations. The system is:

- ✅ **Independent**: Works standalone within your platform
- ✅ **Scalable**: Handles multiple concurrent consultations
- ✅ **Secure**: Integrates with your existing auth system
- ✅ **Medical-Ready**: Appointment scheduling and management
- ✅ **Real-time**: WebSocket-based live communication
- ✅ **Extensible**: Plugin system for future features