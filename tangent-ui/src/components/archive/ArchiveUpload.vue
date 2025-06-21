<template>
  <div class="archive-upload">
    <!-- Drop Zone -->
    <div 
      class="drop-zone"
      :class="{ 
        'drag-over': isDragOver,
        'uploading': archiveStore.isUploading,
        'has-files': archiveStore.status?.archiveFiles?.length > 0
      }"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        multiple
        @change="handleFileSelect"
        style="display: none"
      />

      <div v-if="!archiveStore.isUploading" class="drop-zone-content">
        <div class="upload-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <h3>Upload Archive Data</h3>
        <p>Drop your ChatGPT or Claude conversation exports here</p>
        <p class="file-info">Supports JSON files up to 100MB</p>
        <button class="upload-button">
          Choose Files
        </button>
      </div>

      <div v-else class="upload-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill"
            :style="{ width: `${archiveStore.uploadProgress}%` }"
          ></div>
        </div>
        <p class="progress-text">{{ archiveStore.uploadProgressText }}</p>
        <p class="progress-percentage">{{ archiveStore.uploadProgress }}%</p>
      </div>
    </div>

    <!-- Upload Options -->
    <div v-if="!archiveStore.isUploading" class="upload-options">
      <label class="option-item">
        <input 
          type="checkbox" 
          v-model="enableEmbeddings"
          :disabled="archiveStore.isUploading"
        />
        <span>Generate embeddings for analysis</span>
        <small>Required for topic clustering and semantic search</small>
      </label>
    </div>

    <!-- Archive Status -->
    <div v-if="archiveStore.status" class="archive-status">
      <h4>Archive Status</h4>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">Conversations:</span>
          <span class="value">{{ (archiveStore.status?.totalConversations || 0).toLocaleString() }}</span>
        </div>
        <div class="status-item">
          <span class="label">Embeddings:</span>
          <span class="value">{{ (archiveStore.status?.totalEmbeddings || 0).toLocaleString() }}</span>
        </div>
        <div class="status-item">
          <span class="label">Files:</span>
          <span class="value">{{ archiveStore.status?.archiveFilesCount || 0 }}</span>
        </div>
        <div class="status-item">
          <span class="label">Ready for Analysis:</span>
          <span class="value" :class="{ 'ready': archiveStore.status?.databaseReady }">
            {{ archiveStore.status?.databaseReady ? 'Yes' : 'No' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Existing Files -->
    <div v-if="archiveStore.status?.archiveFiles?.length > 0" class="existing-files">
      <h4>Existing Archive Files</h4>
      <div class="file-list">
        <div 
          v-for="file in archiveStore.status.archiveFiles" 
          :key="file.name"
          class="file-item"
        >
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="file-date">{{ formatDate(file.modified) }}</span>
          </div>
          <button 
            @click="processExistingFile(file.path)"
            :disabled="archiveStore.isAnalyzing"
            class="process-button"
          >
            {{ archiveStore.isAnalyzing ? 'Processing...' : 'Process' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div v-if="archiveStore.stats" class="archive-stats">
      <h4>Archive Statistics</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ (archiveStore.stats?.totalConversations || 0).toLocaleString() }}</span>
          <span class="stat-label">Total Conversations</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ (archiveStore.stats?.totalMessages || 0).toLocaleString() }}</span>
          <span class="stat-label">Total Messages</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ (archiveStore.stats?.avgMessageCount || 0).toFixed(1) }}</span>
          <span class="stat-label">Avg Messages/Chat</span>
        </div>
        <div v-if="archiveStore.stats?.dateRange" class="stat-item">
          <span class="stat-value">{{ formatDateRange(archiveStore.stats.dateRange) }}</span>
          <span class="stat-label">Date Range</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="archive-actions">
      <button 
        v-if="archiveStore.hasData"
        @click="archiveStore.setActiveTab('explore')"
        class="explore-button"
      >
        Explore Data
      </button>
      
      <button 
        v-if="(archiveStore.status?.totalConversations || 0) > 0"
        @click="confirmClearArchive"
        class="clear-button"
        :disabled="archiveStore.isUploading || archiveStore.isAnalyzing"
      >
        Clear Archive
      </button>
    </div>

    <!-- Error Display -->
    <div v-if="archiveStore.error" class="error-message">
      <span>{{ archiveStore.error }}</span>
      <button @click="archiveStore.clearError()" class="close-error">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useArchiveStore } from '@/stores/archiveStore'
import { useChatStore } from '@/stores/chatStore'
import type { ArchiveFile } from '@/types/archive'

const archiveStore = useArchiveStore()
const chatStore = useChatStore()

// Component state
const isDragOver = ref(false)
const enableEmbeddings = ref(true)
const fileInput = ref<HTMLInputElement>()

// File handling
function triggerFileInput() {
  if (!archiveStore.isUploading) {
    fileInput.value?.click()
  }
}

function handleDragOver() {
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const files = event.dataTransfer?.files
  if (files?.length) {
    handleFiles(Array.from(files))
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    handleFiles(Array.from(target.files))
  }
}

async function handleFiles(files: File[]) {
  if (archiveStore.isUploading) return

  const jsonFiles = files.filter(file => 
    file.name.endsWith('.json') && file.size <= 100 * 1024 * 1024 // 100MB limit
  )

  if (jsonFiles.length === 0) {
    alert('Please select valid JSON files (max 100MB each)')
    return
  }

  // Process files one by one
  for (const file of jsonFiles) {
    try {
      const result = await archiveStore.uploadArchive(file, enableEmbeddings.value)
      console.log(`Successfully uploaded: ${file.name}`, result)
      
      // Refresh workspace list if workspaces were created
      if (result?.created_workspaces > 0) {
        await chatStore.loadChats()
      }
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error)
    }
  }
}

async function processExistingFile(filePath: string) {
  try {
    const result = await archiveStore.processExistingFile(filePath)
    console.log(`Successfully processed: ${filePath}`, result)
    
    // Refresh workspace list if workspaces were created
    if (result?.created_workspaces > 0) {
      await chatStore.loadChats()
    }
  } catch (error) {
    console.error(`Failed to process ${filePath}:`, error)
  }
}

function confirmClearArchive() {
  if (confirm('Are you sure you want to clear all archive data? This action cannot be undone.')) {
    archiveStore.clearArchive()
  }
}

// Utility functions
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString()
}

function formatDateRange(dateRange: { start: Date | null; end: Date | null; spanDays?: number }): string {
  if (!dateRange.start || !dateRange.end) return 'Unknown'
  
  const spanDays = dateRange.spanDays || 0
  if (spanDays < 1) return 'Same day'
  if (spanDays < 30) return `${Math.ceil(spanDays)} days`
  if (spanDays < 365) return `${Math.ceil(spanDays / 30)} months`
  return `${Math.ceil(spanDays / 365)} years`
}

// Lifecycle
onMounted(() => {
  archiveStore.initialize()
})
</script>

<style scoped>
.archive-upload {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
}

.drop-zone {
  border: 2px dashed #cbd5e0;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f8fafc;
}

.drop-zone.drag-over {
  border-color: #4299e1;
  background: #ebf8ff;
}

.drop-zone.uploading {
  cursor: not-allowed;
  background: #f7fafc;
}

.drop-zone.has-files {
  border-color: #48bb78;
  background: #f0fff4;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.upload-icon {
  color: #718096;
  margin-bottom: 0.5rem;
}

.drop-zone h3 {
  margin: 0;
  color: #2d3748;
  font-size: 1.25rem;
}

.drop-zone p {
  margin: 0;
  color: #718096;
}

.file-info {
  font-size: 0.875rem;
}

.upload-button {
  background: #4299e1;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.upload-button:hover {
  background: #3182ce;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4299e1;
  transition: width 0.3s ease;
}

.progress-text {
  color: #4a5568;
  font-weight: 500;
}

.progress-percentage {
  color: #718096;
  font-size: 0.875rem;
}

.upload-options {
  background: #f7fafc;
  padding: 1rem;
  border-radius: 8px;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
}

.option-item input {
  margin-right: 0.5rem;
}

.option-item small {
  color: #718096;
  margin-left: 1.25rem;
}

.archive-status, .existing-files, .archive-stats {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.archive-status h4, .existing-files h4, .archive-stats h4 {
  margin: 0 0 1rem 0;
  color: #2d3748;
  font-size: 1.1rem;
}

.status-grid, .stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.status-item, .stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.stat-item {
  flex-direction: column;
  text-align: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
}

.label {
  color: #718096;
  font-size: 0.875rem;
}

.value {
  font-weight: 600;
  color: #2d3748;
}

.value.ready {
  color: #38a169;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
}

.stat-label {
  color: #718096;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 500;
  color: #2d3748;
}

.file-size, .file-date {
  font-size: 0.875rem;
  color: #718096;
}

.process-button {
  background: #38a169;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.process-button:hover:not(:disabled) {
  background: #2f855a;
}

.process-button:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.archive-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.explore-button, .clear-button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.explore-button {
  background: #4299e1;
  color: white;
}

.explore-button:hover {
  background: #3182ce;
}

.clear-button {
  background: #fed7d7;
  color: #e53e3e;
  border: 1px solid #feb2b2;
}

.clear-button:hover:not(:disabled) {
  background: #feb2b2;
}

.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  background: #fed7d7;
  color: #e53e3e;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #feb2b2;
}

.close-error {
  background: none;
  border: none;
  color: #e53e3e;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>