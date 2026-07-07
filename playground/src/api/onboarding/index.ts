import { requestClient } from '#/api/request';

export type OnboardingStepKey = 'accounts' | 'factoryInfo' | 'permissions';

export interface OnboardingStep {
  completed: boolean;
  description: string;
  key: OnboardingStepKey;
  path: string;
  title: string;
}

export interface OnboardingStatus {
  customerId: string;
  forceRequired: boolean;
  isPaidCustomer: boolean;
  isSetupManager: boolean;
  nextStep: null | OnboardingStep;
  progress: {
    completed: number;
    total: number;
  };
  reason: 'first_setup' | 'paid_customer' | null;
  shouldGuide: boolean;
  statistics: {
    additionalUserCount: number;
    assignedPermissionUserCount: number;
    factoryCount: number;
    parkCount: number;
  };
  status: 'completed' | 'in_progress';
  steps: OnboardingStep[];
}

export function getOnboardingStatusApi() {
  return requestClient.get<OnboardingStatus>('/onboarding/status', {
    silentError: true,
  });
}
