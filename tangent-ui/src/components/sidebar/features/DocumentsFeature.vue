<template>
  <div class="documents-feature" :class="'theme-' + currentTheme">
    <!-- Wrapper around RAGDocumentPanel adapted for sidebar -->
    <div class="documents-content">
      <!-- Header Section -->
      <div class="documents-header section-top" :style="headerStyle">
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
      <div class="search-section section-middle" :style="sectionStyle">
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
      <div class="results-section section-bottom">
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

// For use in v-bind styles
const { themeColors, isDarkTheme } = useThemeColors();

// Reactive state
const searchQuery = ref('');
const filterType = ref('all');
const documents = ref([]); // This would be loaded from a store or API

// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);

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
  // Use theme colors in a rotating pattern
  const typeToThemeColor = {
    pdf: themeColorsRef.value.primary,
    text: themeColorsRef.value.secondary,
    image: themeColorsRef.value.accent,
    code: themeColorsRef.value.primary,
    markdown: themeColorsRef.value.secondary
  };
  
  const color = typeToThemeColor[doc.type] || themeColorsRef.value.accent;
  return {
    background: `linear-gradient(135deg, 
      color-mix(in srgb, ${color} 15%, transparent),
      color-mix(in srgb, ${color} 10%, transparent))`,
    color: color,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`
  };
};
</script>

<style scoped>
.documents-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 0.5rem;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.documents-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--bc) / 0.08));
  border-radius: 16px;
  position: relative;
  box-shadow: 
    0 8px 32px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.documents-content::before {
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

.documents-header {
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, rgba(255, 255, 255, 0.02)),
    color-mix(in srgb, v-bind(themeColors.secondary) 5%, rgba(255, 255, 255, 0.01)));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.08));
  position: relative;
  overflow: hidden;
  min-height: 40px;
}

.documents-header::before {
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

.header-section {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.header-section .w-5 {
  color: v-bind(themeColors.primary);
}

.header-text {
  font-weight: 700;
  font-size: 0.8125rem;
  color: hsl(var(--bc));
  letter-spacing: -0.01em;
  background: linear-gradient(135deg, 
    hsl(var(--bc)),
    color-mix(in srgb, v-bind(themeColors.primary) 40%, hsl(var(--bc))));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.document-count {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent),
    color-mix(in srgb, v-bind(themeColors.secondary) 10%, transparent));
  color: v-bind(themeColors.primary);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 25%, transparent);
}

.header-controls {
  display: flex;
  gap: 8px;
}

.upload-btn, .action-btn {
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, rgba(255, 255, 255, 0.02)));
  color: hsl(var(--bc) / 0.8);
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.08));
  position: relative;
  z-index: 1;
}

.upload-btn:hover, .action-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 12%, hsl(var(--b2))));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

.search-section {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 4%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, rgba(255, 255, 255, 0.01)));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.06));
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, hsl(var(--b2))));
  border-radius: 8px;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.1));
}

.search-container .w-4 {
  color: v-bind(themeColors.accent);
}

.search-input {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
  color: hsl(var(--bc));
}

.search-input:focus {
  outline: none;
}

.search-container:focus-within {
  box-shadow: 0 0 0 2px color-mix(in srgb, v-bind(themeColors.primary) 30%, transparent);
  border-color: v-bind(themeColors.primary);
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.6875rem;
  cursor: pointer;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.accent) 6%, rgba(255, 255, 255, 0.02)));
  color: hsl(var(--bc));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 20%, hsl(var(--bc) / 0.08));
  transition: all 0.2s ease;
}

.filter-select:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.accent) 12%, hsl(var(--b2))));
  box-shadow: 0 2px 8px color-mix(in srgb, v-bind(themeColors.secondary) 15%, transparent);
}

.filter-select:focus {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, v-bind(themeColors.secondary) 30%, transparent);
  border-color: v-bind(themeColors.secondary);
}

.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-header {
  padding: 8px 12px;
  flex-shrink: 0;
}

.results-count {
  font-size: 0.6875rem;
  opacity: 0.7;
}

.documents-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.document-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 4px;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 3%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.secondary) 2%, rgba(255, 255, 255, 0.01)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 12%, hsl(var(--bc) / 0.08));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.document-item::before {
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

.document-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent);
  border-color: v-bind(themeColors.primary);
}

.document-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
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
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-meta {
  display: flex;
  gap: 6px;
  font-size: 0.6875rem;
  opacity: 0.6;
  margin-top: 1px;
}

.document-actions {
  display: flex;
  gap: 2px;
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
  position: relative;
}

.empty-state::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, 
    color-mix(in srgb, v-bind(themeColors.primary) 5%, transparent),
    transparent);
  border-radius: 50%;
  pointer-events: none;
}

.empty-state .w-12 {
  color: v-bind(themeColors.accent);
  position: relative;
  z-index: 1;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: hsl(var(--bc));
  position: relative;
  z-index: 1;
}

.empty-state p {
  opacity: 0.7;
  font-size: 14px;
  margin-bottom: 24px;
  max-width: 280px;
  color: hsl(var(--bc) / 0.8);
  position: relative;
  z-index: 1;
}

.upload-cta-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: linear-gradient(135deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary));
  color: white;
  border: none;
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 25%, transparent);
  position: relative;
  z-index: 1;
}

.upload-cta-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px color-mix(in srgb, v-bind(themeColors.primary) 30%, transparent);
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 90%, black), 
    color-mix(in srgb, v-bind(themeColors.secondary) 90%, black));
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