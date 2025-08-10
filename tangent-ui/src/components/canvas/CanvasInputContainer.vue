<template>
  <div class="canvas-input-container" 
       :class="{ 
         'transitioning': isTransitioning,
         'expanded': isExpanded,
         'has-content': hasContent,
         'morphing-to-node': isMorphingToNode,
         'animation-phase-morphing': animationPhase === 'morphing',
         'animation-phase-positioning': animationPhase === 'positioning', 
         'animation-phase-materializing': animationPhase === 'materializing',
         'claude-mode': isClaudeMode,
         'config-visible': isClaudeMode && showClaudeConfig
       }"
       :style="containerStyle">
    
    <!-- Main Container -->
    <div class="main-container">
      
      <!-- Claude Mode Header - Only shows when @claude detected -->
      <Transition name="slide-down">
        <div v-if="isClaudeMode" class="claude-header">
          <div class="claude-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="claude-logo">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Claude Code</span>
            <button 
              @click="showClaudeConfig = !showClaudeConfig"
              class="config-toggle"
              :class="{ active: showClaudeConfig }"
            >
              <ChevronDown :size="14" v-if="!showClaudeConfig" />
              <ChevronUp :size="14" v-else />
            </button>
          </div>
          
          <!-- Quick status indicators -->
          <div class="claude-status">
            <div class="status-item" v-if="claudeConfig.workingDir">
              <Folder :size="12" />
              <span>{{ getShortPath(claudeConfig.workingDir) }}</span>
            </div>
            <div class="status-item">
              <DollarSign :size="12" />
              <span>${{ claudeConfig.costLimit }}</span>
            </div>
            <div class="status-item" v-if="claudeConfig.maxTurns">
              <RotateCw :size="12" />
              <span>{{ claudeConfig.maxTurns }}</span>
            </div>
          </div>
        </div>
      </Transition>
      
      <!-- Claude Configuration Panel - Clean dropdown -->
      <Transition name="expand">
        <div v-if="isClaudeMode && showClaudeConfig" class="claude-config-panel">
          
          <!-- Working Directory -->
          <div class="config-section">
            <label class="config-label">
              <Folder :size="14" />
              Working Directory
            </label>
            <input 
              type="text" 
              v-model="claudeConfig.workingDir" 
              placeholder="/Users/928546/Desktop/tangent"
              class="config-input"
              @focus="handleConfigFocus"
            />
          </div>
          
          <!-- Max Turns & Cost Limit Row -->
          <div class="config-row">
            <div class="config-section half">
              <label class="config-label">
                <RotateCw :size="14" />
                Max Turns
              </label>
              <input 
                type="number" 
                v-model.number="claudeConfig.maxTurns" 
                placeholder="30"
                min="1"
                max="100"
                class="config-input"
              />
            </div>
            
            <div class="config-section half">
              <label class="config-label">
                <DollarSign :size="14" />
                Cost Limit
              </label>
              <div class="cost-control">
                <input 
                  type="number" 
                  v-model.number="claudeConfig.costLimit" 
                  min="0.5"
                  max="50"
                  step="0.5"
                  class="config-input cost-input"
                />
                <span class="cost-unit">USD</span>
              </div>
            </div>
          </div>
          
          <!-- Allowed Tools -->
          <div class="config-section">
            <label class="config-label">
              <Wrench :size="14" />
              Allowed Tools
            </label>
            <div class="tools-grid">
              <button 
                v-for="tool in availableClaudeTools" 
                :key="tool.id"
                @click="toggleClaudeTool(tool.id)"
                class="tool-tile"
                :class="{ 
                  active: claudeConfig.allowedTools.includes(tool.id),
                  disabled: tool.disabled 
                }"
                :title="tool.description"
              >
                <component :is="tool.icon" :size="16" />
                <span>{{ tool.name }}</span>
              </button>
            </div>
          </div>
          
          <!-- System Prompt -->
          <div class="config-section">
            <label class="config-label">
              <FileText :size="14" />
              System Prompt
              <button 
                @click="showSystemPrompt = !showSystemPrompt"
                class="expand-btn"
              >
                <ChevronDown :size="12" v-if="!showSystemPrompt" />
                <ChevronUp :size="12" v-else />
              </button>
            </label>
            <textarea 
              v-if="showSystemPrompt"
              v-model="claudeConfig.systemPrompt" 
              placeholder="Optional system prompt to guide Claude's behavior..."
              class="config-textarea"
              rows="3"
            />
          </div>
          
          <!-- Advanced Settings -->
          <div class="config-section">
            <label class="config-label">
              <Settings2 :size="14" />
              Advanced
              <button 
                @click="showAdvanced = !showAdvanced"
                class="expand-btn"
              >
                <ChevronDown :size="12" v-if="!showAdvanced" />
                <ChevronUp :size="12" v-else />
              </button>
            </label>
            
            <div v-if="showAdvanced" class="advanced-settings">
              <!-- MCP Config -->
              <div class="config-subsection">
                <label class="config-sublabel">MCP Config Path</label>
                <input 
                  type="text" 
                  v-model="claudeConfig.mcpConfig" 
                  placeholder="Optional path to MCP config"
                  class="config-input small"
                />
              </div>
              
              <!-- Resume Session -->
              <div class="config-subsection">
                <label class="config-sublabel">Resume Session ID</label>
                <input 
                  type="text" 
                  v-model="claudeConfig.resumeSession" 
                  placeholder="Optional session ID to resume"
                  class="config-input small"
                />
              </div>
            </div>
          </div>
          
        </div>
      </Transition>
      
      <!-- Main Input Area -->
      <div class="input-section">
        <div class="input-wrapper" 
             :class="{ 
               'focused': isFocused, 
               'has-content': hasContent,
               'claude-mode': isClaudeMode
             }"
             ref="inputWrapperRef"
             @wheel="handleWheel">
          
          <!-- Input field -->
          <div class="input-area">
            <div
              ref="editableRef"
              contenteditable="true"
              class="input-field"
              :placeholder="inputPlaceholder"
              @input="handleInput"
              @keydown="handleKeyDown"
              @focus="handleFocus"
              @blur="handleBlur"
              @paste="handlePaste"
              @scroll="handleScroll"
              @wheel="handleWheel"
            ></div>
          </div>

          <!-- Action buttons -->
          <div class="input-actions">
            <!-- Voice button -->
            <button
              v-if="!hasContent || isRecording"
              @click="toggleVoice"
              class="action-btn voice-btn"
              :class="{ 'recording': isRecording, 'processing': isProcessing }"
              :title="getVoiceTitle()"
            >
              <Mic v-if="!isRecording && !isProcessing" :size="18" />
              <div v-else-if="isRecording" class="recording-indicator">
                <div class="pulse-dot"></div>
              </div>
              <Loader2 v-else :size="18" class="spin" />
            </button>

            <!-- Send/Launch button -->
            <button
              @click="handleSend"
              class="action-btn send-btn"
              :class="{ 
                'ready': hasContent && !isLoading,
                'claude-launch': isClaudeMode && hasContent
              }"
              :disabled="!hasContent || isLoading"
              :title="isClaudeMode ? 'Launch Claude Code' : 'Start your workspace'"
            >
              <Sparkles v-if="isClaudeMode" :size="18" />
              <Send v-else :size="18" />
              <span v-if="isClaudeMode" class="launch-text">Launch</span>
            </button>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Example prompts (hidden in Claude mode) -->
    <Transition name="fade-in-up">
      <div v-if="showHints && !hasContent && !isClaudeMode" class="example-prompts">
        <button 
          v-for="prompt in examplePrompts" 
          :key="prompt"
          @click="setPrompt(prompt)"
          class="example-prompt"
        >
          {{ prompt }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { 
  Mic, 
  Send, 
  Loader2, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Folder,
  DollarSign,
  RotateCw,
  Wrench,
  FileText,
  Settings2,
  Terminal,
  Code,
  FileSearch,
  GitBranch,
  Database,
  Globe,
  Shield,
  Zap
} from 'lucide-vue-next';
import { useCanvasStore } from '../../stores/canvasStore';
import { useChatStore } from '../../stores/chatStore';
import { useAgentStore } from '../../stores/agentStore';
import emitter, { Events } from '../../utils/eventBus';

const props = defineProps<{
  modelValue?: string;
  placeholder?: string;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'send': [value: string];
  'voice-start': [];
  'voice-stop': [];
}>();

// Store refs
const canvasStore = useCanvasStore();
const chatStore = useChatStore();
const agentStore = useAgentStore();

// State
const isFocused = ref(false);
const hasContent = ref(false);
const isRecording = ref(false);
const isProcessing = ref(false);
const isTransitioning = ref(false);
const isMorphingToNode = ref(false);
const animationPhase = ref<'none' | 'morphing' | 'positioning' | 'materializing'>('none');
const isExpanded = ref(false);
const showHints = ref(true);
const inputContent = ref('');
const isClaudeMode = ref(false);
const showClaudeConfig = ref(false);
const showSystemPrompt = ref(false);
const showAdvanced = ref(false);

// Claude configuration
const claudeConfig = ref({
  workingDir: '/Users/928546/Desktop/tangent',
  maxTurns: 30,
  costLimit: 2.0,
  allowedTools: ['bash', 'edit', 'search'],
  systemPrompt: '',
  mcpConfig: '',
  resumeSession: '',
  initialPrompt: ''
});

// Available Claude tools
const availableClaudeTools = [
  { id: 'bash', name: 'Bash', icon: Terminal, description: 'Execute shell commands' },
  { id: 'edit', name: 'Edit', icon: Code, description: 'Edit files' },
  { id: 'search', name: 'Search', icon: FileSearch, description: 'Search in files' },
  { id: 'git', name: 'Git', icon: GitBranch, description: 'Git operations' },
  { id: 'database', name: 'Database', icon: Database, description: 'Database queries' },
  { id: 'web', name: 'Web', icon: Globe, description: 'Web requests' },
  { id: 'mcp', name: 'MCP', icon: Shield, description: 'MCP tools', disabled: !claudeConfig.value.mcpConfig },
  { id: 'agent', name: 'Agent', icon: Zap, description: 'AI agents' }
];

// Refs
const editableRef = ref<HTMLDivElement>();
const inputWrapperRef = ref<HTMLDivElement>();

// Example prompts
const examplePrompts = [
  "Create a React dashboard",
  "Analyze this codebase",
  "Fix the bug in app.py"
];

// Computed
const inputPlaceholder = computed(() => {
  if (isClaudeMode.value) {
    return "Describe what you want Claude to build...";
  }
  return props.placeholder || "What would you like to explore?";
});

const containerStyle = computed(() => {
  return {
    '--container-x': '0px',
    '--container-y': '0px',
    '--container-width': isClaudeMode.value && showClaudeConfig.value ? '700px' : '600px'
  };
});

// Methods
const getShortPath = (path: string) => {
  if (!path) return '';
  const parts = path.split('/');
  if (parts.length > 3) {
    return `.../${parts.slice(-2).join('/')}`;
  }
  return path;
};

const toggleClaudeTool = (toolId: string) => {
  const index = claudeConfig.value.allowedTools.indexOf(toolId);
  if (index > -1) {
    claudeConfig.value.allowedTools.splice(index, 1);
  } else {
    claudeConfig.value.allowedTools.push(toolId);
  }
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLDivElement;
  const text = target.innerText || '';
  inputContent.value = text;
  hasContent.value = text.trim().length > 0;
  
  // Check for @claude trigger
  isClaudeMode.value = text.includes('@claude');
  
  emit('update:modelValue', text);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};

const handleFocus = () => {
  isFocused.value = true;
  canvasStore.handleContainerFocus();
};

const handleBlur = () => {
  isFocused.value = false;
};

const handleConfigFocus = () => {
  // Prevent container from losing focus when interacting with config
};

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
};

const handleScroll = (event: Event) => {
  event.stopPropagation();
};

const handleWheel = (event: WheelEvent) => {
  event.stopPropagation();
};

const handleSend = async () => {
  if (!hasContent.value || props.isLoading) return;
  
  const content = inputContent.value.trim();
  
  if (isClaudeMode.value) {
    // Prepare Claude Code configuration
    const config = {
      ...claudeConfig.value,
      initialPrompt: content.replace('@claude', '').trim()
    };
    
    // Launch Claude Code instance
    await agentStore.launchClaudeCode(config);
  } else {
    emit('send', content);
  }
  
  // Clear input
  if (editableRef.value) {
    editableRef.value.innerText = '';
    inputContent.value = '';
    hasContent.value = false;
  }
};

const toggleVoice = () => {
  if (isRecording.value) {
    emit('voice-stop');
    isRecording.value = false;
  } else {
    emit('voice-start');
    isRecording.value = true;
  }
};

const getVoiceTitle = () => {
  if (isProcessing.value) return 'Processing...';
  if (isRecording.value) return 'Click to stop recording';
  return 'Click to start voice input';
};

const setPrompt = (prompt: string) => {
  if (editableRef.value) {
    editableRef.value.innerText = prompt;
    inputContent.value = prompt;
    hasContent.value = true;
    emit('update:modelValue', prompt);
    editableRef.value.focus();
  }
};

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
  if (editableRef.value && newValue !== inputContent.value) {
    editableRef.value.innerText = newValue || '';
    inputContent.value = newValue || '';
    hasContent.value = (newValue || '').trim().length > 0;
  }
});

// Lifecycle
onMounted(() => {
  // Initialize with prop value if provided
  if (props.modelValue && editableRef.value) {
    editableRef.value.innerText = props.modelValue;
    inputContent.value = props.modelValue;
    hasContent.value = props.modelValue.trim().length > 0;
  }
});
</script>

<style scoped>
.canvas-input-container {
  position: absolute;
  left: var(--container-x);
  top: var(--container-y);
  width: var(--container-width);
  max-width: 90vw;
  z-index: 1000;
  pointer-events: auto;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-container {
  background: color-mix(in srgb, oklch(var(--b1)) 98%, oklch(var(--p)) 2%);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  border-radius: 16px;
  box-shadow: 
    0 4px 24px -2px oklch(from oklch(var(--bc)) l c h / 0.1),
    0 0 0 1px oklch(from oklch(var(--bc)) l c h / 0.05);
  overflow: hidden;
  backdrop-filter: blur(20px);
}

/* Claude Header */
.claude-header {
  padding: 12px 16px;
  background: linear-gradient(
    to right,
    color-mix(in srgb, oklch(var(--p)) 5%, transparent),
    transparent
  );
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.claude-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: oklch(var(--bc));
}

.claude-logo {
  color: oklch(var(--p));
}

.config-toggle {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  border-radius: 4px;
  transition: all 0.2s;
}

.config-toggle:hover {
  background: oklch(from oklch(var(--bc)) l c h / 0.08);
  color: oklch(var(--bc));
}

.config-toggle.active {
  color: oklch(var(--p));
}

.claude-status {
  display: flex;
  gap: 16px;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.status-item svg {
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
}

/* Claude Configuration Panel */
.claude-config-panel {
  padding: 20px;
  background: oklch(from oklch(var(--b2)) l c h / 0.3);
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.08);
}

.config-section {
  margin-bottom: 16px;
}

.config-section:last-child {
  margin-bottom: 0;
}

.config-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.config-section.half {
  flex: 1;
  margin-bottom: 0;
}

.config-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: oklch(var(--bc));
  margin-bottom: 8px;
}

.expand-btn {
  margin-left: auto;
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
  transition: color 0.2s;
}

.expand-btn:hover {
  color: oklch(var(--bc));
}

.config-input {
  width: 100%;
  padding: 8px 12px;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 8px;
  font-size: 13px;
  color: oklch(var(--bc));
  transition: all 0.2s;
}

.config-input:focus {
  outline: none;
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 3px oklch(from oklch(var(--p)) l c h / 0.1);
}

.config-input::placeholder {
  color: oklch(from oklch(var(--bc)) l c h / 0.4);
}

.cost-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cost-input {
  flex: 1;
}

.cost-unit {
  font-size: 12px;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  font-weight: 500;
}

/* Tools Grid */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.tool-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 8px;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.tool-tile:hover:not(.disabled) {
  background: oklch(from oklch(var(--p)) l c h / 0.08);
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  color: oklch(var(--bc));
}

.tool-tile.active {
  background: oklch(from oklch(var(--p)) l c h / 0.15);
  border-color: oklch(var(--p));
  color: oklch(var(--p));
}

.tool-tile.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-tile span {
  font-size: 11px;
  font-weight: 500;
}

/* Textarea */
.config-textarea {
  width: 100%;
  padding: 10px 12px;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 8px;
  font-size: 13px;
  color: oklch(var(--bc));
  resize: vertical;
  min-height: 60px;
  transition: all 0.2s;
  margin-top: 8px;
}

.config-textarea:focus {
  outline: none;
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 3px oklch(from oklch(var(--p)) l c h / 0.1);
}

/* Advanced Settings */
.advanced-settings {
  margin-top: 12px;
  padding: 12px;
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  border-radius: 8px;
}

.config-subsection {
  margin-bottom: 12px;
}

.config-subsection:last-child {
  margin-bottom: 0;
}

.config-sublabel {
  font-size: 12px;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  margin-bottom: 6px;
  display: block;
}

.config-input.small {
  padding: 6px 10px;
  font-size: 12px;
}

/* Input Section */
.input-section {
  padding: 16px;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 12px;
  padding: 12px;
  transition: all 0.2s;
}

.input-wrapper.focused {
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 3px oklch(from oklch(var(--p)) l c h / 0.1);
}

.input-wrapper.claude-mode {
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  background: linear-gradient(
    135deg,
    oklch(from oklch(var(--p)) l c h / 0.03),
    oklch(var(--b1))
  );
}

.input-area {
  flex: 1;
  min-height: 24px;
  max-height: 120px;
  overflow-y: auto;
}

.input-field {
  min-height: 24px;
  max-height: 120px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: oklch(var(--bc));
  outline: none;
}

.input-field:empty::before {
  content: attr(placeholder);
  color: oklch(from oklch(var(--bc)) l c h / 0.4);
}

.input-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  padding: 8px;
  background: oklch(from oklch(var(--bc)) l c h / 0.08);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 8px;
  cursor: pointer;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn:hover:not(:disabled) {
  background: oklch(from oklch(var(--bc)) l c h / 0.12);
  color: oklch(var(--bc));
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn.ready {
  background: oklch(var(--p));
  border-color: oklch(var(--p));
  color: oklch(var(--pc));
}

.send-btn.ready:hover {
  background: oklch(from oklch(var(--p)) calc(l * 0.9) c h);
}

.send-btn.claude-launch {
  background: linear-gradient(135deg, oklch(var(--p)), oklch(var(--s)));
  border: none;
  padding: 8px 16px;
  font-weight: 500;
}

.launch-text {
  font-size: 13px;
}

/* Voice Recording */
.recording-indicator {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: oklch(var(--er));
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Example Prompts */
.example-prompts {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  flex-wrap: wrap;
}

.example-prompt {
  padding: 6px 12px;
  background: oklch(from oklch(var(--bc)) l c h / 0.08);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 20px;
  font-size: 12px;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  cursor: pointer;
  transition: all 0.2s;
}

.example-prompt:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  color: oklch(var(--p));
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

.expand-enter-to,
.expand-leave-from {
  max-height: 600px;
  opacity: 1;
  transform: translateY(0);
}

.fade-in-up-enter-active,
.fade-in-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-in-up-enter-from {
  transform: translateY(10px);
  opacity: 0;
}

.fade-in-up-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
</style>