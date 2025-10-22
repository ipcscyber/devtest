// Main Application Controller
class DexxterApplication {
    constructor() {
        this.currentSection = 1;
        this.currentQuestion = 1;
        this.totalQuestions = 18;
        this.skipsRemaining = Infinity;
        this.answers = {};
        this.timers = {
            session: new Timer('sessionTimer'),
            assessment: new Timer('assessmentTimer')
        };
        this.securityMonitor = new SecurityMonitor();
        this.scoringSystem = new ScoringSystem();
        this.skippedQuestions = new Set();
        
        this.init();
    }

    init() {
        this.timers.session.start();
        this.securityMonitor.startMonitoring();
        this.showRulesSection();
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

        // Prevent going back
        window.addEventListener('popstate', (e) => {
            window.history.forward();
        });
    }

    showRulesSection() {
        this.showSection('rulesSection');
        document.getElementById('progressSection').style.display = 'none';
    }

    startApplication() {
        this.showSection('personalInfoSection');
        document.getElementById('progressSection').style.display = 'block';
        this.updateProgress(33);
    }

    loadPersonalInfoSection() {
        this.showSection('personalInfoSection');
        this.updateProgress(33);
    }

    startTechnicalTest() {
        if (!this.validatePersonalInfo()) {
            this.showNotification('Please fill all required fields correctly.', 'error');
            return;
        }

        this.showSection('technicalTestSection');
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
            this.securityMonitor.detectAIContent(value, questionId);
        }
    }

    getAnswer(questionId, type) {
        return this.answers[questionId]?.[type] || '';
    }

    nextQuestion() {
        if (this.currentQuestion < this.totalQuestions) {
            this.loadQuestion(this.currentQuestion + 1);
        } else {
            // Check if there are skipped questions
            const skipped = Array.from(this.skippedQuestions);
            if (skipped.length > 0) {
                this.loadQuestion(skipped[0]);
                this.skippedQuestions.delete(skipped[0]);
            } else {
                this.showSubmissionSection();
            }
        }
    }

    skipQuestion() {
        this.skippedQuestions.add(this.currentQuestion);
        this.showNotification('Question skipped. You can return to it later.');
        
        if (this.currentQuestion < this.totalQuestions) {
            this.loadQuestion(this.currentQuestion + 1);
        } else {
            // Go to first skipped question or finish
            const skipped = Array.from(this.skippedQuestions);
            if (skipped.length > 0) {
                this.loadQuestion(skipped[0]);
                this.skippedQuestions.delete(skipped[0]);
            } else {
                this.showSubmissionSection();
            }
        }
    }

    callAdmin() {
        this.securityMonitor.sendAdminAlert('HELP_REQUEST', {
            question: this.currentQuestion,
            time_elapsed: this.timers.assessment.getElapsedTime(),
            candidate: document.getElementById('robloxUsername').value,
            question_text: QUESTIONS[this.currentQuestion - 1].text.substring(0, 200)
        });
        this.showNotification('Assistance request sent. Please wait for support.');
    }

    showSubmissionSection() {
        this.showSection('submissionSection');
        this.updateProgress(100);
        this.generateApplicationSummary();
    }

    generateApplicationSummary() {
        const summary = document.getElementById('applicationSummary');
        const personalInfo = this.getPersonalInfo();
        const answeredQuestions = Object.keys(this.answers).length;
        
        summary.innerHTML = `
            <div class="summary-item">
                <strong>Name:</strong> ${personalInfo.fullName}
            </div>
            <div class="summary-item">
                <strong>Roblox Username:</strong> ${personalInfo.robloxUsername}
            </div>
            <div class="summary-item">
                <strong>Questions Completed:</strong> ${answeredQuestions}/${this.totalQuestions}
            </div>
            <div class="summary-item">
                <strong>Time Spent:</strong> ${this.timers.assessment.getElapsedTime()}
            </div>
            <div class="summary-item">
                <strong>Skipped Questions:</strong> ${this.skippedQuestions.size}
            </div>
        `;
    }

    async submitApplication() {
        const finalScore = this.scoringSystem.calculateFinalScore(this.answers);
        const grade = this.scoringSystem.getFinalGrade(finalScore);
        const personalInfo = this.getPersonalInfo();
        
        // Create application file
        const applicationData = this.createApplicationFile(personalInfo, finalScore, grade);
        
        // Send to Discord
        await this.securityMonitor.sendApplicationSubmission(applicationData, personalInfo, finalScore, grade);
        
        this.showNotification('Application submitted successfully! We will review your submission and contact you soon.', 'success');
        
        // Disable further edits
        document.querySelectorAll('button').forEach(btn => btn.disabled = true);
    }

    createApplicationFile(personalInfo, score, grade) {
        let fileContent = `Dexxter Services - Developer Application\n`;
        fileContent += `Submission Date: ${new Date().toLocaleString()}\n`;
        fileContent += `============================================\n\n`;
        
        fileContent += `PERSONAL INFORMATION:\n`;
        fileContent += `Full Name: ${personalInfo.fullName}\n`;
        fileContent += `Roblox Username: ${personalInfo.robloxUsername}\n`;
        fileContent += `Discord ID: ${personalInfo.discordId}\n`;
        fileContent += `Age: ${personalInfo.age}\n`;
        fileContent += `Nationality: ${personalInfo.nationality}\n`;
        fileContent += `Timezone: ${personalInfo.timezone}\n`;
        fileContent += `Availability: ${personalInfo.availability} hours/week\n`;
        fileContent += `Experience: ${personalInfo.experience} years\n`;
        fileContent += `Portfolio: ${personalInfo.portfolio || 'Not provided'}\n\n`;
        fileContent += `Motivation:\n${personalInfo.motivation}\n\n`;
        
        fileContent += `TECHNICAL ASSESSMENT RESULTS:\n`;
        fileContent += `Final Score: ${score}/100\n`;
        fileContent += `Grade: ${grade}\n`;
        fileContent += `Time Spent: ${this.timers.assessment.getElapsedTime()}\n`;
        fileContent += `Questions Answered: ${Object.keys(this.answers).length}/${this.totalQuestions}\n\n`;
        
        fileContent += `ANSWERS:\n`;
        fileContent += `============================================\n\n`;
        
        QUESTIONS.forEach((question, index) => {
            const answer = this.answers[index + 1];
            fileContent += `QUESTION ${index + 1}/${this.totalQuestions} (${question.points} points):\n`;
            fileContent += `${question.text}\n\n`;
            
            if (answer?.text) {
                fileContent += `TEXT ANSWER:\n${answer.text}\n\n`;
            }
            
            if (answer?.code) {
                fileContent += `CODE ANSWER:\n${answer.code}\n\n`;
            }
            
            if (!answer) {
                fileContent += `STATUS: Not answered\n\n`;
            }
            
            fileContent += `--------------------------------------------\n\n`;
        });
        
        fileContent += `SESSION DATA:\n`;
        fileContent += `Session ID: ${this.securityMonitor.sessionId}\n`;
        fileContent += `Start Time: ${new Date(this.timers.assessment.startTime).toLocaleString()}\n`;
        fileContent += `End Time: ${new Date().toLocaleString()}\n`;
        fileContent += `Suspicious Activities: ${this.securityMonitor.suspiciousActivities.length}\n`;
        
        return fileContent;
    }

    showSection(sectionId) {
        document.querySelectorAll('.form-section').forEach(section => {
            section.classList.remove('active');
        });
        
        document.getElementById(sectionId).classList.add('active');
        
        // Update progress steps for non-rules sections
        if (sectionId !== 'rulesSection') {
            const stepNumber = 
                sectionId === 'personalInfoSection' ? 1 :
                sectionId === 'technicalTestSection' ? 2 : 3;
                
            document.querySelectorAll('.step').forEach((step, index) => {
                step.classList.toggle('active', index < stepNumber);
            });
        }
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
        
        // Style based on type
        notification.style.borderLeftColor = 
            type === 'error' ? 'var(--error-red)' :
            type === 'success' ? 'var(--success-green)' :
            type === 'warning' ? 'var(--warning-orange)' : 'var(--primary-blue)';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }

    updateNavigation() {
        // No need for previous button anymore
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
        this.sessionId = this.generateSessionId();
    }

    startMonitoring() {
        this.monitorTypingPatterns();
        this.monitorFocus();
    }

    detectAIContent(text, questionId) {
        const aiPatterns = [
            /as an AI language model/i,
            /I am an AI assistant/i,
            /according to my knowledge/i,
            /based on the information/i,
            /I don't have personal opinions/i,
            /as a large language model/i,
            /I am designed to/i,
            /my purpose is to/i,
            /I cannot provide/i,
            /I do not have the ability/i
        ];

        if (aiPatterns.some(pattern => pattern.test(text))) {
            this.logSuspiciousActivity('AI_CONTENT_DETECTED', { 
                text: text.substring(0, 200),
                questionId: questionId
            });
            this.sendAdminAlert('AI_DETECTION', {
                question: questionId,
                excerpt: text.substring(0, 200),
                session_id: this.sessionId
            });
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
        let tabSwitchCount = 0;
        let lastSwitchTime = 0;

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                tabSwitchCount++;
                const now = Date.now();
                
                if (now - lastSwitchTime < 5000) { // Multiple quick switches
                    this.logSuspiciousActivity('MULTIPLE_TAB_SWITCHES', { count: tabSwitchCount });
                }
                
                lastSwitchTime = now;
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
    }

    sendAdminAlert(alertType, data) {
        const alertData = {
            type: alertType,
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            ...data
        };

        let embedColor;
        let title;

        switch (alertType) {
            case 'HELP_REQUEST':
                embedColor = 0x0099ff;
                title = '🆗 Assistance Request';
                break;
            case 'AI_DETECTION':
                embedColor = 0xff0000;
                title = '🚨 AI Content Detected';
                break;
            case 'APPLICATION_SUBMITTED':
                embedColor = 0x00ff00;
                title = '✅ Application Submitted';
                break;
            default:
                embedColor = 0xffff00;
                title = '⚠️ Security Alert';
        }

        const embed = {
            title: title,
            color: embedColor,
            fields: [],
            timestamp: new Date().toISOString(),
            footer: { text: `Session: ${this.sessionId}` }
        };

        // Add fields based on alert type
        if (data.candidate) {
            embed.fields.push({
                name: 'Candidate',
                value: `**Username:** ${data.candidate.robloxUsername || 'Unknown'}\n**Discord:** ${data.candidate.discordId || 'Unknown'}`,
                inline: false
            });
        }

        if (data.question) {
            embed.fields.push({
                name: 'Question',
                value: `#${data.question}`,
                inline: true
            });
        }

        if (data.time_elapsed) {
            embed.fields.push({
                name: 'Time Elapsed',
                value: data.time_elapsed,
                inline: true
            });
        }

        if (data.score) {
            embed.fields.push({
                name: 'Results',
                value: `**Score:** ${data.score}/100\n**Grade:** ${data.grade}`,
                inline: false
            });
        }

        if (data.excerpt) {
            embed.fields.push({
                name: 'Content Excerpt',
                value: `\`\`\`${data.excerpt}\`\`\``,
                inline: false
            });
        }

        fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ embeds: [embed] })
        }).catch(error => console.error('Error sending alert:', error));
    }

    async sendApplicationSubmission(applicationData, personalInfo, score, grade) {
        // Create a Blob with the application data
        const blob = new Blob([applicationData], { type: 'text/plain' });
        const file = new File([blob], `application_${personalInfo.robloxUsername}_${this.sessionId}.txt`, { type: 'text/plain' });

        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', file);

        // First, send the main application alert
        this.sendAdminAlert('APPLICATION_SUBMITTED', {
            candidate: personalInfo,
            score: score,
            grade: grade,
            time_elapsed: app.timers.assessment.getElapsedTime(),
            questions_answered: Object.keys(app.answers).length,
            suspicious_activities: this.suspiciousActivities.length
        });

        // Then send the file (you might need a different webhook or method for files)
        // For now, we'll just log it since Discord webhooks don't support file uploads directly
        console.log('Application file content:', applicationData);
        
        // You would typically send this to a server endpoint that can handle file uploads
        // For demonstration, we'll create a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dexxter_Application_${personalInfo.robloxUsername}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateSessionId() {
        return 'DXT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
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
        const terms = ['metamethod', 'hook', 'exploit', 'remote', 'client', 'server', 'protection', 'bypass', 'luau', 'script', 'roblox'];
        return terms.some(term => text.toLowerCase().includes(term));
    }

    isValidLuaSyntax(code) {
        // Basic Lua syntax check
        return code.includes('function') || code.includes('local') || code.includes('=') || code.includes('--');
    }

    containsAdvancedConcepts(code) {
        const concepts = ['hookmetamethod', 'getrawmetatable', 'newcclosure', 'checkcaller', 'protectgui', '__namecall', '__index', 'getgenv'];
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

// Global functions for HTML onclick handlers
function toggleStartButton() {
    const agreeCheckbox = document.getElementById('agreeRules');
    const startButton = document.getElementById('startApplicationBtn');
    startButton.disabled = !agreeCheckbox.checked;
}

function startApplication() {
    app.startApplication();
}

function startTechnicalTest() { app.startTechnicalTest(); }
function nextQuestion() { app.nextQuestion(); }
function skipQuestion() { app.skipQuestion(); }
function callAdmin() { app.callAdmin(); }
function saveProgress() { app.showNotification('Progress saved successfully!'); }
function submitApplication() { app.submitApplication(); }

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
    const currentCodeAnswer = document.querySelector('.code-answer');
    if (currentCodeAnswer) {
        currentCodeAnswer.value = code;
        app.saveAnswer(app.currentQuestion, 'code', code);
    }
    closeCodeEditor();
}

function formatCode() {
    // Basic code formatting logic
    const editor = document.getElementById('advancedEditor');
    let code = editor.value;
    // Add basic formatting logic here
    editor.value = code;
}

function changeTheme(theme) {
    const editor = document.getElementById('advancedEditor');
    editor.className = theme + '-theme';
}

// Initialize Application
const app = new DexxterApplication();

// Prevent going back in browser history
history.pushState(null, null, location.href);
window.onpopstate = function(event) {
    history.go(1);
};
