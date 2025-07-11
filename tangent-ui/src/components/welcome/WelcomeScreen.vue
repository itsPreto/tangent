<template>
  <div class="welcome-screen" :class="['theme-' + currentTheme, { 'drag-over': isDragOver }]"
    :style="dynamicThemeStyles" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">

    <!-- Main Welcome Content -->
    <div class="welcome-content" :class="{ 'templates-expanded': isExpanded }">
      <!-- Hero Section -->
      <div class="hero-section">
        <div class="hero-icon">
          <Sparkles :size="48" class="sparkle-icon" />
        </div>
        <h1 class="hero-title">Welcome to Tangent</h1>
      </div>

      <!-- Main Input Section -->
      <div class="input-section" :class="{ 'collapsed': isExpanded }">
        <div class="input-container">
          <textarea v-model="userInput" ref="inputRef" class="main-input"
            placeholder="What would you like to explore or work on today?" :rows="inputRows" @input="handleInputChange"
            @keydown="handleKeyDown" @focus="handleInputFocus" @blur="handleInputBlur" />

          <div class="input-footer">
            <div class="input-tools">
              <button class="tool-btn" title="Add attachment">
                <Plus :size="16" />
              </button>
              <button class="tool-btn" title="Voice input">
                <Mic :size="16" />
              </button>
              <button @click="isExpanded = !isExpanded" class="tool-btn" title="Browse templates"
                :class="{ 'active': isExpanded }">
                <Search :size="16" />
              </button>
            </div>

            <button @click="generateWorkspace" :disabled="!userInput.trim() || isGenerating" class="generate-btn">
              <span v-if="isGenerating" class="loading loading-spinner loading-sm"></span>
              <span v-else>Generate</span>
              <ArrowRight :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Side by Side Layout -->
      <div class="side-by-side-container" :class="{ 'expanded-layout': isExpanded }">
        <!-- Templates Section -->
        <div class="templates-section" :class="{ 'expanded': isExpanded }">
          <h2 class="section-title" v-if="!isExpanded">
            <span class="hover-underline" ref="templatesTitle">templates:</span>
          </h2>

          <div class="templates-container" :class="{ 'horizontal': isExpanded }" @mouseenter="activateTemplatesUnderline" @mouseleave="deactivateTemplatesUnderline">
            <div class="templates-grid" :class="{ 'horizontal-grid': isExpanded }">
              <div v-for="template in (isExpanded ? allTemplates : featuredTemplates)" :key="template.id"
                @click="selectTemplate(template)" class="template-card"
                :class="{ 'selected': selectedTemplate?.id === template.id }">
                <div class="template-icon">
                  <component :is="getTemplateIcon(template.icon)" :size="24" />
                </div>
                <h3 class="template-title">{{ template.name }}</h3>
                <p class="template-description">{{ template.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Workspaces -->
        <div v-if="recentWorkspaces.length" class="recent-section" :class="{ 'side-by-side': !isExpanded, 'expanded': isExpanded }">
          <h2 class="section-title">
            <span class="hover-underline" ref="workspacesTitle">Recent workspaces:</span>
          </h2>

          <div class="recent-grid" :class="{ 'vertical-layout': !isExpanded, 'horizontal-grid': isExpanded }" @mouseenter="activateWorkspacesUnderline" @mouseleave="deactivateWorkspacesUnderline">
            <div v-for="workspace in recentWorkspaces.slice(0, isExpanded ? 12 : 6)" :key="workspace.id"
              @click="$emit('open-workspace', workspace.id)" class="recent-card">
              <div class="recent-preview">
                <div class="workspace-nodes">
                  <div v-for="i in Math.min(workspace.nodeCount || 3, 5)" :key="i" class="mini-node" :style="{
                    left: `${(i - 1) * 15}px`,
                    zIndex: 5 - i
                  }" />
                </div>
              </div>
              <h3 class="recent-title">{{ workspace.title }}</h3>
              <p class="recent-meta">{{ formatDate(workspace.lastModified) }}</p>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="template-actions" v-if="!isExpanded">
      <button @click="isExpanded = true" class="secondary-btn">
        <Grid :size="16" />
        Browse All Templates
      </button>
      <button @click="$emit('import-workspace')" class="secondary-btn">
        <Upload :size="16" />
        Import Existing
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import {
  Folder,
  Sparkles,
  Plus,
  Mic,
  Search,
  ArrowRight,
  Grid,
  Upload,
  X,
  Gamepad2,
  Lightbulb,
  BookOpen,
  PenTool,
  TestTube,
  Briefcase,
  Palette,
  GraduationCap
} from 'lucide-vue-next'

import TangentLogo from '@/components/logo/TangentLogo.vue'
import { useThemeStore } from '@/stores/themeStore'
import { useChatStore } from '@/stores/chatStore'

// Props & Emits
const emit = defineEmits<{
  'show-all-workspaces': []
  'import-workspace': []
  'open-workspace': [workspaceId: string]
  'generate-workspace': [input: string, template?: WorkspaceTemplate]
}>()

// Stores
const themeStore = useThemeStore()
const chatStore = useChatStore()

// Reactive state
const userInput = ref('')
const inputRef = ref<HTMLTextAreaElement>()
const selectedTemplate = ref<WorkspaceTemplate | null>(null)
const isGenerating = ref(false)
const showAllTemplates = ref(false)
const templatesTitle = ref<HTMLElement>()
const workspacesTitle = ref<HTMLElement>()
const selectedCategory = ref('All')
const isExpanded = ref(false)
const isFocused = ref(false)
const isDragOver = ref(false)
const isDragActive = ref(false)

// Theme
const currentTheme = computed(() => themeStore.currentTheme)
const themeColors = computed(() => themeStore.currentThemeColors)
const isDarkTheme = computed(() => themeStore.isDarkTheme(themeStore.currentTheme))

// Input handling
const inputRows = computed(() => {
  const lines = userInput.value.split('\n').length
  return Math.max(3, Math.min(lines + 1, 8))
})

const handleInputChange = () => {
  // Clear template selection when user modifies the input (not using suggested prompt)
  if (selectedTemplate.value && userInput.value !== selectedTemplate.value.suggestedPrompt) {
    selectedTemplate.value = null
  }
}

const handleInputFocus = () => {
  isFocused.value = true
  if (isExpanded.value) {
    isExpanded.value = false
  }
}

const handleInputBlur = () => {
  isFocused.value = false
}

// Underline animation methods
const activateTemplatesUnderline = () => {
  if (templatesTitle.value) {
    templatesTitle.value.classList.add('underline-active')
  }
}
const deactivateTemplatesUnderline = () => {
  if (templatesTitle.value) {
    templatesTitle.value.classList.remove('underline-active')
  }
}
const activateWorkspacesUnderline = () => {
  if (workspacesTitle.value) {
    workspacesTitle.value.classList.add('underline-active')
  }
}
const deactivateWorkspacesUnderline = () => {
  if (workspacesTitle.value) {
    workspacesTitle.value.classList.remove('underline-active')
  }
}

// Force immediate CSS custom property updates for labels
watch(() => themeStore.currentTheme, () => {
  // Force a style recalculation by briefly changing a CSS property
  if (templatesTitle.value) {
    templatesTitle.value.style.opacity = '0.99';
    nextTick(() => {
      if (templatesTitle.value) {
        templatesTitle.value.style.opacity = '';
      }
    });
  }
  if (workspacesTitle.value) {
    workspacesTitle.value.style.opacity = '0.99';
    nextTick(() => {
      if (workspacesTitle.value) {
        workspacesTitle.value.style.opacity = '';
      }
    });
  }
}, { immediate: true })

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    generateWorkspace()
  }
}

// Workspace generation
const generateWorkspace = async () => {
  if (!userInput.value.trim() && !selectedTemplate.value) return

  isGenerating.value = true
  try {
    // Only pass template if it's still selected and user input matches template prompt
    const shouldUseTemplate = selectedTemplate.value && 
      (userInput.value === selectedTemplate.value.suggestedPrompt || userInput.value.trim() === '')
    
    emit('generate-workspace', userInput.value, shouldUseTemplate ? selectedTemplate.value : undefined)
  } finally {
    isGenerating.value = false
  }
}

const selectTemplate = (template: WorkspaceTemplate) => {
  selectedTemplate.value = template
  userInput.value = template.suggestedPrompt || ''
  isExpanded.value = false // Collapse the expanded view
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// Template system
interface WorkspaceTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: string
  suggestedPrompt?: string
  structure: {
    mainTopic: string
    branches: Array<{
      title: string
      starterMessage: string
      position: { x: number; y: number }
    }>
    connections: Array<{
      from: string
      to: string
      label: string
    }>
  }
}

const featuredTemplates = ref<WorkspaceTemplate[]>([
  {
    id: 'game-dev',
    name: 'Game Dev',
    description: 'Build games from idea to launch',
    icon: 'gamepad',
    category: 'Creative',
    suggestedPrompt: 'Help me design and develop a mobile game with a solid monetization strategy',
    structure: {
      mainTopic: 'Game Development Project',
      branches: [
        { title: 'Game Concept', starterMessage: 'Let\'s brainstorm your game concept! What type of experience do you want players to have?', position: { x: 0, y: 0 } },
        { title: 'Technical Planning', starterMessage: 'Now let\'s plan the technical requirements and choose the right tools for your game.', position: { x: 400, y: 0 } },
        { title: 'Art & Design', starterMessage: 'Time to design the visual style and user interface for your game.', position: { x: 0, y: 300 } },
        { title: 'Monetization Strategy', starterMessage: 'Let\'s plan how your game will generate revenue sustainably.', position: { x: 400, y: 300 } },
        { title: 'Marketing & Launch', starterMessage: 'Ready to plan your launch? Let\'s target your audience and build buzz.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Game Concept', to: 'Technical Planning', label: 'implementation' },
        { from: 'Game Concept', to: 'Art & Design', label: 'visual direction' },
        { from: 'Technical Planning', to: 'Monetization Strategy', label: 'feasibility' },
        { from: 'Art & Design', to: 'Marketing & Launch', label: 'assets' },
        { from: 'Monetization Strategy', to: 'Marketing & Launch', label: 'strategy' }
      ]
    }
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Explore ideas with AI help',
    icon: 'lightbulb',
    category: 'Thinking',
    suggestedPrompt: 'I need to brainstorm solutions for a complex problem',
    structure: {
      mainTopic: 'Brainstorming Session',
      branches: [
        { title: 'Problem Definition', starterMessage: 'Let\'s clearly define the problem we\'re trying to solve.', position: { x: 0, y: 0 } },
        { title: 'Idea Generation', starterMessage: 'Now let\'s generate as many ideas as possible without judgment.', position: { x: 400, y: 0 } },
        { title: 'Idea Evaluation', starterMessage: 'Time to evaluate our ideas against key criteria.', position: { x: 200, y: 300 } },
        { title: 'Solution Selection', starterMessage: 'Let\'s select the best solutions and plan next steps.', position: { x: 0, y: 500 } },
        { title: 'Action Planning', starterMessage: 'Now let\'s create a concrete action plan to implement our solution.', position: { x: 400, y: 500 } }
      ],
      connections: [
        { from: 'Problem Definition', to: 'Idea Generation', label: 'context' },
        { from: 'Idea Generation', to: 'Idea Evaluation', label: 'raw ideas' },
        { from: 'Idea Evaluation', to: 'Solution Selection', label: 'analysis' },
        { from: 'Solution Selection', to: 'Action Planning', label: 'decisions' }
      ]
    }
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Deep dive into topics thoroughly',
    icon: 'book',
    category: 'Learning',
    suggestedPrompt: 'I want to do comprehensive research on a specific topic',
    structure: {
      mainTopic: 'Research Project',
      branches: [
        { title: 'Research Question', starterMessage: 'Let\'s formulate a clear, focused research question.', position: { x: 0, y: 0 } },
        { title: 'Source Gathering', starterMessage: 'Now let\'s identify and gather reliable sources of information.', position: { x: 400, y: 0 } },
        { title: 'Analysis & Notes', starterMessage: 'Time to analyze our sources and take structured notes.', position: { x: 0, y: 300 } },
        { title: 'Synthesis', starterMessage: 'Let\'s synthesize our findings into coherent insights.', position: { x: 400, y: 300 } },
        { title: 'Conclusions', starterMessage: 'Finally, let\'s draw conclusions and identify implications.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Research Question', to: 'Source Gathering', label: 'focus' },
        { from: 'Source Gathering', to: 'Analysis & Notes', label: 'materials' },
        { from: 'Analysis & Notes', to: 'Synthesis', label: 'insights' },
        { from: 'Synthesis', to: 'Conclusions', label: 'findings' }
      ]
    }
  },
  {
    id: 'writing',
    name: 'Writing',
    description: 'Creative writing projects',
    icon: 'pen',
    category: 'Creative',
    suggestedPrompt: 'Help me plan and write a creative piece',
    structure: {
      mainTopic: 'Writing Project',
      branches: [
        { title: 'Concept & Theme', starterMessage: 'Let\'s develop your core concept and themes.', position: { x: 0, y: 0 } },
        { title: 'Character Development', starterMessage: 'Time to create compelling, three-dimensional characters.', position: { x: 400, y: 0 } },
        { title: 'Plot Structure', starterMessage: 'Now let\'s build a solid plot structure and outline.', position: { x: 0, y: 300 } },
        { title: 'Writing & Drafting', starterMessage: 'Let\'s start writing! I\'ll help you overcome blocks and refine your voice.', position: { x: 400, y: 300 } },
        { title: 'Revision & Polish', starterMessage: 'Time to revise, edit, and polish your work to perfection.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Concept & Theme', to: 'Character Development', label: 'foundation' },
        { from: 'Concept & Theme', to: 'Plot Structure', label: 'direction' },
        { from: 'Character Development', to: 'Writing & Drafting', label: 'voice' },
        { from: 'Plot Structure', to: 'Writing & Drafting', label: 'framework' },
        { from: 'Writing & Drafting', to: 'Revision & Polish', label: 'draft' }
      ]
    }
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Research & experiment',
    icon: 'flask',
    category: 'Research',
    suggestedPrompt: 'Help me design and conduct a scientific investigation',
    structure: {
      mainTopic: 'Scientific Investigation',
      branches: [
        { title: 'Hypothesis', starterMessage: 'Let\'s formulate a testable hypothesis based on observations.', position: { x: 0, y: 0 } },
        { title: 'Methodology', starterMessage: 'Now let\'s design a rigorous experimental methodology.', position: { x: 400, y: 0 } },
        { title: 'Data Collection', starterMessage: 'Time to plan and execute our data collection process.', position: { x: 0, y: 300 } },
        { title: 'Analysis', starterMessage: 'Let\'s analyze our data and look for patterns and significance.', position: { x: 400, y: 300 } },
        { title: 'Conclusions', starterMessage: 'Finally, let\'s interpret results and draw scientific conclusions.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Hypothesis', to: 'Methodology', label: 'testing approach' },
        { from: 'Methodology', to: 'Data Collection', label: 'procedure' },
        { from: 'Data Collection', to: 'Analysis', label: 'raw data' },
        { from: 'Analysis', to: 'Conclusions', label: 'results' }
      ]
    }
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Strategy & planning',
    icon: 'briefcase',
    category: 'Business',
    suggestedPrompt: 'Help me develop a comprehensive business strategy',
    structure: {
      mainTopic: 'Business Strategy',
      branches: [
        { title: 'Market Analysis', starterMessage: 'Let\'s analyze your target market and competitive landscape.', position: { x: 0, y: 0 } },
        { title: 'Value Proposition', starterMessage: 'Now let\'s define your unique value proposition and positioning.', position: { x: 400, y: 0 } },
        { title: 'Business Model', starterMessage: 'Time to design a sustainable and scalable business model.', position: { x: 0, y: 300 } },
        { title: 'Financial Planning', starterMessage: 'Let\'s create financial projections and funding strategies.', position: { x: 400, y: 300 } },
        { title: 'Go-to-Market', starterMessage: 'Finally, let\'s plan your market entry and growth strategy.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Market Analysis', to: 'Value Proposition', label: 'insights' },
        { from: 'Value Proposition', to: 'Business Model', label: 'positioning' },
        { from: 'Business Model', to: 'Financial Planning', label: 'structure' },
        { from: 'Financial Planning', to: 'Go-to-Market', label: 'resources' }
      ]
    }
  }
])

const allTemplates = ref<WorkspaceTemplate[]>([
  ...featuredTemplates.value,
  {
    id: 'creative',
    name: 'Creative',
    description: 'Art, design & creation',
    icon: 'palette',
    category: 'Creative',
    suggestedPrompt: 'Help me develop a creative project from concept to completion',
    structure: {
      mainTopic: 'Creative Project',
      branches: [
        { title: 'Inspiration', starterMessage: 'Let\'s explore sources of inspiration and develop your artistic vision.', position: { x: 0, y: 0 } },
        { title: 'Concept Development', starterMessage: 'Now let\'s refine your concept and establish creative direction.', position: { x: 400, y: 0 } },
        { title: 'Design Process', starterMessage: 'Time to dive into the design process and create iterations.', position: { x: 0, y: 300 } },
        { title: 'Production', starterMessage: 'Let\'s move into production and bring your vision to life.', position: { x: 400, y: 300 } },
        { title: 'Presentation', starterMessage: 'Finally, let\'s prepare your work for presentation and sharing.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Inspiration', to: 'Concept Development', label: 'vision' },
        { from: 'Concept Development', to: 'Design Process', label: 'direction' },
        { from: 'Design Process', to: 'Production', label: 'plans' },
        { from: 'Production', to: 'Presentation', label: 'final work' }
      ]
    }
  },
  {
    id: 'learning',
    name: 'Learning',
    description: 'Study any subject',
    icon: 'graduation-cap',
    category: 'Learning',
    suggestedPrompt: 'I want to learn about a specific subject in depth',
    structure: {
      mainTopic: 'Learning Journey',
      branches: [
        { title: 'Learning Goals', starterMessage: 'Let\'s define clear, achievable learning objectives.', position: { x: 0, y: 0 } },
        { title: 'Resource Planning', starterMessage: 'Now let\'s identify the best learning resources and materials.', position: { x: 400, y: 0 } },
        { title: 'Study Strategy', starterMessage: 'Time to develop an effective study strategy and schedule.', position: { x: 0, y: 300 } },
        { title: 'Active Learning', starterMessage: 'Let\'s engage in active learning through practice and application.', position: { x: 400, y: 300 } },
        { title: 'Assessment', starterMessage: 'Finally, let\'s assess your progress and plan next steps.', position: { x: 200, y: 500 } }
      ],
      connections: [
        { from: 'Learning Goals', to: 'Resource Planning', label: 'objectives' },
        { from: 'Resource Planning', to: 'Study Strategy', label: 'materials' },
        { from: 'Study Strategy', to: 'Active Learning', label: 'plan' },
        { from: 'Active Learning', to: 'Assessment', label: 'experience' }
      ]
    }
  }
])

// Template categories and filtering
const templateCategories = computed(() => {
  const categories = ['All', ...new Set(allTemplates.value.map(t => t.category))]
  return categories
})

const filteredTemplates = computed(() => {
  if (selectedCategory.value === 'All') {
    return allTemplates.value
  }
  return allTemplates.value.filter(t => t.category === selectedCategory.value)
})

// Icon mapping
const iconMap: Record<string, any> = {
  'gamepad': Gamepad2,
  'lightbulb': Lightbulb,
  'book': BookOpen,
  'pen': PenTool,
  'flask': TestTube,
  'briefcase': Briefcase,
  'palette': Palette,
  'graduation-cap': GraduationCap
}

const getTemplateIcon = (iconName: string) => {
  return iconMap[iconName] || Lightbulb
}

// Recent workspaces
const recentWorkspaces = computed(() => {
  // Get recent workspaces from chat store
  return chatStore.recentWorkspaces || []
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Dynamic theme styles
const dynamicThemeStyles = computed(() => ({
  '--theme-primary': themeColors.value.primary,
  '--theme-secondary': themeColors.value.secondary,
  '--theme-accent': themeColors.value.accent,
}))

// Drag & Drop functionality
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = true
  isDragActive.value = true
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()

  // Only reset drag state if leaving the main container
  if (e.target === e.currentTarget) {
    isDragOver.value = false
    isDragActive.value = false
  }
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()

  isDragOver.value = false
  isDragActive.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  // Filter for JSON and ZIP files
  const validFiles = Array.from(files).filter(file =>
    file.name.endsWith('.json') || file.name.endsWith('.zip')
  )

  if (validFiles.length === 0) {
    console.warn('No valid files to import')
    return
  }

  // Trigger import through the parent component
  emit('import-workspace')

  // Handle the files directly here since we have access to them
  try {
    const { conversationImportService } = await import('@/services/conversationImportService')

    // Set up status monitoring
    let hasImportedFirstWorkspace = false
    const statusUnsubscribe = conversationImportService.onStatusUpdate(async (status) => {
      if (!hasImportedFirstWorkspace && status.imported_conversations > 0) {
        hasImportedFirstWorkspace = true
        console.log('First workspace imported, refreshing workspace list...')
        await chatStore.loadChats()
        // Switch to workspace view
        emit('show-all-workspaces')
      }

      if (!status.is_running && status.imported_conversations > 0) {
        console.log('Import completed, doing final workspace refresh...')
        await chatStore.loadChats()
        statusUnsubscribe()
        console.log('Import and clustering process completed')
      }
    })

    // Import each valid file
    for (const file of validFiles) {
      console.log('Importing file:', file.name)
      await conversationImportService.importFile(file)
    }

  } catch (error) {
    console.error('Import error:', error)
  }
}

// Focus input on mount
onMounted(() => {
  nextTick(() => {
    inputRef.value?.focus()
  })
})
</script>

<style scoped>
.welcome-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, hsl(var(--b1)), hsl(var(--b2)));
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  transition: all 0.3s ease;
}

.welcome-screen.drag-over {
  background: linear-gradient(135deg,
      color-mix(in srgb, var(--theme-primary) 15%, hsl(var(--b1))),
      color-mix(in srgb, var(--theme-secondary) 15%, hsl(var(--b2))));
}

.welcome-screen.drag-over::after {
  content: 'Drop your files here to import';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--theme-primary) 90%, transparent);
  color: white;
  padding: 1rem 2rem;
  border-radius: 0.75rem;
  font-size: 1.125rem;
  font-weight: 600;
  z-index: 1000;
  backdrop-filter: blur(12px);
  border: 2px dashed var(--theme-primary);
  pointer-events: none;
}

.welcome-screen::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--theme-primary) 8%, transparent) 0%, transparent 60%),
    radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--theme-secondary) 8%, transparent) 0%, transparent 60%),
    radial-gradient(circle at 40% 60%, color-mix(in srgb, var(--theme-accent) 6%, transparent) 0%, transparent 60%);
  pointer-events: none;
}


/* Header Actions */
.welcome-header-actions {
  position: absolute;
  top: 4rem;
  right: 1rem;
  z-index: 100;
}

.all-workspaces-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  background: hsl(var(--b1) / 0.9);
  border: 1px solid color-mix(in srgb, var(--theme-primary) 20%, transparent);
  color: hsl(var(--bc) / 0.8);
  transition: all 0.2s ease;
  cursor: pointer;
  font-weight: 500;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-primary) 8%, transparent);
}

.all-workspaces-btn:hover {
  background: color-mix(in srgb, var(--theme-primary) 10%, hsl(var(--b1)));
  color: var(--theme-primary);
  border-color: var(--theme-primary);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-primary) 15%, transparent);
}

/* Main Content */
.welcome-content {
  flex: 1;
  max-width: 80vw;
  margin: 0 auto;
  padding: 0rem 2rem 4rem;
  width: 100%;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  min-height: 0;
}

/* Hero Section */
.hero-section {
  text-align: center;
  margin-bottom: 3rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  align-self: center;
}

.welcome-content.templates-expanded .hero-section {
  opacity: 0.6;
  margin-bottom: 1.5rem;
  transform: scale(0.85);
}

.hero-icon {
  padding-top: 5.5rem;
}

.sparkle-icon {
  color: var(--theme-primary);
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--theme-primary) 40%, transparent));
  animation: sparkle 3s ease-in-out infinite;
}

@keyframes sparkle {

  0%,
  100% {
    transform: scale(1) rotate(0deg);
    filter: drop-shadow(0 0 8px hsl(var(--p) / 0.3));
  }

  50% {
    transform: scale(1.15) rotate(10deg);
    filter: drop-shadow(0 0 16px hsl(var(--p) / 0.5));
  }
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  margin-top: -20px;
  padding-bottom: 48px;
  margin-bottom: -6rem;
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-secondary), var(--theme-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  background-size: 200% 200%;
  animation: gradientShift-30399362 4s ease-in-out infinite;
  letter-spacing: -0.02em;
}

@keyframes gradientShift {

  0%,
  100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

/* Input Section */
.input-section {
  margin-bottom: 2rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  align-self: center;
  width: 100%;
  max-width: 800px;
}

.input-section.collapsed {
  margin-bottom: 1.5rem;
}

.input-section.collapsed .input-container {
  max-height: 80px;
  overflow: hidden;
}

.input-section.collapsed .input-footer {
  padding: 0.75rem 1.5rem;
}

.input-section.collapsed .main-input {
  min-height: 40px;
  padding: 1rem 2rem;
  font-size: 1rem;
}

.input-container {
  background: linear-gradient(135deg, hsl(var(--b1) / 0.9), hsl(var(--b2) / 0.85));
  border: 2px solid color-mix(in srgb, var(--theme-primary) 20%, transparent);
  border-radius: 1.5rem;
  overflow: hidden;
  transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    padding 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 8px 32px color-mix(in srgb, var(--theme-primary) 8%, transparent),
    0 1px 0px hsl(var(--b1)),
    inset 0 1px 0px hsl(var(--b2));
  backdrop-filter: blur(12px);
  max-height: 300px;
}

.input-container:focus-within {
  border-color: var(--theme-primary);
  background: linear-gradient(135deg,
      color-mix(in srgb, var(--theme-primary) 8%, hsl(var(--b1) / 0.95)),
      color-mix(in srgb, var(--theme-secondary) 6%, hsl(var(--b1) / 0.9)),
      color-mix(in srgb, var(--theme-accent) 4%, hsl(var(--b2) / 0.85)),
      color-mix(in srgb, var(--theme-primary) 6%, hsl(var(--b1) / 0.92)));
  backdrop-filter: blur(16px);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--theme-primary) 15%, transparent),
    0 12px 40px color-mix(in srgb, var(--theme-primary) 20%, transparent),
    0 4px 20px color-mix(in srgb, var(--theme-secondary) 10%, transparent),
    0 1px 0px var(--theme-primary),
    inset 0 1px 0px rgba(255, 255, 255, 0.2),
    inset 0 -1px 0px color-mix(in srgb, var(--theme-primary) 20%, transparent);
  transform: translateY(-2px);
  position: relative;
  overflow: hidden;
}

.input-container:focus-within::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
      transparent,
      color-mix(in srgb, var(--theme-primary) 10%, transparent),
      color-mix(in srgb, var(--theme-secondary) 8%, transparent),
      transparent);
  animation: shimmer 3s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }

  50% {
    left: 100%;
  }

  100% {
    left: 100%;
  }
}

.main-input {
  width: 100%;
  min-height: 140px;
  padding: 2rem;
  border: none;
  background: transparent;
  color: hsl(var(--bc));
  font-size: 1.125rem;
  line-height: 1.7;
  resize: none;
  outline: none;
  font-weight: 400;
  position: relative;
  z-index: 2;
  transition: min-height 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    padding 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    font-size 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-input::placeholder {
  color: hsl(var(--bc) / 0.5);
  font-weight: 400;
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem;
  background: hsl(var(--b2) / 0.3);
  border-top: 1px solid hsl(var(--b3) / 0.3);
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 2;
}

.input-tools {
  display: flex;
  gap: 0.5rem;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: hsl(var(--b3) / 0.1);
  border: 1px solid hsl(var(--b3) / 0.4);
  color: hsl(var(--bc) / 0.7);
  transition: all 0.2s ease;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.tool-btn:hover {
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
  border-color: hsl(var(--p) / 0.3);
  transform: translateY(-1px);
}

.tool-btn.active {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-primary) 20%, transparent);
}

.generate-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-secondary));
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  box-shadow:
    0 4px 12px color-mix(in srgb, var(--theme-primary) 30%, transparent),
    0 1px 0px var(--theme-primary),
    inset 0 1px 0px rgba(255, 255, 255, 0.2);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 8px 20px color-mix(in srgb, var(--theme-primary) 40%, transparent),
    0 1px 0px var(--theme-primary),
    inset 0 1px 0px rgba(255, 255, 255, 0.2);
}

.generate-btn:active:not(:disabled) {
  transform: translateY(0px);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Side by Side Layout */
.side-by-side-container {
  width: 100%;
  align-self: center;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.side-by-side-container.expanded-layout {
  flex-direction: column;
  gap: 1rem;
}

/* Templates Section */
.templates-section {
  margin-bottom: 0rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  background: linear-gradient(135deg, hsl(var(--b1) / 0.9), hsl(var(--b2) / 0.85));
  padding: 2rem;
  overflow: visible;
}

.templates-section:hover {
  border-color: color-mix(in srgb, var(--theme-primary) 30%, transparent);
  box-shadow:
    0 12px 40px color-mix(in srgb, var(--theme-primary) 12%, transparent),
    0 1px 0px hsl(var(--b1)),
    inset 0 1px 0px hsl(var(--b2));
  transform: translateY(-1px);
}

.templates-section {
  flex: 1;
  width: 50%;
}

.templates-section.expanded {
  margin-top: -1rem;
  margin-bottom: 1rem;
  width: 100%;
  flex: none;
}

.recent-section.expanded {
  margin-top: 1rem;
  margin-bottom: 1rem;
  width: 100%;
  flex: none;
}

.recent-section {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  align-self: center;
  background: linear-gradient(135deg, hsl(var(--b1) / 0.9), hsl(var(--b2) / 0.85));
  padding: 2rem;
  overflow: visible;
}

.recent-section:hover {
  border-color: color-mix(in srgb, var(--theme-primary) 30%, transparent);
  box-shadow:
    0 12px 40px color-mix(in srgb, var(--theme-primary) 12%, transparent),
    0 1px 0px hsl(var(--b1)),
    inset 0 1px 0px hsl(var(--b2));
  transform: translateY(-1px);
}

.recent-section {
  flex: 1;
  width: 50%;
}

.recent-section.side-by-side {
  margin-top: 0;
}

.recent-section.below-expanded {
  margin-top: 2rem;
  opacity: 0.9;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin-bottom: 2rem;
  text-align: center;
  position: relative;
}



.templates-container {
  overflow: visible;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
}

.templates-container.horizontal {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--theme-primary) 30%, transparent) transparent;
  width: 100%;
  max-width: 100%;
}

.templates-container.horizontal::-webkit-scrollbar {
  height: 8px;
}

.templates-container.horizontal::-webkit-scrollbar-track {
  background: hsl(var(--b2) / 0.3);
  border-radius: 4px;
}

.templates-container.horizontal::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--theme-primary) 40%, transparent);
  border-radius: 4px;
}

.templates-container.horizontal::-webkit-scrollbar-thumb:hover {
  background: var(--theme-primary);
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2rem;
  margin-bottom: 2rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  height: 380px;
  padding: 1.5rem;
  overflow: visible;
}

.templates-grid.horizontal-grid {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  margin-bottom: 0;
  flex-wrap: nowrap;
  width: calc((160px + 1rem) * 8 + 1rem);
  min-width: 100%;
}

.templates-grid.horizontal-grid .template-card {
  flex: 0 0 160px;
  width: 160px;
  min-width: 160px;
  max-width: 160px;
  height: 120px;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2rem;
  margin-bottom: 2rem;
  height: 380px;
  padding: 1.5rem;
  overflow: visible;
}

.recent-grid.vertical-layout {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2rem;
  height: 380px;
  padding: 1.5rem;
  overflow: visible;
}

.recent-grid.horizontal-grid {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 1.5rem;
  height: auto;
  padding: 1.5rem;
  grid-template-columns: none;
  grid-template-rows: none;
}

.recent-grid.horizontal-grid .recent-card {
  flex: 0 0 160px;
  min-width: 160px;
  width: 160px;
  max-width: 160px;
  height: 120px;
}

.template-card,
.recent-card {
  background: linear-gradient(135deg, hsl(var(--b1)), hsl(var(--b2)));
  border: none;
  border-radius: 0.5rem;
  padding: 1.5rem;
  text-align: left;
  cursor: pointer;
  position: relative;
  overflow: visible;
  transform: rotate(-15deg) skew(15deg);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -15px 15px 15px rgba(0, 0, 0, 0.3);
  color: hsl(var(--bc));
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  animation: cardFallIn 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

/* Staggered animation delays */
.template-card:nth-child(1) {
  animation-delay: 0s;
}

.template-card:nth-child(2) {
  animation-delay: 0.08s;
}

.template-card:nth-child(3) {
  animation-delay: 0.16s;
}

.template-card:nth-child(4) {
  animation-delay: 0.24s;
}

.template-card:nth-child(5) {
  animation-delay: 0.32s;
}

.template-card:nth-child(6) {
  animation-delay: 0.4s;
}

.recent-card:nth-child(1) {
  animation-delay: 0.48s;
}

.recent-card:nth-child(2) {
  animation-delay: 0.56s;
}

.recent-card:nth-child(3) {
  animation-delay: 0.64s;
}

.recent-card:nth-child(4) {
  animation-delay: 0.72s;
}

.recent-card:nth-child(5) {
  animation-delay: 0.8s;
}

.recent-card:nth-child(6) {
  animation-delay: 0.88s;
}

.template-card::before {
  content: '';
  position: absolute;
  top: 8px;
  left: -15px;
  height: 100%;
  width: 15px;
  background: color-mix(in srgb, hsl(var(--b1)) 80%, #000);
  transform: rotate(0deg) skewY(-45deg);
  transition: background 0.5s ease;
}

.template-card::after {
  content: '';
  position: absolute;
  bottom: -15px;
  left: -8px;
  height: 15px;
  width: 100%;
  background: color-mix(in srgb, hsl(var(--b1)) 80%, #000);
  transform: rotate(0deg) skewX(-45deg);
  transition: background 0.5s ease;
}

.recent-card::before {
  content: '';
  position: absolute;
  top: 8px;
  left: -15px;
  height: 100%;
  width: 15px;
  background: color-mix(in srgb, hsl(var(--b1)) 80%, #000);
  transform: rotate(0deg) skewY(-45deg);
  transition: background 0.5s ease;
}

.recent-card::after {
  content: '';
  position: absolute;
  bottom: -15px;
  left: -8px;
  height: 15px;
  width: 100%;
  background: color-mix(in srgb, hsl(var(--b1)) 80%, #000);
  transform: rotate(0deg) skewX(-45deg);
  transition: background 0.5s ease;
}

.template-card:hover,
.recent-card:hover {
  transform: rotate(-15deg) skew(15deg) translate(15px, -12px) !important;
  box-shadow: -30px 30px 30px rgba(0, 0, 0, 0.5) !important;
  background: var(--theme-primary);
  color: white;
  animation-play-state: paused;
}

.template-card:hover::before,
.recent-card:hover::before {
  background: color-mix(in srgb, var(--theme-primary) 80%, #000);
}

.template-card:hover::after,
.recent-card:hover::after {
  background: color-mix(in srgb, var(--theme-primary) 60%, #000);
}

.template-card:hover .template-icon,
.recent-card:hover .recent-preview {
  color: white;
  filter: brightness(1.2);
}

.template-card:hover .template-title,
.template-card:hover .template-description,
.recent-card:hover .recent-title,
.recent-card:hover .recent-meta {
  color: white;
}

.template-card.selected .template-title,
.template-card.selected .template-description {
  color: white;
}

.template-card.selected {
  background: var(--theme-secondary);
  color: white;
  transform: rotate(-15deg) skew(15deg) translate(8px, -5px);
  box-shadow: -20px 20px 20px rgba(0, 0, 0, 0.35);
}

.template-card.selected::before {
  background: color-mix(in srgb, var(--theme-secondary) 80%, #000);
}

.template-card.selected::after {
  background: color-mix(in srgb, var(--theme-secondary) 60%, #000);
}

.template-card.selected .template-icon {
  color: white;
  filter: brightness(1.2);
}

.template-icon {
  margin-bottom: 1rem;
  color: var(--theme-primary);
  position: relative;
  z-index: 1;
  transition: all 0.5s ease;
}

.template-title,
.recent-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin-bottom: 0.75rem;
  position: relative;
  z-index: 1;
  transition: all 0.5s ease;
}

.template-description {
  font-size: 0.875rem;
  color: hsl(var(--bc) / 0.7);
  line-height: 1.5;
  position: relative;
  z-index: 1;
  transition: all 0.5s ease;
}

.recent-meta {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.5);
  transition: all 0.5s ease;
}

/* Recent workspace preview */
.recent-preview {
  height: 60px;
  margin-bottom: 1rem;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1;
  transition: all 0.5s ease;
}

.workspace-nodes {
  position: relative;
  width: 100px;
  height: 40px;
}

.mini-node {
  position: absolute;
  width: 20px;
  height: 16px;
  background: color-mix(in srgb, var(--theme-primary) 40%, transparent);
  border: 1px solid var(--theme-primary);
  border-radius: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  transition: all 0.5s ease;
}


/* Action buttons */
.template-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.secondary-btn,
.view-all-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.75rem;
  background: linear-gradient(135deg, hsl(var(--b3) / 0.1), hsl(var(--b2) / 0.05));
  border: 1px solid hsl(var(--b3) / 0.4);
  color: hsl(var(--bc) / 0.8);
  border-radius: 0.75rem;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  text-decoration: none;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px hsl(var(--b3) / 0.1);
}

.secondary-btn:hover,
.view-all-btn:hover {
  background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
  color: var(--theme-accent);
  border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-accent) 20%, transparent);
}

/* Templates Modal */
.templates-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.templates-modal {
  background: hsl(var(--b1));
  border-radius: 1rem;
  max-width: 900px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid hsl(var(--b3) / 0.2);
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: hsl(var(--bc));
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  background: transparent;
  border: 1px solid hsl(var(--b3) / 0.3);
  color: hsl(var(--bc) / 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: hsl(var(--er) / 0.1);
  color: hsl(var(--er));
  border-color: hsl(var(--er) / 0.3);
}

.modal-content {
  padding: 2rem;
  overflow-y: auto;
  max-height: calc(80vh - 100px);
}

.template-categories {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.category-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid hsl(var(--b3) / 0.3);
  color: hsl(var(--bc) / 0.6);
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
}

.category-btn:hover {
  background: hsl(var(--b3) / 0.1);
  color: hsl(var(--bc));
}

.category-btn.active {
  background: hsl(var(--p));
  color: hsl(var(--pc));
  border-color: hsl(var(--p));
}

.templates-grid-modal {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
  .welcome-content {
    padding: 1rem;
  }

  .hero-title {
    font-size: 2rem;
  }

  .templates-grid,
  .recent-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .template-actions {
    flex-direction: column;
    align-items: center;
  }

  .templates-modal-overlay {
    padding: 1rem;
  }

  .templates-grid-modal {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
}

@media (max-width: 480px) {
  .welcome-header {
    padding: 1rem;
  }

  .all-workspaces-btn span {
    display: none;
  }

  .templates-grid,
  .recent-grid {
    grid-template-columns: 1fr;
  }

  .templates-grid.horizontal-grid .template-card {
    flex: 0 0 160px;
    min-width: 160px;
    width: 160px;
    max-width: 160px;
    height: 120px;
  }

  .side-by-side-container {
    flex-direction: column;
    gap: 1rem;
  }

  .recent-section {
    flex: none;
  }

  .hero-title {
    font-size: 1.75rem;
  }
}

/* Waterfall Animation Keyframes */
@keyframes cardFallIn {
  0% {
    transform: translateY(-100vh) rotate(-15deg) skew(15deg) rotateX(90deg);
    opacity: 0;
    box-shadow: -15px 15px 15px rgba(0, 0, 0, 0);
  }

  60% {
    transform: translateY(20px) rotate(-15deg) skew(15deg) rotateX(-5deg);
    opacity: 0.8;
    box-shadow: -18px 18px 18px rgba(0, 0, 0, 0.2);
  }

  80% {
    transform: translateY(-5px) rotate(-15deg) skew(15deg) rotateX(2deg);
    opacity: 0.95;
    box-shadow: -12px 12px 12px rgba(0, 0, 0, 0.25);
  }

  100% {
    transform: translateY(0) rotate(-15deg) skew(15deg) rotateX(0deg);
    opacity: 1;
    box-shadow: -15px 15px 15px rgba(0, 0, 0, 0.3);
  }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {

  .template-card,
  .recent-card {
    animation: cardFadeIn 0.6s ease-out both;
  }

  @keyframes cardFadeIn {
    0% {
      opacity: 0;
      transform: rotate(-15deg) skew(15deg) translateY(20px);
    }

    100% {
      opacity: 1;
      transform: rotate(-15deg) skew(15deg) translateY(0);
    }
  }
}

/* Underline animation styles */
.hover-underline {
  position: relative;
  display: inline-block;
  font-size: 1.5rem;
  font-weight: 600;
  color: hsl(var(--bc));
}

.hover-underline::after,
.hover-underline::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, hsl(var(--p)), hsl(var(--s)));
  bottom: -5px;
  left: 0;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.4s ease-out;
}

.hover-underline::before {
  top: -5px;
  transform-origin: left;
}

.hover-underline.underline-active::after,
.hover-underline.underline-active::before {
  transform: scaleX(1);
}

/* Adjust existing section title styles to work with underline animation */
.section-title .hover-underline {
  font-size: 1.5rem;
  font-weight: 600;
  color: hsl(var(--bc));
}

/* Theme-aware underline colors - using primary, secondary, accent for each theme */
.theme-light .hover-underline::after,
.theme-light .hover-underline::before {
  background: linear-gradient(to right, #570DF8, #F000B8, #37CDBE);
}

.theme-dark .hover-underline::after,
.theme-dark .hover-underline::before {
  background: linear-gradient(to right, #793EF9, #F471B5, #1FB2A5);
}

.theme-cupcake .hover-underline::after,
.theme-cupcake .hover-underline::before {
  background: linear-gradient(to right, #65C3C8, #EF9FBC, #EEAF3A);
}

.theme-bumblebee .hover-underline::after,
.theme-bumblebee .hover-underline::before {
  background: linear-gradient(to right, #F9D72F, #E0A82E, #181830);
}

.theme-emerald .hover-underline::after,
.theme-emerald .hover-underline::before {
  background: linear-gradient(to right, #66CC8A, #377CFB, #EA5234);
}

.theme-corporate .hover-underline::after,
.theme-corporate .hover-underline::before {
  background: linear-gradient(to right, #4B6BFB, #7B92B2, #EA5234);
}

.theme-synthwave .hover-underline::after,
.theme-synthwave .hover-underline::before {
  background: linear-gradient(to right, #FF00FF, #00FFFF, #CCCC00);
}

.theme-retro .hover-underline::after,
.theme-retro .hover-underline::before {
  background: linear-gradient(to right, #D2691E, #CD853F, #F4A460);
}

.theme-cyberpunk .hover-underline::after,
.theme-cyberpunk .hover-underline::before {
  background: linear-gradient(to right, #00CCDD, #FF1493, #88CC22);
}

.theme-valentine .hover-underline::after,
.theme-valentine .hover-underline::before {
  background: linear-gradient(to right, #FF69B4, #DC143C, #FFB6C1);
}

.theme-halloween .hover-underline::after,
.theme-halloween .hover-underline::before {
  background: linear-gradient(to right, #7C3AED, #581C87, #3B82F6);
}

.theme-garden .hover-underline::after,
.theme-garden .hover-underline::before {
  background: linear-gradient(to right, #5c7f67, #be123c, #9CA384);
}

.theme-forest .hover-underline::after,
.theme-forest .hover-underline::before {
  background: linear-gradient(to right, #1EB854, #1DB88E, #1EA885);
}

.theme-aqua .hover-underline::after,
.theme-aqua .hover-underline::before {
  background: linear-gradient(to right, #09ECF3, #0771DE, #07ABE3);
}

.theme-lofi .hover-underline::after,
.theme-lofi .hover-underline::before {
  background: linear-gradient(to right, #0D0D0D, #1A1919, #4A4A4A);
}

.theme-pastel .hover-underline::after,
.theme-pastel .hover-underline::before {
  background: linear-gradient(to right, #d1c1d7, #f6cbd1, #b4e9d6);
}

.theme-fantasy .hover-underline::after,
.theme-fantasy .hover-underline::before {
  background: linear-gradient(to right, #6D0A0A, #A65D03, #2D5A27);
}

.theme-wireframe .hover-underline::after,
.theme-wireframe .hover-underline::before {
  background: linear-gradient(to right, #B8B8B8, #CDCDCD, #DEDEDE);
}

.theme-black .hover-underline::after,
.theme-black .hover-underline::before {
  background: linear-gradient(to right, #333333, #666666, #999999);
}

.theme-luxury .hover-underline::after,
.theme-luxury .hover-underline::before {
  background: linear-gradient(to right, #DAA520, #B8860B, #FFD700);
}

.theme-neon .hover-underline::after,
.theme-neon .hover-underline::before {
  background: linear-gradient(to right, #FF79C6, #BD93F9, #50FA7B);
}

.theme-dracula .hover-underline::after,
.theme-dracula .hover-underline::before {
  background: linear-gradient(to right, #FF3333, #FFFFFF, #FF3333);
}

.theme-cmyk .hover-underline::after,
.theme-cmyk .hover-underline::before {
  background: linear-gradient(to right, #00BCD4, #FF4081, #FFEB3B);
}

.theme-autumn .hover-underline::after,
.theme-autumn .hover-underline::before {
  background: linear-gradient(to right, #8B4513, #A0522D, #CD853F);
}

.theme-business .hover-underline::after,
.theme-business .hover-underline::before {
  background: linear-gradient(to right, #1E3A8A, #3B82F6, #60A5FA);
}

.theme-acid .hover-underline::after,
.theme-acid .hover-underline::before {
  background: linear-gradient(to right, #FF00FF, #00FF00, #CCCC00);
}

.theme-lemonade .hover-underline::after,
.theme-lemonade .hover-underline::before {
  background: linear-gradient(to right, #519903, #E9E92E, #94CE58);
}

.theme-night .hover-underline::after,
.theme-night .hover-underline::before {
  background: linear-gradient(to right, #38BDF8, #818CF8, #C084FC);
}

.theme-coffee .hover-underline::after,
.theme-coffee .hover-underline::before {
  background: linear-gradient(to right, #6F4E37, #C6A880, #DAC3B3);
}

.theme-winter .hover-underline::after,
.theme-winter .hover-underline::before {
  background: linear-gradient(to right, #0EA5E9, #84CC16, #10B981);
}
</style>