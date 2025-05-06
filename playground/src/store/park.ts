// stores/buttonStore.js
import { defineStore } from 'pinia';

export const useParkStore = defineStore('button', {
  actions: {},
  state: () => ({
    buttonStatus: true,
    defaultImgUrl: '/assets/icons8-占位符.gif',
    parkId: undefined,
  }),
});
