// DysLearn - Student Login JavaScript
const API_BASE = ''; // Adjust if needed, sharing same base as login.js

// API Helper
async function apiRequest(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('studentToken') ? { Authorization: `Bearer ${localStorage.getItem('studentToken')}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Request failed');
  }
  return data;
}

// Persist student session
function persistStudentSession(payload) {
  localStorage.setItem('studentToken', payload.token);
  localStorage.setItem('studentId', payload.student.studentId);
  localStorage.setItem('studentDbId', payload.student.id);
  localStorage.setItem('studentName', payload.student.name || 'Student');
  localStorage.setItem('studentGrade', payload.student.grade || '');
}

// Show success message
function showSuccessMessage(message) {
  const successDiv = document.getElementById('successMessage');
  if (successDiv) {
    successDiv.querySelector('span').textContent = message;
    successDiv.classList.add('show');
    setTimeout(() => successDiv.classList.remove('show'), 3000);
  }
}

// Toggle password visibility
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const icon = event.target.closest('.toggle-password').querySelector('i');
  if (field.type === 'password') {
    field.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    field.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// Handle Student Login
async function handleStudentLogin(e) {
  e.preventDefault();

  const studentId = document.getElementById('studentId').value;
  const consultantId = document.getElementById('guardianId').value;
  const submitBtn = e.target.querySelector('.btn-submit');
  const span = submitBtn.querySelector('span');
  const originalText = span.textContent;

  submitBtn.classList.add('loading');

  const connectingTimeout = setTimeout(() => {
    span.textContent = 'Connecting...';
  }, 1500);

  try {
    // Call student login endpoint
    const data = await apiRequest('/auth/student-login', 'POST', { studentId, consultantId });
    clearTimeout(connectingTimeout);

    persistStudentSession(data);
    showSuccessMessage('Login successful!');
    span.textContent = 'Redirecting...';
    // Keep loading spinner active during redirect

    // Redirect to game/assessment with student info
    setTimeout(() => {
      const studentName = encodeURIComponent(data.student.name);
      const grade = data.student.grade || '1-2';
      // Map grade to game grade group
      let gradeGroup = 'grade12';
      if (grade === '3-4' || grade.includes('3') || grade.includes('4')) {
        gradeGroup = 'grade34';
      } else if (grade === '5-6' || grade.includes('5') || grade.includes('6')) {
        gradeGroup = 'grade56';
      }
      window.location.href = `game/index.html?name=${studentName}&grade=${gradeGroup}`;
    }, 1000);
  } catch (err) {
    clearTimeout(connectingTimeout);
    span.textContent = originalText;
    console.warn("API Error:", err);
    alert(err.message || 'Login failed. Please check your Student ID and Consultant ID.');
    submitBtn.classList.remove('loading');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Student Login form handler
  const loginForm = document.getElementById('studentLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleStudentLogin);
  }

  // Password toggle handlers
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      togglePassword(targetId);
    });
  });
});
