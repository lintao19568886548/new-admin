import { DEFAULT_HOME_PATH } from '@vben/constants';

const MOBILE_DEFAULT_HOME_PATH = '/workbench';

export function resolveDefaultHomePath() {
  return window.innerWidth < 768 ? MOBILE_DEFAULT_HOME_PATH : DEFAULT_HOME_PATH;
}

export function resolveUserHomePath(homePath?: string) {
  if (window.innerWidth < 768) {
    return MOBILE_DEFAULT_HOME_PATH;
  }
  return homePath || DEFAULT_HOME_PATH;
}

export { MOBILE_DEFAULT_HOME_PATH };
