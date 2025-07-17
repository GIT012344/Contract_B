const config = require('../config/config');
const emailService = require('./emailService');
const Contract = require('../models/contract');
const logService = require('./logService');

// contracts mock storage (ใช้ของ controller จริงควร import หรือ share state)
let contracts;
try {
  contracts = require('../controllers/contractController').__contracts || [];
} catch {
  contracts = [];
}

function getExpiringContracts() {
  const today = new Date();
  return contracts.filter(c =>
    c.status === 'ACTIVE' &&
    !c.deletedFlag &&
    daysBetween(today, new Date(c.endDate)) <= config.ALERT_CONTRACT_EXPIRY_DAYS
  );
}

function getDuePeriods() {
  const today = new Date();
  let due = [];
  contracts.forEach(c => {
    if (c.status !== 'ACTIVE' || c.deletedFlag) return;
    (c.periods || []).forEach((p, idx) => {
      if (daysBetween(today, new Date(p.dueDate)) <= config.ALERT_PERIOD_DUE_DAYS) {
        due.push({ contract: c, period: p, periodNo: idx + 1 });
      }
    });
  });
  return due;
}

function daysBetween(d1, d2) {
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function runAlertJob() {
  // สัญญาใกล้หมดอายุ
  const expiring = getExpiringContracts();
  if (expiring.length > 0) {
    const subject = '[Alert] สัญญาใกล้หมดอายุ';
    const html = expiring.map(c => `<div>เลขที่สัญญา: ${c.contractNo} | หมดอายุ: ${c.endDate}</div>`).join('');
    await emailService.sendMail({
      to: config.EMAIL_SENDER,
      subject,
      html,
    });
    logService.log('ALERT_CONTRACT_EXPIRY', '-', 'system', { count: expiring.length });
  }
  // งวดงานใกล้ถึงกำหนด
  const duePeriods = getDuePeriods();
  if (duePeriods.length > 0) {
    const subject = '[Alert] งวดงานใกล้ถึงกำหนด';
    const html = duePeriods.map(d => `<div>เลขที่สัญญา: ${d.contract.contractNo} | งวดที่: ${d.periodNo} | กำหนดส่ง: ${d.period.dueDate}</div>`).join('');
    await emailService.sendMail({
      to: config.EMAIL_SENDER,
      subject,
      html,
    });
    logService.log('ALERT_PERIOD_DUE', '-', 'system', { count: duePeriods.length });
  }
}

module.exports = { runAlertJob }; 