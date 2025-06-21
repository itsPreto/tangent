#!/usr/bin/env python3
"""
Setup script for Whisper VAD integration with Tangent
This script checks for required dependencies and provides setup instructions.
"""

import os
import subprocess
import sys
from pathlib import Path

def check_command(command):
    """Check if a command is available in the system."""
    try:
        result = subprocess.run([command, '--version'], capture_output=True)
        # Command exists if it doesn't raise FileNotFoundError
        return True
    except FileNotFoundError:
        return False

def check_file_exists(path):
    """Check if a file exists."""
    return os.path.exists(path)

def main():
    print("🎤 Tangent Whisper VAD Setup Checker")
    print("=" * 50)
    
    # Check for ffmpeg
    print("\n1. Checking for ffmpeg...")
    if check_command('ffmpeg'):
        print("   ✅ ffmpeg is installed")
    else:
        print("   ❌ ffmpeg is NOT installed")
        print("   📥 Install with: brew install ffmpeg (macOS) or apt install ffmpeg (Ubuntu)")
    
    # Check for whisper.cpp paths
    whisper_base = "/Users/928546/Desktop/whisper.cpp"
    print(f"\n2. Checking Whisper.cpp installation at {whisper_base}...")
    
    whisper_cli = f"{whisper_base}/build/bin/whisper-cli"
    model_base = f"{whisper_base}/models/ggml-base.en.bin"
    vad_model = f"{whisper_base}/models/ggml-silero-v5.1.2.bin"
    
    if check_file_exists(whisper_cli):
        print("   ✅ whisper-cli binary found")
    else:
        print("   ❌ whisper-cli binary NOT found")
        print(f"   🔨 Build with: cd {whisper_base} && make")
    
    if check_file_exists(model_base):
        print("   ✅ Base English model found")
    else:
        print("   ❌ Base English model NOT found")
        print(f"   📥 Download with: cd {whisper_base} && ./models/download-ggml-model.sh base.en")
    
    if check_file_exists(vad_model):
        print("   ✅ Silero VAD model found")
    else:
        print("   ❌ Silero VAD model NOT found")
        print(f"   📥 Download with: cd {whisper_base} && ./models/download-vad-model.sh silero-v5.1.2")
    
    # Check Python requirements
    print("\n3. Checking Python environment...")
    try:
        import flask
        print("   ✅ Flask is installed")
    except ImportError:
        print("   ❌ Flask is NOT installed")
        print("   📥 Install with: pip install flask")
    
    # Create audio temp directory
    audio_dir = "audio_temp"
    if not os.path.exists(audio_dir):
        os.makedirs(audio_dir)
        print(f"   ✅ Created {audio_dir} directory")
    else:
        print(f"   ✅ {audio_dir} directory exists")
    
    print("\n🎯 Quick Setup Commands:")
    print("   1. Install ffmpeg: brew install ffmpeg")
    print(f"   2. Build whisper.cpp: cd {whisper_base} && make")
    print(f"   3. Download models: cd {whisper_base} && ./models/download-ggml-model.sh base.en")
    print(f"   4. Download VAD model: cd {whisper_base} && ./models/download-vad-model.sh silero-v5.1.2")
    print("   5. Install Python deps: pip install flask flask-cors")
    
    print("\n🚀 Test the setup by running the Flask app and trying voice input!")

if __name__ == "__main__":
    main()