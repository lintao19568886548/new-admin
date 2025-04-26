// stores/buttonStore.js
import { defineStore } from 'pinia';

export const useButtonStore = defineStore('button', {
  actions: {
    showButton(boolean: boolean) {
      this.visible = boolean;
    },
  },
  state: () => ({
    visible: true,
  }),
});
