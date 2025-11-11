"""
Healthcare AR Training - FastAPI Backend
Provides object detection and AI coaching endpoints
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from typing import List
import logging
import time

# Try to import YOLO, but don't fail if it's not available
try:
    import cv2
    import numpy as np
    import torch
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError as e:
    logging.warning(f"YOLO dependencies not available: {e}")
    YOLO_AVAILABLE = False
    cv2 = None
    np = None
    torch = None
    YOLO = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Healthcare AR Training API",
    description="Object detection and AI coaching for healthcare training",
    version="1.0.0"
)

# Configure CORS - Allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO model with PyTorch 2.6+ fix
model = None
if YOLO_AVAILABLE:
    logger.info("Loading YOLO model...")
    try:
        # Fix for PyTorch 2.6+ - set weights_only=False globally
        import torch
        # Patch torch.load to always use weights_only=False
        _original_load = torch.load
        torch.load = lambda *args, **kwargs: _original_load(*args, **{**kwargs, 'weights_only': False})
        
        model = YOLO('yolov8n.pt')
        logger.info("✓ YOLO model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load YOLO model: {e}")
        model = None
else:
    logger.warning("YOLO not available - object detection disabled")


class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]


class DetectionResponse(BaseModel):
    detections: List[Detection]
    count: int
    processing_time_ms: float


class AICoachRequest(BaseModel):
    current_step: str
    duration: float
    motion_type: str
    previous_attempts: int


class SessionRequest(BaseModel):
    session_id: str
    user_id: str
    task: str
    start_time: str
    end_time: str
    duration: int
    steps: List[dict]
    score: int
    metrics: dict
    feedback: List[dict]


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Healthcare AR Training API",
        "version": "1.0.0",
        "model_loaded": model is not None,
        "endpoints": ["/detect", "/ai-coach", "/sessions", "/health"]
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_type": "YOLOv8n" if model else None
    }


@app.post("/detect", response_model=DetectionResponse)
async def detect_objects(image: UploadFile = File(...)):
    """
    Detect objects in uploaded image using YOLO
    """
    start_time = time.time()
    
    if not model:
        raise HTTPException(status_code=503, detail="YOLO model not loaded")
    
    try:
        # Read image
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        
        # Run YOLO detection
        results = model(img, conf=0.5, verbose=False)
        
        # Extract detections
        detections = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                bbox = box.xyxy[0].tolist()
                class_name = model.names[class_id]
                
                # Filter for relevant objects
                if any(obj in class_name.lower() for obj in 
                       ['bottle', 'cup', 'person', 'hand', 'book']):
                    detections.append(Detection(
                        class_name=class_name,
                        confidence=confidence,
                        bbox=bbox
                    ))
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"Detected {len(detections)} objects in {processing_time:.2f}ms")
        
        return DetectionResponse(
            detections=detections,
            count=len(detections),
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai-coach")
async def ai_coach(request: AICoachRequest):
    """
    Provide AI coaching feedback
    """
    feedback = generate_feedback(
        request.current_step,
        request.duration,
        request.motion_type,
        request.previous_attempts
    )
    
    return {
        "feedback": feedback,
        "source": "rule_based",
        "step": request.current_step
    }


def generate_feedback(step: str, duration: float, motion_type: str, attempts: int) -> str:
    """Generate coaching feedback"""
    
    feedback_map = {
        "hands_visible": "Great! Keep your hands clearly visible.",
        "wetting_motion": "Good wetting motion! Cover all surfaces.",
        "soap_application": "Excellent circular rubbing motion!",
        "interlace_fingers": "Nice! Make sure fingers are fully interlaced.",
        "back_of_hands": "Good job! Don't forget both backs.",
        "thumbs": "Great thumb cleaning! Rotate them well.",
        "rinse_motion": "Excellent rinsing technique!"
    }
    
    return feedback_map.get(step, "Keep up the good work!")


@app.post("/sessions")
async def save_session(session: SessionRequest):
    """Save training session"""
    logger.info(f"Session: {session.session_id}, Score: {session.score}")
    
    return {
        "status": "success",
        "session_id": session.session_id,
        "message": "Session saved"
    }


@app.get("/analytics")
async def get_analytics():
    """Get analytics"""
    return {
        "total_sessions": 0,
        "average_score": 0,
        "message": "Analytics endpoint"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)