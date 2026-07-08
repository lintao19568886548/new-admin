package cn.yizuw.magic.backend.job;

import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.annotation.XxlJob;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class BackendMigrationJobHandlers {

  private final JobParameterParser jobParameterParser;
  private final MigrationJobService migrationJobService;

  public BackendMigrationJobHandlers(
      JobParameterParser jobParameterParser, MigrationJobService migrationJobService) {
    this.jobParameterParser = jobParameterParser;
    this.migrationJobService = migrationJobService;
  }

  @XxlJob("organizationProvisioningJob")
  public void organizationProvisioningJob() {
    run("organizationProvisioningJob");
  }

  @XxlJob("vipMembershipRefundReconcileJob")
  public void vipMembershipRefundReconcileJob() {
    run("vipMembershipRefundReconcileJob");
  }

  @XxlJob("rentalExpenseFinanceSyncJob")
  public void rentalExpenseFinanceSyncJob() {
    run("rentalExpenseFinanceSyncJob");
  }

  @XxlJob("amountBillCollectionSmsScanJob")
  public void amountBillCollectionSmsScanJob() {
    run("amountBillCollectionSmsScanJob");
  }

  @XxlJob("investmentRadarCrawlerJob")
  public void investmentRadarCrawlerJob() {
    run("investmentRadarCrawlerJob");
  }

  @XxlJob("menuTemplateSyncJob")
  public void menuTemplateSyncJob() {
    run("menuTemplateSyncJob");
  }

  @XxlJob("publicCrawlerHealthCheckJob")
  public void publicCrawlerHealthCheckJob() {
    run("publicCrawlerHealthCheckJob");
  }

  private void run(String jobName) {
    Map<String, String> parameters = jobParameterParser.parse(XxlJobHelper.getJobParam());
    boolean execute = jobParameterParser.execute(parameters);
    Map<String, Object> result = migrationJobService.run(jobName, parameters, execute);
    XxlJobHelper.handleSuccess(result.toString());
  }
}
