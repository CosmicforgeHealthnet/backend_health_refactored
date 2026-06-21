class SupportSocketHandler {
  constructor(io) {
    this.io = io;
  }

  initialize() {
    this.io.on('connection', (socket) => {
      const role = socket.handshake.auth?.role || socket.handshake.query?.role;

      // Admin agents automatically join the agents broadcast room
      if (role === 'admin' || role === 'super_admin') {
        socket.join('support:agents');
      }

      // Client joins a specific session room to receive real-time messages from that session
      socket.on('support:join_session', ({ sessionId }) => {
        if (sessionId) {
          socket.join(`support:session:${sessionId}`);
        }
      });

      // Client leaves a session room
      socket.on('support:leave_session', ({ sessionId }) => {
        if (sessionId) {
          socket.leave(`support:session:${sessionId}`);
        }
      });
    });
  }
}

module.exports = SupportSocketHandler;
