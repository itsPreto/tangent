// appStore.ts
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    // Legacy panel states (keeping for backward compatibility)
    isSidePanelOpen: false,
    isAgentConfiguratorOpen: false,
    isRAGPanelOpen: false,
    
    // New dual sidebar states
    isLeftSidebarExpanded: false,
    isRightSidebarExpanded: false,
    activeRightFeature: null as string | null,
    isRightContentPanelOpen: false,
    
    // UI mode - allows switching between old and new layouts
    isDualSidebarMode: true,
    
    // Sliding footer state
    isSlidingFooterOpen: false,
  }),
  getters: {
    // Computed properties for layout calculations
    leftSidebarWidth: (state) => state.isLeftSidebarExpanded ? 260 : 60,
    rightSidebarWidth: () => 60, // Right sidebar is now always 60px (collapsed by default)
    rightContentPanelWidth: () => '35vw',
    
    // Main content area width calculation
    mainContentWidth: (state) => {
      if (!state.isDualSidebarMode) {
        // Legacy mode calculations
        if (state.isSidePanelOpen && state.isAgentConfiguratorOpen) {
          return '20vw';
        } else if (state.isSidePanelOpen || state.isAgentConfiguratorOpen) {
          return '60vw';
        } else {
          return '100vw';
        }
      }
      
      // New dual sidebar mode calculations
      const leftWidth = state.isLeftSidebarExpanded ? 260 : 60;
      const rightWidth = 60; // Right sidebar is now always 60px
      const contentPanelWidth = state.isRightContentPanelOpen ? 35 : 0; // 35vw when open
      
      return `calc(100vw - ${leftWidth}px - ${rightWidth}px - ${contentPanelWidth}vw)`;
    },
    
    // Main content margins
    mainContentMarginLeft: (state) => {
      if (!state.isDualSidebarMode) {
        return state.isSidePanelOpen ? '40vw' : '0';
      }
      return `${state.isLeftSidebarExpanded ? 260 : 60}px`;
    },
    
    mainContentMarginRight: (state) => {
      if (!state.isDualSidebarMode) {
        const rightMargin = state.isAgentConfiguratorOpen ? '40vw' : '0';
        return rightMargin;
      }
      const rightSidebar = 60; // Right sidebar is now always 60px
      const contentPanel = state.isRightContentPanelOpen ? 35 : 0; // 35vw
      return `calc(${rightSidebar}px + ${contentPanel}vw)`;
    },
  },
  actions: {
    // Legacy actions (keeping for backward compatibility)
    openSidePanel() {
      this.isSidePanelOpen = true;
    },
    closeSidePanel() {
      this.isSidePanelOpen = false;
    },
    toggleSidePanel() {
      this.isSidePanelOpen = !this.isSidePanelOpen;
    },
    openAgentConfigurator() {
      this.isAgentConfiguratorOpen = true;
    },
    closeAgentConfigurator() {
      this.isAgentConfiguratorOpen = false;
    },
    toggleAgentConfigurator() {
      this.isAgentConfiguratorOpen = !this.isAgentConfiguratorOpen;
    },
    openRAGPanel() {
      this.isRAGPanelOpen = true;
    },
    closeRAGPanel() {
      this.isRAGPanelOpen = false;
    },
    toggleRAGPanel() {
      this.isRAGPanelOpen = !this.isRAGPanelOpen;
    },
    
    // New dual sidebar actions
    toggleLeftSidebar() {
      this.isLeftSidebarExpanded = !this.isLeftSidebarExpanded;
    },
    expandLeftSidebar() {
      this.isLeftSidebarExpanded = true;
    },
    collapseLeftSidebar() {
      this.isLeftSidebarExpanded = false;
    },
    
    expandRightSidebar() {
      this.isRightSidebarExpanded = true;
    },
    
    collapseRightSidebar() {
      this.isRightSidebarExpanded = false;
    },
    
    setActiveRightFeature(featureId: string | null) {
      this.activeRightFeature = featureId;
      this.isRightContentPanelOpen = featureId !== null;
    },
    
    openRightFeature(featureId: string) {
      this.activeRightFeature = featureId;
      this.isRightContentPanelOpen = true;
    },
    
    closeRightFeature() {
      this.activeRightFeature = null;
      this.isRightContentPanelOpen = false;
    },
    
    toggleRightFeature(featureId: string) {
      if (this.activeRightFeature === featureId && this.isRightContentPanelOpen) {
        this.closeRightFeature();
      } else {
        this.openRightFeature(featureId);
      }
    },
    
    // UI mode switching
    enableDualSidebarMode() {
      this.isDualSidebarMode = true;
      // Optionally close legacy panels when switching modes
      this.isSidePanelOpen = false;
      this.isAgentConfiguratorOpen = false;
    },
    
    disableDualSidebarMode() {
      this.isDualSidebarMode = false;
      // Close dual sidebar panels when switching back
      this.isLeftSidebarExpanded = false;
      this.closeRightFeature();
    },
    
    toggleUIMode() {
      if (this.isDualSidebarMode) {
        this.disableDualSidebarMode();
      } else {
        this.enableDualSidebarMode();
      }
    },
    
    // Sliding footer actions
    openSlidingFooter() {
      this.isSlidingFooterOpen = true;
    },
    
    closeSlidingFooter() {
      this.isSlidingFooterOpen = false;
    },
    
    toggleSlidingFooter() {
      this.isSlidingFooterOpen = !this.isSlidingFooterOpen;
    },
  },
});