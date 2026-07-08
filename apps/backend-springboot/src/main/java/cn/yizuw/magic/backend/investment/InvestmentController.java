package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** 招商和招商雷达只读接口，承接旧 Nitro `/api/investment/**`。 */
@RestController
public class InvestmentController {

  private final InvestmentService investmentService;

  public InvestmentController(InvestmentService investmentService) {
    this.investmentService = investmentService;
  }

  /** 查询招商项目分页列表，返回旧前端消费的 `items/total` 结构。 */
  @GetMapping("/investment/list")
  public ApiResponse<Map<String, Object>> list(
      @RequestParam(required = false) String agentName,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String endTime,
      @RequestParam(required = false) String intentArea,
      @RequestParam(required = false) String intentLevel,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String progress,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String tenantName) {
    InvestmentListQuery query =
        InvestmentListQuery.of(
            agentName,
            currentPark,
            currentPage,
            endTime,
            intentArea,
            intentLevel,
            pageSize,
            progress,
            startTime,
            tenantName);
    return ApiResponse.ok(investmentService.getInvestmentList(query));
  }

  /** 招商项目表单中的园区下拉，只返回未删除园区。 */
  @GetMapping("/investment/park-list")
  public ApiResponse<List<Map<String, Object>>> parkList() {
    return ApiResponse.ok(investmentService.getInvestmentParkList());
  }

  /** 查询招商项目详情。旧接口未 include 图片和园区对象，这里保持核心字段兼容。 */
  @GetMapping("/investment/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(investmentService.getInvestmentDetail(id));
  }

  /** 新增招商项目主表记录；不处理图片关系、跟进记录或雷达线索联动。 */
  @PostMapping("/investment")
  public ApiResponse<Map<String, Object>> createInvestment(
      @RequestBody(required = false) InvestmentCreateRequest request) {
    return ApiResponse.ok(investmentService.createInvestment(request));
  }

  /** 更新招商项目主表字段；不处理图片关系和雷达线索联动。 */
  @PutMapping("/investment/{id}")
  public ApiResponse<Map<String, Object>> updateInvestment(
      @PathVariable int id, @RequestBody(required = false) InvestmentUpdateRequest request) {
    return ApiResponse.ok(investmentService.updateInvestment(id, request));
  }

  /** 兼容旧 Nitro `PUT /api/investment`，从请求体 `investmentId` 定位项目。 */
  @PutMapping("/investment")
  public ApiResponse<Map<String, Object>> updateInvestmentLegacy(
      @RequestBody(required = false) InvestmentUpdateRequest request) {
    return ApiResponse.ok(investmentService.updateInvestmentLegacy(request));
  }

  /** 删除招商项目主表记录；保持旧接口只删除 `investment` 主表的语义。 */
  @DeleteMapping("/investment/{id}")
  public ApiResponse<Map<String, Object>> deleteInvestment(@PathVariable int id) {
    return ApiResponse.ok(investmentService.deleteInvestment(id));
  }

  /** 招商雷达评分规则列表。 */
  @GetMapping("/investment/radar/score-rule/list")
  public ApiResponse<Map<String, Object>> scoreRuleList() {
    return ApiResponse.ok(investmentService.getLeadScoreRuleList());
  }

  /** 更新招商雷达评分规则，只允许旧接口支持的配置字段。 */
  @PutMapping("/investment/radar/score-rule/{id}")
  public ApiResponse<Map<String, Object>> updateScoreRule(
      @PathVariable long id, @RequestBody(required = false) Map<String, Object> request) {
    return ApiResponse.ok(investmentService.updateLeadScoreRule(id, request));
  }

  /** 招商雷达公开采集源列表。 */
  @GetMapping("/investment/radar/crawler-source/list")
  public ApiResponse<Map<String, Object>> crawlerSourceList() {
    return ApiResponse.ok(investmentService.getCrawlerSourceList());
  }

  /** 更新招商雷达采集源配置；只写配置表，不启动采集任务。 */
  @PutMapping("/investment/radar/crawler-source/{id}")
  public ApiResponse<Map<String, Object>> updateCrawlerSource(
      @PathVariable long id, @RequestBody(required = false) CrawlerSourceUpdateRequest request) {
    return ApiResponse.ok(investmentService.updateCrawlerSource(id, request));
  }

  /** 启用采集源；只更新 crawler_source.enabled，不启动爬虫任务。 */
  @PostMapping("/investment/radar/crawler-source/{id}/enable")
  public ApiResponse<Map<String, Object>> enableCrawlerSource(@PathVariable long id) {
    return ApiResponse.ok(investmentService.setCrawlerSourceEnabled(id, true));
  }

  /** 停用采集源；只更新 crawler_source.enabled，不取消历史任务。 */
  @PostMapping("/investment/radar/crawler-source/{id}/disable")
  public ApiResponse<Map<String, Object>> disableCrawlerSource(@PathVariable long id) {
    return ApiResponse.ok(investmentService.setCrawlerSourceEnabled(id, false));
  }

  /** 招商雷达销售负责人候选列表，用于线索分配下拉。 */
  @GetMapping("/investment/radar/sales-user/list")
  public ApiResponse<Map<String, Object>> radarSalesUserList(
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(investmentService.getRadarSalesUserList(parkId, keyword));
  }

  /** 招商雷达采集任务列表。 */
  @GetMapping("/investment/radar/crawler-task/list")
  public ApiResponse<Map<String, Object>> crawlerTaskList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer sourceId,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(
        investmentService.getCrawlerTaskList(currentPage, pageSize, sourceId, status));
  }

  /** 招商雷达信号事件列表。 */
  @GetMapping("/investment/radar/signal-event/list")
  public ApiResponse<Map<String, Object>> signalEventList(
      @RequestParam(required = false) String companyName,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String eventType,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String sourceName,
      @RequestParam(required = false) String sourceType,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(
        investmentService.getSignalEventList(
            companyName, currentPage, eventType, keyword, pageSize, sourceName, sourceType, status));
  }

  /** 招商雷达外部线索列表。 */
  @GetMapping("/investment/radar/external-lead/list")
  public ApiResponse<Map<String, Object>> externalLeadList(
      @RequestParam(required = false) String confidenceLevel,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String demandType,
      @RequestParam(required = false) String industryName,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String regionCity,
      @RequestParam(required = false) String sourceName,
      @RequestParam(required = false) String sourceType,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(
        investmentService.getExternalLeadList(
            confidenceLevel,
            currentPage,
            demandType,
            industryName,
            keyword,
            pageSize,
            regionCity,
            sourceName,
            sourceType,
            status));
  }

  /** 招商雷达企业画像列表。 */
  @GetMapping("/investment/radar/enterprise-profile/list")
  public ApiResponse<Map<String, Object>> enterpriseProfileList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String industryName,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String regionCity) {
    return ApiResponse.ok(
        investmentService.getEnterpriseProfileList(
            currentPage, industryName, keyword, pageSize, regionCity));
  }

  /** 招商雷达采集任务详情。 */
  @GetMapping("/investment/radar/crawler-task/{id}")
  public ApiResponse<Map<String, Object>> crawlerTaskDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getCrawlerTaskDetail(id));
  }

  /** 招商雷达采集任务日志列表。 */
  @GetMapping("/investment/radar/crawler-task/{id}/log")
  public ApiResponse<Map<String, Object>> crawlerTaskLogs(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getCrawlerTaskLogs(id));
  }

  /** 招商雷达采集任务 URL 项分页列表。 */
  @GetMapping("/investment/radar/crawler-task/{id}/item")
  public ApiResponse<Map<String, Object>> crawlerTaskItems(
      @PathVariable long id,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer sourceId,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(
        investmentService.getCrawlerTaskItems(id, currentPage, pageSize, sourceId, status));
  }

  /** 取消待执行采集任务；只写本地任务状态和日志，不触发爬虫执行。 */
  @PostMapping("/investment/radar/crawler-task/{id}/cancel")
  public ApiResponse<Map<String, Object>> cancelCrawlerTask(@PathVariable long id) {
    return ApiResponse.ok(investmentService.cancelCrawlerTask(id));
  }

  /** 重新入队失败/等待重试/跳过的采集 URL；只写本地任务项状态。 */
  @PostMapping("/investment/radar/crawler-task/item/requeue")
  public ApiResponse<Map<String, Object>> requeueCrawlerTaskItems(
      @RequestBody(required = false) CrawlerTaskItemRequeueRequest request) {
    return ApiResponse.ok(investmentService.requeueCrawlerTaskItems(request));
  }

  /** 回收长时间 RUNNING 的采集 URL；不启动 worker，只进入失败或重试等待。 */
  @PostMapping("/investment/radar/crawler-task/item/reclaim-stale-running")
  public ApiResponse<Map<String, Object>> reclaimStaleCrawlerTaskItems(
      @RequestBody(required = false) CrawlerTaskItemReclaimRequest request) {
    return ApiResponse.ok(investmentService.reclaimStaleCrawlerTaskItems(request));
  }

  /** 创建公开机会采集任务；同步重建本地线索，不触发外部爬虫。 */
  @PostMapping("/investment/radar/collect/task")
  public ApiResponse<Map<String, Object>> createRadarCollectTask() {
    return ApiResponse.ok(investmentService.createRadarCollectTask());
  }

  /** 招商雷达公开机会采集任务详情；只读查询任务结果。 */
  @GetMapping("/investment/radar/collect/task/{taskId}")
  public ApiResponse<Map<String, Object>> radarCollectTaskDetail(@PathVariable String taskId) {
    return ApiResponse.ok(investmentService.getRadarCollectTaskDetail(taskId));
  }

  /** 招商雷达信号事件详情，包含证据数组。 */
  @GetMapping("/investment/radar/signal-event/{id}")
  public ApiResponse<Map<String, Object>> signalEventDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getSignalEventDetail(id));
  }

  /** 更新招商雷达信号事件状态；只写本地状态，不转线索。 */
  @PutMapping("/investment/radar/signal-event/{id}")
  public ApiResponse<Map<String, Object>> updateSignalEvent(
      @PathVariable long id, @RequestBody(required = false) SignalEventUpdateRequest request) {
    return ApiResponse.ok(investmentService.updateSignalEvent(id, request));
  }

  /** 企业信号转招商雷达线索；只写共享雷达库本地企业、线索和信号关联。 */
  @PostMapping("/investment/radar/signal-event/{id}/convert")
  public ApiResponse<Map<String, Object>> convertSignalEvent(
      @PathVariable long id, @RequestBody(required = false) RadarLeadConvertRequest request) {
    return ApiResponse.ok(investmentService.convertSignalEvent(id, request));
  }

  /** 招商雷达信号事件证据列表。 */
  @GetMapping("/investment/radar/signal-event/{id}/evidence")
  public ApiResponse<Map<String, Object>> signalEventEvidences(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getSignalEventEvidences(id));
  }

  /** 从现有外部公开线索刷新企业信号；只做本地派生，不执行公开爬虫。 */
  @PostMapping("/investment/radar/signal-event/refresh")
  public ApiResponse<Map<String, Object>> refreshSignalEvents() {
    return ApiResponse.ok(investmentService.refreshSignalEvents());
  }

  /** 招商雷达外部公开线索详情，包含证据数组。 */
  @GetMapping("/investment/radar/external-lead/{id}")
  public ApiResponse<Map<String, Object>> externalLeadDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getExternalLeadDetail(id));
  }

  /** 更新外部公开线索状态、负责人和备注；不转招商雷达线索。 */
  @PutMapping("/investment/radar/external-lead/{id}")
  public ApiResponse<Map<String, Object>> updateExternalLead(
      @PathVariable long id, @RequestBody(required = false) ExternalLeadUpdateRequest request) {
    return ApiResponse.ok(investmentService.updateExternalLead(id, request));
  }

  /** 外部公开线索转招商雷达线索；不调用爬虫、短信、企微或外部网络。 */
  @PostMapping("/investment/radar/external-lead/{id}/convert")
  public ApiResponse<Map<String, Object>> convertExternalLead(
      @PathVariable long id, @RequestBody(required = false) RadarLeadConvertRequest request) {
    return ApiResponse.ok(investmentService.convertExternalLead(id, request));
  }

  /** 招商雷达外部公开线索证据列表。 */
  @GetMapping("/investment/radar/external-lead/{id}/evidence")
  public ApiResponse<Map<String, Object>> externalLeadEvidences(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getExternalLeadEvidences(id));
  }

  /** 招商雷达企业画像详情。 */
  @GetMapping("/investment/radar/enterprise-profile/{id}")
  public ApiResponse<Map<String, Object>> enterpriseProfileDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getEnterpriseProfileDetail(id));
  }

  /** 招商雷达企业画像关联信号列表。 */
  @GetMapping("/investment/radar/enterprise-profile/{id}/signals")
  public ApiResponse<Map<String, Object>> enterpriseProfileSignals(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getEnterpriseProfileSignals(id));
  }

  /** 招商雷达企业画像标签列表。 */
  @GetMapping("/investment/radar/enterprise-profile/{id}/tags")
  public ApiResponse<Map<String, Object>> enterpriseProfileTags(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getEnterpriseProfileTags(id));
  }

  /** 从现有企业信号刷新企业画像；不触发外部采集或画像第三方查询。 */
  @PostMapping("/investment/radar/enterprise-profile/refresh")
  public ApiResponse<Map<String, Object>> refreshEnterpriseProfiles() {
    return ApiResponse.ok(investmentService.refreshEnterpriseProfiles());
  }

  /** 招商雷达公开机会有效列表，兼容旧 `effective-list` 查询协议。 */
  @GetMapping("/investment/radar/public-opportunity/effective-list")
  public ApiResponse<Map<String, Object>> publicOpportunityEffectiveList(
      @RequestParam(required = false) String city,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String includeMeta,
      @RequestParam(required = false) String includeTotal,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String opportunityType,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String publishedAgeLabel,
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String sourceSite) {
    PublicOpportunityQuery query =
        PublicOpportunityQuery.of(
            city,
            currentPage,
            includeMeta,
            includeTotal,
            keyword,
            opportunityType,
            pageSize,
            publishedAgeLabel,
            scope,
            sourceSite);
    return ApiResponse.ok(investmentService.getPublicOpportunityEffectiveList(query));
  }

  /** 招商雷达公开机会筛选项，返回来源站点和发布时间标签。 */
  @GetMapping("/investment/radar/public-opportunity/effective-options")
  public ApiResponse<Map<String, Object>> publicOpportunityEffectiveOptions(
      @RequestParam(required = false) String city,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String includeMeta,
      @RequestParam(required = false) String includeTotal,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String opportunityType,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String publishedAgeLabel,
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String sourceSite) {
    PublicOpportunityQuery query =
        PublicOpportunityQuery.of(
            city,
            currentPage,
            includeMeta,
            includeTotal,
            keyword,
            opportunityType,
            pageSize,
            publishedAgeLabel,
            scope,
            sourceSite);
    return ApiResponse.ok(investmentService.getPublicOpportunityEffectiveOptions(query));
  }

  /** 招商雷达公开机会统计，用于页面顶部 total/strictTotal。 */
  @GetMapping("/investment/radar/public-opportunity/effective-stats")
  public ApiResponse<Map<String, Object>> publicOpportunityEffectiveStats(
      @RequestParam(required = false) String city,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String includeMeta,
      @RequestParam(required = false) String includeTotal,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String opportunityType,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String publishedAgeLabel,
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String sourceSite) {
    PublicOpportunityQuery query =
        PublicOpportunityQuery.of(
            city,
            currentPage,
            includeMeta,
            includeTotal,
            keyword,
            opportunityType,
            pageSize,
            publishedAgeLabel,
            scope,
            sourceSite);
    return ApiResponse.ok(investmentService.getPublicOpportunityEffectiveStats(query));
  }

  /** 招商雷达公开机会采集进度，只读汇总采集源、最新任务和任务项状态。 */
  @GetMapping("/investment/radar/public-opportunity/effective-progress")
  public ApiResponse<Map<String, Object>> publicOpportunityEffectiveProgress(
      @RequestParam(required = false) String opportunityType) {
    return ApiResponse.ok(investmentService.getPublicOpportunityEffectiveProgress(opportunityType));
  }

  /** 招商雷达公开机会历史数据审计统计；只读计算，不刷新缓存或修复数据。 */
  @GetMapping("/investment/radar/public-opportunity/audit-summary")
  public ApiResponse<Map<String, Object>> publicOpportunityAuditSummary(
      @RequestParam(required = false) String refresh) {
    return ApiResponse.ok(investmentService.getPublicOpportunityAuditSummary(refresh));
  }

  /** 招商雷达公开机会历史数据审计预览；返回最多 50 条问题数据。 */
  @GetMapping("/investment/radar/public-opportunity/audit-preview")
  public ApiResponse<Map<String, Object>> publicOpportunityAuditPreview() {
    return ApiResponse.ok(investmentService.getPublicOpportunityAuditPreview());
  }

  /** 手工录入公开机会；只写公开机会本地表，不触发线索转换或爬虫。 */
  @PostMapping("/investment/radar/public-opportunity/manual")
  public ApiResponse<Map<String, Object>> createManualPublicOpportunity(
      @RequestBody(required = false) PublicOpportunityManualRequest request) {
    return ApiResponse.ok(investmentService.createManualPublicOpportunity(request));
  }

  /** 批量导入公开机会详情 URL；只生成本地待采集 URL 项。 */
  @PostMapping("/investment/radar/public-opportunity/import-urls")
  public ApiResponse<Map<String, Object>> importPublicOpportunityUrls(
      @RequestBody(required = false) PublicOpportunityImportUrlsRequest request) {
    return ApiResponse.ok(investmentService.importPublicOpportunityUrls(request));
  }

  /** 手工解析公开需求页 HTML；不主动访问外部链接，也不启动采集任务。 */
  @PostMapping("/investment/radar/public-opportunity/parse-demand-page")
  public ApiResponse<Map<String, Object>> parsePublicOpportunityDemandPage(
      @Valid @RequestBody(required = false) PublicOpportunityParseDemandPageRequest request) {
    return ApiResponse.ok(investmentService.parsePublicOpportunityDemandPage(request));
  }

  /** 公开机会历史数据修复；dryRun 默认 true，避免批量误改。 */
  @PostMapping("/investment/radar/public-opportunity/repair")
  public ApiResponse<Map<String, Object>> repairPublicOpportunityHistory(
      @RequestBody(required = false) PublicOpportunityRepairRequest request) {
    return ApiResponse.ok(investmentService.repairPublicOpportunityHistory(request));
  }

  /** 从本地公开机会池重建外部线索；不执行爬虫或外部网络请求。 */
  @PostMapping("/investment/radar/external-lead/rebuild-from-public-opportunity")
  public ApiResponse<Map<String, Object>> rebuildExternalLeadsFromPublicOpportunity() {
    return ApiResponse.ok(investmentService.rebuildExternalLeadsFromPublicOpportunity());
  }

  /** 招商雷达公开机会详情。 */
  @GetMapping("/investment/radar/public-opportunity/{id}")
  public ApiResponse<Map<String, Object>> publicOpportunityDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getPublicOpportunityDetail(id));
  }

  /** 招商雷达触达模板列表。 */
  @GetMapping("/investment/radar/outreach-template/list")
  public ApiResponse<Map<String, Object>> outreachTemplateList(
      @RequestParam(required = false) String approvalStatus,
      @RequestParam(required = false) String channel,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String enabled,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String taskType) {
    OutreachTemplateQuery query =
        OutreachTemplateQuery.of(
            approvalStatus, channel, currentPage, enabled, keyword, pageSize, taskType);
    return ApiResponse.ok(investmentService.getOutreachTemplateList(query));
  }

  /** 招商雷达触达模板使用统计。 */
  @GetMapping("/investment/radar/outreach-template/stats")
  public ApiResponse<Map<String, Object>> outreachTemplateStats() {
    return ApiResponse.ok(investmentService.getOutreachTemplateStats());
  }

  /** 招商雷达触达模板版本列表。 */
  @GetMapping("/investment/radar/outreach-template/{id}/versions")
  public ApiResponse<Map<String, Object>> outreachTemplateVersions(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getOutreachTemplateVersions(id));
  }

  /** 招商雷达触达模板预览；纯内存渲染，不写模板表也不触发外部发送。 */
  @PostMapping("/investment/radar/outreach-template/preview")
  public ApiResponse<Map<String, Object>> previewOutreachTemplate(
      @RequestBody(required = false) OutreachTemplatePreviewRequest request) {
    return ApiResponse.ok(investmentService.previewOutreachTemplate(request));
  }

  /** 创建触达模板；只写模板表和版本快照，不创建触达任务。 */
  @PostMapping("/investment/radar/outreach-template")
  public ApiResponse<Map<String, Object>> createOutreachTemplate(
      @RequestBody(required = false) OutreachTemplateSaveRequest request) {
    return ApiResponse.ok(investmentService.createOutreachTemplate(request));
  }

  /** 更新触达模板；更新后进入待审批并禁用，不触发外部发送。 */
  @PutMapping("/investment/radar/outreach-template/{id}")
  public ApiResponse<Map<String, Object>> updateOutreachTemplate(
      @PathVariable long id, @RequestBody(required = false) OutreachTemplateSaveRequest request) {
    return ApiResponse.ok(investmentService.updateOutreachTemplate(id, request));
  }

  /** 提交触达模板审批；只切换审批状态并写版本快照。 */
  @PostMapping("/investment/radar/outreach-template/{id}/submit-approval")
  public ApiResponse<Map<String, Object>> submitOutreachTemplateApproval(@PathVariable long id) {
    return ApiResponse.ok(investmentService.submitOutreachTemplateApproval(id));
  }

  /** 审批通过触达模板；本地启用模板，不生成触达任务。 */
  @PostMapping("/investment/radar/outreach-template/{id}/approve")
  public ApiResponse<Map<String, Object>> approveOutreachTemplate(@PathVariable long id) {
    return ApiResponse.ok(investmentService.setOutreachTemplateApproval(id, "APPROVED"));
  }

  /** 驳回触达模板；本地禁用模板，不影响历史触达任务。 */
  @PostMapping("/investment/radar/outreach-template/{id}/reject")
  public ApiResponse<Map<String, Object>> rejectOutreachTemplate(@PathVariable long id) {
    return ApiResponse.ok(investmentService.setOutreachTemplateApproval(id, "REJECTED"));
  }

  /** 启用已审批触达模板；只写模板 enabled 状态，不发送触达任务。 */
  @PostMapping("/investment/radar/outreach-template/{id}/enable")
  public ApiResponse<Map<String, Object>> enableOutreachTemplate(@PathVariable long id) {
    return ApiResponse.ok(investmentService.setOutreachTemplateEnabled(id, true));
  }

  /** 停用触达模板；只写模板 enabled 状态，不影响历史任务。 */
  @PostMapping("/investment/radar/outreach-template/{id}/disable")
  public ApiResponse<Map<String, Object>> disableOutreachTemplate(@PathVariable long id) {
    return ApiResponse.ok(investmentService.setOutreachTemplateEnabled(id, false));
  }

  /** 招商雷达触达任务列表。 */
  @GetMapping("/investment/radar/outreach-task/list")
  public ApiResponse<Map<String, Object>> outreachTaskList(
      @RequestParam(required = false) String channel,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String priorityLevel,
      @RequestParam(required = false) String replyStatus,
      @RequestParam(required = false) String stage,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String taskType) {
    OutreachTaskQuery query =
        OutreachTaskQuery.of(
            channel, currentPage, keyword, pageSize, priorityLevel, replyStatus, stage, status, taskType);
    return ApiResponse.ok(investmentService.getOutreachTaskList(query));
  }

  /** 招商雷达触达任务详情。 */
  @GetMapping("/investment/radar/outreach-task/{id}")
  public ApiResponse<Map<String, Object>> outreachTaskDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getOutreachTaskDetail(id));
  }

  /** 创建触达任务；只落本地待执行记录，不调用发送通道。 */
  @PostMapping("/investment/radar/outreach-task")
  public ApiResponse<Map<String, Object>> createOutreachTask(
      @RequestBody(required = false) OutreachTaskCreateRequest request) {
    return ApiResponse.ok(investmentService.createOutreachTask(request));
  }

  /** 取消触达任务；仅允许 PENDING/RUNNING 状态，不调用发送通道。 */
  @PostMapping("/investment/radar/outreach-task/{id}/cancel")
  public ApiResponse<Map<String, Object>> cancelOutreachTask(@PathVariable long id) {
    return ApiResponse.ok(investmentService.cancelOutreachTask(id));
  }

  /** 发送触达任务；迁移期只写本地发送状态，不调用短信/企微供应商。 */
  @PostMapping("/investment/radar/outreach-task/{id}/send")
  public ApiResponse<Map<String, Object>> sendOutreachTask(@PathVariable long id) {
    return ApiResponse.ok(investmentService.sendOutreachTask(id));
  }

  /** 兼容旧 mock-send 路径；旧端与 send 共用同一发送服务。 */
  @PostMapping("/investment/radar/outreach-task/{id}/mock-send")
  public ApiResponse<Map<String, Object>> mockSendOutreachTask(@PathVariable long id) {
    return ApiResponse.ok(investmentService.sendOutreachTask(id));
  }

  /** 记录触达任务回复；只更新本地任务、线索阶段和限制名单。 */
  @PostMapping("/investment/radar/outreach-task/{id}/reply")
  public ApiResponse<Map<String, Object>> replyOutreachTask(
      @PathVariable long id, @RequestBody(required = false) OutreachTaskReplyRequest request) {
    return ApiResponse.ok(investmentService.replyOutreachTask(id, request));
  }

  /** 招商雷达分析总览，聚合漏斗、来源、渠道、销售和 SOP 提醒数据。 */
  @GetMapping("/investment/radar/analysis/summary")
  public ApiResponse<Map<String, Object>> radarAnalysisSummary() {
    return ApiResponse.ok(investmentService.getRadarAnalysisSummary());
  }

  /** 招商雷达获客分析，统计公开线索和信号事件转化。 */
  @GetMapping("/investment/radar/analytics/acquisition")
  public ApiResponse<Map<String, Object>> radarAcquisitionAnalytics() {
    return ApiResponse.ok(investmentService.getRadarAcquisitionAnalytics());
  }

  /** 招商雷达渠道触达分析。 */
  @GetMapping("/investment/radar/analytics/channel")
  public ApiResponse<List<Map<String, Object>>> radarChannelAnalytics() {
    return ApiResponse.ok(investmentService.getRadarChannelAnalytics());
  }

  /** 招商雷达话术模板分析。 */
  @GetMapping("/investment/radar/analytics/template")
  public ApiResponse<List<Map<String, Object>>> radarTemplateAnalytics() {
    return ApiResponse.ok(investmentService.getRadarTemplateAnalytics());
  }

  /** 招商雷达销售绩效分析。 */
  @GetMapping("/investment/radar/analytics/sales")
  public ApiResponse<List<Map<String, Object>>> radarSalesAnalytics() {
    return ApiResponse.ok(investmentService.getRadarSalesAnalytics());
  }

  /** 招商雷达销售转化漏斗分析。 */
  @GetMapping("/investment/radar/analytics/sales-funnel")
  public ApiResponse<Map<String, Object>> radarSalesFunnelAnalytics() {
    return ApiResponse.ok(investmentService.getRadarSalesFunnelAnalytics());
  }

  /** 招商雷达 ROI 分析，按触达渠道估算成本和成交产出。 */
  @GetMapping("/investment/radar/analytics/roi")
  public ApiResponse<List<Map<String, Object>>> radarRoiAnalytics() {
    return ApiResponse.ok(investmentService.getRadarRoiAnalytics());
  }

  /** 招商雷达话术模板转化分析，保持近 90 天只读统计口径。 */
  @GetMapping("/investment/radar/analytics/template-conversion")
  public ApiResponse<List<Map<String, Object>>> radarTemplateConversionAnalytics() {
    return ApiResponse.ok(investmentService.getRadarTemplateConversionAnalytics());
  }

  /** 招商雷达公开采集源运维摘要；不触发采集源 seed 或任务执行。 */
  @GetMapping("/investment/radar/crawler-task/ops-summary")
  public ApiResponse<Map<String, Object>> crawlerTaskOpsSummary(
      @RequestParam(required = false) Integer sourceId,
      @RequestParam(required = false) String sourceCode) {
    return ApiResponse.ok(investmentService.getCrawlerTaskOpsSummary(sourceId, sourceCode));
  }

  /** 招商雷达公开采集健康度汇总；Spring Boot GET 保持只读。 */
  @GetMapping("/investment/radar/crawler-task/health")
  public ApiResponse<Map<String, Object>> crawlerTaskHealth() {
    return ApiResponse.ok(investmentService.getCrawlerTaskHealth());
  }

  /** 招商雷达爬虫操作审计日志列表。 */
  @GetMapping("/investment/radar/crawler-task/audit/list")
  public ApiResponse<Map<String, Object>> crawlerTaskAuditList(
      @RequestParam(required = false) String action,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String objectType,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String result) {
    RadarOperationAuditQuery query =
        RadarOperationAuditQuery.of(action, currentPage, keyword, objectType, pageSize, result);
    return ApiResponse.ok(investmentService.getCrawlerTaskAuditList(query));
  }

  /** 启动公开机会采集调度；迁移期只返回本地调度状态并写审计，不创建线程定时器。 */
  @PostMapping("/investment/radar/crawler-task/scheduler/start")
  public ApiResponse<Map<String, Object>> startCrawlerTaskScheduler() {
    return ApiResponse.ok(investmentService.startCrawlerTaskScheduler());
  }

  /** 停止公开机会采集调度；迁移期只返回本地调度状态并写审计。 */
  @PostMapping("/investment/radar/crawler-task/scheduler/stop")
  public ApiResponse<Map<String, Object>> stopCrawlerTaskScheduler() {
    return ApiResponse.ok(investmentService.stopCrawlerTaskScheduler());
  }

  /** 招商雷达公开机会采集调度状态；当前返回 Spring Boot 本地只读状态。 */
  @GetMapping("/investment/radar/crawler-task/scheduler/status")
  public ApiResponse<Map<String, Object>> crawlerTaskSchedulerStatus() {
    return ApiResponse.ok(investmentService.getCrawlerTaskSchedulerStatus());
  }

  /** 兼容旧通用运行入口；只创建本地 PENDING 采集任务，不真实抓取。 */
  @PostMapping("/investment/radar/crawler-task/run")
  public ApiResponse<Map<String, Object>> runCrawlerTask(
      @RequestBody(required = false) PublicOpportunityCrawlerRunRequest request) {
    return ApiResponse.ok(investmentService.runCrawlerTask(request));
  }

  /** 创建 EIA 公开信号采集本地任务；不加载 adapter、不访问外部网站。 */
  @PostMapping("/investment/radar/crawler-task/run-eia")
  public ApiResponse<Map<String, Object>> runEiaCrawlerTask() {
    return ApiResponse.ok(investmentService.runNamedCrawlerTask("EIA"));
  }

  /** 创建内部合同到期扫描本地任务；不扫描租户合同，等待 worker 消费。 */
  @PostMapping("/investment/radar/crawler-task/run-internal-contract-expiry")
  public ApiResponse<Map<String, Object>> runInternalContractExpiryCrawlerTask() {
    return ApiResponse.ok(investmentService.runNamedCrawlerTask("INTERNAL_CONTRACT_EXPIRY"));
  }

  /** 创建招聘扩产公开信号采集本地任务；不访问招聘站点。 */
  @PostMapping("/investment/radar/crawler-task/run-recruitment")
  public ApiResponse<Map<String, Object>> runRecruitmentCrawlerTask() {
    return ApiResponse.ok(investmentService.runNamedCrawlerTask("RECRUITMENT"));
  }

  /** 创建招投标公开信号采集本地任务；不访问招投标站点。 */
  @PostMapping("/investment/radar/crawler-task/run-tender")
  public ApiResponse<Map<String, Object>> runTenderCrawlerTask() {
    return ApiResponse.ok(investmentService.runNamedCrawlerTask("TENDER"));
  }

  /** 同步内部合同到期信号到招商雷达；只扫描本地数据库，不访问外部网络。 */
  @PostMapping("/investment/radar/crawler-task/sync-internal-contract-expiry")
  public ApiResponse<Map<String, Object>> syncInternalContractExpiry() {
    return ApiResponse.ok(investmentService.syncInternalContractExpiryToRadar());
  }

  /** 创建公开机会 URL 采集本地任务；不联网抓取，由后续 worker 消费。 */
  @PostMapping("/investment/radar/crawler-task/run-public-opportunity")
  public ApiResponse<Map<String, Object>> runPublicOpportunityCrawlerTask(
      @RequestBody(required = false) PublicOpportunityCrawlerRunRequest request) {
    return ApiResponse.ok(investmentService.runPublicOpportunityCrawlerTask(request));
  }

  /** 创建公开机会批量采集本地任务；不并发抓取外部平台。 */
  @PostMapping("/investment/radar/crawler-task/run-public-opportunity-batch")
  public ApiResponse<Map<String, Object>> runPublicOpportunityCrawlerBatch(
      @RequestBody(required = false) PublicOpportunityBatchRunRequest request) {
    return ApiResponse.ok(investmentService.runPublicOpportunityCrawlerBatch(request));
  }

  /** 招商雷达线索列表。 */
  @GetMapping("/investment/radar/lead/list")
  public ApiResponse<Map<String, Object>> radarLeadList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String priorityLevel,
      @RequestParam(required = false) String stage) {
    RadarLeadQuery query =
        RadarLeadQuery.of(currentPage, keyword, pageSize, parkId, priorityLevel, stage);
    return ApiResponse.ok(investmentService.getRadarLeadList(query));
  }

  /** 招商雷达线索详情，包含导航、触达任务摘要和采集任务快照。 */
  @GetMapping("/investment/radar/lead/{id}")
  public ApiResponse<Map<String, Object>> radarLeadDetail(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getRadarLeadDetail(id));
  }

  /** JSON 数组或 `{ items: [] }` 导入招商雷达线索；不解析上传文件。 */
  @PostMapping("/investment/radar/lead/import")
  public ApiResponse<Map<String, Object>> importRadarLeads(@RequestBody(required = false) Object request) {
    return ApiResponse.ok(investmentService.importRadarLeads(request));
  }

  /** 上传 JSON/CSV/TSV 文件导入招商雷达线索；复用 JSON 导入的落库和审计逻辑。 */
  @PostMapping("/investment/radar/lead/import-file")
  public ApiResponse<Map<String, Object>> importRadarLeadsFile(
      @RequestParam(value = "file", required = false) MultipartFile file) {
    return ApiResponse.ok(investmentService.importRadarLeadsFile(file));
  }

  /** 招商雷达线索评分拆解。 */
  @GetMapping("/investment/radar/lead/{id}/score-breakdown")
  public ApiResponse<Map<String, Object>> radarLeadScoreBreakdown(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getRadarLeadScoreBreakdown(id));
  }

  /** 重算招商雷达线索评分；只使用现有信号和评分规则，不刷新爬虫数据。 */
  @PostMapping("/investment/radar/lead/{id}/recalculate-score")
  public ApiResponse<Map<String, Object>> recalculateRadarLeadScore(@PathVariable long id) {
    return ApiResponse.ok(investmentService.recalculateRadarLeadScore(id));
  }

  /** 批量重算招商雷达线索评分；不刷新信号、不启动爬虫、不 seed 默认规则。 */
  @PostMapping("/investment/radar/lead/recalculate-scores")
  public ApiResponse<Map<String, Object>> recalculateRadarLeadScores() {
    return ApiResponse.ok(investmentService.recalculateRadarLeadScores());
  }

  /** 招商雷达线索房源匹配快照；只读读取已保存结果，不触发重建。 */
  @GetMapping("/investment/radar/lead/{id}/property-match")
  public ApiResponse<List<Map<String, Object>>> radarLeadPropertyMatch(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getRadarLeadPropertyMatch(id));
  }

  /** 重建单条线索房源匹配快照；只基于本地房源、园区和线索数据计算。 */
  @PostMapping("/investment/radar/lead/{id}/rebuild-property-match")
  public ApiResponse<Map<String, Object>> rebuildRadarLeadPropertyMatch(@PathVariable long id) {
    return ApiResponse.ok(investmentService.rebuildRadarLeadPropertyMatch(id));
  }

  /** 批量重建线索房源匹配快照；默认最多处理 200 条，避免 HTTP 请求内全量重建。 */
  @PostMapping("/investment/radar/lead/rebuild-property-match-batch")
  public ApiResponse<Map<String, Object>> rebuildRadarLeadPropertyMatchBatch(
      @RequestBody(required = false) Map<String, Object> request) {
    return ApiResponse.ok(investmentService.rebuildRadarLeadPropertyMatchBatch(request));
  }

  /** 刷新招商雷达本地主动获客链路；不启动爬虫、不调用短信或企微。 */
  @PostMapping("/investment/radar/pipeline/rebuild")
  public ApiResponse<Map<String, Object>> rebuildRadarAcquisitionPipeline() {
    return ApiResponse.ok(investmentService.rebuildRadarAcquisitionPipeline());
  }

  /** 更新房源标签；只写标签表和已有匹配快照，不重建匹配。 */
  @PutMapping("/investment/radar/property/{id}/tags")
  public ApiResponse<Map<String, Object>> updateRadarPropertyTags(
      @PathVariable long id, @RequestBody(required = false) PropertyTagUpdateRequest request) {
    return ApiResponse.ok(investmentService.updateRadarPropertyTags(id, request));
  }

  /** 手动分配线索负责人；只写本地负责人字段和分配日志。 */
  @PostMapping("/investment/radar/lead/{id}/assign-owner")
  public ApiResponse<Map<String, Object>> assignRadarLeadOwner(
      @PathVariable long id, @RequestBody(required = false) RadarLeadAssignOwnerRequest request) {
    return ApiResponse.ok(investmentService.assignRadarLeadOwner(id, request));
  }

  /** 新增线索跟进记录；按旧端规则更新线索阶段和触达限制。 */
  @PostMapping("/investment/radar/lead/{id}/follow")
  public ApiResponse<Map<String, Object>> createRadarLeadFollow(
      @PathVariable long id, @RequestBody(required = false) RadarLeadFollowRequest request) {
    return ApiResponse.ok(investmentService.createRadarLeadFollow(id, request));
  }

  /** 关闭线索为成交或失效；同步完成待办并取消未执行触达。 */
  @PostMapping("/investment/radar/lead/{id}/close")
  public ApiResponse<Map<String, Object>> closeRadarLead(
      @PathVariable long id, @RequestBody(required = false) RadarLeadCloseRequest request) {
    return ApiResponse.ok(investmentService.closeRadarLead(id, request));
  }

  /** 新增线索带看预约；只写带看记录并推进线索阶段。 */
  @PostMapping("/investment/radar/lead/{id}/visit")
  public ApiResponse<Map<String, Object>> createRadarLeadVisit(
      @PathVariable long id, @RequestBody(required = false) RadarLeadVisitRequest request) {
    return ApiResponse.ok(investmentService.createRadarLeadVisit(id, request));
  }

  /** 招商雷达 SOP 待办列表；Spring Boot GET 保持只读，不更新逾期状态。 */
  @GetMapping("/investment/radar/sop-reminder/list")
  public ApiResponse<Map<String, Object>> radarSopReminderList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String priorityLevel,
      @RequestParam(required = false) String reminderStatus,
      @RequestParam(required = false) String reminderType,
      @RequestParam(required = false) String stage) {
    RadarLeadQuery query =
        RadarLeadQuery.of(currentPage, keyword, pageSize, null, priorityLevel, stage);
    return ApiResponse.ok(
        investmentService.getRadarSopReminderList(query, reminderStatus, reminderType));
  }

  /** 招商雷达线索 SOP 明细；只读返回历史记录和运行时生成的提醒建议。 */
  @GetMapping("/investment/radar/lead/{id}/sop")
  public ApiResponse<Map<String, Object>> radarLeadSop(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getRadarLeadSop(id));
  }

  /** 完成 SOP 提醒；只写提醒状态，不触发外部通知。 */
  @PostMapping("/investment/radar/sop-reminder/{id}/complete")
  public ApiResponse<Map<String, Object>> completeRadarSopReminder(@PathVariable long id) {
    return ApiResponse.ok(investmentService.completeRadarSopReminder(id));
  }

  /** 完成带看记录；只写带看反馈和线索阶段。 */
  @PostMapping("/investment/radar/visit-record/{id}/complete")
  public ApiResponse<Map<String, Object>> completeRadarVisitRecord(
      @PathVariable long id, @RequestBody(required = false) RadarVisitCompleteRequest request) {
    return ApiResponse.ok(investmentService.completeRadarVisitRecord(id, request));
  }

  /** 招商雷达线索触达建议；只读组合模板、限制规则和线索状态。 */
  @GetMapping("/investment/radar/lead/{id}/outreach-suggestion")
  public ApiResponse<Map<String, Object>> radarLeadOutreachSuggestion(@PathVariable long id) {
    return ApiResponse.ok(investmentService.getRadarLeadOutreachSuggestion(id));
  }

  /** 招商雷达触达限制名单。 */
  @GetMapping("/investment/radar/contact-restriction/list")
  public ApiResponse<Map<String, Object>> contactRestrictionList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String restrictionType,
      @RequestParam(required = false) String status) {
    ContactRestrictionQuery query =
        ContactRestrictionQuery.of(currentPage, keyword, pageSize, restrictionType, status);
    return ApiResponse.ok(investmentService.getContactRestrictionList(query));
  }

  /** 招商雷达触达限制导出；默认 JSON rows，`format=csv` 时返回 CSV 文本。 */
  @GetMapping("/investment/radar/contact-restriction/export")
  public ResponseEntity<?> contactRestrictionExport(
      @RequestParam(required = false) String format,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String restrictionType,
      @RequestParam(required = false) String status) {
    Map<String, Object> result =
        investmentService.exportContactRestrictions(keyword, restrictionType, status);
    if (!"csv".equalsIgnoreCase(format == null ? "" : format.trim())) {
      return ResponseEntity.ok(ApiResponse.ok(result));
    }
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"contact-restrictions.csv\"")
        .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
        .body(investmentService.exportContactRestrictionsCsv(result));
  }

  /** 批量导入触达限制名单；只写共享雷达库本地限制表和审计日志。 */
  @PostMapping("/investment/radar/contact-restriction/import")
  public ApiResponse<Map<String, Object>> importContactRestrictions(
      @RequestBody(required = false) Object request) {
    return ApiResponse.ok(investmentService.importContactRestrictions(request));
  }

  /** 招商雷达触达限制审计日志。 */
  @GetMapping("/investment/radar/contact-restriction/audit/list")
  public ApiResponse<Map<String, Object>> contactRestrictionAuditList(
      @RequestParam(required = false) String action,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Long restrictionId) {
    ContactRestrictionAuditQuery query =
        ContactRestrictionAuditQuery.of(action, currentPage, keyword, pageSize, restrictionId);
    return ApiResponse.ok(investmentService.getContactRestrictionAuditList(query));
  }

  /** 提交触达限制解除申请；只写本地释放状态和审计日志。 */
  @PostMapping("/investment/radar/contact-restriction/{id}/release")
  public ApiResponse<Map<String, Object>> submitContactRestrictionRelease(
      @PathVariable long id, @RequestBody(required = false) ContactRestrictionReleaseRequest request) {
    return ApiResponse.ok(investmentService.submitContactRestrictionRelease(id, request));
  }

  /** 审批通过触达限制解除申请；本地释放限制，不触发外部通知。 */
  @PostMapping("/investment/radar/contact-restriction/{id}/approve-release")
  public ApiResponse<Map<String, Object>> approveContactRestrictionRelease(
      @PathVariable long id, @RequestBody(required = false) ContactRestrictionReleaseRequest request) {
    return ApiResponse.ok(investmentService.approveContactRestrictionRelease(id, request));
  }

  /** 驳回触达限制解除申请；只写本地释放状态和审计日志。 */
  @PostMapping("/investment/radar/contact-restriction/{id}/reject-release")
  public ApiResponse<Map<String, Object>> rejectContactRestrictionRelease(
      @PathVariable long id, @RequestBody(required = false) ContactRestrictionReleaseRequest request) {
    return ApiResponse.ok(investmentService.rejectContactRestrictionRelease(id, request));
  }
}
