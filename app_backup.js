// State Management
let attendanceData = [];
let registeredStudents = [];
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
  theme: 'light'
};

let currentStep = 1;
let cameraStream = null;
let capturedPhotos = [];
let registrationData = {};

// --- Role-Based Access Control ---
let currentUser = null;

function initializeAuth() {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) {
    window.location.href = 'login.html';
    return false;
  }
  
  currentUser = JSON.parse(storedUser);
  
  // Role-based visibility logic
  // First, hide everything that needs restricted access
  document.querySelectorAll('.admin-only, .staff-admin-only, .student-only').forEach(el => {
    el.style.display = 'none';
  });

  // Then, show elements based on role
  if (currentUser.role === 'admin') {
    // Admins see everything
    document.querySelectorAll('.admin-only, .staff-admin-only').forEach(el => {
      el.style.display = el.tagName === 'LI' ? 'list-item' : 'block';
    });
  } else if (currentUser.role === 'staff') {
    // Staff see staff elements but not admin elements
    document.querySelectorAll('.staff-admin-only').forEach(el => {
      el.style.display = el.tagName === 'LI' ? 'list-item' : 'block';
    });
  } else if (currentUser.role === 'student') {
    // Students see student elements
    document.querySelectorAll('.student-only').forEach(el => {
      el.style.display = el.tagName === 'LI' ? 'list-item' : 'block';
    });
  }


  // Handle Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
          await fetch('/api/logout', { method: 'POST' });
      } catch (err) {
          console.error('Logout error:', err);
      }
      localStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    });
  }
  return true;
}

// --- Real-time Socket Connection ---
const socket = io();

// Initial data sync
socket.on('initial-data', (data) => {
  attendanceData = data.attendanceData || [];
  registeredStudents = data.registeredStudents || [];
  if (data.settings) {
    settings = { ...settings, ...data.settings };
  }
  updateAllDisplays();
});

// Listeners for real-time events
socket.on('new-attendance', (record) => {
  attendanceData.unshift(record);
  updateAllDisplays();
});

socket.on('updated-attendance', (record) => {
  const index = attendanceData.findIndex(a => 
      a.rollNumber === record.rollNumber && 
      a.date === record.date && 
      a.checkOutTime === null
  );
  if (index !== -1) {
    attendanceData[index] = record;
    updateAllDisplays();
  }
});

socket.on('new-student', (student) => {
  registeredStudents.push(student);
  updateAllDisplays();
});

socket.on('student-deleted', (studentId) => {
  registeredStudents = registeredStudents.filter(s => s.id !== studentId);
  updateAllDisplays();
});

socket.on('settings-updated', (newSettings) => {
  settings = newSettings;
  updateAllDisplays();
});

socket.on('data-cleared', () => {
  attendanceData = [];
  registeredStudents = [];
  updateAllDisplays();
});

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  if (!initializeAuth()) return; // Stop initialization if not authenticated

  loadData();
  initializeNavigation();
  initializeTime();
  populateSelects();
  initializeForms();
  initializeSettings();
  updateAllDisplays();
  initializeAnimations();
  initializeRippleEffects();
  initializeStudentPanel(); // Student face attendance panel
});

// Data Persistence - Using in-memory storage only
function loadData() {
  // Data is stored in memory only during the session
  // No persistent storage available in sandboxed environment
}

function saveData() {
  // Data persistence not available in sandboxed environment
  // All data is stored in memory and will be lost on page refresh
}

// Navigation
function initializeNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const quickActions = document.querySelectorAll('.quick-action-btn');
  const hamburger = document.getElementById('hamburger');
  const navLinksContainer = document.getElementById('navLinks');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      showPage(page);
      navLinksContainer.classList.remove('active');
    });
  });

  quickActions.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      showPage(page);
    });
  });

  hamburger.addEventListener('click', () => {
    navLinksContainer.classList.toggle('active');
  });
}

function showPage(pageName) {
  // Prevent non-admins from loading restricted pages
  if (currentUser.role !== 'admin' && (pageName === 'analytics' || pageName === 'settings')) {
    showToast('Unauthorized access. Admin role required.', 'error');
    return;
  }

  // Prevent students from loading staff/admin pages
  if (currentUser.role === 'student' && (pageName === 'register' || pageName === 'attendance')) {
    if (pageName === 'attendance') {
      showPage('student-attendance'); // Redirect to face attendance
    } else {
      showToast('Unauthorized access. Staff/Admin role required.', 'error');
    }
    return;
  }

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageName).classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-page') === pageName) {
      link.classList.add('active');
    }
  });

  if (pageName === 'register') {
    displayAllUsers();
  }

  if (pageName === 'profile') {
    initializeProfile();
  }
}

// Time Updates
function initializeTime() {
  updateTime();
  setInterval(updateTime, 1000);
}

function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const timeEl = document.getElementById('currentTime');
  if (timeEl) timeEl.textContent = timeStr;

  // Update greeting
  const hour = now.getHours();
  let greeting = 'Good Evening';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  else if (hour < 21) greeting = 'Good Evening';
  else greeting = 'Good Night';

  const greetingEl = document.getElementById('greeting');
  if (greetingEl) greetingEl.textContent = `${greeting}! 👋`;
}

// Populate Selects
function populateSelects() {
  const deptSelects = ['attDepartment', 'regDepartment', 'filterDepartment', 'filterRegDepartment'];
  const yearSelects = ['attYear', 'regYear'];

  deptSelects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const hasAllOption = id.includes('filter');
      if (hasAllOption) {
        select.innerHTML = '<option value="">All Departments</option>';
      } else {
        select.innerHTML = '';
      }
      settings.departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        select.appendChild(option);
      });
    }
  });

  yearSelects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = '';
      settings.years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
      });
    }
  });
}

// Forms Initialization
function initializeForms() {
  // Attendance Form
  document.getElementById('checkInBtn').addEventListener('click', handleCheckIn);
  document.getElementById('checkOutBtn').addEventListener('click', handleCheckOut);
  document.getElementById('exportAttendanceBtn').addEventListener('click', exportAttendance);

  // Search and Filter
  document.getElementById('searchRecords').addEventListener('input', filterRecords);
  document.getElementById('filterDepartment').addEventListener('change', filterRecords);
  document.getElementById('filterStatus').addEventListener('change', filterRecords);

  // Registration Wizard
  document.getElementById('step1Next').addEventListener('click', () => goToStep(2));
  document.getElementById('step2Prev').addEventListener('click', () => goToStep(1));
  document.getElementById('step2Next').addEventListener('click', () => goToStep(3));
  document.getElementById('step3Prev').addEventListener('click', () => goToStep(2));
  document.getElementById('step3Next').addEventListener('click', () => goToStep(4));
  document.getElementById('step4Prev').addEventListener('click', () => goToStep(3));
  document.getElementById('finalRegister').addEventListener('click', handleRegistration);

  // Camera Controls
  document.getElementById('startCamera').addEventListener('click', startCamera);
  document.getElementById('capturePhoto').addEventListener('click', capturePhoto);
  document.getElementById('stopCamera').addEventListener('click', stopCamera);

  // Student Search
  document.getElementById('searchStudents').addEventListener('input', filterStudents);
  document.getElementById('filterRegDepartment').addEventListener('change', filterStudents);

  // View Toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.getAttribute('data-view');
      const grid = document.getElementById('registeredStudents');
      if (view === 'list') {
        grid.classList.add('list-view');
      } else {
        grid.classList.remove('list-view');
      }
    });
  });
}

// Attendance Functions
// Helper to calculate distance in meters (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const φ1 = lat1 * rad;
  const φ2 = lat2 * rad;
  const Δφ = (lat2 - lat1) * rad;
  const Δλ = (lon2 - lon1) * rad;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
}

function handleCheckIn() {
  const name = document.getElementById('attStudentName').value.trim();
  const rollNo = document.getElementById('attRollNumber').value.trim();
  const dept = document.getElementById('attDepartment').value;
  const year = document.getElementById('attYear').value;
  const btn = document.getElementById('checkInBtn');

  if (!name || !rollNo) {
    showToast('Please fill in all required fields!', 'error');
    return;
  }

  const today = new Date().toLocaleDateString();
  const existing = attendanceData.find(a => 
    a.rollNumber === rollNo && 
    a.date === today && 
    (a.status === 'Present' || a.status === 'Late')
  );

  if (existing) {
    showToast('You are already checked in today!', 'warning');
    return;
  }

  // Check Geofencing
  if (settings.campusLocation && settings.campusLocation.lat !== 0 && settings.campusLocation.lng !== 0) {
    if (!navigator.geolocation) {
      showToast('Geolocation is required for checking in!', 'error');
      return;
    }

    btn.disabled = true;
    const previousText = btn.innerHTML;
    btn.innerHTML = '<span>⏳ Verifying Location...</span>';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = calculateDistance(
          position.coords.latitude, 
          position.coords.longitude,
          settings.campusLocation.lat,
          settings.campusLocation.lng
        );

        if (distance > settings.campusLocation.radius) {
          showToast(`Check-In Blocked! You are ${Math.round(distance)} meters away. (Max ${settings.campusLocation.radius}m)`, 'error');
          btn.disabled = false;
          btn.innerHTML = previousText;
          return;
        }

        // Within geofence, proceed
        finalizeCheckIn(name, rollNo, dept, year);
        btn.disabled = false;
        btn.innerHTML = previousText;
      },
      (error) => {
        showToast('You must allow Location Access to mark attendance!', 'error');
        btn.disabled = false;
        btn.innerHTML = previousText;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    // If Admin hasn't set coordinates, skip Geolocation check
    finalizeCheckIn(name, rollNo, dept, year);
  }
}

function finalizeCheckIn(name, rollNo, dept, year) {
  const today = new Date().toLocaleDateString();
  const now = new Date();
  const checkInTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const isLate = checkIsLate(now);

  const record = {
    id: Date.now(),
    studentName: name,
    rollNumber: rollNo,
    department: dept,
    year: year,
    checkInTime: checkInTime,
    checkOutTime: null,
    date: today,
    status: isLate ? 'Late' : 'Present',
    isLate: isLate,
    lateReason: isLate ? document.getElementById('lateReason').value : null,
    duration: null
  };

  attendanceData.unshift(record);
  socket.emit('check-in', record);
  
  saveData();
  updateAllDisplays();
  showToast(`Welcome ${name}! Attendance marked successfully.`, 'success');

  // Clear form
  document.getElementById('attStudentName').value = '';
  document.getElementById('attRollNumber').value = '';
  document.getElementById('lateReason').value = '';
}

function handleCheckOut() {
  const rollNo = document.getElementById('attRollNumber').value.trim();

  if (!rollNo) {
    showToast('Please enter your Roll Number!', 'error');
    return;
  }

  const today = new Date().toLocaleDateString();
  const record = attendanceData.find(a => 
    a.rollNumber === rollNo && 
    a.date === today && 
    a.checkOutTime === null
  );

  if (!record) {
    showToast('No active check-in found!', 'error');
    return;
  }

  const now = new Date();
  record.checkOutTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  record.status = 'Checked Out';
  record.duration = calculateDuration(record.checkInTime, record.checkOutTime);

  socket.emit('check-out', record);

  saveData();
  updateAllDisplays();
  showToast(`Goodbye ${record.studentName}! Check-out successful.`, 'success');

  document.getElementById('attStudentName').value = '';
  document.getElementById('attRollNumber').value = '';
}

function checkIsLate(time) {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const [startHours, startMinutes] = settings.officeStartTime.split(':').map(Number);
  
  const timeInMinutes = hours * 60 + minutes;
  const startTimeInMinutes = startHours * 60 + startMinutes + settings.lateThreshold;
  
  return timeInMinutes > startTimeInMinutes;
}

function calculateDuration(startTime, endTime) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  const diff = end - start;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function displayAttendanceRecords() {
  const container = document.getElementById('attendanceRecords');
  const today = new Date().toLocaleDateString();
  const todayRecords = attendanceData.filter(a => a.date === today);

  if (todayRecords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No Records Yet</h3>
        <p>No attendance records for today</p>
      </div>
    `;
    return;
  }

  container.innerHTML = todayRecords.map(record => `
    <div class="record-item">
      <div class="record-info">
        <h4>${record.studentName} - ${record.rollNumber}</h4>
        <p>${record.department} | ${record.year}</p>
        <p>Check-in: ${record.checkInTime} ${record.checkOutTime ? '| Check-out: ' + record.checkOutTime : ''}</p>
        ${record.duration ? `<p style="font-size: 0.85em; color: var(--light-ash);">Duration: ${record.duration}</p>` : ''}
        ${record.isLate && record.lateReason ? `<p style="font-size: 0.85em; color: var(--warning);">Reason: ${record.lateReason}</p>` : ''}
      </div>
      <span class="status-badge status-${record.status === 'Present' ? 'present' : record.status === 'Late' ? 'late' : 'checked-out'}">
        ${record.status}
      </span>
    </div>
  `).join('');
  
  // Add stagger animation to record items
  const recordItems = container.querySelectorAll('.record-item');
  addStaggerAnimation(recordItems);
}

function filterRecords() {
  const search = document.getElementById('searchRecords').value.toLowerCase();
  const deptFilter = document.getElementById('filterDepartment').value;
  const statusFilter = document.getElementById('filterStatus').value;

  const today = new Date().toLocaleDateString();
  let filtered = attendanceData.filter(a => a.date === today);

  if (search) {
    filtered = filtered.filter(a => 
      a.studentName.toLowerCase().includes(search) ||
      a.rollNumber.toLowerCase().includes(search)
    );
  }

  if (deptFilter) {
    filtered = filtered.filter(a => a.department === deptFilter);
  }

  if (statusFilter) {
    filtered = filtered.filter(a => a.status === statusFilter);
  }

  const container = document.getElementById('attendanceRecords');
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No Results Found</h3>
        <p>Try adjusting your filters</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(record => `
    <div class="record-item">
      <div class="record-info">
        <h4>${record.studentName} - ${record.rollNumber}</h4>
        <p>${record.department} | ${record.year}</p>
        <p>Check-in: ${record.checkInTime} ${record.checkOutTime ? '| Check-out: ' + record.checkOutTime : ''}</p>
        ${record.duration ? `<p style="font-size: 0.85em;">Duration: ${record.duration}</p>` : ''}
      </div>
      <span class="status-badge status-${record.status === 'Present' ? 'present' : record.status === 'Late' ? 'late' : 'checked-out'}">
        ${record.status}
      </span>
    </div>
  `).join('');
  
  // Add stagger animation to filtered items
  const recordItems = container.querySelectorAll('.record-item');
  addStaggerAnimation(recordItems);
}

function exportAttendance() {
  const today = new Date().toLocaleDateString();
  const todayRecords = attendanceData.filter(a => a.date === today);

  if (todayRecords.length === 0) {
    showToast('No records to export!', 'warning');
    return;
  }

  const csv = [
    ['Name', 'Roll Number', 'Department', 'Year', 'Check-In', 'Check-Out', 'Status', 'Duration', 'Date'].join(','),
    ...todayRecords.map(r => [
      r.studentName,
      r.rollNumber,
      r.department,
      r.year,
      r.checkInTime,
      r.checkOutTime || 'N/A',
      r.status,
      r.duration || 'N/A',
      r.date
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${today.replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Attendance exported successfully!', 'success');
}

// Registration Functions
function goToStep(step) {
  if (step === 2 && currentStep === 1) {
    const name = document.getElementById('regStudentName').value.trim();
    const rollNo = document.getElementById('regRollNumber').value.trim();
    if (!name || !rollNo) {
      showToast('Please fill in all required fields!', 'error');
      return;
    }

    // Check if already registered
    if (registeredStudents.find(s => s.rollNumber === rollNo)) {
      showToast('This roll number is already registered!', 'error');
      return;
    }
  }

  if (step === 4 && currentStep === 3) {
    if (capturedPhotos.length === 0) {
      showToast('Please capture at least one photo!', 'error');
      return;
    }
    displayReview();
  }

  currentStep = step;
  document.querySelectorAll('.wizard-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`step${step}`).classList.add('active');

  document.querySelectorAll('.wizard-step').forEach(s => {
    s.classList.remove('active', 'completed');
  });
  document.querySelectorAll('.wizard-step').forEach((s, i) => {
    if (i + 1 < step) s.classList.add('completed');
    if (i + 1 === step) s.classList.add('active');
  });
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      cameraStream = stream;
      document.getElementById('video').srcObject = stream;
      document.getElementById('capturePhoto').disabled = false;
      document.getElementById('stopCamera').disabled = false;
      showToast('Camera started successfully!', 'success');
    })
    .catch(err => {
      showToast('Unable to access camera. Please check permissions.', 'error');
      console.error(err);
    });
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    document.getElementById('video').srcObject = null;
    document.getElementById('capturePhoto').disabled = true;
    document.getElementById('stopCamera').disabled = true;
    showToast('Camera stopped', 'success');
  }
}

function capturePhoto() {
  if (capturedPhotos.length >= 5) {
    showToast('Maximum 5 photos allowed!', 'warning');
    return;
  }

  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  const photo = canvas.toDataURL('image/png');
  
  capturedPhotos.push(photo);
  displayCapturedPhotos();
  showToast(`Photo ${capturedPhotos.length} captured!`, 'success');
}

function displayCapturedPhotos() {
  const container = document.getElementById('capturedPhotos');
  container.innerHTML = capturedPhotos.map((photo, index) => `
    <div class="photo-preview">
      <img src="${photo}" alt="Photo ${index + 1}">
      <button class="photo-delete" onclick="deletePhoto(${index})">×</button>
    </div>
  `).join('');
}

function deletePhoto(index) {
  capturedPhotos.splice(index, 1);
  displayCapturedPhotos();
  showToast('Photo deleted', 'success');
}

function displayReview() {
  const name = document.getElementById('regStudentName').value;
  const rollNo = document.getElementById('regRollNumber').value;
  const dept = document.getElementById('regDepartment').value;
  const year = document.getElementById('regYear').value;
  const email = document.getElementById('regEmail').value || 'Not provided';
  const phone = document.getElementById('regPhone').value || 'Not provided';
  const address = document.getElementById('regAddress').value || 'Not provided';

  const reviewContent = document.getElementById('reviewContent');
  reviewContent.innerHTML = `
    <div class="review-section">
      <h4>Basic Information</h4>
      <div class="review-field">
        <span class="review-label">Name:</span>
        <span class="review-value">${name}</span>
      </div>
      <div class="review-field">
        <span class="review-label">Roll Number:</span>
        <span class="review-value">${rollNo}</span>
      </div>
      <div class="review-field">
        <span class="review-label">Department:</span>
        <span class="review-value">${dept}</span>
      </div>
      <div class="review-field">
        <span class="review-label">Year:</span>
        <span class="review-value">${year}</span>
      </div>
    </div>

    <div class="review-section">
      <h4>Additional Details</h4>
      <div class="review-field">
        <span class="review-label">Email:</span>
        <span class="review-value">${email}</span>
      </div>
      <div class="review-field">
        <span class="review-label">Phone:</span>
        <span class="review-value">${phone}</span>
      </div>
      <div class="review-field">
        <span class="review-label">Address:</span>
        <span class="review-value">${address}</span>
      </div>
    </div>

    <div class="review-section">
      <h4>Captured Photos (${capturedPhotos.length})</h4>
      <div class="captured-photos">
        ${capturedPhotos.map((photo, i) => `
          <div class="photo-preview">
            <img src="${photo}" alt="Photo ${i + 1}">
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function handleRegistration() {
  const student = {
    id: Date.now(),
    studentName: document.getElementById('regStudentName').value,
    rollNumber: document.getElementById('regRollNumber').value,
    department: document.getElementById('regDepartment').value,
    year: document.getElementById('regYear').value,
    email: document.getElementById('regEmail').value || null,
    phone: document.getElementById('regPhone').value || null,
    address: document.getElementById('regAddress').value || null,
    photos: [...capturedPhotos],
    qrCode: generateQRCode(document.getElementById('regRollNumber').value),
    registeredDate: new Date().toLocaleDateString(),
    status: 'Active',
    attendancePercentage: 0
  };

  registeredStudents.push(student);
  socket.emit('register-student', student);
  saveData();
  
  // Stop camera
  stopCamera();
  
  // Reset form
  resetRegistrationForm();
  
  updateAllDisplays();
  showToast(`${student.studentName} registered successfully!`, 'success');
  
  // Go back to step 1
  goToStep(1);
}

function resetRegistrationForm() {
  document.getElementById('regStudentName').value = '';
  document.getElementById('regRollNumber').value = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPhone').value = '';
  document.getElementById('regAddress').value = '';
  capturedPhotos = [];
  displayCapturedPhotos();
}

function generateQRCode(data) {
  // Simple QR code placeholder - in production, use a QR library
  return `QR-${data}-${Date.now()}`;
}

async function displayAllUsers() {
  const container = document.getElementById('registeredStudents');
  if (!container) return;

  try {
    // If admin, fetch all users. If staff, maybe just students? 
    // For this requirement, we focus on Admin managing everyone.
    const endpoint = currentUser.role === 'admin' ? '/api/users' : '/api/students';
    const res = await fetch(endpoint);
    const users = await res.json();
    
    // Sort students to the top of the local list for continuity, but show all
    registeredStudents = users;

    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>No Users Found</h3>
          <p>Register or add users to see them here</p>
        </div>
      `;
      return;
    }

    container.innerHTML = users.map(user => {
      const photo = (user.photos && user.photos.length > 0) ? user.photos[0] : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
      const roleBadge = `<span class="status-badge status-${user.role}">${user.role.toUpperCase()}</span>`;
      
      return `
        <div class="student-card user-card-${user.role}">
          <img src="${photo}" alt="${user.name || user.username}" class="student-photo">
          <h4>${user.name || user.username}</h4>
          <p>${user.rollNumber || 'No Roll #'}</p>
          <div style="margin: 5px 0;">${roleBadge}</div>
          <p style="font-size: 0.85em;">${user.department || 'N/A'}</p>
          <div class="student-actions">
            <button class="btn btn-outline" onclick="viewUser('${user._id}')" title="View Details">👁️</button>
            <button class="btn btn-primary" onclick="editUser('${user._id}')" title="Edit Credentials">✏️</button>
            <button class="btn btn-danger" onclick="deleteUser('${user._id}')" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
    
    initializeRippleEffects();
  } catch (err) {
    console.error('Error displaying users:', err);
  }
}

// Redirect old function call to new one
function displayRegisteredStudents() {
  displayAllUsers();
}


function filterStudents() {
  const search = document.getElementById('searchStudents').value.toLowerCase();
  const deptFilter = document.getElementById('filterRegDepartment').value;

  let filtered = registeredStudents;

  if (search) {
    filtered = filtered.filter(s => 
      s.studentName.toLowerCase().includes(search) ||
      s.rollNumber.toLowerCase().includes(search)
    );
  }

  if (deptFilter) {
    filtered = filtered.filter(s => s.department === deptFilter);
  }

  const container = document.getElementById('registeredStudents');
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No Results Found</h3>
        <p>Try adjusting your filters</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(student => `
    <div class="student-card">
      <img src="${student.photos[0]}" alt="${student.studentName}" class="student-photo">
      <h4>${student.studentName}</h4>
      <p>${student.rollNumber}</p>
      <p style="font-size: 0.85em;">${student.department}</p>
      <p style="font-size: 0.85em;">${student.year}</p>
      <div class="student-actions">
        <button class="btn btn-outline" onclick="viewStudent(${student.id})">👁️</button>
        <button class="btn btn-danger" onclick="deleteStudent(${student.id})">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Re-initialize ripple effects for new buttons
  setTimeout(() => {
    initializeRippleEffects();
  }, 100);
}

function viewUser(id) {
  const user = registeredStudents.find(u => u._id === id || u.id === id);
  if (!user) return;

  showModal(
    'User Details',
    `
      <div style="text-align: left;">
        <p><strong>Name:</strong> ${user.name || user.studentName}</p>
        <p><strong>Username:</strong> ${user.username}</p>
        <p><strong>Role:</strong> ${user.role}</p>
        ${user.rollNumber ? `<p><strong>Roll Number:</strong> ${user.rollNumber}</p>` : ''}
        ${user.department ? `<p><strong>Department:</strong> ${user.department}</p>` : ''}
        ${user.year ? `<p><strong>Year:</strong> ${user.year}</p>` : ''}
        ${user.email ? `<p><strong>Email:</strong> ${user.email}</p>` : ''}
        <p><strong>Registered:</strong> ${user.registeredDate}</p>
        <div style="margin-top: 20px; display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="editUser('${id}'); closeModal();">Edit User</button>
          <button class="btn btn-outline" onclick="closeModal()">Close</button>
        </div>
      </div>
    `
  );
}

function editUser(id) {
  const user = registeredStudents.find(u => u._id === id || u.id === id);
  if (!user) return;

  showModal(
    'Edit User Credentials',
    `
      <form id="editUserForm" onsubmit="handleUpdateUser(event, '${id}')">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" id="editName" class="form-control" value="${user.name || user.studentName || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" id="editUsername" class="form-control" value="${user.username}" required>
        </div>
        <div class="form-group">
          <label class="form-label">New Password (Leave blank to keep current)</label>
          <input type="password" id="editPassword" class="form-control" placeholder="••••••••">
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select id="editRole" class="form-control">
            <option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option>
            <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="modal-footer" style="margin-top: 20px;">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `
  );
}

async function handleUpdateUser(event, id) {
  event.preventDefault();
  const name = document.getElementById('editName').value;
  const username = document.getElementById('editUsername').value;
  const password = document.getElementById('editPassword').value;
  const role = document.getElementById('editRole').value;

  const updates = { name, username, role };
  if (password) updates.password = password;

  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (res.ok) {
      showToast('User updated successfully!', 'success');
      closeModal();
      displayAllUsers(); // Refresh list
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update user', 'error');
    }
  } catch (err) {
    showToast('Network error while updating user', 'error');
  }
}

function deleteUser(id) {
  showConfirmModal(
    'Delete User',
    'Are you sure you want to delete this user? This will permanently remove their account.',
    async () => {
      try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('User deleted successfully!', 'success');
          displayAllUsers(); // Refresh list
        } else {
          showToast('Failed to delete user', 'error');
        }
      } catch (err) {
        showToast('Network error while deleting user', 'error');
      }
    }
  );
}

// Map old viewStudent/deleteStudent calls to the new ones
window.viewStudent = viewUser;
window.deleteStudent = deleteUser;
window.editUser = editUser;
window.handleUpdateUser = handleUpdateUser;


// Statistics
function updateStatistics() {
  const today = new Date().toLocaleDateString();
  const todayRecords = attendanceData.filter(a => a.date === today);
  
  const present = todayRecords.filter(a => a.status === 'Present').length;
  const late = todayRecords.filter(a => a.status === 'Late').length;
  const checkedOut = todayRecords.filter(a => a.status === 'Checked Out').length;
  const registered = registeredStudents.length;

  animateCounter('statPresent', present);
  animateCounter('statLate', late);
  animateCounter('statCheckedOut', checkedOut);
  animateCounter('statRegistered', registered);
}

function animateCounter(id, target) {
  const element = document.getElementById(id);
  if (!element) return;

  const current = parseInt(element.textContent) || 0;
  const increment = Math.ceil((target - current) / 20);
  
  if (current < target) {
    element.textContent = Math.min(current + increment, target);
    setTimeout(() => animateCounter(id, target), 30);
  } else {
    element.textContent = target;
  }
}

function displayRecentActivity() {
  const container = document.getElementById('recentActivity');
  const recent = attendanceData.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>No recent activity</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(record => `
    <div class="activity-item">
      <h4>${record.studentName}</h4>
      <p>${record.status} - ${record.department}</p>
      <p class="activity-time">${record.checkInTime} | ${record.date}</p>
    </div>
  `).join('');
}

function displayDepartmentBreakdown() {
  const container = document.getElementById('departmentBreakdown');
  const today = new Date().toLocaleDateString();
  const todayRecords = attendanceData.filter(a => a.date === today);

  const breakdown = {};
  settings.departments.forEach(dept => {
    breakdown[dept] = todayRecords.filter(r => r.department === dept).length;
  });

  const hasData = Object.values(breakdown).some(count => count > 0);
  if (!hasData) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No data available</p>
      </div>
    `;
    return;
  }

  container.innerHTML = Object.entries(breakdown)
    .filter(([_, count]) => count > 0)
    .map(([dept, count]) => `
      <div class="dept-item">
        <span class="dept-name">${dept}</span>
        <span class="dept-count">${count}</span>
      </div>
    `).join('');
}

// Charts
function initializeCharts() {
  initAttendanceChart();
  initDepartmentChart();
  initTrendChart();
  displayTopStudents();
}

function initAttendanceChart() {
  const canvas = document.getElementById('attendanceChart');
  const ctx = canvas.getContext('2d');
  
  const today = new Date().toLocaleDateString();
  const todayRecords = attendanceData.filter(a => a.date === today);
  
  const present = todayRecords.filter(a => a.status === 'Present').length;
  const late = todayRecords.filter(a => a.status === 'Late').length;
  const checkedOut = todayRecords.filter(a => a.status === 'Checked Out').length;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Late', 'Checked Out'],
      datasets: [{
        data: [present, late, checkedOut],
        backgroundColor: ['#10B981', '#F59E0B', '#6B7280'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function initDepartmentChart() {
  const canvas = document.getElementById('departmentChart');
  const ctx = canvas.getContext('2d');
  
  const today = new Date().toLocaleDateString();
  const todayRecords = attendanceData.filter(a => a.date === today);
  
  const data = settings.departments.map(dept => 
    todayRecords.filter(r => r.department === dept).length
  );

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: settings.departments,
      datasets: [{
        label: 'Attendance Count',
        data: data,
        backgroundColor: '#6B7280',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

function initTrendChart() {
  const canvas = document.getElementById('trendChart');
  const ctx = canvas.getContext('2d');
  
  // Get last 7 days
  const labels = [];
  const data = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString();
    labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    data.push(attendanceData.filter(a => a.date === dateStr).length);
  }

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Attendance',
        data: data,
        borderColor: '#6B7280',
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

function displayTopStudents() {
  const container = document.getElementById('topStudents');
  
  // Calculate attendance percentage for registered students
  const studentsWithPercentage = registeredStudents.map(student => {
    const totalDays = [...new Set(attendanceData.map(a => a.date))].length;
    const attended = attendanceData.filter(a => a.rollNumber === student.rollNumber).length;
    const percentage = totalDays > 0 ? Math.round((attended / totalDays) * 100) : 0;
    return { ...student, percentage };
  });

  const top = studentsWithPercentage
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  if (top.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <p>No data available</p>
      </div>
    `;
    return;
  }

  container.innerHTML = top.map((student, index) => `
    <div class="leaderboard-item">
      <div class="rank">${index + 1}</div>
      <div class="leaderboard-info">
        <h4>${student.studentName}</h4>
        <p>${student.rollNumber} - ${student.department}</p>
      </div>
      <div class="percentage">${student.percentage}%</div>
    </div>
  `).join('');
}

// Settings
function initializeSettings() {
  document.getElementById('officeStartTime').value = settings.officeStartTime;
  document.getElementById('officeEndTime').value = settings.officeEndTime;
  document.getElementById('lateThreshold').value = settings.lateThreshold;

  if (settings.campusLocation) {
    document.getElementById('campusLat').value = settings.campusLocation.lat || 0;
    document.getElementById('campusLng').value = settings.campusLocation.lng || 0;
    document.getElementById('campusRadius').value = settings.campusLocation.radius || 200;
  }

  document.getElementById('saveTimeSettings').addEventListener('click', saveTimeSettings);
  document.getElementById('saveLocationSettings').addEventListener('click', saveLocationSettings);
  document.getElementById('useCurrentLocationBtn').addEventListener('click', useCurrentLocation);
  
  document.getElementById('addDepartment').addEventListener('click', addDepartment);
  document.getElementById('exportAllData').addEventListener('click', exportAllData);
  document.getElementById('importData').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importData);
  document.getElementById('clearAllData').addEventListener('click', clearAllData);

  displayDepartmentsList();
}

function saveTimeSettings() {
  settings.officeStartTime = document.getElementById('officeStartTime').value;
  settings.officeEndTime = document.getElementById('officeEndTime').value;
  settings.lateThreshold = parseInt(document.getElementById('lateThreshold').value);
  
  socket.emit('update-settings', settings);
  saveData();
  showToast('Settings saved successfully!', 'success');
}

function saveLocationSettings() {
  const lat = parseFloat(document.getElementById('campusLat').value);
  const lng = parseFloat(document.getElementById('campusLng').value);
  const radius = parseInt(document.getElementById('campusRadius').value);

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    showToast('Please enter valid location numbers!', 'error');
    return;
  }

  settings.campusLocation = { lat, lng, radius };
  socket.emit('update-settings', settings);
  saveData();
  showToast('Location settings saved successfully!', 'success');
}

function useCurrentLocation() {
  const btn = document.getElementById('useCurrentLocationBtn');
  btn.textContent = '📍 Locating...';
  btn.disabled = true;

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    btn.textContent = '📍 Use My Location';
    btn.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.getElementById('campusLat').value = position.coords.latitude;
      document.getElementById('campusLng').value = position.coords.longitude;
      showToast('Location matched!', 'success');
      btn.textContent = '📍 Use My Location';
      btn.disabled = false;
    },
    (error) => {
      showToast('Unable to retrieve your location', 'error');
      btn.textContent = '📍 Use My Location';
      btn.disabled = false;
    }
  );
}

function addDepartment() {
  const input = document.getElementById('newDepartment');
  const dept = input.value.trim();
  
  if (!dept) {
    showToast('Please enter a department name!', 'error');
    return;
  }
  
  if (settings.departments.includes(dept)) {
    showToast('Department already exists!', 'warning');
    return;
  }
  
  settings.departments.push(dept);
  socket.emit('update-settings', settings);
  saveData();
  populateSelects();
  displayDepartmentsList();
  input.value = '';
  showToast('Department added successfully!', 'success');
}

function displayDepartmentsList() {
  const container = document.getElementById('departmentsList');
  container.innerHTML = settings.departments.map((dept, index) => `
    <div class="settings-item">
      <span>${dept}</span>
      <button class="btn btn-danger" onclick="removeDepartment(${index})" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Remove</button>
    </div>
  `).join('');
}

function removeDepartment(index) {
  const dept = settings.departments[index];
  showConfirmModal(
    'Remove Department',
    `Are you sure you want to remove "${dept}"?`,
    () => {
      settings.departments.splice(index, 1);
      socket.emit('update-settings', settings);
      saveData();
      populateSelects();
      displayDepartmentsList();
      showToast('Department removed!', 'success');
    }
  );
}

function exportAllData() {
  const data = {
    attendanceData,
    registeredStudents,
    settings,
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Data exported successfully!', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      attendanceData = data.attendanceData || [];
      registeredStudents = data.registeredStudents || [];
      settings = { ...settings, ...(data.settings || {}) };
      
      saveData();
      populateSelects();
      updateAllDisplays();
      showToast('Data imported successfully!', 'success');
    } catch (error) {
      showToast('Invalid file format!', 'error');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  showConfirmModal(
    'Clear All Data',
    'This will permanently delete all attendance records and registered students. This action cannot be undone!',
    () => {
      attendanceData = [];
      registeredStudents = [];
      socket.emit('clear-all-data');
      saveData();
      updateAllDisplays();
      showToast('All data cleared!', 'success');
    }
  );
}

// UI Helpers
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showModal(title, body) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal">
      <h2 class="modal-title">${title}</h2>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `;
  container.classList.add('active');
}

function showConfirmModal(title, body, onConfirm) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal">
      <h2 class="modal-title">${title}</h2>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="confirmBtn">Confirm</button>
      </div>
    </div>
  `;
  container.classList.add('active');
  
  document.getElementById('confirmBtn').addEventListener('click', () => {
    onConfirm();
    closeModal();
  });
}

function closeModal() {
  document.getElementById('modalContainer').classList.remove('active');
}

// Update All Displays
function updateAllDisplays() {
  updateStatistics();
  displayAttendanceRecords();
  displayRegisteredStudents();
  displayRecentActivity();
  displayDepartmentBreakdown();
}

// Animation Enhancements
function initializeAnimations() {
  // Intersection Observer for card animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe all cards and animated elements
  const animatedElements = document.querySelectorAll('.card, .stat-card, .quick-action-btn');
  animatedElements.forEach(el => {
    observer.observe(el);
  });
}

function initializeRippleEffects() {
  // Add ripple effect to all buttons
  const buttons = document.querySelectorAll('.btn, .quick-action-btn');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple-effect');
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
  
  // Add ripple effect styles dynamically
  if (!document.getElementById('ripple-styles')) {
    const style = document.createElement('style');
    style.id = 'ripple-styles';
    style.textContent = `
      .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
      }
      
      @keyframes ripple-animation {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Smooth scroll for navigation
function smoothScrollTo(element) {
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// Add stagger animation to dynamically created elements
function addStaggerAnimation(elements, baseDelay = 0) {
  elements.forEach((element, index) => {
    element.style.animationDelay = `${baseDelay + (index * 0.1)}s`;
  });
}

// Make functions globally accessible
window.deletePhoto = deletePhoto;

/* ============================================================
   STUDENT FACE ATTENDANCE PANEL
   ============================================================ */
function initializeStudentPanel() {
  if (!currentUser) return;

  // Show/hide role-based elements
  if (currentUser.role === 'student') {
    // Show student-only elements — must use explicit display:block to override CSS class
    document.querySelectorAll('.student-only').forEach(el => {
      el.style.display = el.tagName === 'LI' ? 'list-item' : 'block';
    });
    // Students don't need the regular manual check-in nav link in the same way
    // Keep it accessible but the face recognition page is their primary one

    // Populate profile
    document.getElementById('sa-profile-name').textContent = currentUser.name || currentUser.username || '—';
    document.getElementById('sa-profile-roll').textContent = `Roll: ${currentUser.rollNumber || '—'}`;
    document.getElementById('sa-profile-dept').textContent = `Dept: ${currentUser.department || '—'}`;
    
    // Check if face is registered
    const regNotice = document.getElementById('sa-reg-notice');
    const startRegBtn = document.getElementById('sa-start-reg-btn');
    
    if (!currentUser.photos || currentUser.photos.length === 0) {
      if (regNotice) regNotice.style.display = 'flex';
    } else {
      if (regNotice) regNotice.style.display = 'none';
    }

    if (startRegBtn) {
      startRegBtn.addEventListener('click', handleFaceRegistration);
    }

    loadStudentHistory();
    checkTodayStatus();
  }


  // Camera state
  let saStream = null;

  const saVideo     = document.getElementById('sa-video');
  const saCanvas    = document.getElementById('sa-canvas');
  const saStartBtn  = document.getElementById('sa-start-btn');
  const saCaptureBtn = document.getElementById('sa-capture-btn');
  const saStopBtn   = document.getElementById('sa-stop-btn');
  const saResultPanel = document.getElementById('sa-result-panel');
  const saStatusBanner = document.getElementById('sa-status-banner');
  const saStatusText = document.getElementById('sa-status-text');
  const saStatusIcon = document.getElementById('sa-status-icon');
  const saScanLine  = document.getElementById('sa-scanning-line');

  if (!saStartBtn) return; // not on the right page yet

  function setSAStatus(type, icon, text) {
    saStatusBanner.className = `sa-status-banner sa-status-${type}`;
    saStatusIcon.textContent = icon;
    saStatusText.textContent = text;
  }

  // Start camera
  saStartBtn.addEventListener('click', async () => {
    try {
      saStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      saVideo.srcObject = saStream;
      saCaptureBtn.disabled = false;
      saStopBtn.disabled = false;
      saStartBtn.disabled = true;
      setSAStatus('active', '🟢', 'Camera active — face the camera');
      saResultPanel.style.display = 'none';
    } catch (err) {
      setSAStatus('error', '❌', 'Camera access denied. Please allow camera.');
      console.error(err);
    }
  });

  // Stop camera
  saStopBtn.addEventListener('click', () => {
    if (saStream) {
      saStream.getTracks().forEach(t => t.stop());
      saStream = null;
      saVideo.srcObject = null;
    }
    saCaptureBtn.disabled = true;
    saStopBtn.disabled = true;
    saStartBtn.disabled = false;
    saScanLine.style.display = 'none';
    setSAStatus('idle', '📷', 'Camera stopped');
  });

  // Capture & Recognize
  saCaptureBtn.addEventListener('click', async () => {
    if (!saStream) return;

    // Capture frame
    saCanvas.width  = saVideo.videoWidth  || 640;
    saCanvas.height = saVideo.videoHeight || 480;
    const ctx = saCanvas.getContext('2d');
    ctx.drawImage(saVideo, 0, 0, saCanvas.width, saCanvas.height);
    const base64Image = saCanvas.toDataURL('image/jpeg', 0.9);

    // Show scanning animation
    saScanLine.style.display = 'block';
    setSAStatus('processing', '⏳', 'Recognizing face… please wait');
    saCaptureBtn.disabled = true;
    saResultPanel.style.display = 'none';

    try {
      // Step 1: Call recognition API (proxied through Node.js to Flask)
      const recRes = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      saScanLine.style.display = 'none';

      if (!recRes.ok) {
        const err = await recRes.json().catch(() => ({}));
        throw new Error(err.error || 'Recognition service error');
      }

      const recData = await recRes.json();

      if (!recData.recognized) {
        setSAStatus('error', '❌', 'Face not recognized. Please try again.');
        showSAResult('❌', 'Face Not Recognized', recData.message || 'Position your face clearly and try again.');
        saCaptureBtn.disabled = false;
        return;
      }

      // Step 2: Mark attendance
      const markRes = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: recData.student_id,
          confidence: recData.confidence
        })
      });

      const markData = await markRes.json();

      if (markRes.status === 409) {
        // Already marked
        setSAStatus('success', '✅', 'Attendance already marked for today');
        showSAResult('✅', 'Already Marked', 'Your attendance was already recorded today.');
        updateTodayStatus(true);
      } else if (markRes.ok) {
        setSAStatus('success', '🎉', 'Attendance Marked Successfully!');
        showSAResult('🎉', 'Attendance Marked Successfully!',
          `Confidence: ${(100 - recData.confidence).toFixed(1)}% | Time: ${new Date().toLocaleTimeString()}`
        );
        updateTodayStatus(true);
        loadStudentHistory(); // refresh history
        showToast('Attendance marked successfully!', 'success');
      } else {
        throw new Error(markData.error || 'Failed to mark attendance');
      }

    } catch (err) {
      saScanLine.style.display = 'none';
      console.error('Recognition error:', err);
      if (err.message.includes('not running') || err.message.includes('503')) {
        setSAStatus('error', '⚠️', 'Recognition service offline. Run recognize_api.py');
        showSAResult('⚠️', 'Service Offline', 'The Python recognition service is not running. Please contact admin.');
      } else {
        setSAStatus('error', '❌', err.message || 'Recognition failed');
        showSAResult('❌', 'Recognition Failed', err.message || 'Please try again.');
      }
    } finally {
      saCaptureBtn.disabled = false;
    }
  });

  // Export button
  const exportBtn = document.getElementById('sa-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const roll = currentUser.rollNumber || '';
      window.open(`/api/attendance/export?rollNumber=${encodeURIComponent(roll)}`, '_blank');
    });
  }

  async function handleFaceRegistration() {
    const regNotice = document.getElementById('sa-reg-notice');
    const startRegBtn = document.getElementById('sa-start-reg-btn');

    if (!saStream) {
      setSAStatus('processing', '⏳', 'Initializing camera for registration...');
      try {
        saStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        saVideo.srcObject = saStream;
        saCaptureBtn.disabled = false;
        saStopBtn.disabled = false;
        saStartBtn.disabled = true;
        setSAStatus('active', '🟢', 'Camera active — face the camera');
        // wait for video to play
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        setSAStatus('error', '❌', 'Registration failed: Camera access denied');
        return;
      }
    }

    if (!saStream) {
        setSAStatus('error', '❌', 'Failed to start camera for registration');
        return;
    }

    if (startRegBtn) {

        startRegBtn.disabled = true;
        startRegBtn.textContent = 'Processing...';
    }
    
    setSAStatus('processing', '📸', 'Capturing Face Data (0/30)');
    
    const photos = [];
    const total = 30;
    
    saScanLine.style.display = 'block';

    for (let i = 1; i <= total; i++) {
        setSAStatus('processing', '📸', `Capturing Face Data (${i}/${total})`);
        
        // Capture frame
        saCanvas.width  = saVideo.videoWidth  || 640;
        saCanvas.height = saVideo.videoHeight || 480;
        const ctx = saCanvas.getContext('2d');
        ctx.drawImage(saVideo, 0, 0, saCanvas.width, saCanvas.height);
        const base64Image = saCanvas.toDataURL('image/jpeg', 0.8);
        
        photos.push(base64Image);
        
        // Brief delay between captures for variety in pose
        await new Promise(r => setTimeout(r, 150));
    }

    saScanLine.style.display = 'none';
    setSAStatus('processing', '⏳', 'Uploading face data...');

    try {
        const res = await fetch('/api/students/register-face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id || currentUser._id, photos })
        });

        if (res.ok) {
            const data = await res.json();
            currentUser.photos = photos;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            if (regNotice) regNotice.style.display = 'none';
            
            setSAStatus('success', '✅', 'Registration Complete!');
            showSAResult('✅', 'Face Registered Successfully', 'The system is now training. Please wait 10 seconds before marking attendance.');
            
            // Trigger training automatically
            fetch('/api/train', { method: 'POST' }).catch(() => {});
            
            showToast('Face registered and training started!', 'success');
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Registration failed');
        }
    } catch (err) {
        setSAStatus('error', '❌', err.message);
        if (startRegBtn) {
            startRegBtn.disabled = false;
            startRegBtn.textContent = 'Retry Face Registration';
        }
    }
  }

  function showSAResult(icon, text, sub) {

    saResultPanel.style.display = 'block';
    document.getElementById('sa-result-icon').textContent = icon;
    document.getElementById('sa-result-text').textContent = text;
    document.getElementById('sa-result-sub').textContent = sub;
  }
}

async function loadStudentHistory() {
  if (!currentUser) return;
  const roll = currentUser.rollNumber || '';
  const container = document.getElementById('sa-history-list');
  if (!container) return;

  try {
    const res = await fetch(`/api/attendance?rollNumber=${encodeURIComponent(roll)}`);
    if (!res.ok) throw new Error('Failed to load history');
    const records = await res.json();

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:1.5rem;">
          <div class="empty-state-icon">📋</div>
          <p>No attendance records yet</p>
        </div>`;
      return;
    }

    container.innerHTML = records.slice(0, 30).map(r => `
      <div class="sa-history-item">
        <div>
          <div class="sa-history-date">${r.date || '—'}</div>
          <div class="sa-history-time">${r.checkInTime || ''}</div>
        </div>
        <span class="status-badge status-${r.status === 'Present' ? 'present' : 'late'}">${r.status}</span>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p style="padding:1rem;color:#ef4444;">Failed to load history</p>`;
  }
}

async function checkTodayStatus() {
  if (!currentUser) return;
  const roll = currentUser.rollNumber || '';
  const today = new Date().toLocaleDateString();
  const container = document.getElementById('sa-today-status');
  if (!container) return;

  try {
    const res = await fetch(`/api/attendance?rollNumber=${encodeURIComponent(roll)}&date=${encodeURIComponent(today)}`);
    const records = await res.json();
    updateTodayStatus(records && records.length > 0);
  } catch {
    // ignore
  }
}

function updateTodayStatus(marked) {
  const container = document.getElementById('sa-today-status');
  if (!container) return;
  if (marked) {
    container.innerHTML = `<span class="status-badge status-marked">✅ Today: Marked</span>`;
  } else {
    container.innerHTML = `<span class="status-badge status-pending">⏳ Today: Not Marked</span>`;
  }
}

// (initializeStudentPanel is called from the main DOMContentLoaded above)

window.viewStudent = viewStudent;
window.deleteStudent = deleteStudent;
window.removeDepartment = removeDepartment;
window.closeModal = closeModal;
window.smoothScrollTo = smoothScrollTo;
