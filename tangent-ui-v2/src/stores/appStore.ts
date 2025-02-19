// appStore.ts
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    isSidePanelOpen: false,
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
  },
});