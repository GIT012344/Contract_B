const db = require('../db');

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get contract statistics
    const contractStats = await db.query(`
      SELECT 
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_contracts,
        COUNT(CASE WHEN status = 'CRTD' THEN 1 END) as created_contracts,
        COUNT(DISTINCT id) as total_contract_count
      FROM contracts
      WHERE status != 'DELETED'
    `);

    // Get period statistics
    const periodStats = await db.query(`
      SELECT 
        COUNT(*) as total_periods,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_periods,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_periods,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_periods
      FROM periods
    `);

    // Get department distribution
    const departmentStats = await db.query(`
      SELECT 
        department,
        COUNT(*) as contract_count,
        COUNT(DISTINCT id) as unique_contracts
      FROM contracts
      WHERE status != 'DELETED'
      GROUP BY department
      ORDER BY contract_count DESC
    `);

    // Get monthly trend (last 12 months)
    const monthlyTrend = await db.query(`
      SELECT 
        TO_CHAR(start_date, 'YYYY-MM') as month,
        COUNT(*) as contract_count,
        COUNT(DISTINCT id) as unique_contracts
      FROM contracts
      WHERE status != 'DELETED'
        AND start_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(start_date, 'YYYY-MM')
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      data: {
        contracts: contractStats.rows[0],
        periods: periodStats.rows[0],
        departments: departmentStats.rows,
        monthlyTrend: monthlyTrend.rows,
        totalPeriodCount: periodStats.rows[0]?.total_periods || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ',
      error: error.message 
    });
  }
};

// Get contract reports with filters
exports.getContractReports = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      department, 
      status, 
      sortBy = 'start_date',
      sortOrder = 'DESC' 
    } = req.query;

    let query = `
      SELECT 
        c.*,
        COUNT(p.id) as period_count,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_periods
      FROM contracts c
      LEFT JOIN periods p ON c.id = p.contract_id
      WHERE c.status != 'DELETED'
    `;

    const params = [];
    let paramIndex = 1;

    // Add filters
    if (startDate) {
      query += ` AND c.start_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND c.end_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (department && department !== 'all') {
      query += ` AND c.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` GROUP BY c.id ORDER BY c.${sortBy} ${sortOrder}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching contract reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงรายงานสัญญา',
      error: error.message 
    });
  }
};

// Get period reports (replaced financial reports)
exports.getPeriodReports = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), department } = req.query;

    // Monthly period summary
    let monthlyQuery = `
      SELECT 
        TO_CHAR(p.due_date, 'MM') as month,
        TO_CHAR(p.due_date, 'Mon') as month_name,
        COUNT(DISTINCT p.contract_id) as contract_count,
        COUNT(*) as period_count,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_periods,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_periods
      FROM periods p
      JOIN contracts c ON p.contract_id = c.id
      WHERE EXTRACT(YEAR FROM p.due_date) = $1
        AND c.status != 'DELETED'
    `;

    const params = [year];
    let paramIndex = 2;

    if (department && department !== 'all') {
      monthlyQuery += ` AND c.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    monthlyQuery += ` GROUP BY TO_CHAR(p.due_date, 'MM'), TO_CHAR(p.due_date, 'Mon')
                      ORDER BY month`;

    const monthlyResult = await db.query(monthlyQuery, params);

    // Department period breakdown
    const deptQuery = `
      SELECT 
        c.department,
        COUNT(DISTINCT c.id) as contract_count,
        COUNT(p.id) as total_periods,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_periods,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_periods
      FROM contracts c
      LEFT JOIN periods p ON c.id = p.contract_id
      WHERE c.status != 'DELETED'
        AND EXTRACT(YEAR FROM c.start_date) = $1
      GROUP BY c.department
      ORDER BY contract_count DESC
    `;

    const deptResult = await db.query(deptQuery, [year]);

    // Year-over-year comparison
    const yoyQuery = `
      SELECT 
        EXTRACT(YEAR FROM c.start_date) as year,
        COUNT(DISTINCT c.id) as contract_count,
        COUNT(p.id) as total_periods,
        AVG(CASE WHEN c.id IS NOT NULL THEN 
          (SELECT COUNT(*) FROM periods WHERE contract_id = c.id) 
        END) as avg_periods_per_contract
      FROM contracts c
      LEFT JOIN periods p ON c.id = p.contract_id
      WHERE c.status != 'DELETED'
        AND EXTRACT(YEAR FROM c.start_date) >= $1 - 2
      GROUP BY EXTRACT(YEAR FROM c.start_date)
      ORDER BY year DESC
    `;

    const yoyResult = await db.query(yoyQuery, [year]);

    res.json({
      success: true,
      data: {
        monthly: monthlyResult.rows,
        departments: deptResult.rows,
        yearOverYear: yoyResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching period reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานงวด',
      error: error.message 
    });
  }
};

// Get period analysis
exports.getPeriodAnalysis = async (req, res) => {
  try {
    const { contractId, status } = req.query;

    let query = `
      SELECT 
        p.*,
        c.contract_number,
        c.contract_name,
        c.department
      FROM periods p
      JOIN contracts c ON p.contract_id = c.id
      WHERE c.status != 'DELETED'
    `;

    const params = [];
    let paramIndex = 1;

    if (contractId) {
      query += ` AND p.contract_id = $${paramIndex}`;
      params.push(contractId);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY p.due_date DESC`;

    const periods = await db.query(query, params);

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_periods,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN due_date < CURRENT_DATE AND status = 'pending' THEN 1 END) as overdue
      FROM periods p
      ${contractId ? 'WHERE contract_id = $1' : ''}
    `;

    const summary = await db.query(summaryQuery, contractId ? [contractId] : []);

    res.json({
      success: true,
      data: {
        periods: periods.rows,
        summary: summary.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching period analysis:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการวิเคราะห์งวดงาน',
      error: error.message 
    });
  }
};

// Export report data
exports.exportReport = async (req, res) => {
  try {
    const { type, format, filters } = req.body;

    // Fetch data based on report type
    let data;
    switch (type) {
      case 'contracts':
        const contractQuery = `
          SELECT 
            contract_number as "เลขที่สัญญา",
            contract_name as "ชื่อสัญญา",
            department as "หน่วยงาน",
            (SELECT COUNT(*) FROM periods WHERE contract_id = contracts.id) as "จำนวนงวด",
            start_date as "วันเริ่มต้น",
            end_date as "วันสิ้นสุด",
            status as "สถานะ"
          FROM contracts
          WHERE status != 'DELETED'
          ORDER BY start_date DESC
        `;
        const contractResult = await db.query(contractQuery);
        data = contractResult.rows;
        break;

      case 'periods':
        const periodQuery = `
          SELECT 
            c.contract_number as "เลขที่สัญญา",
            c.contract_name as "ชื่อสัญญา",
            p.period_no as "งวดที่",
            p.description as "รายละเอียด",
            p.due_date as "วันครบกำหนด",
            p.status as "สถานะ"
          FROM periods p
          JOIN contracts c ON p.contract_id = c.id
          WHERE c.status != 'DELETED'
          ORDER BY p.due_date DESC
        `;
        const periodResult = await db.query(periodQuery);
        data = periodResult.rows;
        break;

      default:
        throw new Error('Invalid report type');
    }

    // Return data for frontend to handle export
    res.json({
      success: true,
      data: data,
      metadata: {
        exportDate: new Date().toISOString(),
        recordCount: data.length,
        reportType: type
      }
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการส่งออกรายงาน',
      error: error.message 
    });
  }
};

// Get performance metrics
exports.getPerformanceMetrics = async (req, res) => {
  try {
    // Contract completion rate
    const completionRate = await db.query(`
      SELECT 
        COALESCE(COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END)::float / 
        NULLIF(COUNT(*), 0) * 100, 0) as completion_rate
      FROM contracts
      WHERE status != 'DELETED'
    `);

    // Period completion rate
    const periodCompletion = await db.query(`
      SELECT 
        COALESCE(COUNT(CASE WHEN status = 'completed' THEN 1 END)::float /
        NULLIF(COUNT(*), 0) * 100, 0) as completion_rate
      FROM periods
    `);

    // On-time payment rate
    const onTimeRate = await db.query(`
      SELECT 
        COALESCE(COUNT(CASE WHEN status = 'completed' AND paid_date <= due_date THEN 1 END)::float /
        NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0) * 100, 0) as on_time_rate
      FROM periods
    `);

    // Department performance
    const deptPerformance = await db.query(`
      SELECT 
        c.department,
        COUNT(c.id) as total_contracts,
        AVG(
          CASE 
            WHEN c.status = 'EXPIRED' THEN 100
            WHEN c.status = 'ACTIVE' THEN 
              EXTRACT(EPOCH FROM (CURRENT_DATE - c.start_date)) / 
              NULLIF(EXTRACT(EPOCH FROM (c.end_date - c.start_date)), 0) * 100
            ELSE 0
          END
        ) as progress_rate
      FROM contracts c
      WHERE c.status != 'DELETED'
      GROUP BY c.department
      ORDER BY progress_rate DESC
    `);

    res.json({
      success: true,
      data: {
        completionRate: completionRate.rows[0]?.completion_rate || 0,
        periodCompletionRate: periodCompletion.rows[0]?.completion_rate || 0,
        onTimeRate: onTimeRate.rows[0]?.on_time_rate || 0,
        departmentPerformance: deptPerformance.rows
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงตัวชี้วัดประสิทธิภาพ',
      error: error.message 
    });
  }
};
