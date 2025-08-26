const { sendMail } = require('./services/emailService');

async function testEmail() {
  console.log('Testing email service...');
  
  try {
    const result = await sendMail({
      to: 'moonlightvilip@gmail.com',
      subject: 'Test Alert - Contract Management System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">ทดสอบระบบแจ้งเตือน</h2>
          <p>นี่คือการทดสอบการส่งอีเมลจากระบบจัดการสัญญา</p>
          <p>หากคุณได้รับอีเมลนี้ แสดงว่าระบบแจ้งเตือนทำงานได้ปกติ</p>
          <hr>
          <p style="color: #6b7280; font-size: 12px;">
            ส่งเมื่อ: ${new Date().toLocaleString('th-TH')}
          </p>
        </div>
      `
    });
    
    console.log('✅ Email test successful!', result);
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

testEmail();
