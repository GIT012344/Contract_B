const db = require('../db');

class ActivityLogger {
  /**
   * บันทึก Activity Log ของผู้ใช้
   * @param {Object} logData - ข้อมูล log
   * @param {number} logData.userId - ID ของผู้ใช้
   * @param {string} logData.username - ชื่อผู้ใช้
   * @param {string} logData.actionType - ประเภทการกระทำ (LOGIN, CREATE, UPDATE, etc.)
   * @param {string} logData.resourceType - ประเภทของ resource (CONTRACT, PERIOD, USER, etc.)
   * @param {number} logData.resourceId - ID ของ resource
   * @param {string} logData.description - รายละเอียดการกระทำ
   * @param {string} logData.ipAddress - IP Address
   * @param {string} logData.userAgent - User Agent
   * @param {string} logData.requestMethod - HTTP Method
   * @param {string} logData.requestUrl - URL ที่เรียก
   * @param {number} logData.statusCode - HTTP Status Code
   * @param {number} logData.responseTimeMs - เวลาในการประมวลผล
   * @param {Object} logData.additionalData - ข้อมูลเพิ่มเติม
   */
  static async log(logData) {
    try {
      const {
        userId,
        username,
        actionType,
        resourceType = null,
        resourceId = null,
        description = null,
        ipAddress = null,
        userAgent = null,
        requestMethod = null,
        requestUrl = null,
        statusCode = null,
        responseTimeMs = null,
        additionalData = null
      } = logData;

      const query = `
        INSERT INTO user_activity_logs (
          user_id, username, action_type, resource_type, resource_id,
          description, ip_address, user_agent, request_method, request_url,
          status_code, response_time_ms, additional_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const values = [
        userId,
        username,
        actionType,
        resourceType,
        resourceId,
        description,
        ipAddress,
        userAgent,
        requestMethod,
        requestUrl,
        statusCode,
        responseTimeMs,
        additionalData ? JSON.stringify(additionalData) : null
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error logging user activity:', error);
      // ไม่ throw error เพื่อไม่ให้กระทบต่อการทำงานหลัก
    }
  }

  /**
   * บันทึก Login Activity
   */
  static async logLogin(user, req) {
    return this.log({
      userId: user.id,
      username: user.username,
      actionType: 'LOGIN',
      description: `ผู้ใช้ ${user.username} เข้าสู่ระบบ`,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });
  }

  /**
   * บันทึก Registration Activity
   */
  static async logRegister(user, req) {
    return this.log({
      userId: user.id,
      username: user.username,
      actionType: 'REGISTER',
      description: `ผู้ใช้ ${user.username} สมัครสมาชิกใหม่`,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 201
    });
  }

  /**
   * บันทึก Contract Activity
   */
  static async logContractActivity(actionType, user, contractId, description, req, statusCode = 200) {
    return this.log({
      userId: user.id,
      username: user.username,
      actionType,
      resourceType: 'CONTRACT',
      resourceId: contractId,
      description,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode
    });
  }

  /**
   * บันทึก Period Activity
   */
  static async logPeriodActivity(actionType, user, periodId, description, req, statusCode = 200) {
    return this.log({
      userId: user.id,
      username: user.username,
      actionType,
      resourceType: 'PERIOD',
      resourceId: periodId,
      description,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode
    });
  }

  /**
   * บันทึก Error Activity
   */
  static async logError(user, error, req, statusCode = 500) {
    return this.log({
      userId: user?.id || null,
      username: user?.username || 'Anonymous',
      actionType: 'ERROR',
      description: `Error: ${error.message}`,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode,
      additionalData: {
        errorStack: error.stack,
        errorName: error.name
      }
    });
  }

  /**
   * ดึงข้อมูล Activity Logs
   */
  static async getLogs(filters = {}) {
    try {
      const {
        userId,
        actionType,
        resourceType,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = filters;

      let query = `
        SELECT 
          ual.*,
          u.username as current_username,
          u.role
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        WHERE 1=1
      `;
      
      const values = [];
      let paramCount = 0;

      if (userId) {
        paramCount++;
        query += ` AND ual.user_id = $${paramCount}`;
        values.push(userId);
      }

      if (actionType) {
        paramCount++;
        query += ` AND ual.action_type = $${paramCount}`;
        values.push(actionType);
      }

      if (resourceType) {
        paramCount++;
        query += ` AND ual.resource_type = $${paramCount}`;
        values.push(resourceType);
      }

      if (startDate) {
        paramCount++;
        query += ` AND ual.created_at >= $${paramCount}`;
        values.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND ual.created_at <= $${paramCount}`;
        values.push(endDate);
      }

      query += ` ORDER BY ual.created_at DESC`;

      if (limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(limit);
      }

      if (offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        values.push(offset);
      }

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  }

  /**
   * ดึง IP Address ของ Client
   */
  static getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'];
  }

  /**
   * สร้าง Middleware สำหรับ Auto Logging
   */
  static createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // เก็บ original send function
      const originalSend = res.send;
      
      res.send = function(data) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Log activity หลังจาก response เสร็จ
        setImmediate(() => {
          if (req.user && res.statusCode < 400) {
            ActivityLogger.log({
              userId: req.user.id,
              username: req.user.username,
              actionType: ActivityLogger.getActionTypeFromMethod(req.method),
              description: `${req.method} ${req.originalUrl}`,
              ipAddress: ActivityLogger.getClientIP(req),
              userAgent: req.get('User-Agent'),
              requestMethod: req.method,
              requestUrl: req.originalUrl,
              statusCode: res.statusCode,
              responseTimeMs: responseTime
            });
          }
        });
        
        // เรียก original send function
        originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * แปลง HTTP Method เป็น Action Type
   */
  static getActionTypeFromMethod(method) {
    const methodMap = {
      'GET': 'VIEW',
      'POST': 'CREATE',
      'PUT': 'UPDATE',
      'PATCH': 'UPDATE',
      'DELETE': 'DELETE'
    };
    return methodMap[method] || 'VIEW';
  }
}

module.exports = ActivityLogger;
