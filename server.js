const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from this directory
app.use(express.static(path.join(__dirname))); 

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hourself';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB Successfully!'))
  .catch(err => console.error('❌ MongoDB connection error (Is MongoDB running?):', err));

// Mongoose Schema
const daySchema = new mongoose.Schema({
    dateStr: { type: String, required: true, unique: true },
    hours: { type: Object, default: {} },
    prodScore: { type: Number, default: 0 }
});

const DayRecord = mongoose.model('DayRecord', daySchema);

// API Endpoints

// 1. Get Day Data and Prod Score for a single day
app.get('/api/day/:dateStr', async (req, res) => {
    try {
        const record = await DayRecord.findOne({ dateStr: req.params.dateStr });
        if (record) {
            res.json(record);
        } else {
            res.json({ dateStr: req.params.dateStr, hours: {}, prodScore: 0 });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch day record' });
    }
});

// 2. Save Day Hourly Text Data
app.post('/api/dayData/:dateStr', async (req, res) => {
    try {
        const { dateStr } = req.params;
        const { hours } = req.body;
        
        const record = await DayRecord.findOneAndUpdate(
            { dateStr },
            { $set: { hours } },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save day data' });
    }
});

// 3. Save Productivity Score
app.post('/api/dayScore/:dateStr', async (req, res) => {
    try {
        const { dateStr } = req.params;
        const { prodScore } = req.body;
        
        const record = await DayRecord.findOneAndUpdate(
            { dateStr },
            { $set: { prodScore } },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save productivity score' });
    }
});

// 4. Batch Fetch for Month Previews (used to render calendar fast)
app.get('/api/month/:yearMonth', async (req, res) => {
    try {
        // yearMonth format: "YYYY-MM"
        // This regex filters dates like "2026-03-something"
        const records = await DayRecord.find({ 
            dateStr: { $regex: `^${req.params.yearMonth}-` } 
        });
        
        // Convert array to a fast lookup object where key is dateStr
        const monthData = {};
        records.forEach(r => {
            monthData[r.dateStr] = {
                hours: r.hours,
                prodScore: r.prodScore
            };
        });
        res.json(monthData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch month data' });
    }
});

// Export app for Vercel Serverless Functions
module.exports = app;

// Start Server locally if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`🚀 HourSelf Server is running!`);
        console.log(`🌍 Open your browser and go to: http://localhost:${PORT}`);
        console.log(`========================================\n`);
    });
}
