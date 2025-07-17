<template>
  <div v-if="userStore.isOnTrial" class="trial-indicator">
    <div class="trial-header">
      <h3 class="trial-title">Free Trial</h3>
      <button @click="$emit('upgrade')" class="upgrade-btn">
        Upgrade to Pro
      </button>
    </div>
    
    <div class="trial-stats">
      <div class="stat-item">
        <div class="stat-label">Workspaces</div>
        <div class="stat-bar">
          <div 
            class="stat-fill" 
            :style="{ width: `${workspacePercentage}%` }"
            :class="{ 'warning': workspacePercentage > 80, 'critical': workspacePercentage >= 100 }"
          ></div>
        </div>
        <div class="stat-text">
          {{ userStore.trialStatus?.workspaces_used || 0 }} / {{ userStore.trialStatus?.max_workspaces || 3 }}
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Credits</div>
        <div class="stat-bar">
          <div 
            class="stat-fill" 
            :style="{ width: `${creditPercentage}%` }"
            :class="{ 'warning': creditPercentage > 80, 'critical': creditPercentage >= 100 }"
          ></div>
        </div>
        <div class="stat-text">
          {{ userStore.trialStatus?.credits_used || 0 }} / {{ userStore.trialStatus?.max_credits || 100 }}
        </div>
      </div>
    </div>
    
    <div v-if="!userStore.canCreateWorkspace" class="limit-warning">
      <AlertTriangle :size="16" />
      <span>Workspace limit reached. Upgrade to create more workspaces.</span>
    </div>
    
    <div v-else-if="userStore.creditsRemaining <= 10" class="limit-warning">
      <AlertTriangle :size="16" />
      <span>{{ userStore.creditsRemaining }} credits remaining</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

const workspacePercentage = computed(() => {
  const used = userStore.trialStatus?.workspaces_used || 0
  const max = userStore.trialStatus?.max_workspaces || 3
  return Math.min((used / max) * 100, 100)
})

const creditPercentage = computed(() => {
  const used = userStore.trialStatus?.credits_used || 0
  const max = userStore.trialStatus?.max_credits || 100
  return Math.min((used / max) * 100, 100)
})

defineEmits<{
  upgrade: []
}>()
</script>

<style scoped>
.trial-indicator {
  background: hsl(var(--b2));
  border: 1px solid hsl(var(--bc) / 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.trial-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.trial-title {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--bc));
  margin: 0;
}

.upgrade-btn {
  background: hsl(var(--p));
  color: hsl(var(--pc));
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upgrade-btn:hover {
  background: hsl(var(--p) / 0.9);
  transform: translateY(-1px);
}

.trial-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-label {
  font-size: 0.875rem;
  color: hsl(var(--bc) / 0.7);
  min-width: 80px;
  font-weight: 500;
}

.stat-bar {
  flex: 1;
  height: 8px;
  background: hsl(var(--b3));
  border-radius: 4px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  background: hsl(var(--s));
  border-radius: 4px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.stat-fill.warning {
  background: hsl(var(--w));
}

.stat-fill.critical {
  background: hsl(var(--e));
}

.stat-text {
  font-size: 0.875rem;
  color: hsl(var(--bc));
  font-weight: 500;
  min-width: 60px;
  text-align: right;
}

.limit-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: hsl(var(--w) / 0.1);
  border: 1px solid hsl(var(--w) / 0.3);
  border-radius: 0.5rem;
  color: hsl(var(--w));
  font-size: 0.875rem;
  font-weight: 500;
}

@media (max-width: 640px) {
  .trial-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .stat-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .stat-label {
    min-width: unset;
  }
  
  .stat-text {
    text-align: left;
    min-width: unset;
  }
}
</style>