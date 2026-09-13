jest.mock('../features/notifications/services/notificationService');
const NotificationService = require('../features/notifications/services/notificationService');

test('debug automock behavior', () => {
  console.log('typeof NotificationService:', typeof NotificationService);
  console.log('typeof prototype.createNotification:', typeof NotificationService.prototype.createNotification);
  const inst = new NotificationService();
  console.log('typeof inst.createNotification:', typeof inst.createNotification);
  NotificationService.prototype.createNotification = jest.fn().mockResolvedValue('X');
  console.log('after reassign, inst.createNotification === prototype one?', inst.createNotification === NotificationService.prototype.createNotification);
  const inst2 = new NotificationService();
  console.log('inst2.createNotification() returns:', inst2.createNotification());
});
