"""
ChatANON FastAPI Application
Main API server for text anonymization service
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import asyncio
import logging
from datetime import datetime
import json

from ..core.ollama_client import OllamaClient
from ..core.anonymizer import AnonymizerEngine
from ..core.response_parser import ResponseParser
from ..config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ChatANON API",
    description="Local text anonymization service using LLMs",
    version="1.0.0"
)

# Configure CORS for local network access
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core components
ollama_client = OllamaClient(
    base_url=config.OLLAMA_BASE_URL,
    model=config.OLLAMA_DEFAULT_MODEL,
    timeout=config.OLLAMA_TIMEOUT,
    max_retries=config.OLLAMA_MAX_RETRIES
)
anonymizer = AnonymizerEngine(
    ollama_client,
    chunk_size=config.DEFAULT_CHUNK_SIZE,
    chunk_overlap=config.DEFAULT_CHUNK_OVERLAP
)
parser = ResponseParser()


# Request/Response Models
class AnonymizeRequest(BaseModel):
    text: str = Field(..., description="Text to anonymize")
    custom_instructions: Optional[str] = Field("", description="Custom anonymization instructions")
    return_reasoning: bool = Field(True, description="Include reasoning in response")
    stream: bool = Field(False, description="Stream the response")
    model: Optional[str] = Field(None, description="Specific model to use")
    temperature: float = Field(0.1, description="Model temperature")
    chunk_parallel: bool = Field(False, description="Process chunks in parallel")


class AnonymizeResponse(BaseModel):
    anonymized_text: str
    reasoning: Optional[Dict] = None
    metadata: Dict


class HealthResponse(BaseModel):
    status: str
    ollama_available: bool
    models: List[str]
    current_model: str


class ModelSwitchRequest(BaseModel):
    model: str = Field(..., description="Model to switch to")




# API Routes
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ChatANON",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/api/health",
            "anonymize": "/api/anonymize",
            "models": "/api/models",
            "websocket": "/ws"
        }
    }


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Check service health"""
    try:
        is_healthy = await ollama_client.health_check()
        models = await ollama_client.list_models()
        
        return HealthResponse(
            status="healthy" if is_healthy else "degraded",
            ollama_available=is_healthy,
            models=models,
            current_model=ollama_client.model
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            ollama_available=False,
            models=[],
            current_model="none"
        )



@app.post("/api/anonymize/stream")
async def anonymize_text_stream(request: AnonymizeRequest):
    """Stream anonymization response in real-time"""
    
    async def generate_stream():
        try:
            # Switch model if requested
            if request.model and request.model != ollama_client.model:
                success = await ollama_client.switch_model(request.model)
                if not success:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Model {request.model} not available'})}\n\n"
                    return
            
            # Send initial status
            yield f"data: {json.dumps({'type': 'status', 'message': 'Processing your request...'})}\n\n"
            
            # Use anonymizer's streaming method which handles chunking
            full_response = ""
            thinking_content = ""
            anonymized_content = ""
            in_thinking = False
            
            async for chunk_data in anonymizer.anonymize_stream(
                text=request.text,
                custom_instructions=request.custom_instructions,
                return_reasoning=request.return_reasoning,
                temperature=request.temperature,
                top_p=0.9
            ):
                if chunk_data.get('type') == 'status':
                    # Pass through status updates (chunk progress)
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                
                elif chunk_data.get('type') == 'stream':
                    content = chunk_data.get('content', '')
                    full_response += content
                    
                    # Track thinking for all models when reasoning is requested
                    # During streaming, we show the tagged content
                    # At completion, we'll show the redacted version
                    if request.return_reasoning:
                        # Track thinking vs anonymized content for reasoning models
                        if '<think>' in content:
                            in_thinking = True
                        elif '</think>' in content:
                            in_thinking = False
                            # Extract content after </think>
                            parts = content.split('</think>')
                            if len(parts) > 1:
                                anonymized_content += parts[1]
                                yield f"data: {json.dumps({'type': 'content', 'content': parts[1]})}\n\n"
                        elif in_thinking:
                            thinking_content += content
                            yield f"data: {json.dumps({'type': 'thinking', 'content': content})}\n\n"
                        else:
                            anonymized_content += content
                            yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                    else:
                        # For non-reasoning models, all content is direct output
                        anonymized_content += content
                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                
                elif chunk_data.get('type') == 'complete':
                    # Convert reasoning data to JSON-serializable format
                    reasoning = chunk_data.get('reasoning')
                    if reasoning and 'detected_pii' in reasoning:
                        # Convert PIIDetection objects to dictionaries
                        reasoning['detected_pii'] = [
                            {
                                'type': pii.type,
                                'original': pii.original,
                                'replacement': pii.replacement,
                                'confidence': pii.confidence,
                                'explanation': pii.explanation,
                                'position': getattr(pii, 'position', -1)
                            } if hasattr(pii, '__dict__') else pii
                            for pii in reasoning['detected_pii']
                        ]
                    
                    # Send final complete response
                    yield f"data: {json.dumps({'type': 'complete', 'anonymized_text': chunk_data.get('anonymized_text', anonymized_content), 'reasoning': reasoning})}\n\n"
                    break
                
                elif chunk_data.get('type') == 'error':
                    yield f"data: {json.dumps({'type': 'error', 'message': chunk_data.get('error', 'Unknown error')})}\n\n"
                    break
            
        except Exception as e:
            logger.error(f"Streaming anonymization failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )


# Removed batch endpoint - not used with streaming-only approach


@app.get("/api/models")
async def list_models():
    """List available models"""
    try:
        models = await ollama_client.list_models()
        return {
            "models": models,
            "current": ollama_client.model
        }
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/models/switch")
async def switch_model(request: ModelSwitchRequest):
    """Switch to a different model"""
    try:
        success = await ollama_client.switch_model(request.model)
        if success:
            return {"message": f"Switched to model {request.model}"}
        else:
            raise HTTPException(status_code=400, detail=f"Failed to switch to {request.model}")
    except Exception as e:
        logger.error(f"Model switch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/validate")
async def validate_anonymization(original: str, anonymized: str):
    """Validate anonymization quality"""
    try:
        validation = await anonymizer.validate_anonymization(original, anonymized)
        return validation
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket for real-time anonymization
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time anonymization"""
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get('type') == 'anonymize':
                # Stream anonymization
                text = message.get('text', '')
                custom_instructions = message.get('custom_instructions', '')
                
                # Build prompt - use default types only if no custom instructions
                if custom_instructions:
                    instructions = custom_instructions
                else:
                    instructions = ollama_client.DEFAULT_TYPES
                
                prompt = ollama_client.instruction_template.format(
                    custom_instructions=instructions,
                    input_text=text
                )
                
                # Send acknowledgment
                await websocket.send_json({
                    'type': 'status',
                    'message': 'Processing...'
                })
                
                # Process with streaming
                async for chunk in ollama_client._anonymize_stream(
                    prompt=prompt,
                    return_reasoning=True,
                    temperature=0.1,
                    top_p=0.9
                ):
                    await websocket.send_json(chunk)
                
            elif message.get('type') == 'ping':
                await websocket.send_json({'type': 'pong'})
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


# Custom instruction templates endpoint
@app.get("/api/templates")
async def get_instruction_templates():
    """Get predefined instruction templates"""
    return {
        "templates": {
            "gdpr": "Ensure compliance with GDPR. Be extra careful with EU citizen data. Redact all personal identifiers.",
            "hipaa": "Follow HIPAA guidelines. Redact all Protected Health Information (PHI) including dates, medical record numbers, and health conditions.",
            "pci": "Comply with PCI-DSS. Redact all payment card information including card numbers, CVV, and expiration dates.",
            "minimal": "Only redact the most sensitive information like SSN and credit cards. Keep names and organizations if they're public figures.",
            "maximum": "Redact all possible PII including names, dates, locations, organizations, and any potentially identifying information.",
            "legal": "Preserve legal entity names and case numbers but redact personal information of individuals.",
            "financial": "Redact account numbers, transaction IDs, and personal financial information but preserve institution names."
        }
    }


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting ChatANON API...")
    
    # Check Ollama availability
    is_healthy = await ollama_client.health_check()
    if not is_healthy:
        logger.warning("Ollama service not available or model not found")
    else:
        logger.info(f"Using model: {ollama_client.model}")
        # Warm up the model to reduce first-request latency
        logger.info("Warming up model for faster responses...")
        warmed = await ollama_client.warm_up_model()
        if warmed:
            logger.info("Model warm-up completed successfully")
        else:
            logger.warning("Model warm-up failed, first request may be slow")
    
    logger.info("ChatANON API started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down ChatANON API...")
    # Add any cleanup code here
    logger.info("ChatANON API shut down complete")


if __name__ == "__main__":
    import uvicorn
    
    # Run the application
    uvicorn.run(
        app,
        host="0.0.0.0",  # Allow network access
        port=8080,
        log_level="info"
    )