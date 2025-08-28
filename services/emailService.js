const nodemailer = require('nodemailer');
const config = require('../config/config');

// สร้าง transporter สำหรับ Gmail
let transporter;

// Check if email credentials are available
const emailUser = process.env.EMAIL_USER || config.EMAIL_USER;
const emailPass = process.env.EMAIL_PASSWORD || config.EMAIL_PASSWORD;

if (emailUser && emailPass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
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
} else {
  console.warn('⚠️ Email service not configured: Missing EMAIL_USER or EMAIL_PASSWORD');
  // Create a dummy transporter that won't send emails
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('📧 Email service not configured. Would have sent:', mailOptions);
      return { messageId: 'dummy-message-id' };
    }
  };
}

async function sendMail({ to, subject, text, html }) {
  try {
    // ตรวจสอบ email addresses
    if (!to || to.length === 0) {
      throw new Error('No recipient email addresses provided');
    }
    
    // Check if email service is configured
    const emailUser = process.env.EMAIL_USER || config.EMAIL_USER;
    if (!emailUser) {
      console.warn('⚠️ Email not sent: Email service not configured');
      return { messageId: 'not-configured', warning: 'Email service not configured' };
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || `Contract Alert System <${emailUser}>`,
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