const nodemailer = require('nodemailer');
const config = require('../config/config');

// สร้าง transporter สำหรับ Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || config.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD || config.EMAIL_PASSWORD
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
      from: process.env.EMAIL_FROM || `Contract Alert System <${process.env.EMAIL_USER || config.EMAIL_USER}>`,
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