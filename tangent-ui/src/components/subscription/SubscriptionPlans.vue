<template>
  <div class="subscription-plans" :class="['theme-' + currentTheme]">
    <!-- Section 2: Meet Tangent -->
    <section class="meet-tangent-section">
      <div class="section-container">
        <div class="section-header">
          <h2 class="section-title">Meet Tangent</h2>
          <p class="section-subtitle">
            Tangent is a next generation AI workspace built for creative thinking and collaboration. 
            Organize your ideas, build upon them, and explore infinite possibilities.
          </p>
        </div>
        
        <div class="two-column-layout">
          <!-- Left Column: Animated Demo -->
          <div class="demo-column">
            <div class="demo-window">
              <div class="demo-header">
                <div class="demo-controls">
                  <div class="control-dot red"></div>
                  <div class="control-dot yellow"></div>
                  <div class="control-dot green"></div>
                </div>
                <div class="demo-title">Tangent Workspace</div>
              </div>
              
              <div class="demo-content">
                <div class="demo-conversation">
                  <div class="demo-message user-message">
                    <div class="message-content">
                      Build a scatter plot to visualize the relationship between page load time and user engagement
                    </div>
                  </div>
                  
                  <div class="demo-message assistant-message">
                    <div class="message-header">
                      <div class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                      </div>
                    </div>
                    <div class="message-content">
                      Here's a scatter plot to visualize the relationship between page load time and user engagement.
                    </div>
                    <div class="artifact-preview">
                      <div class="artifact-label">Scatter Plot</div>
                      <button class="artifact-button">Open component</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Right Column: Features -->
          <div class="features-column">
            <div class="feature-list">
              <div class="feature-item">
                <div class="feature-icon">
                  <Plus class="icon" />
                </div>
                <div class="feature-content">
                  <h3 class="feature-title">Create with AI</h3>
                  <p class="feature-description">
                    Draft and iterate on ideas, documents, and code alongside your conversations in interactive workspaces.
                  </p>
                </div>
              </div>
              
              <div class="feature-item">
                <div class="feature-icon">
                  <BookOpen class="icon" />
                </div>
                <div class="feature-content">
                  <h3 class="feature-title">Bring your knowledge</h3>
                  <p class="feature-description">
                    Upload documents, connect to your data sources, and build upon existing work.
                  </p>
                </div>
              </div>
              
              <div class="feature-item">
                <div class="feature-icon">
                  <Users class="icon" />
                </div>
                <div class="feature-content">
                  <h3 class="feature-title">Share and collaborate</h3>
                  <p class="feature-description">
                    Work together with your team in shared workspaces and build ideas collectively.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <!-- Section 3: Explore Plans -->
    <section class="explore-plans-section">
      <div class="section-container">
        <div class="section-header">
          <h2 class="section-title">Explore plans</h2>
          
          <div class="plan-toggle">
            <button 
              :class="['toggle-btn', { active: planType === 'individual' }]"
              @click="planType = 'individual'"
            >
              Individual
            </button>
            <button 
              :class="['toggle-btn', { active: planType === 'team' }]"
              @click="planType = 'team'"
            >
              Team & Enterprise
            </button>
          </div>
        </div>
        
        <div class="pricing-cards">
          <!-- Free Plan -->
          <div class="pricing-card">
            <div class="card-header">
              <h3 class="plan-title">Free</h3>
              <p class="plan-subtitle">Try Tangent</p>
            </div>
            
            <div class="card-content">
              <div class="feature-list">
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>{{ isAuthenticated ? `${userStore.workspacesRemaining} workspaces remaining` : '3 workspaces' }}</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>{{ isAuthenticated ? `${userStore.creditsRemaining} credits remaining` : 'Basic AI assistance' }}</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Export your work</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Community support</span>
                </div>
              </div>
              
              <div class="pricing-info">
                <div class="price">$0</div>
                <div class="billing-info">Free for everyone</div>
              </div>
              
              <button 
                class="plan-button" 
                :class="{ 'current-plan': isAuthenticated && userPlan === 'trial' }"
                @click="selectPlan('free')"
                :disabled="isAuthenticated && userPlan === 'trial'"
              >
                {{ isAuthenticated && userPlan === 'trial' ? 'Current Plan' : 'Get Started' }}
              </button>
            </div>
          </div>
          
          <!-- Pro Plan -->
          <div class="pricing-card featured">
            <div class="featured-badge">Most Popular</div>
            <div class="card-header">
              <h3 class="plan-title">Pro</h3>
              <p class="plan-subtitle">For everyday productivity</p>
            </div>
            
            <div class="card-content">
              <div class="feature-intro">Everything in Free, plus:</div>
              
              <div class="feature-list">
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Unlimited workspaces</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Advanced AI models</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Priority support</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Collaboration features</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Advanced export options</span>
                </div>
              </div>
              
              <div class="pricing-info">
                <div class="price">$17</div>
                <div class="billing-info">Per month billed annually</div>
              </div>
              
              <button 
                class="plan-button primary" 
                :class="{ 'current-plan': isAuthenticated && userPlan === 'pro' }"
                @click="selectPlan('pro')"
                :disabled="isAuthenticated && userPlan === 'pro'"
              >
                {{ isAuthenticated && userPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro' }}
              </button>
            </div>
          </div>
          
          <!-- Max Plan -->
          <div class="pricing-card">
            <div class="card-header">
              <h3 class="plan-title">Max</h3>
              <p class="plan-subtitle">5-20x more usage than Pro</p>
            </div>
            
            <div class="card-content">
              <div class="feature-intro">Everything in Pro, plus:</div>
              
              <div class="feature-list">
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>5x or 20x more usage than Pro</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Higher output limits</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Early access to features</span>
                </div>
                <div class="feature-item">
                  <Check class="check-icon" />
                  <span>Priority access during high traffic</span>
                </div>
              </div>
              
              <div class="pricing-info">
                <div class="price">From $100</div>
                <div class="billing-info">Per month billed monthly</div>
              </div>
              
              <button 
                class="plan-button" 
                :class="{ 'current-plan': isAuthenticated && userPlan === 'max' }"
                @click="selectPlan('max')"
                :disabled="isAuthenticated && userPlan === 'max'"
              >
                {{ isAuthenticated && userPlan === 'max' ? 'Current Plan' : 'Upgrade to Max' }}
              </button>
            </div>
          </div>
        </div>
        
        <div class="pricing-disclaimer">
          <p>
            Prices shown do not include applicable tax. 
            <a href="#" class="disclaimer-link">Usage limits apply</a>
          </p>
        </div>
      </div>
    </section>
    
    <!-- Section 4: FAQ -->
    <section class="faq-section">
      <div class="section-container">
        <div class="section-header">
          <h2 class="section-title">Frequently asked questions</h2>
        </div>
        
        <div class="faq-list">
          <div 
            v-for="faq in faqs" 
            :key="faq.id"
            class="faq-item"
            :class="{ open: openFaq === faq.id }"
            @click="toggleFaq(faq.id)"
          >
            <div class="faq-question">
              <span>{{ faq.question }}</span>
              <Plus class="faq-icon" :class="{ rotated: openFaq === faq.id }" />
            </div>
            <div class="faq-answer" v-if="openFaq === faq.id">
              <p>{{ faq.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <!-- Auth Modal -->
    <AuthModal 
      :is-open="showAuthModal" 
      :initial-mode="authModalMode"
      @close="showAuthModal = false"
      @success="handleAuthSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, BookOpen, Users, Check } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/themeStore'
import { useUserStore } from '@/stores/userStore'
import AuthModal from '@/components/auth/AuthModal.vue'

const themeStore = useThemeStore()
const userStore = useUserStore()

const currentTheme = computed(() => themeStore.currentTheme)
const userPlan = computed(() => userStore.user?.trial_status?.subscription_plan || 'trial')
const isAuthenticated = computed(() => userStore.isAuthenticated)

const planType = ref('individual')
const openFaq = ref<string | null>(null)
const showAuthModal = ref(false)
const authModalMode = ref<'login' | 'register'>('register')

const faqs = ref([
  {
    id: 'what-is-tangent',
    question: 'What is Tangent and how does it work?',
    answer: 'Tangent is an AI-powered workspace that helps you organize thoughts, build upon ideas, and explore creative possibilities through interactive conversations and visual branching.'
  },
  {
    id: 'what-to-use-for',
    question: 'What should I use Tangent for?',
    answer: 'Tangent is perfect for brainstorming, project planning, research, writing, coding, and any task where you need to explore ideas and build upon them iteratively.'
  },
  {
    id: 'pricing',
    question: 'How much does it cost to use?',
    answer: 'Tangent offers a free tier with 3 workspaces, a Pro plan at $17/month for unlimited workspaces, and a Max plan starting at $100/month for heavy usage.'
  }
])

const toggleFaq = (id: string) => {
  openFaq.value = openFaq.value === id ? null : id
}

const selectPlan = (plan: string) => {
  if (!isAuthenticated.value) {
    authModalMode.value = 'register'
    showAuthModal.value = true
    return
  }
  
  console.log('Selected plan:', plan)
  // TODO: Implement plan selection logic
}

const handleAuthSuccess = () => {
  showAuthModal.value = false
  // Refresh trial status after successful auth
  userStore.refreshTrialStatus()
}
</script>

<style scoped>
.subscription-plans {
  @apply min-h-screen bg-base-100 text-base-content;
}

/* Section 2: Meet Tangent */
.meet-tangent-section {
  @apply py-20 px-6;
}

.section-container {
  @apply max-w-6xl mx-auto;
}

.section-header {
  @apply text-center mb-16;
}

.section-title {
  @apply text-4xl font-bold mb-4;
}

.section-subtitle {
  @apply text-xl text-base-content/70 max-w-3xl mx-auto;
}

.two-column-layout {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-16 items-center;
}

.demo-column {
  @apply order-2 lg:order-1;
}

.demo-window {
  @apply bg-base-100 rounded-lg shadow-xl overflow-hidden border border-base-300;
}

.demo-header {
  @apply bg-base-200 px-4 py-3 flex items-center justify-between;
}

.demo-controls {
  @apply flex items-center gap-2;
}

.control-dot {
  @apply w-3 h-3 rounded-full;
}

.control-dot.red {
  @apply bg-red-500;
}

.control-dot.yellow {
  @apply bg-yellow-500;
}

.control-dot.green {
  @apply bg-green-500;
}

.demo-title {
  @apply text-sm font-medium;
}

.demo-content {
  @apply p-6;
}

.demo-conversation {
  @apply space-y-4;
}

.demo-message {
  @apply max-w-[80%];
}

.user-message {
  @apply ml-auto;
}

.user-message .message-content {
  @apply bg-primary text-primary-content p-3 rounded-lg;
}

.assistant-message .message-content {
  @apply bg-base-200 p-3 rounded-lg;
}

.typing-indicator {
  @apply flex items-center gap-1 mb-2;
}

.typing-dot {
  @apply w-2 h-2 bg-base-content/50 rounded-full animate-pulse;
}

.artifact-preview {
  @apply mt-3 p-3 bg-base-100 rounded border border-base-300 flex items-center justify-between;
}

.artifact-label {
  @apply font-medium;
}

.artifact-button {
  @apply btn btn-sm btn-primary;
}

.features-column {
  @apply order-1 lg:order-2;
}

.feature-list {
  @apply space-y-8;
}

.feature-item {
  @apply flex items-start gap-4;
}

.feature-icon {
  @apply w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0;
}

.feature-icon .icon {
  @apply w-6 h-6 text-primary;
}

.feature-content {
  @apply flex-1;
}

.feature-title {
  @apply text-xl font-semibold mb-2;
}

.feature-description {
  @apply text-base-content/70;
}

/* Section 3: Explore Plans */
.explore-plans-section {
  @apply py-20 px-6 bg-base-100;
}

.plan-toggle {
  @apply flex items-center gap-2 bg-base-200 p-1 rounded-lg mt-8;
}

.toggle-btn {
  @apply px-4 py-2 rounded text-sm font-medium transition-all duration-200;
}

.toggle-btn.active {
  @apply bg-primary text-primary-content;
}

.pricing-cards {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-8 mt-16;
}

.pricing-card {
  @apply bg-base-100 rounded-xl border border-base-300 p-8 relative;
}

.pricing-card.featured {
  @apply border-primary border-2 transform scale-105;
}

.featured-badge {
  @apply absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-content px-4 py-1 rounded-full text-sm font-medium;
}

.card-header {
  @apply text-center mb-8;
}

.plan-title {
  @apply text-2xl font-bold mb-2;
}

.plan-subtitle {
  @apply text-base-content/70;
}

.feature-intro {
  @apply font-medium mb-4;
}

.feature-list {
  @apply space-y-3 mb-8;
}

.feature-item {
  @apply flex items-center gap-3;
}

.check-icon {
  @apply w-5 h-5 text-primary flex-shrink-0;
}

.pricing-info {
  @apply text-center mb-8;
}

.price {
  @apply text-4xl font-bold mb-1;
}

.billing-info {
  @apply text-sm text-base-content/70;
}

.plan-button {
  @apply btn btn-block;
}

.plan-button.primary {
  @apply btn-primary;
}

.plan-button.current-plan {
  @apply btn-success;
}

.pricing-disclaimer {
  @apply text-center mt-8 text-sm text-base-content/70;
}

.disclaimer-link {
  @apply underline hover:text-primary;
}

/* Section 4: FAQ */
.faq-section {
  @apply py-20 px-6;
}

.faq-list {
  @apply space-y-4 mt-16;
}

.faq-item {
  @apply border border-base-300 rounded-lg overflow-hidden cursor-pointer transition-all duration-200;
}

.faq-item:hover {
  @apply border-primary/50;
}

.faq-question {
  @apply flex items-center justify-between p-6 font-medium;
}

.faq-icon {
  @apply w-5 h-5 transition-transform duration-200;
}

.faq-icon.rotated {
  @apply rotate-45;
}

.faq-answer {
  @apply px-6 pb-6;
}

.faq-answer p {
  @apply text-base-content/70;
}
</style>