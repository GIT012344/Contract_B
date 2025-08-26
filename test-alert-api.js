const axios = require('axios');

const API_URL = 'http://localhost:3010/api';

async function testAlertSystem() {
  try {
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Test email sending
    console.log('\n2. Testing email service...');
    const emailResponse = await axios.post(
      `${API_URL}/alerts/test-email`,
      {
        to: 'moonlightvilip@gmail.com',
        subject: 'ทดสอบระบบแจ้งเตือน - Contract Management',
        content: `
          <h2>ทดสอบการส่งอีเมล</h2>
          <p>หากคุณได้รับอีเมลนี้ แสดงว่าระบบแจ้งเตือนทำงานได้ปกติ</p>
          <p>ทดสอบเมื่อ: ${new Date().toLocaleString('th-TH')}</p>
        `
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Email test response:', emailResponse.data);
    
    // Trigger alert job
    console.log('\n3. Triggering alert job...');
    const alertJobResponse = await axios.post(
      `${API_URL}/alerts/trigger-alert-job`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Alert job response:', alertJobResponse.data);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('Please check the email inbox for test messages.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Wait a bit for server to start
setTimeout(() => {
  testAlertSystem();
}, 2000);
