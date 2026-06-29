import type { Component } from 'vue';

export type ProfileMenuIcon = Component | string;

export interface ProfileMenuAction {
  danger?: boolean;
  handler: () => Promise<void> | void;
  icon: ProfileMenuIcon;
  key: string;
  title: string;
}

export interface ProfileMenuDropdown {
  children: ProfileMenuAction[];
  icon: ProfileMenuIcon;
  key: string;
  title: string;
  type: 'dropdown';
}

export type ProfileMenuEntry = ProfileMenuAction | ProfileMenuDropdown;
