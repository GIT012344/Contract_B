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
    },
    // เพิ่ม connection settings สำหรับ production
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 60000, // 60 seconds timeout
    greetingTimeout: 30000,   // 30 seconds greeting timeout
    socketTimeout: 120000      // 120 seconds socket timeout
  });

  // ตรวจสอบการเชื่อมต่อแบบ non-blocking (ไม่ block server startup)
  setTimeout(() => {
    transporter.verify(function(error, success) {
      if (error) {
        console.error('⚠️ Email verification warning:', error.message);
        console.log('   (Email service will retry when sending actual emails)');
      } else {
        console.log('✅ Email service verified and ready');
      }
    });
  }, 5000); // Delay verification by 5 seconds to not block server startup
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
  
  // Retry logic with exponential backoff
  let retries = 3;
  let delay = 1000; // Start with 1 second delay
  
  while (retries > 0) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully! Message ID:', info.messageId);
      return info;
    } catch (error) {
      retries--;
      
      // Check if it's a connection error that might benefit from retry
      const isRetryableError = 
        error.code === 'ECONNECTION' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message.includes('timeout') ||
        error.message.includes('Connection');
      
      if (retries > 0 && isRetryableError) {
        console.log(`⚠️ Email send failed (${error.code || error.message}), retrying in ${delay/1000}s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        console.error('❌ Failed to send email after all retries:', error.message);
        // Don't throw error to prevent crashing the service
        return { 
          messageId: 'failed', 
          error: error.message,
          warning: 'Email delivery failed but system continues'
        };
      }
    }
  }
}

module.exports = { sendMail };