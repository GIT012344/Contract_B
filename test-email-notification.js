require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmailNotification() {
  console.log('=== Testing Email Notification System ===\n');
  
  // Display configuration
  console.log('Configuration:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER || 'git.itstaff@gmail.com');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'Contract Alert System <git.itstaff@gmail.com>');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***configured***' : 'Using default');
  
  try {
    console.log('\nSending test notification...');
    
    // Test email data
    const testData = {
      to: process.env.EMAIL_USER || 'git.itstaff@gmail.com',
      subject: 'ทดสอบระบบแจ้งเตือน - Contract Management System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">📧 ทดสอบระบบแจ้งเตือนอีเมล</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #4a5568; font-size: 16px;">
              ระบบแจ้งเตือนอัตโนมัติทำงานปกติ ✅
            </p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-top: 0;">ประเภทการแจ้งเตือนที่รองรับ:</h3>
              <ul style="color: #4a5568;">
                <li>🔔 แจ้งเตือนสัญญาใกล้หมดอายุ (30 วันล่วงหน้า)</li>
                <li>📅 แจ้งเตือนงวดงานใกล้ครบกำหนด (ตามที่กำหนดในแต่ละงวด)</li>
                <li>📝 แจ้งเตือนสร้างสัญญาใหม่</li>
                <li>✏️ แจ้งเตือนแก้ไขสัญญา</li>
                <li>❌ แจ้งเตือนลบสัญญา</li>
              </ul>
            </div>
            
            <div style="background: #edf2f7; padding: 15px; border-radius: 8px;">
              <p style="color: #718096; margin: 0; font-size: 14px;">
                <strong>วันที่ทดสอบ:</strong> ${new Date().toLocaleString('th-TH', { 
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          
          <div style="background: #2d3748; color: #a0aec0; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
            Contract Management System © 2024
          </div>
        </div>
      `,
      text: 'ทดสอบระบบแจ้งเตือนอีเมล - Contract Management System'
    };
    
    const result = await emailService.sendMail(testData);
    
    console.log('\n✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('\n📬 Please check your inbox at:', testData.to);
    
  } catch (error) {
    console.error('\n❌ Failed to send test email:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 Email Authentication Failed - Solutions:');
      console.log('1. Enable 2-Step Verification for your Gmail account');
      console.log('2. Generate an App Password:');
      console.log('   • Go to: https://myaccount.google.com/apppasswords');
      console.log('   • Create a new app password for "Mail"');
      console.log('   • Update EMAIL_PASSWORD in .env file with the generated password');
      console.log('3. Make sure "Less secure app access" is turned ON (if not using App Password)');
    }
  }
}

// Test automated notification function
async function testAutomatedNotifications() {
  console.log('\n=== Testing Automated Notification Check ===\n');
  
  try {
    const alertService = require('./services/alertService');
    console.log('Running automated check for notifications...');
    await alertService.checkAndSendAlerts();
    console.log('✅ Automated notification check completed');
  } catch (error) {
    console.error('❌ Automated notification check failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testEmailNotification();
  await testAutomatedNotifications();
}

runTests();
