// โครงสร้างข้อมูลสัญญา (mock object)
class Contract {
  constructor({
    id,
    contractNo,
    contractDate,
    contactName,
    department,
    startDate,
    endDate,
    periodCount,
    periods,
    files,
    remark1,
    remark2,
    remark3,
    remark4,
    alertEmails,
    status,
    createdBy,
    createdAt,
    updatedBy,
    updatedAt,
    deletedFlag
  }) {
    this.id = id; // unique id
    this.contractNo = contractNo; // เลขที่สัญญา
    this.contractDate = contractDate; // วันที่ทำสัญญา
    this.contactName = contactName; // ชื่อผู้ดำเนินการ/ผู้ติดต่อ
    this.department = department; // หน่วยงาน
    this.startDate = startDate; // วันที่เริ่มสัญญา
    this.endDate = endDate; // วันที่สิ้นสุดสัญญา
    this.periodCount = periodCount; // จำนวนงวดงาน
    this.periods = periods || []; // [{no, dueDate}]
    this.files = files || []; // [{filename, path, mimetype}]
    this.remark1 = remark1;
    this.remark2 = remark2;
    this.remark3 = remark3;
    this.remark4 = remark4;
    this.alertEmails = alertEmails || [];
    this.status = status || 'CRTD';
    this.createdBy = createdBy;
    this.createdAt = createdAt || new Date();
    this.updatedBy = updatedBy;
    this.updatedAt = updatedAt || new Date();
    this.deletedFlag = deletedFlag || false;
  }
}

module.exports = Contract; 