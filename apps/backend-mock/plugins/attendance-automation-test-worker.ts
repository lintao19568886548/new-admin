import { startAttendanceAutomationTestWorker } from '~/utils/attendance-automation-test-worker';

export default defineNitroPlugin(() => {
  startAttendanceAutomationTestWorker();
});
