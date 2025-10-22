// Professional Dexxter Services Recruitment Platform
class DexxterApplication {
    constructor() {
        this.currentSection = 1;
        this.currentQuestion = 1;
        this.totalQuestions = 25;
        this.skipsRemaining = 5;
        this.answers = {};
        this.skippedQuestions = new Set();
        this.completedQuestions = new Set();
        this.timers = {
            session: new Timer('sessionTimer'),
            assessment: new Timer('assessmentTimer')
        };
        this.securityMonitor = new SecurityMonitor();
        this.scoringSystem = new ScoringSystem();
        this.isSubmitting = false;
        
        this.init();
    }

    init() {
        this.hideLoadingScreen();
        this.timers.session.start();
        this.securityMonitor.startMonitoring();
        this.showRulesSection();
        this.setupEventListeners();
        this.setupAutoSave();
    }

    hideLoadingScreen() {
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 2000);
    }

    setupEventListeners() {
        // Prevent navigation
        window.addEventListener('beforeunload', (e) => {
            if (this.currentSection > 1 && !this.isSubmitting) {
                e.preventDefault();
                e.returnValue = '';
                return 'Your progress will be lost if you leave this page.';
            }
        });

        // Tab focus monitoring
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.securityMonitor.logSuspiciousActivity('TAB_SWITCH');
                this.showNotification('Warning: Tab switching detected', 'warning');
            }
        });

        // Copy-paste detection
        document.addEventListener('copy', (e) => {
            this.securityMonitor.logSuspiciousActivity('COPY_ACTION');
        });

        document.addEventListener('paste', (e) => {
            this.securityMonitor.logSuspiciousActivity('PASTE_ACTION');
            this.showNotification('Paste action detected - ensure original work', 'warning');
        });

        // Prevent right-click
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showNotification('Right-click disabled for assessment integrity', 'warning');
        });

        // Keyboard shortcuts prevention
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
                this.securityMonitor.logSuspiciousActivity('KEYBOARD_SHORTCUT', { key: e.key });
            }
        });
    }

    setupAutoSave() {
        setInterval(() => {
            if (this.currentSection === 2) {
                this.saveProgress(true);
            }
        }, 30000); // Auto-save every 30 seconds
    }

    showRulesSection() {
        this.showSection('rulesSection');
        document.getElementById('progressSection').style.display = 'none';
    }

    startApplication() {
        this.showSection('personalInfoSection');
        document.getElementById('progressSection').style.display = 'block';
        this.updateProgress(10);
    }

    validateAndStartTechnicalTest() {
        if (!this.validatePersonalInfo()) {
            this.showNotification('Please complete all required fields with valid information.', 'error');
            return;
        }

        this.showConfirmation(
            'Start Technical Assessment',
            'You are about to begin the technical assessment. Once started, you cannot return to previous questions. Are you ready to proceed?',
            () => {
                this.startTechnicalTest();
            }
        );
    }

    startTechnicalTest() {
        this.showSection('technicalTestSection');
        this.timers.assessment.start();
        this.updateProgress(25);
        this.loadQuestion(1);
        
        this.securityMonitor.sendAdminAlert('ASSESSMENT_STARTED', {
            candidate: this.getPersonalInfo(),
            start_time: new Date().toISOString()
        });
    }

    loadQuestion(questionNumber) {
        this.currentQuestion = questionNumber;
        this.updateQuestionDisplay();
        this.updateProgress(25 + (this.completedQuestions.size / this.totalQuestions) * 65);
        
        // Update navigation button text for last question
        const nextButton = document.getElementById('nextButton');
        if (nextButton) {
            if (questionNumber === this.totalQuestions && this.skippedQuestions.size === 0) {
                nextButton.querySelector('.btn-content').innerHTML = 'Complete Assessment <i class="fas fa-flag-checkered"></i>';
            } else {
                nextButton.querySelector('.btn-content').innerHTML = 'Next Question <i class="fas fa-arrow-right"></i>';
            }
        }
    }

    updateQuestionDisplay() {
        const container = document.getElementById('questionsContainer');
        const question = QUESTIONS[this.currentQuestion - 1];
        
        const isSkipped = this.skippedQuestions.has(this.currentQuestion);
        const isCompleted = this.completedQuestions.has(this.currentQuestion);
        
        container.innerHTML = `
            <div class="question-container">
                <div class="question-header">
                    <h3>Question ${this.currentQuestion}/${this.totalQuestions}</h3>
                    <div class="question-points">${question.points} points</div>
                </div>
                <div class="question-content">
                    <p>${question.text}</p>
                    
                    ${question.requiresText ? `
                    <div class="answer-section">
                        <label>Text Answer ${question.requiresText ? '*' : ''}</label>
                        <textarea class="text-answer" rows="6" 
                                  placeholder="Provide a detailed explanation of your approach, methodology, and understanding..."
                                  oninput="app.saveAnswer(${this.currentQuestion}, 'text', this.value)">${this.getAnswer(this.currentQuestion, 'text') || ''}</textarea>
                        <div class="form-hint">Be specific and technical in your response</div>
                    </div>
                    ` : ''}
                    
                    ${question.requiresCode ? `
                    <div class="answer-section">
                        <label>Code Implementation ${question.requiresCode ? '*' : ''}</label>
                        <div class="code-editor-mini">
                            <textarea class="code-answer" rows="12" 
                                      placeholder="-- Implement your solution here
-- Focus on efficiency, security, and best practices"
                                      oninput="app.saveAnswer(${this.currentQuestion}, 'code', this.value)">${this.getAnswer(this.currentQuestion, 'code') || ''}</textarea>
                        </div>
                        <div class="form-hint">Write clean, commented, and efficient Lua code</div>
                    </div>
                    ` : ''}
                </div>
                ${isSkipped ? `
                <div class="question-status">
                    <i class="fas fa-forward"></i>
                    <span>This question has been skipped and will be available later</span>
                </div>
                ` : ''}
                ${isCompleted ? `
                <div class="question-status completed">
                    <i class="fas fa-check-circle"></i>
                    <span>This question has been completed</span>
                </div>
                ` : ''}
            </div>
        `;

        this.updateNavigation();
    }

    saveAnswer(questionId, type, value) {
        if (!this.answers[questionId]) {
            this.answers[questionId] = {};
        }
        this.answers[questionId][type] = value;
        this.completedQuestions.add(questionId);
        
        // Remove from skipped if now answered
        if (this.skippedQuestions.has(questionId)) {
            this.skippedQuestions.delete(questionId);
        }
        
        // AI detection on text answers
        if (type === 'text' && value.length > 50) {
            this.securityMonitor.detectAIContent(value, questionId);
        }
        
        this.updateProgress(25 + (this.completedQuestions.size / this.totalQuestions) * 65);
    }

    getAnswer(questionId, type) {
        return this.answers[questionId]?.[type] || '';
    }

    nextQuestion() {
        // Validate current question if required
        const currentQuestion = QUESTIONS[this.currentQuestion - 1];
        const currentAnswer = this.answers[this.currentQuestion];
        
        if (currentQuestion.requiresText && (!currentAnswer?.text || currentAnswer.text.trim().length < 10)) {
            this.showNotification('Please provide a more detailed text answer before proceeding.', 'warning');
            return;
        }
        
        if (currentQuestion.requiresCode && (!currentAnswer?.code || currentAnswer.code.trim().length < 5)) {
            this.showNotification('Please complete the code implementation before proceeding.', 'warning');
            return;
        }

        if (this.currentQuestion < this.totalQuestions) {
            this.loadQuestion(this.currentQuestion + 1);
        } else {
            this.finishAssessment();
        }
    }

    skipQuestion() {
        if (this.skipsRemaining <= 0) {
            this.showNotification('No skip credits remaining. Please answer the current question.', 'error');
            return;
        }

        this.showConfirmation(
            'Skip Question',
            `You have ${this.skipsRemaining} skip credits remaining. Skip this question and return to it later?`,
            () => {
                this.skippedQuestions.add(this.currentQuestion);
                this.skipsRemaining--;
                this.updateSkipCounter();
                
                this.showNotification(`Question skipped. ${this.skipsRemaining} skip credits remaining.`, 'info');
                
                if (this.currentQuestion < this.totalQuestions) {
                    this.loadQuestion(this.currentQuestion + 1);
                } else {
                    this.finishAssessment();
                }
            }
        );
    }

    finishAssessment() {
        if (this.skippedQuestions.size > 0) {
            // Go to first skipped question
            const skipped = Array.from(this.skippedQuestions);
            this.loadQuestion(skipped[0]);
            this.skippedQuestions.delete(skipped[0]);
            this.showNotification(`Returning to skipped question ${skipped[0]}`, 'info');
        } else {
            this.showSubmissionSection();
        }
    }

    updateSkipCounter() {
        const skipCounter = document.getElementById('skipCounter');
        const skipStats = document.getElementById('skipStats');
        if (skipCounter) skipCounter.textContent = this.skipsRemaining;
        if (skipStats) skipStats.textContent = this.skipsRemaining;
        
        const skipButton = document.getElementById('skipButton');
        if (skipButton) {
            if (this.skipsRemaining <= 0) {
                skipButton.disabled = true;
                skipButton.style.opacity = '0.6';
            }
        }
    }

    callAdmin() {
        const currentQuestion = QUESTIONS[this.currentQuestion - 1];
        this.securityMonitor.sendAdminAlert('SUPPORT_REQUEST', {
            question: this.currentQuestion,
            question_text: currentQuestion.text.substring(0, 200),
            time_elapsed: this.timers.assessment.getElapsedTime(),
            candidate: document.getElementById('robloxUsername').value,
            skips_remaining: this.skipsRemaining
        });
        
        this.showNotification('Support request sent. Our team will assist you shortly.', 'info');
    }

    saveProgress(silent = false) {
        const progress = {
            currentQuestion: this.currentQuestion,
            answers: this.answers,
            skipsRemaining: this.skipsRemaining,
            skippedQuestions: Array.from(this.skippedQuestions),
            completedQuestions: Array.from(this.completedQuestions),
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('dexxter_application_progress', JSON.stringify(progress));
        
        if (!silent) {
            this.showNotification('Progress saved successfully', 'success');
        }
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('dexxter_application_progress');
            if (saved) {
                const progress = JSON.parse(saved);
                this.answers = progress.answers || {};
                this.skipsRemaining = progress.skipsRemaining || 5;
                this.skippedQuestions = new Set(progress.skippedQuestions || []);
                this.completedQuestions = new Set(progress.completedQuestions || []);
                
                // Update UI
                this.updateSkipCounter();
                this.updateProgress(25 + (this.completedQuestions.size / this.totalQuestions) * 65);
                
                return true;
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
        return false;
    }

    showSubmissionSection() {
        this.showSection('submissionSection');
        this.updateProgress(100);
        this.generateApplicationSummary();
        
        // Celebrate completion
        this.celebrateCompletion();
        
        this.securityMonitor.sendAdminAlert('ASSESSMENT_COMPLETED', {
            candidate: this.getPersonalInfo(),
            time_elapsed: this.timers.assessment.getElapsedTime(),
            questions_answered: this.completedQuestions.size,
            skips_used: 5 - this.skipsRemaining
        });
    }

    celebrateCompletion() {
        // Add celebration effects
        const container = document.querySelector('.submission-container');
        container.style.animation = 'pulse 2s ease-in-out';
        
        setTimeout(() => {
            container.style.animation = '';
        }, 2000);
    }

    generateApplicationSummary() {
        const summary = document.getElementById('applicationSummary');
        const personalInfo = this.getPersonalInfo();
        const completionRate = Math.round((this.completedQuestions.size / this.totalQuestions) * 100);
        
        document.getElementById('completionRate').textContent = completionRate + '%';
        document.getElementById('timeSpent').textContent = this.timers.assessment.getElapsedTime();
        document.getElementById('skipsUsed').textContent = (5 - this.skipsRemaining);
        
        summary.innerHTML = `
            <div class="summary-detail">
                <strong>Name:</strong> ${personalInfo.fullName}
            </div>
            <div class="summary-detail">
                <strong>Roblox Username:</strong> ${personalInfo.robloxUsername}
            </div>
            <div class="summary-detail">
                <strong>Discord ID:</strong> ${personalInfo.discordId}
            </div>
            <div class="summary-detail">
                <strong>Experience Level:</strong> ${this.getExperienceLabel(personalInfo.experience)}
            </div>
            <div class="summary-detail">
                <strong>Availability:</strong> ${personalInfo.availability} hours/week
            </div>
        `;
    }

    getExperienceLabel(experience) {
        const labels = {
            '0-1': 'Beginner (0-1 year)',
            '1-2': 'Intermediate (1-2 years)',
            '2-3': 'Advanced (2-3 years)',
            '3-5': 'Expert (3-5 years)',
            '5+': 'Senior (5+ years)'
        };
        return labels[experience] || experience;
    }

    async submitApplication() {
        if (this.isSubmitting) return;
        
        this.isSubmitting = true;
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        
        try {
            const personalInfo = this.getPersonalInfo();
            const finalScore = this.scoringSystem.calculateFinalScore(this.answers);
            const grade = this.scoringSystem.getFinalGrade(finalScore);
            
            // Create comprehensive application file
            const applicationData = this.createApplicationFile(personalInfo, finalScore, grade);
            
            // Send to Discord
            await this.securityMonitor.sendApplicationSubmission(applicationData, personalInfo, finalScore, grade);
            
            // Clear local storage
            localStorage.removeItem('dexxter_application_progress');
            
            this.showNotification('🎉 Application submitted successfully! Our team will review your submission and contact you soon.', 'success');
            
            // Update UI for submitted state
            submitButton.innerHTML = '<i class="fas fa-check"></i> Application Submitted';
            submitButton.style.background = 'var(--success)';
            
            // Disable all interactions
            document.querySelectorAll('button').forEach(btn => {
                if (btn !== submitButton) btn.disabled = true;
            });
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showNotification('Submission failed. Please try again or contact support.', 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Final Application';
        } finally {
            this.isSubmitting = false;
        }
    }

    createApplicationFile(personalInfo, score, grade) {
        let fileContent = `╔══════════════════════════════════════════════════╗\n`;
        fileContent += `║            DEXTTER SERVICES APPLICATION           ║\n`;
        fileContent += `║            Developer Recruitment Platform         ║\n`;
        fileContent += `╚══════════════════════════════════════════════════╝\n\n`;
        
        fileContent += `APPLICATION SUBMISSION\n`;
        fileContent += `Submission Date: ${new Date().toLocaleString()}\n`;
        fileContent += `Assessment ID: ${this.securityMonitor.sessionId}\n`;
        fileContent += `══════════════════════════════════════════════════════\n\n`;
        
        fileContent += `CANDIDATE PROFILE:\n`;
        fileContent += `──────────────────────────────────────────────────────\n`;
        fileContent += `Full Name: ${personalInfo.fullName}\n`;
        fileContent += `Roblox Username: ${personalInfo.robloxUsername}\n`;
        fileContent += `Discord ID: ${personalInfo.discordId}\n`;
        fileContent += `Age: ${personalInfo.age}\n`;
        fileContent += `Nationality: ${personalInfo.nationality}\n`;
        fileContent += `Timezone: ${personalInfo.timezone}\n`;
        fileContent += `Weekly Availability: ${personalInfo.availability} hours\n`;
        fileContent += `Experience Level: ${this.getExperienceLabel(personalInfo.experience)}\n`;
        fileContent += `Portfolio: ${personalInfo.portfolio || 'Not provided'}\n\n`;
        
        fileContent += `PROFESSIONAL MOTIVATION:\n`;
        fileContent += `──────────────────────────────────────────────────────\n`;
        fileContent += `${personalInfo.motivation}\n\n`;
        
        fileContent += `ASSESSMENT RESULTS:\n`;
        fileContent += `──────────────────────────────────────────────────────\n`;
        fileContent += `Final Score: ${score}/100\n`;
        fileContent += `Grade: ${grade}\n`;
        fileContent += `Time Spent: ${this.timers.assessment.getElapsedTime()}\n`;
        fileContent += `Questions Completed: ${this.completedQuestions.size}/${this.totalQuestions}\n`;
        fileContent += `Skip Credits Used: ${5 - this.skipsRemaining}\n`;
        fileContent += `Completion Rate: ${Math.round((this.completedQuestions.size / this.totalQuestions) * 100)}%\n\n`;
        
        fileContent += `TECHNICAL ASSESSMENT ANSWERS:\n`;
        fileContent += `══════════════════════════════════════════════════════\n\n`;
        
        QUESTIONS.forEach((question, index) => {
            const questionNumber = index + 1;
            const answer = this.answers[questionNumber];
            
            fileContent += `QUESTION ${questionNumber}/${this.totalQuestions} [${question.points} points]\n`;
            fileContent += `${'─'.repeat(60)}\n`;
            fileContent += `${question.text}\n\n`;
            
            if (answer?.text) {
                fileContent += `TEXT ANSWER:\n`;
                fileContent += `${'─'.repeat(20)}\n`;
                fileContent += `${answer.text}\n\n`;
            } else {
                fileContent += `TEXT ANSWER: Not provided\n\n`;
            }
            
            if (answer?.code) {
                fileContent += `CODE IMPLEMENTATION:\n`;
                fileContent += `${'─'.repeat(25)}\n`;
                fileContent += `${answer.code}\n\n`;
            } else if (question.requiresCode) {
                fileContent += `CODE IMPLEMENTATION: Not provided\n\n`;
            }
            
            if (!answer) {
                fileContent += `STATUS: Not attempted\n\n`;
            } else if (this.skippedQuestions.has(questionNumber)) {
                fileContent += `STATUS: Skipped\n\n`;
            } else {
                fileContent += `STATUS: Completed\n\n`;
            }
            
            fileContent += `${'═'.repeat(60)}\n\n`;
        });
        
        fileContent += `SESSION INTEGRITY REPORT:\n`;
        fileContent += `──────────────────────────────────────────────────────\n`;
        fileContent += `Session ID: ${this.securityMonitor.sessionId}\n`;
        fileContent += `Start Time: ${new Date(this.timers.assessment.startTime).toLocaleString()}\n`;
        fileContent += `End Time: ${new Date().toLocaleString()}\n`;
        fileContent += `Suspicious Activities: ${this.securityMonitor.suspiciousActivities.length}\n`;
        fileContent += `AI Detection Flags: ${this.securityMonitor.aiFlags}\n`;
        fileContent += `Tab Switch Events: ${this.securityMonitor.tabSwitches}\n\n`;
        
        fileContent += `╔══════════════════════════════════════════════════╗\n`;
        fileContent += `║                 END OF APPLICATION               ║\n`;
        fileContent += `╚══════════════════════════════════════════════════╝\n`;
        
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
        }
    }

    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressPercentage = document.getElementById('progressPercentage');
        const completedStats = document.getElementById('completedStats');
        
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
        if (completedStats) completedStats.textContent = this.completedQuestions.size;
        
        // Update time stats
        const timeStats = document.getElementById('timeStats');
        if (timeStats) timeStats.textContent = this.timers.assessment.getElapsedTime();
    }

    validatePersonalInfo() {
        const required = ['fullName', 'robloxUsername', 'discordId', 'age', 'nationality', 'timezone', 'availability', 'experience', 'motivation'];
        
        for (const field of required) {
            const element = document.getElementById(field);
            if (!element || element.value.trim() === '') {
                return false;
            }
        }
        
        // Validate age
        const age = parseInt(document.getElementById('age').value);
        if (age < 16 || age > 99) {
            return false;
        }
        
        // Validate motivation length
        const motivation = document.getElementById('motivation').value;
        if (motivation.trim().length < 50) {
            return false;
        }
        
        return true;
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
        
        if (!notification || !messageEl) return;
        
        messageEl.textContent = message;
        
        // Set notification color based on type
        const colors = {
            success: 'var(--success)',
            error: 'var(--error)',
            warning: 'var(--warning)',
            info: 'var(--primary-blue)'
        };
        
        notification.style.borderLeftColor = colors[type] || colors.info;
        notification.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }

    showConfirmation(title, message, confirmCallback) {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');
        
        if (!modal || !messageEl) return;
        
        // Set modal content
        modal.querySelector('h3').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
        messageEl.textContent = message;
        
        // Store callback
        this.confirmCallback = confirmCallback;
        
        // Show modal
        modal.style.display = 'block';
    }

    updateNavigation() {
        // No need for previous button - forward navigation only
    }
}

// Timer Class with enhanced functionality
class Timer {
    constructor(displayElementId) {
        this.displayElementId = displayElementId;
        this.startTime = null;
        this.interval = null;
        this.elapsedTime = 0;
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
            this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
            const hours = Math.floor(this.elapsedTime / 3600);
            const minutes = Math.floor((this.elapsedTime % 3600) / 60);
            const seconds = this.elapsedTime % 60;
            
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

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

// Enhanced Security Monitor
class SecurityMonitor {
    constructor() {
        this.webhookUrl = 'https://discord.com/api/webhooks/1392061559202779186/6Bw4CMy4HLBoTygCfLKpImVfr0QgUODNHMY_10BTRklXVoaj91H5-2U4pDE8wdbgy1m1';
        this.suspiciousActivities = [];
        this.sessionId = this.generateSessionId();
        this.aiFlags = 0;
        this.tabSwitches = 0;
    }

    startMonitoring() {
        this.monitorTypingPatterns();
        this.monitorFocus();
        this.monitorNetworkActivity();
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
            /I do not have the ability/i,
            /my programming/i,
            /my algorithms/i,
            /as an AI, I/i,
            /I'm sorry, I cannot/i,
            /I'm not capable of/i
        ];

        const aiDetected = aiPatterns.some(pattern => pattern.test(text));
        
        if (aiDetected) {
            this.aiFlags++;
            this.logSuspiciousActivity('AI_CONTENT_DETECTED', { 
                text: text.substring(0, 200),
                questionId: questionId,
                flags: this.aiFlags
            });
            
            if (this.aiFlags >= 3) {
                this.sendAdminAlert('AI_DETECTION_CRITICAL', {
                    question: questionId,
                    excerpt: text.substring(0, 200),
                    total_flags: this.aiFlags,
                    session_id: this.sessionId
                });
            } else if (this.aiFlags === 1) {
                this.sendAdminAlert('AI_DETECTION_WARNING', {
                    question: questionId,
                    excerpt: text.substring(0, 200),
                    session_id: this.sessionId
                });
            }
            
            return true;
        }
        return false;
    }

    monitorTypingPatterns() {
        let lastKeyTime = Date.now();
        const keyTimes = [];
        let consistencyScore = 0;

        document.addEventListener('keydown', (e) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime;
            keyTimes.push(timeDiff);
            
            if (keyTimes.length > 10) {
                keyTimes.shift();
                const avgTime = keyTimes.reduce((a, b) => a + b) / keyTimes.length;
                const variance = keyTimes.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / keyTimes.length;
                
                // Detect unnatural patterns
                if (variance < 50) { // Very consistent timing
                    consistencyScore++;
                    if (consistencyScore > 5) {
                        this.logSuspiciousActivity('UNNATURAL_TYPING_PATTERN', { consistencyScore });
                        consistencyScore = 0;
                    }
                } else {
                    consistencyScore = Math.max(0, consistencyScore - 1);
                }
            }
            
            lastKeyTime = now;
        });
    }

    monitorFocus() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.tabSwitches++;
                this.logSuspiciousActivity('TAB_SWITCH_DETECTED', { count: this.tabSwitches });
                
                if (this.tabSwitches >= 5) {
                    this.sendAdminAlert('EXCESSIVE_TAB_SWITCHING', {
                        tab_switch_count: this.tabSwitches,
                        session_id: this.sessionId
                    });
                }
            }
        });
    }

    monitorNetworkActivity() {
        // Monitor for network requests that might indicate cheating
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            // Log fetch requests during assessment
            if (args[0] && typeof args[0] === 'string' && 
                !args[0].includes('discord.com') && 
                !args[0].includes('googleapis.com') &&
                !args[0].includes('cloudflare.com')) {
                app.securityMonitor.logSuspiciousActivity('NETWORK_REQUEST', { url: args[0] });
            }
            return originalFetch.apply(this, args);
        };
    }

    logSuspiciousActivity(type, data = {}) {
        this.suspiciousActivities.push({
            type,
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            ...data
        });

        console.warn(`Security Alert [${type}]:`, data);
    }

    sendAdminAlert(alertType, data) {
        const alertData = {
            type: alertType,
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            ...data
        };

        let embedColor, title, description;

        switch (alertType) {
            case 'ASSESSMENT_STARTED':
                embedColor = 0x00ff00;
                title = '✅ Assessment Started';
                description = 'Candidate has begun the technical assessment';
                break;
            case 'ASSESSMENT_COMPLETED':
                embedColor = 0x00ff00;
                title = '🎉 Assessment Completed';
                description = 'Candidate has finished the technical assessment';
                break;
            case 'SUPPORT_REQUEST':
                embedColor = 0x0099ff;
                title = '🆘 Support Request';
                description = 'Candidate has requested assistance';
                break;
            case 'AI_DETECTION_WARNING':
                embedColor = 0xffa500;
                title = '⚠️ AI Content Warning';
                description = 'Potential AI-generated content detected';
                break;
            case 'AI_DETECTION_CRITICAL':
                embedColor = 0xff0000;
                title = '🚨 AI Content Critical';
                description = 'Multiple AI content detections - possible cheating';
                break;
            case 'EXCESSIVE_TAB_SWITCHING':
                embedColor = 0xff0000;
                title = '🔍 Excessive Tab Switching';
                description = 'Candidate frequently switching tabs - possible cheating';
                break;
            case 'APPLICATION_SUBMITTED':
                embedColor = 0x00ff00;
                title = '📄 Application Submitted';
                description = 'Candidate has submitted their application';
                break;
            default:
                embedColor = 0xffff00;
                title = '⚠️ Security Alert';
                description = 'Suspicious activity detected';
        }

        const embed = {
            title: title,
            description: description,
            color: embedColor,
            fields: [],
            timestamp: new Date().toISOString(),
            footer: { 
                text: `Dexxter Services • Session: ${this.sessionId.substring(0, 8)}`,
                icon_url: 'https://cdn.discordapp.com/emojis/1068521328359739452.webp'
            },
            thumbnail: {
                url: 'https://cdn.discordapp.com/emojis/1068521328359739452.webp'
            }
        };

        // Add fields based on data
        if (data.candidate) {
            embed.fields.push({
                name: '👤 Candidate Information',
                value: `**Roblox:** ${data.candidate.robloxUsername || 'Unknown'}\n**Discord:** ${data.candidate.discordId || 'Unknown'}\n**Experience:** ${data.candidate.experience || 'Unknown'}`,
                inline: false
            });
        }

        if (data.question) {
            embed.fields.push({
                name: '❓ Current Question',
                value: `#${data.question}`,
                inline: true
            });
        }

        if (data.time_elapsed) {
            embed.fields.push({
                name: '⏰ Time Elapsed',
                value: data.time_elapsed,
                inline: true
            });
        }

        if (data.questions_answered !== undefined) {
            embed.fields.push({
                name: '📊 Progress',
                value: `${data.questions_answered} questions answered`,
                inline: true
            });
        }

        if (data.skips_remaining !== undefined) {
            embed.fields.push({
                name: '⏭️ Skip Credits',
                value: `${data.skips_remaining} remaining`,
                inline: true
            });
        }

        if (data.excerpt) {
            embed.fields.push({
                name: '📝 Content Excerpt',
                value: `\`\`\`${data.excerpt}\`\`\``,
                inline: false
            });
        }

        if (data.total_flags) {
            embed.fields.push({
                name: '🚩 AI Detection Flags',
                value: `${data.total_flags} total flags`,
                inline: true
            });
        }

        if (data.tab_switch_count) {
            embed.fields.push({
                name: '🔍 Tab Switches',
                value: `${data.tab_switch_count} detected`,
                inline: true
            });
        }

        if (data.score !== undefined) {
            embed.fields.push({
                name: '🏆 Final Results',
                value: `**Score:** ${data.score}/100\n**Grade:** ${data.grade}\n**Time:** ${data.time_elapsed}`,
                inline: false
            });
        }

        const webhookData = {
            username: 'Dexxter Services Recruitment',
            avatar_url: 'https://cdn.discordapp.com/emojis/1068521328359739452.webp',
            embeds: [embed]
        };

        // Send to Discord webhook
        fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData)
        }).catch(error => {
            console.error('Error sending Discord webhook:', error);
        });
    }

    async sendApplicationSubmission(applicationData, personalInfo, score, grade) {
        // Create a Blob with the application data
        const blob = new Blob([applicationData], { type: 'text/plain;charset=utf-8' });
        const file = new File([blob], `Dexxter_Application_${personalInfo.robloxUsername}_${this.sessionId}.txt`, { 
            type: 'text/plain' 
        });

        // Send main application alert
        this.sendAdminAlert('APPLICATION_SUBMITTED', {
            candidate: personalInfo,
            score: score,
            grade: grade,
            time_elapsed: app.timers.assessment.getElapsedTime(),
            questions_answered: app.completedQuestions.size,
            skips_used: 5 - app.skipsRemaining,
            suspicious_activities: this.suspiciousActivities.length,
            ai_flags: this.aiFlags,
            tab_switches: this.tabSwitches
        });

        // Create download link for the file
        this.downloadApplicationFile(applicationData, personalInfo);
    }

    downloadApplicationFile(applicationData, personalInfo) {
        const blob = new Blob([applicationData], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dexxter_Application_${personalInfo.robloxUsername}_${this.sessionId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `DXT-${timestamp}-${random}`.toUpperCase();
    }
}

// Enhanced Scoring System
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

        // Ensure score is between 0 and 100
        const finalScore = Math.round((totalScore / maxPossible) * 100);
        return Math.min(100, Math.max(0, finalScore));
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
        
        // Length and completeness
        if (text.length >= 50) score += maxPoints * 0.2;
        if (text.length >= 150) score += maxPoints * 0.2;
        if (text.length >= 300) score += maxPoints * 0.1;
        
        // Technical depth
        if (this.containsTechnicalTerms(text)) score += maxPoints * 0.3;
        if (this.containsAdvancedConcepts(text)) score += maxPoints * 0.2;
        
        return score;
    }

    evaluateCodeAnswer(code, maxPoints) {
        let score = 0;
        
        // Basic structure
        if (code.length >= 10) score += maxPoints * 0.1;
        if (this.isValidLuaSyntax(code)) score += maxPoints * 0.3;
        
        // Code quality
        if (this.containsComments(code)) score += maxPoints * 0.2;
        if (this.containsAdvancedPatterns(code)) score += maxPoints * 0.4;
        
        return score;
    }

    containsTechnicalTerms(text) {
        const terms = ['metamethod', 'hook', 'exploit', 'remote', 'client', 'server', 'protection', 'bypass', 'luau', 'script', 'roblox', 'memory', 'injection'];
        return terms.some(term => text.toLowerCase().includes(term));
    }

    containsAdvancedConcepts(text) {
        const concepts = ['reverse engineering', 'memory manipulation', 'API hooking', 'security bypass', 'anti-cheat', 'detection evasion'];
        return concepts.some(concept => text.toLowerCase().includes(concept));
    }

    isValidLuaSyntax(code) {
        // Basic Lua syntax indicators
        return code.includes('function') || code.includes('local') || code.includes('=') || code.includes('--') || code.includes('if');
    }

    containsComments(code) {
        return code.includes('--') && code.split('--').length > 2;
    }

    containsAdvancedPatterns(code) {
        const patterns = ['hookmetamethod', 'getrawmetatable', 'newcclosure', 'checkcaller', 'protectgui', '__namecall', '__index', 'getgenv', 'setreadonly'];
        return patterns.some(pattern => code.includes(pattern));
    }

    getFinalGrade(score) {
        if (score >= 90) return 'SENIOR DEVELOPER';
        if (score >= 75) return 'REGULAR DEVELOPER';
        if (score >= 60) return 'JUNIOR DEVELOPER';
        if (score >= 40) return 'TRAINEE DEVELOPER';
        return 'NOT QUALIFIED';
    }
}

// Enhanced Questions Database
const QUESTIONS = [
    {
        text: "Explain the fundamental differences between client-side and server-side execution in Roblox. Provide specific examples of tasks that should be handled on each side for security and performance reasons.",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "What are Lua metamethods and how do they enable advanced scripting capabilities in Roblox? Describe at least three common metamethods and their practical applications.",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "Implement a secure player data management system using DataStores. Include error handling, data validation, and protection against data corruption.",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "Explain the concept of RemoteEvents and RemoteFunctions in Roblox. When would you choose one over the other, and what security considerations are essential?",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "Create a custom particle effect system that generates dynamic weather effects. Include configuration options for intensity, duration, and visual properties.",
        requiresText: false,
        requiresCode: true,
        points: 5
    },
    {
        text: "Describe the process of hooking metamethods for debugging or modification purposes. What are the ethical considerations and potential risks?",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "Implement an anti-exploit system that detects and prevents common cheating methods like speed hacking and teleportation.",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "What is the role of memory management in Lua/Luau? Explain garbage collection and best practices for preventing memory leaks.",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "Create a modular weapon system with inheritance for different weapon types. Include reload mechanics, ammo management, and damage calculation.",
        requiresText: false,
        requiresCode: true,
        points: 6
    },
    {
        text: "Explain how you would reverse engineer a game's network protocol to understand its communication structure. What tools and methodologies would you use?",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "Implement a real-time leaderboard system that updates efficiently with player statistics. Consider performance with large player counts.",
        requiresText: false,
        requiresCode: true,
        points: 5
    },
    {
        text: "What are the security implications of using getgenv() and shared environments? How can they be leveraged for both legitimate and malicious purposes?",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "Create a pathfinding system for NPCs that avoids obstacles and dynamically recalculates routes when the environment changes.",
        requiresText: false,
        requiresCode: true,
        points: 6
    },
    {
        text: "Explain the differences between hookfunction and hookmetamethod. Provide use cases where each would be more appropriate.",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "Implement a secure authentication system for GUI access that prevents unauthorized users from accessing admin features.",
        requiresText: true,
        requiresCode: true,
        points: 5
    },
    {
        text: "What methods would you use to analyze and understand obfuscated or encrypted Lua code? Describe your deobfuscation approach.",
        requiresText: true,
        requiresCode: false,
        points: 6
    },
    {
        text: "Create a dynamic quest system with objectives, rewards, and progression tracking. Include support for both single and chain quests.",
        requiresText: false,
        requiresCode: true,
        points: 5
    },
    {
        text: "Explain how to protect GUI elements from detection and removal by anti-exploit systems. What techniques ensure UI persistence?",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "Implement a real-time data synchronization system between multiple clients without causing network lag or desynchronization.",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "What are the most common vulnerabilities in Roblox games, and how would you exploit or protect against them?",
        requiresText: true,
        requiresCode: false,
        points: 5
    },
    {
        text: "Create an advanced camera system with multiple modes (first-person, third-person, orbital) and smooth transitions between them.",
        requiresText: false,
        requiresCode: true,
        points: 5
    },
    {
        text: "Explain the process of bypassing client-side validation to modify game data. What are the technical and ethical boundaries?",
        requiresText: true,
        requiresCode: false,
        points: 6
    },
    {
        text: "Implement a machine learning-inspired decision system for NPC behavior using basic pattern recognition and state machines.",
        requiresText: true,
        requiresCode: true,
        points: 6
    },
    {
        text: "What are the performance implications of using metatables extensively? How would you optimize a script-heavy game?",
        requiresText: true,
        requiresCode: false,
        points: 4
    },
    {
        text: "Create a comprehensive debugging and logging system that helps identify issues in production without impacting performance.",
        requiresText: false,
        requiresCode: true,
        points: 5
    }
];

// Global functions for HTML interaction
function toggleStartButton() {
    const agreeCheckbox = document.getElementById('agreeRules');
    const startButton = document.getElementById('startApplicationBtn');
    if (agreeCheckbox && startButton) {
        startButton.disabled = !agreeCheckbox.checked;
    }
}

function startApplication() {
    app.startApplication();
}

function validateAndStartTechnicalTest() {
    app.validateAndStartTechnicalTest();
}

function startTechnicalTest() {
    app.startTechnicalTest();
}

function nextQuestion() {
    app.nextQuestion();
}

function skipQuestion() {
    app.skipQuestion();
}

function callAdmin() {
    app.callAdmin();
}

function saveProgress() {
    app.saveProgress();
}

function submitApplication() {
    app.showConfirmation(
        'Submit Application',
        'You are about to submit your final application. This action cannot be undone. Ensure all information is correct before proceeding.',
        () => {
            app.submitApplication();
        }
    );
}

function confirmAction(confirmed) {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (confirmed && app.confirmCallback) {
        app.confirmCallback();
    }
    
    app.confirmCallback = null;
}

function hideNotification() {
    app.hideNotification();
}

// Code Editor Functions
function openCodeEditor() {
    document.getElementById('codeEditorModal').style.display = 'block';
    // Load current code if any
    const currentCode = document.querySelector('.code-answer')?.value || '';
    document.getElementById('advancedEditor').value = currentCode;
    updateEditorStats();
}

function closeCodeEditor() {
    document.getElementById('codeEditorModal').style.display = 'none';
}

function applyCode() {
    const code = document.getElementById('advancedEditor').value;
    const currentCodeAnswer = document.querySelector('.code-answer');
    if (currentCodeAnswer) {
        currentCodeAnswer.value = code;
        app.saveAnswer(app.currentQuestion, 'code', code);
    }
    closeCodeEditor();
    app.showNotification('Code applied to answer successfully', 'success');
}

function insertCodeSnippet(type) {
    const editor = document.getElementById('advancedEditor');
    let snippet = '';
    
    switch (type) {
        case 'function':
            snippet = `-- Function template
local function functionName(parameters)
    -- Function body
    return result
end

return functionName`;
            break;
        case 'hook':
            snippet = `-- Metamethod hook template
local originalFunction
originalFunction = hookmetamethod(game, "__namecall", function(self, ...)
    local args = {...}
    local method = getnamecallmethod()
    
    if method == "TargetMethod" then
        -- Custom logic here
        return originalFunction(self, unpack(args))
    end
    
    return originalFunction(self, ...)
end)`;
            break;
        case 'metamethod':
            snippet = `-- Metatable manipulation
local mt = getrawmetatable(game)
local originalIndex = mt.__index

setreadonly(mt, false)

mt.__index = newcclosure(function(self, key)
    -- Custom index logic
    return originalIndex(self, key)
end)

setreadonly(mt, true)`;
            break;
    }
    
    editor.value += '\n\n' + snippet;
    updateEditorStats();
}

function formatCode() {
    const editor = document.getElementById('advancedEditor');
    let code = editor.value;
    
    // Basic formatting: ensure proper indentation
    code = code.replace(/\t/g, '    '); // Convert tabs to spaces
    code = code.replace(/\n{3,}/g, '\n\n'); // Remove multiple empty lines
    
    editor.value = code;
    updateEditorStats();
    app.showNotification('Code formatted successfully', 'success');
}

function checkSyntax() {
    // Basic syntax checking
    const editor = document.getElementById('advancedEditor');
    const code = editor.value;
    
    let issues = [];
    
    // Check for common issues
    if (code.includes('while true do') && !code.includes('wait()')) {
        issues.push('Potential infinite loop detected - consider adding a wait()');
    }
    
    if ((code.match(/function/g) || []).length !== (code.match(/end/g) || []).length) {
        issues.push('Mismatched function/end statements');
    }
    
    if (code.includes('getfenv') || code.includes('setfenv')) {
        issues.push('getfenv/setfenv are deprecated in Luau - use _G or other methods');
    }
    
    if (issues.length > 0) {
        app.showNotification('Syntax issues: ' + issues.join('; '), 'warning');
    } else {
        app.showNotification('No obvious syntax issues detected', 'success');
    }
}

function testCode() {
    app.showNotification('Code testing functionality would execute in a secure sandbox environment', 'info');
}

function changeTheme(theme) {
    const editor = document.getElementById('advancedEditor');
    editor.className = theme + '-theme';
    app.showNotification(`Theme changed to ${theme}`, 'info');
}

function toggleFullscreen() {
    const modal = document.querySelector('.modal-content.large');
    if (modal) {
        if (!document.fullscreenElement) {
            modal.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }
}

function updateEditorStats() {
    const editor = document.getElementById('advancedEditor');
    const lineInfo = document.getElementById('lineInfo');
    const charCount = document.getElementById('charCount');
    const lineCount = document.getElementById('lineCount');
    
    if (editor && lineInfo && charCount && lineCount) {
        const text = editor.value;
        const lines = text.split('\n');
        const currentLine = lines.length;
        const currentColumn = lines[lines.length - 1].length + 1;
        
        lineInfo.textContent = `Line ${currentLine}, Column ${currentColumn}`;
        charCount.textContent = `${text.length} characters`;
        lineCount.textContent = `${lines.length} lines`;
    }
}

// Initialize editor stats on load
document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('advancedEditor');
    if (editor) {
        editor.addEventListener('input', updateEditorStats);
        editor.addEventListener('click', updateEditorStats);
        editor.addEventListener('keyup', updateEditorStats);
    }
});

// Initialize the application when the page loads
let app;

document.addEventListener('DOMContentLoaded', function() {
    app = new DexxterApplication();
    
    // Load any saved progress
    setTimeout(() => {
        if (app.loadProgress()) {
            app.showNotification('Previous progress loaded successfully', 'info');
        }
    }, 1000);
});

// Prevent navigation
window.addEventListener('beforeunload', function(e) {
    if (app && app.currentSection > 1 && !app.isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
        return 'Your assessment progress will be lost if you leave this page.';
    }
});

// Export for global access
window.app = app;
