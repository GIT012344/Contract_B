// Simple email test script
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Testing email configuration...\n');
  
  // Create transporter with Gmail app password
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'moonlightvilip@gmail.com',
      pass: 'lwnj edbh cnby uvuq' // App password
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log('✅ Email server connection successful!\n');
  } catch (error) {
    console.error('❌ Email server connection failed:', error.message);
    return;
  }

  // Send test email
  try {
    const info = await transporter.sendMail({
      from: 'Contract Alert System <moonlightvilip@gmail.com>',
      to: 'moonlightvilip@gmail.com',
      subject: 'ทดสอบระบบแจ้งเตือนสัญญา - Test Alert System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #2563eb;">✅ ทดสอบระบบแจ้งเตือนสำเร็จ</h2>
          <p><strong>ระบบแจ้งเตือนทำงานได้ปกติ!</strong></p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
          <p>ระบบพร้อมส่งการแจ้งเตือน:</p>
          <ul>
            <li>📅 แจ้งเตือนสัญญาใกล้หมดอายุ</li>
            <li>📋 แจ้งเตือนงวดงานใกล้ถึงกำหนด</li>
            <li>📧 ส่งอีเมลอัตโนมัติตามกำหนดเวลา</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            ทดสอบเมื่อ: ${new Date().toLocaleString('th-TH')}<br>
            ส่งจาก: Contract Management System
          </p>
        </div>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('\n📧 Please check the inbox of moonlightvilip@gmail.com');
    
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();
