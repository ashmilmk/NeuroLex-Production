// DysLearn - Consultant Login JavaScript
const API_BASE = '';

// API Helper
async function apiRequest(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Request failed');
  }
  return data;
}

// Persist user session
function persistUserSession(payload) {
  localStorage.setItem('token', payload.token);
  localStorage.setItem('userRole', payload.user.role);
  localStorage.setItem('userEmail', payload.user.email);
  localStorage.setItem('userName', payload.user.firstName || 'User');
  if (payload.user.consultantId) {
    localStorage.setItem('consultantId', payload.user.consultantId);
  } else if (payload.user.employeeId) {
    // Fallback for old users
    localStorage.setItem('consultantId', payload.user.employeeId);
  }
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

// Validate password
function validatePassword(password) {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Validate email
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Switch between login and register forms
let isLoginMode = true;

function switchForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const formTitle = document.getElementById('formTitle');
  const formSubtitle = document.getElementById('formSubtitle');
  const switchText = document.getElementById('switchText');
  const switchBtn = document.getElementById('switchBtn');

  isLoginMode = !isLoginMode;

  if (isLoginMode) {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
    formTitle.textContent = 'Welcome Back';
    formSubtitle.textContent = 'Sign in to your consultant account';
    switchText.textContent = "Don't have an account?";
    switchBtn.textContent = 'Create Account';
  } else {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    formTitle.textContent = 'Create Account';
    formSubtitle.textContent = 'Register as a new consultant';
    switchText.textContent = 'Already have an account?';
    switchBtn.textContent = 'Sign In';
  }
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const submitBtn = e.target.querySelector('.btn-submit');
  const span = submitBtn.querySelector('span');
  const originalText = span.textContent;

  submitBtn.classList.add('loading');
  span.textContent = 'Signing In...';

  try {
    const data = await apiRequest('/auth/login', 'POST', { email, password });
    persistUserSession(data);
    // Redirect immediately — no artificial delay
    window.location.href = './consultant-dashboard.html';
  } catch (err) {
    span.textContent = originalText;
    alert(err.message || 'Login failed');
    submitBtn.classList.remove('loading');
  }
}

// Handle Registration
async function handleRegister(e) {
  e.preventDefault();

  const firstName = document.getElementById('firstName').value;
  const lastName = document.getElementById('lastName').value;
  const email = document.getElementById('regEmail').value;
  const consultantPhone = document.getElementById('consultantPhone').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const submitBtn = e.target.querySelector('.btn-submit');
  const span = submitBtn.querySelector('span');
  const originalText = span.textContent;

  // Validation
  if (!validateEmail(email)) {
    alert('Please enter a valid email address');
    return;
  }

  if (!validatePassword(password)) {
    alert('Password must be at least 8 characters with uppercase, lowercase, and number');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  // Terms & Conditions check
  const agreeTerms = document.getElementById('agreeTerms');
  if (agreeTerms && !agreeTerms.checked) {
    alert('You must agree to the Terms & Conditions and Privacy Policy to create an account.');
    return;
  }

  submitBtn.classList.add('loading');
  span.textContent = 'Creating Account...';

  try {
    const data = await apiRequest('/auth/register', 'POST', {
      firstName,
      lastName,
      email,
      consultantPhone,
      password,
      role: 'teacher' // Backend uses 'teacher' role for consultants
    });

    persistUserSession(data);
    // Redirect immediately — no artificial delay
    window.location.href = './consultant-dashboard.html';
  } catch (err) {
    span.textContent = originalText;
    alert(err.message || 'Registration failed');
    submitBtn.classList.remove('loading');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Login form handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Register form handler
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Switch button handler
  const switchBtn = document.getElementById('switchBtn');
  if (switchBtn) {
    switchBtn.addEventListener('click', switchForm);
  }

  // Password toggle handlers
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      togglePassword(targetId);
    });
  });

  // NOTE: We intentionally do NOT auto-redirect when a token already exists in
  // localStorage. Doing so prevents a consultant from logging in from a second
  // tab or window (all tabs share the same localStorage). The consultant is
  // redirected to the dashboard only after a successful login action below.
});
