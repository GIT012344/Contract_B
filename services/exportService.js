const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Export contracts to Excel
exports.exportContractsToExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Contracts Report');

  // Add title
  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = 'Contract Management Report';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  // Add headers
  const headers = [
    'Contract No',
    'Contract Name',
    'Vendor',
    'Department',
    'Status',
    'Start Date',
    'End Date',
    'Value'
  ];

  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4CAF50' }
  };

  // Add data
  data.forEach(contract => {
    worksheet.addRow([
      contract.contract_no,
      contract.contract_name,
      contract.vendor_name,
      contract.department,
      contract.status,
      contract.start_date,
      contract.end_date,
      contract.contract_value
    ]);
  });

  // Format columns
  worksheet.columns.forEach(column => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// Export financial report to Excel
exports.exportFinancialToExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Financial Report');

  // Add title
  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').value = 'Financial Summary Report';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  // Add summary section
  worksheet.addRow([]);
  worksheet.addRow(['Summary', '', '', '', '']);
  worksheet.addRow(['Total Contract Value', data.summary.total_value || 0]);
  worksheet.addRow(['Average Contract Value', data.summary.avg_value || 0]);
  worksheet.addRow(['Active Contracts Value', data.summary.active_value || 0]);
  worksheet.addRow(['Completed Contracts Value', data.summary.completed_value || 0]);

  // Add department breakdown
  worksheet.addRow([]);
  worksheet.addRow(['Department Breakdown', '', '', '', '']);
  
  const deptHeaders = ['Department', 'Count', 'Total Value', 'Avg Value', 'Percentage'];
  const deptHeaderRow = worksheet.addRow(deptHeaders);
  deptHeaderRow.font = { bold: true };
  deptHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2196F3' }
  };

  if (data.byDepartment) {
    data.byDepartment.forEach(dept => {
      worksheet.addRow([
        dept.department,
        dept.contract_count,
        dept.total_value,
        dept.avg_value,
        `${dept.percentage}%`
      ]);
    });
  }

  // Format columns
  worksheet.columns.forEach(column => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// Export contracts to PDF
exports.exportContractsToPDF = async (data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Title
    doc.fontSize(20).text('Contract Management Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString('th-TH')}`, { align: 'center' });
    doc.moveDown(2);

    // Summary section
    doc.fontSize(14).text('Contract Summary', { underline: true });
    doc.moveDown();
    
    if (data.summary) {
      doc.fontSize(10);
      doc.text(`Total Contracts: ${data.summary.total_contracts || 0}`);
      doc.text(`Active Contracts: ${data.summary.active_contracts || 0}`);
      doc.text(`Pending Contracts: ${data.summary.pending_contracts || 0}`);
      doc.text(`Completed Contracts: ${data.summary.completed_contracts || 0}`);
      doc.moveDown();
    }

    // Contract list
    doc.fontSize(14).text('Contract Details', { underline: true });
    doc.moveDown();

    if (data.contracts && data.contracts.length > 0) {
      data.contracts.forEach((contract, index) => {
        if (index > 0) doc.moveDown();
        
        doc.fontSize(10);
        doc.text(`${index + 1}. ${contract.contract_no} - ${contract.contract_name}`, { bold: true });
        doc.text(`   Vendor: ${contract.vendor_name}`);
        doc.text(`   Department: ${contract.department}`);
        doc.text(`   Status: ${contract.status}`);
        doc.text(`   Period: ${contract.start_date} to ${contract.end_date}`);
        doc.text(`   Value: ${contract.contract_value?.toLocaleString('th-TH')} THB`);
      });
    }

    doc.end();
  });
};

// Export financial report to PDF
exports.exportFinancialToPDF = async (data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Title
    doc.fontSize(20).text('Financial Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString('th-TH')}`, { align: 'center' });
    doc.moveDown(2);

    // Financial Summary
    doc.fontSize(14).text('Financial Summary', { underline: true });
    doc.moveDown();

    if (data.summary) {
      doc.fontSize(10);
      doc.text(`Total Contract Value: ${data.summary.total_value?.toLocaleString('th-TH')} THB`);
      doc.text(`Average Contract Value: ${data.summary.avg_value?.toLocaleString('th-TH')} THB`);
      doc.text(`Active Contracts Value: ${data.summary.active_value?.toLocaleString('th-TH')} THB`);
      doc.text(`Completed Contracts Value: ${data.summary.completed_value?.toLocaleString('th-TH')} THB`);
      doc.moveDown();
    }

    // Department Breakdown
    if (data.byDepartment && data.byDepartment.length > 0) {
      doc.fontSize(14).text('Department Breakdown', { underline: true });
      doc.moveDown();

      data.byDepartment.forEach(dept => {
        doc.fontSize(10);
        doc.text(`${dept.department}:`);
        doc.text(`  Contracts: ${dept.contract_count}`);
        doc.text(`  Total Value: ${dept.total_value?.toLocaleString('th-TH')} THB`);
        doc.text(`  Average Value: ${dept.avg_value?.toLocaleString('th-TH')} THB`);
        doc.text(`  Percentage: ${dept.percentage}%`);
        doc.moveDown(0.5);
      });
    }

    // Trends
    if (data.trends && data.trends.length > 0) {
      doc.addPage();
      doc.fontSize(14).text('Monthly Trends', { underline: true });
      doc.moveDown();

      data.trends.forEach(trend => {
        doc.fontSize(10);
        doc.text(`${trend.month}: ${trend.total_value?.toLocaleString('th-TH')} THB (${trend.count} contracts)`);
      });
    }

    doc.end();
  });
};
