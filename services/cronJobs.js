const cron = require('node-cron');
const alertService = require('./alertService');
const statusUpdateService = require('./statusUpdateService');

// รัน alert monitoring ตาม schedule ที่กำหนด
const scheduleAlertMonitoring = () => {
  // Use environment variable or default to every minute for testing
  const alertSchedule = process.env.ALERT_SCHEDULE || '* * * * *';
  
  cron.schedule(alertSchedule, async () => {
    console.log('Running scheduled alert monitoring...', new Date().toISOString());
    try {
      const result = await alertService.runDailyAlerts();
      console.log('Alert monitoring completed:', result);
    } catch (error) {
      console.error('Error in scheduled alert monitoring:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok"
  });
  
  console.log(`Alert monitoring scheduled with cron: ${alertSchedule}`);
};

// รัน status update ทุกวันเวลา 0:01 น.
const scheduleStatusUpdate = () => {
  cron.schedule('1 0 * * *', async () => {
    console.log('Running scheduled status update...');
    try {
      const result = await statusUpdateService.updateContractStatuses();
      console.log('Status update completed:', result);
    } catch (error) {
      console.error('Error in scheduled status update:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok"
  });
  
  console.log('Status update scheduled for 12:01 AM daily');
};

// Clean up old tracking records daily at 2 AM
const scheduleCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled cleanup...');
    try {
      await alertService.cleanupOldTracking();
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error in scheduled cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok"
  });
  
  console.log('Cleanup scheduled for 2:00 AM daily');
};

// เริ่มต้น cron jobs ทั้งหมด
exports.initializeCronJobs = () => {
  console.log('Initializing cron jobs...');
  
  // Schedule alert monitoring
  scheduleAlertMonitoring();
  
  // Schedule status updates
  scheduleStatusUpdate();
  
  // Schedule cleanup
  scheduleCleanup();
  
  console.log('All cron jobs initialized');
};

// หยุด cron jobs ทั้งหมด (สำหรับ graceful shutdown)
exports.stopAllCronJobs = () => {
  console.log('Stopping all cron jobs...');
  cron.getTasks().forEach(task => task.stop());
  console.log('All cron jobs stopped');
};
