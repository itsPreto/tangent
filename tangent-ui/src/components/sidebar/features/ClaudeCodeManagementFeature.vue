<template>
  <div class="claude-code-feature">
    <!-- Header with Stats -->
    <div class="claude-code-header">
      <div class="section-title">Claude Code Instances</div>
      <div class="claude-code-stats">
        <div class="stat-card">
          <div class="stat-value">{{ claudeCodeInstances.length }}</div>
          <div class="stat-label">Active Instances</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${{ totalCost.toFixed(2) }}</div>
          <div class="stat-label">Total Cost</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ claudeCodeSessions.length }}</div>
          <div class="stat-label">Sessions</div>
        </div>
      </div>
    </div>

    <!-- Create New Instance -->
    <div class="section">
      <div class="section-header">
        <h3>Create New Instance</h3>
        <button @click="showCreateForm = !showCreateForm" class="toggle-btn">
          {{ showCreateForm ? 'Cancel' : 'New Instance' }}
        </button>
      </div>
      <div v-if="showCreateForm" class="create-instance-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Instance Name</label>
            <input v-model="newInstance.name" type="text" placeholder="e.g., Frontend Development"
              class="form-input" />
          </div>
          <div class="form-group">
            <label>Working Directory</label>
            <input v-model="newInstance.working_dir" type="text" placeholder="/Users/dev/project"
              class="form-input" />
          </div>
          <div class="form-group full-width">
            <label>Initial Prompt</label>
            <textarea v-model="newInstance.initial_prompt"
              placeholder="Describe what you want Claude Code to do..." class="form-textarea"
              rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Max Turns</label>
            <input v-model.number="newInstance.max_turns" type="number" min="1" max="50" class="form-input" />
          </div>
          <div class="form-group">
            <label>Cost Limit ($)</label>
            <input v-model.number="newInstance.cost_limit" type="number" step="0.10" min="0.10" max="50"
              class="form-input" />
          </div>
          <div class="form-group full-width">
            <label>Allowed Tools</label>
            <div class="tool-checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" v-model="newInstance.tools.read" />
                <span>Read</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newInstance.tools.write" />
                <span>Write</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newInstance.tools.bash" />
                <span>Bash</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newInstance.tools.webfetch" />
                <span>WebFetch</span>
              </label>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button @click="createInstance" class="primary-btn" :disabled="!canCreateInstance">
            Create & Start
          </button>
          <button @click="resetForm" class="secondary-btn">Reset</button>
        </div>
      </div>
    </div>

    <!-- Connect Current Session -->
    <div class="section">
      <div class="section-header">
        <h3>Connect Current Session</h3>
      </div>
      <div class="connect-session-content">
        <div class="connect-description">
          <div class="connect-icon">🔗</div>
          <div class="connect-text">
            <div class="connect-title">Register this Claude Code session</div>
            <div class="connect-subtitle">Make this session visible in the active instances panel</div>
          </div>
        </div>
        <button @click="connectCurrentSession" class="connect-btn" :disabled="isConnecting">
          <component :is="isConnecting ? 'Loader' : 'ExternalLink'" class="w-4 h-4"
            :class="{ 'animate-spin': isConnecting }" />
          {{ isConnecting ? 'Connecting...' : 'Connect Session' }}
        </button>
      </div>
    </div>

    <!-- Active Instances -->
    <div class="section">
      <div class="section-header">
        <h3>Active Instances</h3>
        <div class="header-actions">
          <button @click="showStopConfirmation" class="stop-all-btn" :disabled="claudeCodeInstances.length === 0" title="Stop all running instances">
            <Square class="w-4 h-4" />
            Stop All
          </button>
          <button @click="refreshInstances" class="refresh-btn">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Inline Stop Confirmation -->
      <div v-if="showStopAllConfirmation" class="stop-confirmation">
        <div class="confirmation-content">
          <div class="confirmation-icon">⚠️</div>
          <div class="confirmation-text">
            <div class="confirmation-title">Stop All Instances</div>
            <div class="confirmation-message">This will stop all {{ claudeCodeInstances.length }} running Claude Code instances. This action cannot be undone.</div>
          </div>
        </div>
        <div class="confirmation-actions">
          <button @click="cancelStopAll" class="cancel-btn">Cancel</button>
          <button @click="confirmStopAll" class="confirm-btn">
            <Square class="w-4 h-4" />
            Stop All
          </button>
        </div>
      </div>

      <div v-if="claudeCodeInstances.length === 0" class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">No Active Instances</div>
        <div class="empty-description">Create a new Claude Code instance to get started</div>
      </div>

      <div v-else class="instances-list">
        <div v-for="instance in claudeCodeInstances" :key="instance.instance_id" class="instance-card"
          :class="instanceStatusClass(instance.status)">
          <div class="instance-header">
            <div class="instance-info">
              <div class="instance-name">{{ instance.config?.name || `Instance ${instance.instance_id.substring(0, 8)}` }}</div>
              <div class="instance-meta">
                <span class="status-badge" :class="instance.status">{{ instance.status }}</span>
                <span class="cost">${{ (instance.cost_usd || 0).toFixed(3) }}</span>
                <span class="duration">{{ formatDuration(instance.duration_ms || 0) }}</span>
              </div>
            </div>
            <div class="instance-actions">
              <button v-if="instance.status === 'running'" @click="pauseInstance(instance.instance_id)"
                class="action-btn pause" title="Pause">
                <Pause class="w-4 h-4" />
              </button>
              <button v-if="instance.status === 'paused'" @click="resumeInstance(instance.instance_id)"
                class="action-btn resume" title="Resume">
                <Play class="w-4 h-4" />
              </button>
              <button @click="stopInstance(instance.instance_id)" class="action-btn stop" title="Stop">
                <Square class="w-4 h-4" />
              </button>
              <button @click="showInstanceDetails(instance)" class="action-btn details" title="Details">
                <Info class="w-4 h-4" />
              </button>
              <button v-if="instance.node_id" @click="openInWorkspace(instance)"
                class="action-btn open-workspace" title="Open in Workspace">
                <ExternalLink class="w-4 h-4" />
              </button>
              <button v-else @click="createWorkspaceForInstance(instance)" class="action-btn create-workspace"
                title="Create Workspace">
                <Plus class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="instance-details">
            <div class="detail-item">
              <strong>Working Dir:</strong> {{ instance.working_dir }}
            </div>
            <div class="detail-item">
              <strong>Turns:</strong> {{ instance.num_turns }} / {{ instance.config?.max_turns || '∞' }}
            </div>
            <div v-if="instance.session_id" class="detail-item">
              <strong>Session:</strong> {{ instance.session_id.substring(0, 12) }}...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Session History -->
    <div class="section">
      <div class="section-header">
        <h3>Session History</h3>
        <button @click="refreshSessions" class="refresh-btn">
          <RefreshCw class="w-4 h-4" />
        </button>
      </div>
      <div v-if="claudeCodeSessions.length === 0" class="empty-state">
        <div class="empty-icon">📜</div>
        <div class="empty-title">No Sessions</div>
        <div class="empty-description">Completed sessions will appear here</div>
      </div>
      <div v-else class="sessions-list">
        <div v-for="session in claudeCodeSessions" :key="session.session_id" class="session-card">
          <div class="session-header">
            <div class="session-info">
              <div class="session-name">{{ session.config?.name || 'Unnamed Session' }}</div>
              <div class="session-meta">
                <span class="session-date">{{ formatDate(session.created_at) }}</span>
                <span class="session-cost">${{ (session.cost_usd || 0).toFixed(3) }}</span>
                <span class="session-status" :class="session.final_status">{{ session.final_status }}</span>
              </div>
            </div>
            <div class="session-actions">
              <button @click="resumeSession(session.session_id)" class="action-btn resume"
                title="Resume Session">
                <PlayCircle class="w-4 h-4" />
              </button>
              <button @click="exportSession(session)" class="action-btn export" title="Export">
                <Download class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="session-details">
            <div class="detail-item">
              <strong>Working Dir:</strong> {{ session.working_dir }}
            </div>
            <div class="detail-item">
              <strong>Turns:</strong> {{ session.num_turns }}
            </div>
            <div class="detail-item">
              <strong>Session ID:</strong> {{ session.session_id.substring(0, 20) }}...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Global Settings -->
    <div class="section">
      <div class="section-header">
        <h3>Global Settings</h3>
      </div>
      <div class="global-settings">
        <div class="setting-item">
          <label class="setting-label">Max Instances</label>
          <input v-model.number="globalSettings.maxInstances" type="number" min="1" max="10" class="setting-input" />
        </div>
        <div class="setting-item">
          <label class="setting-label">Global Cost Limit ($)</label>
          <input v-model.number="globalSettings.globalCostLimit" type="number" step="1.0" min="1" max="100" class="setting-input" />
        </div>
        <div class="setting-item">
          <label class="setting-label">Session Timeout (min)</label>
          <input v-model.number="globalSettings.sessionTimeout" type="number" min="5" max="120" class="setting-input" />
        </div>
        <div class="setting-item">
          <label class="setting-toggle">
            <input type="checkbox" v-model="globalSettings.autoSave" />
            <span>Auto-save sessions</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import {
  Square, RotateCcw, Loader, ExternalLink, Pause, Play, Info, Plus, PlayCircle, Download, RefreshCw
} from 'lucide-vue-next';
import { useToolCallStore } from '@/stores/toolCallStore';
import { useRouter } from 'vue-router';

const props = defineProps<{
  nodeId?: string;
}>();

const emit = defineEmits<{
  'open-workspace': [instance: any];
}>();

// Stores and router
const toolCallStore = useToolCallStore();
const router = useRouter();

// State
const showCreateForm = ref(false);
const isConnecting = ref(false);
const showStopAllConfirmation = ref(false);

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

// Global Settings
const globalSettings = reactive({
  maxInstances: 3,
  autoSave: true,
  globalCostLimit: 10.0,
  sessionTimeout: 30
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

// Methods
const instanceStatusClass = (status: string) => {
  return {
    'status-running': status === 'running',
    'status-paused': status === 'paused',
    'status-stopped': status === 'stopped',
    'status-error': status === 'error'
  };
};

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const createInstance = async () => {
  try {
    const instance = await toolCallStore.createInstance(newInstance);
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

const connectCurrentSession = async () => {
  isConnecting.value = true;
  try {
    const response = await fetch('http://127.0.0.1:5050/api/claude-code/instances/register-external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Current Claude Code Session',
        working_dir: '/Users/928546/Desktop/tangent',
        session_id: 'current-session-' + Date.now()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Successfully registered external session:', result);
      await refreshInstances();
      showNotification('Session connected successfully');
    } else {
      console.error('Failed to register external session:', response.statusText);
      showNotification('Failed to connect session');
    }
  } catch (error) {
    console.error('Error connecting current session:', error);
    showNotification('Error connecting session');
  } finally {
    isConnecting.value = false;
  }
};

const showStopConfirmation = () => {
  showStopAllConfirmation.value = true;
};

const cancelStopAll = () => {
  showStopAllConfirmation.value = false;
};

const confirmStopAll = async () => {
  try {
    const instances = claudeCodeInstances.value;
    showStopAllConfirmation.value = false;
    
    showNotification(`Stopping ${instances.length} instances...`);
    
    const stopPromises = instances.map(instance => 
      toolCallStore.stopInstance(instance.instance_id)
    );
    
    await Promise.all(stopPromises);
    
    showNotification('All instances stopped successfully!');
    await refreshInstances();
  } catch (error) {
    console.error('Error stopping instances:', error);
    showNotification('Failed to stop some instances');
  }
};

const refreshInstances = async () => {
  await toolCallStore.fetchClaudeCodeInstances();
};

const refreshSessions = async () => {
  await toolCallStore.fetchClaudeCodeSessions();
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

const showInstanceDetails = (instance: any) => {
  // TODO: Implement instance details modal
  console.log('Show instance details:', instance);
};

const openInWorkspace = (instance: any) => {
  emit('open-workspace', instance);
};

const createWorkspaceForInstance = async (instance: any) => {
  // TODO: Implement workspace creation for instance
  console.log('Create workspace for instance:', instance);
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

const exportSession = (session: any) => {
  // TODO: Implement session export
  console.log('Export session:', session);
  showNotification('Session export not yet implemented');
};

// Utility function for notifications
const showNotification = (message: string) => {
  // TODO: Integrate with notification system
  console.log('Notification:', message);
};

// Initialize data
onMounted(() => {
  refreshInstances();
  refreshSessions();
});
</script>

<style scoped>
.claude-code-feature {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

/* Header */
.claude-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(var(--theme-primary-rgb), 0.05);
  border-radius: 12px;
  border: 1px solid rgba(var(--theme-primary-rgb), 0.1);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.claude-code-stats {
  display: flex;
  gap: 1rem;
}

.stat-card {
  background: linear-gradient(135deg, rgba(var(--theme-primary-rgb), 0.15), rgba(var(--theme-secondary-rgb), 0.15));
  border: 1px solid rgba(var(--theme-primary-rgb), 0.3);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  min-width: 80px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--theme-primary);
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--theme-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Sections */
.section {
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border-radius: 12px;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Buttons */
.toggle-btn,
.connect-btn,
.primary-btn,
.secondary-btn,
.action-btn,
.refresh-btn,
.stop-all-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-btn {
  background: var(--theme-primary);
  color: white;
}

.connect-btn {
  background: var(--theme-secondary);
  color: white;
}

.primary-btn {
  background: var(--theme-primary);
  color: white;
}

.secondary-btn {
  background: transparent;
  color: var(--theme-text-primary);
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
}

.refresh-btn {
  background: transparent;
  color: var(--theme-text-secondary);
  padding: 0.5rem;
}

.stop-all-btn {
  background: #ef4444;
  color: white;
}

.action-btn {
  padding: 0.25rem;
  background: rgba(var(--theme-primary-rgb), 0.1);
  color: var(--theme-primary);
}

.action-btn.pause {
  background: rgba(251, 191, 36, 0.1);
  color: #f59e0b;
}

.action-btn.resume {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.action-btn.stop {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Form */
.create-instance-form {
  margin-top: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--theme-text-primary);
  margin-bottom: 0.5rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.tool-checkboxes {
  display: flex;
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

/* Connect Session */
.connect-session-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: rgba(var(--theme-secondary-rgb), 0.05);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-secondary-rgb), 0.1);
}

.connect-description {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.connect-icon {
  font-size: 1.5rem;
}

.connect-title {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.connect-subtitle {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

/* Stop Confirmation */
.stop-confirmation {
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.confirmation-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.confirmation-icon {
  font-size: 1.5rem;
}

.confirmation-title {
  font-weight: 600;
  color: #dc2626;
}

.confirmation-message {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.confirmation-actions {
  display: flex;
  gap: 0.5rem;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  color: var(--theme-text-primary);
  cursor: pointer;
}

.confirm-btn {
  padding: 0.5rem 1rem;
  background: #ef4444;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--theme-text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--theme-text-primary);
}

.empty-description {
  font-size: 0.875rem;
}

/* Instance Cards */
.instances-list,
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.instance-card,
.session-card {
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.8);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.instance-header,
.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.instance-name,
.session-name {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.instance-meta,
.session-meta {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.status-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.running {
  background: rgba(34, 197, 94, 0.2);
  color: #15803d;
}

.status-badge.paused {
  background: rgba(251, 191, 36, 0.2);
  color: #d97706;
}

.status-badge.stopped {
  background: rgba(107, 114, 128, 0.2);
  color: #4b5563;
}

.cost {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.duration {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.instance-actions,
.session-actions {
  display: flex;
  gap: 0.25rem;
}

.instance-details,
.session-details {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.detail-item {
  margin-bottom: 0.25rem;
}

/* Global Settings */
.global-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--theme-text-primary);
}

.setting-input {
  padding: 0.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.setting-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--theme-text-primary);
}
</style>