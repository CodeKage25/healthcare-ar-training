/**
 * Healthcare AR Training - Configuration
 * Customize training parameters without editing core code
 */

const CONFIG = {
    currentModule: 'handwashing', // 'handwashing', 'ppe', 'patient_transfer'
    
    // MediaPipe Hand Detection Settings
    handTracking: {
        maxNumHands: 2,              
        modelComplexity: 1,          
        minDetectionConfidence: 0.5, 
        minTrackingConfidence: 0.5,  
    },
    
    // Performance Optimization
    performance: {
        targetFPS: 30,
        skipFrames: 1,              // Process every Nth frame (1 = all frames)
        objectDetectionInterval: 1000, // ms between object detection calls
        maxHistoryLength: 60,       // Frames to keep in motion history
    },
    
    // Hand Washing Training Steps
    handWashingSteps: [
        {
            id: 'hands_visible',
            label: 'Hands visible to camera',
            requiredDuration: 3,     
            description: 'Show both hands clearly to the camera',
            hint: 'Hold your hands in front of the camera'
        },
        {
            id: 'wetting_motion',
            label: 'Wetting hands motion',
            requiredDuration: 3,
            description: 'Move hands together as if under water',
            hint: 'Bring your hands close together'
        },
        {
            id: 'soap_application',
            label: 'Soap application (rubbing palms)',
            requiredDuration: 5,
            description: 'Rub palms together in circular motion',
            hint: 'Rub your palms together in circles'
        },
        {
            id: 'interlace_fingers',
            label: 'Interlace fingers',
            requiredDuration: 3,
            description: 'Weave fingers together and rub',
            hint: 'Interlock your fingers like a zipper'
        },
        {
            id: 'back_of_hands',
            label: 'Wash back of hands',
            requiredDuration: 3,
            description: 'Rub back of each hand with opposite palm',
            hint: 'Cover the back of one hand with the other'
        },
        {
            id: 'thumbs',
            label: 'Clean thumbs',
            requiredDuration: 2,
            description: 'Clasp and rotate each thumb',
            hint: 'Give each thumb special attention'
        },
        {
            id: 'rinse_motion',
            label: 'Rinsing motion',
            requiredDuration: 5,
            description: 'Move hands vertically as if under running water',
            hint: 'Move your hands up and down'
        }
    ],
    
    // Motion Detection Thresholds
    motionThresholds: {
        handsCloseDistance: 0.15,     // Normalized distance for "hands together"
        handOverlapDistance: 0.1,      // Distance for fingertip-palm overlap
        circularMotionAngle: 2.0,      // Radians for circular motion
        verticalMotionRatio: 1.5,      // Vertical/horizontal ratio for rinsing
        minimumMotionFrames: 15,       // Minimum frames to detect motion pattern
    },
    
    // Voice Feedback Settings
    voice: {
        enabled: true,
        rate: 1.0,                    
        pitch: 1.0,                   
        volume: 1.0,                  
        language: 'en-US',            
        cooldownMs: 5000,             
        
        // Custom feedback messages
        messages: {
            welcome: 'Welcome to hand washing training. Please show me your hands and follow the on-screen instructions.',
            stepComplete: 'Great job on that step!',
            trainingComplete: 'Excellent work! You have completed the hand washing training. Your technique was perfect!',
            handsNotVisible: 'Please show your hands to the camera',
            movementTooFast: 'Try moving a bit slower for better tracking',
        }
    },
    
    // AI Coaching 
    aiCoaching: {
        enabled: true,               
        apiKey: '',                   
        model: 'anthropic/claude-3.5-sonnet',
        baseURL: 'https://openrouter.ai/api/v1',
        maxFeedbackPerSession: 5,
        feedbackCount: 0,
        
        systemPrompt: 'You are a friendly healthcare training coach. Give brief, encouraging feedback in 1-2 sentences. Be supportive and specific about hand washing technique.',
    },
    
    // Object Detection 
    objectDetection: {
        enabled: true,               
        apiEndpoint: 'http://localhost:8080',               
        // apiEndpoint: 'https://healthcare-ar-api-78427087119.europe-west1.run.app',               
        targetObjects: ['soap', 'towel', 'mask', 'gloves'],
        confidenceThreshold: 0.5,
        sendFramesPerSecond: 1,
    },
    
    // Scoring System
    scoring: {
        perfectScoreTime: 25,         
        passingScore: 70,             
        penaltyPerExtraSecond: 2,     
        bonusForPerfectTechnique: 10, 
    },
    
    // UI 
    ui: {
        theme: {
            primaryColor: '#4CAF50',
            secondaryColor: '#00ff88',
            warningColor: '#FF9800',
            errorColor: '#F44336',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
        
        showFPS: true,
        showDebugInfo: false,         
        showHandLandmarks: true,      
        showProgressBar: true,
        showChecklist: true,
        
        captions: {
            enabled: true,            
            fontSize: '16px',
            duration: 3000,           
        }
    },
    
    // Analytics and Logging
    analytics: {
        enabled: true,
        logToConsole: true,
        saveSessionData: true,
        sessionStorageKey: 'ar_training_sessions',
        
        // What to track
        track: {
            frameRate: true,
            handDetectionRate: true,
            stepCompletionTimes: true,
            failedAttempts: true,
            totalDuration: true,
        }
    },
    
    // Accessibility
    accessibility: {
        highContrast: false,          
        largeText: false,            
        reduceMotion: false,          
        screenReaderAnnouncements: true,
    },
    
    // Experimental Features
    experimental: {
        offlineMode: true,           // Cache for offline use (PWA)
        multiplayerMode: true,       // Two students training together
        recordVideo: true,           // Record session as video
        vrMode: true,                // WebXR for VR headsets
    }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}