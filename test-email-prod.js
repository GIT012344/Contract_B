/**
 * Test Email Service for Production
 * Run this to test if email service works correctly
 */

require('dotenv').config();

// Test the email service directly
async function testEmailService() {
  console.log('\n========================================');
  console.log('📧 Testing Email Service Configuration');
  console.log('========================================\n');
  
  // Check environment variables
  console.log('1️⃣ Checking Environment Variables:');
  console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
  console.log('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Not set');
  console.log('   EMAIL_FROM:', process.env.EMAIL_FROM || 'Using default');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Email credentials not configured!');
    console.log('\nPlease set these environment variables:');
    console.log('  EMAIL_USER=your-email@gmail.com');
    console.log('  EMAIL_PASSWORD=your-app-password');
    console.log('\nFor Gmail App Password:');
    console.log('  1. Enable 2-Step Verification');
    console.log('  2. Go to https://myaccount.google.com/apppasswords');
    console.log('  3. Generate app password for "Mail"');
    process.exit(1);
  }
  
  console.log('2️⃣ Loading Email Service...');
  const { sendMail } = require('./services/emailService');
  
  // Wait for service to initialize
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  console.log('\n3️⃣ Sending Test Email...');
  
  const testRecipient = process.env.TEST_EMAIL || process.env.EMAIL_USER;
  console.log('   To:', testRecipient);
  
  try {
    const result = await sendMail({
      to: testRecipient,
      subject: '✅ Contract System - Email Service Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10B981;">✅ Email Service Working!</h2>
          <p>This is a test email from the Contract Management System.</p>
          <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>Server Time: ${new Date().toLocaleString()}</li>
            <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
            <li>Email Service: Gmail SMTP</li>
            <li>Connection: ${process.env.DB_HOST ? 'Production' : 'Local'}</li>
          </ul>
          <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 12px;">
            This is an automated test email. If you received this, your email configuration is working correctly.
          </p>
        </div>
      `,
      text: 'Email Service Test - If you can read this, email is working!'
    });
    
    console.log('\n✅ SUCCESS! Email sent successfully');
    console.log('   Message ID:', result.messageId);
    
    if (result.warning) {
      console.log('⚠️ Warning:', result.warning);
    }
    
  } catch (error) {
    console.error('\n❌ FAILED to send email');
    console.error('   Error:', error.message);
    console.log('\n📋 Troubleshooting Tips:');
    console.log('   1. Check your Gmail account allows less secure apps');
    console.log('   2. Or better: Use App Password (recommended)');
    console.log('   3. Check internet connection');
    console.log('   4. Verify EMAIL_USER and EMAIL_PASSWORD are correct');
    console.log('   5. For Gmail: The password should be 16 characters with spaces');
    console.log('      Example: "xxxx xxxx xxxx xxxx"');
  }
  
  console.log('\n========================================');
  console.log('📧 Email Test Complete');
  console.log('========================================\n');
  
  // Keep process alive for a moment to ensure all logs are written
  setTimeout(() => process.exit(0), 2000);
}

// Run the test
testEmailService().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
