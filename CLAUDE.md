# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (tangent-api/)
```bash
# Start Flask development server (default port 5050)
python3 app.py

# Backend runs at http://127.0.0.1:5050
# Main database: SQLite at tangent-api/chats.db
```

### Frontend (tangent-ui/)
```bash
# Development server (port 3000, proxies API to :5050)
bunx --bun vite
# or npm run dev

# Build for production
bunx --bun vue-tsc -b && bunx --bun vite build
# or npm run build

# Type checking
bunx --bun vue-tsc --noEmit
# or npm run typecheck

# Preview production build
bunx --bun vite preview
# or npm run preview
```

## Architecture Overview

### Backend Structure (tangent-api/)
- **Single Flask app (app.py)**: Monolithic file with ~67 API endpoints
- **Service Classes**: Modular services for specific functionality
  - `ChatPersistenceService`: SQLAlchemy ORM with Chat/Node models
  - `EmbeddingService`, `ClusteringService`: ML processing
  - `ConversationImportService`: ChatGPT/Claude data import
  - `RelicService`, `ThumbnailService`: File/media management
- **Database**: SQLite with Chat and Node models supporting branching conversations
- **Key Dependencies**: Flask, SQLAlchemy, sentence-transformers, chromadb

### Frontend Structure (tangent-ui/)
- **Vue 3 + TypeScript**: Composition API with `<script setup>` pattern
- **State Management**: 7 Pinia stores (chat, agent, app, canvas, model, project, theme)
- **Build System**: Vite + Bun for development, TypeScript compilation
- **UI Framework**: Tailwind CSS + custom components in `/components/ui/`
- **Canvas System**: Three.js/TresJS for 3D visualization, D3.js for force graphs

### API Architecture
The backend exposes 67 endpoints across these domains:
- **Chat Management**: CRUD operations for chats and nodes (`/chats`, `/chats/<id>/nodes`)
- **AI Providers**: Anthropic, OpenRouter, Google Gemini integration (`/api/chat/*`)
- **Media Processing**: Audio transcription, TTS, thumbnails (`/api/transcribe-audio`, `/api/text-to-speech`)
- **Ollama Proxy**: Local model management (`/api/ollama/*`, `/api/ollama-proxy/*`)
- **Relics**: Code artifact versioning system (`/api/relics`)
- **System**: Clustering, imports, dependency analysis (`/api/clustering`, `/api/import`)

### Key Patterns

#### Frontend Data Flow
```typescript
// API communication via centralized service
const apiService = new ApiService() // baseUrl: http://127.0.0.1:5050

// Pinia stores with composition API
const chatStore = useChatStore()
await chatStore.loadChats() // Fetches from /chats endpoint

// Types defined in /src/types/ (chat.ts, message.ts, etc.)
```

#### Backend Service Pattern
```python
# Services initialized in app.py
chat_service = ChatPersistenceService(app)
embedding_service = EmbeddingService()

# Flask routes directly in app.py with Blueprint separation
@app.route('/chats', methods=['POST'])
def create_chat():
    # Direct endpoint implementation
```

### Development Notes
- **CORS**: Configured for localhost:3000, :5173, :8080 development servers
- **File Structure**: Frontend uses `/src/components/` organized by feature (canvas, messages, workspace, etc.)
- **Database**: SQLite with Chat->Node hierarchy supporting conversation branching
- **API Base**: Frontend hardcoded to http://127.0.0.1:5050, backend runs on port 5050
- **Build**: Uses Bun for faster package management, Vite for bundling with code splitting

## API Testing Protocol

**CRITICAL**: Before implementing or modifying frontend API calls, ALWAYS test endpoints with curl first to understand the exact request/response format the backend expects.

### Testing Workflow
1. **Before Frontend Changes**: Test any API endpoint modifications with curl
2. **Verify Request Format**: Check what parameters the backend actually requires
3. **Validate Response**: Ensure the response structure matches frontend expectations
4. **Then Update Frontend**: Only after confirming the API works via curl

### Common API Testing Examples
```bash
# Test chat creation (requires both title AND initialNode)
curl -X POST http://127.0.0.1:5050/chats \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Chat", "initialNode": {"title": "Root Thread", "x": 100, "y": 100, "messages": [], "metadata": {}}}'

# Test GET endpoints
curl http://127.0.0.1:5050/chats
curl http://127.0.0.1:5050/api/claude-code/instances

# Test with authentication if needed
curl -H "Authorization: Bearer token" http://127.0.0.1:5050/api/endpoint
```

### Why This Matters
- Backend API contracts may differ from frontend assumptions
- Prevents wasted time debugging frontend issues that are actually API mismatches
- Ensures reliable integration between frontend and backend
- Catches parameter requirement mismatches early