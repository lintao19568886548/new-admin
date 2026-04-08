import { message, Modal, notification } from 'ant-design-vue';

declare global {
  interface Window {
    __neutralErrorFeedbackPatched__?: boolean;
  }
}

function patchMessageError() {
  const originalInfo = message.info.bind(message) as (...args: any[]) => any;
  (message as any).error = (...args: any[]) => originalInfo(...args);
}

function patchNotificationError() {
  const originalInfo = notification.info.bind(notification) as (
    ...args: any[]
  ) => any;
  (notification as any).error = (...args: any[]) => originalInfo(...args);
}

function patchModalError() {
  const originalInfo = Modal.info.bind(Modal) as (...args: any[]) => any;
  (Modal as any).error = (...args: any[]) => originalInfo(...args);
}

export function setupNeutralErrorFeedback() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.__neutralErrorFeedbackPatched__) {
    return;
  }

  patchMessageError();
  patchNotificationError();
  patchModalError();

  window.__neutralErrorFeedbackPatched__ = true;
}
