const express = require('express');
const app = express();
const PORT = process.env.PORT || 5005;
const cors = require('cors');
app.use(express.json());
app.use(cors());

const contractRoutes = require('./routes/contractRoutes');
app.use('/api/contracts', contractRoutes);

const periodRoutes = require('./routes/periodRoutes');
app.use('/api/contracts', periodRoutes);

const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const cron = require('node-cron');
const alertJob = require('./services/alertJob');
cron.schedule('* 1 * * *', () => {
  alertJob.runAlertJob();
}, {
  timezone: 'Asia/Bangkok'
});

// Test route
app.get('/', (req, res) => {
  res.send('Contract Management API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});