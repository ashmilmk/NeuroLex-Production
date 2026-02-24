// Game State
let gameState = {
    playerName: '',
    ageGroup: 'grade12', // grade12, grade34, grade56
    currentChallenge: 0,
    score: 0,
    talentScores: {
        creativity: 0,
        logic: 0,
        memory: 0,
        observation: 0,
        problemSolving: 0,
        // New learning disorder-specific categories
        dyscalculia: 0,
        dysphasia: 0,
        dysgraphia: 0
    },
    challenges: [],
    accessibility: {
        largeFont: false,
        highContrast: false,
        dyslexiaFont: false,
        readingGuide: false
    },
    speechSynthesis: null,
    preferredVoice: null,
    // Add disorder assessment tracking
    disorderAssessment: {
        dyscalculiaScore: 0,
        dysphasiaScore: 0,
        dysgraphiaScore: 0,
        totalDyscalculiaChallenges: 0,
        totalDysphasiaChallenges: 0,
        totalDysgraphiaChallenges: 0
    },
    startTime: 0 // Track when the game started
};

// Cached handlers for reading guide events
let readingGuideMouseMoveHandler = null;
let readingGuideFocusHandler = null;
let speechInitPromise = null;
let speechReady = false;
let currentUtterance = null;

// Try to pick a friendly female English voice that kids enjoy
function selectPreferredVoice(voices) {
    if (!voices || voices.length === 0) return null;
    const priorityNames = [
        'Microsoft Aria',
        'Microsoft Jenny',
        'Microsoft Zira',
        'Google UK English Female',
        'Google US English',
        'Samantha',
        'Karen',
        'Victoria'
    ];
    for (const name of priorityNames) {
        const match = voices.find(v => v.name && v.name.toLowerCase().includes(name.toLowerCase()));
        if (match) return match;
    }
    const englishVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    return englishVoices[0] || voices[0] || null;
}

// Age-appropriate challenge data replaced with provided 20-question set
// Grade-appropriate challenge data with questionnaires for all grades
const challengesByAge = {
    grade12: [
        // Grade 1-2: Dysphasia (Language) - 4 Questions with images
        {
            id: 1,
            title: "🐶 Puppy Play",
            description: "Look at the picture and answer!",
            type: "dysphasia",
            content: "What is the puppy doing?",
            options: ["Sleeping", "Playing with a ball", "Eating food", "Drinking water"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Language Skills",
            mediaType: "image",
            mediaUrl: "assets/grade12/puppy_playing.png",
            audioNarration: true
        },
        {
            id: 2,
            title: "🌈 Rainbow Colors",
            description: "Look at the beautiful rainbow!",
            type: "dysphasia",
            content: "What color comes after RED in the rainbow?",
            options: ["Blue", "Orange", "Green", "Yellow"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Language Skills",
            mediaType: "image",
            mediaUrl: "assets/grade12/rainbow_colors.png",
            audioNarration: true
        },
        {
            id: 3,
            title: "🎂 Birthday Fun",
            description: "Look at the yummy cake!",
            type: "dysphasia",
            content: "What do we eat at birthday parties?",
            options: ["Soup", "Cake", "Rice", "Eggs"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Language Skills",
            mediaType: "image",
            mediaUrl: "assets/grade12/birthday_cake.png",
            audioNarration: true
        },
        {
            id: 4,
            title: "☀️ Sunny Day",
            description: "Look at the bright sky!",
            type: "dysphasia",
            content: "What makes us warm during the day?",
            options: ["The Moon", "The Sun", "Stars", "Clouds"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Language Skills",
            mediaType: "image",
            mediaUrl: "assets/grade12/sun_shining.png",
            audioNarration: true
        },

        // Grade 1-2: Dyscalculia (Math) - 4 Questions with images
        {
            id: 5,
            title: "🍎 Count the Apples",
            description: "Let's count together!",
            type: "dyscalculia",
            content: "How many apples can you see?",
            options: ["2", "3", "4", "5"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Number Skills",
            mediaType: "image",
            mediaUrl: "assets/grade12/three_apples.png",
            audioNarration: true
        },
        {
            id: 6,
            title: "🎈 Balloon Fun",
            description: "Count the colorful balloons!",
            type: "dyscalculia",
            content: "How many balloons are there?",
            options: ["3", "4", "5", "6"],
            correctAnswer: 2,
            maxScore: 8.3,
            typeLabel: "Number Skills",
            mediaType: "image",
            mediaUrl: "assets/grade12/five_balloons.png",
            audioNarration: true
        },
        {
            id: 7,
            title: "➕ Star Addition",
            description: "Add the stars together!",
            type: "dyscalculia",
            content: "⭐⭐ + ⭐ = ? (2 + 1 = ?)",
            options: ["2", "3", "4", "5"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Number Skills",
            mediaType: "none",
            audioNarration: true
        },
        {
            id: 8,
            title: "🧸 Toy Math",
            description: "Count and add the toys!",
            type: "dyscalculia",
            content: "🧸🧸🧸 + 🧸🧸 = ? (3 + 2 = ?)",
            options: ["4", "5", "6", "7"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Number Skills",
            mediaType: "none",
            audioNarration: true
        },

        // Grade 1-2: Dysgraphia (Writing/Letters) - 4 Questions
        {
            id: 9,
            title: "✏️ Letter Match",
            description: "Find the correct letter!",
            type: "dysgraphia",
            content: "Which letter looks like this? 🅱️",
            options: ["D", "B", "P", "R"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Writing Skills",
            mediaType: "none",
            audioNarration: true
        },
        {
            id: 10,
            title: "🔤 Find the Letter",
            description: "Look carefully at the letters!",
            type: "dysgraphia",
            content: "Which one is the letter 'A'?",
            options: ["B", "A", "D", "C"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Writing Skills",
            mediaType: "none",
            audioNarration: true
        },
        {
            id: 11,
            title: "📝 Missing Letter",
            description: "Complete the word!",
            type: "dysgraphia",
            content: "C _ T (What letter is missing?)",
            options: ["E", "A", "I", "O"],
            correctAnswer: 1,
            maxScore: 8.3,
            typeLabel: "Writing Skills",
            mediaType: "none",
            audioNarration: true
        },
        {
            id: 12,
            title: "🔡 First Letter",
            description: "What letter starts the word?",
            type: "dysgraphia",
            content: "What letter does 'DOG' start with? 🐕",
            options: ["B", "C", "D", "G"],
            correctAnswer: 2,
            maxScore: 8.3,
            typeLabel: "Writing Skills",
            mediaType: "none",
            audioNarration: true
        }
    ],
    grade34: [
        // Grade 3-4: Section 1 – Fun Stories with Simple Reading (Q1–Q10)
        { id: 1, title: "🧙 The Wizard's Spell", description: "Answer the question.", type: "dysphasia", content: "What did the wizard use to make magic?", options: ["A wand", "A book", "A hat", "A ring"], correctAnswer: 0, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 2, title: "🏆 The Soccer Game", description: "Answer the question.", type: "dysphasia", content: "Which team won the soccer game?", options: ["Red team", "Blue team", "Green team", "Yellow team"], correctAnswer: 0, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 3, title: "🦸 Superhero Time", description: "Answer the question.", type: "dysphasia", content: "What is the superhero's special power?", options: ["Flying", "Super strength", "Invisibility", "Heat vision"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 4, title: "🎸 The Band", description: "Answer the question.", type: "dysphasia", content: "What instrument does the musician play?", options: ["Piano", "Guitar", "Drums", "Flute"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 5, title: "🚀 Space Adventure", description: "Answer the question.", type: "dysphasia", content: "Where did the rocket go?", options: ["To the moon", "To the sun", "To Mars", "To space"], correctAnswer: 3, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 6, title: "🏰 Castle Mystery", description: "Answer the question.", type: "dysphasia", content: "What was hidden in the castle?", options: ["Gold", "Treasure", "A secret", "A dragon"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 7, title: "🌊 Ocean Adventure", description: "Answer the question.", type: "dysphasia", content: "What did they find under the ocean?", options: ["Pearls", "Shells", "Treasure chest", "All of these"], correctAnswer: 3, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 8, title: "🦁 Lion's Journey", description: "Answer the question.", type: "dysphasia", content: "Where did the lion go?", options: ["To the forest", "To the desert", "To the savanna", "To the jungle"], correctAnswer: 2, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 9, title: "🎭 The Play", description: "Answer the question.", type: "dysphasia", content: "What was the play about?", options: ["A princess", "A knight", "A hero", "A love story"], correctAnswer: 0, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 10, title: "🍰 Bakery Day", description: "Answer the question.", type: "dysphasia", content: "What did they bake?", options: ["Cake", "Cookies", "Bread", "All of these"], correctAnswer: 3, maxScore: 15, typeLabel: "Dysphasia Support" },

        // Grade 3-4: Section 2 – Easy Math (Q11–Q20)
        { id: 11, title: "🧮 Simple Addition", description: "Solve the problem.", type: "dyscalculia", content: "10 + 5 = ?", options: ["12", "13", "15", "16"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 12, title: "🧮 Add More", description: "Solve the problem.", type: "dyscalculia", content: "7 + 8 = ?", options: ["14", "15", "16", "17"], correctAnswer: 1, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 13, title: "➖ Subtraction", description: "Solve the problem.", type: "dyscalculia", content: "12 - 3 = ?", options: ["8", "9", "10", "11"], correctAnswer: 1, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 14, title: "➖ Take Away", description: "Solve the problem.", type: "dyscalculia", content: "15 - 5 = ?", options: ["8", "9", "10", "11"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 15, title: "✖️ Times", description: "Solve the problem.", type: "dyscalculia", content: "3 × 4 = ?", options: ["10", "11", "12", "13"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 16, title: "✖️ Double", description: "Solve the problem.", type: "dyscalculia", content: "5 × 2 = ?", options: ["8", "9", "10", "11"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 17, title: "➗ Share", description: "Solve the problem.", type: "dyscalculia", content: "12 ÷ 3 = ?", options: ["2", "3", "4", "5"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 18, title: "🧮 Story Math", description: "Solve the problem.", type: "dyscalculia", content: "Tom has 10 marbles. He gets 5 more. How many total?", options: ["12", "13", "14", "15"], correctAnswer: 3, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 19, title: "🧮 Count Down", description: "Solve the problem.", type: "dyscalculia", content: "Lisa has 20 stickers. She gives away 8. How many left?", options: ["10", "11", "12", "13"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 20, title: "🧮 Group Math", description: "Solve the problem.", type: "dyscalculia", content: "There are 3 baskets with 4 apples each. Total apples?", options: ["10", "11", "12", "13"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" }
    ],
    grade56: [
        // Grade 5-6: Section 1 – Reading & Comprehension (Q1–Q10)
        { id: 1, title: "📚 The Lost Journal", description: "Answer the question.", type: "dysphasia", content: "What was the central theme of 'The Lost Journal'?", options: ["Betrayal and redemption", "Discovery and growth", "Adventure and danger", "Mystery and intrigue"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 2, title: "📚 The Lost Journal", description: "Answer the question.", type: "dysphasia", content: "Why did the protagonist keep the journal hidden?", options: ["Fear of judgment", "Protection of secrets", "Embarrassment", "All of the above"], correctAnswer: 3, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 3, title: "📚 The Lost Journal", description: "Answer the question.", type: "dysphasia", content: "How did the journal change the protagonist's relationships?", options: ["Strengthened bonds", "Created distance", "Revealed trust", "Improved communication"], correctAnswer: 0, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 4, title: "🌍 Across the Ocean", description: "Answer the question.", type: "dysphasia", content: "What was the primary conflict in 'Across the Ocean'?", options: ["Cultural differences", "Personal ambitions", "Environmental challenges", "Political tensions"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 5, title: "🌍 Across the Ocean", description: "Answer the question.", type: "dysphasia", content: "Which character showed the most growth throughout the story?", options: ["The protagonist", "The antagonist", "The mentor", "The ally"], correctAnswer: 0, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 6, title: "⚡ The Legacy", description: "Answer the question.", type: "dysphasia", content: "What does 'the legacy' refer to in this context?", options: ["Inherited wealth", "Family secrets", "Values and wisdom", "Historical artifacts"], correctAnswer: 2, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 7, title: "⚡ The Legacy", description: "Answer the question.", type: "dysphasia", content: "How is the legacy passed to the next generation?", options: ["Through stories", "Through actions", "Through teaching", "Through all methods"], correctAnswer: 3, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 8, title: "🎭 Voices of Change", description: "Answer the question.", type: "dysphasia", content: "What social issue was highlighted in 'Voices of Change'?", options: ["Equality", "Justice", "Freedom", "All of the above"], correctAnswer: 3, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 9, title: "🎭 Voices of Change", description: "Answer the question.", type: "dysphasia", content: "How did the community respond to the change?", options: ["With resistance", "With support", "With indifference", "With confusion"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },
        { id: 10, title: "🔬 The Experiment", description: "Answer the question.", type: "dysphasia", content: "What surprising result did the experiment yield?", options: ["Expected outcome", "Unexpected discovery", "Failed hypothesis", "Inconclusive data"], correctAnswer: 1, maxScore: 15, typeLabel: "Dysphasia Support" },

        // Grade 5-6: Section 2 – Mathematics & Logic (Q11–Q20)
        { id: 11, title: "🧮 Decimal Addition", description: "Solve the problem.", type: "dyscalculia", content: "12.5 + 8.7 = ?", options: ["20.2", "21.2", "22.2", "23.2"], correctAnswer: 1, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 12, title: "🧮 Decimal Operations", description: "Solve the problem.", type: "dyscalculia", content: "25.6 – 7.3 = ?", options: ["18.3", "18.5", "18.8", "19.2"], correctAnswer: 0, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 13, title: "✖️ Multiplication", description: "Solve the problem.", type: "dyscalculia", content: "12 × 15 = ?", options: ["150", "165", "175", "180"], correctAnswer: 1, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 14, title: "➗ Division", description: "Solve the problem.", type: "dyscalculia", content: "144 ÷ 12 = ?", options: ["10", "11", "12", "13"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 15, title: "📊 Fractions", description: "Solve the problem.", type: "dyscalculia", content: "1/2 + 1/4 = ?", options: ["1/6", "1/4", "3/4", "1/2"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 16, title: "📊 Percentages", description: "Solve the problem.", type: "dyscalculia", content: "What is 25% of 80?", options: ["15", "18", "20", "25"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 17, title: "🔢 Exponents", description: "Solve the problem.", type: "dyscalculia", content: "2³ = ?", options: ["6", "8", "16", "32"], correctAnswer: 1, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 18, title: "🧮 Complex Problem", description: "Solve the problem.", type: "dyscalculia", content: "If a book costs $12 and is on sale for 30% off, what is the new price?", options: ["$8.40", "$8.80", "$9.00", "$9.50"], correctAnswer: 0, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 19, title: "🧮 Ratio Problem", description: "Solve the problem.", type: "dyscalculia", content: "The ratio of boys to girls is 3:2. If there are 15 boys, how many girls?", options: ["8 girls", "9 girls", "10 girls", "12 girls"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" },
        { id: 20, title: "🧮 Area Problem", description: "Solve the problem.", type: "dyscalculia", content: "A rectangular garden is 8m long and 5m wide. What is its area?", options: ["30 m²", "35 m²", "40 m²", "45 m²"], correctAnswer: 2, maxScore: 15, typeLabel: "Dyscalculia Support" }
    ]
};




// DOM Elements
const elements = {
    welcomeScreen: document.getElementById('welcome-screen'),
    gameScreen: document.getElementById('game-screen'),
    resultsScreen: document.getElementById('results-screen'),
    playerName: document.getElementById('player-name'),
    startGame: document.getElementById('start-game'),
    currentPlayer: document.getElementById('current-player'),
    currentScore: document.getElementById('current-score'),
    progressFill: document.getElementById('progress-fill'),
    challengeTitle: document.getElementById('challenge-title'),
    challengeDescription: document.getElementById('challenge-description'),
    challengeContent: document.getElementById('challenge-content'),
    challengeOptions: document.getElementById('challenge-options'),
    challengeType: document.getElementById('challenge-type'),
    nextChallenge: document.getElementById('next-challenge'),
    restartGame: document.getElementById('restart-game'),
    finalScore: document.getElementById('final-score'),
    talentResults: document.getElementById('talent-results'),
    playAgain: document.getElementById('play-again'),
    backToWelcome: document.getElementById('back-to-welcome'),
    viewProgress: document.getElementById('view-progress'),
    goHome: document.getElementById('go-home'),
    // Accessibility elements
    fontSizeToggle: document.getElementById('font-size-toggle'),
    highContrastToggle: document.getElementById('high-contrast-toggle'),
    dyslexiaFontToggle: document.getElementById('dyslexia-font-toggle'),
    readingGuideToggle: document.getElementById('reading-guide-toggle'),
    readingGuide: document.getElementById('reading-guide'),
    readAloud: document.getElementById('read-aloud')
};

// Initialize Game
function initGame() {
    // Check for URL parameters to pre-fill student name and grade
    const urlParams = new URLSearchParams(window.location.search);
    const studentName = urlParams.get('name');
    const studentGrade = urlParams.get('grade');

    if (studentName) {
        if (elements.playerName) {
            elements.playerName.value = decodeURIComponent(studentName);
        }
    }

    // Auto-select grade if provided via URL parameter
    if (studentGrade && ['grade12', 'grade34', 'grade56'].includes(studentGrade)) {
        gameState.ageGroup = studentGrade;
        // Auto-select the grade button in UI
        const gradeBtn = document.querySelector(`[data-age="${studentGrade}"]`);
        if (gradeBtn) {
            document.querySelectorAll('.age-btn').forEach(btn => btn.classList.remove('active'));
            gradeBtn.classList.add('active');
        }
    }

    // Initialize challenges based on default age group
    gameState.challenges = [...challengesByAge[gameState.ageGroup]].sort(() => Math.random() - 0.5);

    // Initialize speech synthesis
    initSpeechSynthesis();

    // Event Listeners
    if (elements.startGame) {
        elements.startGame.addEventListener('click', startGame);
    }
    const startQuizBtn = document.getElementById('start-quiz');
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', startQuiz);
    }
    if (elements.nextChallenge) {
        elements.nextChallenge.addEventListener('click', nextChallenge);
    }
    if (elements.restartGame) {
        elements.restartGame.addEventListener('click', restartGame);
    }
    if (elements.playAgain) {
        elements.playAgain.addEventListener('click', playAgain);
    }
    if (elements.backToWelcome) {
        elements.backToWelcome.addEventListener('click', backToWelcome);
    }
    if (elements.viewProgress) {
        elements.viewProgress.addEventListener('click', viewProgress);
    }
    if (elements.goHome) {
        elements.goHome.addEventListener('click', goHome);
    }
    if (elements.readAloud) {
        elements.readAloud.addEventListener('click', () => {
            console.log('Read Aloud button clicked');
            stopSpeaking();
            readActiveScreen();
        });
    } else {
        console.warn('Read Aloud button not found in DOM');
    }

    // Age group selection
    document.querySelectorAll('.age-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            gameState.ageGroup = e.target.dataset.age;
            gameState.challenges = [...challengesByAge[gameState.ageGroup]].sort(() => Math.random() - 0.5);
        });
    });

    // Accessibility controls
    elements.fontSizeToggle.addEventListener('click', toggleLargeFont);
    elements.highContrastToggle.addEventListener('click', toggleHighContrast);
    elements.dyslexiaFontToggle.addEventListener('click', toggleDyslexiaFont);
    elements.readingGuideToggle.addEventListener('click', toggleReadingGuide);

    // Enter key for player name
    elements.playerName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startGame();
        }
    });

    // Add student background animations
    addStudentBackgroundAnimations();

    // Initialize accessibility features
    initAccessibility();
}

// Navigate to Progress Page
function viewProgress() {
    try {
        console.log('viewProgress called');
        console.log('gameState.playerName:', gameState.playerName);
        console.log('typeof gameState.playerName:', typeof gameState.playerName);

        // Ensure the latest player name is stored for filtering on progress page
        if (gameState.playerName && typeof gameState.playerName === 'string') {
            console.log('Setting userName to:', gameState.playerName);
            localStorage.setItem('userName', gameState.playerName);
            console.log('Retrieved userName from localStorage:', localStorage.getItem('userName'));
        } else {
            console.warn('gameState.playerName is not a valid string:', gameState.playerName);
        }
    } catch (e) {
        console.warn('Unable to sync userName to localStorage before navigating to progress page.', e);
    }
    console.log('Navigating to progress.html');
    window.location.href = '../progress.html';
}

// Initialize speech synthesis
function initSpeechSynthesis() {
    if (speechInitPromise) return speechInitPromise;
    speechInitPromise = new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
            console.log('Speech synthesis not supported');
            resolve(false);
            return;
        }
        let resolved = false;
        gameState.speechSynthesis = window.speechSynthesis;
        const assignVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length) {
                gameState.preferredVoice = selectPreferredVoice(voices);
                speechReady = true;
                if (!resolved) {
                    resolved = true;
                    resolve(true);
                }
            }
        };
        window.speechSynthesis.onvoiceschanged = assignVoices;
        assignVoices();
        // Prime engine with a silent utterance to unlock on some browsers
        try {
            const primingUtterance = new SpeechSynthesisUtterance(' ');
            primingUtterance.volume = 0;
            primingUtterance.rate = 1;
            primingUtterance.pitch = 1;
            primingUtterance.onend = () => {
                if (!resolved) {
                    resolved = true;
                    resolve(speechReady);
                }
            };
            primingUtterance.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    resolve(speechReady);
                }
            };
            window.speechSynthesis.speak(primingUtterance);
        } catch (e) {
            console.warn('Unable to prime speech engine', e);
        }
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(speechReady);
            }
        }, 1500);
    });
    return speechInitPromise;
}

// Speak text function
// Speak text function
async function speakText(text, rate = 0.9, pitch = 1.1, source = 'manual') {
    console.log(`speakText called with source: ${source}, text length: ${text?.length}`);

    if (!('speechSynthesis' in window)) {
        console.warn('speechSynthesis not supported in window');
        return;
    }

    const ready = await initSpeechSynthesis();
    console.log(`Speech synthesis ready: ${ready}`);
    if (!ready || !gameState.speechSynthesis) {
        console.warn('Speech synthesis failed to initialize');
        return;
    }

    // Strict check for reading guide race condition
    if (source === 'guide' && !gameState.accessibility.readingGuide) {
        console.log('Aborting speech: Reading guide is disabled');
        return;
    }

    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;
    utterance.lang = 'en-US';
    const voices = gameState.speechSynthesis.getVoices();
    if (!gameState.preferredVoice && voices && voices.length) {
        gameState.preferredVoice = selectPreferredVoice(voices);
    }
    if (gameState.preferredVoice) {
        utterance.voice = gameState.preferredVoice;
    }
    utterance.onend = () => {
        currentUtterance = null;
    };
    utterance.onerror = () => {
        currentUtterance = null;
    };
    currentUtterance = utterance;
    gameState.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (gameState.speechSynthesis) {
        // Cancel any pending speech
        gameState.speechSynthesis.cancel();

        // Resume to ensure cancel works (Chrome bug workaround)
        if (gameState.speechSynthesis.paused) {
            gameState.speechSynthesis.resume();
            gameState.speechSynthesis.cancel();
        }
    }
    currentUtterance = null;
}

function readActiveScreen() {
    const activeScreen = document.querySelector('.screen.active');
    console.log(`readActiveScreen called. Active screen: ${activeScreen?.id}`);

    if (!activeScreen) return;
    let textToSpeak = '';

    if (activeScreen.id === 'game-screen') {
        const challenge = gameState.challenges[gameState.currentChallenge];
        if (challenge) {
            const optionsText = challenge.options ? challenge.options.join('. ') : '';
            textToSpeak = `${challenge.title}. ${challenge.description}. ${challenge.content}. ${optionsText}`;
        }
    } else if (activeScreen.id === 'passages-screen') {
        const passages = Array.from(activeScreen.querySelectorAll('.passage-card')).map(card => card.innerText.trim());
        textToSpeak = passages.join('. ');
    } else if (activeScreen.id === 'results-screen') {
        textToSpeak = elements.finalScore?.innerText || 'Here are your results.';
    } else {
        textToSpeak = activeScreen.innerText || '';
    }

    console.log(`Extracted text to speak: ${textToSpeak ? textToSpeak.substring(0, 50) + '...' : 'None'}`);

    textToSpeak = (textToSpeak || '').replace(/\s+/g, ' ').trim();
    if (textToSpeak) {
        speakText(textToSpeak, 0.9, 1, 'manual');
    }
}

// Initialize accessibility features
function initAccessibility() {
    // Check for saved preferences
    const savedPrefs = localStorage.getItem('studentGameAccessibility');
    if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        gameState.accessibility = { ...gameState.accessibility, ...prefs };
        applyAccessibilitySettings();
    }
}

// Apply accessibility settings
function applyAccessibilitySettings() {
    const body = document.body;

    // Large font
    if (gameState.accessibility.largeFont) {
        body.classList.add('large-font');
        elements.fontSizeToggle.classList.add('active');
    } else {
        body.classList.remove('large-font');
        elements.fontSizeToggle.classList.remove('active');
    }

    // High contrast
    if (gameState.accessibility.highContrast) {
        body.classList.add('high-contrast');
        elements.highContrastToggle.classList.add('active');
    } else {
        body.classList.remove('high-contrast');
        elements.highContrastToggle.classList.remove('active');
    }

    // Dyslexia font
    if (gameState.accessibility.dyslexiaFont) {
        body.classList.add('dyslexia-font');
        elements.dyslexiaFontToggle.classList.add('active');
    } else {
        body.classList.remove('dyslexia-font');
        elements.dyslexiaFontToggle.classList.remove('active');
    }

    // Reading guide
    if (gameState.accessibility.readingGuide) {
        elements.readingGuide.classList.add('active');
        elements.readingGuideToggle.classList.add('active');
    } else {
        elements.readingGuide.classList.remove('active');
        elements.readingGuideToggle.classList.remove('active');
    }

    // Save preferences
    localStorage.setItem('studentGameAccessibility', JSON.stringify(gameState.accessibility));
}

// Toggle large font
function toggleLargeFont() {
    gameState.accessibility.largeFont = !gameState.accessibility.largeFont;
    applyAccessibilitySettings();
}

// Toggle high contrast
function toggleHighContrast() {
    gameState.accessibility.highContrast = !gameState.accessibility.highContrast;
    applyAccessibilitySettings();
}

// Toggle dyslexia font
function toggleDyslexiaFont() {
    gameState.accessibility.dyslexiaFont = !gameState.accessibility.dyslexiaFont;
    applyAccessibilitySettings();
}

// Toggle reading guide with speech
function toggleReadingGuide() {
    gameState.accessibility.readingGuide = !gameState.accessibility.readingGuide;
    applyAccessibilitySettings();

    // If reading guide is activated, speak the current challenge
    if (gameState.accessibility.readingGuide && gameState.currentChallenge < gameState.challenges.length) {
        const challenge = gameState.challenges[gameState.currentChallenge];
        const textToSpeak = `${challenge.title}. ${challenge.description}. ${challenge.content}`;
        speakText(textToSpeak, 0.9, 1.1, 'guide');

        // Enable reading guide line with focus only (no mouse tracking)
        if (!readingGuideFocusHandler) {
            readingGuideFocusHandler = (e) => {
                if (!e || !e.target || !elements.readingGuide) return;
                const rect = e.target.getBoundingClientRect?.();
                if (rect) {
                    const midY = rect.top + rect.height / 2;
                    elements.readingGuide.style.top = `${Math.max(0, midY)}px`;
                }
            };
        }
        document.addEventListener('focusin', readingGuideFocusHandler, true);
        // Allow quick toggle off with Escape key
        const onEsc = (e) => {
            if (e.key === 'Escape') {
                gameState.accessibility.readingGuide = false;
                applyAccessibilitySettings();
                document.removeEventListener('focusin', readingGuideFocusHandler, true);
                document.removeEventListener('keydown', onEsc, true);
            }
        };
        document.addEventListener('keydown', onEsc, true);
    } else {
        // Disable movement listeners when guide is off
        stopSpeaking();
        if (readingGuideFocusHandler) {
            document.removeEventListener('focusin', readingGuideFocusHandler, true);
        }
    }
}

// Add student background animations
function addStudentBackgroundAnimations() {
    const studentIcons = document.querySelectorAll('.floating-student-icon');

    studentIcons.forEach((icon, index) => {
        icon.style.animationDelay = `${index * 0.5}s`;
    });
}

// Create celebration effect
function createCelebration() {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];

    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}%;
            top: -10px;
            border-radius: 50%;
            animation: confetti-fall 3s linear infinite;
            z-index: 1000;
            pointer-events: none;
        `;
        confetti.style.animationDelay = `${Math.random() * 3}s`;
        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, 6000);
    }
}

// Start Game
function startGame() {
    const playerName = elements.playerName.value.trim();
    if (!playerName) {
        showMessage('Please enter your name to start your learning adventure!', 'warning');
        return;
    }

    gameState.startTime = Date.now(); // Start the timer
    gameState.playerName = playerName;
    gameState.currentChallenge = 0;
    gameState.score = 0;
    gameState.talentScores = {
        creativity: 0,
        logic: 0,
        memory: 0,
        observation: 0,
        problemSolving: 0,
        dyscalculia: 0,
        dysphasia: 0,
        dysgraphia: 0
    };

    // Reset disorder assessment
    gameState.disorderAssessment = {
        dyscalculiaScore: 0,
        dysphasiaScore: 0,
        dysgraphiaScore: 0,
        totalDyscalculiaChallenges: 0,
        totalDysphasiaChallenges: 0,
        totalDysgraphiaChallenges: 0
    };

    // Shuffle challenges for this session
    gameState.challenges = [...challengesByAge[gameState.ageGroup]].sort(() => Math.random() - 0.5);

    // Create celebration for starting
    createCelebration();

    // Grade 5-6 gets passage screen, Grades 1-2 and 3-4 go straight to quiz
    if (gameState.ageGroup === 'grade56') {
        showScreen('passages-screen');
    } else {
        // For grades 1-2 and 3-4, skip passages and start quiz directly
        showScreen('game-screen');
        updateGameUI();
        displayChallenge();
    }
}

// Start Quiz (after reading passages)
function startQuiz() {
    showScreen('game-screen');
    updateGameUI();
    displayChallenge();
}

// Show Screen
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Show target screen
    document.getElementById(screenId).classList.add('active');
}

// Update Game UI
function updateGameUI() {
    elements.currentPlayer.textContent = gameState.playerName;
    elements.currentScore.textContent = gameState.score;

    const progress = ((gameState.currentChallenge + 1) / gameState.challenges.length) * 100;
    elements.progressFill.style.width = progress + '%';
}

// Display Challenge
function displayChallenge() {
    if (gameState.currentChallenge >= gameState.challenges.length) {
        showResults();
        return;
    }

    const challenge = gameState.challenges[gameState.currentChallenge];

    elements.challengeTitle.textContent = challenge.title;
    elements.challengeDescription.textContent = challenge.description;

    // Build content with media if available
    let contentHTML = '';

    // Add image/video media if available
    if (challenge.mediaType === 'image' && challenge.mediaUrl) {
        contentHTML += `
            <div class="challenge-media" style="margin-bottom: 20px; text-align: center;">
                <img src="${challenge.mediaUrl}" alt="${challenge.title}" 
                    style="max-width: 100%; max-height: 250px; border-radius: 20px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 4px solid #fbbf24;">
            </div>
        `;
    } else if (challenge.mediaType === 'video' && challenge.mediaUrl) {
        contentHTML += `
            <div class="challenge-media" style="margin-bottom: 20px; text-align: center;">
                <video src="${challenge.mediaUrl}" autoplay loop muted 
                    style="max-width: 100%; max-height: 250px; border-radius: 20px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
                </video>
            </div>
        `;
    }

    // Add the question content with larger, kid-friendly text
    contentHTML += `<p style="font-size: 1.4rem; font-weight: 600; color: var(--text-dark); margin: 0;">${challenge.content}</p>`;

    elements.challengeContent.innerHTML = contentHTML;
    elements.challengeType.textContent = challenge.typeLabel;

    // Clear previous options
    elements.challengeOptions.innerHTML = '';

    if (challenge.options) {
        challenge.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.addEventListener('click', () => selectAnswer(index));
            elements.challengeOptions.appendChild(button);
        });
    } else {
        // For creativity challenges without options - Dyslexia-friendly textarea
        const input = document.createElement('textarea');
        input.placeholder = 'Describe your creative answer here...';
        input.style.cssText = `
            width: 100%;
            height: 150px;
            padding: 20px;
            border-radius: 15px;
            border: 3px solid var(--border-light);
            font-family: inherit;
            font-size: 1.1rem;
            resize: none;
            background: white;
            box-shadow: 0 5px 15px var(--shadow-light);
            line-height: 1.5;
            letter-spacing: 0.02em;
            color: var(--text-dark);
        `;
        elements.challengeOptions.appendChild(input);

        const submitBtn = document.createElement('button');
        submitBtn.className = 'option-btn';
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Your Answer';
        submitBtn.style.marginTop = '15px';
        submitBtn.addEventListener('click', () => submitCreativeAnswer(input.value));
        elements.challengeOptions.appendChild(submitBtn);
    }

    updateGameUI();

    // If reading guide is active, speak the challenge
    if (gameState.accessibility.readingGuide) {
        const textToSpeak = `${challenge.title}. ${challenge.description}. ${challenge.content}`;
        speakText(textToSpeak, 0.7, 1);
    }
}

// Select Answer
function selectAnswer(selectedIndex) {
    const challenge = gameState.challenges[gameState.currentChallenge];
    const buttons = elements.challengeOptions.querySelectorAll('.option-btn');

    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);

    // Track disorder-specific performance
    if (challenge.type === 'dyscalculia') {
        gameState.disorderAssessment.totalDyscalculiaChallenges++;
        if (selectedIndex === challenge.correctAnswer) {
            gameState.disorderAssessment.dyscalculiaScore += challenge.maxScore;
        }
    } else if (challenge.type === 'dysphasia') {
        gameState.disorderAssessment.totalDysphasiaChallenges++;
        if (selectedIndex === challenge.correctAnswer) {
            gameState.disorderAssessment.dysphasiaScore += challenge.maxScore;
        }
    } else if (challenge.type === 'dysgraphia') {
        gameState.disorderAssessment.totalDysgraphiaChallenges++;
        if (selectedIndex === challenge.correctAnswer) {
            gameState.disorderAssessment.dysgraphiaScore += challenge.maxScore;
        }
    }

    if (selectedIndex === challenge.correctAnswer) {
        buttons[selectedIndex].classList.add('correct');
        gameState.score += challenge.maxScore;
        gameState.talentScores[challenge.type] += challenge.maxScore;

        // Show success message with celebration
        showMessage('🎉 Correct! Excellent work! 🎉', 'success');
        createCelebration();

        // Speak success message
        if (gameState.accessibility.readingGuide) {
            speakText('Correct! Excellent work!', 0.8, 1.2);
        }
    } else {
        buttons[selectedIndex].classList.add('incorrect');
        buttons[challenge.correctAnswer].classList.add('correct');

        // Show encouraging feedback
        showMessage('💡 Great try! The correct answer was highlighted. Keep going! 💪', 'info');

        // Speak feedback
        if (gameState.accessibility.readingGuide) {
            speakText('Great try! The correct answer was highlighted. Keep going!', 0.8, 1);
        }
    }

    // Enable next challenge button
    elements.nextChallenge.disabled = false;
}

// Submit Creative Answer
function submitCreativeAnswer(answer) {
    const challenge = gameState.challenges[gameState.currentChallenge];

    if (answer.trim()) {
        // For creativity challenges, give points for participation and effort
        const score = Math.min(challenge.maxScore, Math.floor(answer.length / 10) + 5);
        gameState.score += score;
        gameState.talentScores[challenge.type] += score;

        showMessage(`🎨 Creative answer! You earned ${score} points! ✨`, 'success');
        createCelebration();

        // Speak success message
        if (gameState.accessibility.readingGuide) {
            speakText(`Creative answer! You earned ${score} points!`, 0.8, 1.2);
        }
    } else {
        showMessage('Please write something creative and thoughtful!', 'warning');

        // Speak warning
        if (gameState.accessibility.readingGuide) {
            speakText('Please write something creative and thoughtful!', 0.8, 1);
        }
        return;
    }

    elements.nextChallenge.disabled = false;
}

// Show Message
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 30px;
        right: 30px;
        padding: 20px 25px;
        border-radius: 15px;
        color: white;
        font-weight: 600;
        font-size: 1.1rem;
        z-index: 1000;
        animation: slideInRight 0.6s ease;
        box-shadow: 0 10px 30px var(--shadow-medium);
        max-width: 400px;
        text-align: center;
        line-height: 1.4;
        letter-spacing: 0.02em;
    `;

    switch (type) {
        case 'success':
            messageDiv.style.background = 'linear-gradient(45deg, var(--accent-green), var(--accent-purple))';
            break;
        case 'info':
            messageDiv.style.background = 'linear-gradient(45deg, var(--primary-blue), var(--secondary-blue))';
            break;
        case 'warning':
            messageDiv.style.background = 'linear-gradient(45deg, var(--accent-orange), #f97316)';
            break;
    }

    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOutRight 0.6s ease';
        setTimeout(() => {
            messageDiv.remove();
        }, 600);
    }, 4000);
}

// Next Challenge
function nextChallenge() {
    gameState.currentChallenge++;
    elements.nextChallenge.disabled = true;
    displayChallenge();
}

// Assess learning disorders
function assessLearningDisorders() {
    const assessment = gameState.disorderAssessment;
    const disorders = [];

    // Calculate percentages for each disorder type
    const dyscalculiaPercentage = assessment.totalDyscalculiaChallenges > 0 ?
        (assessment.dyscalculiaScore / (assessment.totalDyscalculiaChallenges * 15)) * 100 : 0;

    const dysphasiaPercentage = assessment.totalDysphasiaChallenges > 0 ?
        (assessment.dysphasiaScore / (assessment.totalDysphasiaChallenges * 15)) * 100 : 0;

    const dysgraphiaPercentage = assessment.totalDysgraphiaChallenges > 0 ?
        (assessment.dysgraphiaScore / (assessment.totalDysgraphiaChallenges * 15)) * 100 : 0;

    // Determine potential disorders based on performance thresholds
    if (dyscalculiaPercentage < 60 && assessment.totalDyscalculiaChallenges >= 2) {
        disorders.push({
            name: 'Dyscalculia',
            description: 'Difficulty with numbers and mathematical concepts',
            percentage: Math.round(dyscalculiaPercentage),
            severity: dyscalculiaPercentage < 40 ? 'High' : 'Moderate',
            icon: '🔢'
        });
    }

    if (dysphasiaPercentage < 60 && assessment.totalDysphasiaChallenges >= 2) {
        disorders.push({
            name: 'Dysphasia',
            description: 'Language processing and communication difficulties',
            percentage: Math.round(dysphasiaPercentage),
            severity: dysphasiaPercentage < 40 ? 'High' : 'Moderate',
            icon: '🗣️'
        });
    }

    if (dysgraphiaPercentage < 60 && assessment.totalDysgraphiaChallenges >= 2) {
        disorders.push({
            name: 'Dysgraphia',
            description: 'Writing and spelling difficulties',
            percentage: Math.round(dysgraphiaPercentage),
            severity: dysgraphiaPercentage < 40 ? 'High' : 'Moderate',
            icon: '✏️'
        });
    }

    return disorders;
}

// Show Results
function showResults() {
    // Calculate totalPossible from actual question maxScores
    const totalPossible = gameState.challenges.reduce((sum, c) => sum + (c.maxScore || 15), 0);
    // Round score to 1 decimal place
    const roundedScore = Math.round(gameState.score * 10) / 10;
    const roundedTotal = Math.round(totalPossible * 10) / 10;
    const percentage = Math.round((roundedScore / roundedTotal) * 100);

    // Create celebration effect
    createCelebration();

    // Don't display detailed results on results screen - only show reward message
    // All results are saved to localStorage and will be shown in progress.html

    // Get learning disorder assessment for saving
    const disorders = assessLearningDisorders();

    // Save game results automatically
    saveGameResults(roundedTotal, percentage, disorders, roundedScore);

    showScreen('results-screen');

    // Speak results if reading guide is active
    if (gameState.accessibility.readingGuide) {
        let resultsText = `Congratulations! You completed your learning adventure with a score of ${roundedScore} out of ${roundedTotal}. That's ${percentage} percent!`;

        if (disorders.length > 0) {
            resultsText += ` Based on your performance, you may benefit from additional support in ${disorders.length} area${disorders.length > 1 ? 's' : ''}. Please consult with an educational specialist for a comprehensive assessment.`;
        }

        speakText(resultsText, 0.7, 1);
    }
}

// Save game results to localStorage and database
function saveGameResults(totalPossible, percentage, disorders, roundedScore) {
    // Round all talent scores to 1 decimal
    const roundedTalentScores = {};
    for (const [key, value] of Object.entries(gameState.talentScores)) {
        roundedTalentScores[key] = Math.round(value * 10) / 10;
    }

    const gameResult = {
        id: Date.now(),
        date: new Date().toISOString(),
        playerName: gameState.playerName,
        ageGroup: gameState.ageGroup,
        score: roundedScore !== undefined ? roundedScore : Math.round(gameState.score * 10) / 10,
        totalPossible: totalPossible,
        percentage: percentage,
        talentScores: roundedTalentScores,
        disorders: disorders,
        challengesCompleted: gameState.challenges.length,
        totalTime: Date.now() - (gameState.startTime || Date.now()), // Calculate total time in ms
        accessibility: { ...gameState.accessibility }
    };

    // Get existing results or create new array
    const existingResults = JSON.parse(localStorage.getItem('gameResults') || '[]');

    // Add new result
    existingResults.push(gameResult);

    // Keep only last 50 results to prevent localStorage overflow
    if (existingResults.length > 50) {
        existingResults.splice(0, existingResults.length - 50);
    }

    // Save back to localStorage
    localStorage.setItem('gameResults', JSON.stringify(existingResults));

    console.log('Game results saved to localStorage:', gameResult);

    // Also save to database via API
    const isConsultantSession = localStorage.getItem('consultantSession') === 'true';
    const consultantStudentId = localStorage.getItem('consultantStudentId') || ''; // student's MongoDB _id
    // Clear flags immediately after reading
    localStorage.removeItem('consultantSession');
    localStorage.removeItem('consultantStudentId');

    const token = localStorage.getItem('token') || localStorage.getItem('studentToken');
    if (token) {
        // Choose the correct endpoint — consultant sessions go to the separate collection
        const endpoint = isConsultantSession
            ? '/api/progress/assessment-result'
            : '/api/progress/game-result';

        const apiPayload = {
            playerName: gameResult.playerName,
            ageGroup: gameResult.ageGroup,
            score: gameResult.score,
            totalPossible: gameResult.totalPossible,
            percentage: gameResult.percentage,
            challengesCompleted: gameResult.challengesCompleted,
            totalTime: gameResult.totalTime,
            talentScores: gameResult.talentScores,
            disorders: gameResult.disorders,
            // For consultant sessions use the student's MongoDB _id; otherwise the logged-in student's displayId
            studentId: isConsultantSession
                ? consultantStudentId
                : (localStorage.getItem('studentId') || '')
            // consultantId is omitted — the backend uses req.user.userId automatically
        };

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiPayload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log('Game results saved to database:', data.gameResult);
                } else {
                    console.warn('Failed to save to database:', data.message);
                }
            })
            .catch(err => {
                console.warn('Could not save to database (offline?):', err);
            });
    } else {
        console.log('No auth token found, skipping database save');
    }
}

// Get Talent Display Name
function getTalentDisplayName(talent) {
    const names = {
        creativity: '🎨 Creativity',
        logic: '🧩 Logic',
        memory: '🧠 Memory',
        observation: '🔍 Observation',
        problemSolving: '💡 Problem Solving',
        dyscalculia: '🔢 Dyscalculia Support',
        dysphasia: '🗣️ Dysphasia Support',
        dysgraphia: '✏️ Dysgraphia Support'
    };
    return names[talent] || talent;
}

// Restart Game
function restartGame() {
    if (confirm('Are you sure you want to restart your learning adventure?')) {
        gameState.currentChallenge = 0;
        gameState.score = 0;
        gameState.talentScores = {
            creativity: 0,
            logic: 0,
            memory: 0,
            observation: 0,
            problemSolving: 0,
            dyscalculia: 0,
            dysphasia: 0,
            dysgraphia: 0
        };

        // Reset disorder assessment
        gameState.disorderAssessment = {
            dyscalculiaScore: 0,
            dysphasiaScore: 0,
            dysgraphiaScore: 0,
            totalDyscalculiaChallenges: 0,
            totalDysphasiaChallenges: 0,
            totalDysgraphiaChallenges: 0
        };

        updateGameUI();
        displayChallenge();
    }
}

// Play Again
function playAgain() {
    gameState.currentChallenge = 0;
    gameState.score = 0;
    gameState.talentScores = {
        creativity: 0,
        logic: 0,
        memory: 0,
        observation: 0,
        problemSolving: 0,
        dyscalculia: 0,
        dysphasia: 0,
        dysgraphia: 0
    };

    // Reset disorder assessment
    gameState.disorderAssessment = {
        dyscalculiaScore: 0,
        dysphasiaScore: 0,
        dysgraphiaScore: 0,
        totalDyscalculiaChallenges: 0,
        totalDysphasiaChallenges: 0,
        totalDysgraphiaChallenges: 0
    };

    // Shuffle challenges again
    gameState.challenges = [...challengesByAge[gameState.ageGroup]].sort(() => Math.random() - 0.5);

    showScreen('game-screen');
    updateGameUI();
    displayChallenge();

    // Create celebration for new game
    createCelebration();
}

// Back to Welcome / Navigate to Level 2
function backToWelcome() {
    // Navigate to Level 2
    window.location.href = 'levels/level-2/index.html';
}

// Go Home
function goHome() {
    // Navigate to home/index
    window.location.href = '../consultant-dashboard.html';
}

// Add CSS for enhanced animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes confetti-fall {
        0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame); 