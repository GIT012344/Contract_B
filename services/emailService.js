const nodemailer = require('nodemailer');
const config = require('../config/config');

// สร้าง transporter สำหรับ Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.EMAIL_SENDER,
    pass: 'lwnj edbh cnby uvuq', // App Password for moonlightvilip@gmail.com
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ตรวจสอบการเชื่อมต่อ
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Email service connection failed:', error.message);
  } else {
    console.log('✅ Email service is ready to send messages');
  }
});

async function sendMail({ to, subject, text, html }) {
  try {
    // ตรวจสอบ email addresses
    if (!to || to.length === 0) {
      throw new Error('No recipient email addresses provided');
    }
    
    const mailOptions = {
      from: `Contract Alert System <${config.EMAIL_SENDER}>`,
      to,
      subject,
      text: text || 'This is an HTML email. Please view it in an HTML-capable email client.',
      html,
    };
    
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`   Subject: ${subject}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully! Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
}

module.exports = { sendMail };