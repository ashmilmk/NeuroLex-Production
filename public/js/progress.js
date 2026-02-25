// Progress page - loads results from database with localStorage fallback

async function loadResults() {
    console.log('=== loadResults START ===');

    try {
        const resultsContent = document.getElementById('resultsContent');
        const studentNameDisplay = document.getElementById('studentNameDisplay');

        if (!resultsContent || !studentNameDisplay) {
            console.error('Elements not found:', { resultsContent, studentNameDisplay });
            return;
        }
        const filterName = localStorage.getItem('studentName') || localStorage.getItem('lastPlayerName') || '';
        if (filterName) {
            studentNameDisplay.textContent = `Results for: ${filterName}`;
        } else {
            studentNameDisplay.textContent = 'All Results';
        }

        // Try fetching from database first
        let filteredResults = [];
        let fromDatabase = false;

        const token = localStorage.getItem('token') || localStorage.getItem('studentToken');
        if (token && filterName) {
            try {
                const res = await fetch(`/api/progress/game-results-by-name/${encodeURIComponent(filterName)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (data.status === 'success' && data.results && data.results.length > 0) {
                    // Map database results to the expected format
                    filteredResults = data.results.map(r => ({
                        _id: r._id,
                        id: r._id,
                        date: r.createdAt,
                        playerName: r.playerName,
                        ageGroup: r.ageGroup,
                        score: r.score,
                        totalPossible: r.totalPossible,
                        percentage: r.percentage,
                        talentScores: r.talentScores,
                        disorders: r.disorders,
                        challengesCompleted: r.challengesCompleted,
                        totalTime: r.totalTime
                    }));
                    fromDatabase = true;
                    console.log('Loaded results from database:', filteredResults.length);
                }
            } catch (err) {
                console.warn('Database fetch failed, falling back to localStorage:', err);
            }
        }

        // Fallback to localStorage if database fetch returned nothing
        if (!fromDatabase) {
            const gameResults = JSON.parse(localStorage.getItem('gameResults') || '[]');
            console.log('Falling back to localStorage, gameResults:', gameResults.length);

            filteredResults = gameResults;
            if (filterName && filterName.length > 0) {
                filteredResults = gameResults.filter(r => r.playerName === filterName);
            }
        }

        // Sort by date descending
        filteredResults.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredResults.length === 0) {
            resultsContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <div class="empty-state-text">
                        <h3 style="margin-bottom: 0.5rem;">No Results Yet</h3>
                        <p>Complete an assessment to see your progress here.</p>
                    </div>
                    <button class="btn-back" data-action="goBack">
                        <i class="fas fa-arrow-left"></i>
                        Back to Students
                    </button>
                </div>
            `;
            return;
        }

        // Create result cards
        const resultsHTML = filteredResults.map(result => {
            const date = new Date(result.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const gradeLabel = {
                'grade12': 'Grade 1-2',
                'grade34': 'Grade 3-4',
                'grade56': 'Grade 5-6',
                'drawing': 'Drawing (Level 2)'
            }[result.ageGroup] || result.ageGroup;

            const disordersHTML = result.disorders && result.disorders.length > 0
                ? `
                    <div class="disorders-section">
                        <div class="disorders-title">
                            <i class="fas fa-exclamation-triangle"></i>
                            Learning Disorder Assessment
                        </div>
                        ${result.disorders.map(disorder => `
                            <div class="disorder-item">
                                <div class="disorder-name">${disorder.icon} ${disorder.name}</div>
                                <div class="disorder-desc">${disorder.description}</div>
                                <span class="disorder-severity severity-${disorder.severity.toLowerCase()}">
                                    ${disorder.severity} - ${disorder.percentage}%
                                </span>
                            </div>
                        `).join('')}
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.85rem; color: var(--text-secondary);">
                            <strong>Note:</strong> These assessments are screening tools. Please consult with an educational specialist for a comprehensive evaluation.
                        </div>
                    </div>
                `
                : `
                    <div class="disorders-section" style="background: rgba(76, 175, 80, 0.1); border-color: rgba(76, 175, 80, 0.2);">
                        <div class="disorders-title" style="color: #4caf50;">
                            <i class="fas fa-check-circle"></i>
                            No Learning Disorders Detected
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);">Great work! Based on this assessment, no significant learning disorders were detected.</p>
                    </div>
                `;

            // Round values for display
            const displayScore = typeof result.score === 'number' ? Math.round(result.score * 10) / 10 : result.score;
            const displayTotal = typeof result.totalPossible === 'number' ? Math.round(result.totalPossible * 10) / 10 : result.totalPossible;
            const displayPercentage = typeof result.percentage === 'number' ? Math.round(result.percentage) : '0';

            // Round talent scores
            const talentRows = Object.entries(result.talentScores || {}).map(([talent, score]) => {
                const displayTalentScore = typeof score === 'number' ? Math.round(score * 10) / 10 : score;
                return `
                    <div class="talent-item">
                        <div class="talent-icon">${getTalentIcon(talent)}</div>
                        <div class="talent-info">
                            <div class="talent-name">${formatTalentName(talent)}</div>
                            <div class="talent-score">${displayTalentScore}</div>
                        </div>
                    </div>
                `;
            }).join('');

            // Delete button - only show if result has a database _id
            const deleteBtn = result._id
                ? `<button class="btn-delete-result" data-action="delete" data-result-id="${result._id}" title="Delete this result">
                       <i class="fas fa-trash"></i> Delete
                   </button>`
                : '';

            return `
                <div class="result-card" id="result-${result._id || result.id}">
                    <div class="result-header">
                        <div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">${result.playerName}</div>
                            <div class="result-date">${date}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${gradeLabel}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                            <div class="result-score">
                                <div class="score-value">${displayPercentage}%</div>
                                <div class="score-label">Score</div>
                            </div>
                            ${deleteBtn}
                        </div>
                    </div>

                    <div class="result-details">
                        <div class="detail-item">
                            <div class="detail-icon">📊</div>
                            <div class="detail-content">
                                <div class="detail-label">Total Score</div>
                                <div class="detail-value">${displayScore}/${displayTotal}</div>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-icon">✅</div>
                            <div class="detail-content">
                                <div class="detail-label">Questions</div>
                                <div class="detail-value">${result.challengesCompleted}</div>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-icon">⏱️</div>
                            <div class="detail-content">
                                <div class="detail-label">Duration</div>
                                <div class="detail-value">${formatDuration(result.totalTime, result.challengesCompleted)}</div>
                            </div>
                        </div>
                    </div>

                    <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary);">Talent Scores</div>
                    <div class="talents-grid">
                        ${talentRows}
                    </div>

                    ${disordersHTML}
                </div>
            `;
        }).join('');

        resultsContent.innerHTML = resultsHTML;
        attachResultsEventListeners();
        console.log('=== loadResults END ===');
    } catch (error) {
        console.error('Error in loadResults:', error);
        document.getElementById('resultsContent').innerHTML = `<div style="color: red; padding: 2rem;">Error: ${error.message}</div>`;
    }
}

// Delete a game result from the database
async function deleteResult(resultId) {
    if (!confirm('Are you sure you want to delete this result?')) return;

    const token = localStorage.getItem('token') || localStorage.getItem('studentToken');
    if (!token) {
        alert('You must be logged in to delete results.');
        return;
    }

    try {
        const res = await fetch(`/api/progress/game-result/${resultId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();

        if (data.status === 'success') {
            // Remove the card from DOM with animation
            const card = document.getElementById(`result-${resultId}`);
            if (card) {
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateX(50px)';
                setTimeout(() => {
                    card.remove();
                    // Check if there are no more results
                    const remaining = document.querySelectorAll('.result-card');
                    if (remaining.length === 0) {
                        loadResults(); // Reload to show empty state
                    }
                }, 300);
            }
        } else {
            alert('Failed to delete: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete result. Please try again.');
    }
}

// Attach event listeners to dynamically created buttons (avoids CSP issues with inline onclick)
function attachResultsEventListeners() {
    // Delete buttons
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', function () {
            const resultId = this.getAttribute('data-result-id');
            if (resultId) deleteResult(resultId);
        });
    });

    // Go back buttons
    document.querySelectorAll('[data-action="goBack"]').forEach(btn => {
        btn.addEventListener('click', function () {
            goBack();
        });
    });
}

function getTalentDisplayName(talent) {
    const names = {
        creativity: '🎨 Creativity',
        logic: '🧩 Logic',
        memory: '🧠 Memory',
        observation: '🔍 Observation',
        problemSolving: '💡 Problem Solving',
        dyscalculia: '🔢 Dyscalculia',
        dysphasia: '🗣️ Dysphasia',
        dysgraphia: '✏️ Dysgraphia'
    };
    return names[talent] || talent;
}

function getTalentIcon(talent) {
    const icons = {
        creativity: '🎨',
        logic: '🧩',
        memory: '🧠',
        observation: '🔍',
        problemSolving: '💡',
        dyscalculia: '🔢',
        dysphasia: '🗣️',
        dysgraphia: '✏️',
        drawingAccuracy: '🖊️'
    };
    return icons[talent] || '✨';
}

function formatTalentName(talent) {
    const names = {
        creativity: 'Creativity',
        logic: 'Logic',
        memory: 'Memory',
        observation: 'Observation',
        problemSolving: 'Problem Solving',
        dyscalculia: 'Dyscalculia',
        dysphasia: 'Dysphasia',
        dysgraphia: 'Dysgraphia',
        drawingAccuracy: 'Drawing Accuracy'
    };
    return names[talent] || talent;
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = 'students.html';
    }
}

// Initialize on page load
console.log('Script loaded, document.readyState:', document.readyState);

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('consultantLoggedIn');
            localStorage.removeItem('consultantEmail');
            window.location.href = 'login.html';
        });
    }
}

function initPage() {
    loadResults();

    // Set up back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        console.log('Back button found, adding listener');
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goBack();
        });
    }

    // Set up logout button if present
    setupLogoutButton();
}

// Helper to format duration
function formatDuration(ms, questionCount) {
    if (!ms || typeof ms !== 'number') {
        return `~${Math.round(questionCount * 2)} min`;
    }

    const seconds = Math.round(ms / 1000);
    if (seconds < 60) {
        return `${seconds} sec`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}min ${remainingSeconds}s`;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}
