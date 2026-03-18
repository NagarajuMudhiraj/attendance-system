const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  id: { type: String },
  studentName: { type: String },
  rollNumber: { type: String },
  department: { type: String },
  year: { type: String },
  checkInTime: { type: String },
  checkOutTime: { type: String, default: null },
  date: { type: String },
  status: { type: String },
  isLate: { type: Boolean },
  lateReason: { type: String },
  duration: { type: String, default: null }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
