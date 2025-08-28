module.exports = {
  ALERT_CONTRACT_EXPIRY_DAYS: 30, // จำนวนวันล่วงหน้าสำหรับแจ้งเตือนหมดอายุสัญญา
  ALERT_PERIOD_DUE_DAYS: 10, // จำนวนวันล่วงหน้าสำหรับแจ้งเตือนงวดงาน
  EMAIL_USER: process.env.EMAIL_USER || 'git.itstaff@gmail.com',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || 'dmxl vaxj reav jlys',
  EMAIL_SENDER: process.env.EMAIL_FROM || 'Contract Alert System <git.itstaff@gmail.com>', // อีเมลกลางสำหรับส่งแจ้งเตือน
  UPLOAD_PATH: './uploads',
  LOG_PATH: './logs',
};