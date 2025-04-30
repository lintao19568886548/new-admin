// stores/buttonStore.js
import { defineStore } from 'pinia';

export const useParkStore = defineStore('button', {
  actions: {},
  state: () => ({
    buttonStatus: true,
    parkId: undefined,
  }),
});
