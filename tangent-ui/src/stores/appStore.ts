// appStore.ts
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    isSidePanelOpen: false,
    isAgentConfiguratorOpen: false,
    isRAGPanelOpen: false,
  }),
  actions: {
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
  },
});