const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hourself_super_secret_key_123'; 

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hourself';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB Successfully!'))
  .catch(err => console.error('❌ MongoDB connection error (Is MongoDB running?):', err));

// Mongoose Schemas
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const daySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dateStr: { type: String, required: true },
    hours: { type: Object, default: {} },
    prodScore: { type: Number, default: 0 }
});
// Ensure users have their own unique isolated days
daySchema.index({ userId: 1, dateStr: 1 }, { unique: true });
const DayRecord = mongoose.model('DayRecord', daySchema);

// ---- Auth Middleware & DB Safeguards ----
function checkDBConnection(req, res, next) {
    // If Mongoose is disconnected (0) or still explicitly trying to connect to a broken/local URI without resolution
    if (mongoose.connection.readyState === 0) {
        return res.status(500).json({ error: 'Database disconnected. Please verify your MONGODB_URI in Vercel settings.' });
    }
    next();
}

// Ensure all API calls verify connection first to prevent 10s timeout hangs
app.use('/api', checkDBConnection);

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
    
    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

// ---- API Endpoints ----

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email is already in use' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({ email, passwordHash });
        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, message: 'Account created successfully!' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: err.message || 'Registration failed entirely' });
    }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });

        const validPass = await bcrypt.compare(password, user.passwordHash);
        if (!validPass) return res.status(400).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, message: 'Logged in successfully!' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message || 'Login protocol failed' });
    }
});

// 1. Get Day Data and Prod Score for a single day
app.get('/api/day/:dateStr', authenticateToken, async (req, res) => {
    try {
        const record = await DayRecord.findOne({ userId: req.user.userId, dateStr: req.params.dateStr });
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
app.post('/api/dayData/:dateStr', authenticateToken, async (req, res) => {
    try {
        const { dateStr } = req.params;
        const { hours } = req.body;
        
        const record = await DayRecord.findOneAndUpdate(
            { userId: req.user.userId, dateStr },
            { $set: { hours } },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save day data' });
    }
});

// 3. Save Productivity Score
app.post('/api/dayScore/:dateStr', authenticateToken, async (req, res) => {
    try {
        const { dateStr } = req.params;
        const { prodScore } = req.body;
        
        const record = await DayRecord.findOneAndUpdate(
            { userId: req.user.userId, dateStr },
            { $set: { prodScore } },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save productivity score' });
    }
});

// 4. Batch Fetch for Month Previews
app.get('/api/month/:yearMonth', authenticateToken, async (req, res) => {
    try {
        const records = await DayRecord.find({ 
            userId: req.user.userId,
            dateStr: { $regex: `^${req.params.yearMonth}-` } 
        });
        
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
