#!/usr/bin/env python3
"""
Build script for creating standalone executable of tangent-api
"""

import os
import sys
import subprocess
import shutil
import platform
from pathlib import Path

def get_executable_name():
    """Get the executable name based on platform"""
    if platform.system() == "Windows":
        return "tangent-api.exe"
    return "tangent-api"

def install_pyinstaller():
    """Install PyInstaller if not available"""
    try:
        import PyInstaller
        print("✓ PyInstaller already installed")
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

def build_executable():
    """Build the executable using PyInstaller"""
    spec_file = "tangent-api.spec"
    
    if not os.path.exists(spec_file):
        print(f"Error: {spec_file} not found!")
        return False
    
    print("Building executable with PyInstaller...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "PyInstaller",
            spec_file,
            "--clean",
            "--noconfirm"
        ])
        return True
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        return False

def setup_dist_directory():
    """Set up the distribution directory"""
    dist_dir = Path("dist")
    dist_dir.mkdir(exist_ok=True)
    
    # Copy executable from PyInstaller output
    exe_name = get_executable_name()
    source_exe = Path("dist") / exe_name
    
    if source_exe.exists():
        print(f"✓ Executable created: {source_exe}")
        return True
    else:
        print(f"✗ Executable not found: {source_exe}")
        return False

def main():
    """Main build process"""
    print("🚀 Building Tangent API executable...")
    
    # Change to the tangent-api directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Install PyInstaller
    install_pyinstaller()
    
    # Build executable
    if not build_executable():
        print("❌ Build failed!")
        return 1
    
    # Verify distribution
    if not setup_dist_directory():
        print("❌ Distribution setup failed!")
        return 1
    
    print("✅ Build completed successfully!")
    print(f"Executable location: {Path('dist') / get_executable_name()}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())