# Tool Call Architecture & Claude Code SDK Integration

## Overview

This document outlines the complete implementation of granular tool call visibility and Claude Code SDK integration within the Tangent multibranch chat system. This architecture transforms the canvas from a simple chat interface into a comprehensive AI development observatory.

## Architecture Changes

### Before: High-Level Chat Flow
```
[💬 Chat] ──────▶ [💬 Chat] ──────▶ [💬 Chat]
```

### After: Granular Tool Execution Visibility
```
[💬 Chat] ──┬──▶ [🔧 Read Tool] ──────▶ [📄 File Node] ──┐
            │                                            │
            ├──▶ [🔧 Write Tool] ─────▶ [📄 New File] ───┼──▶ [💬 Chat Response]
            │                                            │
            └──▶ [🔧 Bash Tool] ──────▶ [⚡ Execution] ──┘
```

## Database Schema

### New Tables

#### `tool_calls`
Tracks individual tool invocations and their results.
```sql
CREATE TABLE tool_calls (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    tool_name VARCHAR(50) NOT NULL,
    parameters JSONB,
    result JSONB,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'success', 'error'
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `file_nodes`
Tracks files created/modified by tool calls.
```sql
CREATE TABLE file_nodes (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    content_hash VARCHAR(64),
    mime_type VARCHAR(100),
    created_by UUID REFERENCES tool_calls(id),
    modified_by UUID REFERENCES tool_calls(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `execution_nodes`
Tracks command executions and their status.
```sql
CREATE TABLE execution_nodes (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    command TEXT NOT NULL,
    working_dir VARCHAR(500),
    environment JSONB,
    pid INTEGER,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed', 'killed'
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    started_by UUID REFERENCES tool_calls(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Backend Implementation

### Service Architecture

#### `ToolCallService` (`tangent-api/ToolCallService.py`)
Core service for managing tool call lifecycle:
- **Tool Execution**: Execute Read, Write, Bash tools
- **Status Tracking**: Track tool call status and results
- **Error Handling**: Capture and store error information
- **Duration Tracking**: Measure execution time

**Key Methods:**
- `create_tool_call()`: Create new tool call record
- `execute_read_tool()`: Execute file read operations
- `execute_write_tool()`: Execute file write operations
- `execute_bash_tool()`: Execute shell commands
- `terminate_execution()`: Kill running processes

#### `ClaudeCodeService` (`tangent-api/ClaudeCodeService.py`)
Manages Claude Code SDK instances:
- **Instance Management**: Create, pause, resume, stop instances
- **Session Persistence**: Save/restore Claude Code sessions
- **Real-time Streaming**: Monitor output via WebSocket
- **Tool Call Integration**: Bridge Claude Code tools to ToolCallService

**Key Features:**
- Subprocess management with monitoring
- JSON streaming input/output
- Session history persistence
- WebSocket notifications

### API Endpoints

#### Tool Call Management
```
GET  /api/tool-calls/node/{node_id}           # Get tool calls for node
GET  /api/tool-calls/{tool_call_id}           # Get tool call details
GET  /api/file-nodes/node/{node_id}           # Get file nodes for node
GET  /api/execution-nodes/node/{node_id}      # Get execution nodes for node
POST /api/execution-nodes/{exec_id}/terminate # Terminate execution
```

#### Claude Code Management
```
POST /api/claude-code/instances               # Create new instance
GET  /api/claude-code/instances               # Get all instances
GET  /api/claude-code/instances/{id}/status   # Get instance status
POST /api/claude-code/instances/{id}/message  # Send message to instance
POST /api/claude-code/instances/{id}/pause    # Pause instance
POST /api/claude-code/instances/{id}/resume   # Resume instance
POST /api/claude-code/instances/{id}/stop     # Stop instance
GET  /api/claude-code/sessions               # Get session history
POST /api/claude-code/sessions/{id}/resume   # Resume session
```

## Frontend Implementation

### New Vue Components

#### `ToolCallNode.vue`
Visual representation of individual tool calls:
- **Status Indicators**: Success, error, pending states
- **Parameter Display**: Show tool inputs
- **Result Visualization**: Different views for Read, Write, Bash
- **Action Buttons**: Cancel, rerun, copy operations
- **Expandable Details**: Full parameter and result view

#### `FileNode.vue`
Represents files created/modified by tools:
- **File Information**: Path, size, type, hash
- **History Tracking**: Creation and modification timeline
- **Preview Support**: Text file content preview
- **Quick Actions**: Open, edit, run file operations
- **MIME Type Icons**: Visual file type indicators

#### `ExecutionNode.vue`
Shows command execution status and output:
- **Live Output**: Real-time stdout/stderr display
- **Process Information**: PID, exit code, duration
- **Interactive Controls**: Terminate, restart commands
- **Log Management**: Download execution logs
- **Status Visualization**: Running, completed, failed states

### State Management

#### `toolCallStore.ts`
Pinia store for managing tool call data:
```typescript
interface ToolCall {
  id: string
  node_id: string
  tool_name: string
  parameters: Record<string, any>
  result?: Record<string, any>
  status: 'pending' | 'success' | 'error'
  error_message?: string
  duration_ms?: number
  created_at: string
  updated_at: string
}
```

**Key Actions:**
- `fetchToolCallsForNode()`: Load tool calls for specific node
- `createClaudeCodeInstance()`: Create new Claude Code instance
- `terminateExecution()`: Stop running executions
- `getInstanceStatus()`: Get real-time instance status

### Canvas Integration

The `InfiniteCanvas.vue` component has been extended to render new node types:

1. **Dynamic Loading**: Tool call data loaded when nodes become visible
2. **Position Calculation**: Smart positioning relative to parent nodes
3. **Event Handling**: Click, double-click, and action events
4. **Visual Hierarchy**: Clear relationship between chat and tool nodes

## Claude Code SDK Integration

### Configuration Options
```typescript
interface ClaudeCodeConfig {
  initial_prompt: string
  working_dir: string
  max_turns: number
  system_prompt?: string
  allowed_tools: string[]
  mcp_config?: string
  resume_session?: string
}
```

### Instance Lifecycle
1. **Creation**: `createClaudeCodeInstance(config)`
2. **Monitoring**: Real-time output streaming
3. **Tool Extraction**: Parse tool use from assistant messages
4. **Status Updates**: Track cost, turns, duration
5. **Session Persistence**: Save state for resumption

### Tool Call Pipeline
```
Claude Code Message → Tool Use Detected → ToolCall Created → Tool Executed → Result Stored → UI Updated
```

## Usage Workflows

### 1. Basic Tool Call Visibility
1. User sends message to chat node
2. AI response includes tool calls
3. Tool call nodes appear connected to chat
4. Results show in file/execution nodes
5. User can inspect each step

### 2. Claude Code Development Session
1. Create Claude Code instance from chat
2. Instance appears as new node type
3. Tool calls stream in real-time
4. File changes appear as file nodes
5. Commands show as execution nodes
6. Full development timeline visible

### 3. Debugging and Inspection
1. Click tool call node to see parameters
2. View file diff in file node
3. Check command output in execution node
4. Trace error propagation through graph
5. Rerun individual tools if needed

## Performance Considerations

### Database Optimization
- **Indexes**: On node_id, tool_name, status, created_at
- **Cleanup**: Periodic cleanup of old execution logs
- **Chunking**: Paginate large result sets

### Frontend Optimization
- **Lazy Loading**: Load tool data only for visible nodes
- **Virtualization**: Handle large numbers of tool nodes
- **Debouncing**: Throttle real-time updates
- **Caching**: Cache tool call data in store

### Backend Optimization
- **Process Management**: Clean up zombie processes
- **Memory Limits**: Limit subprocess memory usage
- **Connection Pooling**: Reuse database connections
- **Async Operations**: Non-blocking tool execution

## Security Considerations

### Tool Execution Safety
- **Sandboxing**: Execute tools in restricted environment
- **Path Validation**: Prevent directory traversal
- **Command Filtering**: Whitelist allowed commands
- **Resource Limits**: CPU and memory constraints

### API Security
- **Authentication**: Validate API requests
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **Process Isolation**: Separate user workspaces

## Development Roadmap

### Phase 1: Core Implementation ✅
- [x] Database schema
- [x] Backend services
- [x] Vue components
- [x] Canvas integration
- [x] Basic tool call tracking

### Phase 2: Claude Code Integration 🚧
- [ ] SDK subprocess management
- [ ] Real-time streaming
- [ ] Session persistence
- [ ] WebSocket notifications
- [ ] Instance management UI

### Phase 3: Advanced Features 📋
- [ ] Tool call branching
- [ ] Collaborative sessions
- [ ] Version control integration
- [ ] Advanced debugging tools
- [ ] Performance analytics

### Phase 4: Enterprise Features 📋
- [ ] Multi-user workspaces
- [ ] Access controls
- [ ] Audit logging
- [ ] Resource quotas
- [ ] Advanced monitoring

## Configuration and Setup

### Prerequisites
1. **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
2. **API Keys**: Anthropic API key configured
3. **Python Dependencies**: See `requirements.txt`
4. **Node Dependencies**: See `package.json`

### Environment Variables
```bash
ANTHROPIC_API_KEY=your_api_key_here
CLAUDE_CODE_USE_BEDROCK=0  # Optional
CLAUDE_CODE_USE_VERTEX=0   # Optional
```

### Database Migration
```bash
# Backup existing database
cp tangent-api/chats.db tangent-api/chats.db.backup

# Start Flask app to auto-create new tables
cd tangent-api && python3 app.py
```

### Frontend Setup
```bash
cd tangent-ui
npm install
npm run dev
```

## Troubleshooting

### Common Issues

#### Tool Calls Not Appearing
- Check API endpoint connectivity
- Verify tool call data in database
- Ensure proper node visibility
- Check console for errors

#### Claude Code Instance Failures
- Verify Claude CLI installation
- Check API key configuration
- Monitor subprocess status
- Review error logs

#### Performance Issues
- Check database query performance
- Monitor memory usage
- Review network requests
- Optimize visible node count

### Debug Commands
```bash
# Check tool calls for node
curl http://127.0.0.1:5050/api/tool-calls/node/{node_id}

# Check Claude Code instances
curl http://127.0.0.1:5050/api/claude-code/instances

# Monitor database
sqlite3 tangent-api/chats.db "SELECT * FROM tool_calls LIMIT 10;"
```

## Contributing

### Code Style
- Follow existing Vue/TypeScript patterns
- Use Pinia for state management
- Implement proper error handling
- Add TypeScript types for all interfaces

### Testing
- Test tool call execution paths
- Verify UI component behavior
- Check database constraints
- Validate API responses

### Documentation
- Update this document for new features
- Add inline code comments
- Create user guides
- Document API changes

## Future Enhancements

### Advanced Visualization
- **Flow Diagrams**: Show tool call dependencies
- **Timeline View**: Chronological execution view
- **Metrics Dashboard**: Performance analytics
- **Error Tracking**: Centralized error management

### Integration Opportunities
- **VS Code Extension**: Edit files in VS Code
- **Git Integration**: Track changes with git
- **Docker Support**: Containerized execution
- **CI/CD Pipelines**: Automated testing

### User Experience Improvements
- **Keyboard Shortcuts**: Power user features
- **Search and Filter**: Find specific tool calls
- **Bulk Operations**: Manage multiple items
- **Export Functionality**: Share execution logs

This architecture provides a solid foundation for building a comprehensive AI development environment with full visibility into tool execution and Claude Code integration.