require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const dns = require('dns');

// Override system DNS with Google and Cloudflare DNS to fix resolution errors
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
console.log('[INFO] DNS overrides set to 8.8.8.8, 1.1.1.1');

const User = require('./models/User');
const Attendance = require('./models/Attendance');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const fs = require('fs');

// Utility to save base64 photos to the dataset folder
async function savePhotosToDataset(studentId, photos) {
    if (!photos || !Array.isArray(photos) || photos.length === 0) return;
    
    const datasetDir = path.join(__dirname, 'dataset');
    const studentDir = path.join(datasetDir, studentId.toString());
    
    if (!fs.existsSync(datasetDir)) fs.mkdirSync(datasetDir);
    if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir);
    
    photos.forEach((photo, index) => {
        const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(path.join(studentDir, `${index + 1}.jpg`), buffer);
    });
    console.log(`[INFO] Saved ${photos.length} photos for student ${studentId}`);
}


// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds instead of 10
})
.then(() => {
    console.log('Connected to MongoDB via mongoose!');
    ensureDefaultUsers();
})
.catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
        console.warn('\n[!] CRITICAL: Could not resolve MongoDB address. Your network or DNS is blocking the connection.');
        console.warn('[!] ACTION: Please try connecting your computer to a mobile hotspot or changing your DNS to 8.8.8.8.\n');
    }
});

// Auto-seed default accounts if they don't exist
async function ensureDefaultUsers() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                role: 'admin',
                name: 'Admin User',
                registeredDate: new Date().toLocaleDateString()
            });
            console.log('Default Admin account created: admin / admin123');
        }

        const staffExists = await User.findOne({ role: 'staff' });
        if (!staffExists) {
            const hashedPassword = await bcrypt.hash('staff123', 10);
            await User.create({
                username: 'staff',
                password: hashedPassword,
                role: 'staff',
                name: 'Staff User',
                registeredDate: new Date().toLocaleDateString()
            });
            console.log('Default Staff account created: staff / staff123');
        }
        
        const studentExists = await User.findOne({ username: 'student' });
        if (!studentExists) {
            const hashedPassword = await bcrypt.hash('student123', 10);
            await User.create({
                username: 'student',
                password: hashedPassword,
                role: 'student',
                name: 'Demo Student',
                rollNumber: 'student001',
                department: 'Computer Science',
                year: '3rd Year',
                registeredDate: new Date().toLocaleDateString()
            });
            console.log('Demo Student account created: student / student123');
        }
    } catch (err) {
        console.error('Error seeding default users:', err);
    }
}


// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'smart_attendance_secret_key',
  resave: false,
  saveUninitialized: false
}));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Auth Routes
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user by username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
        
        if (!isMatch && password !== user.password) {
             return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Set session
        req.session.userId = user._id;
        req.session.role = user.role;

        // Return user info
        res.json({
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                name: user.name || user.studentName,
                rollNumber: user.rollNumber,
                department: user.department,
                year: user.year
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Register a new student account
app.post('/api/register', async (req, res) => {
    try {
        const { name, username, password, rollNumber, department, year, email } = req.body;

        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Name, username and password are required' });
        }

        // Check if username or rollNumber already exists
        const existing = await User.findOne({ $or: [{ username }, { rollNumber: rollNumber || null }].filter(x => Object.values(x)[0]) });
        if (existing) {
            return res.status(409).json({ error: 'Username or Roll Number already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const student = new User({
            id: Date.now().toString(),
            name,
            studentName: name,
            username,
            password: hashedPassword,
            role: 'student',
            rollNumber: rollNumber || '',
            department: department || '',
            year: year || '',
            email: email || '',
            registeredDate: new Date().toLocaleDateString(),
            status: 'Active',
            attendancePercentage: 0
        });
        await student.save();

        // Auto-login
        req.session.userId = student._id;
        req.session.role = 'student';

        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: student._id,
                username: student.username,
                role: 'student',
                name: student.name,
                rollNumber: student.rollNumber,
                department: student.department
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error during registration' });
    }
});


// Face Recognition Proxy Routes (Python Flask API on port 5000)
const http_module = require('http');
const { spawn, exec } = require('child_process');
const bcrypt_m = require('bcrypt');
const path_m = require('path');

const PYTHON_API = 'http://localhost:5000';

function proxyToFlask(endpoint, bodyData, res) {
    const postData = JSON.stringify(bodyData);
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    const req = http_module.request(options, (flaskRes) => {
        let data = '';
        flaskRes.on('data', chunk => data += chunk);
        flaskRes.on('end', () => {
            try {
                res.json(JSON.parse(data));
            } catch (e) {
                res.status(500).json({ error: 'Invalid response from recognition service' });
            }
        });
    });
    req.on('error', () => {
        res.status(503).json({ error: 'Face recognition service is not running. Start recognize_api.py first.' });
    });
    req.write(postData);
    req.end();
}

// Proxy: Recognize a face from a base64 image
app.post('/api/recognize', (req, res) => {
    proxyToFlask('/recognize', req.body, res);
});

// Proxy: Health check for Python API
app.get('/api/recognize/health', (req, res) => {
    const options = { hostname: 'localhost', port: 5000, path: '/health', method: 'GET' };
    const req2 = http_module.request(options, (flaskRes) => {
        let data = '';
        flaskRes.on('data', chunk => data += chunk);
        flaskRes.on('end', () => res.json(JSON.parse(data)));
    });
    req2.on('error', () => res.status(503).json({ status: 'offline', error: 'Recognition service not running' }));
    req2.end();
});

// Admin: Trigger model training
app.post('/api/train', (req, res) => {
    const scriptPath = path.join(__dirname, 'python_core', 'train.py');
    exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error('Training error:', stderr);
            return res.status(500).json({ error: 'Training failed', details: stderr });
        }
        // After training, reload model in Flask
        const reloadReq = http_module.request({ hostname: 'localhost', port: 5000, path: '/reload-model', method: 'POST' }, () => {});
        reloadReq.on('error', () => {});
        reloadReq.end();
        res.json({ message: 'Model trained successfully', output: stdout });
    });
});

// Admin: Capture dataset for a student
app.post('/api/capture/:studentId', (req, res) => {
    const studentId = req.params.studentId;
    const scriptPath = path.join(__dirname, 'python_core', 'capture.py');
    exec(`python "${scriptPath}" "${studentId}"`, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: 'Capture failed', details: stderr });
        res.json({ message: `Captured dataset for student ${studentId}`, output: stdout });
    });
});

// --- Unified User Management (Admin Only) ---

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}).select('-password').lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create any user (Admin, Staff, Student)
app.post('/api/users', async (req, res) => {
    try {
        const userData = req.body;
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }
        
        // Handle common fields
        if (userData.role === 'student' && !userData.studentName) {
            userData.studentName = userData.name;
        }

        const newUser = new User({
            id: Date.now().toString(),
            ...userData,
            registeredDate: new Date().toLocaleDateString()
        });
        
        await newUser.save();
        
        // Save photos to filesystem for training if provided
        if (userData.photos && userData.photos.length > 0) {
            await savePhotosToDataset(userData._id, userData.photos);
        }

        res.json({ message: 'User created successfully', user: newUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student: Register faces from dashboard
app.post('/api/students/register-face', async (req, res) => {
    try {
        const { userId, photos } = req.body;
        if (!userId || !photos || photos.length === 0) {
            return res.status(400).json({ error: 'User ID and photos are required' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Save to DB
        user.photos = photos;
        await user.save();

        // Save to Filesystem
        await savePhotosToDataset(user._id, photos);

        res.json({ message: 'Face registered successfully. You can now mark attendance after the system is trained.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Update user credentials or details
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // If password is being updated, hash it
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        } else {
            // Remove password field if not provided (don't overwrite with empty)
            delete updates.password;
        }

        const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).select('-password');
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete any user
app.delete('/api/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all students
app.get('/api/students', async (req, res) => {

    try {
        const students = await User.find({ role: 'student' }).select('-password').lean();
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Add a new student
app.post('/api/students', async (req, res) => {
    try {
        const { studentName, rollNumber, department, year, email, phone, username, password } = req.body;
        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
        const student = new User({
            id: Date.now().toString(),
            studentName,
            name: studentName,
            username: username || rollNumber,
            password: hashedPassword,
            rollNumber,
            department,
            year,
            email,
            phone,
            role: 'student',
            registeredDate: new Date().toLocaleDateString(),
            status: 'Active',
            attendancePercentage: 0
        });
        await student.save();
        res.json({ message: 'Student added', student });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete a student
app.delete('/api/students/:id', async (req, res) => {
    try {
        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'Student deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all attendance records
app.get('/api/attendance', async (req, res) => {
    try {
        const { date, rollNumber } = req.query;
        const query = {};
        if (date) query.date = date;
        if (rollNumber) query.rollNumber = rollNumber;
        const records = await Attendance.find(query).sort({ _id: -1 }).lean();
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Staff: Mark attendance via face recognition result
app.post('/api/attendance/mark', async (req, res) => {
    try {
        const { studentId, confidence } = req.body;
        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        const today = new Date().toLocaleDateString();
        const existing = await Attendance.findOne({ rollNumber: student.rollNumber, date: today });
        if (existing) return res.status(409).json({ error: 'Attendance already marked today', record: existing });

        const now = new Date();
        const record = new Attendance({
            id: Date.now().toString(),
            studentName: student.studentName || student.name,
            rollNumber: student.rollNumber,
            department: student.department,
            year: student.year,
            checkInTime: now.toLocaleTimeString(),
            date: today,
            status: 'Present',
            isLate: false
        });
        await record.save();
        res.json({ message: 'Attendance marked', record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export attendance as CSV
app.get('/api/attendance/export', async (req, res) => {
    try {
        const records = await Attendance.find().sort({ date: -1 }).lean();
        const headers = ['Name', 'Roll Number', 'Department', 'Year', 'Date', 'Check-In', 'Check-Out', 'Status'];
        const rows = records.map(r => [
            r.studentName || '', r.rollNumber || '', r.department || '', r.year || '',
            r.date || '', r.checkInTime || '', r.checkOutTime || 'N/A', r.status || ''
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Settings State ---
let settings = {
  officeStartTime: '09:00',
  officeEndTime: '17:00',
  lateThreshold: 15,
  departments: [
    'Computer Science',
    'Information Technology',
    'Electronics',
    'Mechanical',
    'Civil',
    'Electrical'
  ],
  years: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  theme: 'light',
  campusLocation: {
    lat: 0,
    lng: 0,
    radius: 200 // Default 200 meters allowed radius
  }
};

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    try {
        const attendanceData = await Attendance.find().sort({ _id: -1 }).lean();
        const registeredStudents = await User.find({ role: 'student' }).lean();
        
        // Send initial state to the newly connected client
        socket.emit('initial-data', {
            attendanceData,
            registeredStudents,
            settings
        });
    } catch (err) {
        console.error("Error fetching initial data", err);
    }

    // Handle new attendance record (Check-In)
    socket.on('check-in', async (record) => {
        try {
            const newRecord = new Attendance(record);
            await newRecord.save();
            // Broadcast the new record to all other clients
            socket.broadcast.emit('new-attendance', record);
        } catch (err) {
            console.error("Error saving attendance", err);
        }
    });

    // Handle checkout
    socket.on('check-out', async (updatedRecord) => {
        try {
            await Attendance.findOneAndUpdate(
                { rollNumber: updatedRecord.rollNumber, date: updatedRecord.date, checkOutTime: null },
                { $set: { checkOutTime: updatedRecord.checkOutTime, status: updatedRecord.status, duration: updatedRecord.duration } }
            );
            socket.broadcast.emit('updated-attendance', updatedRecord);
        } catch (err) {
            console.error("Error checking out", err);
        }
    });

    // Handle New Student Registration
    socket.on('register-student', async (student) => {
        try {
            // For now, if role is not set from frontend, set it to student
            student.role = 'student';
            const newStudent = new User(student);
            await newStudent.save();
            
            // Save photos to dataset folder
            if (student.photos && student.photos.length > 0) {
                await savePhotosToDataset(newStudent._id, student.photos);
            }

            socket.broadcast.emit('new-student', student);

        } catch (err) {
            console.error("Error registering student", err);
        }
    });

    // Handle Delete Student
    socket.on('delete-student', async (studentId) => {
        try {
            await User.deleteOne({ id: studentId });
            socket.broadcast.emit('student-deleted', studentId);
        } catch (err) {
            console.error("Error deleting student", err);
        }
    });

    // Handle Settings Update
    socket.on('update-settings', (newSettings) => {
        settings = newSettings;
        socket.broadcast.emit('settings-updated', settings);
    });

    // Handle Data Clear
    socket.on('clear-all-data', async () => {
        try {
            await Attendance.deleteMany({});
            await User.deleteMany({ role: 'student' });
            socket.broadcast.emit('data-cleared');
        } catch (err) {
            console.error("Error clearing data", err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
