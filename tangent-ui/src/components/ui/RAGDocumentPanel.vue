<template>
  <div class="rag-panel-container" :class="{ 'is-open': isOpen }">
    <!-- Content Overlay -->
    <div class="content-overlay" :class="{ 'visible': isOpen }" @click="$emit('close')"></div>

    <!-- RAG Document Panel -->
    <div class="rag-panel">
      <!-- Handle Bar -->
      <div class="handle-bar" @click="$emit('toggle')">
        <div class="handle-section">
          <FileText class="w-5 h-5 text-blue-400" />
          <span class="handle-text">{{ isOpen ? 'Hide Documents' : 'Show Documents' }}</span>
          <div class="document-count" v-if="documents.length > 0">
            {{ documents.length }} docs
          </div>
        </div>
        <div class="handle-controls">
          <button @click.stop="handleUpload" class="upload-btn">
            <Upload class="w-4 h-4" />
          </button>
          <button @click.stop="$emit('close')" class="close-btn">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Search Row -->
      <div class="search-row">
        <div class="search-container">
          <Search class="w-4 h-4 text-base-content/60" />
          <input
            v-model="searchQuery"
            @input="handleSearch"
            placeholder="Search across all documents..."
            class="search-input"
          />
        </div>
        <div class="search-controls">
          <select v-model="filterType" class="filter-select">
            <option value="all">All Types</option>
            <option value="pdf">PDFs</option>
            <option value="text">Text Files</option>
            <option value="markdown">Markdown</option>
            <option value="code">Code Files</option>
          </select>
          <div class="results-count">
            {{ filteredDocuments.length }} of {{ documents.length }}
          </div>
        </div>
      </div>

      <!-- Document Carousel -->
      <div class="carousel-container">
        <button 
          @click="scrollCarousel(-1)" 
          class="carousel-nav prev"
          :disabled="scrollPosition <= 0"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        
        <div 
          ref="carouselRef"
          class="document-carousel"
          @scroll="handleScroll"
        >
          <div 
            v-for="document in filteredDocuments" 
            :key="document.id"
            class="document-card"
            :class="{ 'active': document.id === activeDocumentId }"
            @click="selectDocument(document)"
            @dragstart="handleDragStart(document, $event)"
            draggable="true"
          >
            <!-- Document Header -->
            <div class="doc-header">
              <div class="doc-icon">
                <component :is="getDocumentIcon(document.type)" class="w-4 h-4" />
              </div>
              <div class="doc-info">
                <div class="doc-name" :title="document.filename">
                  {{ truncateFilename(document.filename) }}
                </div>
                <div class="doc-meta">
                  {{ document.type.toUpperCase() }} • {{ formatFileSize(document.size) }}
                </div>
                <div v-if="document.status && document.status !== 'ready'" class="doc-status">
                  <span v-if="document.status === 'processing'" class="status-processing">
                    <div class="status-spinner"></div>
                    Processing...
                  </span>
                  <span v-else-if="document.status === 'error'" class="status-error">
                    Error uploading
                  </span>
                </div>
              </div>
              <div class="doc-actions">
                <button @click.stop="pinDocument(document)" class="action-btn">
                  <Pin class="w-3 h-3" :class="{ 'text-blue-400': document.pinned }" />
                </button>
              </div>
            </div>

            <!-- Document Preview -->
            <div class="doc-preview">
              <div v-if="document.matches?.length > 0" class="search-matches">
                <div 
                  v-for="(match, index) in document.matches.slice(0, 2)" 
                  :key="index"
                  class="match-snippet"
                >
                  <div class="snippet-text" v-html="highlightText(match.text, searchQuery)"></div>
                  <div class="snippet-location">
                    {{ match.page ? `Page ${match.page}` : '' }}
                    {{ match.section ? `• ${match.section}` : '' }}
                    {{ match.line ? `• Line ${match.line}` : '' }}
                  </div>
                </div>
                <div v-if="document.matches.length > 2" class="more-matches">
                  +{{ document.matches.length - 2 }} more matches
                </div>
              </div>
              <div v-else class="doc-summary">
                <div class="summary-text">
                  {{ document.summary || 'No preview available' }}
                </div>
                <div class="doc-stats">
                  <span v-if="document.pageCount">{{ document.pageCount }} pages</span>
                  <span v-if="document.wordCount">{{ document.wordCount }} words</span>
                  <span v-if="document.lastModified">{{ formatDate(document.lastModified) }}</span>
                </div>
              </div>
            </div>

            <!-- Reference Indicators -->
            <div class="reference-indicators" v-if="document.references > 0">
              <div class="ref-count">
                <MessageCircle class="w-3 h-3" />
                {{ document.references }} refs
              </div>
              <div class="ref-preview">
                Referenced in current conversation
              </div>
            </div>

            <!-- Drag Handle -->
            <div class="drag-handle">
              <GripVertical class="w-3 h-3 text-base-content/40" />
            </div>
          </div>
        </div>

        <button 
          @click="scrollCarousel(1)" 
          class="carousel-nav next"
          :disabled="scrollPosition >= maxScrollPosition"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept=".pdf,.txt,.md,.docx,.json,.js,.ts,.vue,.py,.html,.css"
      @change="handleFileUpload"
      style="display: none;"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { 
  FileText, Upload, Search, X, ChevronLeft, ChevronRight, Pin, 
  MessageCircle, GripVertical, File, FileCode, Image
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle'): void;
  (e: 'documentSelected', document: any): void;
  (e: 'documentDragged', document: any, event: DragEvent): void;
}>();

// Refs
const carouselRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// State
const searchQuery = ref('');
const filterType = ref('all');
const scrollPosition = ref(0);
const activeDocumentId = ref<string | null>(null);

// Mock data for demonstration
const documents = ref([
  {
    id: '1',
    filename: 'project_requirements.pdf',
    type: 'pdf',
    size: 2048000,
    pageCount: 25,
    wordCount: 5000,
    lastModified: new Date('2024-12-01'),
    summary: 'Technical requirements and specifications for the new project including architecture decisions and implementation guidelines.',
    references: 3,
    pinned: false,
    matches: [
      {
        text: 'The system should support horizontal scaling with load balancing capabilities...',
        page: 5,
        section: 'Architecture Requirements'
      },
      {
        text: 'User authentication must implement OAuth 2.0 with JWT tokens...',
        page: 12,
        section: 'Security Specifications'
      }
    ]
  },
  {
    id: '2',
    filename: 'research_findings.md',
    type: 'markdown',
    size: 156000,
    wordCount: 3200,
    lastModified: new Date('2024-12-15'),
    summary: 'Comprehensive research findings on user behavior patterns and market analysis for Q4 2024.',
    references: 1,
    pinned: true,
    matches: []
  },
  {
    id: '3',
    filename: 'quarterly_data.xlsx',
    type: 'excel',
    size: 892000,
    pageCount: 8,
    lastModified: new Date('2024-12-20'),
    summary: 'Q4 sales data, revenue projections, and performance metrics across all departments.',
    references: 0,
    pinned: false,
    matches: []
  },
  {
    id: '4',
    filename: 'meeting_notes.txt',
    type: 'text',
    size: 24000,
    wordCount: 1200,
    lastModified: new Date('2024-12-22'),
    summary: 'Notes from the weekly team sync covering project updates, blockers, and next steps.',
    references: 2,
    pinned: false,
    matches: []
  }
]);

// Computed
const filteredDocuments = computed(() => {
  let filtered = documents.value;
  
  // Filter by type
  if (filterType.value !== 'all') {
    filtered = filtered.filter(doc => doc.type === filterType.value);
  }
  
  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(doc => 
      doc.filename.toLowerCase().includes(query) ||
      doc.summary.toLowerCase().includes(query) ||
      doc.matches?.some(match => match.text.toLowerCase().includes(query))
    );
    
    // Add search matches to documents
    filtered.forEach(doc => {
      if (doc.summary.toLowerCase().includes(query)) {
        // Add summary as a match if it contains the query
        doc.matches = doc.matches || [];
      }
    });
  }
  
  return filtered;
});

const maxScrollPosition = computed(() => {
  if (!carouselRef.value) return 0;
  return carouselRef.value.scrollWidth - carouselRef.value.clientWidth;
});

// Methods
const handleSearch = () => {
  // Search logic is handled by computed property
};

const selectDocument = (document: any) => {
  activeDocumentId.value = document.id;
  emit('documentSelected', document);
};

const handleUpload = () => {
  fileInputRef.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const fileInput = event.target as HTMLInputElement;
  const files = fileInput.files;
  
  if (!files || files.length === 0) {
    console.log('No files selected');
    return;
  }

  console.log('Files to upload:', files);
  
  // Process each selected file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // Validate file type
      const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|txt|md|docx)$/i)) {
        console.warn(`Unsupported file type: ${file.type} for file: ${file.name}`);
        continue;
      }

      // Create document object
      const newDocument = {
        id: `uploaded-${Date.now()}-${i}`,
        filename: file.name,
        type: getFileType(file.name),
        size: file.size,
        pageCount: 1, // Default, would be determined after processing
        uploadDate: new Date().toISOString(),
        status: 'processing',
        pinned: false,
        tags: ['uploaded'],
        file: file // Store the actual file for processing
      };

      // Add to documents array
      documents.value.unshift(newDocument);

      // Here you would typically upload to backend
      // For now, we'll simulate processing and add the document
      console.log(`Added document: ${file.name}`);
      
      // Simulate processing time
      setTimeout(() => {
        const doc = documents.value.find(d => d.id === newDocument.id);
        if (doc) {
          doc.status = 'ready';
        }
      }, 1000);

    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  // Reset file input
  fileInput.value = '';
};

const getFileType = (filename: string) => {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'pdf': return 'pdf';
    case 'txt': return 'text';
    case 'md': return 'markdown';
    case 'docx': return 'word';
    default: return 'document';
  }
};

const scrollCarousel = (direction: number) => {
  if (!carouselRef.value) return;
  
  const scrollAmount = 280; // Width of one card + gap
  const newPosition = scrollPosition.value + (direction * scrollAmount);
  
  carouselRef.value.scrollTo({
    left: Math.max(0, Math.min(newPosition, maxScrollPosition.value)),
    behavior: 'smooth'
  });
};

const handleScroll = () => {
  if (carouselRef.value) {
    scrollPosition.value = carouselRef.value.scrollLeft;
  }
};

const handleDragStart = (document: any, event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(document));
    event.dataTransfer.effectAllowed = 'copy';
  }
  emit('documentDragged', document, event);
};

const pinDocument = (document: any) => {
  document.pinned = !document.pinned;
};

const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'pdf': return FileText;
    case 'markdown': case 'text': return File;
    case 'excel': case 'csv': return FileText;
    case 'code': case 'javascript': case 'typescript': return FileCode;
    case 'image': return Image;
    default: return File;
  }
};

const truncateFilename = (filename: string, maxLength = 20) => {
  if (filename.length <= maxLength) return filename;
  const ext = filename.split('.').pop();
  const name = filename.substring(0, filename.lastIndexOf('.'));
  const truncated = name.substring(0, maxLength - ext!.length - 4) + '...';
  return `${truncated}.${ext}`;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

const highlightText = (text: string, query: string) => {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
};
</script>

<style scoped>
.rag-panel-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.content-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: -1;
}

.content-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

.rag-panel {
  height: 20vh;
  background: hsl(var(--b2) / 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid hsl(var(--b3));
  border-bottom: none;
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.is-open .rag-panel {
  transform: translateY(0);
}

.handle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--b3));
  cursor: pointer;
  background: hsl(var(--b2) / 0.8);
  backdrop-filter: blur(15px);
  min-height: 3rem;
}

.handle-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.handle-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.9);
}

.document-count {
  padding: 0.25rem 0.5rem;
  background: hsl(var(--p) / 0.2);
  color: hsl(var(--p));
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.handle-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.upload-btn, .close-btn {
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: hsl(var(--b3) / 0.5);
  border: 1px solid hsl(var(--b3));
  color: hsl(var(--bc) / 0.7);
  transition: all 0.2s ease;
}

.upload-btn:hover, .close-btn:hover {
  background: hsl(var(--b3));
  color: hsl(var(--bc));
}

.search-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--b3));
  background: hsl(var(--b1) / 0.5);
  min-height: 3rem;
}

.search-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: hsl(var(--b2));
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: hsl(var(--bc));
  font-size: 0.875rem;
}

.search-input::placeholder {
  color: hsl(var(--bc) / 0.5);
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-select {
  padding: 0.5rem;
  background: hsl(var(--b2));
  border: 1px solid hsl(var(--b3));
  border-radius: 0.375rem;
  color: hsl(var(--bc));
  font-size: 0.875rem;
}

.results-count {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.6);
  white-space: nowrap;
}

.carousel-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  overflow: hidden;
}

.carousel-nav {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: hsl(var(--b3) / 0.5);
  border: 1px solid hsl(var(--b3));
  color: hsl(var(--bc) / 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.carousel-nav:hover:not(:disabled) {
  background: hsl(var(--b3));
  color: hsl(var(--bc));
}

.carousel-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.document-carousel {
  flex: 1;
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 0.25rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.document-carousel::-webkit-scrollbar {
  display: none;
}

.document-card {
  flex-shrink: 0;
  width: 16rem;
  background: hsl(var(--b2) / 0.7);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.75rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  backdrop-filter: blur(10px);
}

.document-card:hover {
  background: hsl(var(--b2));
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.document-card.active {
  border-color: hsl(var(--p));
  background: hsl(var(--p) / 0.1);
}

.doc-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.doc-icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--p) / 0.2);
  border-radius: 0.375rem;
  color: hsl(var(--p));
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--bc));
  truncate: true;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.6);
}

.doc-status {
  margin-top: 0.25rem;
}

.status-processing {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--info));
}

.status-spinner {
  width: 0.75rem;
  height: 0.75rem;
  border: 1.5px solid hsl(var(--info) / 0.3);
  border-top: 1.5px solid hsl(var(--info));
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.status-error {
  font-size: 0.75rem;
  color: hsl(var(--error));
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.doc-actions {
  flex-shrink: 0;
}

.action-btn {
  padding: 0.25rem;
  border-radius: 0.25rem;
  background: transparent;
  border: none;
  color: hsl(var(--bc) / 0.5);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: hsl(var(--b3) / 0.5);
  color: hsl(var(--bc));
}

.doc-preview {
  margin-bottom: 0.5rem;
  min-height: 4rem;
}

.search-matches {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.match-snippet {
  padding: 0.5rem;
  background: hsl(var(--s) / 0.1);
  border: 1px solid hsl(var(--s) / 0.2);
  border-radius: 0.375rem;
}

.snippet-text {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--bc) / 0.8);
  margin-bottom: 0.25rem;
}

.snippet-location {
  font-size: 0.65rem;
  color: hsl(var(--bc) / 0.5);
}

.more-matches {
  font-size: 0.75rem;
  color: hsl(var(--s));
  text-align: center;
  padding: 0.25rem;
}

.doc-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-text {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--bc) / 0.7);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-stats {
  display: flex;
  gap: 0.5rem;
  font-size: 0.65rem;
  color: hsl(var(--bc) / 0.5);
}

.doc-stats span {
  background: hsl(var(--b3) / 0.5);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.reference-indicators {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px solid hsl(var(--b3));
}

.ref-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--a));
}

.ref-preview {
  font-size: 0.65rem;
  color: hsl(var(--bc) / 0.5);
}

.drag-handle {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.document-card:hover .drag-handle {
  opacity: 1;
}

:deep(.search-highlight) {
  background: hsl(var(--a) / 0.3);
  color: hsl(var(--a-content));
  padding: 0.125rem;
  border-radius: 0.125rem;
  font-weight: 600;
}

/* Responsive */
@media (max-width: 1024px) {
  .document-card {
    width: 14rem;
  }
  
  .search-row {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  
  .search-controls {
    justify-content: space-between;
  }
}

@media (max-width: 768px) {
  .document-card {
    width: 12rem;
  }
  
  .handle-bar {
    padding: 0.5rem;
  }
  
  .search-row {
    padding: 0.5rem;
  }
}
</style>