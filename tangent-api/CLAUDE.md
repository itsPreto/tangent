# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

Tangent is a visual AI conversation canvas that allows branching, resuming, and comparing chat threads. The project consists of:

### Backend (tangent-api/)
- **Flask API Server** (`app.py`): Main application server running on port 5050
- **Chat Persistence** (`ChatPersistenceService.py`): SQLite-based storage for conversation nodes and relationships using SQLAlchemy
- **Data Processing** (`ChatgptChatProcessor.py`): Processes ChatGPT export files, handles conversation branching and message reconstruction
- **Media Processing**: Supports image/video analysis via Ollama, OpenRouter, and Google Gemini APIs
- **Dependency Analysis**: Built-in project dependency analyzer for Vue/TypeScript codebases

### Frontend (tangent-ui/)
- **Vue 3 + TypeScript**: Component-based UI using Composition API
- **Pinia Stores**: State management for app, canvas, chat, model, and theme data
- **Canvas System**: Interactive infinite canvas with draggable conversation nodes
- **Multiple Provider Support**: Anthropic, OpenRouter, Google Gemini integration
- **SandPack Integration**: Live code editing and preview capabilities

## Development Commands

### Backend Setup
```bash
cd tangent-api
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python3 app.py
```

### Frontend Setup  
```bash
cd tangent-ui
bun install  # or npm install
bun run dev  # Development server
bun run build  # Production build
bun run typecheck  # Type checking
```

### Required External Services
- **Ollama**: Local LLM server for embeddings and chat (`ollama serve`)
- **Whisper.cpp**: Optional voice processing server

## Key Configuration

### API Endpoints
- Backend runs on `http://localhost:5050`
- Frontend dev server on `http://localhost:5173` (Vite)
- Supports CORS for development origins

### Database
- SQLite database (`instance/chats.db`) with Chat and Node models
- Automatic schema creation on startup
- Supports hierarchical conversation branching

### Model Integration
- **Chat APIs**: Anthropic Claude, OpenRouter, Google Gemini
- **Local Models**: Ollama with configurable embedding/generation models
- **Media Analysis**: Multi-provider image/video processing

## Architecture Patterns

### Conversation Structure
- **Chat**: Top-level conversation container
- **Nodes**: Individual conversation branches with parent-child relationships
- **Messages**: Arrays of chat messages within each node
- **Branching**: Supports creating alternate conversation paths at any message

### Component Organization
- `components/canvas/`: Interactive canvas and node rendering
- `components/messages/`: Chat message display and input
- `components/models/`: AI model selection and configuration
- `components/sandpack/`: Code editing and preview
- `components/settings/`: Application configuration
- `stores/`: Pinia state management

### Data Flow
1. Chat data imported via JSON upload (ChatGPT format)
2. Processed and stored in SQLite with branching relationships
3. Rendered on infinite canvas as draggable nodes
4. Real-time chat interaction with selected AI providers
5. State persistence across browser sessions