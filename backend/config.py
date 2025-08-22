"""
Configuration management for ChatANON backend
"""
import os
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration"""
    
    # Server Configuration
    HOST: str = os.getenv('HOST', '0.0.0.0')
    PORT: int = int(os.getenv('PORT', '8081'))
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'info')
    RELOAD: bool = os.getenv('RELOAD', 'true').lower() == 'true'
    
    # Ollama Configuration
    OLLAMA_BASE_URL: str = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
    OLLAMA_DEFAULT_MODEL: str = os.getenv('OLLAMA_DEFAULT_MODEL', 'qwen3:8b')
    OLLAMA_TIMEOUT: int = int(os.getenv('OLLAMA_TIMEOUT', '300'))
    OLLAMA_MAX_RETRIES: int = int(os.getenv('OLLAMA_MAX_RETRIES', '3'))
    
    # Processing Configuration
    DEFAULT_CHUNK_SIZE: int = int(os.getenv('DEFAULT_CHUNK_SIZE', '4096'))
    DEFAULT_CHUNK_OVERLAP: int = int(os.getenv('DEFAULT_CHUNK_OVERLAP', '200'))
    MAX_CONCURRENT_REQUESTS: int = int(os.getenv('MAX_CONCURRENT_REQUESTS', '10'))
    REQUEST_TIMEOUT: int = int(os.getenv('REQUEST_TIMEOUT', '300'))
    
    # Security Configuration
    FRONTEND_PORT: int = int(os.getenv('FRONTEND_PORT', '3002'))
    CORS_ALLOW_ALL: bool = os.getenv('CORS_ALLOW_ALL', 'true').lower() == 'true'
    CORS_ADDITIONAL_ORIGINS: List[str] = [
        origin.strip() for origin in os.getenv('CORS_ADDITIONAL_ORIGINS', '').split(',') if origin.strip()
    ]
    API_KEY_REQUIRED: bool = os.getenv('API_KEY_REQUIRED', 'false').lower() == 'true'
    RATE_LIMIT_REQUESTS: int = int(os.getenv('RATE_LIMIT_REQUESTS', '100'))
    RATE_LIMIT_WINDOW: int = int(os.getenv('RATE_LIMIT_WINDOW', '60'))
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Dynamically build CORS origins based on frontend port"""
        if self.CORS_ALLOW_ALL:
            return ["*"]
        
        # Build origins with configured frontend port
        origins = [
            f"http://localhost:{self.FRONTEND_PORT}",
            f"http://127.0.0.1:{self.FRONTEND_PORT}",
        ]
        
        # Add any additional origins
        origins.extend(self.CORS_ADDITIONAL_ORIGINS)
        
        return origins
    
    # Features Configuration
    ENABLE_REASONING: bool = os.getenv('ENABLE_REASONING', 'true').lower() == 'true'
    ENABLE_WEBSOCKETS: bool = os.getenv('ENABLE_WEBSOCKETS', 'true').lower() == 'true'
    ENABLE_STREAMING: bool = os.getenv('ENABLE_STREAMING', 'true').lower() == 'true'
    ENABLE_HEALTH_CHECK: bool = os.getenv('ENABLE_HEALTH_CHECK', 'true').lower() == 'true'
    
    # Storage Configuration
    ENABLE_AUDIT_LOG: bool = os.getenv('ENABLE_AUDIT_LOG', 'false').lower() == 'true'
    AUDIT_LOG_PATH: str = os.getenv('AUDIT_LOG_PATH', './logs/audit.log')
    CACHE_ENABLED: bool = os.getenv('CACHE_ENABLED', 'false').lower() == 'true'
    CACHE_TTL: int = int(os.getenv('CACHE_TTL', '3600'))
    
    # Debug Configuration
    DEBUG_MODE: bool = os.getenv('DEBUG_MODE', 'true').lower() == 'true'
    VERBOSE_LOGGING: bool = os.getenv('VERBOSE_LOGGING', 'false').lower() == 'true'
    PROFILE_PERFORMANCE: bool = os.getenv('PROFILE_PERFORMANCE', 'true').lower() == 'true'
    
    def print_config(self):
        """Print current configuration (excluding sensitive data)"""
        print("=== ChatANON Backend Configuration ===")
        print(f"Server: {self.HOST}:{self.PORT}")
        print(f"Ollama: {self.OLLAMA_BASE_URL} (model: {self.OLLAMA_DEFAULT_MODEL})")
        print(f"Frontend Port: {self.FRONTEND_PORT}")
        cors_display = "All origins (*)" if self.CORS_ALLOW_ALL else ', '.join(self.CORS_ORIGINS)
        print(f"CORS Origins: {cors_display}")
        print(f"Features: Reasoning={self.ENABLE_REASONING}, WebSockets={self.ENABLE_WEBSOCKETS}")
        print(f"Debug: {self.DEBUG_MODE}, Verbose: {self.VERBOSE_LOGGING}")
        print("=" * 40)

# Create global config instance
config = Config()

# Environment-specific configurations
if os.getenv('ENVIRONMENT') == 'production':
    config.DEBUG_MODE = False
    config.RELOAD = False
    config.LOG_LEVEL = 'warning'
    config.VERBOSE_LOGGING = False
elif os.getenv('ENVIRONMENT') == 'testing':
    config.OLLAMA_TIMEOUT = 30
    config.REQUEST_TIMEOUT = 30
    config.ENABLE_AUDIT_LOG = False