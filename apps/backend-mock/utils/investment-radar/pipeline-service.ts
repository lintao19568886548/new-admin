import { rebuildEnterpriseProfilesFromSignals } from './enterprise-profile-repository';
import { recalculateDemoLeadScores } from './lead-score-service';
import { rebuildRadarOutreachActions } from './outreach-action-service';
import { rebuildRadarSalesActions } from './sales-action-service';
import { rebuildSignalEventsFromExternalLeads } from './signal-event-repository';

export interface RadarAcquisitionPipelineRebuildResult {
  assignedLeadCount: number;
  createdOutreachTaskCount: number;
  createdProfileCount: number;
  createdSignalEventCount: number;
  createdSignalEvidenceCount: number;
  createdSopReminderCount: number;
  createdTagCount: number;
  deletedDirtySignalEventCount: number;
  finishedAt: string;
  outreachTargetLeadCount: number;
  pendingOutreachTaskCount: number;
  pendingSopReminderCount: number;
  profileCompanyCount: number;
  recalculatedLeadCount: number;
  sourceLeadCount: number;
  targetLeadCount: number;
  totalLeadCount: number;
  updatedProfileCount: number;
  updatedSignalEventCount: number;
  updatedSignalEvidenceCount: number;
  updatedTagCount: number;
}

export async function rebuildRadarAcquisitionPipeline(): Promise<RadarAcquisitionPipelineRebuildResult> {
  const signalResult = await rebuildSignalEventsFromExternalLeads();
  const profileResult = await rebuildEnterpriseProfilesFromSignals({
    skipSignalRebuild: true,
  });
  const scoreResult = await recalculateDemoLeadScores({
    skipSignalRebuild: true,
  });
  const salesActionResult = await rebuildRadarSalesActions();
  const outreachActionResult = await rebuildRadarOutreachActions();

  return {
    assignedLeadCount: salesActionResult.assignedLeadCount,
    createdOutreachTaskCount: outreachActionResult.createdOutreachTaskCount,
    createdProfileCount: profileResult.createdProfileCount,
    createdSignalEventCount: signalResult.createdEventCount,
    createdSignalEvidenceCount: signalResult.createdEvidenceCount,
    createdSopReminderCount: salesActionResult.createdSopReminderCount,
    createdTagCount: profileResult.createdTagCount,
    deletedDirtySignalEventCount: signalResult.deletedDirtyEventCount,
    finishedAt: new Date().toISOString(),
    outreachTargetLeadCount: outreachActionResult.outreachTargetLeadCount,
    pendingOutreachTaskCount: outreachActionResult.pendingOutreachTaskCount,
    pendingSopReminderCount: salesActionResult.pendingSopReminderCount,
    profileCompanyCount: profileResult.sourceCompanyCount,
    recalculatedLeadCount: scoreResult.recalculatedCount,
    sourceLeadCount: signalResult.totalSourceLeadCount,
    targetLeadCount: salesActionResult.targetLeadCount,
    totalLeadCount: scoreResult.totalLeadCount,
    updatedProfileCount: profileResult.updatedProfileCount,
    updatedSignalEventCount: signalResult.updatedEventCount,
    updatedSignalEvidenceCount: signalResult.updatedEvidenceCount,
    updatedTagCount: profileResult.updatedTagCount,
  };
}
