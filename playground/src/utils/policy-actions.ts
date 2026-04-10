const OPEN_PRIVACY_POLICY_EVENT = 'open-privacy-policy';
const OPEN_SERVICE_AGREEMENT_EVENT = 'open-service-agreement';

function dispatchPolicyEvent(eventName: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName));
}

export function openPrivacyPolicyDialog() {
  dispatchPolicyEvent(OPEN_PRIVACY_POLICY_EVENT);
}

export function openServiceAgreementDialog() {
  dispatchPolicyEvent(OPEN_SERVICE_AGREEMENT_EVENT);
}

export { OPEN_PRIVACY_POLICY_EVENT, OPEN_SERVICE_AGREEMENT_EVENT };
