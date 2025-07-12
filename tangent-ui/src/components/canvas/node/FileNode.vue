<template>
  <div 
    class="file-node"
    :class="[
      'modern-card',
      'node-card',
      { 'selected': isSelected }
    ]"
    :style="nodeStyle"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Node Header -->
    <div class="node-header">
      <div class="file-icon">
        <component :is="getFileIcon()" />
      </div>
      <div class="file-info">
        <div class="file-name">{{ fileName }}</div>
        <div class="file-path">{{ fileNode.file_path }}</div>
      </div>
      <div class="file-actions">
        <button 
          @click.stop="openFile"
          class="action-btn open-btn"
          title="Open File"
        >
          <ExternalLink :size="16" />
        </button>
        <button 
          @click.stop="showDetails = !showDetails"
          class="action-btn details-btn"
          title="Toggle Details"
        >
          <ChevronDown :size="16" :class="{ 'rotate-180': showDetails }" />
        </button>
      </div>
    </div>

    <!-- File Stats -->
    <div class="file-stats">
      <div class="stat-item">
        <strong>Size:</strong> {{ formatFileSize(fileNode.file_size) }}
      </div>
      <div class="stat-item">
        <strong>Type:</strong> {{ fileNode.mime_type }}
      </div>
      <div class="stat-item">
        <strong>Modified:</strong> {{ formatTimestamp(fileNode.updated_at) }}
      </div>
    </div>

    <!-- File Details (collapsed by default) -->
    <div v-if="showDetails" class="file-details">
      <div class="section">
        <h4>File Information</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Full Path:</span>
            <span class="info-value">{{ fileNode.file_path }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Size:</span>
            <span class="info-value">{{ formatFileSize(fileNode.file_size) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">MIME Type:</span>
            <span class="info-value">{{ fileNode.mime_type }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Content Hash:</span>
            <span class="info-value">{{ fileNode.content_hash?.substring(0, 16) }}...</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4>History</h4>
        <div class="history-items">
          <div class="history-item">
            <strong>Created:</strong> {{ formatTimestamp(fileNode.created_at) }}
            <span v-if="fileNode.created_by" class="by-tool">
              by {{ getToolCallName(fileNode.created_by) }}
            </span>
          </div>
          <div v-if="fileNode.modified_by" class="history-item">
            <strong>Modified:</strong> {{ formatTimestamp(fileNode.updated_at) }}
            <span class="by-tool">
              by {{ getToolCallName(fileNode.modified_by) }}
            </span>
          </div>
        </div>
      </div>

      <!-- File Preview -->
      <div v-if="isPreviewable" class="section">
        <h4>Preview</h4>
        <div class="file-preview">
          <div v-if="loading" class="loading">Loading preview...</div>
          <div v-else-if="previewError" class="error">
            Failed to load preview: {{ previewError }}
          </div>
          <pre v-else-if="previewContent" class="preview-content">{{ previewContent }}</pre>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button 
        @click.stop="openFile"
        class="action-btn open-btn"
        title="Open File"
      >
        <ExternalLink :size="16" />
      </button>
      <button 
        @click.stop="copyPath"
        class="action-btn copy-btn"
        title="Copy Path"
      >
        <Copy :size="16" />
      </button>
      <button 
        v-if="isEditable"
        @click.stop="editFile"
        class="action-btn edit-btn"
        title="Edit File"
      >
        <Edit :size="16" />
      </button>
      <button 
        v-if="isExecutable"
        @click.stop="runFile"
        class="action-btn run-btn"
        title="Run File"
      >
        <Play :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  File, 
  FileText, 
  Image, 
  Code, 
  Database, 
  Settings,
  ChevronDown, 
  ExternalLink, 
  Copy,
  Edit,
  Play
} from 'lucide-vue-next'

interface FileNode {
  id: string
  node_id: string
  file_path: string
  file_size: number
  content_hash?: string
  mime_type: string
  created_by?: string
  modified_by?: string
  created_at: string
  updated_at: string
}

interface Props {
  fileNode: FileNode
  isSelected?: boolean
  position: { x: number, y: number }
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  width: 320,
  height: 140
})

const emit = defineEmits<{
  click: [fileNode: FileNode]
  doubleClick: [fileNode: FileNode]
  open: [fileNode: FileNode]
  edit: [fileNode: FileNode]
  run: [fileNode: FileNode]
}>()

const showDetails = ref(false)
const previewContent = ref('')
const loading = ref(false)
const previewError = ref('')

const nodeStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  width: `${props.width}px`,
  minHeight: `${props.height}px`
}))

const fileName = computed(() => {
  return props.fileNode.file_path.split('/').pop() || 'Unknown'
})

const fileExtension = computed(() => {
  return fileName.value.split('.').pop()?.toLowerCase() || ''
})

const isPreviewable = computed(() => {
  const textTypes = ['text/', 'application/json', 'application/javascript']
  return textTypes.some(type => props.fileNode.mime_type.startsWith(type))
})

const isEditable = computed(() => {
  const editableTypes = ['text/', 'application/json', 'application/javascript']
  return editableTypes.some(type => props.fileNode.mime_type.startsWith(type))
})

const isExecutable = computed(() => {
  const executableExtensions = ['py', 'js', 'ts', 'sh', 'bat']
  return executableExtensions.includes(fileExtension.value)
})

function getFileIcon() {
  const ext = fileExtension.value
  
  if (['py', 'js', 'ts', 'vue', 'jsx', 'tsx'].includes(ext)) {
    return Code
  } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return Image
  } else if (['json', 'xml', 'yml', 'yaml'].includes(ext)) {
    return Database
  } else if (['txt', 'md', 'rst'].includes(ext)) {
    return FileText
  } else if (['config', 'conf', 'cfg'].includes(ext)) {
    return Settings
  } else {
    return File
  }
}

function handleClick() {
  emit('click', props.fileNode)
}

function handleDoubleClick() {
  emit('doubleClick', props.fileNode)
}

function openFile() {
  emit('open', props.fileNode)
}

function editFile() {
  emit('edit', props.fileNode)
}

function runFile() {
  emit('run', props.fileNode)
}

function copyPath() {
  navigator.clipboard.writeText(props.fileNode.file_path)
}

function getToolCallName(toolCallId: string): string {
  // This would need to be implemented to fetch tool call details
  return `Tool Call #${toolCallId.substring(0, 8)}`
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}

async function loadPreview() {
  if (!isPreviewable.value) return
  
  loading.value = true
  previewError.value = ''
  
  try {
    // This would need to be implemented to fetch file content
    // For now, show placeholder
    previewContent.value = 'File preview would be loaded here...'
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (showDetails.value && isPreviewable.value) {
    loadPreview()
  }
})
</script>

<style scoped>
.file-node {
  position: absolute;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #e2e8f0;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  border-left: 4px solid #8b5cf6;
}

.file-node.selected {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #f3f4f6;
  color: #8b5cf6;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  truncate: true;
}

.file-path {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
  word-break: break-all;
}

.file-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.file-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 11px;
  color: #64748b;
}

.stat-item strong {
  color: #475569;
}

.file-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.section {
  margin-bottom: 12px;
}

.section h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.info-label {
  font-weight: 600;
  color: #475569;
  min-width: 80px;
}

.info-value {
  color: #64748b;
  word-break: break-word;
}

.history-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  font-size: 12px;
  color: #64748b;
}

.by-tool {
  color: #8b5cf6;
  font-style: italic;
}

.file-preview {
  max-height: 200px;
  overflow-y: auto;
}

.preview-content {
  background: #f8fafc;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  margin: 0;
  white-space: pre-wrap;
}

.loading {
  text-align: center;
  color: #64748b;
  font-size: 12px;
  padding: 16px;
}

.error {
  text-align: center;
  color: #ef4444;
  font-size: 12px;
  padding: 16px;
}

.quick-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.rotate-180 {
  transform: rotate(180deg);
}
</style>