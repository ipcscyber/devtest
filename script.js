// Main Application Controller
class DexxterApplication {
    constructor() {
        this.currentSection = 1;
        this.currentQuestion = 1;
        this.totalQuestions = 18;
        this.skipsRemaining = 2;
        this.answers = {};
        this.timers = {
            session: new Timer('sessionTimer'),
            assessment: new Timer('assessmentTimer')
        };
        this.securityMonitor = new SecurityMonitor();
        this.scoringSystem = new ScoringSystem();
        
        this.init();
    }

    init() {
        this.timers.session.start();
        this.securityMonitor.startMonitoring();
        this.loadPersonalInfoSection();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Tab focus monitoring
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.securityMonitor.logSuspiciousActivity('TAB_SWITCH');
            }
        });

        // Copy-paste detection
        document.addEventListener('copy', (e) => {
            this.securityMonitor.logSuspiciousActivity('COPY_ACTION');
        });

        document.addEventListener('paste', (e) => {
            this.securityMonitor.logSuspiciousActivity('PASTE_ACTION');
        });
    }

    loadPersonalInfoSection() {
        this.showSection(1);
        this.updateProgress(33);
    }

    startTechnicalTest() {
        if (!this.validatePersonalInfo()) {
            this.showNotification('Please fill all required fields correctly.', 'error');
            return;
        }

        this.showSection(2);
        this.timers.assessment.start();
        this.updateProgress(66);
        this.loadQuestion(1);
    }

    loadQuestion(questionNumber) {
        this.currentQuestion = questionNumber;
        this.updateQuestionDisplay();
        this.updateProgress(66 + (questionNumber / this.totalQuestions) * 34);
    }

    updateQuestionDisplay() {
        const container = document.getElementById('questionsContainer');
        const question = QUESTIONS[this.currentQuestion - 1];
        
        container.innerHTML = `
            <div class="question-container">
                <div class="question-header">
                    <h3>Question ${this.currentQuestion}/${this.totalQuestions}</h3>
                    <div class="question-points">${question.points} points</div>
                </div>
                <div class="question-content">
                    <p><strong>${question.text}</strong></p>
                    
                    ${question.requiresText ? `
                    <div class="answer-section">
                        <label>Text Answer *</label>
                        <textarea class="text-answer" rows="6" 
                                  placeholder="Explain your answer here..."
                                  oninput="app.saveAnswer(${this.currentQuestion}, 'text', this.value)">${this.getAnswer(this.currentQuestion, 'text') || ''}</textarea>
                    </div>
                    ` : ''}
                    
                    ${question.requiresCode ? `
                    <div class="answer-section">
                        <label>Code Answer *</label>
                        <div class="code-editor-mini">
                            <textarea class="code-answer" rows="12" 
                                      placeholder="-- Write your code here"
                                      oninput="app.saveAnswer(${this.currentQuestion}, 'code', this.value)">${this.getAnswer(this.currentQuestion, 'code') || ''}</textarea>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        this.updateNavigation();
    }

    saveAnswer(questionId, type, value) {
        if (!this.answers[questionId]) {
            this.answers[questionId] = {};
        }
        this.answers[questionId][type] = value;
        
        // AI detection on text answers
        if (type === 'text') {
            this.securityMonitor.detectAIContent(value);
        }
    }

    getAnswer(questionId, type) {
        return this.answers[questionId]?.[type] || '';
    }

    nextQuestion() {
        if (this.currentQuestion < this.totalQuestions) {
            this.loadQuestion(this.currentQuestion + 1);
        } else {
            this.showSubmissionSection();
        }
    }

    previousQuestion() {
        if (this.currentQuestion > 1) {
            this.loadQuestion(this.currentQuestion - 1);
        }
    }

    skipQuestion() {
        if (this.skipsRemaining > 0) {
            this.skipsRemaining--;
            this.updateSkipCounter();
            this.nextQuestion();
            this.securityMonitor.logSuspiciousActivity('QUESTION_SKIPPED');
        } else {
            this.showNotification('No skips remaining', 'warning');
        }
    }

    updateSkipCounter() {
        const skipBtn = document.querySelector('.skip-counter');
        if (skipBtn) {
            skipBtn.textContent = `(${this.skipsRemaining})`;
        }
    }

    callAdmin() {
        this.securityMonitor.sendAdminAlert('HELP_REQUEST', {
            question: this.currentQuestion,
            time_elapsed: this.timers.assessment.getElapsedTime(),
            candidate: document.getElementById('robloxUsername').value
        });
        this.showNotification('Admin has been notified. Please wait for assistance.');
    }

    showSubmissionSection() {
        this.showSection(3);
        this.updateProgress(100);
        this.generateApplicationSummary();
    }

    generateApplicationSummary() {
        const summary = document.getElementById('applicationSummary');
        const personalInfo = this.getPersonalInfo();
        
        summary.innerHTML = `
            <div class="summary-item">
                <strong>Name:</strong> ${personalInfo.fullName}
            </div>
            <div class="summary-item">
                <strong>Roblox Username:</strong> ${personalInfo.robloxUsername}
            </div>
            <div class="summary-item">
                <strong>Questions Completed:</strong> ${Object.keys(this.answers).length}/${this.totalQuestions}
            </div>
            <div class="summary-item">
                <strong>Time Spent:</strong> ${this.timers.assessment.getElapsedTime()}
            </div>
        `;
    }

    submitApplication() {
        const finalScore = this.scoringSystem.calculateFinalScore(this.answers);
        const grade = this.scoringSystem.getFinalGrade(finalScore);
        
        this.securityMonitor.sendAdminAlert('APPLICATION_SUBMITTED', {
            candidate: this.getPersonalInfo(),
            score: finalScore,
            grade: grade,
            answers: this.answers
        });

        this.showNotification('Application submitted successfully! We will contact you soon.', 'success');
        
        // Disable further edits
        document.querySelectorAll('button').forEach(btn => btn.disabled = true);
    }

    showSection(sectionNumber) {
        document.querySelectorAll('.form-section').forEach(section => {
            section.classList.remove('active');
        });
        
        document.getElementById(['personalInfoSection', 'technicalTestSection', 'submissionSection'][sectionNumber - 1]).classList.add('active');
        
        // Update progress steps
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.toggle('active', index < sectionNumber);
        });
    }

    updateProgress(percentage) {
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('questionProgress').textContent = `${this.currentQuestion}/${this.totalQuestions}`;
    }

    validatePersonalInfo() {
        const required = ['fullName', 'robloxUsername', 'discordId', 'age', 'nationality', 'timezone', 'availability', 'experience', 'motivation'];
        return required.every(field => {
            const element = document.getElementById(field);
            return element && element.value.trim() !== '';
        });
    }

    getPersonalInfo() {
        const fields = ['fullName', 'robloxUsername', 'discordId', 'age', 'nationality', 'timezone', 'availability', 'experience', 'motivation', 'portfolio'];
        const info = {};
        fields.forEach(field => {
            const element = document.getElementById(field);
            info[field] = element ? element.value : '';
        });
        return info;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notificationMessage');
        
        messageEl.textContent = message;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
}

// Timer Class
class Timer {
    constructor(displayElementId) {
        this.displayElementId = displayElementId;
        this.startTime = null;
        this.interval = null;
    }

    start() {
        this.startTime = Date.now();
        this.interval = setInterval(() => {
            this.updateDisplay();
        }, 1000);
    }

    updateDisplay() {
        const element = document.getElementById(this.displayElementId);
        if (element) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;
            
            element.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    getElapsedTime() {
        if (!this.startTime) return '00:00:00';
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Security Monitor Class
class SecurityMonitor {
    constructor() {
        this.webhookUrl = 'https://discord.com/api/webhooks/1392061559202779186/6Bw4CMy4HLBoTygCfLKpImVfr0QgUODNHMY_10BTRklXVoaj91H5-2U4pDE8wdbgy1m1';
        this.suspiciousActivities = [];
    }

    startMonitoring() {
        this.monitorTypingPatterns();
        this.monitorFocus();
    }

    detectAIContent(text) {
        const aiPatterns = [
            /as an AI language model/i,
            /I am an AI assistant/i,
            /according to my knowledge/i,
            /based on the information/i,
            /I don't have personal opinions/i
        ];

        if (aiPatterns.some(pattern => pattern.test(text))) {
            this.logSuspiciousActivity('AI_CONTENT_DETECTED', { text: text.substring(0, 100) });
            return true;
        }
        return false;
    }

    monitorTypingPatterns() {
        let lastKeyTime = Date.now();
        const keyTimes = [];

        document.addEventListener('keydown', (e) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime;
            keyTimes.push(timeDiff);
            
            if (keyTimes.length > 10) {
                keyTimes.shift();
                const avgTime = keyTimes.reduce((a, b) => a + b) / keyTimes.length;
                
                // Detect unnatural typing patterns (too consistent or too fast)
                if (avgTime < 50 || this.isTooConsistent(keyTimes)) {
                    this.logSuspiciousActivity('UNNATURAL_TYPING_PATTERN');
                }
            }
            
            lastKeyTime = now;
        });
    }

    monitorFocus() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.logSuspiciousActivity('TAB_SWITCH_DETECTED');
            }
        });
    }

    isTooConsistent(times) {
        if (times.length < 2) return false;
        const variance = times.reduce((acc, time) => acc + Math.pow(time - times[0], 2), 0) / times.length;
        return variance < 100; // Very low variance indicates bot-like behavior
    }

    logSuspiciousActivity(type, data = {}) {
        this.suspiciousActivities.push({
            type,
            timestamp: new Date().toISOString(),
            data
        });

        // Send immediate alert for critical activities
        if (['AI_CONTENT_DETECTED', 'MULTIPLE_TAB_SWITCHES'].includes(type)) {
            this.sendAdminAlert('SUSPICIOUS_ACTIVITY', { type, data });
        }
    }

    sendAdminAlert(alertType, data) {
        const alertData = {
            type: alertType,
            timestamp: new Date().toISOString(),
            session_id: this.generateSessionId(),
            ...data
        };

        // Send to Discord webhook
        fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `🚨 **Dexxter Services Alert** - ${alertType}`,
                embeds: [{
                    title: 'Security Alert',
                    color: 0xff0000,
                    fields: [
                        {
                            name: 'Alert Type',
                            value: alertType,
                            inline: true
                        },
                        {
                            name: 'Candidate',
                            value: data.candidate || 'Unknown',
                            inline: true
                        },
                        {
                            name: 'Timestamp',
                            value: new Date().toLocaleString(),
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString()
                }]
            })
        }).catch(error => console.error('Error sending alert:', error));
    }

    generateSessionId() {
        return 'DXT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

// Scoring System Class
class ScoringSystem {
    constructor() {
        this.totalPoints = 100;
        this.questionWeights = QUESTIONS.reduce((acc, q, index) => {
            acc[index + 1] = q.points;
            return acc;
        }, {});
    }

    calculateFinalScore(answers) {
        let totalScore = 0;
        let maxPossible = 0;

        Object.keys(answers).forEach(questionId => {
            const question = QUESTIONS[questionId - 1];
            const answer = answers[questionId];
            const questionScore = this.evaluateAnswer(question, answer);
            
            totalScore += questionScore;
            maxPossible += question.points;
        });

        return Math.round((totalScore / maxPossible) * 100);
    }

    evaluateAnswer(question, answer) {
        let score = 0;

        // Evaluate text answer
        if (question.requiresText && answer.text) {
            score += this.evaluateTextAnswer(answer.text, question.points * 0.6);
        }

        // Evaluate code answer
        if (question.requiresCode && answer.code) {
            score += this.evaluateCodeAnswer(answer.code, question.points * 0.4);
        }

        return Math.min(question.points, score);
    }

    evaluateTextAnswer(text, maxPoints) {
        let score = 0;
        
        // Basic evaluation criteria
        if (text.length > 50) score += maxPoints * 0.3;
        if (text.length > 100) score += maxPoints * 0.3;
        if (this.containsTechnicalTerms(text)) score += maxPoints * 0.4;
        
        return score;
    }

    evaluateCodeAnswer(code, maxPoints) {
        let score = 0;
        
        // Basic code evaluation
        if (code.length > 10) score += maxPoints * 0.2;
        if (this.isValidLuaSyntax(code)) score += maxPoints * 0.4;
        if (this.containsAdvancedConcepts(code)) score += maxPoints * 0.4;
        
        return score;
    }

    containsTechnicalTerms(text) {
        const terms = ['metamethod', 'hook', 'exploit', 'remote', 'client', 'server', 'protection', 'bypass'];
        return terms.some(term => text.toLowerCase().includes(term));
    }

    isValidLuaSyntax(code) {
        // Basic Lua syntax check
        return code.includes('function') || code.includes('local') || code.includes('=');
    }

    containsAdvancedConcepts(code) {
        const concepts = ['hookmetamethod', 'getrawmetatable', 'newcclosure', 'checkcaller', 'protectgui'];
        return concepts.some(concept => code.includes(concept));
    }

    getFinalGrade(score) {
        if (score >= 90) return 'SENIOR DEVELOPER';
        if (score >= 75) return 'REGULAR DEVELOPER';
        if (score >= 60) return 'JUNIOR DEVELOPER';
        return 'NOT QUALIFIED';
    }
}

// Questions Data
const QUESTIONS = [
    {
        text: "What Roblox Lua metamethods have you hooked in your exploits? Can you give examples? (e.g., __index, __namecall, __newindex)",
        requiresText: true,
        requiresCode: true,
        points: 5
    },
    {
        text: "What is the purpose of protectgui() or similar functions in your scripts? How do you implement protection for your UI?",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "What is getgenv() and how is it used in Roblox exploiting?",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "What is the difference between hooking __index and hooking __namecall metamethods? When would you use each?",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "How do you prevent your hooks from being detected or removed by anti-cheat mechanisms?",
        requiresText: true,
        requiresCode: false,
        points: 6
    },
    {
        text: "Describe a scenario where hooking __namecall is essential for your exploit to work.",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "Explain how to hook a function to override Roblox API calls like FireServer or InvokeServer.",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "Can you explain what the difference between hookfunction and hookmetamethod is?",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "How do you use getrawmetatable and setreadonly when writing exploit scripts? (Explain why these functions are important for bypassing Roblox's protections)",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "How do you utilize getloadedmodules, getloadedscripts, or getupvalues to analyze or manipulate scripts running inside Roblox?",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "What methods do you use to access or modify server-sided values or remote events?",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "Have you ever used setreadonly combined with getrawmetatable to disable read-only protection? Explain how.",
        requiresText: true,
        requiresCode: true,
        points: 5
    },
    {
        text: "How do you use hookfunction or hookmetamethod to replace or modify the behavior of Roblox's built-in functions?",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "Show how to use getrawmetatable and setreadonly to modify the __index metamethod of the game object.",
        requiresText: true,
        requiresCode: true,
        points: 5
    },
    {
        text: "How would you bypass client-side checks that validate important values before sending them to the server?",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "What are some common pitfalls when hooking metamethods that can cause crashes or detection? How do you avoid them?",
        requiresText: true,
        requiresCode: true,
        points: 5
    },
    {
        text: "Write a snippet to hook the __namecall metamethod to block a call to Kick from the client-side.",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "If Roblox updates a game and patches the usual __namecall hook, what alternative approaches could you try?",
        requiresText: true,
        requiresCode: false,
        points: 5
    }
];

// Code Editor Functions
function openCodeEditor() {
    document.getElementById('codeEditorModal').style.display = 'block';
}

function closeCodeEditor() {
    document.getElementById('codeEditorModal').style.display = 'none';
}

function applyCode() {
    const code = document.getElementById('advancedEditor').value;
    // Apply code to current question's code answer
    closeCodeEditor();
}

function formatCode() {
    // Basic code formatting logic
    const editor = document.getElementById('advancedEditor');
    let code = editor.value;
    // Add basic formatting logic here
    editor.value = code;
}

// Initialize Application
const app = new DexxterApplication();

// Global functions for HTML onclick handlers
function startTechnicalTest() { app.startTechnicalTest(); }
function nextQuestion() { app.nextQuestion(); }
function previousQuestion() { app.previousQuestion(); }
function skipQuestion() { app.skipQuestion(); }
function callAdmin() { app.callAdmin(); }
function saveProgress() { app.showNotification('Progress saved successfully!'); }
function submitApplication() { app.submitApplication(); }
function reviewApplication() { app.showSection(2); }
