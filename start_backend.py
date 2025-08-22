#!/usr/bin/env python3
"""
Start the ChatANON backend server
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from backend.api.main import app
from backend.config import config

if __name__ == "__main__":
    print("=" * 60)
    print("Starting ChatANON Backend Server")
    print("=" * 60)
    
    # Print configuration
    config.print_config()
    
    print("Server will be available at:")
    print(f"  - Local: http://localhost:{config.PORT}")
    print(f"  - Network: http://{config.HOST}:{config.PORT}")
    print("=" * 60)
    
    if config.RELOAD:
        # For development with reload
        uvicorn.run(
            "backend.api.main:app",
            host=config.HOST,
            port=config.PORT,
            log_level=config.LOG_LEVEL,
            reload=True
        )
    else:
        # For production
        uvicorn.run(
            app,
            host=config.HOST,
            port=config.PORT,
            log_level=config.LOG_LEVEL
        )