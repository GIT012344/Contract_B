const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.EMAIL_SENDER,
    pass: process.env.EMAIL_PASSWORD || 'lwnj edbh cnby uvuq',
  },
});

function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: config.EMAIL_SENDER,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendMail }; 