const pool = require('../config/database');
const { format, startOfMonth, endOfMonth, subMonths } = require('date-fns');

// Get comprehensive dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Build WHERE clause
    let whereClause = '';
    const params = [];
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause = `WHERE c.created_at BETWEEN $${params.length - 1} AND $${params.length}`;
    }
    
    if (department) {
      params.push(department);
      whereClause += whereClause ? ` AND c.department = $${params.length}` : `WHERE c.department = $${params.length}`;
    }

    // Get contract statistics
    const contractStats = await pool.query(`
      SELECT 
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
        COUNT(CASE WHEN status = 'PENDING' OR status = 'CRTD' THEN 1 END) as pending_contracts,
        COUNT(CASE WHEN status = 'DELETED' THEN 1 END) as deleted_contracts,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_contracts,
        SUM(CAST(contract_value AS DECIMAL)) as total_value,
        AVG(CAST(contract_value AS DECIMAL)) as avg_value
      FROM contracts c
      ${whereClause}
    `, params);

    // Get period statistics  
    const periodStats = await pool.query(`
      SELECT 
        COUNT(*) as total_periods,
        COUNT(CASE WHEN status = 'รอส่งมอบ' OR status = 'กำลังดำเนินการ' THEN 1 END) as pending_periods,
        COUNT(CASE WHEN status = 'เสร็จสิ้น' THEN 1 END) as completed_periods,
        COUNT(CASE WHEN status != 'เสร็จสิ้น' AND due_date < CURRENT_DATE THEN 1 END) as overdue_periods,
        SUM(CAST(period_value AS DECIMAL)) as total_period_value,
        AVG(CAST(period_value AS DECIMAL)) as avg_period_value
      FROM contract_periods cp
      INNER JOIN contracts c ON cp.contract_id = c.id
      ${whereClause}
    `, params);

    // Get alerts statistics
    const alertStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT c.id) as contracts_with_alerts,
        COUNT(DISTINCT cp.id) as periods_with_alerts
      FROM contracts c
      LEFT JOIN contract_periods cp ON c.id = cp.contract_id
      WHERE (c.alert_days IS NOT NULL AND c.alert_days > 0)
         OR (cp.alert_days IS NOT NULL AND cp.alert_days > 0)
      ${whereClause ? ' AND ' + whereClause.replace('WHERE', '') : ''}
    `, params);

    res.json({
      contracts: contractStats.rows[0],
      periods: periodStats.rows[0],
      alerts: alertStats.rows[0],
      dateRange: { startDate, endDate },
      department
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
};

// Get department-wise statistics
exports.getDepartmentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause = `WHERE created_at BETWEEN $1 AND $2`;
    }

    const result = await pool.query(`
      SELECT 
        department,
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'PENDING' OR status = 'CRTD' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'DELETED' THEN 1 END) as deleted,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired,
        SUM(CAST(contract_value AS DECIMAL)) as total_value,
        AVG(CAST(contract_value AS DECIMAL)) as avg_value,
        MIN(start_date) as earliest_contract,
        MAX(end_date) as latest_contract
      FROM contracts
      ${whereClause}
      GROUP BY department
      ORDER BY total_contracts DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting department stats:', error);
    res.status(500).json({ error: 'Failed to get department statistics' });
  }
};

// Get timeline analysis (monthly trends)
exports.getTimelineAnalysis = async (req, res) => {
  try {
    const { months = 12 } = req.query;
    
    // Get monthly contract creation trends
    const contractTrends = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as new_contracts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired,
        SUM(CAST(contract_value AS DECIMAL)) as total_value
      FROM contracts
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months')
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);

    // Get monthly period completion trends
    const periodTrends = await pool.query(`
      SELECT 
        TO_CHAR(due_date, 'YYYY-MM') as month,
        COUNT(*) as total_periods,
        COUNT(CASE WHEN status = 'เสร็จสิ้น' THEN 1 END) as completed,
        COUNT(CASE WHEN status != 'เสร็จสิ้น' AND due_date < CURRENT_DATE THEN 1 END) as overdue,
        SUM(CAST(period_value AS DECIMAL)) as total_value
      FROM contract_periods
      WHERE due_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months')
      GROUP BY TO_CHAR(due_date, 'YYYY-MM')
      ORDER BY month
    `);

    res.json({
      contractTrends: contractTrends.rows,
      periodTrends: periodTrends.rows
    });
  } catch (error) {
    console.error('Error getting timeline analysis:', error);
    res.status(500).json({ error: 'Failed to get timeline analysis' });
  }
};

// Get financial summary
exports.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'department' } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause = `WHERE c.created_at BETWEEN $1 AND $2`;
    }

    let groupByColumn = groupBy === 'type' ? 'c.contract_type' : 'c.department';

    const financialData = await pool.query(`
      SELECT 
        ${groupByColumn} as category,
        COUNT(DISTINCT c.id) as contract_count,
        SUM(CAST(c.contract_value AS DECIMAL)) as total_contract_value,
        AVG(CAST(c.contract_value AS DECIMAL)) as avg_contract_value,
        COUNT(cp.id) as period_count,
        SUM(CAST(cp.period_value AS DECIMAL)) as total_period_value,
        SUM(CASE WHEN cp.status = 'เสร็จสิ้น' THEN CAST(cp.period_value AS DECIMAL) ELSE 0 END) as completed_value,
        SUM(CASE WHEN cp.status != 'เสร็จสิ้น' THEN CAST(cp.period_value AS DECIMAL) ELSE 0 END) as pending_value
      FROM contracts c
      LEFT JOIN contract_periods cp ON c.id = cp.contract_id
      ${whereClause}
      GROUP BY ${groupByColumn}
      ORDER BY total_contract_value DESC NULLS LAST
    `, params);

    // Get overall summary
    const summary = await pool.query(`
      SELECT 
        SUM(CAST(c.contract_value AS DECIMAL)) as total_budget,
        SUM(CASE WHEN cp.status = 'เสร็จสิ้น' THEN CAST(cp.period_value AS DECIMAL) ELSE 0 END) as spent_amount,
        SUM(CASE WHEN cp.status != 'เสร็จสิ้น' THEN CAST(cp.period_value AS DECIMAL) ELSE 0 END) as remaining_amount,
        COUNT(DISTINCT c.id) as total_contracts,
        COUNT(DISTINCT CASE WHEN c.status = 'ACTIVE' THEN c.id END) as active_contracts
      FROM contracts c
      LEFT JOIN contract_periods cp ON c.id = cp.contract_id
      ${whereClause}
    `, params);

    res.json({
      breakdown: financialData.rows,
      summary: summary.rows[0],
      groupBy,
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error getting financial summary:', error);
    res.status(500).json({ error: 'Failed to get financial summary' });
  }
};

// Get top contractors
exports.getTopContractors = async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    
    let whereClause = '';
    const params = [limit];
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause = `WHERE created_at BETWEEN $2 AND $3`;
    }

    const result = await pool.query(`
      SELECT 
        contact_name as contractor,
        COUNT(*) as contract_count,
        SUM(CAST(contract_value AS DECIMAL)) as total_value,
        AVG(CAST(contract_value AS DECIMAL)) as avg_value,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_contracts,
        STRING_AGG(DISTINCT department, ', ') as departments
      FROM contracts
      ${whereClause}
      GROUP BY contact_name
      HAVING contact_name IS NOT NULL AND contact_name != ''
      ORDER BY total_value DESC NULLS LAST
      LIMIT $1
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting top contractors:', error);
    res.status(500).json({ error: 'Failed to get top contractors' });
  }
};

// Get alert summary
exports.getAlertSummary = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Contracts expiring soon
    const expiringContracts = await pool.query(`
      SELECT 
        id,
        contract_no,
        department,
        end_date,
        alert_days,
        DATE_PART('day', end_date - CURRENT_DATE) as days_remaining,
        contact_name,
        contract_value
      FROM contracts
      WHERE status = 'ACTIVE'
        AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
      ORDER BY end_date
    `);

    // Periods due soon
    const duePeriods = await pool.query(`
      SELECT 
        cp.id,
        cp.period_no,
        cp.due_date,
        cp.alert_days,
        cp.period_value,
        DATE_PART('day', cp.due_date - CURRENT_DATE) as days_remaining,
        c.contract_no,
        c.department,
        c.contact_name
      FROM contract_periods cp
      INNER JOIN contracts c ON cp.contract_id = c.id
      WHERE cp.status != 'เสร็จสิ้น'
        AND cp.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
      ORDER BY cp.due_date
    `);

    // Overdue items
    const overdueItems = await pool.query(`
      SELECT 
        'contract' as type,
        id,
        contract_no as item_no,
        department,
        end_date as due_date,
        DATE_PART('day', CURRENT_DATE - end_date) as days_overdue,
        contact_name,
        contract_value as value
      FROM contracts
      WHERE status = 'ACTIVE'
        AND end_date < CURRENT_DATE
      UNION ALL
      SELECT 
        'period' as type,
        cp.id,
        CONCAT(c.contract_no, '-', cp.period_no) as item_no,
        c.department,
        cp.due_date,
        DATE_PART('day', CURRENT_DATE - cp.due_date) as days_overdue,
        c.contact_name,
        cp.period_value as value
      FROM contract_periods cp
      INNER JOIN contracts c ON cp.contract_id = c.id
      WHERE cp.status != 'เสร็จสิ้น'
        AND cp.due_date < CURRENT_DATE
      ORDER BY days_overdue DESC
    `);

    res.json({
      expiringContracts: expiringContracts.rows,
      duePeriods: duePeriods.rows,
      overdueItems: overdueItems.rows,
      summary: {
        totalExpiring: expiringContracts.rows.length,
        totalDue: duePeriods.rows.length,
        totalOverdue: overdueItems.rows.length
      }
    });
  } catch (error) {
    console.error('Error getting alert summary:', error);
    res.status(500).json({ error: 'Failed to get alert summary' });
  }
};

// Get performance metrics
exports.getPerformanceMetrics = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    // Contract completion rate
    const completionRate = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'MM') as month,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'ACTIVE' OR status = 'EXPIRED' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'DELETED' THEN 1 END) as cancelled,
        ROUND(COUNT(CASE WHEN status = 'ACTIVE' OR status = 'EXPIRED' THEN 1 END)::NUMERIC / 
              NULLIF(COUNT(*)::NUMERIC, 0) * 100, 2) as success_rate
      FROM contracts
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY TO_CHAR(created_at, 'MM')
      ORDER BY month
    `, [year]);

    // Period delivery performance
    const deliveryPerformance = await pool.query(`
      SELECT 
        TO_CHAR(due_date, 'MM') as month,
        COUNT(*) as total_periods,
        COUNT(CASE WHEN status = 'เสร็จสิ้น' AND actual_date <= due_date THEN 1 END) as on_time,
        COUNT(CASE WHEN status = 'เสร็จสิ้น' AND actual_date > due_date THEN 1 END) as late,
        COUNT(CASE WHEN status != 'เสร็จสิ้น' AND due_date < CURRENT_DATE THEN 1 END) as overdue,
        ROUND(COUNT(CASE WHEN status = 'เสร็จสิ้น' AND actual_date <= due_date THEN 1 END)::NUMERIC / 
              NULLIF(COUNT(CASE WHEN status = 'เสร็จสิ้น' THEN 1 END)::NUMERIC, 0) * 100, 2) as on_time_rate
      FROM contract_periods
      WHERE EXTRACT(YEAR FROM due_date) = $1
      GROUP BY TO_CHAR(due_date, 'MM')
      ORDER BY month
    `, [year]);

    // Department performance
    const departmentPerformance = await pool.query(`
      SELECT 
        c.department,
        COUNT(DISTINCT c.id) as contracts,
        COUNT(cp.id) as periods,
        COUNT(CASE WHEN cp.status = 'เสร็จสิ้น' THEN 1 END) as completed_periods,
        ROUND(COUNT(CASE WHEN cp.status = 'เสร็จสิ้น' THEN 1 END)::NUMERIC / 
              NULLIF(COUNT(cp.id)::NUMERIC, 0) * 100, 2) as completion_rate,
        SUM(CAST(c.contract_value AS DECIMAL)) as total_value,
        AVG(DATE_PART('day', cp.actual_date - cp.due_date)) as avg_delay_days
      FROM contracts c
      LEFT JOIN contract_periods cp ON c.id = cp.contract_id
      WHERE EXTRACT(YEAR FROM c.created_at) = $1
      GROUP BY c.department
      ORDER BY completion_rate DESC NULLS LAST
    `, [year]);

    res.json({
      year,
      completionRate: completionRate.rows,
      deliveryPerformance: deliveryPerformance.rows,
      departmentPerformance: departmentPerformance.rows
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
};

// Export report data
exports.exportReport = async (req, res) => {
  try {
    const { type, format, startDate, endDate } = req.query;
    
    let data;
    switch (type) {
      case 'contracts':
        const contracts = await pool.query(`
          SELECT 
            contract_no as "เลขที่สัญญา",
            department as "แผนก",
            contact_name as "ผู้ติดต่อ",
            contract_type as "ประเภท",
            start_date as "วันเริ่มต้น",
            end_date as "วันสิ้นสุด",
            contract_value as "มูลค่า",
            status as "สถานะ",
            alert_days as "วันแจ้งเตือน"
          FROM contracts
          WHERE created_at BETWEEN $1 AND $2
          ORDER BY created_at DESC
        `, [startDate || '1900-01-01', endDate || '2100-12-31']);
        data = contracts.rows;
        break;
        
      case 'periods':
        const periods = await pool.query(`
          SELECT 
            c.contract_no as "เลขที่สัญญา",
            cp.period_no as "งวดที่",
            cp.due_date as "วันครบกำหนด",
            cp.period_value as "มูลค่างวด",
            cp.status as "สถานะ",
            cp.actual_date as "วันที่ส่งมอบจริง",
            cp.alert_days as "วันแจ้งเตือน"
          FROM contract_periods cp
          INNER JOIN contracts c ON cp.contract_id = c.id
          WHERE cp.due_date BETWEEN $1 AND $2
          ORDER BY cp.due_date
        `, [startDate || '1900-01-01', endDate || '2100-12-31']);
        data = periods.rows;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    // For now, return JSON. In production, you'd convert to CSV/Excel
    res.json({
      type,
      format,
      dateRange: { startDate, endDate },
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};
