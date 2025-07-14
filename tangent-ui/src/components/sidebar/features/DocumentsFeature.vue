<template>
  <div class="documents-feature" :class="'theme-' + currentTheme">
    <!-- Wrapper around RAGDocumentPanel adapted for sidebar -->
    <div class="documents-content">
      <!-- Header Section -->
      <div class="documents-header" :style="headerStyle">
        <div class="header-section">
          <FileText class="w-5 h-5 text-blue-400" />
          <span class="header-text">Document Library</span>
          <div class="document-count" v-if="documents.length > 0">
            {{ documents.length }} docs
          </div>
        </div>
        <div class="header-controls">
          <button @click="handleUpload" class="upload-btn" :style="buttonStyle">
            <Upload class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Search Section -->
      <div class="search-section" :style="sectionStyle">
        <div class="search-container">
          <Search class="w-4 h-4 text-base-content/60" />
          <input
            v-model="searchQuery"
            @input="handleSearch"
            placeholder="Search documents..."
            class="search-input"
            :style="inputStyle"
          />
        </div>
        <div class="search-controls">
          <select v-model="filterType" class="filter-select" :style="selectStyle">
            <option value="all">All Types</option>
            <option value="pdf">PDFs</option>
            <option value="text">Text Files</option>
            <option value="markdown">Markdown</option>
            <option value="code">Code Files</option>
          </select>
        </div>
      </div>

      <!-- Results Section -->
      <div class="results-section">
        <div class="results-header" :style="sectionStyle">
          <span class="results-count">{{ filteredDocuments.length }} of {{ documents.length }} documents</span>
        </div>

        <!-- Document List -->
        <div class="documents-list">
          <div
            v-for="doc in filteredDocuments"
            :key="doc.id"
            class="document-item"
            :style="documentItemStyle"
            @click="handleDocumentSelect(doc)"
            @dragstart="handleDragStart(doc, $event)"
            draggable="true">
            
            <div class="document-icon" :style="getDocumentIconStyle(doc)">
              <component :is="getDocumentIcon(doc)" class="w-4 h-4" />
            </div>
            
            <div class="document-info">
              <div class="document-name">{{ doc.name }}</div>
              <div class="document-meta">
                <span class="document-size">{{ formatFileSize(doc.size) }}</span>
                <span class="document-date">{{ formatDate(doc.uploadedAt) }}</span>
              </div>
            </div>
            
            <div class="document-actions">
              <button @click.stop="handleDocumentAction(doc, 'view')" class="action-btn" :style="buttonStyle">
                <Eye class="w-3 h-3" />
              </button>
              <button @click.stop="handleDocumentAction(doc, 'delete')" class="action-btn" :style="buttonStyle">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="documents.length === 0" class="empty-state">
          <FileText class="w-12 h-12 opacity-50" />
          <h3>No Documents</h3>
          <p>Upload documents to get started with AI-powered document search and analysis.</p>
          <button @click="handleUpload" class="upload-cta-btn" :style="ctaButtonStyle">
            <Upload class="w-4 h-4" />
            Upload Documents
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  FileText, 
  Upload, 
  Search, 
  Eye, 
  X, 
  File, 
  Image, 
  Code,
  BookOpen
} from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { useThemeColors } from '@/composables/useThemeColors';

const emit = defineEmits<{
  'document-selected': [document: any];
  'document-dragged': [document: any, event: DragEvent];
}>();

// Stores
const themeStore = useThemeStore();

// Theme composable
const {
  currentTheme: currentThemeRef,
  isDarkTheme: isDarkThemeRef,
  themeColors: themeColorsRef,
  getTextColor
} = useThemeColors();

// Reactive state
const searchQuery = ref('');
const filterType = ref('all');
const documents = ref([]); // This would be loaded from a store or API

// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Computed
const filteredDocuments = computed(() => {
  let filtered = documents.value;
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(doc => 
      doc.name.toLowerCase().includes(query) ||
      doc.content?.toLowerCase().includes(query)
    );
  }
  
  // Apply type filter
  if (filterType.value !== 'all') {
    filtered = filtered.filter(doc => doc.type === filterType.value);
  }
  
  return filtered;
});

// Methods
const handleUpload = () => {
  // Trigger file upload dialog or drag-drop area
  console.log('Upload documents');
};

const handleSearch = () => {
  // Search is reactive through computed
  console.log('Searching:', searchQuery.value);
};

const handleDocumentSelect = (doc: any) => {
  emit('document-selected', doc);
};

const handleDragStart = (doc: any, event: DragEvent) => {
  emit('document-dragged', doc, event);
};

const handleDocumentAction = (doc: any, action: string) => {
  switch (action) {
    case 'view':
      // Open document viewer
      break;
    case 'delete':
      // Delete document
      break;
  }
};

const getDocumentIcon = (doc: any) => {
  switch (doc.type) {
    case 'pdf':
    case 'text':
      return FileText;
    case 'image':
      return Image;
    case 'code':
      return Code;
    case 'markdown':
      return BookOpen;
    default:
      return File;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString();
};

// Computed styles
const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 20, 0.5)' : 'rgba(240, 240, 240, 0.5)',
    color: getTextColor()
  };
});

const sectionStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.2)' : 'rgba(200, 200, 200, 0.2)'}`,
    color: getTextColor()
  };
});

const buttonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const inputStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const selectStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const documentItemStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.5)' : 'rgba(255, 255, 255, 0.5)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)',
    color: getTextColor()
  };
});

const ctaButtonStyle = computed(() => {
  return {
    backgroundColor: themeColors.value.primary,
    color: 'white',
    border: 'none'
  };
});

const getDocumentIconStyle = (doc: any) => {
  const colors = {
    pdf: '#ef4444',
    text: '#3b82f6',
    image: '#10b981',
    code: '#8b5cf6',
    markdown: '#f59e0b'
  };
  
  const color = colors[doc.type] || '#6b7280';
  return {
    backgroundColor: `${color}20`,
    color: color
  };
};
</script>

<style scoped>
.documents-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.documents-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.documents-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-text {
  font-weight: 600;
  font-size: 16px;
}

.document-count {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.upload-btn, .action-btn {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-btn:hover, .action-btn:hover {
  opacity: 0.8;
}

.search-section {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  ring: 2px solid rgba(59, 130, 246, 0.5);
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-header {
  padding: 12px 16px;
  flex-shrink: 0;
}

.results-count {
  font-size: 12px;
  opacity: 0.7;
}

.documents-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.document-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.document-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.document-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.document-info {
  flex: 1;
  min-width: 0;
}

.document-name {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  opacity: 0.6;
  margin-top: 2px;
}

.document-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.document-item:hover .document-actions {
  opacity: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px;
}

.empty-state p {
  opacity: 0.7;
  font-size: 14px;
  margin-bottom: 24px;
  max-width: 280px;
}

.upload-cta-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-cta-btn:hover {
  transform: translateY(-1px);
}

/* Theme-specific text contrast overrides */
.theme-light,
.theme-cupcake,
.theme-bumblebee,
.theme-emerald,
.theme-corporate,
.theme-retro,
.theme-valentine,
.theme-garden,
.theme-pastel,
.theme-wireframe,
.theme-cmyk,
.theme-lemonade,
.theme-winter,
.theme-lofi,
.theme-fantasy,
.theme-autumn {
  .header-text,
  .document-name,
  .results-count {
    color: rgba(0, 0, 0, 0.9) !important;
    font-weight: 600;
  }
  
  .document-count {
    color: rgba(0, 0, 0, 0.6) !important;
    background: rgba(0, 0, 0, 0.1) !important;
  }
  
  .document-meta {
    color: rgba(0, 0, 0, 0.5) !important;
  }
  
  .search-input::placeholder {
    color: rgba(0, 0, 0, 0.5) !important;
  }
  
  .empty-state h3 {
    color: rgba(0, 0, 0, 0.9) !important;
  }
  
  .empty-state p {
    color: rgba(0, 0, 0, 0.6) !important;
  }
  
  .action-btn {
    background: rgba(0, 0, 0, 0.1) !important;
    color: rgba(0, 0, 0, 0.7) !important;
  }
  
  .action-btn:hover {
    background: rgba(0, 0, 0, 0.15) !important;
    color: rgba(0, 0, 0, 0.9) !important;
  }
}

.theme-dark,
.theme-synthwave,
.theme-cyberpunk,
.theme-halloween,
.theme-forest,
.theme-aqua,
.theme-black,
.theme-luxury,
.theme-neon,
.theme-dracula,
.theme-business,
.theme-acid,
.theme-night,
.theme-coffee {
  .header-text,
  .document-name,
  .results-count {
    color: rgba(255, 255, 255, 0.95) !important;
  }
  
  .document-count {
    color: rgba(255, 255, 255, 0.6) !important;
    background: rgba(255, 255, 255, 0.1) !important;
  }
  
  .document-meta {
    color: rgba(255, 255, 255, 0.5) !important;
  }
  
  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.5) !important;
  }
  
  .empty-state h3 {
    color: rgba(255, 255, 255, 0.95) !important;
  }
  
  .empty-state p {
    color: rgba(255, 255, 255, 0.6) !important;
  }
}
</style>