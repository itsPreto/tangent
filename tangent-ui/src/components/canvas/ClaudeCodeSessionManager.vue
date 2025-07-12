<template>
  <div class="claude-code-session-manager">
    <!-- Session History -->
    <div class="session-history">
      <div class="section-header">
        <h3>Session History</h3>
        <div class="header-actions">
          <button @click="refreshSessions" class="action-btn" title="Refresh">
            <RefreshCw :size="16" />
          </button>
          <button @click="clearHistory" class="action-btn" title="Clear History">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading sessions...</p>
      </div>
      
      <div v-else-if="sessions.length === 0" class="empty-state">
        <FileText :size="48" class="empty-icon" />
        <p>No sessions found</p>
        <p class="empty-subtitle">Claude Code sessions will appear here after completion</p>
      </div>
      
      <div v-else class="session-list">
        <div 
          v-for="session in paginatedSessions" 
          :key="session.session_id"
          class="session-item"
          :class="{ selected: selectedSession?.session_id === session.session_id }"
          @click="selectSession(session)"
        >
          <div class="session-header">
            <div class="session-id">{{ session.session_id.substring(0, 8) }}</div>
            <div class="session-cost">${{ session.cost_usd.toFixed(4) }}</div>
          </div>
          
          <div class="session-info">
            <div class="session-meta">
              <span class="meta-item">
                <Clock :size="12" />
                {{ formatDate(session.created_at) }}
              </span>
              <span class="meta-item">
                <MessageCircle :size="12" />
                {{ session.num_turns }} turns
              </span>
              <span class="meta-item">
                <FolderOpen :size="12" />
                {{ getWorkingDirName(session.working_dir) }}
              </span>
            </div>
            
            <div class="session-status" :class="getStatusClass(session.final_status)">
              {{ session.final_status }}
            </div>
          </div>
          
          <div class="session-actions">
            <button 
              @click.stop="resumeSession(session)"
              class="action-btn resume-btn"
              title="Resume Session"
            >
              <Play :size="14" />
            </button>
            <button 
              @click.stop="duplicateSession(session)"
              class="action-btn duplicate-btn"
              title="Duplicate Session"
            >
              <Copy :size="14" />
            </button>
            <button 
              @click.stop="exportSession(session)"
              class="action-btn export-btn"
              title="Export Session"
            >
              <Download :size="14" />
            </button>
            <button 
              @click.stop="deleteSession(session)"
              class="action-btn delete-btn"
              title="Delete Session"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button 
          @click="currentPage = Math.max(1, currentPage - 1)"
          :disabled="currentPage === 1"
          class="page-btn"
        >
          <ChevronLeft :size="16" />
        </button>
        
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        
        <button 
          @click="currentPage = Math.min(totalPages, currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="page-btn"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
    
    <!-- Session Details Panel -->
    <div v-if="selectedSession" class="session-details">
      <div class="section-header">
        <h3>Session Details</h3>
        <button @click="selectedSession = null" class="action-btn">
          <X :size="16" />
        </button>
      </div>
      
      <div class="details-content">
        <div class="detail-section">
          <h4>Basic Information</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Session ID</label>
              <span class="value">{{ selectedSession.session_id }}</span>
            </div>
            <div class="detail-item">
              <label>Instance ID</label>
              <span class="value">{{ selectedSession.instance_id }}</span>
            </div>
            <div class="detail-item">
              <label>Created</label>
              <span class="value">{{ formatDate(selectedSession.created_at) }}</span>
            </div>
            <div class="detail-item">
              <label>Final Status</label>
              <span class="value status" :class="getStatusClass(selectedSession.final_status)">
                {{ selectedSession.final_status }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Usage Statistics</h4>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${{ selectedSession.cost_usd.toFixed(4) }}</div>
              <div class="stat-label">Total Cost</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ selectedSession.num_turns }}</div>
              <div class="stat-label">Turns Used</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${{ averageCostPerTurn(selectedSession) }}</div>
              <div class="stat-label">Cost per Turn</div>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Configuration</h4>
          <div class="config-display">
            <pre>{{ JSON.stringify(selectedSession.config, null, 2) }}</pre>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Working Directory</h4>
          <div class="working-dir">
            <code>{{ selectedSession.working_dir }}</code>
          </div>
        </div>
      </div>
      
      <div class="details-actions">
        <button @click="resumeSession(selectedSession)" class="primary-btn">
          <Play :size="16" />
          Resume Session
        </button>
        <button @click="duplicateSession(selectedSession)" class="secondary-btn">
          <Copy :size="16" />
          Duplicate
        </button>
        <button @click="exportSession(selectedSession)" class="secondary-btn">
          <Download :size="16" />
          Export
        </button>
      </div>
    </div>
    
    <!-- Resume Session Modal -->
    <div v-if="showResumeModal" class="modal-overlay" @click="showResumeModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Resume Session</h3>
          <button @click="showResumeModal = false" class="close-btn">
            <X :size="20" />
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Session ID</label>
            <input 
              v-model="resumeConfig.session_id" 
              type="text" 
              readonly
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>Working Directory</label>
            <input 
              v-model="resumeConfig.working_dir" 
              type="text" 
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>Max Turns</label>
            <input 
              v-model="resumeConfig.max_turns" 
              type="number" 
              min="1" 
              max="100"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>Initial Prompt (Optional)</label>
            <textarea 
              v-model="resumeConfig.initial_prompt" 
              class="form-textarea"
              placeholder="Enter initial prompt for resumed session..."
              rows="3"
            ></textarea>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="showResumeModal = false" class="cancel-btn">Cancel</button>
          <button @click="confirmResumeSession" class="primary-btn">
            <Play :size="16" />
            Resume Session
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Clock, 
  MessageCircle, 
  FolderOpen, 
  Play, 
  Copy, 
  Download, 
  Trash2, 
  RefreshCw, 
  FileText, 
  X, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-vue-next'
import { useToolCallStore } from '@/stores/toolCallStore'

interface ClaudeCodeSession {
  session_id: string
  instance_id: string
  config: Record<string, any>
  cost_usd: number
  num_turns: number
  working_dir: string
  created_at: string
  final_status: string
}

const emit = defineEmits<{
  resumeSession: [sessionId: string, config: Record<string, any>]
  sessionDeleted: [sessionId: string]
}>()

const toolCallStore = useToolCallStore()

// State
const sessions = ref<ClaudeCodeSession[]>([])
const selectedSession = ref<ClaudeCodeSession | null>(null)
const loading = ref(false)
const currentPage = ref(1)
const itemsPerPage = 10
const showResumeModal = ref(false)
const resumeConfig = ref<Record<string, any>>({})

// Computed
const totalPages = computed(() => 
  Math.ceil(sessions.value.length / itemsPerPage)
)

const paginatedSessions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return sessions.value.slice(start, end)
})

// Methods
async function loadSessions() {
  loading.value = true
  try {
    await toolCallStore.fetchClaudeCodeSessions()
    sessions.value = toolCallStore.claudeCodeSessions
  } catch (error) {
    console.error('Failed to load sessions:', error)
  } finally {
    loading.value = false
  }
}

function selectSession(session: ClaudeCodeSession) {
  selectedSession.value = session
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'completed': return 'status-success'
    case 'error': return 'status-error'
    case 'stopped': return 'status-stopped'
    default: return 'status-default'
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function getWorkingDirName(path: string): string {
  return path.split('/').pop() || path
}

function averageCostPerTurn(session: ClaudeCodeSession): string {
  if (session.num_turns === 0) return '0.0000'
  return (session.cost_usd / session.num_turns).toFixed(4)
}

async function refreshSessions() {
  await loadSessions()
}

function clearHistory() {
  if (confirm('Are you sure you want to clear all session history?')) {
    sessions.value = []
    selectedSession.value = null
  }
}

function resumeSession(session: ClaudeCodeSession) {
  resumeConfig.value = {
    session_id: session.session_id,
    working_dir: session.working_dir,
    max_turns: session.config.max_turns || 20,
    initial_prompt: ''
  }
  showResumeModal.value = true
}

async function confirmResumeSession() {
  try {
    const instanceId = await toolCallStore.resumeSession(
      resumeConfig.value.session_id,
      resumeConfig.value
    )
    
    if (instanceId) {
      emit('resumeSession', resumeConfig.value.session_id, resumeConfig.value)
      showResumeModal.value = false
      resumeConfig.value = {}
    }
  } catch (error) {
    console.error('Failed to resume session:', error)
  }
}

function duplicateSession(session: ClaudeCodeSession) {
  // Create a new session with the same configuration
  const newConfig = { ...session.config }
  delete newConfig.resume_session
  
  emit('resumeSession', '', newConfig)
}

function exportSession(session: ClaudeCodeSession) {
  const exportData = {
    session_id: session.session_id,
    instance_id: session.instance_id,
    config: session.config,
    cost_usd: session.cost_usd,
    num_turns: session.num_turns,
    working_dir: session.working_dir,
    created_at: session.created_at,
    final_status: session.final_status
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
    type: 'application/json' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `claude-code-session-${session.session_id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function deleteSession(session: ClaudeCodeSession) {
  if (confirm(`Are you sure you want to delete session ${session.session_id}?`)) {
    sessions.value = sessions.value.filter(s => s.session_id !== session.session_id)
    if (selectedSession.value?.session_id === session.session_id) {
      selectedSession.value = null
    }
    emit('sessionDeleted', session.session_id)
  }
}

// Lifecycle
onMounted(() => {
  loadSessions()
})
</script>

<style scoped>
.claude-code-session-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1e293b;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #64748b;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-subtitle {
  font-size: 14px;
  opacity: 0.8;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  padding: 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.session-item.selected {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.session-id {
  font-family: monospace;
  font-weight: 600;
  color: #1e293b;
}

.session-cost {
  font-weight: 600;
  color: #059669;
}

.session-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.session-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-success {
  background: #dcfce7;
  color: #166534;
}

.status-error {
  background: #fef2f2;
  color: #dc2626;
}

.status-stopped {
  background: #f1f5f9;
  color: #475569;
}

.status-default {
  background: #f8fafc;
  color: #64748b;
}

.session-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.session-actions .action-btn {
  width: 28px;
  height: 28px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #64748b;
}

.session-details {
  flex: 1;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.details-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.detail-item .value {
  font-size: 14px;
  color: #1e293b;
}

.detail-item .value.status {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  width: fit-content;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.stat-card {
  text-align: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.config-display {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.config-display pre {
  margin: 0;
  font-size: 12px;
  color: #1e293b;
}

.working-dir {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}

.working-dir code {
  font-size: 14px;
  color: #1e293b;
}

.details-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-btn:hover {
  background: #2563eb;
}

.secondary-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.secondary-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f1f5f9;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
}

.cancel-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>