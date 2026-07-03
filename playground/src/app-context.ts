import type { App } from 'vue';

let appInstance: App<Element> | null = null;

function setAppInstance(app: App<Element>) {
  appInstance = app;
}

function getAppInstance() {
  if (!appInstance) {
    throw new Error('Vue app instance is not ready');
  }

  return appInstance;
}

export { getAppInstance, setAppInstance };
