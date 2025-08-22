#!/usr/bin/env python3
"""
Start both ChatANON backend and frontend services
"""

import subprocess
import sys
import time
import os
from pathlib import Path

def start_backend():
    """Start the backend service"""
    print("🚀 Starting ChatANON Backend...")
    backend_process = subprocess.Popen([
        sys.executable, "start_backend.py"
    ], cwd=Path(__file__).parent)
    return backend_process

def start_frontend():
    """Start the frontend service"""
    print("🎨 Starting ChatANON Frontend...")
    frontend_dir = Path(__file__).parent / "frontend"
    frontend_process = subprocess.Popen([
        "npm", "start"
    ], cwd=frontend_dir)
    return frontend_process

def main():
    """Main function to start both services"""
    print("=" * 60)
    print("ChatANON Service Launcher")
    print("=" * 60)
    
    try:
        # Start backend
        backend_proc = start_backend()
        time.sleep(3)  # Give backend time to start
        
        # Start frontend
        frontend_proc = start_frontend()
        
        print("\n✅ Both services started!")
        print("📊 Backend: http://localhost:8081")
        print("🖥️  Frontend: http://localhost:3001")
        print("\nPress Ctrl+C to stop both services...")
        
        # Wait for processes
        try:
            backend_proc.wait()
            frontend_proc.wait()
        except KeyboardInterrupt:
            print("\n🛑 Stopping services...")
            backend_proc.terminate()
            frontend_proc.terminate()
            
            # Wait for clean shutdown
            backend_proc.wait()
            frontend_proc.wait()
            
            print("✅ Services stopped cleanly")
            
    except Exception as e:
        print(f"❌ Error starting services: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())