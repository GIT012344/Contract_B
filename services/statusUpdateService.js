const db = require('../db');

// อัปเดตสถานะสัญญาตามวันที่
exports.updateContractStatuses = async () => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // 1. อัปเดตสัญญาที่เริ่มแล้ว (start_date <= today) จาก CRTD เป็น ACTIVE
    const activateQuery = `
      UPDATE contracts 
      SET status = 'ACTIVE', 
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'SYSTEM'
      WHERE deleted_flag = FALSE 
        AND status = 'CRTD'
        AND start_date <= CURRENT_DATE
      RETURNING id, contract_no
    `;
    const activatedResult = await client.query(activateQuery);
    
    // 2. อัปเดตสัญญาที่หมดอายุแล้ว (end_date < today) จาก ACTIVE เป็น EXPIRED
    const expireQuery = `
      UPDATE contracts 
      SET status = 'EXPIRED',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'SYSTEM'
      WHERE deleted_flag = FALSE 
        AND status = 'ACTIVE'
        AND end_date < CURRENT_DATE
      RETURNING id, contract_no
    `;
    const expiredResult = await client.query(expireQuery);
    
    // 3. อัปเดตสถานะงวดงานที่เลยกำหนดแล้ว
    const overduePeriodQuery = `
      UPDATE contract_periods 
      SET status = 'เลยกำหนด',
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('รอดำเนินการ', 'กำลังดำเนินการ')
        AND due_date < CURRENT_DATE
      RETURNING id, period_no, contract_id
    `;
    const overduePeriodResult = await client.query(overduePeriodQuery);
    
    // 4. ตรวจสอบสัญญาที่งวดงานเสร็จหมดแล้ว
    const checkCompletedQuery = `
      WITH contract_period_status AS (
        SELECT 
          contract_id,
          COUNT(*) as total_periods,
          COUNT(CASE WHEN status = 'เสร็จสิ้น' THEN 1 END) as completed_periods
        FROM contract_periods
        GROUP BY contract_id
      )
      UPDATE contracts c
      SET status = 'COMPLETED',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'SYSTEM'
      FROM contract_period_status cps
      WHERE c.id = cps.contract_id
        AND c.deleted_flag = FALSE
        AND c.status IN ('ACTIVE', 'EXPIRED')
        AND cps.total_periods > 0
        AND cps.total_periods = cps.completed_periods
      RETURNING c.id, c.contract_no
    `;
    const completedResult = await client.query(checkCompletedQuery);
    
    await client.query('COMMIT');
    
    // สรุปผลการอัปเดต
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      updates: {
        activated: activatedResult.rows.length,
        expired: expiredResult.rows.length,
        overduePeriods: overduePeriodResult.rows.length,
        completed: completedResult.rows.length
      },
      details: {
        activatedContracts: activatedResult.rows.map(r => r.contract_no),
        expiredContracts: expiredResult.rows.map(r => r.contract_no),
        completedContracts: completedResult.rows.map(r => r.contract_no)
      }
    };
    
    // Log สรุปการอัปเดต
    if (summary.updates.activated > 0 || summary.updates.expired > 0 || 
        summary.updates.overduePeriods > 0 || summary.updates.completed > 0) {
      console.log('Status update summary:', summary);
      
      // บันทึก log ลงฐานข้อมูล
      await db.query(
        `INSERT INTO user_activity_logs (
          user_id, username, action, action_type, 
          table_name, record_id, details, timestamp
        ) VALUES (
          0, 'SYSTEM', 'Daily status update', 'UPDATE',
          'contracts', NULL, $1, CURRENT_TIMESTAMP
        )`,
        [JSON.stringify(summary)]
      );
    }
    
    return summary;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating contract statuses:', error);
    throw error;
  } finally {
    client.release();
  }
};

// ฟังก์ชันสำหรับอัปเดตสถานะแบบ manual
exports.manualStatusUpdate = async (contractId = null) => {
  try {
    if (contractId) {
      // อัปเดตเฉพาะสัญญาที่ระบุ
      const result = await db.query(
        `UPDATE contracts 
         SET status = CASE
           WHEN end_date < CURRENT_DATE THEN 'EXPIRED'
           WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 'ACTIVE'
           ELSE status
         END,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = 'SYSTEM'
         WHERE id = $1 AND deleted_flag = FALSE
         RETURNING *`,
        [contractId]
      );
      
      return {
        success: true,
        contract: result.rows[0]
      };
    } else {
      // อัปเดตทั้งหมด
      return await exports.updateContractStatuses();
    }
  } catch (error) {
    console.error('Error in manual status update:', error);
    throw error;
  }
};

// ฟังก์ชันตรวจสอบสถานะปัจจุบัน
exports.getStatusSummary = async () => {
  try {
    const query = `
      SELECT 
        status,
        COUNT(*) as count
      FROM contracts
      WHERE deleted_flag = FALSE
      GROUP BY status
      ORDER BY status
    `;
    
    const result = await db.query(query);
    
    const periodQuery = `
      SELECT 
        p.status,
        COUNT(*) as count
      FROM contract_periods p
      JOIN contracts c ON p.contract_id = c.id
      WHERE c.deleted_flag = FALSE
      GROUP BY p.status
      ORDER BY p.status
    `;
    
    const periodResult = await db.query(periodQuery);
    
    return {
      contracts: result.rows,
      periods: periodResult.rows,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting status summary:', error);
    throw error;
  }
};
