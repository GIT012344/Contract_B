const pool = require('../db');
const { exportContractsToExcel, exportFinancialToExcel, exportContractsToPDF, exportFinancialToPDF } = require('../services/exportService');

// Get Dashboard Metrics
exports.getDashboardMetrics = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (startDate) {
      whereClause += ` AND c.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ` AND c.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }
    
    if (department) {
      whereClause += ` AND c.department = $${paramIndex++}`;
      params.push(department);
    }
    
    // Get contract metrics
    const contractMetrics = await pool.query(`
      SELECT 
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_contracts,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_contracts,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_contracts,
        COUNT(CASE WHEN status = 'DELETED' THEN 1 END) as deleted_contracts
      FROM contracts c
      ${whereClause}
    `, params);
    
    // Get period metrics
    const periodMetrics = await pool.query(`
      SELECT 
        COUNT(*) as total_periods,
        COUNT(CASE WHEN p.status = 'รอส่งมอบ' THEN 1 END) as pending_periods,
        COUNT(CASE WHEN p.status = 'กำลังดำเนินการ' THEN 1 END) as in_progress_periods,
        COUNT(CASE WHEN p.status = 'เสร็จสิ้น' THEN 1 END) as completed_periods,
        COUNT(CASE WHEN p.status != 'เสร็จสิ้น' AND p.due_date < CURRENT_DATE THEN 1 END) as overdue_periods
      FROM contract_periods p
      INNER JOIN contracts c ON p.contract_id = c.id
      ${whereClause}
    `, params);
    
    // Get financial metrics
    const financialMetrics = await pool.query(`
      SELECT 
        SUM(c.contract_value) as total_value,
        AVG(c.contract_value) as average_value,
        MAX(c.contract_value) as max_value,
        MIN(c.contract_value) as min_value
      FROM contracts c
      ${whereClause}
    `, params);
    
    // Get alert metrics
    const alertMetrics = await pool.query(`
      SELECT 
        COUNT(DISTINCT c.id) as contracts_with_alerts,
        COUNT(CASE WHEN (c.end_date - CURRENT_DATE) <= c.alert_days THEN 1 END) as active_alerts
      FROM contracts c
      WHERE c.alert_days IS NOT NULL AND c.status = 'ACTIVE'
    `);
    
    res.json({
      contracts: contractMetrics.rows[0],
      periods: periodMetrics.rows[0],
      financial: financialMetrics.rows[0],
      alerts: alertMetrics.rows[0]
    });
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to get dashboard metrics' });
  }
};

// Get Contract Summary
exports.getContractSummary = async (req, res) => {
  try {
    const { groupBy = 'status' } = req.query;
    
    let query;
    switch (groupBy) {
      case 'department':
        query = `
          SELECT 
            department as label,
            COUNT(*) as count,
            SUM(contract_value) as total_value
          FROM contracts
          GROUP BY department
          ORDER BY count DESC
        `;
        break;
      case 'type':
        query = `
          SELECT 
            contract_type as label,
            COUNT(*) as count,
            SUM(contract_value) as total_value
          FROM contracts
          GROUP BY contract_type
          ORDER BY count DESC
        `;
        break;
      default:
        query = `
          SELECT 
            status as label,
            COUNT(*) as count,
            SUM(contract_value) as total_value
          FROM contracts
          GROUP BY status
          ORDER BY count DESC
        `;
    }
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting contract summary:', error);
    res.status(500).json({ error: 'Failed to get contract summary' });
  }
};

// Get Contract Trends
exports.getContractTrends = async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    
    let query;
    if (period === 'daily') {
      query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_contracts,
          SUM(contract_value) as total_value
        FROM contracts
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
    } else if (period === 'weekly') {
      query = `
        SELECT 
          DATE_TRUNC('week', created_at) as week,
          COUNT(*) as new_contracts,
          SUM(contract_value) as total_value
        FROM contracts
        WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week
      `;
    } else {
      query = `
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as new_contracts,
          SUM(contract_value) as total_value
        FROM contracts
        WHERE EXTRACT(YEAR FROM created_at) = $1
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month
      `;
    }
    
    const result = await pool.query(query, period === 'monthly' ? [year] : []);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting contract trends:', error);
    res.status(500).json({ error: 'Failed to get contract trends' });
  }
};

// Get Contracts by Status
exports.getContractsByStatus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM contracts
      GROUP BY status
      ORDER BY count DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting contracts by status:', error);
    res.status(500).json({ error: 'Failed to get contracts by status' });
  }
};

// Get Contracts by Department
exports.getContractsByDepartment = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        department,
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        SUM(contract_value) as total_value
      FROM contracts
      GROUP BY department
      ORDER BY total_contracts DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting contracts by department:', error);
    res.status(500).json({ error: 'Failed to get contracts by department' });
  }
};

// Get Expiring Contracts
exports.getExpiringContracts = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        id,
        contract_no,
        contract_name,
        vendor_name,
        department,
        end_date,
        (end_date - CURRENT_DATE) as days_until_expiry,
        contract_value
      FROM contracts
      WHERE status = 'ACTIVE' 
        AND end_date IS NOT NULL
        AND (end_date - CURRENT_DATE) BETWEEN INTERVAL '0 days' AND INTERVAL '1 day' * $1
      ORDER BY days_until_expiry
    `, [days]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting expiring contracts:', error);
    res.status(500).json({ error: 'Failed to get expiring contracts' });
  }
};

// Get Period Summary
exports.getPeriodSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM contract_periods p
      GROUP BY p.status
      ORDER BY count DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting period summary:', error);
    res.status(500).json({ error: 'Failed to get period summary' });
  }
};

// Get Overdue Periods
exports.getOverduePeriods = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.period_no,
        p.period_name,
        p.due_date,
        p.status,
        (CURRENT_DATE - p.due_date) as days_overdue,
        c.contract_no,
        c.contract_name,
        c.department
      FROM contract_periods p
      INNER JOIN contracts c ON p.contract_id = c.id
      WHERE p.status != 'เสร็จสิ้น' 
        AND p.due_date < CURRENT_DATE
      ORDER BY days_overdue DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting overdue periods:', error);
    res.status(500).json({ error: 'Failed to get overdue periods' });
  }
};

// Get Upcoming Periods
exports.getUpcomingPeriods = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        p.id,
        p.period_no,
        p.period_name,
        p.due_date,
        p.status,
        (p.due_date - CURRENT_DATE) as days_until_due,
        c.contract_no,
        c.contract_name,
        c.department
      FROM contract_periods p
      INNER JOIN contracts c ON p.contract_id = c.id
      WHERE p.status != 'เสร็จสิ้น' 
        AND p.due_date >= CURRENT_DATE
        AND (p.due_date - CURRENT_DATE) <= INTERVAL '1 day' * $1
      ORDER BY days_until_due
    `, [days]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting upcoming periods:', error);
    res.status(500).json({ error: 'Failed to get upcoming periods' });
  }
};

// Get Period Performance
exports.getPeriodPerformance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('month', p.due_date) as month,
        COUNT(*) as total_periods,
        COUNT(CASE WHEN p.status = 'เสร็จสิ้น' AND p.actual_date <= p.due_date THEN 1 END) as on_time,
        COUNT(CASE WHEN p.status = 'เสร็จสิ้น' AND p.actual_date > p.due_date THEN 1 END) as late,
        COUNT(CASE WHEN p.status != 'เสร็จสิ้น' AND p.due_date < CURRENT_DATE THEN 1 END) as overdue
      FROM contract_periods p
      WHERE p.due_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', p.due_date)
      ORDER BY month
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting period performance:', error);
    res.status(500).json({ error: 'Failed to get period performance' });
  }
};

// Get Financial Summary
exports.getFinancialSummary = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const result = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Month') as month,
        SUM(contract_value) as total_value,
        AVG(contract_value) as avg_value,
        COUNT(*) as contract_count
      FROM contracts
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY EXTRACT(MONTH FROM created_at), TO_CHAR(created_at, 'Month')
      ORDER BY EXTRACT(MONTH FROM created_at)
    `, [year]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting financial summary:', error);
    res.status(500).json({ error: 'Failed to get financial summary' });
  }
};

// Get Financial by Department
exports.getFinancialByDepartment = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        department,
        SUM(contract_value) as total_value,
        AVG(contract_value) as avg_value,
        MAX(contract_value) as max_value,
        MIN(contract_value) as min_value,
        COUNT(*) as contract_count
      FROM contracts
      WHERE status != 'DELETED'
      GROUP BY department
      ORDER BY total_value DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting financial by department:', error);
    res.status(500).json({ error: 'Failed to get financial by department' });
  }
};

// Get Financial Trends
exports.getFinancialTrends = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH monthly_data AS (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(contract_value) as total_value,
          COUNT(*) as contract_count
        FROM contracts
        WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      )
      SELECT 
        month,
        total_value,
        contract_count,
        LAG(total_value) OVER (ORDER BY month) as prev_value,
        ROUND((total_value - LAG(total_value) OVER (ORDER BY month)) * 100.0 / 
              NULLIF(LAG(total_value) OVER (ORDER BY month), 0), 2) as growth_rate
      FROM monthly_data
      ORDER BY month
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting financial trends:', error);
    res.status(500).json({ error: 'Failed to get financial trends' });
  }
};

// Get Department Performance
exports.getDepartmentPerformance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.department,
        COUNT(DISTINCT c.id) as total_contracts,
        COUNT(DISTINCT p.id) as total_periods,
        COUNT(DISTINCT CASE WHEN p.status = 'เสร็จสิ้น' THEN p.id END) as completed_periods,
        COUNT(DISTINCT CASE WHEN p.status != 'เสร็จสิ้น' AND p.due_date < CURRENT_DATE THEN p.id END) as overdue_periods,
        ROUND(COUNT(DISTINCT CASE WHEN p.status = 'เสร็จสิ้น' THEN p.id END) * 100.0 / 
              NULLIF(COUNT(DISTINCT p.id), 0), 2) as completion_rate
      FROM contracts c
      LEFT JOIN contract_periods p ON c.id = p.contract_id
      GROUP BY c.department
      ORDER BY completion_rate DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting department performance:', error);
    res.status(500).json({ error: 'Failed to get department performance' });
  }
};

// Get Department Comparison
exports.getDepartmentComparison = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        department,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
        SUM(contract_value) as total_value,
        AVG(contract_value) as avg_value
      FROM contracts
      GROUP BY department
      ORDER BY department
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting department comparison:', error);
    res.status(500).json({ error: 'Failed to get department comparison' });
  }
};

exports.exportToExcel = async (req, res) => {
  try {
    const { type = 'contracts', startDate, endDate, department } = req.query;
    
    let data;
    if (type === 'financial') {
      // Get financial data
      const summary = await pool.query(`
        SELECT 
          COUNT(*) as total_contracts,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value,
          SUM(CASE WHEN status = 'ACTIVE' THEN contract_value ELSE 0 END) as active_value,
          SUM(CASE WHEN status = 'COMPLETED' OR status = 'เสร็จสิ้น' THEN contract_value ELSE 0 END) as completed_value
        FROM contracts
      `);
      
      const byDepartment = await pool.query(`
        SELECT 
          department,
          COUNT(*) as contract_count,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value,
          ROUND(SUM(contract_value) * 100.0 / NULLIF((SELECT SUM(contract_value) FROM contracts), 0), 2) as percentage
        FROM contracts
        GROUP BY department
        ORDER BY total_value DESC
      `);
      
      data = {
        summary: summary.rows[0],
        byDepartment: byDepartment.rows
      };
      
      const buffer = await exportFinancialToExcel(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=financial-report.xlsx');
      res.send(buffer);
    } else {
      // Get contracts data
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;
      
      if (startDate) {
        whereConditions.push(`start_date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }
      if (endDate) {
        whereConditions.push(`end_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }
      if (department) {
        whereConditions.push(`department = $${paramIndex}`);
        params.push(department);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const contracts = await pool.query(`
        SELECT * FROM contracts ${whereClause} ORDER BY created_at DESC
      `, params);
      
      const buffer = await exportContractsToExcel(contracts.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=contracts-report.xlsx');
      res.send(buffer);
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({ error: 'Failed to export to Excel' });
  }
};

// Export to PDF
exports.exportToPDF = async (req, res) => {
  try {
    const { type = 'contracts', startDate, endDate, department } = req.query;
    
    let data;
    if (type === 'financial') {
      // Get financial data
      const summary = await pool.query(`
        SELECT 
          COUNT(*) as total_contracts,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value,
          SUM(CASE WHEN status = 'ACTIVE' THEN contract_value ELSE 0 END) as active_value,
          SUM(CASE WHEN status = 'COMPLETED' OR status = 'เสร็จสิ้น' THEN contract_value ELSE 0 END) as completed_value
        FROM contracts
      `);
      
      const byDepartment = await pool.query(`
        SELECT 
          department,
          COUNT(*) as contract_count,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value,
          ROUND(SUM(contract_value) * 100.0 / NULLIF((SELECT SUM(contract_value) FROM contracts), 0), 2) as percentage
        FROM contracts
        GROUP BY department
        ORDER BY total_value DESC
      `);
      
      const trends = await pool.query(`
        SELECT 
          TO_CHAR(start_date, 'YYYY-MM') as month,
          COUNT(*) as count,
          SUM(contract_value) as total_value
        FROM contracts
        WHERE start_date IS NOT NULL
        GROUP BY TO_CHAR(start_date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `);
      
      data = {
        summary: summary.rows[0],
        byDepartment: byDepartment.rows,
        trends: trends.rows
      };
      
      const buffer = await exportFinancialToPDF(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=financial-report.pdf');
      res.send(buffer);
    } else {
      // Get contracts data with summary
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;
      
      if (startDate) {
        whereConditions.push(`start_date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }
      if (endDate) {
        whereConditions.push(`end_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }
      if (department) {
        whereConditions.push(`department = $${paramIndex}`);
        params.push(department);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const contracts = await pool.query(`
        SELECT * FROM contracts ${whereClause} ORDER BY created_at DESC LIMIT 50
      `, params);
      
      const summary = await pool.query(`
        SELECT 
          COUNT(*) as total_contracts,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
          COUNT(CASE WHEN status = 'PENDING' OR status = 'รอดำเนินการ' THEN 1 END) as pending_contracts,
          COUNT(CASE WHEN status = 'COMPLETED' OR status = 'เสร็จสิ้น' THEN 1 END) as completed_contracts
        FROM contracts ${whereClause}
      `, params);
      
      data = {
        summary: summary.rows[0],
        contracts: contracts.rows
      };
      
      const buffer = await exportContractsToPDF(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=contracts-report.pdf');
      res.send(buffer);
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({ error: 'Failed to export to PDF' });
  }
};
// Generate Custom Report
exports.generateCustomReport = async (req, res) => {
  try {
    const { 
      reportType,
      startDate,
      endDate,
      departments,
      statuses,
      groupBy,
      sortBy,
      includeCharts
    } = req.body;
    
    // Build dynamic query based on parameters
    let query = 'SELECT * FROM contracts WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endDate);
    }
    
    if (departments && departments.length > 0) {
      query += ` AND department = ANY($${paramIndex++})`;
      params.push(departments);
    }
    
    if (statuses && statuses.length > 0) {
      query += ` AND status = ANY($${paramIndex++})`;
      params.push(statuses);
    }
    
    if (sortBy) {
      query += ` ORDER BY ${sortBy}`;
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      parameters: req.body,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({ error: 'Failed to generate custom report' });
  }
};

module.exports = exports;
