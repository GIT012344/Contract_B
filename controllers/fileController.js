const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// กำหนดค่า multer สำหรับอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const contractId = req.params.contractId;
    const contractDir = path.join(uploadsDir, `contract_${contractId}`);
    
    // สร้างโฟลเดอร์สำหรับแต่ละสัญญา
    if (!fs.existsSync(contractDir)) {
      fs.mkdirSync(contractDir, { recursive: true });
    }
    
    cb(null, contractDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  }
});

// ตรวจสอบประเภทไฟล์
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('ประเภทไฟล์ไม่ได้รับอนุญาต'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// อัปโหลดไฟล์
exports.uploadFiles = async (req, res) => {
  const contractId = req.params.contractId;
  const files = req.files;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'ไม่พบไฟล์ที่ต้องการอัปโหลด' 
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const uploadedFiles = [];
    
    for (const file of files) {
      // บันทึกข้อมูลไฟล์ลงฐานข้อมูล
      const result = await client.query(
        `INSERT INTO contract_files (
          contract_id, 
          file_name, 
          file_path, 
          file_size, 
          file_type,
          uploaded_by,
          uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id`,
        [
          contractId,
          file.originalname,
          file.filename,
          file.size,
          file.mimetype,
          req.user ? req.user.id : null
        ]
      );
      
      uploadedFiles.push({
        id: result.rows[0].id,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        uploadedAt: new Date()
      });
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'อัปโหลดไฟล์สำเร็จ',
      data: uploadedFiles
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload error:', error);
    
    // ลบไฟล์ที่อัปโหลดแล้วถ้าเกิดข้อผิดพลาด
    for (const file of files) {
      const filePath = path.join(uploadsDir, `contract_${contractId}`, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' 
    });
  } finally {
    client.release();
  }
};

// ดึงรายการไฟล์ของสัญญา
exports.getContractFiles = async (req, res) => {
  const contractId = req.params.contractId;
  
  try {
    const result = await pool.query(
      `SELECT 
        cf.id,
        cf.file_name,
        cf.file_size,
        cf.file_type,
        cf.uploaded_at,
        u.username as uploaded_by
      FROM contract_files cf
      LEFT JOIN users u ON cf.uploaded_by = u.id
      WHERE cf.contract_id = $1 AND cf.deleted_at IS NULL
      ORDER BY cf.uploaded_at DESC`,
      [contractId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์' 
    });
  }
};

// ดาวน์โหลดไฟล์
exports.downloadFile = async (req, res) => {
  const fileId = req.params.fileId;
  
  try {
    const result = await pool.query(
      `SELECT * FROM contract_files WHERE id = $1 AND deleted_at IS NULL`,
      [fileId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบไฟล์' 
      });
    }
    
    const file = result.rows[0];
    const filePath = path.join(uploadsDir, `contract_${file.contract_id}`, file.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบไฟล์ในระบบ' 
      });
    }
    
    // ส่งไฟล์ให้ดาวน์โหลด
    res.download(filePath, file.file_name);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์' 
    });
  }
};

// ดูไฟล์ (preview)
exports.viewFile = async (req, res) => {
  const fileId = req.params.fileId;
  
  try {
    const result = await pool.query(
      `SELECT * FROM contract_files WHERE id = $1 AND deleted_at IS NULL`,
      [fileId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบไฟล์' 
      });
    }
    
    const file = result.rows[0];
    const filePath = path.join(uploadsDir, `contract_${file.contract_id}`, file.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบไฟล์ในระบบ' 
      });
    }
    
    // กำหนด content-type สำหรับแสดงไฟล์
    res.contentType(file.file_type);
    
    // ถ้าเป็น PDF หรือรูปภาพให้แสดงใน browser
    if (file.file_type.includes('pdf') || file.file_type.includes('image')) {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    }
    
    // ส่งไฟล์
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการแสดงไฟล์' 
    });
  }
};

// ลบไฟล์
exports.deleteFile = async (req, res) => {
  const fileId = req.params.fileId;
  
  try {
    // Soft delete - เพียงแค่อัปเดตฟิลด์ deleted_at
    await pool.query(
      `UPDATE contract_files SET deleted_at = NOW() WHERE id = $1`,
      [fileId]
    );
    
    res.json({
      success: true,
      message: 'ลบไฟล์สำเร็จ'
    });
    
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการลบไฟล์' 
    });
  }
};

// Export upload middleware
exports.uploadMiddleware = upload.array('files', 10);
