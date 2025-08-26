const db = require('./db');
const { DateTime } = require('luxon');
const { sendMail } = require('./services/emailService');
const config = require('./config/config');

async function testAlertSystem() {
  console.log('\n🔍 ตรวจสอบระบบแจ้งเตือนอีเมล\n');
  console.log('วันที่ปัจจุบัน:', DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss'));
  
  try {
    // 1. ตรวจสอบสัญญาที่ใกล้หมดอายุ
    console.log('\n📋 ตรวจสอบสัญญาที่ใกล้หมดอายุ...');
    const expiringQuery = `
      SELECT 
        id, contract_no, contact_name, status, 
        end_date::date as end_date,
        (end_date::date - CURRENT_DATE) as days_remaining,
        alert_emails,
        department
      FROM contracts
      WHERE deleted_flag = FALSE 
        AND end_date IS NOT NULL
        AND (end_date::date - CURRENT_DATE) BETWEEN 0 AND 7
      ORDER BY days_remaining ASC
    `;
    
    const expiring = await db.query(expiringQuery);
    console.log(`พบสัญญาใกล้หมดอายุ: ${expiring.rows.length} สัญญา`);
    
    if (expiring.rows.length > 0) {
      console.log('\nรายละเอียดสัญญา:');
      expiring.rows.forEach(c => {
        console.log(`  - ${c.contract_no}: ${c.contact_name || 'ไม่มีชื่อ'}`);
        console.log(`    สถานะ: ${c.status}`);
        console.log(`    หมดอายุ: ${DateTime.fromJSDate(c.end_date).toFormat('dd/MM/yyyy')}`);
        console.log(`    เหลือ: ${c.days_remaining} วัน`);
        console.log(`    อีเมล: ${c.alert_emails || 'ไม่มี'}`);
        console.log('');
      });
      
      // 2. ตรวจสอบสัญญา KASD โดยเฉพาะ
      console.log('\n🔎 ตรวจสอบสัญญา KASD:');
      const kasd = expiring.rows.find(c => c.contract_no === 'KASD');
      if (kasd) {
        console.log('พบสัญญา KASD:');
        console.log('  Status:', kasd.status);
        console.log('  Alert Emails:', kasd.alert_emails);
        
        // ถ้า status ไม่ใช่ ACTIVE ให้อัพเดท
        if (kasd.status !== 'ACTIVE') {
          console.log(`\n⚠️ สัญญา KASD มีสถานะเป็น ${kasd.status} กำลังเปลี่ยนเป็น ACTIVE...`);
          await db.query(
            `UPDATE contracts SET status = 'ACTIVE' WHERE id = $1`,
            [kasd.id]
          );
          console.log('✅ อัพเดทสถานะเป็น ACTIVE แล้ว');
        }
        
        // 3. ทดสอบส่งอีเมลแจ้งเตือน
        if (kasd.alert_emails) {
          console.log('\n📧 ทดสอบส่งอีเมลแจ้งเตือน...');
          const emails = kasd.alert_emails.split(',').map(e => e.trim()).filter(Boolean);
          
          const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #d9534f;">⚠️ แจ้งเตือนสัญญาใกล้หมดอายุ</h2>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>เลขที่สัญญา:</strong> ${kasd.contract_no}</p>
                <p><strong>ชื่อสัญญา:</strong> ${kasd.contact_name || '-'}</p>
                <p><strong>วันที่หมดอายุ:</strong> ${DateTime.fromJSDate(kasd.end_date).toFormat('dd/MM/yyyy')}</p>
                <p><strong>เหลือเวลา:</strong> <span style="color: #d9534f; font-weight: bold;">${kasd.days_remaining} วัน</span></p>
                <p><strong>หน่วยงาน:</strong> ${kasd.department || '-'}</p>
              </div>
              <p>กรุณาดำเนินการต่ออายุหรือปิดสัญญาตามความเหมาะสม</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
              <p style="color: #666; font-size: 12px;">
                ส่งจากระบบจัดการสัญญา - ${DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss')}
              </p>
            </div>
          `;
          
          try {
            const result = await sendMail({
              to: emails.join(', '),
              subject: `[แจ้งเตือน] สัญญา ${kasd.contract_no} ใกล้หมดอายุ (เหลือ ${kasd.days_remaining} วัน)`,
              html: html
            });
            console.log('✅ ส่งอีเมลสำเร็จ!');
            console.log('   ส่งไปที่:', emails.join(', '));
          } catch (error) {
            console.error('❌ ส่งอีเมลล้มเหลว:', error.message);
          }
        } else {
          console.log('⚠️ สัญญา KASD ไม่มีอีเมลแจ้งเตือน');
        }
      } else {
        console.log('❌ ไม่พบสัญญา KASD ในรายการที่ใกล้หมดอายุ');
        
        // ตรวจสอบสัญญา KASD ทั้งหมด
        console.log('\n🔍 ค้นหาสัญญา KASD ทั้งหมด...');
        const allKasd = await db.query(
          `SELECT id, contract_no, status, end_date, alert_emails, deleted_flag
           FROM contracts 
           WHERE contract_no = 'KASD'`
        );
        
        if (allKasd.rows.length > 0) {
          console.log('พบสัญญา KASD:');
          allKasd.rows.forEach(c => {
            console.log(`  ID: ${c.id}`);
            console.log(`  Status: ${c.status}`);
            console.log(`  End Date: ${c.end_date}`);
            console.log(`  Alert Emails: ${c.alert_emails}`);
            console.log(`  Deleted: ${c.deleted_flag}`);
          });
        }
      }
    } else {
      console.log('ไม่พบสัญญาที่ใกล้หมดอายุ');
    }
    
    // 4. รัน Alert Job
    console.log('\n🚀 รันระบบแจ้งเตือนทั้งหมด...\n');
    const alertJob = require('./services/alertJob');
    await alertJob.runAlertJob();
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
  } finally {
    await db.end();
    console.log('\n✅ ทดสอบเสร็จสิ้น');
  }
}

// รันทันที
testAlertSystem();
