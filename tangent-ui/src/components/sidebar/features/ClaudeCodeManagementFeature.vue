<template>
  <div class="claude-code-management">
    <!-- Overview Panel -->
    <div class="panel overview-panel">
      <div class="panel-header">
        <h3 class="panel-title">Claude Code Overview</h3>
        <div class="panel-actions">
          <button @click="refreshInstances" class="icon-btn" title="Refresh">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="panel-content">
        <div class="overview-stats">
          <div class="stat-box">
            <div class="stat-number">{{ claudeCodeInstances.length }}</div>
            <div class="stat-label">Active Sessions</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${{ totalCost.toFixed(2) }}</div>
            <div class="stat-label">Total Cost</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">{{ totalMemoryUsage }}</div>
            <div class="stat-label">Memory Used</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Sessions Panel -->
    <div class="panel sessions-panel">
      <div class="panel-header">
        <h3 class="panel-title">Active Sessions</h3>
        <div class="panel-actions">
          <button @click="showCreateForm = !showCreateForm" class="icon-btn" :class="{ active: showCreateForm }" title="New Session">
            <Plus class="w-4 h-4" />
          </button>
        </div>
      </div>
      

      <div class="panel-content">
        <!-- Create Form -->
        <div v-if="showCreateForm" class="create-form">
          <div class="form-grid">
            <input 
              v-model="newInstance.name" 
              class="form-field" 
              placeholder="Session name"
              type="text"
            />
            <input 
              v-model="newInstance.working_dir" 
              class="form-field" 
              placeholder="Working directory"
              type="text"
            />
            <textarea 
              v-model="newInstance.initial_prompt" 
              class="form-field form-textarea" 
              placeholder="Initial prompt..."
              rows="4"
            ></textarea>
          </div>
          <div class="form-actions">
            <button 
              @click="createInstance" 
              class="btn-primary"
              :disabled="!canCreateInstance"
            >
              Create Session
            </button>
            <button 
              @click="showCreateForm = false" 
              class="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Sessions List -->
        <div v-else>
          <div v-if="claudeCodeInstances.length === 0" class="empty-state">
            <div class="empty-icon">🤖</div>
            <div class="empty-message">No active sessions</div>
            <div class="empty-hint">Create a new session to get started</div>
          </div>
          
          <div v-else class="sessions-list">
            <div v-for="instance in claudeCodeInstances" :key="instance.instance_id" class="session-card">
              <div class="session-header">
                <div class="session-info">
                  <div class="session-name">{{ instance.config?.name || `Process ${instance.pid}` }}</div>
                  <div class="session-meta">
                    <span class="status-dot" :class="instance.status"></span>
                    <span class="status-text">{{ instance.status }}</span>
                    <span class="session-separator">•</span>
                    <span class="session-duration">{{ formatDuration(instance.duration_ms || 0) }}</span>
                  </div>
                </div>
                <div class="session-actions">
                  <button v-if="instance.status === 'running'" @click="pauseInstance(instance.instance_id)" 
                          class="action-btn pause" title="Pause">
                    <Pause class="w-3 h-3" />
                  </button>
                  <button v-if="instance.status === 'paused'" @click="resumeInstance(instance.instance_id)"
                          class="action-btn resume" title="Resume">
                    <Play class="w-3 h-3" />
                  </button>
                  <button @click="stopInstance(instance.instance_id)" class="action-btn stop" title="Stop">
                    <Square class="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div class="session-details">
                <div class="detail-row">
                  <span class="detail-label">Directory</span>
                  <span class="detail-value">{{ instance.working_dir.split('/').pop() || 'Unknown' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Memory</span>
                  <span class="detail-value">{{ instance.memory_mb ? instance.memory_mb.toFixed(0) + 'MB' : 'N/A' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Cost</span>
                  <span class="detail-value">${{ (instance.cost_usd || 0).toFixed(3) }}</span>
                </div>
                <div v-if="instance.is_detected" class="detail-row">
                  <span class="detail-label">Source</span>
                  <span class="detail-value detected">🔍 Auto-detected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Info Panel -->
    <div class="panel system-panel">
      <div class="panel-header">
        <h3 class="panel-title">System Information</h3>
        <div class="panel-actions">
          <button @click="showSystemInfo = !showSystemInfo" class="icon-btn" :class="{ active: showSystemInfo }" title="Toggle System Info">
            <Info class="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div v-if="showSystemInfo" class="panel-content">
        <div class="system-grid">
          <div class="system-item">
            <div class="system-label">Platform</div>
            <div class="system-value">{{ systemInfo.platform }}</div>
          </div>
          <div class="system-item">
            <div class="system-label">Memory</div>
            <div class="system-value">{{ systemInfo.availableMemory }} / {{ systemInfo.totalMemory }}</div>
          </div>
          <div class="system-item">
            <div class="system-label">CPU Cores</div>
            <div class="system-value">{{ systemInfo.cpuCount }}</div>
          </div>
          <div class="system-item">
            <div class="system-label">Last Update</div>
            <div class="system-value">{{ formatTime(lastUpdateTime) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tools & Permissions Panel -->
    <div class="panel tools-panel">
      <div class="panel-header">
        <h3 class="panel-title">Tools & Permissions</h3>
      </div>
      <div class="panel-content">
        <div class="tools-section">
          <div class="tools-header">Available Tools</div>
          <div class="tools-grid">
            <span class="tool-chip">Read</span>
            <span class="tool-chip">Write</span>
            <span class="tool-chip">Edit</span>
            <span class="tool-chip">Bash</span>
            <span class="tool-chip">WebFetch</span>
            <span class="tool-chip">Grep</span>
          </div>
        </div>
        <div class="permission-section">
          <div class="permission-header">Permission Mode</div>
          <div class="permission-status">
            <div class="permission-indicator default"></div>
            <span class="permission-text">Default (Prompts for approval)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions Panel -->
    <div class="panel actions-panel">
      <div class="panel-header">
        <h3 class="panel-title">Quick Actions</h3>
      </div>
      <div class="panel-content">
        <div class="actions-grid">
          <button @click="openClaudeCodeDocs" class="action-card">
            <Info class="w-5 h-5" />
            <span class="action-label">Documentation</span>
          </button>
          <button @click="exportInstances" class="action-card">
            <Download class="w-5 h-5" />
            <span class="action-label">Export Data</span>
          </button>
          <button @click="clearAllSessions" class="action-card danger">
            <Square class="w-5 h-5" />
            <span class="action-label">Clear All</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Recent Sessions Panel (if any exist) -->
    <div v-if="claudeCodeSessions.length > 0" class="panel history-panel">
      <div class="panel-header">
        <h3 class="panel-title">Recent Sessions</h3>
      </div>
      <div class="panel-content">
        <div class="history-list">
          <div v-for="session in claudeCodeSessions.slice(0, 3)" :key="session.session_id" class="history-item">
            <div class="history-info">
              <div class="history-name">{{ session.config?.name || 'Unnamed Session' }}</div>
              <div class="history-meta">${{ (session.cost_usd || 0).toFixed(3) }} • {{ session.num_turns }} turns</div>
            </div>
            <button @click="resumeSession(session.session_id)" class="history-action" title="Resume">
              <PlayCircle class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import {
  Square, RotateCcw, Loader, ExternalLink, Pause, Play, Info, Plus, PlayCircle, Download, RefreshCw, X
} from 'lucide-vue-next';
import { useToolCallStore } from '@/stores/toolCallStore';
import { useRouter } from 'vue-router';
import { useThemeColors } from '@/composables/useThemeColors';

const props = defineProps<{
  nodeId?: string;
}>();

const emit = defineEmits<{
  'open-workspace': [instance: any];
}>();

// Stores and router
const toolCallStore = useToolCallStore();
const router = useRouter();
const { themeColors, isDarkTheme, getTextColor, commonStyles } = useThemeColors();

// State
const showCreateForm = ref(false);
const showSystemInfo = ref(false);
const lastUpdateTime = ref(new Date());

// New Instance Form
const newInstance = reactive({
  name: '',
  working_dir: '',
  initial_prompt: '',
  max_turns: 10,
  cost_limit: 2.0,
  tools: {
    read: true,
    write: true,
    bash: true,
    webfetch: false
  }
});

// Computed properties
const claudeCodeInstances = computed(() => toolCallStore.getAllInstances);
const claudeCodeSessions = computed(() => toolCallStore.claudeCodeSessions);
const totalCost = computed(() => toolCallStore.getTotalCost);

const canCreateInstance = computed(() => {
  return newInstance.name.trim() &&
    newInstance.working_dir.trim() &&
    newInstance.initial_prompt.trim();
});

// System and stats computed properties
const systemInfo = computed(() => ({
  platform: 'macOS',
  totalMemory: '32 GB',
  availableMemory: '18 GB', 
  cpuCount: '8 cores'
}));

const totalMemoryUsage = computed(() => {
  const totalMb = claudeCodeInstances.value.reduce((sum, instance) => 
    sum + (instance.memory_mb || 0), 0);
  return totalMb > 0 ? `${totalMb.toFixed(0)}MB` : 'N/A';
});

// Methods
const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString();
};

const openClaudeCodeDocs = () => {
  window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank');
};

const exportInstances = () => {
  const data = {
    instances: claudeCodeInstances.value,
    sessions: claudeCodeSessions.value,
    exportedAt: new Date().toISOString(),
    totalCost: totalCost.value
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-code-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showNotification('Export completed');
};

const clearAllSessions = async () => {
  if (confirm('Are you sure you want to clear all session data? This cannot be undone.')) {
    try {
      // Stop all running instances first
      const stopPromises = claudeCodeInstances.value
        .filter(instance => instance.status === 'running')
        .map(instance => toolCallStore.stopInstance(instance.instance_id));
      
      await Promise.all(stopPromises);
      
      // Clear store data
      toolCallStore.clearAllData();
      
      showNotification('All sessions cleared');
    } catch (error) {
      console.error('Error clearing sessions:', error);
      showNotification('Failed to clear all sessions');
    }
  }
};

const createInstance = async () => {
  try {
    const instance = await toolCallStore.createClaudeCodeInstance(newInstance);
    if (instance) {
      showNotification('Instance created successfully');
      resetForm();
      showCreateForm.value = false;
      await refreshInstances();
    }
  } catch (error) {
    console.error('Error creating instance:', error);
    showNotification('Failed to create instance');
  }
};

const resetForm = () => {
  newInstance.name = '';
  newInstance.working_dir = '';
  newInstance.initial_prompt = '';
  newInstance.max_turns = 10;
  newInstance.cost_limit = 2.0;
  newInstance.tools = {
    read: true,
    write: true,
    bash: true,
    webfetch: false
  };
};

const refreshInstances = async () => {
  await toolCallStore.fetchClaudeCodeInstances();
  lastUpdateTime.value = new Date();
};

const detectAndRegisterExternalSession = async () => {
  try {
    // Check if we're in a Claude Code session by looking for environment variables or processes
    const response = await fetch('http://127.0.0.1:5050/api/claude-code/instances/register-external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'External Claude Code Session',
        working_dir: '/Users/928546/Desktop/tangent',
        session_id: `tangent-session-${Date.now()}`,
        auto_detected: true
      })
    });
    
    if (response.ok) {
      console.log('External Claude Code session registered successfully');
      await refreshInstances();
    }
  } catch (error) {
    console.log('No external Claude Code session detected or registration failed:', error);
  }
};

const checkForExternalSessions = async () => {
  // Only try to register if we don't have any active sessions
  if (claudeCodeInstances.value.length === 0) {
    await detectAndRegisterExternalSession();
  }
};


const pauseInstance = async (instanceId: string) => {
  const success = await toolCallStore.pauseInstance(instanceId);
  if (success) {
    showNotification('Instance paused');
    await refreshInstances();
  }
};

const resumeInstance = async (instanceId: string) => {
  const success = await toolCallStore.resumeInstance(instanceId);
  if (success) {
    showNotification('Instance resumed');
    await refreshInstances();
  }
};

const stopInstance = async (instanceId: string) => {
  const success = await toolCallStore.stopInstance(instanceId);
  if (success) {
    showNotification('Instance stopped');
    await refreshInstances();
  }
};

const resumeSession = async (sessionId: string) => {
  try {
    const instanceId = await toolCallStore.resumeSession(sessionId);
    if (instanceId) {
      showNotification('Session resumed');
      await refreshInstances();
    }
  } catch (error) {
    showNotification('Failed to resume session');
    console.error('Error resuming session:', error);
  }
};

// Utility function for notifications
const showNotification = (message: string) => {
  console.log('Notification:', message);
};

// Initialize data
onMounted(async () => {
  await refreshInstances();
  await checkForExternalSessions();
  toolCallStore.fetchClaudeCodeSessions();
});

// Auto-refresh every 10 seconds to keep instances up to date
setInterval(async () => {
  await toolCallStore.fetchClaudeCodeInstances();
  await checkForExternalSessions();
}, 10000);
</script>

<style scoped>
.claude-code-management {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* Panel Base Styles */
.panel {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 5%, hsl(var(--b2))));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 20%, hsl(var(--bc) / 0.1));
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(15px);
  box-shadow: 
    0 4px 20px color-mix(in srgb, v-bind(themeColors.primary) 10%, transparent),
    0 1px 3px color-mix(in srgb, v-bind(themeColors.secondary) 8%, transparent);
  flex-shrink: 0;
  position: relative;
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary), 
    v-bind(themeColors.accent));
  border-radius: 12px 12px 0 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 12%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, hsl(var(--b2))));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.1));
  min-height: 48px;
  position: relative;
  overflow: hidden;
}

.panel-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 5%, transparent),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, transparent),
    color-mix(in srgb, v-bind(themeColors.accent) 4%, transparent));
  pointer-events: none;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--bc));
  margin: 0;
  flex: 1;
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
}

.panel-content {
  padding: 0.75rem;
  min-height: 0;
  overflow-y: auto;
  flex: 1;
}

/* Icon Button */
.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, hsl(var(--b2))));
  color: hsl(var(--bc));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.1));
  position: relative;
  z-index: 1;
}

.icon-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 12%, hsl(var(--b2))));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

.icon-btn.active {
  background: linear-gradient(135deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary));
  color: white;
  border-color: v-bind(themeColors.primary);
  box-shadow: 0 4px 15px color-mix(in srgb, v-bind(themeColors.primary) 40%, transparent);
}

/* Overview Panel */
.overview-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-box {
  text-align: center;
  padding: 0.75rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, hsl(var(--b2))));
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.1));
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.stat-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% 0%, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, transparent) 0%, 
    transparent 70%);
  pointer-events: none;
}

.stat-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent);
}

.stat-box:nth-child(1) .stat-number {
  color: v-bind(themeColors.primary);
}

.stat-box:nth-child(2) .stat-number {
  color: v-bind(themeColors.secondary);
}

.stat-box:nth-child(3) .stat-number {
  color: v-bind(themeColors.accent);
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 3px color-mix(in srgb, v-bind(themeColors.primary) 30%, transparent);
}

.stat-label {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: relative;
  z-index: 1;
}

/* Create Form */
.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-field {
  padding: 0.75rem 1rem;
  border: 1px solid hsl(var(--bc) / 0.1);
  border-radius: 8px;
  background: hsl(var(--b2));
  color: hsl(var(--bc));
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-field:focus {
  outline: none;
  border-color: hsl(var(--p));
  box-shadow: 0 0 0 3px hsl(var(--p) / 0.2);
}

.form-field::placeholder {
  color: hsl(var(--bc) / 0.5);
}

.form-textarea {
  grid-column: 1 / -1;
  resize: none;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  flex: 1;
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary));
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 25%, transparent);
}

.btn-primary:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 90%, black), 
    color-mix(in srgb, v-bind(themeColors.secondary) 90%, black));
  transform: translateY(-1px);
  box-shadow: 0 6px 20px color-mix(in srgb, v-bind(themeColors.primary) 30%, transparent);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 8%, hsl(var(--b2))));
  color: hsl(var(--bc));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.1));
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 12%, hsl(var(--b2))));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.accent) 20%, transparent);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--theme-text-muted);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.empty-message {
  font-size: 1rem;
  font-weight: 500;
  color: var(--theme-text);
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.875rem;
}

/* Sessions List */
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-card {
  padding: 0.75rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 4%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, hsl(var(--b2))));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.1));
  border-radius: 10px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.session-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 80% 20%, 
    color-mix(in srgb, v-bind(themeColors.accent) 6%, transparent) 0%, 
    transparent 50%);
  pointer-events: none;
}

.session-card:hover {
  border-color: v-bind(themeColors.primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.session-info {
  flex: 1;
}

.session-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--theme-text);
  margin-bottom: 0.25rem;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--theme-text-muted);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.running {
  background: var(--theme-success);
}

.status-dot.paused {
  background: var(--theme-warning);
}

.status-dot.stopped {
  background: var(--theme-text-muted);
}

.session-separator {
  color: var(--theme-text-muted);
}

.session-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn.pause {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #f59e0b 15%, hsl(var(--b1))),
    color-mix(in srgb, #d97706 10%, hsl(var(--b2))));
  color: #f59e0b;
  border: 1px solid color-mix(in srgb, #f59e0b 25%, transparent);
}

.action-btn.resume {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #10b981 15%, hsl(var(--b1))),
    color-mix(in srgb, #059669 10%, hsl(var(--b2))));
  color: #10b981;
  border: 1px solid color-mix(in srgb, #10b981 25%, transparent);
}

.action-btn.stop {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #ef4444 15%, hsl(var(--b1))),
    color-mix(in srgb, #dc2626 10%, hsl(var(--b2))));
  color: #ef4444;
  border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
}

.action-btn:hover {
  transform: scale(1.1);
}

/* Session Details */
.session-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.detail-label {
  color: var(--theme-text-muted);
  font-weight: 500;
}

.detail-value {
  color: var(--theme-text);
  font-weight: 600;
}

.detail-value.detected {
  color: var(--theme-success);
  font-size: 0.6875rem;
}

/* System Panel */
.system-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.system-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.system-label {
  font-size: 0.75rem;
  color: var(--theme-text-muted);
  font-weight: 500;
}

.system-value {
  font-size: 0.875rem;
  color: var(--theme-text);
  font-weight: 600;
}

/* Tools Panel */
.tools-section {
  margin-bottom: 1rem;
}

.tools-header {
  font-size: 0.75rem;
  color: var(--theme-text-muted);
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tools-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.tool-chip {
  padding: 0.25rem 0.5rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, hsl(var(--b2))));
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.1));
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.tool-chip:nth-child(1) {
  color: v-bind(themeColors.primary);
}

.tool-chip:nth-child(2) {
  color: v-bind(themeColors.secondary);
}

.tool-chip:nth-child(3) {
  color: v-bind(themeColors.accent);
}

.tool-chip:nth-child(4) {
  color: v-bind(themeColors.primary);
}

.tool-chip:nth-child(5) {
  color: v-bind(themeColors.secondary);
}

.tool-chip:nth-child(6) {
  color: v-bind(themeColors.accent);
}

.tool-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent);
}

.permission-section {
  border-top: 1px solid var(--theme-border);
  padding-top: 1rem;
}

.permission-header {
  font-size: 0.75rem;
  color: var(--theme-text-muted);
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.permission-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.permission-indicator.default {
  background: var(--theme-success);
}

.permission-text {
  font-size: 0.75rem;
  color: var(--theme-text);
  font-weight: 500;
}

/* Actions Panel */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.action-card {
  padding: 1rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, hsl(var(--b2))));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.1));
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: hsl(var(--bc));
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.action-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% 0%, 
    color-mix(in srgb, v-bind(themeColors.accent) 5%, transparent) 0%, 
    transparent 70%);
  pointer-events: none;
}

.action-card:nth-child(1) {
  border-top: 2px solid v-bind(themeColors.primary);
}

.action-card:nth-child(2) {
  border-top: 2px solid v-bind(themeColors.secondary);
}

.action-card:nth-child(3) {
  border-top: 2px solid v-bind(themeColors.accent);
}

.action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent);
  border-color: v-bind(themeColors.primary);
}

.action-card.danger {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #ef4444 8%, hsl(var(--b1))),
    color-mix(in srgb, #dc2626 6%, hsl(var(--b2))));
  border-color: #ef4444;
  color: #ef4444;
  border-top: 2px solid #ef4444;
}

.action-card.danger:hover {
  border-color: #dc2626;
  box-shadow: 0 8px 25px color-mix(in srgb, #ef4444 20%, transparent);
}

.action-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
}

/* History Panel */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.history-item:hover {
  background: var(--theme-surface-hover);
  border-color: var(--theme-primary);
}

.history-info {
  flex: 1;
}

.history-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--theme-text);
  margin-bottom: 0.125rem;
}

.history-meta {
  font-size: 0.6875rem;
  color: var(--theme-text-muted);
}

.history-action {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--theme-surface);
  color: var(--theme-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border: 1px solid var(--theme-border);
}

.history-action:hover {
  background: var(--theme-surface-hover);
  transform: scale(1.1);
}

/* Responsive Layout Improvements */
.sessions-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.overview-panel,
.system-panel,
.tools-panel,
.actions-panel,
.history-panel {
  flex-shrink: 0;
}
</style>