import { DEFAULT_HOME_PATH } from '@vben/constants';

export function resolveDefaultHomePath() {
  return window.innerWidth < 768 ? '/home' : DEFAULT_HOME_PATH;
}

export function resolveUserHomePath(homePath?: string) {
  if (window.innerWidth < 768) {
    return '/home';
  }
  return homePath || DEFAULT_HOME_PATH;
}
