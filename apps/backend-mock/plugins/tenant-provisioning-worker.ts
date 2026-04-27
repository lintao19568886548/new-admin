import { startTenantProvisioningWorker } from '~/utils/tenant-provisioning-worker';

export default defineNitroPlugin(() => {
  startTenantProvisioningWorker();
});
