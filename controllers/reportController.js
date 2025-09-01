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
      case 'month':
          query = `
            SELECT 
              EXTRACT(MONTH FROM created_at) as label,
              COUNT(*) as count,
              SUM(contract_value) as total_value
            FROM contracts
            GROUP BY EXTRACT(MONTH FROM created_at)
            ORDER BY label
          `;
          break;
      case 'vendor':
          query = `
            SELECT 
              vendor_name as label,
              COUNT(*) as count,
              SUM(contract_value) as total_value
            FROM contracts
            GROUP BY vendor_name
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
      if (period === 'monthly') {
        query = `
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as period,
            COUNT(*) as count,
            SUM(contract_value) as total_value
          FROM contracts
          WHERE EXTRACT(YEAR FROM created_at) = $1
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
          ORDER BY period
        `;
      } else {
        query = `
          SELECT 
            TO_CHAR(created_at, 'YYYY-Q') as period,
            COUNT(*) as count,
            SUM(contract_value) as total_value
          FROM contracts
          WHERE EXTRACT(YEAR FROM created_at) = $1
          GROUP BY TO_CHAR(created_at, 'YYYY-Q')
          ORDER BY period
        `;
      }
      
      const result = await pool.query(query, [year]);
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
          SUM(contract_value) as total_value
        FROM contracts
        GROUP BY status
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
          COUNT(*) as count,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value
        FROM contracts
        GROUP BY department
        ORDER BY total_value DESC
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
          contract_value,
          (end_date - CURRENT_DATE) as days_remaining
        FROM contracts
        WHERE status = 'ACTIVE'
          AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '$1 days'
        ORDER BY end_date ASC
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
          status,
          COUNT(*) as count
        FROM contract_periods
        GROUP BY status
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
          p.description,
          p.due_date,
          p.status,
          c.contract_no,
          c.contract_name,
          c.department,
          (CURRENT_DATE - p.due_date) as days_overdue
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
          p.description,
          p.due_date,
          p.status,
          c.contract_no,
          c.contract_name,
          c.department,
          (p.due_date - CURRENT_DATE) as days_until_due
        FROM contract_periods p
        INNER JOIN contracts c ON p.contract_id = c.id
        WHERE p.status != 'เสร็จสิ้น'
          AND p.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '$1 days'
        ORDER BY p.due_date ASC
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
          COUNT(*) as total_periods,
          COUNT(CASE WHEN status = 'เสร็จสิ้น' THEN 1 END) as completed_periods,
          COUNT(CASE WHEN status = 'เสร็จสิ้น' AND due_date >= completed_date THEN 1 END) as on_time_periods,
          COUNT(CASE WHEN status = 'เสร็จสิ้น' AND due_date < completed_date THEN 1 END) as late_periods,
          COUNT(CASE WHEN status != 'เสร็จสิ้น' AND due_date < CURRENT_DATE THEN 1 END) as overdue_periods
        FROM contract_periods
      `);
      
      res.json(result.rows[0]);
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
          SUM(contract_value) as total_value,
          AVG(contract_value) as average_value,
          COUNT(*) as total_contracts,
          SUM(CASE WHEN status = 'ACTIVE' THEN contract_value ELSE 0 END) as active_value,
          SUM(CASE WHEN status = 'COMPLETED' THEN contract_value ELSE 0 END) as completed_value
        FROM contracts
        WHERE EXTRACT(YEAR FROM created_at) = $1
      `, [year]);
      
      res.json(result.rows[0]);
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
          COUNT(*) as contract_count,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value,
          ROUND(SUM(contract_value) * 100.0 / SUM(SUM(contract_value)) OVER (), 2) as percentage
        FROM contracts
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
          ROUND(COUNT(DISTINCT CASE WHEN p.status = 'เสร็จสิ้น' THEN p.id END) * 100.0 / 
                NULLIF(COUNT(DISTINCT p.id), 0), 2) as completion_rate,
          SUM(c.contract_value) as total_value
        FROM contracts c
        LEFT JOIN contract_periods p ON c.id = p.contract_id
        GROUP BY c.department
        ORDER BY total_value DESC
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
          COUNT(*) as contract_count,
          SUM(contract_value) as total_value,
          AVG(contract_value) as avg_value,
          MIN(contract_value) as min_value,
          MAX(contract_value) as max_value
        FROM contracts
        GROUP BY department
        ORDER BY total_value DESC
      `);
      
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting department comparison:', error);
    res.status(500).json({ error: 'Failed to get department comparison' });
    }
};

// Export to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const { type = 'contracts', startDate, endDate, department } = req.query;
      
      let data;
      if (type === 'financial') {
        // Get financial data
        const summaryQuery = await pool.query(`
          SELECT 
            SUM(contract_value) as total_value,
            AVG(contract_value) as avg_value,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_value,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_value
          FROM contracts
        `);
        
        const deptQuery = await pool.query(`
          SELECT 
            department,
            COUNT(*) as contract_count,
            SUM(contract_value) as total_value,
            AVG(contract_value) as avg_value,
            ROUND(SUM(contract_value) * 100.0 / SUM(SUM(contract_value)) OVER (), 2) as percentage
          FROM contracts
          GROUP BY department
          ORDER BY total_value DESC
        `);
        
        data = {
          summary: summaryQuery.rows[0],
          byDepartment: deptQuery.rows
        };
        
        const buffer = await exportFinancialToExcel(data);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=financial_report.xlsx');
        res.send(buffer);
      } else {
        // Get contracts data
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (startDate) {
          whereClause += ` AND created_at >= $${paramIndex++}`;
          params.push(startDate);
        }
        
        if (endDate) {
          whereClause += ` AND created_at <= $${paramIndex++}`;
          params.push(endDate);
        }
        
        if (department) {
          whereClause += ` AND department = $${paramIndex++}`;
          params.push(department);
        }
        
        const result = await pool.query(`
          SELECT 
            contract_no,
            contract_name,
            vendor_name,
            department,
            status,
            start_date,
            end_date,
            contract_value
          FROM contracts
          ${whereClause}
          ORDER BY created_at DESC
        `, params);
        
        const buffer = await exportContractsToExcel(result.rows);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=contracts_report.xlsx');
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
        const summaryQuery = await pool.query(`
          SELECT 
            SUM(contract_value) as total_value,
            AVG(contract_value) as avg_value,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_value,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_value
          FROM contracts
        `);
        
        const deptQuery = await pool.query(`
          SELECT 
            department,
            COUNT(*) as contract_count,
            SUM(contract_value) as total_value,
            AVG(contract_value) as avg_value,
            ROUND(SUM(contract_value) * 100.0 / SUM(SUM(contract_value)) OVER (), 2) as percentage
          FROM contracts
          GROUP BY department
          ORDER BY total_value DESC
        `);
        
        const trendsQuery = await pool.query(`
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            COUNT(*) as count,
            SUM(contract_value) as total_value
          FROM contracts
          WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
          ORDER BY month
        `);
        
        data = {
          summary: summaryQuery.rows[0],
          byDepartment: deptQuery.rows,
          trends: trendsQuery.rows
        };
        
        const buffer = await exportFinancialToPDF(data);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=financial_report.pdf');
        res.send(buffer);
      } else {
        // Get contracts data
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (startDate) {
          whereClause += ` AND created_at >= $${paramIndex++}`;
          params.push(startDate);
        }
        
        if (endDate) {
          whereClause += ` AND created_at <= $${paramIndex++}`;
          params.push(endDate);
        }
        
        if (department) {
          whereClause += ` AND department = $${paramIndex++}`;
          params.push(department);
        }
        
        const contractsQuery = await pool.query(`
          SELECT 
            contract_no,
            contract_name,
            vendor_name,
            department,
            status,
            TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
            TO_CHAR(end_date, 'YYYY-MM-DD') as end_date,
            contract_value
          FROM contracts
          ${whereClause}
          ORDER BY created_at DESC
        `, params);
        
        const summaryQuery = await pool.query(`
          SELECT 
            COUNT(*) as total_contracts,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_contracts,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_contracts
          FROM contracts
          ${whereClause}
        `, params);
        
        data = {
          contracts: contractsQuery.rows,
          summary: summaryQuery.rows[0]
        };
        
        const buffer = await exportContractsToPDF(data);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=contracts_report.pdf');
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
        sortBy,
        includeFinancial,
        includePeriods
      } = req.body;
      
      let query = `SELECT * FROM contracts WHERE 1=1`;
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
