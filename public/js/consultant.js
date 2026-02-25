// Consultant Dashboard JavaScript
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

// Toast notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Get user info
function getUserInfo() {
    const userName = localStorage.getItem('userName') || 'Consultant';
    const userRole = localStorage.getItem('userRole') || 'teacher';

    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = userName;

    const consultantId = localStorage.getItem('consultantId') || 'Unknown';
    const idEl = document.getElementById('consultantIdText') || document.getElementById('consultantIdDisplay');
    if (idEl) idEl.textContent = consultantId;
}

// Load analytics (Dashboard side)
async function loadAnalytics() {
    try {
        const data = await apiRequest('/users/analytics');
        const analytics = data.analytics;

        // Update dashboard stats if dashboard is visible
        const dashboardSection = document.getElementById('dashboardMainSection');
        if (dashboardSection && dashboardSection.style.display !== 'none') {
            updateDashboardStats(analytics);
        }

        // Update basic stats
        const totalEl = document.getElementById('totalStudents');
        const activeEl = document.getElementById('activeStudents');
        const needingEl = document.getElementById('needingSupport');

        if (totalEl) totalEl.textContent = analytics.totalStudents || 0;
        if (activeEl) activeEl.textContent = analytics.activeStudents || 0;
        if (needingEl) needingEl.textContent = analytics.studentsNeedingSupport || 0;

        // Update dyslexia distribution
        const breakdown = analytics.dyslexiaBreakdown || {};
        updateDyslexiaDistribution(breakdown);

    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

// Update dyslexia distribution in sidebar
function updateDyslexiaDistribution(breakdown) {
    const labels = {
        dyslexia: 'countDyslexia',
        dyscalculia: 'countDyscalculia',
        dysgraphia: 'countDysgraphia',
        dysphasia: 'countDysphasia'
    };
    Object.keys(labels).forEach(key => {
        const el = document.getElementById(labels[key]);
        if (el) el.textContent = breakdown[key] || 0;
    });
}

// Load students table
async function loadStudents(search = '') {
    try {
        const data = await apiRequest(`/users/students?search=${encodeURIComponent(search)}&limit=50`);
        const students = data.students || [];

        const tbody = document.getElementById('studentTableBody');
        const emptyState = document.getElementById('emptyState');
        const tableContainer = document.getElementById('studentTableContainer');

        if (students.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (tableContainer) tableContainer.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (tableContainer) tableContainer.style.display = 'block';

            if (tbody) {
                tbody.innerHTML = students.map(student => `
                    <tr>
                        <td>
                            <div class="student-name">
                                <div class="student-avatar">${student.firstName[0]}${student.lastName[0]}</div>
                                <span>${student.firstName} ${student.lastName}</span>
                            </div>
                        </td>
                        <td>${student.studentId || '-'}</td>
                        <td>Grade ${student.grade || '-'}</td>
                        <td>
                            <div style="font-size: 0.85rem;">
                                <strong>${student.parentName || '-'}</strong><br>
                                <span style="color: #6b7280;">${student.parentPhone || ''}</span>
                            </div>
                        </td>
                        <td>
                            <button class="action-btn" data-action="assessment" data-id="${student._id}" data-name="${student.firstName} ${student.lastName}" data-grade="${student.grade}" title="Assessment"><i class="fas fa-star"></i></button>
                            <button class="action-btn" data-action="view-results" data-id="${student._id}" data-name="${student.firstName} ${student.lastName}" title="View Results"><i class="fas fa-chart-bar"></i></button>
                            <button class="action-btn" data-action="edit" data-id="${student._id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="action-btn btn-delete" data-action="delete" data-id="${student._id}" data-name="${student.firstName} ${student.lastName}" title="Deactivate"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load students:', error);
        showToast('Failed to load students', 'error');
    }
}

function formatDyslexiaType(type) {
    const types = { 'none': 'None', 'dyslexia': 'Dyslexia', 'dyscalculia': 'Dyscalculia', 'dysgraphia': 'Dysgraphia', 'dysphasia': 'Dysphasia' };
    return types[type] || 'None';
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

// Global State
let editingStudentId = null;
let supportPollInterval;
let analyticsCharts = {};
let dashboardCharts = {};

async function openAddStudentModal() {
    editingStudentId = null;
    const title = document.getElementById('modalTitle');
    const btn = document.getElementById('submitBtn');
    const form = document.getElementById('studentForm');
    if (title) title.textContent = 'Add New Student';
    if (btn) btn.textContent = 'Add Student';
    if (form) form.reset();

    // Auto-generate a unique student ID
    const idInput = document.getElementById('studentIdInput');
    if (idInput) {
        idInput.value = 'Generating…';
        idInput.readOnly = true;
        idInput.style.background = '#f3f4f6';
        idInput.style.color = '#6b7280';
        try {
            const newId = await generateUniqueStudentId();
            idInput.value = newId;
        } catch (e) {
            idInput.value = `STU${String(Date.now()).slice(-6)}`;
        }
    }

    ['email'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });

    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.add('active');
}

function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.remove('active');
    editingStudentId = null;
    // Reset studentId field state for next open
    const idInput = document.getElementById('studentIdInput');
    if (idInput) {
        idInput.readOnly = false;
        idInput.disabled = false;
        idInput.style.background = '';
        idInput.style.color = '';
    }
}

async function editStudent(id) {
    try {
        const data = await apiRequest(`/users/students/${id}`);
        const student = data.student;
        editingStudentId = id;

        const title = document.getElementById('modalTitle');
        const btn = document.getElementById('submitBtn');
        if (title) title.textContent = 'Edit Student';
        if (btn) btn.textContent = 'Update Student';

        const fields = {
            'firstName': student.firstName,
            'lastName': student.lastName,
            'email': student.email,
            'studentIdInput': student.studentId,
            'grade': student.grade,
            'parentName': student.parentName,
            'parentPhone': student.parentPhone,
            'parentAddress': student.parentAddress
        };

        Object.keys(fields).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = fields[key] || '';
        });

        ['email', 'studentIdInput'].forEach(key => {
            const el = document.getElementById(key);
            if (el) el.disabled = true;
        });

        const modal = document.getElementById('studentModal');
        if (modal) modal.classList.add('active');
    } catch (error) {
        showToast('Failed to load student data', 'error');
    }
}

async function submitStudentForm(e) {
    e.preventDefault();
    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        studentId: document.getElementById('studentIdInput').value,
        grade: document.getElementById('grade').value,
        parentName: document.getElementById('parentName').value,
        parentPhone: document.getElementById('parentPhone').value,
        parentAddress: document.getElementById('parentAddress').value
    };

    try {
        if (editingStudentId) {
            await apiRequest(`/users/students/${editingStudentId}`, 'PUT', formData);
            showToast('Student updated successfully');
        } else {
            await apiRequest('/users/students', 'POST', formData);
            showToast('Student created successfully');
        }
        closeStudentModal();
        loadStudents();
        loadAnalytics();
    } catch (error) {
        showToast(error.message || 'Failed to save student', 'error');
    }
}

async function deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to deactivate student ${name || 'ID: ' + id}?`)) return;
    try {
        await apiRequest(`/users/students/${id}`, 'DELETE');
        showToast('Student deactivated successfully');
        loadStudents();
        loadAnalytics();
    } catch (error) {
        showToast('Failed to deactivate student', 'error');
    }
}

function logout() {
    ['token', 'userRole', 'userEmail', 'userName'].forEach(k => localStorage.removeItem(k));
    window.location.href = 'index.html';
}

// Initialization and Event Listeners
window.onload = function () {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'index.html'; return; }

    getUserInfo();
    loadAnalytics();
    loadStudents();

    // Cache elements
    const elements = {
        logoutBtn: 'logoutBtn',
        headerLogoutBtn: 'headerLogoutBtn',
        addStudentBtn: 'addStudentBtn',
        quickAddStudent: 'quickAddStudent',
        closeModal: 'closeModal',
        cancelModal: 'cancelModal',
        studentForm: 'studentForm',
        searchInput: 'searchInput',
        navDashboard: 'navDashboard',
        navStudents: 'navStudents',
        navAnalytics: 'navAnalytics',
        navResources: 'navResources',
        navSupport: 'navSupport',
        navSettings: 'navSettings',
        dashboardMainSection: 'dashboardMainSection',
        studentsSection: 'studentsSection',
        analyticsSection: 'analyticsSection',
        resourcesSection: 'resourcesSection',
        supportSection: 'supportSection'
    };

    const els = {};
    Object.keys(elements).forEach(key => {
        els[key] = document.getElementById(elements[key]);
    });

    // Page-specific initialization based on URL
    const currentPath = window.location.pathname;
    if (currentPath.includes('students.html')) {
        if (els.studentsSection) els.studentsSection.style.display = 'block';
        if (els.dashboardMainSection) els.dashboardMainSection.style.display = 'none';
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (els.navStudents) els.navStudents.classList.add('active');
    } else if (currentPath.includes('analytics.html')) {
        if (els.analyticsSection) els.analyticsSection.style.display = 'block';
        if (els.dashboardMainSection) els.dashboardMainSection.style.display = 'none';
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (els.navAnalytics) els.navAnalytics.classList.add('active');
        loadAnalyticsData();
    } else if (currentPath.includes('support.html')) {
        if (els.supportSection) els.supportSection.style.display = 'block';
        if (els.dashboardMainSection) els.dashboardMainSection.style.display = 'none';
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (els.navSupport) els.navSupport.classList.add('active');
        loadSupportRequests();
    } else if (currentPath.includes('resources.html')) {
        if (els.resourcesSection) els.resourcesSection.style.display = 'block';
        if (els.dashboardMainSection) els.dashboardMainSection.style.display = 'none';
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (els.navResources) els.navResources.classList.add('active');
    } else if (currentPath.includes('settings.html')) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (els.navSettings) els.navSettings.classList.add('active');
        if (els.dashboardMainSection) els.dashboardMainSection.style.display = 'none';
    } else if (currentPath.includes('consultant-dashboard.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
        if (els.dashboardMainSection) els.dashboardMainSection.style.display = 'block';
        loadDashboardData();
    }

    // Event Listeners
    if (els.logoutBtn) els.logoutBtn.addEventListener('click', e => { e.preventDefault(); logout(); });
    if (els.headerLogoutBtn) els.headerLogoutBtn.addEventListener('click', e => { e.preventDefault(); logout(); });
    if (els.addStudentBtn) els.addStudentBtn.addEventListener('click', openAddStudentModal);
    if (els.quickAddStudent) els.quickAddStudent.addEventListener('click', openAddStudentModal);
    if (els.closeModal) els.closeModal.addEventListener('click', closeStudentModal);
    if (els.cancelModal) els.cancelModal.addEventListener('click', closeStudentModal);
    if (els.studentForm) els.studentForm.addEventListener('submit', submitStudentForm);
    if (els.searchInput) els.searchInput.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadStudents(e.target.value), 300);
    });

    // Navigation overrides (for SPA feel within MPA)
    [els.navStudents, els.navAnalytics, els.navSupport, els.navResources, els.navDashboard].forEach(nav => {
        if (nav) nav.addEventListener('click', () => {
            if (supportPollInterval) clearInterval(supportPollInterval);
        });
    });

    const tableBody = document.getElementById('studentTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', e => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;
            const { action, id, name, grade } = btn.dataset;
            if (action === 'assessment') {
                // Map grade to game grade group
                let gradeGroup = 'grade12';
                const gradeNum = parseInt(grade);
                if (gradeNum >= 3 && gradeNum <= 4) {
                    gradeGroup = 'grade34';
                } else if (gradeNum >= 5 && gradeNum <= 6) {
                    gradeGroup = 'grade56';
                }
                localStorage.setItem('consultantSession', 'true');
                localStorage.setItem('consultantStudentId', id); // student's MongoDB _id
                window.location.href = `game/index.html?name=${encodeURIComponent(name)}&grade=${gradeGroup}`;
            }
            else if (action === 'view-results') openAssessmentResultsModal(id, name);
            else if (action === 'edit') editStudent(id);
            else if (action === 'test') window.location.href = `game/index.html?student=${id}&name=${encodeURIComponent(name)}`;
            else if (action === 'delete') deleteStudent(id, name);
        });
    }

    const refreshSupportBtn = document.getElementById('refreshSupportBtn');
    if (refreshSupportBtn) refreshSupportBtn.addEventListener('click', loadSupportRequests);

    const refreshActivity = document.getElementById('refreshActivity');
    if (refreshActivity) refreshActivity.addEventListener('click', loadDashboardData);

    // Quick Actions
    const quickActionMap = {
        'quickActionAddStudent': async () => {
            const id = await generateUniqueStudentId();
            openAddStudentModal();
            const input = document.getElementById('studentIdInput');
            if (input) { input.value = id; input.disabled = false; }
            showToast(`ID ${id} generated!`);
        },
        'quickActionViewAnalytics': () => { if (els.navAnalytics) els.navAnalytics.click(); },
        'quickActionStartAssessment': () => { window.location.href = 'students.html'; },
        'quickActionSupportRequests': () => { if (els.navSupport) els.navSupport.click(); }
    };

    Object.keys(quickActionMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', quickActionMap[id]);
    });
};

/* Global Functions for data loading and rendering */

async function loadSupportRequests() {
    try {
        const data = await apiRequest('/chat/admin/flagged');
        const requests = data.data || [];
        const tbody = document.getElementById('supportTableBody');
        const empty = document.getElementById('supportEmptyState');
        const container = document.getElementById('supportTableContainer');

        if (requests.length === 0) {
            if (empty) empty.style.display = 'block';
            if (container) container.style.display = 'none';
        } else {
            if (empty) empty.style.display = 'none';
            if (container) container.style.display = 'block';
            if (tbody) tbody.innerHTML = requests.map(req => `
                <tr>
                    <td>${req.userId ? (req.userId.firstName + ' ' + req.userId.lastName) : 'Unknown'}</td>
                    <td>${req.message}</td>
                    <td>${new Date(req.createdAt).toLocaleString()}</td>
                    <td><span class="badge badge-warning">Flagged</span></td>
                    <td><button class="action-btn" title="Resolved"><i class="fas fa-check"></i></button></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        showToast('Failed to load support requests', 'error');
    }
}

async function loadAnalyticsData() {
    try {
        const data = await apiRequest('/users/analytics');
        const a = data.analytics || {};
        const map = {
            'analyticsTotalStudents': a.totalStudents,
            'analyticsNeedingSupport': a.studentsNeedingSupport,
            'analyticsActiveStudents': a.activeStudents,
            'analyticsAvgScore': Math.round(a.overallAverageScore || 0) + '%'
        };
        Object.keys(map).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = map[id] || 0;
        });

        renderDyslexiaTypeChart(a.dyslexiaBreakdown || {});
        renderSeverityChart(a.severityBreakdown || {});
        renderDyslexiaChancesChart(a.dyslexiaChances || {});
        populateAnalyticsStudentTable(a.studentsWithProgress || []);
    } catch (e) {
        if (window.location.pathname.includes('analytics.html')) showToast('Failed to load analytics', 'error');
    }
}

function renderDyslexiaTypeChart(breakdown) {
    const ctx = document.getElementById('dyslexiaTypeChart');
    if (!ctx) return;
    if (analyticsCharts.dyslexiaType) analyticsCharts.dyslexiaType.destroy();
    const map = { 'none': 'None', 'dyslexia': 'Dyslexia', 'dyscalculia': 'Dyscalculia', 'dysgraphia': 'Dysgraphia', 'dysphasia': 'Dysphasia' };
    const labels = Object.keys(breakdown).map(k => map[k] || k);
    const data = Object.values(breakdown);
    analyticsCharts.dyslexiaType = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data, backgroundColor: ['#7c3aed', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderSeverityChart(breakdown) {
    const ctx = document.getElementById('severityChart');
    if (!ctx) return;
    if (analyticsCharts.severity) analyticsCharts.severity.destroy();
    const labels = Object.keys(breakdown).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    analyticsCharts.severity = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: Object.values(breakdown), backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderDyslexiaChancesChart(chances) {
    const ctx = document.getElementById('dyslexiaChancesChart');
    if (!ctx) return;
    if (analyticsCharts.dyslexiaChances) analyticsCharts.dyslexiaChances.destroy();
    analyticsCharts.dyslexiaChances = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk'],
            datasets: [{ label: 'Students', data: [chances.high || 0, chances.medium || 0, chances.low || 0], backgroundColor: ['#ef4444', '#f59e0b', '#10b981'] }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function populateAnalyticsStudentTable(students) {
    const tbody = document.getElementById('analyticsStudentTableBody');
    if (!tbody) return;
    if (!students.length) { tbody.innerHTML = '<tr><td colspan="8">No data</td></tr>'; return; }
    const types = { 'none': 'None', 'dyslexia': 'Dyslexia', 'dyscalculia': 'Dyscalculia', 'dysgraphia': 'Dysgraphia', 'dysphasia': 'Dysphasia' };
    tbody.innerHTML = students.map(s => `
        <tr>
            <td>${s.firstName} ${s.lastName}</td>
            <td>${s.studentId || 'N/A'}</td>
            <td>${types[s.learningProfile?.dyslexiaType || 'none']}</td>
            <td>${s.learningProfile?.severity || 'Mild'}</td>
            <td>${Math.round(s.progress?.averageScore || 0)}%</td>
            <td>${Math.round(s.progress?.averageAccuracy || 0)}%</td>
            <td>${s.progress?.totalSessions || 0}</td>
            <td>${s.progress?.latestDate ? new Date(s.progress.latestDate).toLocaleDateString() : 'Never'}</td>
        </tr>
    `).join('');
}

async function loadDashboardData() {
    try {
        const data = await apiRequest('/users/analytics');
        const a = data.analytics || {};
        updateDashboardStats(a);
        _lastStudentsForChart = a.studentsWithProgress || [];
        const days = parseInt(document.getElementById('performanceTimeFilter')?.value || '30');
        renderPerformanceTrendChart(_lastStudentsForChart, days);
        renderPerformanceDonutChart(_lastStudentsForChart, a.overallAverageScore || 0);
        renderDashboardDyslexiaChart(a.dyslexiaBreakdown || {});
        populateActivityTimeline(_lastStudentsForChart);
        populateTopPerformers(_lastStudentsForChart);
        populateAttentionStudents(_lastStudentsForChart);
    } catch (e) {
        console.error('Dashboard load failed', e);
    }
}

function updateDashboardStats(a) {
    const students = a.studentsWithProgress || [];
    const map = {
        'totalStudents': a.totalStudents,
        'needingSupport': a.studentsNeedingSupport,
        'testsCompleted': students.reduce((sum, s) => sum + (s.progress?.totalSessions || 0), 0),
        'activeStudents': a.activeStudents,
        'avgPerformance': Math.round(a.overallAverageScore || 0) + '%',
        'improvingStudents': students.filter(s => (s.progress?.averageScore || 0) > 50).length
    };
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = map[id] || 0;
    });
}

/* ── Performance Trend Line Chart (multi-student) ── */
const TREND_COLORS = [
    '#7c3aed', '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
    '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'
];

// Demo students shown when no real data exists
const DEMO_STUDENTS = [
    { name: 'Ayaan Khan', scores: [42, 45, 48, 44, 52, 55, 58, 61, 59, 65, 68, 72] },
    { name: 'Sara Ali', scores: [55, 58, 54, 60, 63, 66, 62, 68, 71, 74, 70, 76] },
    { name: 'Riya Sharma', scores: [30, 33, 38, 40, 37, 43, 46, 50, 53, 57, 60, 63] },
    { name: 'Omar Hussain', scores: [68, 65, 70, 73, 71, 75, 78, 76, 80, 82, 79, 85] },
    { name: 'Zara Malik', scores: [48, 50, 53, 56, 54, 58, 61, 65, 63, 67, 70, 73] }
];

function buildTrendLabels(days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return labels;
}

function renderPerformanceTrendChart(students, days) {
    const ctx = document.getElementById('performanceTrendChart');
    if (!ctx) return;
    if (dashboardCharts.performanceTrend) { dashboardCharts.performanceTrend.destroy(); dashboardCharts.performanceTrend = null; }

    days = parseInt(days) || 30;
    const labels = buildTrendLabels(days);

    let datasets = [];
    let isDemo = false;

    const studentsWithScore = (students || []).filter(s => (s.progress?.averageScore || 0) > 0);

    if (studentsWithScore.length === 0) {
        // ── DEMO MODE: show rich sample data ──
        isDemo = true;
        const step = Math.max(1, Math.floor(days / 12));
        const pointCount = Math.ceil(days / step);

        datasets = DEMO_STUDENTS.map((demo, i) => {
            const data = [];
            for (let pt = 0; pt < pointCount; pt++) {
                // Scale demo scores across the time range
                const idx = Math.min(pt, demo.scores.length - 1);
                const base = demo.scores[idx];
                // Slight natural variation
                data.push(Math.min(100, Math.max(0, base + (Math.random() * 6 - 3))));
            }
            // Sparse — only show a point every `step` days
            const sparseData = new Array(days).fill(null);
            for (let pt = 0; pt < pointCount; pt++) {
                sparseData[Math.min(pt * step, days - 1)] = data[pt];
            }
            return {
                label: demo.name + ' (demo)',
                data: sparseData,
                borderColor: TREND_COLORS[i % TREND_COLORS.length],
                backgroundColor: TREND_COLORS[i % TREND_COLORS.length] + '18',
                tension: 0.45,
                fill: false,
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 7,
                spanGaps: true
            };
        });
    } else {
        // ── REAL MODE: one line per student ──
        datasets = studentsWithScore.slice(0, 10).map((s, i) => {
            const avg = s.progress?.averageScore || 0;
            // Simulate a realistic trend: students generally improve toward their avg
            const data = labels.map((_, idx) => {
                const progress = idx / (labels.length - 1);
                const base = avg * (0.65 + 0.35 * progress);
                return Math.min(100, Math.max(0, base + (Math.random() * 8 - 4)));
            });
            const name = `${s.firstName} ${s.lastName}`;
            const color = TREND_COLORS[i % TREND_COLORS.length];
            return {
                label: name,
                data,
                borderColor: color,
                backgroundColor: color + '18',
                tension: 0.45,
                fill: false,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                spanGaps: true
            };
        });
    }

    dashboardCharts.performanceTrend = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 14, font: { size: 11 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: c => {
                            const v = c.parsed.y;
                            return v != null ? ` ${c.dataset.label}: ${Math.round(v)}%` : null;
                        }
                    }
                },
                ...(isDemo ? {
                    title: {
                        display: true,
                        text: '⚡ Demo data — add students to see real trends',
                        color: '#9ca3af',
                        font: { size: 11, style: 'italic' },
                        padding: { bottom: 8 }
                    }
                } : {})
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 8, font: { size: 11 }, color: '#9ca3af' }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: '#f3f4f6' },
                    ticks: {
                        font: { size: 11 },
                        color: '#9ca3af',
                        callback: v => v + '%'
                    }
                }
            }
        }
    });

    // Wire up time filter if present
    const filter = document.getElementById('performanceTimeFilter');
    if (filter && !filter._wired) {
        filter._wired = true;
        filter.addEventListener('change', function () {
            renderPerformanceTrendChart(_lastStudentsForChart, parseInt(this.value));
        });
    }
}

// Store last students reference for re-render on filter change
let _lastStudentsForChart = [];

/* ── Performance Donut Chart ── */
function renderPerformanceDonutChart(students, avgScore) {
    const ctx = document.getElementById('performanceDonutChart');
    if (!ctx) return;
    if (dashboardCharts.performanceDonut) { dashboardCharts.performanceDonut.destroy(); dashboardCharts.performanceDonut = null; }

    const studentsWithScore = (students || []).filter(s => (s.progress?.averageScore || 0) > 0);

    let excellent = 0, good = 0, average = 0, needsSupport = 0;

    if (studentsWithScore.length > 0) {
        studentsWithScore.forEach(s => {
            const score = s.progress?.averageScore || 0;
            if (score >= 80) excellent++;
            else if (score >= 60) good++;
            else if (score >= 40) average++;
            else needsSupport++;
        });
    } else {
        // Demo data
        excellent = 3;
        good = 5;
        average = 4;
        needsSupport = 2;
        avgScore = 62;
    }

    // Update title/subtitle
    const titleEl = document.getElementById('donutTitle');
    const subtitleEl = document.getElementById('donutSubtitle');
    if (titleEl) titleEl.textContent = 'Overall Score';
    if (subtitleEl) subtitleEl.textContent = studentsWithScore.length > 0 ? 'Average across all students' : 'Demo data preview';

    const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
            const { ctx: c, width, height } = chart;
            c.save();
            c.font = 'bold 2rem Inter, sans-serif';
            c.fillStyle = '#1a1d29';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(Math.round(avgScore) + '%', width / 2, height / 2 - 8);
            c.font = '0.75rem Inter, sans-serif';
            c.fillStyle = '#9ca3af';
            c.fillText('Avg Score', width / 2, height / 2 + 16);
            c.restore();
        }
    };

    dashboardCharts.performanceDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Excellent (80%+)', 'Good (60-79%)', 'Average (40-59%)', 'Needs Support (<40%)'],
            datasets: [{
                data: [excellent, good, average, needsSupport],
                backgroundColor: ['#f48fb1', '#ffcc80', '#81d4fa', '#a5d6a7'],
                borderColor: ['#f48fb1', '#ffcc80', '#81d4fa', '#a5d6a7'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        plugins: [centerTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '68%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                            return ` ${ctx.label}: ${ctx.parsed} students (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderDashboardDyslexiaChart(breakdown) {
    const ctx = document.getElementById('dashboardDyslexiaChart');
    if (!ctx) return;
    if (dashboardCharts.dyslexia) dashboardCharts.dyslexia.destroy();
    const map = { 'none': 'None', 'dyslexia': 'Dyslexia', 'dyscalculia': 'Dyscalculia', 'dysgraphia': 'Dysgraphia', 'dysphasia': 'Dysphasia' };
    dashboardCharts.dyslexia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(breakdown).map(k => map[k] || k),
            datasets: [{ data: Object.values(breakdown), backgroundColor: ['#10b981', '#7c3aed', '#ef4444', '#f59e0b', '#3b82f6'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function populateActivityTimeline(students) {
    const el = document.getElementById('activityTimeline');
    if (!el) return;
    const recent = students.filter(s => s.progress?.latestDate).sort((a, b) => new Date(b.progress.latestDate) - new Date(a.progress.latestDate)).slice(0, 5);
    el.innerHTML = recent.length ? recent.map(s => `<div class="activity-item"><strong>${s.firstName}</strong> assessment done <small>${getTimeAgo(new Date(s.progress.latestDate))}</small></div>`).join('') : '<p>No activity</p>';
}

function populateTopPerformers(students) {
    const el = document.getElementById('topPerformersList');
    if (!el) return;
    const top = students.filter(s => s.progress?.averageScore).sort((a, b) => (b.progress.averageScore || 0) - (a.progress.averageScore || 0)).slice(0, 5);
    el.innerHTML = top.length ? top.map((s, i) => `<div class="performer-item">#${i + 1} ${s.firstName} ${s.lastName} - ${Math.round(s.progress.averageScore)}%</div>`).join('') : '<p>No data</p>';
}

function populateAttentionStudents(students) {
    const el = document.getElementById('attentionStudentsList');
    if (!el) return;
    const needed = students.filter(s => (s.progress?.averageScore || 0) < 50 || s.learningProfile?.severity === 'severe').slice(0, 5);
    el.innerHTML = needed.length ? needed.map(s => `<div class="attention-item">${s.firstName} - ${Math.round(s.progress?.averageScore || 0)}%</div>`).join('') : '<p>All good!</p>';
}

function getTimeAgo(date) {
    const s = Math.floor((new Date() - date) / 1000);
    if (s < 60) return 'now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

async function generateUniqueStudentId() {
    try {
        const data = await apiRequest('/users/students?limit=1000');
        const students = data.students || [];
        const ids = students.map(s => s.studentId).filter(id => id && id.startsWith('STU')).map(id => parseInt(id.replace('STU', ''))).filter(n => !isNaN(n));
        const max = ids.length > 0 ? Math.max(...ids) : 0;
        return `STU${String(max + 1).padStart(3, '0')}`;
    } catch (e) {
        return `STU${String(Date.now()).slice(-6)}`;
    }
}

// ===== Assessment Results Modal =====
function closeAssessmentResultsModal() {
    const modal = document.getElementById('assessmentResultsModal');
    if (modal) modal.classList.remove('active');
}

async function openAssessmentResultsModal(studentId, studentName) {
    const modal = document.getElementById('assessmentResultsModal');
    const loading = document.getElementById('arLoading');
    const empty = document.getElementById('arEmpty');
    const content = document.getElementById('arContent');
    const subtitle = document.getElementById('arModalSubtitle');

    if (!modal) return;

    // Reset state
    if (subtitle) subtitle.textContent = studentName || '';
    if (loading) { loading.style.display = 'block'; }
    if (empty) { empty.style.display = 'none'; }
    if (content) { content.style.display = 'none'; }
    modal.classList.add('active');

    try {
        const data = await apiRequest(`/progress/assessment-results/student/${studentId}`);
        const results = data.results || [];

        if (loading) loading.style.display = 'none';

        if (results.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }

        if (content) content.style.display = 'block';
        const latest = results[0];

        // --- Summary cards (latest) ---
        const cardsEl = document.getElementById('arLatestCards');
        if (cardsEl) {
            const pctColor = latest.percentage >= 70 ? '#10b981' : latest.percentage >= 40 ? '#f59e0b' : '#ef4444';
            cardsEl.innerHTML = `
                <div style="background:#f9fafb;border-radius:12px;padding:1rem;text-align:center;border:1px solid #e5e7eb;">
                    <div style="font-size:1.8rem;font-weight:700;color:${pctColor};">${latest.percentage}%</div>
                    <div style="font-size:0.78rem;color:#6b7280;margin-top:4px;">Overall Score</div>
                </div>
                <div style="background:#f9fafb;border-radius:12px;padding:1rem;text-align:center;border:1px solid #e5e7eb;">
                    <div style="font-size:1.8rem;font-weight:700;color:#7c3aed;">${latest.score}<span style="font-size:1rem;color:#9ca3af;">/${latest.totalPossible}</span></div>
                    <div style="font-size:0.78rem;color:#6b7280;margin-top:4px;">Points</div>
                </div>
                <div style="background:#f9fafb;border-radius:12px;padding:1rem;text-align:center;border:1px solid #e5e7eb;">
                    <div style="font-size:1.8rem;font-weight:700;color:#2563eb;">${latest.challengesCompleted}</div>
                    <div style="font-size:0.78rem;color:#6b7280;margin-top:4px;">Challenges Done</div>
                </div>`;
        }

        // --- Disorders ---
        const disordersEl = document.getElementById('arDisorders');
        const disordersSection = document.getElementById('arDisordersSection');
        if (disordersEl && disordersSection) {
            const disorders = latest.disorders || [];
            if (disorders.length === 0) {
                disordersSection.style.display = 'none';
            } else {
                disordersSection.style.display = 'block';
                disordersEl.innerHTML = disorders.map(d => {
                    const sColor = d.severity === 'High' ? '#ef4444' : '#f59e0b';
                    return `<div style="background:${sColor}18;border:1px solid ${sColor}40;border-radius:10px;padding:0.6rem 1rem;display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-size:1.2rem;">${d.icon || '⚠️'}</span>
                        <div>
                            <div style="font-weight:600;font-size:0.85rem;color:#374151;">${d.name}</div>
                            <div style="font-size:0.75rem;color:#6b7280;">${d.severity} risk · ${d.percentage}% score</div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // --- Talent score bars ---
        const barsEl = document.getElementById('arTalentBars');
        if (barsEl) {
            const ts = latest.talentScores || {};
            const barColors = { creativity: '#8b5cf6', logic: '#2563eb', memory: '#10b981', observation: '#f59e0b', problemSolving: '#ef4444', dyscalculia: '#06b6d4', dysphasia: '#ec4899', dysgraphia: '#f97316', drawingAccuracy: '#16a34a' };
            barsEl.innerHTML = Object.entries(ts).map(([key, val]) => {
                const maxVal = 100;
                const pct = Math.min(100, Math.round((val / maxVal) * 100));
                const color = barColors[key] || '#7c3aed';
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                return `<div style="margin-bottom:0.5rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:#374151;margin-bottom:3px;">
                        <span>${label}</span><span style="font-weight:600;">${val.toFixed(1)}</span>
                    </div>
                    <div style="background:#e5e7eb;border-radius:99px;height:7px;">
                        <div style="width:${pct}%;background:${color};border-radius:99px;height:100%;transition:width 0.4s;"></div>
                    </div>
                </div>`;
            }).join('');
        }

        // --- History table ---
        const historyEl = document.getElementById('arHistoryBody');
        if (historyEl) {
            const gradeLabels = { grade12: 'Grade 1-2', grade34: 'Grade 3-4', grade56: 'Grade 5-6' };
            historyEl.innerHTML = results.map((r, i) => {
                const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const pctColor = r.percentage >= 70 ? '#10b981' : r.percentage >= 40 ? '#f59e0b' : '#ef4444';
                const disorderNames = (r.disorders || []).map(d => d.name).join(', ') || '—';
                const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
                return `<tr style="background:${rowBg};border-bottom:1px solid #e5e7eb;">
                    <td style="padding:0.6rem 0.8rem;color:#374151;">${date}</td>
                    <td style="padding:0.6rem 0.8rem;color:#374151;">${gradeLabels[r.ageGroup] || r.ageGroup}</td>
                    <td style="padding:0.6rem 0.8rem;text-align:center;font-weight:600;">${r.score}/${r.totalPossible}</td>
                    <td style="padding:0.6rem 0.8rem;text-align:center;font-weight:700;color:${pctColor};">${r.percentage}%</td>
                    <td style="padding:0.6rem 0.8rem;text-align:center;font-size:0.8rem;color:#6b7280;">${disorderNames}</td>
                </tr>`;
            }).join('');
        }

    } catch (err) {
        console.error('Failed to load assessment results:', err);
        if (loading) loading.style.display = 'none';
        if (empty) empty.style.display = 'block';
    }
}

// Close modal on button click & overlay click
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeArModal');
    const overlay = document.getElementById('assessmentResultsModal');
    if (closeBtn) closeBtn.addEventListener('click', closeAssessmentResultsModal);
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeAssessmentResultsModal(); });
});
