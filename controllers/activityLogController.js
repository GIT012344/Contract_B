const ActivityLogger = require('../services/activityLogger');

// ดูรายการ Activity Logs
exports.getLogs = async (req, res) => {
  try {
    const {
      userId,
      actionType,
      resourceType,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      userId: userId ? parseInt(userId) : undefined,
      actionType,
      resourceType,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const logs = await ActivityLogger.getLogs(filters);

    // Log การดู Activity Logs
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'VIEW',
      resourceType: 'ACTIVITY_LOGS',
      description: `ดู Activity Logs (${logs.length} รายการ)`,
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });

    res.json({
      logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    
    // Log error
    await ActivityLogger.logError(req.user, error, req, 500);
    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Activity Logs' 
    });
  }
};

// ดู Activity Logs ของผู้ใช้คนหนึ่ง
exports.getUserLogs = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const {
      actionType,
      resourceType,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    // ตรวจสอบสิทธิ์ (admin หรือ user ตัวเอง)
    if (req.user.role !== 'admin' && req.user.id !== targetUserId) {
      await ActivityLogger.log({
        userId: req.user.id,
        username: req.user.username,
        actionType: 'ACCESS_DENIED',
        resourceType: 'ACTIVITY_LOGS',
        resourceId: targetUserId,
        description: `พยายามดู Activity Logs ของผู้ใช้ ID ${targetUserId} โดยไม่มีสิทธิ์`,
        ipAddress: ActivityLogger.getClientIP(req),
        userAgent: req.get('User-Agent'),
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        statusCode: 403
      });

      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์ในการดู Activity Logs ของผู้ใช้คนนี้' 
      });
    }

    const filters = {
      userId: targetUserId,
      actionType,
      resourceType,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const logs = await ActivityLogger.getLogs(filters);

    // Log การดู Activity Logs
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'VIEW',
      resourceType: 'ACTIVITY_LOGS',
      resourceId: targetUserId,
      description: `ดู Activity Logs ของผู้ใช้ ID ${targetUserId} (${logs.length} รายการ)`,
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });

    res.json({
      logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    
    // Log error
    await ActivityLogger.logError(req.user, error, req, 500);
    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Activity Logs ของผู้ใช้' 
    });
  }
};

// สรุปสถิติ Activity Logs
exports.getActivityStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // ตรวจสอบสิทธิ์ admin
    if (req.user.role !== 'admin') {
      await ActivityLogger.log({
        userId: req.user.id,
        username: req.user.username,
        actionType: 'ACCESS_DENIED',
        resourceType: 'ACTIVITY_STATS',
        description: 'พยายามดูสถิติ Activity Logs โดยไม่มีสิทธิ์ admin',
        ipAddress: ActivityLogger.getClientIP(req),
        userAgent: req.get('User-Agent'),
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        statusCode: 403
      });

      return res.status(403).json({ 
        error: 'ต้องมีสิทธิ์ admin เท่านั้น' 
      });
    }

    // สร้าง query สำหรับสถิติ
    let dateFilter = '';
    const values = [];
    if (startDate && endDate) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      values.push(startDate, endDate);
    }

    // ดึงสถิติต่างๆ
    const statsQueries = [
      // จำนวน activities ตาม action type
      `SELECT action_type, COUNT(*) as count 
       FROM user_activity_logs ${dateFilter} 
       GROUP BY action_type 
       ORDER BY count DESC`,
      
      // จำนวน activities ตาม user
      `SELECT username, COUNT(*) as count 
       FROM user_activity_logs ${dateFilter} 
       GROUP BY username 
       ORDER BY count DESC 
       LIMIT 10`,
      
      // จำนวน activities ตาม resource type
      `SELECT resource_type, COUNT(*) as count 
       FROM user_activity_logs ${dateFilter} 
       WHERE resource_type IS NOT NULL 
       GROUP BY resource_type 
       ORDER BY count DESC`,
      
      // Activities ต่อวัน (7 วันล่าสุด)
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM user_activity_logs 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at) 
       ORDER BY date DESC`
    ];

    const [actionStats, userStats, resourceStats, dailyStats] = await Promise.all(
      statsQueries.map(query => db.query(query, values))
    );

    const stats = {
      actionTypes: actionStats.rows,
      topUsers: userStats.rows,
      resourceTypes: resourceStats.rows,
      dailyActivity: dailyStats.rows
    };

    // Log การดูสถิติ
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'VIEW',
      resourceType: 'ACTIVITY_STATS',
      description: 'ดูสถิติ Activity Logs',
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    
    // Log error
    await ActivityLogger.logError(req.user, error, req, 500);
    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงสถิติ Activity Logs' 
    });
  }
};
