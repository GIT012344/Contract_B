// ทดสอบระบบแจ้งเตือนงวดงานแบบง่าย
require('dotenv').config();
const alertJob = require('./services/alertJob');

async function testPeriodAlert() {
  console.log('========================================');
  console.log('🔔 ทดสอบระบบแจ้งเตือนงวดงาน');
  console.log('========================================\n');
  
  try {
    console.log('กำลังรัน Alert Job...\n');
    await alertJob.run();
    console.log('\n✅ Alert Job ทำงานเสร็จสิ้น');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
  }
}

// รันทันที
testPeriodAlert();
