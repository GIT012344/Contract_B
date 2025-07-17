const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const contractRoutes = require('./routes/contractRoutes');
app.use('/api/contracts', contractRoutes);

const periodRoutes = require('./routes/periodRoutes');
app.use('/api/contracts', periodRoutes);

const cron = require('node-cron');
const alertJob = require('./services/alertJob');
cron.schedule('1 0 * * *', () => {
  alertJob.runAlertJob();
});

// Test route
app.get('/', (req, res) => {
  res.send('Contract Management API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});