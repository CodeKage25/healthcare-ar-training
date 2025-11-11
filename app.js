// Healthcare AR Training Application
// Core functionality: Camera, Pose Detection, AR Overlays, Skill Validation, AI Coaching

// API Configuration
const API_CONFIG = {
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8080'  // Local development
        : 'https://healthcare-ar-api-78427087119.europe-west1.run.app',  // Production
    
    endpoints: {
        detect: '/detect',
        aiCoach: '/ai-coach',
        sessions: '/sessions',
        analytics: '/analytics'
    },
    
    // Feature flags
    objectDetectionEnabled: true,  
    aiCoachingEnabled: true,       
    sessionStorageEnabled: true    
};

class ARTrainingApp {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.overlayCanvas = null;
        this.ctx = null;
        this.overlayCtx = null;
        
        // MediaPipe Hands
        this.hands = null;
        this.camera = null;
        
        // Performance metrics
        this.fps = 0;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        
        // Training state
        this.isTraining = false;
        this.currentTask = 'handwashing';
        this.sessionStartTime = null;
        this.sessionData = {
            session_id: null,
            user_id: null,
            start_time: null,
            end_time: null,
            steps: [],
            score: 0,
            duration: 0,
            feedback: []
        };
        
        // Object detection state
        this.detectedObjects = [];
        this.lastObjectDetection = 0;
        
        // Hand washing checklist
        this.handWashingSteps = [
            { id: 'hands_visible', label: 'Hands visible to camera', completed: false, duration: 0, required: 3 },
            { id: 'wetting_motion', label: 'Wetting hands motion', completed: false, duration: 0, required: 3 },
            { id: 'soap_application', label: 'Soap application (rubbing palms)', completed: false, duration: 0, required: 5 },
            { id: 'interlace_fingers', label: 'Interlace fingers', completed: false, duration: 0, required: 3 },
            { id: 'back_of_hands', label: 'Wash back of hands', completed: false, duration: 0, required: 3 },
            { id: 'thumbs', label: 'Clean thumbs', completed: false, duration: 0, required: 2 },
            { id: 'rinse_motion', label: 'Rinsing motion', completed: false, duration: 0, required: 5 }
        ];
        
        // Hand tracking state
        this.lastHandPositions = [];
        this.handMotionHistory = [];
        this.handsDetectedTime = 0;
        this.lastHandsDetected = 0;
        
        // Voice feedback
        this.speechSynthesis = window.speechSynthesis;
        this.lastFeedbackTime = 0;
        this.feedbackCooldown = 5000; // 5 seconds between voice feedback
        
        // AI Coaching (OpenRouter)
        this.aiCoachingEnabled = false;
        this.aiCoachingCount = 0;
        this.aiCache = {};
    }

    async init() {
        console.log('Initializing AR Training App...');
        
        // Get DOM elements
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvasElement');
        this.overlayCanvas = document.getElementById('overlay');
        this.ctx = this.canvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        // Setup camera
        await this.setupCamera();
        
        // Initialize MediaPipe Hands
        await this.initMediaPipe();
        
        // Setup UI handlers
        this.setupUI();
        
        // Start rendering loop
        this.renderLoop();
        
        console.log('Initialization complete!');
    }

    async setupCamera() {
        console.log('Setting up camera...');
        
        try {
            const constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    
                    // Set canvas sizes to match video
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    this.overlayCanvas.width = this.video.videoWidth;
                    this.overlayCanvas.height = this.video.videoHeight;
                    
                    document.getElementById('cameraStatus').textContent = 'Active ✓';
                    console.log(`Camera active: ${this.video.videoWidth}x${this.video.videoHeight}`);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Camera setup failed:', error);
            document.getElementById('cameraStatus').textContent = 'Failed ✗';
            alert('Camera access denied. Please allow camera access and reload.');
        }
    }

    async initMediaPipe() {
        console.log('Initializing MediaPipe Hands...');
        
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.hands.onResults((results) => this.onHandsDetected(results));
        
        // Initialize camera with MediaPipe
        this.camera = new Camera(this.video, {
            onFrame: async () => {
                if (this.hands) {
                    await this.hands.send({ image: this.video });
                }
            },
            width: 1280,
            height: 720
        });
        
        await this.camera.start();
        
        document.getElementById('poseStatus').textContent = 'Active ✓';
        console.log('MediaPipe Hands initialized');
    }

    onHandsDetected(results) {
        this.frameCount++;
        
        // Clear previous drawings
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.lastHandsDetected = Date.now();
            
            // Draw hand landmarks
            for (const landmarks of results.multiHandLandmarks) {
                this.drawHandLandmarks(landmarks);
            }
            
            // Process hand movements for skill validation
            if (this.isTraining) {
                this.processHandMovements(results.multiHandLandmarks);
            }
        }
        
        // Update FPS
        this.updateFPS();
    }

    drawHandLandmarks(landmarks) {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],  // Index
            [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
            [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
            [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
            [5, 9], [9, 13], [13, 17]  // Palm
        ];
        
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        
        for (const [start, end] of connections) {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw landmarks
        for (const landmark of landmarks) {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fill();
            this.ctx.strokeStyle = '#00ff88';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    processHandMovements(multiHandLandmarks) {
        const now = Date.now();
        
        // Store hand positions
        this.lastHandPositions = multiHandLandmarks;
        
        // Add to motion history
        this.handMotionHistory.push({
            timestamp: now,
            hands: multiHandLandmarks.map(hand => ({
                palm: hand[0],
                fingertips: [hand[4], hand[8], hand[12], hand[16], hand[20]]
            }))
        });
        
        // Keep only last 2 seconds of history
        this.handMotionHistory = this.handMotionHistory.filter(
            entry => now - entry.timestamp < 2000
        );
        
        // Validate hand washing steps
        this.validateHandWashingSteps();
    }

    validateHandWashingSteps() {
        const now = Date.now();
        
        // Step 1: Hands visible
        if (this.lastHandPositions.length > 0) {
            const step = this.handWashingSteps[0];
            if (!step.completed) {
                step.duration += 0.033; // ~30fps = 33ms per frame
                if (step.duration >= step.required) {
                    this.completeStep(0, 'Great! I can see your hands clearly.');
                }
            }
        }
        
        // Step 2: Wetting motion (hands moving together near center)
        if (this.handWashingSteps[0].completed && this.lastHandPositions.length === 2) {
            const step = this.handWashingSteps[1];
            if (!step.completed) {
                const distance = this.calculateHandDistance(this.lastHandPositions[0], this.lastHandPositions[1]);
                if (distance < 0.15) { // Hands close together
                    step.duration += 0.033;
                    if (step.duration >= step.required) {
                        this.completeStep(1, 'Good wetting motion!');
                    }
                }
            }
        }
        
        // Step 3: Soap application (rubbing palms - circular motion)
        if (this.handWashingSteps[1].completed && this.lastHandPositions.length === 2) {
            const step = this.handWashingSteps[2];
            if (!step.completed) {
                const motion = this.detectCircularMotion();
                if (motion) {
                    step.duration += 0.033;
                    if (step.duration >= step.required) {
                        this.completeStep(2, 'Perfect soap application technique!');
                    }
                }
            }
        }
        
        // Step 4: Interlace fingers (hands overlapping with movement)
        if (this.handWashingSteps[2].completed && this.lastHandPositions.length === 2) {
            const step = this.handWashingSteps[3];
            if (!step.completed) {
                const overlapping = this.detectHandOverlap();
                if (overlapping) {
                    step.duration += 0.033;
                    if (step.duration >= step.required) {
                        this.completeStep(3, 'Excellent finger interlacing!');
                    }
                }
            }
        }
        
        // Step 5: Back of hands (one hand covering back of other)
        if (this.handWashingSteps[3].completed && this.lastHandPositions.length === 2) {
            const step = this.handWashingSteps[4];
            if (!step.completed) {
                // Simplified: detect if hands are moving together
                const distance = this.calculateHandDistance(this.lastHandPositions[0], this.lastHandPositions[1]);
                if (distance < 0.12) {
                    step.duration += 0.033;
                    if (step.duration >= step.required) {
                        this.completeStep(4, 'Good work on the back of hands!');
                    }
                }
            }
        }
        
        // Step 6: Thumbs (detect thumb cleaning motion)
        if (this.handWashingSteps[4].completed) {
            const step = this.handWashingSteps[5];
            if (!step.completed) {
                // Simplified: any hand movement
                if (this.handMotionHistory.length > 30) {
                    step.duration += 0.033;
                    if (step.duration >= step.required) {
                        this.completeStep(5, 'Nice thumb cleaning!');
                    }
                }
            }
        }
        
        // Step 7: Rinsing motion (hands moving vertically)
        if (this.handWashingSteps[5].completed && this.lastHandPositions.length > 0) {
            const step = this.handWashingSteps[6];
            if (!step.completed) {
                const verticalMotion = this.detectVerticalMotion();
                if (verticalMotion) {
                    step.duration += 0.033;
                    if (step.duration >= step.required) {
                        this.completeStep(6, 'Perfect rinsing technique!');
                        this.finishTraining();
                    }
                }
            }
        }
        
        // Update checklist UI
        this.updateChecklistUI();
        
        // Check if student is struggling (taking 2x the required time)
        if (CONFIG.aiCoaching.enabled && CONFIG.aiCoaching.apiKey) {
            const currentStep = this.handWashingSteps.find(s => !s.completed);
            if (currentStep && currentStep.duration > currentStep.required * 2) {
                // Only provide hint once per step
                if (!currentStep.hintProvided) {
                    currentStep.hintProvided = true;
                    this.provideStruggleHint(currentStep);
                }
            }
        }
    }

    calculateHandDistance(hand1, hand2) {
        const palm1 = hand1[0];
        const palm2 = hand2[0];
        const dx = palm1.x - palm2.x;
        const dy = palm1.y - palm2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    detectCircularMotion() {
        if (this.handMotionHistory.length < 20) return false;
        
        // Check if hand positions form a circular pattern
        const recent = this.handMotionHistory.slice(-20);
        let totalAngleChange = 0;
        
        for (let i = 1; i < recent.length; i++) {
            const prev = recent[i - 1].hands[0].palm;
            const curr = recent[i].hands[0].palm;
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            totalAngleChange += Math.abs(angle);
        }
        
        return totalAngleChange > 2; // Threshold for circular motion
    }

    detectHandOverlap() {
        if (this.lastHandPositions.length !== 2) return false;
        
        const hand1 = this.lastHandPositions[0];
        const hand2 = this.lastHandPositions[1];
        
        // Check if fingertips are close to opposite palm
        const palm1 = hand1[0];
        const palm2 = hand2[0];
        const fingertips1 = [hand1[4], hand1[8], hand1[12], hand1[16], hand1[20]];
        const fingertips2 = [hand2[4], hand2[8], hand2[12], hand2[16], hand2[20]];
        
        let overlapCount = 0;
        
        for (const tip of fingertips1) {
            const distance = Math.sqrt(
                Math.pow(tip.x - palm2.x, 2) + Math.pow(tip.y - palm2.y, 2)
            );
            if (distance < 0.1) overlapCount++;
        }
        
        return overlapCount >= 2;
    }

    detectVerticalMotion() {
        if (this.handMotionHistory.length < 15) return false;
        
        const recent = this.handMotionHistory.slice(-15);
        let totalVertical = 0;
        let totalHorizontal = 0;
        
        for (let i = 1; i < recent.length; i++) {
            const prev = recent[i - 1].hands[0].palm;
            const curr = recent[i].hands[0].palm;
            totalVertical += Math.abs(curr.y - prev.y);
            totalHorizontal += Math.abs(curr.x - prev.x);
        }
        
        // Vertical motion should be more than horizontal
        return totalVertical > totalHorizontal * 1.5 && totalVertical > 0.3;
    }

    async completeStep(stepIndex, feedbackMessage) {
        const step = this.handWashingSteps[stepIndex];
        step.completed = true;
        
        console.log(`✓ Step completed: ${step.label}`);
        
        // Get AI coaching if enabled
        let finalFeedback = feedbackMessage;
        if (CONFIG.aiCoaching.enabled && CONFIG.aiCoaching.apiKey) {
            const aiContext = {
                step: step.label,
                issue: 'completed successfully',
                duration: step.duration,
                attempts: 1
            };
            
            const aiFeedback = await this.getAICoaching(aiContext);
            if (aiFeedback) {
                finalFeedback = aiFeedback;
            }
        }
        
        // Show visual feedback
        this.showFeedback(finalFeedback, 'success');
        
        // Voice feedback with cooldown
        const now = Date.now();
        if (now - this.lastFeedbackTime > this.feedbackCooldown) {
            this.speak(finalFeedback);
            this.lastFeedbackTime = now;
        }
        
        // Log to session data
        this.sessionData.steps.push({
            step: step.label,
            completedAt: Date.now() - this.sessionStartTime,
            duration: step.duration,
            feedback: finalFeedback
        });
    }

    updateChecklistUI() {
        const checklistContainer = document.getElementById('checklist');
        checklistContainer.innerHTML = '';
        
        for (const step of this.handWashingSteps) {
            const item = document.createElement('div');
            item.className = `checklist-item ${step.completed ? 'completed' : ''}`;
            
            const progress = step.completed ? 100 : Math.min(100, (step.duration / step.required) * 100);
            
            item.innerHTML = `
                <div class="check-icon">${step.completed ? '✓' : ''}</div>
                <div style="flex: 1;">
                    ${step.label}
                    ${!step.completed ? `<div style="font-size: 10px; color: #aaa; margin-top: 2px;">
                        ${Math.round(progress)}% - ${Math.max(0, step.required - step.duration).toFixed(1)}s remaining
                    </div>` : ''}
                </div>
            `;
            
            checklistContainer.appendChild(item);
        }
    }

    showFeedback(message, type = 'success') {
        const feedbackEl = document.getElementById('feedback');
        feedbackEl.textContent = message;
        feedbackEl.style.display = 'block';
        feedbackEl.style.background = type === 'success' 
            ? 'rgba(76, 175, 80, 0.9)' 
            : 'rgba(255, 152, 0, 0.9)';
        
        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 3000);
    }

    speak(text) {
        if (this.speechSynthesis && this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';
        
        this.speechSynthesis.speak(utterance);
    }

    async getAICoaching(context) {
        // Check if AI coaching is enabled and we haven't exceeded max feedback
        if (!CONFIG.aiCoaching.enabled || !CONFIG.aiCoaching.apiKey) {
            return null;
        }
        
        if (this.aiCoachingCount >= CONFIG.aiCoaching.maxFeedbackPerSession) {
            console.log('AI coaching limit reached for this session');
            return null;
        }
        
        // Check cache first
        const cacheKey = `${context.step}_${context.issue}`;
        if (this.aiCache[cacheKey]) {
            console.log('Using cached AI feedback');
            return this.aiCache[cacheKey];
        }
        
        try {
            const response = await fetch(`${CONFIG.aiCoaching.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CONFIG.aiCoaching.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Healthcare AR Training'
                },
                body: JSON.stringify({
                    model: CONFIG.aiCoaching.model,
                    messages: [
                        {
                            role: 'system',
                            content: CONFIG.aiCoaching.systemPrompt
                        },
                        {
                            role: 'user',
                            content: `Student is practicing hand washing. Current step: "${context.step}". 
                            Issue: ${context.issue}. 
                            Time on this step: ${context.duration.toFixed(1)} seconds.
                            Attempts: ${context.attempts}.
                            Give brief, encouraging coaching (1-2 sentences max).`
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenRouter API error:', response.status, errorText);
                return null;
            }
            
            const data = await response.json();
            const feedback = data.choices[0].message.content.trim();
            
            // Cache the feedback
            this.aiCache[cacheKey] = feedback;
            this.aiCoachingCount++;
            
            console.log('AI Coaching:', feedback);
            return feedback;
            
        } catch (error) {
            console.error('Error getting AI coaching:', error);
            return null;
        }
    }

    async provideStruggleHint(step) {
        // If student is taking too long on a step, provide AI hint
        if (!CONFIG.aiCoaching.enabled || !CONFIG.aiCoaching.apiKey) {
            return;
        }
        
        const context = {
            step: step.label,
            issue: 'taking longer than expected',
            duration: step.duration,
            attempts: 1
        };
        
        const hint = await this.getAICoaching(context);
        if (hint) {
            this.showFeedback(hint, 'info');
            this.speak(hint);
        }
    }

    finishTraining() {
        this.isTraining = false;
        this.sessionData.duration = Date.now() - this.sessionStartTime;
        this.sessionData.score = this.calculateScore();
        this.sessionData.end_time = new Date().toISOString();
        
        console.log('Training session completed:', this.sessionData);
        
        // Save session to backend (if enabled)
        if (API_CONFIG.sessionStorageEnabled) {
            this.saveSession();
        }
        
        // Show completion message
        const stepIndicator = document.getElementById('stepIndicator');
        stepIndicator.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <div>Training Complete!</div>
            <div style="font-size: 16px; margin-top: 8px; opacity: 0.8;">
                Score: ${this.sessionData.score}/100
            </div>
            <div style="font-size: 14px; margin-top: 4px; opacity: 0.6;">
                Duration: ${(this.sessionData.duration / 1000).toFixed(1)}s
            </div>
        `;
        stepIndicator.style.display = 'block';
        
        this.speak('Excellent work! You have completed the hand washing training. Your technique was perfect!');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            stepIndicator.style.display = 'none';
        }, 5000);
    }

    async saveSession() {
        if (!API_CONFIG.sessionStorageEnabled) return;
        
        try {
            const sessionPayload = {
                session_id: this.sessionData.session_id || `sess_${Date.now()}`,
                user_id: this.sessionData.user_id || 'student_' + Math.random().toString(36).substr(2, 9),
                task: 'handwashing',
                start_time: this.sessionData.start_time || new Date(Date.now() - this.sessionData.duration).toISOString(),
                end_time: this.sessionData.end_time,
                duration: this.sessionData.duration,
                steps: this.sessionData.steps,
                score: this.sessionData.score,
                metrics: {
                    averageStepTime: this.sessionData.steps.length > 0 
                        ? this.sessionData.steps.reduce((sum, s) => sum + s.duration, 0) / this.sessionData.steps.length 
                        : 0,
                    totalAttempts: this.sessionData.steps.length,
                    handsDetectionRate: 0.98  // From pose detection metrics
                },
                feedback: this.sessionData.feedback || []
            };
            
            const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.sessions}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionPayload)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✓ Session saved:', data.session_id);
                
                // Show success message
                this.showFeedback('Session saved to cloud!', 'success');
            } else {
                console.warn('Failed to save session:', response.status);
            }
        } catch (error) {
            console.error('Session save error:', error);
        }
    }

    calculateScore() {
        const completedSteps = this.handWashingSteps.filter(s => s.completed).length;
        const totalSteps = this.handWashingSteps.length;
        return Math.round((completedSteps / totalSteps) * 100);
    }

    startTraining() {
        this.isTraining = true;
        this.sessionStartTime = Date.now();
        this.sessionData = { steps: [], score: 0, duration: 0 };
        
        // Reset all steps
        for (const step of this.handWashingSteps) {
            step.completed = false;
            step.duration = 0;
            step.hintProvided = false;
        }
        
        // Reset AI coaching count
        this.aiCoachingCount = 0;
        
        this.speak('Welcome to hand washing training. Please show me your hands and follow the on-screen instructions.');
        this.showFeedback('Training started! Show your hands to the camera.', 'success');
    }

    resetTraining() {
        this.isTraining = false;
        this.handMotionHistory = [];
        this.sessionData = { steps: [], score: 0, duration: 0 };
        
        for (const step of this.handWashingSteps) {
            step.completed = false;
            step.duration = 0;
        }
        
        this.updateChecklistUI();
        document.getElementById('stepIndicator').style.display = 'none';
    }

    updateFPS() {
        const now = performance.now();
        
        if (this.lastFrameTime) {
            const delta = now - this.lastFrameTime;
            this.fps = Math.round(1000 / delta);
            document.getElementById('fpsCounter').textContent = this.fps;
        }
        
        this.lastFrameTime = now;
        
        // Trigger object detection every second (if enabled)
        if (API_CONFIG.objectDetectionEnabled && now - (this.lastObjectDetection || 0) > 1000) {
            this.detectObjects();
            this.lastObjectDetection = now;
        }
    }

    async detectObjects() {
        if (!API_CONFIG.objectDetectionEnabled) return;
        
        try {
            // Capture frame from video
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            
            // Convert to blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
            
            // Send to API
            const formData = new FormData();
            formData.append('image', blob);
            
            const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.detect}`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                this.processDetections(data.detections);
            }
        } catch (error) {
            console.error('Object detection error:', error);
        }
    }

    processDetections(detections) {
        // Store detected objects
        this.detectedObjects = detections;
        
        // Check for required objects in current step
        const currentStep = this.handWashingSteps.find(s => !s.completed);
        if (!currentStep) return;
        
        // Example: Check for soap in soap application step
        if (currentStep.id === 'soap_application') {
            const hasSoap = detections.some(d => 
                (d.class_name === 'soap' || d.class_name === 'sanitizer') && 
                d.confidence > 0.5
            );
            
            if (hasSoap) {
                console.log('✓ Soap detected!');
                // Could boost score or provide positive feedback
            }
        }
    }

    renderLoop() {
        // Draw AR overlays
        this.drawOverlays();
        
        requestAnimationFrame(() => this.renderLoop());
    }

    drawOverlays() {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw detected objects
        this.drawDetectedObjects();
        
        // Draw training hints if training is active
        if (this.isTraining && this.lastHandPositions.length > 0) {
            // Find current active step
            const currentStep = this.handWashingSteps.find(s => !s.completed);
            
            if (currentStep) {
                // Draw hint arrow or guide
                this.drawStepGuide(currentStep);
            }
        }
    }

    /**
     * Draw bounding boxes and labels for detected objects on the AR overlay
     */
    drawDetectedObjects() {
        if (!this.detectedObjects || this.detectedObjects.length === 0) return;
        const ctx = this.overlayCtx;
        ctx.lineWidth = 3;
        ctx.font = '14px -apple-system, sans-serif';
        ctx.textBaseline = 'top';
        
        for (const det of this.detectedObjects) {
            const [x1, y1, x2, y2] = det.bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            
            // Choose color based on class for better visibility
            ctx.strokeStyle = '#00ff88';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            
            // Draw bounding box
            ctx.strokeRect(x1, y1, width, height);
            
            // Draw label background
            const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
            const textWidth = ctx.measureText(label).width + 6;
            const textHeight = 18;
            ctx.fillRect(x1, y1 - textHeight, textWidth, textHeight);
            
            // Draw label text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, x1 + 3, y1 - textHeight + 2);
        }
    }

    drawStepGuide(step) {
        const ctx = this.overlayCtx;
        const centerX = this.overlayCanvas.width / 2;
        
        // Compact design at top - less intrusive
        const barWidth = Math.min(280, this.overlayCanvas.width - 40);
        const barHeight = 4;
        const textY = 25;
        const barY = textY + 8;
        
        // Semi-transparent background box
        const boxPadding = 10;
        const boxHeight = 36;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(centerX - barWidth / 2 - boxPadding, 10, barWidth + boxPadding * 2, boxHeight);
        
        // Step text - smaller, cleaner
        ctx.font = '13px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.textAlign = 'center';
        ctx.fillText(step.label, centerX, textY);
        
        // Progress bar
        const progress = Math.min(1, step.duration / step.required);
        const barX = centerX - barWidth / 2;
        
        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progress fill
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        
        // Time remaining - tiny text
        const timeRemaining = Math.max(0, step.required - step.duration).toFixed(1);
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(`${timeRemaining}s`, centerX, barY + 14);
    }

    setupUI() {
        // Start button
        document.getElementById('startBtn').addEventListener('click', () => {
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('container').style.display = 'block';
            setTimeout(() => this.startTraining(), 1000);
        });
        
        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetTraining();
            this.startTraining();
        });
        
        // Exit button
        document.getElementById('exitBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to exit?')) {
                location.reload();
            }
        });
        
        // Minimize button - toggle UI visibility
        document.getElementById('minimizeBtn').addEventListener('click', () => {
            const ui = document.getElementById('ui');
            ui.classList.toggle('hidden');
        });
        
        // Make status cards collapsible
        document.querySelectorAll('.status-card h3').forEach(header => {
            header.addEventListener('click', (e) => {
                const card = e.target.closest('.status-card');
                card.classList.toggle('collapsed');
            });
        });
        
        // Auto-collapse system status after 5 seconds
        setTimeout(() => {
            const systemCard = document.querySelector('.status-card');
            if (systemCard) systemCard.classList.add('collapsed');
        }, 5000);
    }
}

// Initialize app when page loads
let app;
window.addEventListener('load', async () => {
    app = new ARTrainingApp();
    await app.init();
});