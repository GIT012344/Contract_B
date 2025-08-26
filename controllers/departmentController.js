const db = require('../db');
const ActivityLogger = require('../services/activityLogger');

// Public endpoint for fetching departments (no auth required)
exports.getDepartmentsPublic = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name AS department_name FROM departments WHERE is_active = true ORDER BY name'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get departments public error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแผนก' 
    });
  }
};

// ดึงรายการแผนกทั้งหมด
exports.getDepartments = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, code, description, is_active FROM departments WHERE is_active = true ORDER BY name'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแผนก' 
    });
  }
};

// ดึงรายการแผนกทั้งหมด (สำหรับ Admin)
exports.getAllDepartments = async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์เข้าถึง' 
      });
    }

    const result = await db.query(
      `SELECT d.*, 
              u.username as created_by_username,
              (SELECT COUNT(*) FROM users WHERE department_id = d.id) as user_count,
              (SELECT COUNT(*) FROM contracts WHERE department_id = d.id) as contract_count
       FROM departments d
       LEFT JOIN users u ON d.created_by = u.id
       ORDER BY d.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get all departments error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแผนก' 
    });
  }
};

// สร้างแผนกใหม่ (Admin Only)
exports.createDepartment = async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์ในการสร้างแผนก' 
      });
    }

    const { name, code, description } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name) {
      return res.status(400).json({ 
        error: 'กรุณาระบุชื่อแผนก' 
      });
    }

    // ตรวจสอบชื่อแผนกซ้ำ
    const existingDept = await db.query(
      'SELECT id FROM departments WHERE name = $1 OR code = $2',
      [name, code]
    );

    if (existingDept.rows.length > 0) {
      return res.status(409).json({ 
        error: 'ชื่อแผนกหรือรหัสแผนกนี้มีอยู่แล้ว' 
      });
    }

    // สร้างแผนกใหม่
    const result = await db.query(
      `INSERT INTO departments (name, code, description, created_by, created_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [name, code, description, req.user.id]
    );

    const newDepartment = result.rows[0];

    // บันทึก Activity Log
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'CREATE',
      resourceType: 'DEPARTMENT',
      resourceId: newDepartment.id,
      description: `สร้างแผนกใหม่: ${name}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 201
    });

    res.status(201).json({
      message: 'สร้างแผนกสำเร็จ',
      department: newDepartment
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการสร้างแผนก' 
    });
  }
};

// อัปเดตข้อมูลแผนก (Admin Only)
exports.updateDepartment = async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์ในการแก้ไขแผนก' 
      });
    }

    const { id } = req.params;
    const { name, code, description, is_active } = req.body;

    // ตรวจสอบว่าแผนกมีอยู่
    const deptExists = await db.query(
      'SELECT id FROM departments WHERE id = $1',
      [id]
    );

    if (deptExists.rows.length === 0) {
      return res.status(404).json({ 
        error: 'ไม่พบแผนกที่ต้องการแก้ไข' 
      });
    }

    // ตรวจสอบชื่อหรือรหัสซ้ำ
    if (name || code) {
      const duplicate = await db.query(
        'SELECT id FROM departments WHERE (name = $1 OR code = $2) AND id != $3',
        [name, code, id]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({ 
          error: 'ชื่อแผนกหรือรหัสแผนกนี้มีอยู่แล้ว' 
        });
      }
    }

    // สร้าง query สำหรับอัปเดต
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (code !== undefined) {
      updates.push(`code = $${paramCount}`);
      values.push(code);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' 
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE departments 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    // บันทึก Activity Log
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'UPDATE',
      resourceType: 'DEPARTMENT',
      resourceId: id,
      description: `อัปเดตข้อมูลแผนก: ${result.rows[0].name}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });

    res.json({
      message: 'อัปเดตข้อมูลแผนกสำเร็จ',
      department: result.rows[0]
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลแผนก' 
    });
  }
};

// ลบแผนก (Admin Only)
exports.deleteDepartment = async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์ในการลบแผนก' 
      });
    }

    const { id } = req.params;

    // ตรวจสอบว่าแผนกมีอยู่
    const dept = await db.query(
      'SELECT name FROM departments WHERE id = $1',
      [id]
    );

    if (dept.rows.length === 0) {
      return res.status(404).json({ 
        error: 'ไม่พบแผนกที่ต้องการลบ' 
      });
    }

    // ตรวจสอบว่ามีผู้ใช้หรือสัญญาที่เชื่อมโยงกับแผนกนี้หรือไม่
    const usersCount = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE department_id = $1',
      [id]
    );

    const contractsCount = await db.query(
      'SELECT COUNT(*) as count FROM contracts WHERE department_id = $1',
      [id]
    );

    if (parseInt(usersCount.rows[0].count) > 0 || parseInt(contractsCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'ไม่สามารถลบแผนกนี้ได้ เนื่องจากมีผู้ใช้หรือสัญญาที่เชื่อมโยงอยู่',
        details: {
          users: parseInt(usersCount.rows[0].count),
          contracts: parseInt(contractsCount.rows[0].count)
        }
      });
    }

    // ลบแผนก (Soft delete โดยตั้ง is_active = false)
    await db.query(
      'UPDATE departments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // บันทึก Activity Log
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'DELETE',
      resourceType: 'DEPARTMENT',
      resourceId: id,
      description: `ลบแผนก: ${dept.rows[0].name}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });

    res.json({
      message: 'ลบแผนกสำเร็จ'
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการลบแผนก' 
    });
  }
};

// ดึงข้อมูลแผนกตาม ID
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT d.*, 
              u.username as created_by_username,
              (SELECT COUNT(*) FROM users WHERE department_id = d.id) as user_count,
              (SELECT COUNT(*) FROM contracts WHERE department_id = d.id) as contract_count
       FROM departments d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'ไม่พบข้อมูลแผนก' 
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get department by ID error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแผนก' 
    });
  }
};

// ดึงสมาชิกในแผนก
exports.getDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.created_at
       FROM users u
       WHERE u.department_id = $1
       ORDER BY u.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get department members error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิกแผนก' 
    });
  }
};

// ดึงสัญญาของแผนก
exports.getDepartmentContracts = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userDepartment = req.user.department_id;
    const userRole = req.user.role;

    // ตรวจสอบสิทธิ์การเข้าถึง
    if (userRole !== 'admin' && userDepartment !== parseInt(id)) {
      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลสัญญาของแผนกนี้' 
      });
    }

    const result = await db.query(
      `SELECT c.*, d.name as department_name
       FROM contracts c
       LEFT JOIN departments d ON c.department_id = d.id
       WHERE c.department_id = $1
       ORDER BY c.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get department contracts error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสัญญาของแผนก' 
    });
  }
};
