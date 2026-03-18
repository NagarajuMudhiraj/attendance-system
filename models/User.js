const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  username: { type: String, unique: true, sparse: true },
  password: { type: String },
  role: { type: String, enum: ['admin', 'staff', 'student'], default: 'student' },
  studentName: { type: String },
  rollNumber: { type: String, sparse: true },
  department: { type: String },
  year: { type: String },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  photos: [String],
  qrCode: { type: String },
  registeredDate: { type: String },
  status: { type: String, default: 'Active' },
  attendancePercentage: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
