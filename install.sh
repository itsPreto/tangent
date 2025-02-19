#!/bin/bash

set -e

# Colors
RED="\033[0;31m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
NC="\033[0m"

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

check_ollama() {
    command -v ollama &>/dev/null && print_status "Found existing Ollama installation" && return 0
    return 1
}

check_whisper() {
    [ -d "whisper.cpp" ] && [ -f "whisper.cpp/server" ] && print_status "Found existing Whisper.cpp installation" && return 0
    return 1
}

install_ollama() {
    if ! check_ollama; then
        print_status "Installing Ollama..."
        case "$(uname -s)" in
            Linux) curl -fsSL https://ollama.com/install.sh | sh ;;
            Darwin) command -v brew &>/dev/null && brew install ollama || print_error "Please install Ollama manually from https://ollama.com" ;;
            *) print_error "Unsupported operating system" ;;
        esac
    fi
}

setup_whisper() {
    if ! check_whisper; then
        print_status "Setting up Whisper.cpp..."
        git clone https://github.com/ggerganov/whisper.cpp
        cd whisper.cpp
        make
        bash ./models/download-ggml-model.sh base.en
        cd ..
    fi

    if ! pgrep -f "whisper.cpp/server" >/dev/null; then
        cd whisper.cpp
        ./server &>/dev/null &
        cd ..
        print_success "Whisper.cpp server started"
    else
        print_status "Whisper.cpp server already running"
    fi
}

check_and_start_services() {
    if ! pgrep -f "ollama serve" >/dev/null; then
        print_status "Starting Ollama server..."
        ollama serve &>/dev/null &
        sleep 2
    else
        print_status "Ollama server already running"
    fi

    if ! pgrep -f "whisper.cpp/server" >/dev/null && [ -d "whisper.cpp" ]; then
        print_status "Starting Whisper.cpp server..."
        cd whisper.cpp
        ./server &>/dev/null &
        cd ..
    fi
}

main() {
    # Ask user about installation preferences
    read -p "Install/update Ollama? [Y/n]: " install_ollama_choice
    read -p "Install/update Whisper.cpp? [Y/n]: " install_whisper_choice
    read -p "Install/update models (all-minilm, qwen2.5)? [Y/n]: " install_models_choice

    # Process choices
    case "$install_ollama_choice" in
        [Nn]*) : ;;
        *) install_ollama ;;
    esac

    case "$install_whisper_choice" in
        [Nn]*) : ;;
        *) setup_whisper ;;
    esac

    case "$install_models_choice" in
        [Nn]*) : ;;
        *) 
            print_status "Pulling Ollama models..."
            ollama pull all-minilm
            ollama pull qwen2.5
            ;;
    esac

    check_and_start_services

    # Setup backend
    print_status "Setting up backend..."
    cd tangent-api
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    pip install torch torchvision torchaudio

    print_status "Starting backend..."
    python3 src/app.py --embedding-model all-minilm --generation-model qwen2.5 &

    # Setup frontend
    print_status "Setting up frontend..."
    cd ../tangent-ui
    npm install
    npm start &

    print_success "Installation complete! Access at http://localhost:3000"
}

main "$@"
