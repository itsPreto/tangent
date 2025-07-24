<template>
  <div
    class="left-navigation-sidebar"
    :class="[
      'theme-' + currentTheme,
      { expanded: isExpanded, compact: !isExpanded }
    ]"
    :style="sidebarStyle"
  >
    <!-- Header Area with Toggle -->
    <div class="header-area">
      <button
        class="toggle-button"
        @click="toggleSidebar"
        :style="toggleButtonStyle"
      >
        <ChevronLeft
          v-if="isExpanded"
          class="toggle-icon"
          :size="20"
        />
        <div v-else class="sidebar-toggle-container">
          <PanelLeft
            class="toggle-icon sidebar-icon"
            :size="20"
          />
          <ChevronRight
            class="toggle-icon chevron-icon"
            :size="20"
          />
        </div>
      </button>
    </div>

    <!-- Navigation Section -->
    <div class="nav-section">
      <!-- Primary Navigation Group -->
      <div class="nav-group">
        <div
          v-for="item in primaryNavItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: activeItem===item.id, primary: item.isPrimary }"
          @click="handleNavItemClick(item)"
          :style="getNavItemStyle(item)"
        >
          <div class="nav-icon">
            <component :is="item.icon" :size="20" />
          </div>
          <Transition name="fade-slide" mode="out-in">
            <span v-if="isExpanded" class="nav-label"
              >{{ item.label }}</span
            >
          </Transition>
          <div v-if="!isExpanded" class="tooltip">{{ item.label }}</div>
        </div>
      </div>

      <!-- Chat History Panel -->
      <Transition name="fade-slide">
        <div
          v-if="isExpanded && isChatHistoryExpanded"
          class="chat-history-content-direct"
          :style="chatHistoryContentStyle"
        >
          <!-- Search -->
          <div class="chat-search">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search chats..."
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
              :class="{ active: sortBy===option.value }"
            >
              {{ option.label }}
            </button>
          </div>

          <!-- Chat List -->
          <transition-group
            name="cascade"
            tag="div"
            class="chat-list"
          >
            <div
              v-for="(chat, idx) in filteredChats"
              :key="chat.id"
              class="chat-item"
              :class="{ active: chat.id===currentWorkspaceId, template: chat.isTemplate }"
              @click="chat.isTemplate ? handleTemplateClick(chat) : loadWorkspace(chat.id)"
              :style="{ transitionDelay: `${idx * 50}ms` }"
            >
              <div class="chat-title">
                {{ chat.title }}
                <span
                  v-if="chat.isTemplate"
                  class="template-indicator"
                  >✨</span
                >
              </div>
              <div class="chat-meta">
                {{ chat.isTemplate
                  ? 'Choose workspace type...'
                  : formatChatInfo(chat) }}
              </div>
            </div>
            <div
              v-if="filteredChats.length===0"
              class="no-chats"
            >
              No chats found
            </div>
          </transition-group>
        </div>
      </Transition>
    </div>

    <!-- Help Button Section -->
    <div class="help-button-section">
      <div
        class="nav-item help-button"
        :class="{ active: activeItem==='help' }"
        @click="handleNavItemClick({ id:'help', icon:HelpCircle, label:'Help' })"
        :style="getNavItemStyle({ id:'help', icon:HelpCircle, label:'Help' })"
      >
        <div class="nav-icon"><HelpCircle :size="20" /></div>
        <Transition name="fade-slide" mode="out-in">
          <span v-if="isExpanded" class="nav-label">Help</span>
        </Transition>
        <div v-if="!isExpanded" class="tooltip">Help</div>
      </div>
    </div>

    <!-- User Profile Section -->
    <div class="user-profile" :style="userProfileStyle">
      <div class="user-avatar"><User :size="20" /></div>
      <Transition name="fade-slide" mode="out-in">
        <div v-if="isExpanded" class="user-info">
          <div class="user-name">User</div>
          <div class="user-email">user@tangent.ai</div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  MessageSquare,
  HelpCircle,
  User,
  PanelLeft
} from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { useAppStore } from '@/stores/appStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useChatStore } from '@/stores/chatStore';
import { useThemeColors } from '@/composables/useThemeColors';
import { adjustColorLightness, getContrastTextColor } from '@/utils/themeUtils';

const props = defineProps<{
  isExpanded?: boolean;
}>();

const emit = defineEmits<{
  'toggle-expanded': [];
  'nav-item-clicked': [item: any];
}>();

// Stores
const themeStore = useThemeStore();
const appStore = useAppStore();
const canvasStore = useCanvasStore();
const chatStore = useChatStore();

// Theme composable with all utilities
const {
  currentTheme,
  isDarkTheme,
  themeColors,
  backgroundColors,
  getTextColor,
  forceLightText
} = useThemeColors();

// Inject canvas ref from parent to handle proper workspace transitions
const canvasRef = inject<any>('canvasRef', null);

// Reactive state
const activeItem = ref('home');

// Chat history state
const isChatHistoryExpanded = ref(false);
const searchQuery = ref('');
const sortBy = ref<'recent' | 'alphabetical' | 'size'>('recent');

// Expand/collapse state
const isExpanded = computed({
  get: () => props.isExpanded ?? false,
  set: (value) => emit('toggle-expanded')
});

// Navigation items
const primaryNavItems = [
  { id: 'new-chat', icon: Plus, label: 'New Chat', group: 'primary', isPrimary: true },
  { id: 'chat-history', icon: MessageSquare, label: 'Chat History', group: 'primary', isPrimary: false },
];

// Chat history functionality
const sortOptions = [
  { value: 'recent', label: 'Recent' },
  { value: 'alphabetical', label: 'A-Z' },
  { value: 'size', label: 'Size' }
];

const currentWorkspaceId = computed(() => canvasStore.lastSavedWorkspaceId);

const sortedChats = computed(() => {
  let chats = [...chatStore.chats];

  switch (sortBy.value) {
    case 'alphabetical':
      chats.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'size':
      chats.sort((a, b) => (b.nodeCount || 0) - (a.nodeCount || 0));
      break;
    case 'recent':
    default:
      chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
  }

  return chats;
});

const filteredChats = computed(() => {
  if (!searchQuery.value.trim()) {
    return sortedChats.value.slice(0, 10); // Limit to 10 for sidebar
  }

  const query = searchQuery.value.toLowerCase().trim();
  return sortedChats.value.filter(chat =>
    chat.title.toLowerCase().includes(query)
  ).slice(0, 10);
});

// Methods
const toggleChatHistory = () => {
  isChatHistoryExpanded.value = !isChatHistoryExpanded.value;
};

const formatChatInfo = (chat: any) => {
  const date = new Date(chat.updatedAt).toLocaleDateString();
  const nodeCount = chat.nodeCount || 0;
  return `${nodeCount} nodes • ${date}`;
};

const loadWorkspace = async (id: string) => {
  try {
    // Use canvas ref to handle proper workspace transition with animations
    if (canvasRef?.value && typeof canvasRef.value.handleWorkspaceSelect === 'function') {
      // Use the canvas's workspace selection method to properly transition
      // This handles welcome screen exit, animations, and proper state management
      await canvasRef.value.handleWorkspaceSelect(id);
    } else {
      // Fallback if canvas ref is not available
      console.warn('Canvas ref not available, using fallback workspace loading');
      await canvasStore.clearCurrentWorkspace();
      const success = await canvasStore.loadChatState(id);
      if (success) {
        canvasStore.lastSavedWorkspaceId = id;
      }
    }
  } catch (error) {
    console.error('Error loading workspace:', error);
  }
};

// Methods
const toggleSidebar = () => {
  emit('toggle-expanded');
};

const handleNavItemClick = (item: any) => {
  activeItem.value = item.id;
  emit('nav-item-clicked', item);

  // Handle specific navigation logic
  switch (item.id) {
    case 'home':
      // Navigate to home/overview
      if (canvasStore.returnToOverview) {
        canvasStore.returnToOverview();
      }
      break;
    case 'new-chat':
      // Create new workspace
      handleNewWorkspace();
      break;
    case 'chat-history':
      // Toggle chat history panel
      handleChatHistoryClick();
      break;
    case 'chats':
      // Show all workspaces
      handleShowAllWorkspaces();
      break;
    case 'settings':
      // Open agent configurator
      appStore.toggleAgentConfigurator();
      break;
    case 'help':
      // Toggle sliding footer
      console.log('Toggling sliding footer, current state:', appStore.isSlidingFooterOpen);
      appStore.toggleSlidingFooter();
      console.log('After toggle, new state:', appStore.isSlidingFooterOpen);
      break;
    // Add other cases as needed
  }
};

const handleNewWorkspace = async () => {
  // Check if user is on welcome screen
  const isOnWelcomeScreen = canvasRef?.value?.isWelcomeScreen ?? true;

  if (isOnWelcomeScreen) {
    // If on welcome screen, focus the input container
    const welcomeInputRef = canvasRef?.value?.getWelcomeInputRef?.();
    if (welcomeInputRef) {
      welcomeInputRef.focus();
    }
  } else {
    // Create a template chat that shows in sidebar and navigate to welcome screen
    const templateChat = await chatStore.createTemplateChat();
    if (templateChat) {
      await chatStore.loadChats();

      // Navigate back to welcome screen
      if (canvasRef?.value) {
        canvasRef.value.isWelcomeScreen = true;
        canvasRef.value.isWorkspaceOverview = false;

        // Focus the input
        const welcomeInputRef = canvasRef.value.getWelcomeInputRef?.();
        if (welcomeInputRef) {
          welcomeInputRef.focus();
        }
      }
    }
  }
};

const handleChatHistoryClick = () => {
  if (!isExpanded.value) {
    // In compact mode, expand sidebar first, then show chat history
    toggleSidebar();
    setTimeout(() => {
      isChatHistoryExpanded.value = true;
    }, 300); // Wait for sidebar expansion animation
  } else {
    // In expanded mode, toggle local chat history panel
    toggleChatHistory();
  }
};

const handleShowAllWorkspaces = () => {
  // Navigate to workspace overview
  if (canvasStore.showWorkspaceOverview) {
    canvasStore.showWorkspaceOverview();
  }
};

const handleTemplateClick = (templateChat: any) => {
  // For template chats, navigate to welcome screen to show workspace type selection
  if (canvasRef?.value) {
    canvasRef.value.isWelcomeScreen = true;
    canvasRef.value.isWorkspaceOverview = false;

    // Focus the input and potentially prefill with template info
    const welcomeInputRef = canvasRef.value.getWelcomeInputRef?.();
    if (welcomeInputRef) {
      welcomeInputRef.focus();
    }
  }
};


// Left sidebar only expands/collapses on click, not hover

// Computed styles using theme-aware backgrounds
const sidebarStyle = computed(() => {
  const baseBackground = backgroundColors.value.base;
  let backgroundColor = baseBackground;
  let borderColor = isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)';

  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    backgroundColor = 'rgba(20, 20, 30, 0.95)';
    borderColor = `${themeColors.value.primary}50`;
  } else if (currentTheme.value === 'synthwave') {
    backgroundColor = 'rgba(30, 10, 50, 0.95)';
    borderColor = `${themeColors.value.secondary}50`;
  } else if (currentTheme.value === 'cmyk') {
    backgroundColor = 'rgba(15, 15, 20, 0.95)';
    borderColor = `${themeColors.value.primary}40`;
  } else if (currentTheme.value === 'lofi') {
    backgroundColor = 'rgba(85, 82, 82, 0.95)';
    borderColor = 'rgba(130, 125, 125, 0.4)';
  } else if (currentTheme.value === 'garden') {
    backgroundColor = isDarkTheme.value ? 'rgba(20, 30, 25, 0.95)' : 'rgba(245, 250, 247, 0.95)';
    borderColor = `${themeColors.value.primary}30`;
  } else if (currentTheme.value === 'pastel') {
    backgroundColor = isDarkTheme.value ? 'rgba(30, 25, 30, 0.95)' : 'rgba(250, 248, 252, 0.95)';
    borderColor = `${themeColors.value.primary}25`;
  }

  return {
    backgroundColor,
    borderColor,
    color: forceLightText.value ? 'rgba(255, 255, 255, 0.95)' : getTextColor(),
    backdropFilter: 'blur(10px)',
    borderRight: `1px solid ${borderColor}`,
    borderTopRightRadius: '16px',
    borderBottomRightRadius: '16px',
    width: isExpanded.value ? '260px' : '60px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };
});

const toggleButtonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'
  };
});

const userProfileStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 40, 0.5)' : 'rgba(240, 240, 240, 0.5)',
    borderTop: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const chatHistoryContentStyle = computed(() => {
  let backgroundColor = isDarkTheme.value ? 'rgba(8, 8, 8, 0.9)' : 'rgba(250, 250, 250, 0.8)';
  let borderColor = isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)';

  // Theme-specific chat history backgrounds
  if (currentTheme.value === 'cyberpunk') {
    backgroundColor = 'rgba(5, 5, 15, 0.95)';
    borderColor = `${themeColors.value.primary}40`;
  } else if (currentTheme.value === 'synthwave') {
    backgroundColor = 'rgba(15, 2, 25, 0.95)';
    borderColor = `${themeColors.value.secondary}40`;
  } else if (currentTheme.value === 'cmyk') {
    backgroundColor = 'rgba(5, 5, 10, 0.95)';
    borderColor = `${themeColors.value.primary}40`;
  } else if (currentTheme.value === 'lofi') {
    backgroundColor = 'rgba(65, 62, 62, 0.95)';
    borderColor = 'rgba(120, 115, 115, 0.4)';
  } else if (currentTheme.value === 'garden') {
    backgroundColor = isDarkTheme.value ? 'rgba(10, 20, 15, 0.95)' : 'rgba(240, 248, 242, 0.9)';
    borderColor = `${themeColors.value.primary}35`;
  } else if (currentTheme.value === 'pastel') {
    backgroundColor = isDarkTheme.value ? 'rgba(20, 15, 20, 0.95)' : 'rgba(248, 246, 250, 0.9)';
    borderColor = `${themeColors.value.primary}30`;
  }

  return {
    backgroundColor,
    borderColor,
    color: getTextColor(),
    border: `1px solid ${borderColor}`,
    maxHeight: "80vh",
    backdropFilter: 'blur(10px)'
  };
});

const getNavItemStyle = (item: any) => {
  const isActive = activeItem.value === item.id;
  let backgroundColor = 'transparent';
  let color = getTextColor();
  let borderColor = 'transparent';
  let boxShadow = 'none';

  if (item.isPrimary) {
    backgroundColor = themeColors.value.primary;
    color = getContrastTextColor(themeColors.value.primary);
  } else if (isActive) {
    // Enhanced contrast for light themes
    const darkenedPrimary = isDarkTheme.value
      ? themeColors.value.primary
      : adjustColorLightness(themeColors.value.primary, -25);

    if (isDarkTheme.value) {
      backgroundColor = 'rgba(255, 255, 255, 0.15)';
      color = themeColors.value.primary;
      borderColor = `${themeColors.value.primary}60`;
    } else {
      // Light theme: stronger background and darker text
      backgroundColor = `${darkenedPrimary}20`;
      color = darkenedPrimary;
      borderColor = `${darkenedPrimary}60`;
      boxShadow = `inset 0 0 0 1px ${darkenedPrimary}30`;
    }
  }

  // Theme-specific adjustments for better contrast
  if (currentTheme.value === 'cyberpunk' && isActive) {
    backgroundColor = `${themeColors.value.primary}30`;
    color = themeColors.value.primary;
    boxShadow = `0 0 8px ${themeColors.value.primary}40`;
  } else if (currentTheme.value === 'synthwave' && isActive) {
    backgroundColor = `${themeColors.value.secondary}25`;
    color = themeColors.value.secondary;
    boxShadow = `0 0 8px ${themeColors.value.secondary}40`;
  } else if (currentTheme.value === 'cmyk' && isActive) {
    backgroundColor = `${themeColors.value.primary}25`;
    color = themeColors.value.primary;
    borderColor = `${themeColors.value.primary}70`;
    boxShadow = `0 0 8px ${themeColors.value.primary}50`;
  } else if (currentTheme.value === 'cmyk' && item.isPrimary) {
    backgroundColor = themeColors.value.primary;
    color = '#000000';
    borderColor = `${themeColors.value.primary}80`;
    boxShadow = `0 2px 8px ${themeColors.value.primary}60`;
  } else if (['garden', 'emerald', 'cupcake', 'corporate', 'pastel'].includes(currentTheme.value) && isActive) {
    // Extra contrast for light themes that need it
    const extraDarkened = adjustColorLightness(themeColors.value.primary, -35);
    backgroundColor = `${extraDarkened}25`;
    color = extraDarkened;
    borderColor = `${extraDarkened}80`;
    boxShadow = `inset 0 0 0 1px ${extraDarkened}40`;
  }

  return {
    backgroundColor,
    color,
    borderColor,
    boxShadow,
    borderLeft: isActive ? `3px solid ${isDarkTheme.value ? themeColors.value.primary : adjustColorLightness(themeColors.value.primary, -25)}` : '3px solid transparent',
    transition: 'all 0.2s ease'
  };
};

// Load chats on mount
onMounted(async () => {
  await chatStore.loadChats();
});
</script>

<style scoped>
.left-navigation-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  z-index: 1000;
  /* Sidebar pushes content instead of overlaying */
}

.left-navigation-sidebar.compact {
  width: 60px;
}

.left-navigation-sidebar.expanded {
  width: 260px;
}

.header-area {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  min-height: 60px;
}

.toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: transparent;
  border: 1px solid;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-button:hover {
  background: rgba(128, 128, 128, 0.15);
}

.toggle-icon {
  transition: transform 0.3s ease-in-out;
}

.sidebar-toggle-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.sidebar-icon {
  position: absolute;
  transition: opacity 0.3s ease, transform 0.3s ease;
  opacity: 1;
  transform: scale(1);
}

.chevron-icon {
  position: absolute;
  transition: opacity 0.3s ease, transform 0.3s ease;
  opacity: 0;
  transform: scale(0.8);
}

.toggle-button:hover .sidebar-icon {
  opacity: 0;
  transform: scale(0.8);
}

.toggle-button:hover .chevron-icon {
  opacity: 1;
  transform: scale(1);
}

.app-title {
  margin-left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
}

.title-text {
  white-space: nowrap;
}

.nav-section {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.nav-section::-webkit-scrollbar {
  width: 6px;
}

.nav-section::-webkit-scrollbar-track {
  background: transparent;
}

.nav-section::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 3px;
}

.nav-group {
  margin-bottom: 16px;
}

.nav-group:not(:first-child) {
  padding-top: 16px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0;
  margin: 4px 8px;
  cursor: pointer;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  min-height: 44px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-item:hover {
  background: rgba(128, 128, 128, 0.15) !important;
  transform: translateX(2px);
}

.nav-item.primary {
  margin: 8px;
}

.nav-item.primary:hover {
  opacity: 0.9;
}

.nav-icon {
  width: 36px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-label {
  margin-left: 8px;
  white-space: nowrap;
  font-weight: 500;
  font-size: 14px;
  color: inherit;
}

.tooltip {
  position: absolute;
  left: 68px;
  top: 50%;
  transform: translateY(-50%) translateX(-10px);
  background: rgba(40, 40, 40, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 1001;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(128, 128, 128, 0.2);
}

.compact .nav-item:hover .tooltip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.help-button-section {
  padding: 8px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.1);
  margin-top: 8px;
}

.help-button {
  margin: 4px 8px;
  border-radius: 8px;
}

.user-profile {
  margin-top: auto;
  display: flex;
  padding-top: 15px;
  padding-right: 0;
  padding-bottom: 15px;
  padding-left: 10px;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-profile:hover {
  background: rgba(128, 128, 128, 0.1) !important;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(128, 128, 128, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info {
  margin-left: 12px;
}

.user-name {
  font-weight: 500;
  font-size: 14px;
  color: inherit;
}

.user-email {
  font-size: 12px;
  color: inherit;
  opacity: 0.6;
}

/* Chat History Content Direct */
.chat-history-content-direct {
  margin: 8px;
  padding: 8px;
  border-radius: 8px;
  /* Background and border handled by computed style */
}

.chat-search {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.05);
  color: inherit;
  font-size: 12px;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: rgba(128, 128, 128, 0.4);
}

.search-input::placeholder {
  opacity: 0.5;
}

.sort-options {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.sort-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-btn:hover {
  background: rgba(128, 128, 128, 0.1);
  opacity: 0.9;
}

.sort-btn.active {
  background: var(--theme-primary, hsl(var(--p)));
  color: white;
  border-color: var(--theme-primary, hsl(var(--p)));
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Light theme specific contrast */
.theme-garden .sort-btn.active,
.theme-emerald .sort-btn.active,
.theme-cupcake .sort-btn.active,
.theme-corporate .sort-btn.active,
.theme-pastel .sort-btn.active {
  background: var(--theme-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.chat-list {
  overflow-y: auto;
  margin: -4px;
  padding: 4px;
}

.chat-list::-webkit-scrollbar {
  width: 4px;
}

.chat-list::-webkit-scrollbar-track {
  background: transparent;
}

.chat-list::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
}

.chat-item {
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 4px;
}

.chat-item:hover {
  background: rgba(128, 128, 128, 0.1);
  transform: translateX(2px);
}

.chat-item.active {
  background: var(--theme-primary, hsl(var(--p))) !important;
  color: white !important;
  border: 1px solid var(--theme-primary, hsl(var(--p))) !important;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-item.active .chat-title {
  color: white !important;
}

.chat-item.active .chat-meta {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Enhanced contrast for light themes */
.theme-garden .chat-item.active,
.theme-emerald .chat-item.active,
.theme-cupcake .chat-item.active,
.theme-corporate .chat-item.active,
.theme-pastel .chat-item.active,
.theme-bumblebee .chat-item.active,
.theme-valentine .chat-item.active,
.theme-retro .chat-item.active,
.theme-lemonade .chat-item.active,
.theme-winter .chat-item.active,
.theme-lofi .chat-item.active,
.theme-fantasy .chat-item.active,
.theme-autumn .chat-item.active {
  background: var(--theme-primary) !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15),
    inset 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}

.theme-lofi .chat-title {
  color: #ffffff;
}

.chat-title {
  font-size: 12px;
  font-weight: 500;
  color: inherit;
  opacity: 0.9;
  line-height: 1.3;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-meta {
  font-size: 10px;
  color: inherit;
  opacity: 0.5;
  line-height: 1.2;
}

.no-chats {
  text-align: center;
  padding: 16px;
  color: inherit;
  opacity: 0.5;
  font-size: 12px;
}

.help-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.help-item {
  margin: 4px 8px;
}

/* Smooth slide down transition */
.slide-down-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.6, 1);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Smooth fade-slide animations */
.fade-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 1, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

/* Cascade animation (top-down) */
.cascade-enter-active,
.cascade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.cascade-enter-from,
.cascade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.cascade-enter-to,
.cascade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>