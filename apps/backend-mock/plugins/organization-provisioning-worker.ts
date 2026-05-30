import { startOrganizationProvisioningWorker } from '~/utils/organization-provisioning-worker';

export default defineNitroPlugin(() => {
  startOrganizationProvisioningWorker();
});
