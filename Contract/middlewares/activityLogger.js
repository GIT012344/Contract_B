const ActivityLogger = require('../services/activityLogger');

/**
 * Middleware สำหรับ Auto Logging ทุก HTTP Request
 * จะบันทึก Log เฉพาะ Request ที่มี Authentication เท่านั้น
 */
const activityLoggerMiddleware = (req, res, next) => {
  // เก็บเวลาเริ่มต้น
  const startTime = Date.now();
  
  // เก็บ original res.json และ res.send
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override res.json เพื่อจับ response
  res.json = function(body) {
    logRequest(req, res, startTime, body);
    return originalJson.call(this, body);
  };
  
  // Override res.send เพื่อจับ response
  res.send = function(body) {
    logRequest(req, res, startTime, body);
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * ฟังก์ชันสำหรับบันทึก Log
 */
async function logRequest(req, res, startTime, responseBody) {
  try {
    // บันทึก Log เฉพาะ Request ที่มี user (authenticated) เท่านั้น
    if (!req.user) return;
    
    const responseTime = Date.now() - startTime;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    
    // กำหนด action_type ตาม HTTP method และ status code
    let actionType = 'VIEW';
    if (method === 'POST') actionType = 'CREATE';
    else if (method === 'PUT' || method === 'PATCH') actionType = 'UPDATE';
    else if (method === 'DELETE') actionType = 'DELETE';
    else if (statusCode >= 400) actionType = 'ERROR';
    
    // กำหนด resource_type จาก URL
    let resourceType = null;
    let resourceId = null;
    
    if (url.includes('/api/contracts')) {
      resourceType = 'CONTRACT';
      const contractMatch = url.match(/\/api\/contracts\/(\d+)/);
      if (contractMatch) resourceId = parseInt(contractMatch[1]);
    } else if (url.includes('/api/periods')) {
      resourceType = 'PERIOD';
      const periodMatch = url.match(/\/api\/periods\/(\d+)/);
      if (periodMatch) resourceId = parseInt(periodMatch[1]);
    } else if (url.includes('/api/users')) {
      resourceType = 'USER';
      const userMatch = url.match(/\/api\/users\/(\d+)/);
      if (userMatch) resourceId = parseInt(userMatch[1]);
    } else if (url.includes('/api/settings')) {
      resourceType = 'SETTINGS';
    } else if (url.includes('/api/activity-logs')) {
      resourceType = 'SYSTEM';
    }
    
    // สร้าง description
    let description = `${method} ${url}`;
    if (statusCode >= 400) {
      description = `Error: ${description} (${statusCode})`;
    }
    
    // เก็บข้อมูลเพิ่มเติม
    const additionalData = {
      query: req.query,
      params: req.params,
      responseTime: responseTime,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    };
    
    // บันทึก Log
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType,
      resourceType,
      resourceId,
      description,
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode,
      responseTimeMs: responseTime,
      additionalData
    });
    
  } catch (error) {
    // ไม่ให้ error ในการ log ไปกระทบ main application
    console.error('Error in activity logger middleware:', error);
  }
}

module.exports = activityLoggerMiddleware;
