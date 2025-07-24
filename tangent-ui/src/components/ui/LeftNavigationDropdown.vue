<template>
  <div class="left-navigation-dropdown" :class="'theme-' + currentTheme">
    <!-- Header with TangentLogo (theme toggle functionality) -->
    <div class="dropdown-header">
      <div class="app-title" @click.stop>
        <TangentLogo class="w-6 h-6" />
      </div>
    </div>

    <!-- Navigation Items -->
    <div class="nav-section">
      <div
        v-for="item in navigationItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: activeItem === item.id }"
        @click="handleNavItemClick(item)"
        :style="getNavItemStyle(item)"
      >
        <div class="nav-icon">
          <component :is="item.icon" :size="18" />
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </div>

    <!-- Chat History Section -->
    <div class="chat-history-section" v-if="showChatHistory">
      <div class="section-header">
        <h3 class="section-title">Recent Workspaces</h3>
      </div>
      
      <!-- Search -->
      <div class="chat-search">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search workspaces..."
          class="search-input"
        />
      </div>

      <!-- Sort Options -->
      <div class="sort-options">
        <button
          v-for="option in sortOptions"
          :key="option.value"
          @click="sortBy = option.value"
          class="sort-btn"
          :class="{ active: sortBy === option.value }"
          type="button"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- Chat List -->
      <div class="chat-list">
        <div
          v-for="chat in filteredChats"
          :key="chat.id"
          class="chat-item"
          @click="handleChatClick(chat)"
          :style="chatItemStyle"
        >
          <div class="chat-icon">
            <MessageCircle :size="16" />
          </div>
          <div class="chat-info">
            <div class="chat-title">{{ chat.title }}</div>
            <div class="chat-meta">
              {{ formatDate(chat.lastUpdated) }} • {{ chat.nodeCount }} nodes
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Home,
  MessageCircle,
  FolderOpen,
  FileText
} from 'lucide-vue-next'
import TangentLogo from '@/components/logo/TangentLogo.vue'
import { useThemeStore } from '@/stores/themeStore'
import { useChatStore } from '@/stores/chatStore'

const themeStore = useThemeStore()
const chatStore = useChatStore()
const currentTheme = computed(() => themeStore.currentTheme)
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value))
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value))

const activeItem = ref('workspaces')
const showChatHistory = ref(true)
const searchQuery = ref('')
const sortBy = ref('recent')

const navigationItems = ref([
  {
    id: 'home',
    label: 'New Chat',
    icon: Home,
    isPrimary: true
  }
])

const sortOptions = ref([
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Nodes', value: 'nodes' }
])

const filteredChats = computed(() => {
  let chats = [...chatStore.chats]
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    chats = chats.filter(chat => 
      chat.title.toLowerCase().includes(query)
    )
  }
  
  // Sort
  switch (sortBy.value) {
    case 'name':
      chats.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'nodes':
      chats.sort((a, b) => (b.nodeCount || 0) - (a.nodeCount || 0))
      break
    case 'recent':
    default:
      chats.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
  }
  
  return chats.slice(0, 8) // Limit to 8 items for dropdown
})

const getNavItemStyle = (item: any) => {
  const baseStyle = {
    transition: 'all 0.2s ease'
  }
  
  if (activeItem.value === item.id) {
    return {
      ...baseStyle,
      backgroundColor: `${themeColors.value.primary}20`,
      borderLeft: `3px solid ${themeColors.value.primary}`,
      color: themeColors.value.primary
    }
  }
  
  return baseStyle
}

const chatItemStyle = computed(() => ({
  transition: 'all 0.2s ease',
  cursor: 'pointer'
}))

const handleNavItemClick = (item: any) => {
  activeItem.value = item.id
  emit('nav-item-clicked', item)
  
  // Toggle chat history for workspaces
  if (item.id === 'workspaces') {
    showChatHistory.value = true
  } else {
    showChatHistory.value = false
  }
}

const handleChatClick = (chat: any) => {
  emit('chat-selected', chat.id)
  emit('close')
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

const emit = defineEmits<{
  'nav-item-clicked': [item: any]
  'chat-selected': [chatId: string]
  'close': []
}>()

onMounted(() => {
  // Load chats if not already loaded
  if (chatStore.chats.length === 0) {
    chatStore.loadChats()
  }
})
</script>

<style scoped>
.left-navigation-dropdown {
  width: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}

.app-title {
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-section {
  padding: 8px 0;
  border-bottom: 1px solid;
  border-color: inherit;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 0;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.nav-icon {
  margin-right: 12px;
  display: flex;
  align-items: center;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.chat-history-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-header {
  padding: 12px 16px 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.chat-search {
  padding: 0 16px 8px;
}

.search-input {
  width: 100%;
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.1);
  outline: none;
}

.search-input:focus {
  border-color: var(--theme-primary);
}

.sort-options {
  display: flex;
  padding: 0 16px 8px;
  gap: 4px;
}

.sort-btn {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-btn:hover {
  background: rgba(128, 128, 128, 0.1);
}

.sort-btn.active {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 8px;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-item:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.chat-icon {
  margin-right: 12px;
  opacity: 0.6;
  flex-shrink: 0;
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-meta {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 2px;
}

/* Theme-specific styles */
.theme-cyberpunk .dropdown-header,
.theme-cyberpunk .nav-section {
  border-color: rgba(0, 255, 136, 0.3);
}

.theme-synthwave .dropdown-header,
.theme-synthwave .nav-section {
  border-color: rgba(255, 30, 157, 0.3);
}

.theme-aqua .dropdown-header,
.theme-aqua .nav-section {
  border-color: rgba(9, 236, 243, 0.3);
}

/* Scrollbar styling */
.chat-list::-webkit-scrollbar {
  width: 4px;
}

.chat-list::-webkit-scrollbar-track {
  background: rgba(128, 128, 128, 0.1);
}

.chat-list::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
}

.chat-list::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}
</style>