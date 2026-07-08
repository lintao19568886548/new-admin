package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantDataSourceRegistry;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * 招商与招商雷达只读服务。
 *
 * <p>旧 Nitro 使用 `runWithRadarSharedScope` 读取共享雷达库，不跟随当前登录租户库；这里统一解析
 * `INVESTMENT_RADAR_CUSTOMER_ID/INVESTMENT_RADAR_DB_NAME` 后再交给 Repository 查询。
 */
@Service
@Transactional(readOnly = true)
public class InvestmentService {

  private static final Pattern OUTREACH_PLACEHOLDER_PATTERN = Pattern.compile("\\{(\\w+)\\}");
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private final AppProperties appProperties;
  private final Environment environment;
  private final InvestmentRepository investmentRepository;
  private final TenantDataSourceRegistry tenantDataSourceRegistry;

  public InvestmentService(
      AppProperties appProperties,
      Environment environment,
      InvestmentRepository investmentRepository,
      TenantDataSourceRegistry tenantDataSourceRegistry) {
    this.appProperties = appProperties;
    this.environment = environment;
    this.investmentRepository = investmentRepository;
    this.tenantDataSourceRegistry = tenantDataSourceRegistry;
  }

  public Map<String, Object> getInvestmentList(InvestmentListQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findInvestmentPage(radarJdbcTemplate(), query);
  }

  public List<Map<String, Object>> getInvestmentParkList() {
    TenantRequired.currentUser();
    return investmentRepository.findInvestmentParks(radarJdbcTemplate());
  }

  public Map<String, Object> getInvestmentDetail(int id) {
    TenantRequired.currentUser();
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "investmentId error");
    }
    return investmentRepository.findInvestmentById(radarJdbcTemplate(), id);
  }

  /** 新增招商项目主表记录；不处理图片、跟进记录或招商雷达线索转换。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createInvestment(InvestmentCreateRequest request) {
    TenantRequired.currentUser();
    return investmentRepository.createInvestment(radarJdbcTemplate(), request);
  }

  /** 更新招商项目主表字段；旧接口没有触发图片关系、跟进记录或雷达线索联动。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateInvestment(int id, InvestmentUpdateRequest request) {
    TenantRequired.currentUser();
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "investmentId error");
    }
    Map<String, Object> result = investmentRepository.updateInvestment(radarJdbcTemplate(), id, request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "招商项目不存在");
    }
    return result;
  }

  /** 兼容旧 `PUT /api/investment` 路径；旧接口把 investmentId 放在请求体中。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateInvestmentLegacy(InvestmentUpdateRequest request) {
    TenantRequired.currentUser();
    int id = positiveInteger(request == null ? null : request.investmentId(), "investmentId error");
    Map<String, Object> result = investmentRepository.updateInvestment(radarJdbcTemplate(), id, request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "招商项目不存在");
    }
    return result;
  }

  /** 删除招商项目主表记录；不处理图片关系，保持旧 Prisma delete 调用边界。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteInvestment(int id) {
    TenantRequired.currentUser();
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "investmentId error");
    }
    return investmentRepository.deleteInvestment(radarJdbcTemplate(), id);
  }

  public Map<String, Object> getLeadScoreRuleList() {
    TenantRequired.currentUser();
    return investmentRepository.findLeadScoreRules(radarJdbcTemplate());
  }

  /** 更新招商雷达评分规则，不触发规则 seed、线索重算或任何爬虫任务。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateLeadScoreRule(long ruleId, Map<String, Object> request) {
    TenantRequired.currentUser();
    validatePositiveId(ruleId, "ruleId 无效");
    Map<String, Object> result =
        investmentRepository.updateLeadScoreRule(
            radarJdbcTemplate(), ruleId, request == null ? Map.of() : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "评分规则不存在");
    }
    return result;
  }

  public Map<String, Object> getCrawlerSourceList() {
    TenantRequired.currentUser();
    return investmentRepository.findCrawlerSources(radarJdbcTemplate());
  }

  /** 更新采集源配置；仅写 crawler_source，不执行 catalog seed、启停任务或爬虫调度。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateCrawlerSource(long sourceId, CrawlerSourceUpdateRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(sourceId, "sourceId 无效");
    Map<String, Object> result =
        investmentRepository.updateCrawlerSource(
            radarJdbcTemplate(), sourceId, request == null ? emptyCrawlerSourceUpdate() : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集数据源不存在");
    }
    return result;
  }

  /** 启停采集源；不执行 catalog seed、不启动采集任务、不修改调度器状态。 */
  @Transactional(readOnly = false)
  public Map<String, Object> setCrawlerSourceEnabled(long sourceId, boolean enabled) {
    TenantRequired.currentUser();
    validatePositiveId(sourceId, "sourceId 无效");
    Map<String, Object> result =
        investmentRepository.setCrawlerSourceEnabled(radarJdbcTemplate(), sourceId, enabled);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集数据源不存在");
    }
    return result;
  }

  public Map<String, Object> getRadarSalesUserList(Integer parkId, String keyword) {
    TenantRequired.currentUser();
    return investmentRepository.findRadarSalesUsers(radarJdbcTemplate(), parkId, keyword);
  }

  public Map<String, Object> getCrawlerTaskList(
      Integer currentPage, Integer pageSize, Integer sourceId, String status) {
    TenantRequired.currentUser();
    return investmentRepository.findCrawlerTasks(
        radarJdbcTemplate(),
        PageRequestParams.normalizePage(currentPage, 1),
        radarPageSize(pageSize),
        sourceId,
        status);
  }

  public Map<String, Object> getSignalEventList(
      String companyName,
      Integer currentPage,
      String eventType,
      String keyword,
      Integer pageSize,
      String sourceName,
      String sourceType,
      String status) {
    TenantRequired.currentUser();
    return investmentRepository.findSignalEvents(
        radarJdbcTemplate(),
        PageRequestParams.normalizePage(currentPage, 1),
        radarPageSize(pageSize),
        companyName,
        eventType,
        keyword,
        sourceName,
        sourceType,
        status);
  }

  public Map<String, Object> getExternalLeadList(
      String confidenceLevel,
      Integer currentPage,
      String demandType,
      String industryName,
      String keyword,
      Integer pageSize,
      String regionCity,
      String sourceName,
      String sourceType,
      String status) {
    TenantRequired.currentUser();
    return investmentRepository.findExternalLeads(
        radarJdbcTemplate(),
        PageRequestParams.normalizePage(currentPage, 1),
        radarPageSize(pageSize),
        confidenceLevel,
        demandType,
        industryName,
        keyword,
        regionCity,
        sourceName,
        sourceType,
        status);
  }

  public Map<String, Object> getEnterpriseProfileList(
      Integer currentPage, String industryName, String keyword, Integer pageSize, String regionCity) {
    TenantRequired.currentUser();
    return investmentRepository.findEnterpriseProfiles(
        radarJdbcTemplate(),
        PageRequestParams.normalizePage(currentPage, 1),
        radarPageSize(pageSize),
        industryName,
        keyword,
        regionCity);
  }

  public Map<String, Object> getCrawlerTaskDetail(long taskId) {
    TenantRequired.currentUser();
    validatePositiveId(taskId, "taskId 无效");
    Map<String, Object> task = investmentRepository.findCrawlerTaskById(radarJdbcTemplate(), taskId);
    if (task == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集任务不存在");
    }
    return task;
  }

  public Map<String, Object> getCrawlerTaskLogs(long taskId) {
    TenantRequired.currentUser();
    validateCrawlerTaskExists(taskId);
    return investmentRepository.findCrawlerTaskLogs(radarJdbcTemplate(), taskId);
  }

  public Map<String, Object> getCrawlerTaskItems(
      long taskId, Integer currentPage, Integer pageSize, Integer sourceId, String status) {
    TenantRequired.currentUser();
    validateCrawlerTaskExists(taskId);
    return investmentRepository.findCrawlerTaskItems(
        radarJdbcTemplate(),
        taskId,
        PageRequestParams.normalizePage(currentPage, 1),
        radarPageSize(pageSize),
        sourceId,
        status);
  }

  /** 取消待执行采集任务；只写 crawler_task 和 crawler_task_log。 */
  @Transactional(readOnly = false)
  public Map<String, Object> cancelCrawlerTask(long taskId) {
    TenantRequired.currentUser();
    validatePositiveId(taskId, "taskId 无效");
    Map<String, Object> result = investmentRepository.cancelCrawlerTask(radarJdbcTemplate(), taskId);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集任务不存在");
    }
    return result;
  }

  /** 重新入队采集 URL；只写 crawler_task_item，不启动调度器或 worker。 */
  @Transactional(readOnly = false)
  public Map<String, Object> requeueCrawlerTaskItems(CrawlerTaskItemRequeueRequest request) {
    TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.requeueCrawlerTaskItems(
            radarJdbcTemplate(),
            request == null ? new CrawlerTaskItemRequeueRequest(null, null, null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "99cfw 采集数据源不存在");
    }
    return result;
  }

  /** 回收卡住的 RUNNING URL；根据重试次数切为 RETRY_WAITING 或 FAILED。 */
  @Transactional(readOnly = false)
  public Map<String, Object> reclaimStaleCrawlerTaskItems(CrawlerTaskItemReclaimRequest request) {
    TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.reclaimStaleCrawlerTaskItems(
            radarJdbcTemplate(),
            request == null ? new CrawlerTaskItemReclaimRequest(null, null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "99cfw 采集数据源不存在");
    }
    return result;
  }

  /** 创建公开机会采集任务；只执行本地公开机会到外部线索的重建逻辑，不启动外部爬虫。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createRadarCollectTask() {
    TenantRequired.currentUser();
    return investmentRepository.createRadarCollectTask(radarJdbcTemplate());
  }

  public Map<String, Object> getRadarCollectTaskDetail(String taskId) {
    TenantRequired.currentUser();
    if (!StringUtils.hasText(taskId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "taskId 无效");
    }
    Map<String, Object> task =
        investmentRepository.findRadarCollectTaskById(radarJdbcTemplate(), taskId);
    if (task == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集任务不存在");
    }
    return task;
  }

  public Map<String, Object> getSignalEventDetail(long eventId) {
    TenantRequired.currentUser();
    validatePositiveId(eventId, "eventId 无效");
    Map<String, Object> event = investmentRepository.findSignalEventById(radarJdbcTemplate(), eventId);
    if (event == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "企业信号不存在");
    }
    return event;
  }

  /** 更新企业信号状态；不触发线索转换、刷新或外部通知。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateSignalEvent(long eventId, SignalEventUpdateRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(eventId, "eventId 无效");
    Map<String, Object> result =
        investmentRepository.updateSignalEvent(
            radarJdbcTemplate(),
            eventId,
            request == null ? new SignalEventUpdateRequest(null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "企业信号不存在");
    }
    return result;
  }

  /** 企业信号转招商雷达线索；只写共享雷达库本地表，不刷新爬虫或发送外部消息。 */
  @Transactional(readOnly = false)
  public Map<String, Object> convertSignalEvent(
      long eventId, RadarLeadConvertRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(eventId, "eventId 无效");
    Map<String, Object> result =
        investmentRepository.convertSignalEventToRadarLead(
            radarJdbcTemplate(),
            eventId,
            request == null ? new RadarLeadConvertRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "企业信号不存在");
    }
    return result;
  }

  public Map<String, Object> getSignalEventEvidences(long eventId) {
    TenantRequired.currentUser();
    validatePositiveId(eventId, "eventId 无效");
    return investmentRepository.findSignalEventEvidences(radarJdbcTemplate(), eventId);
  }

  /** 从现有外部公开线索刷新企业信号；不运行爬虫 worker，不访问外部网络。 */
  @Transactional(readOnly = false)
  public Map<String, Object> refreshSignalEvents() {
    TenantRequired.currentUser();
    return investmentRepository.refreshSignalEventsFromExternalLeads(radarJdbcTemplate());
  }

  public Map<String, Object> getExternalLeadDetail(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> lead = investmentRepository.findExternalLeadById(radarJdbcTemplate(), leadId);
    if (lead == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "外部公开线索不存在");
    }
    return lead;
  }

  /** 更新外部公开线索本地状态字段；不触发转线索、画像重建或采集任务。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateExternalLead(
      long leadId, ExternalLeadUpdateRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.updateExternalLead(
            radarJdbcTemplate(),
            leadId,
            request == null ? new ExternalLeadUpdateRequest() : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "外部公开线索不存在");
    }
    return result;
  }

  /** 外部公开线索转招商雷达线索；保留旧端本地写库语义，不执行外部网络调用。 */
  @Transactional(readOnly = false)
  public Map<String, Object> convertExternalLead(
      long leadId, RadarLeadConvertRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.convertExternalLeadToRadarLead(
            radarJdbcTemplate(),
            leadId,
            request == null ? new RadarLeadConvertRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "外部公开线索不存在");
    }
    return result;
  }

  public Map<String, Object> getExternalLeadEvidences(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    return investmentRepository.findExternalLeadEvidences(radarJdbcTemplate(), leadId);
  }

  public Map<String, Object> getEnterpriseProfileDetail(long profileId) {
    TenantRequired.currentUser();
    validatePositiveId(profileId, "profileId 无效");
    Map<String, Object> profile =
        investmentRepository.findEnterpriseProfileById(radarJdbcTemplate(), profileId);
    if (profile == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "企业画像不存在");
    }
    return profile;
  }

  public Map<String, Object> getEnterpriseProfileSignals(long profileId) {
    TenantRequired.currentUser();
    validateEnterpriseProfileExists(profileId);
    return investmentRepository.findEnterpriseProfileSignals(radarJdbcTemplate(), profileId);
  }

  public Map<String, Object> getEnterpriseProfileTags(long profileId) {
    TenantRequired.currentUser();
    validateEnterpriseProfileExists(profileId);
    return investmentRepository.findEnterpriseProfileTags(radarJdbcTemplate(), profileId);
  }

  /** 从现有信号刷新企业画像；不触发第三方查询或公开机会抓取。 */
  @Transactional(readOnly = false)
  public Map<String, Object> refreshEnterpriseProfiles() {
    TenantRequired.currentUser();
    return investmentRepository.refreshEnterpriseProfilesFromSignals(radarJdbcTemplate());
  }

  public Map<String, Object> getPublicOpportunityEffectiveList(PublicOpportunityQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findPublicOpportunityEffectiveList(radarJdbcTemplate(), query);
  }

  public Map<String, Object> getPublicOpportunityEffectiveOptions(PublicOpportunityQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findPublicOpportunityEffectiveOptions(radarJdbcTemplate(), query);
  }

  public Map<String, Object> getPublicOpportunityEffectiveStats(PublicOpportunityQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findPublicOpportunityEffectiveStats(radarJdbcTemplate(), query);
  }

  public Map<String, Object> getPublicOpportunityEffectiveProgress(String opportunityType) {
    TenantRequired.currentUser();
    return investmentRepository.findPublicOpportunityEffectiveProgress(
        radarJdbcTemplate(), opportunityType);
  }

  public Map<String, Object> getPublicOpportunityAuditSummary(String refresh) {
    TenantRequired.currentUser();
    return investmentRepository.findPublicOpportunityAuditSummary(radarJdbcTemplate(), refresh);
  }

  public Map<String, Object> getPublicOpportunityAuditPreview() {
    TenantRequired.currentUser();
    return investmentRepository.findPublicOpportunityAuditPreview(radarJdbcTemplate());
  }

  /** 手工录入公开机会；保持本地写库边界，不执行公开爬虫和线索生成。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createManualPublicOpportunity(PublicOpportunityManualRequest request) {
    TenantRequired.currentUser();
    if (request == null || !StringUtils.hasText(request.title())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "标题不能为空");
    }
    return investmentRepository.upsertManualPublicOpportunity(radarJdbcTemplate(), request);
  }

  /** 导入公开机会 URL；只生成待采集任务项，不调用旧端 adapter 执行抓取。 */
  @Transactional(readOnly = false)
  public Map<String, Object> importPublicOpportunityUrls(PublicOpportunityImportUrlsRequest request) {
    TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.importPublicOpportunityUrls(
            radarJdbcTemplate(),
            request == null ? new PublicOpportunityImportUrlsRequest(null, null, null, null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集平台不存在或未注册适配器");
    }
    return result;
  }

  /** 手工解析公开需求页 HTML；只解析请求体，不访问 sourceUrl，不启动 crawler。 */
  @Transactional(readOnly = false)
  public Map<String, Object> parsePublicOpportunityDemandPage(
      PublicOpportunityParseDemandPageRequest request) {
    TenantRequired.currentUser();
    return investmentRepository.parsePublicOpportunityDemandPage(
        radarJdbcTemplate(),
        request == null
            ? new PublicOpportunityParseDemandPageRequest(null, null, null, null)
            : request);
  }

  /** 清洗公开机会历史状态；dryRun 默认 true，显式传 false 才会落库。 */
  @Transactional(readOnly = false)
  public Map<String, Object> repairPublicOpportunityHistory(PublicOpportunityRepairRequest request) {
    TenantRequired.currentUser();
    return investmentRepository.repairPublicOpportunityHistory(
        radarJdbcTemplate(), request == null ? new PublicOpportunityRepairRequest(null, null) : request);
  }

  /** 从本地公开机会池重建外部线索；不执行爬虫、HTTP 抓取或默认 seed。 */
  @Transactional(readOnly = false)
  public Map<String, Object> rebuildExternalLeadsFromPublicOpportunity() {
    TenantRequired.currentUser();
    return investmentRepository.rebuildExternalLeadsFromPublicOpportunity(radarJdbcTemplate());
  }

  public Map<String, Object> getPublicOpportunityDetail(long opportunityId) {
    TenantRequired.currentUser();
    validatePositiveId(opportunityId, "opportunityId 无效");
    Map<String, Object> opportunity =
        investmentRepository.findPublicOpportunityById(radarJdbcTemplate(), opportunityId);
    if (opportunity == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "公开机会不存在");
    }
    return opportunity;
  }

  public Map<String, Object> getOutreachTemplateList(OutreachTemplateQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findOutreachTemplates(radarJdbcTemplate(), query);
  }

  public Map<String, Object> getOutreachTemplateStats() {
    TenantRequired.currentUser();
    return investmentRepository.findOutreachTemplateStats(radarJdbcTemplate());
  }

  public Map<String, Object> getOutreachTemplateVersions(long templateId) {
    TenantRequired.currentUser();
    validatePositiveId(templateId, "templateId 无效");
    return investmentRepository.findOutreachTemplateVersions(radarJdbcTemplate(), templateId);
  }

  /** 预览触达模板填充结果；不依赖雷达库表结构，也不产生发送/写库副作用。 */
  public Map<String, Object> previewOutreachTemplate(OutreachTemplatePreviewRequest request) {
    TenantRequired.currentUser();
    String content = request == null || request.content() == null ? "" : request.content().trim();
    if (!StringUtils.hasText(content)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "content 不能为空");
    }

    List<String> placeholders = parsePlaceholderJson(request.placeholderJson());
    Set<String> usedPlaceholders = resolveUsedPlaceholders(content);
    List<String> missingPlaceholders =
        usedPlaceholders.stream().filter(item -> !placeholders.contains(item)).toList();
    Map<String, String> sampleData = new LinkedHashMap<>();
    sampleData.put("companyName", "测试企业");
    sampleData.put("intentArea", "3000m²");
    sampleData.put("parkName", "测试园区");
    if (request.sampleData() != null) {
      sampleData.putAll(request.sampleData());
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("content", fillOutreachTemplateContent(content, sampleData));
    result.put("missingPlaceholders", missingPlaceholders);
    result.put("placeholders", placeholders);
    result.put("usedPlaceholders", List.copyOf(usedPlaceholders));
    return result;
  }

  /** 创建触达模板；不执行旧端默认模板 seed 或表结构变更。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createOutreachTemplate(OutreachTemplateSaveRequest request) {
    TenantRequired.currentUser();
    return investmentRepository.createOutreachTemplate(
        radarJdbcTemplate(), request == null ? emptyOutreachTemplateSave() : request);
  }

  /** 更新触达模板；更新后按旧端语义重置为待审批且禁用。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateOutreachTemplate(long templateId, OutreachTemplateSaveRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(templateId, "templateId 无效");
    Map<String, Object> result =
        investmentRepository.updateOutreachTemplate(
            radarJdbcTemplate(), templateId, request == null ? emptyOutreachTemplateSave() : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达模板不存在");
    }
    return result;
  }

  /** 提交触达模板审批；只写本地审批状态和版本快照。 */
  @Transactional(readOnly = false)
  public Map<String, Object> submitOutreachTemplateApproval(long templateId) {
    TenantRequired.currentUser();
    validatePositiveId(templateId, "templateId 无效");
    Map<String, Object> result =
        investmentRepository.submitOutreachTemplateApproval(radarJdbcTemplate(), templateId);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达模板不存在");
    }
    return result;
  }

  /** 审批触达模板；当前仅支持旧端 APPROVED/REJECTED 两种状态流转。 */
  @Transactional(readOnly = false)
  public Map<String, Object> setOutreachTemplateApproval(long templateId, String approvalStatus) {
    TenantRequired.currentUser();
    validatePositiveId(templateId, "templateId 无效");
    Map<String, Object> result =
        investmentRepository.setOutreachTemplateApproval(
            radarJdbcTemplate(), templateId, approvalStatus);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达模板不存在");
    }
    return result;
  }

  /** 启停触达模板；不创建触达任务、不发送外部消息。 */
  @Transactional(readOnly = false)
  public Map<String, Object> setOutreachTemplateEnabled(long templateId, boolean enabled) {
    TenantRequired.currentUser();
    validatePositiveId(templateId, "templateId 无效");
    Map<String, Object> result =
        investmentRepository.setOutreachTemplateEnabled(radarJdbcTemplate(), templateId, enabled);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达模板不存在");
    }
    return result;
  }

  public Map<String, Object> getOutreachTaskList(OutreachTaskQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findOutreachTasks(radarJdbcTemplate(), query);
  }

  public Map<String, Object> getOutreachTaskDetail(long taskId) {
    TenantRequired.currentUser();
    validatePositiveId(taskId, "taskId 无效");
    Map<String, Object> task = investmentRepository.findOutreachTaskById(radarJdbcTemplate(), taskId);
    if (task == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达任务不存在");
    }
    return task;
  }

  /** 创建本地触达任务；只写 PENDING 任务，不调用短信、企微或 RabbitMQ 发送。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createOutreachTask(OutreachTaskCreateRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.createOutreachTask(
            radarJdbcTemplate(),
            user.id(),
            request == null ? new OutreachTaskCreateRequest(null, null, null, null, null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  /** 取消待执行触达任务；不调用短信、企微或其他发送通道。 */
  @Transactional(readOnly = false)
  public Map<String, Object> cancelOutreachTask(long taskId) {
    TenantRequired.currentUser();
    validatePositiveId(taskId, "taskId 无效");
    Map<String, Object> result = investmentRepository.cancelOutreachTask(radarJdbcTemplate(), taskId);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达任务不存在");
    }
    return result;
  }

  /** 发送触达任务；当前只写本地发送状态，真实供应商投递留到 RabbitMQ/通道专项批次。 */
  @Transactional(readOnly = false)
  public Map<String, Object> sendOutreachTask(long taskId) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(taskId, "taskId 无效");
    Map<String, Object> result = investmentRepository.sendOutreachTask(radarJdbcTemplate(), taskId, user.id());
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达任务不存在");
    }
    return result;
  }

  /** 记录触达回复；只写本地任务、线索阶段和必要的触达限制。 */
  @Transactional(readOnly = false)
  public Map<String, Object> replyOutreachTask(
      long taskId, OutreachTaskReplyRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(taskId, "taskId 无效");
    Map<String, Object> result =
        investmentRepository.replyOutreachTask(
            radarJdbcTemplate(),
            taskId,
            user.id(),
            user.username(),
            request == null ? new OutreachTaskReplyRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达任务不存在");
    }
    return result;
  }

  public Map<String, Object> getRadarAnalysisSummary() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarAnalysisSummary(radarJdbcTemplate());
  }

  public Map<String, Object> getRadarAcquisitionAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarAcquisitionAnalytics(radarJdbcTemplate());
  }

  public List<Map<String, Object>> getRadarChannelAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarChannelAnalytics(radarJdbcTemplate());
  }

  public List<Map<String, Object>> getRadarTemplateAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarTemplateAnalytics(radarJdbcTemplate());
  }

  public List<Map<String, Object>> getRadarSalesAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarSalesAnalytics(radarJdbcTemplate());
  }

  public Map<String, Object> getRadarSalesFunnelAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarSalesFunnelAnalytics(radarJdbcTemplate());
  }

  public List<Map<String, Object>> getRadarRoiAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarRoiAnalytics(radarJdbcTemplate());
  }

  public List<Map<String, Object>> getRadarTemplateConversionAnalytics() {
    TenantRequired.currentUser();
    return investmentRepository.findRadarTemplateConversionAnalytics(radarJdbcTemplate());
  }

  public Map<String, Object> getCrawlerTaskOpsSummary(Integer sourceId, String sourceCode) {
    TenantRequired.currentUser();
    return investmentRepository.findCrawlerOpsSummary(radarJdbcTemplate(), sourceId, sourceCode);
  }

  public Map<String, Object> getCrawlerTaskHealth() {
    TenantRequired.currentUser();
    return investmentRepository.findPublicCrawlerHealth(radarJdbcTemplate());
  }

  public Map<String, Object> getCrawlerTaskAuditList(RadarOperationAuditQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findRadarOperationAudits(radarJdbcTemplate(), query);
  }

  /** 标记公开机会采集调度启动；真实调度后续由 XXL-Job 专项接管。 */
  @Transactional(readOnly = false)
  public Map<String, Object> startCrawlerTaskScheduler() {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.startCrawlerTaskScheduler(radarJdbcTemplate(), user.id(), user.username());
  }

  /** 标记公开机会采集调度停止；不取消历史任务，不干预后续 worker。 */
  @Transactional(readOnly = false)
  public Map<String, Object> stopCrawlerTaskScheduler() {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.stopCrawlerTaskScheduler(radarJdbcTemplate(), user.id(), user.username());
  }

  public Map<String, Object> getCrawlerTaskSchedulerStatus() {
    TenantRequired.currentUser();
    return investmentRepository.crawlerSchedulerStatus();
  }

  /** 兼容旧通用采集运行入口；当前只创建本地任务，不执行真实抓取。 */
  @Transactional(readOnly = false)
  public Map<String, Object> runCrawlerTask(PublicOpportunityCrawlerRunRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.createPublicOpportunityCrawlerTask(
            radarJdbcTemplate(),
            request == null
                ? new PublicOpportunityCrawlerRunRequest(null, null, null, null, null, null, null, null, null, null, null)
                : request,
            user.id(),
            user.username(),
            "/api/investment/radar/crawler-task/run");
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "公开机会采集数据源不存在");
    }
    return result;
  }

  /** 创建指定内置采集源的本地 PENDING 任务，真实执行后续由 XXL-Job/Kafka worker 承接。 */
  @Transactional(readOnly = false)
  public Map<String, Object> runNamedCrawlerTask(String crawlerCode) {
    UserTokenPayload user = TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.createNamedCrawlerTask(
            radarJdbcTemplate(), crawlerCode, user.id(), user.username());
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集数据源不存在");
    }
    return result;
  }

  /** 扫描本地租户合同到期数据并派生雷达线索；不加载旧爬虫 adapter 或访问外部网络。 */
  @Transactional(readOnly = false)
  public Map<String, Object> syncInternalContractExpiryToRadar() {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.syncInternalContractExpiryToRadar(
        radarJdbcTemplate(), authorizedParkIds(user), user.id(), user.username());
  }

  /** 创建公开机会 URL 采集任务；只写 crawler_task 和审计日志，不联网抓取。 */
  @Transactional(readOnly = false)
  public Map<String, Object> runPublicOpportunityCrawlerTask(PublicOpportunityCrawlerRunRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    Map<String, Object> result =
        investmentRepository.createPublicOpportunityCrawlerTask(
            radarJdbcTemplate(),
            request == null
                ? new PublicOpportunityCrawlerRunRequest(null, null, null, null, null, null, null, null, null, null, null)
                : request,
            user.id(),
            user.username(),
            "/api/investment/radar/crawler-task/run-public-opportunity");
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "公开机会采集数据源不存在");
    }
    return result;
  }

  /** 创建公开机会批量采集任务；按平台拆成本地任务，不并发调用旧爬虫。 */
  @Transactional(readOnly = false)
  public Map<String, Object> runPublicOpportunityCrawlerBatch(PublicOpportunityBatchRunRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.createPublicOpportunityCrawlerBatch(
        radarJdbcTemplate(),
        request == null
            ? new PublicOpportunityBatchRunRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null)
            : request,
        user.id(),
        user.username());
  }

  public Map<String, Object> getRadarLeadList(RadarLeadQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findRadarLeads(radarJdbcTemplate(), query);
  }

  public Map<String, Object> getRadarLeadDetail(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> lead = investmentRepository.findRadarLeadById(radarJdbcTemplate(), leadId);
    if (lead == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return lead;
  }

  /** JSON 数组导入招商雷达线索；文件上传解析留给 `lead/import-file` 专项批次。 */
  @Transactional(readOnly = false)
  public Map<String, Object> importRadarLeads(Object request) {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.importRadarLeads(
        radarJdbcTemplate(), normalizeContactRestrictionImportItems(request), user.id(), user.username());
  }

  /**
   * 上传文件导入招商雷达线索。
   *
   * <p>旧 Nitro 对文件内容只支持 JSON 或分隔文本；这里继续保持同等边界，并额外兼容常见 GBK CSV。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> importRadarLeadsFile(MultipartFile file) {
    UserTokenPayload user = TenantRequired.currentUser();
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请上传导入文件");
    }
    String filename = StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "leads.csv";
    List<Map<String, Object>> items = parseRadarLeadImportFile(filename, readFileBytes(file));
    return investmentRepository.importRadarLeads(radarJdbcTemplate(), items, user.id(), user.username());
  }

  public Map<String, Object> getRadarLeadScoreBreakdown(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    return investmentRepository.findRadarLeadScoreBreakdown(radarJdbcTemplate(), leadId);
  }

  /** 重算招商雷达线索评分；不触发旧端信号刷新、爬虫采集或默认规则 seed。 */
  @Transactional(readOnly = false)
  public Map<String, Object> recalculateRadarLeadScore(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.recalculateRadarLeadScore(radarJdbcTemplate(), leadId);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  /** 批量重算线索评分；沿用第 72 批单线索算法，不做信号刷新或默认规则 seed。 */
  @Transactional(readOnly = false)
  public Map<String, Object> recalculateRadarLeadScores() {
    TenantRequired.currentUser();
    return investmentRepository.recalculateRadarLeadScores(radarJdbcTemplate());
  }

  public List<Map<String, Object>> getRadarLeadPropertyMatch(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    List<Map<String, Object>> matches =
        investmentRepository.findRadarLeadPropertyMatches(radarJdbcTemplate(), leadId);
    if (matches == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return matches;
  }

  /** 重建单条线索房源匹配快照；基于本地房源楼层和标签数据，不调用外部推荐服务。 */
  @Transactional(readOnly = false)
  public Map<String, Object> rebuildRadarLeadPropertyMatch(long leadId) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.rebuildRadarLeadPropertyMatch(
            radarJdbcTemplate(), leadId, authorizedParkIds(user));
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  /** 批量重建线索房源匹配快照；限制单次数量，真实全量重建后续交给 XXL-Job。 */
  @Transactional(readOnly = false)
  public Map<String, Object> rebuildRadarLeadPropertyMatchBatch(Map<String, Object> request) {
    TenantRequired.currentUser();
    Object limit = request == null ? null : request.get("limit");
    return investmentRepository.rebuildRadarLeadPropertyMatchBatch(radarJdbcTemplate(), limit);
  }

  /** 串联本地信号、画像、评分和轻量任务派生；不启动爬虫或外部触达。 */
  @Transactional(readOnly = false)
  public Map<String, Object> rebuildRadarAcquisitionPipeline() {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.rebuildRadarAcquisitionPipeline(
        radarJdbcTemplate(), user.id(), user.username());
  }

  /** 更新房源标签；仅同步已有匹配快照，不触发房源匹配重建。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateRadarPropertyTags(
      long factoryId, PropertyTagUpdateRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(factoryId, "propertyId 无效");
    Map<String, Object> result =
        investmentRepository.updateRadarPropertyTags(
            radarJdbcTemplate(), factoryId, user.id(), request == null ? new PropertyTagUpdateRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "房源不存在");
    }
    return result;
  }

  /** 手动分配招商雷达线索负责人，只写本地线索表和分配日志。 */
  @Transactional(readOnly = false)
  public Map<String, Object> assignRadarLeadOwner(
      long leadId, RadarLeadAssignOwnerRequest request) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.assignRadarLeadOwner(
            radarJdbcTemplate(),
            leadId,
            request == null ? new RadarLeadAssignOwnerRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  /** 新增线索跟进记录；本地推进线索阶段，必要时写触达限制。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createRadarLeadFollow(
      long leadId, RadarLeadFollowRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.createRadarLeadFollow(
            radarJdbcTemplate(),
            leadId,
            user.id(),
            user.username(),
            request == null ? new RadarLeadFollowRequest(null, null, null, null, null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  /** 关闭线索为成交或失效；只写本地线索、跟进记录、待办和未执行触达。 */
  @Transactional(readOnly = false)
  public Map<String, Object> closeRadarLead(long leadId, RadarLeadCloseRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.closeRadarLead(
            radarJdbcTemplate(),
            leadId,
            user.id(),
            request == null ? new RadarLeadCloseRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  /** 新增带看预约并推进线索阶段；不触发通知或房源匹配重建。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createRadarLeadVisit(long leadId, RadarLeadVisitRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> result =
        investmentRepository.createRadarLeadVisit(
            radarJdbcTemplate(), leadId, user.id(), request == null ? emptyRadarLeadVisit() : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return result;
  }

  public Map<String, Object> getRadarSopReminderList(
      RadarLeadQuery query, String reminderStatus, String reminderType) {
    TenantRequired.currentUser();
    return investmentRepository.findRadarSopReminders(
        radarJdbcTemplate(), query, reminderStatus, reminderType);
  }

  public Map<String, Object> getRadarLeadSop(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> sop = investmentRepository.findRadarLeadSop(radarJdbcTemplate(), leadId);
    if (sop == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return sop;
  }

  /** 完成 SOP 提醒，只写提醒状态和处理时间。 */
  @Transactional(readOnly = false)
  public Map<String, Object> completeRadarSopReminder(long reminderId) {
    TenantRequired.currentUser();
    validatePositiveId(reminderId, "reminderId 无效");
    Map<String, Object> result =
        investmentRepository.completeRadarSopReminder(radarJdbcTemplate(), reminderId);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "提醒不存在");
    }
    return result;
  }

  /** 完成带看记录并写入反馈；不触发外部通知或自动成交。 */
  @Transactional(readOnly = false)
  public Map<String, Object> completeRadarVisitRecord(
      long visitId, RadarVisitCompleteRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(visitId, "visitId 无效");
    Map<String, Object> result =
        investmentRepository.completeRadarVisitRecord(
            radarJdbcTemplate(),
            visitId,
            user.id(),
            request == null ? new RadarVisitCompleteRequest(null, null) : request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "带看记录不存在");
    }
    return result;
  }

  public Map<String, Object> getRadarLeadOutreachSuggestion(long leadId) {
    TenantRequired.currentUser();
    validatePositiveId(leadId, "leadId 无效");
    Map<String, Object> suggestion =
        investmentRepository.findRadarLeadOutreachSuggestion(radarJdbcTemplate(), leadId);
    if (suggestion == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "线索不存在");
    }
    return suggestion;
  }

  public Map<String, Object> getContactRestrictionList(ContactRestrictionQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findContactRestrictions(radarJdbcTemplate(), query);
  }

  public Map<String, Object> exportContactRestrictions(
      String keyword, String restrictionType, String status) {
    TenantRequired.currentUser();
    return investmentRepository.exportContactRestrictions(
        radarJdbcTemplate(), keyword, restrictionType, status);
  }

  public String exportContactRestrictionsCsv(Map<String, Object> result) {
    return investmentRepository.contactRestrictionsCsv(result);
  }

  public Map<String, Object> getContactRestrictionAuditList(ContactRestrictionAuditQuery query) {
    TenantRequired.currentUser();
    return investmentRepository.findContactRestrictionAudits(radarJdbcTemplate(), query);
  }

  /** 批量导入触达限制名单；逐行校验并记录本地审计，不触发外部通知。 */
  @Transactional(readOnly = false)
  public Map<String, Object> importContactRestrictions(Object request) {
    UserTokenPayload user = TenantRequired.currentUser();
    return investmentRepository.importContactRestrictions(
        radarJdbcTemplate(), user.id(), user.username(), normalizeContactRestrictionImportItems(request));
  }

  /** 提交触达限制解除申请；保留旧端状态语义，不执行自动 ALTER 或外部通知。 */
  @Transactional(readOnly = false)
  public Map<String, Object> submitContactRestrictionRelease(
      long restrictionId, ContactRestrictionReleaseRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(restrictionId, "restrictionId 无效");
    Map<String, Object> result =
        investmentRepository.submitContactRestrictionRelease(
            radarJdbcTemplate(), restrictionId, user.id(), user.username(), request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达限制记录不存在");
    }
    return result;
  }

  /** 审批通过触达限制解除申请；只更新本地限制记录和审计日志。 */
  @Transactional(readOnly = false)
  public Map<String, Object> approveContactRestrictionRelease(
      long restrictionId, ContactRestrictionReleaseRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(restrictionId, "restrictionId 无效");
    Map<String, Object> result =
        investmentRepository.approveContactRestrictionRelease(
            radarJdbcTemplate(), restrictionId, user.id(), user.username(), request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达限制记录不存在");
    }
    return result;
  }

  /** 驳回触达限制解除申请；只写 release_status 和审计日志。 */
  @Transactional(readOnly = false)
  public Map<String, Object> rejectContactRestrictionRelease(
      long restrictionId, ContactRestrictionReleaseRequest request) {
    UserTokenPayload user = TenantRequired.currentUser();
    validatePositiveId(restrictionId, "restrictionId 无效");
    Map<String, Object> result =
        investmentRepository.rejectContactRestrictionRelease(
            radarJdbcTemplate(), restrictionId, user.id(), user.username(), request);
    if (result == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "触达限制记录不存在");
    }
    return result;
  }

  /**
   * 复刻旧 `runWithRadarSharedScope` 的共享库选择逻辑。
   *
   * <p>招商雷达数据可独立放在指定客户库或指定 dbName 中；未配置时回落到默认客户空间。
   */
  private JdbcTemplate radarJdbcTemplate() {
    String customerId =
        firstText(
            setting("INVESTMENT_RADAR_CUSTOMER_ID"),
            setting("DEFAULT_CUSTOMER_ID"),
            appProperties.getDefaultCustomerId(),
            "default");
    String dbName = firstText(setting("INVESTMENT_RADAR_DB_NAME"));
    return new JdbcTemplate(tenantDataSourceRegistry.getDataSource(customerId, dbName));
  }

  private String setting(String name) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return value;
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return null;
  }

  private int radarPageSize(Integer pageSize) {
    return PageRequestParams.normalizeInt(pageSize, 20, 1, 100);
  }

  private void validateCrawlerTaskExists(long taskId) {
    validatePositiveId(taskId, "taskId 无效");
    if (investmentRepository.findCrawlerTaskById(radarJdbcTemplate(), taskId) == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "采集任务不存在");
    }
  }

  private void validateEnterpriseProfileExists(long profileId) {
    validatePositiveId(profileId, "profileId 无效");
    if (investmentRepository.findEnterpriseProfileById(radarJdbcTemplate(), profileId) == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "企业画像不存在");
    }
  }

  private void validatePositiveId(long id, String message) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private int positiveInteger(Object value, String message) {
    if (value instanceof Number number) {
      int parsed = number.intValue();
      if (parsed > 0) {
        return parsed;
      }
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    try {
      int parsed = Integer.parseInt(String.valueOf(value == null ? "" : value).trim());
      if (parsed > 0) {
        return parsed;
      }
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private List<Map<String, Object>> normalizeContactRestrictionImportItems(Object request) {
    if (request instanceof List<?> list) {
      return castMapList(list);
    }
    if (request instanceof Map<?, ?> map && map.get("items") instanceof List<?> list) {
      return castMapList(list);
    }
    throw new BusinessException(HttpStatus.BAD_REQUEST, "导入内容必须是数组 JSON");
  }

  private byte[] readFileBytes(MultipartFile file) {
    try {
      return file.getBytes();
    } catch (IOException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "导入文件读取失败");
    }
  }

  private List<Map<String, Object>> parseRadarLeadImportFile(String filename, byte[] data) {
    String normalizedFilename = filename == null ? "" : filename.trim().toLowerCase();
    if (normalizedFilename.endsWith(".xls") || normalizedFilename.endsWith(".xlsx")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "当前迁移接口支持 JSON/CSV/TSV 文件，请先另存为 CSV 后上传");
    }
    String text = decodeImportText(data).trim();
    if (!StringUtils.hasText(text)) {
      return List.of();
    }
    if (normalizedFilename.endsWith(".json") || text.startsWith("[") || text.startsWith("{")) {
      try {
        return normalizeContactRestrictionImportItems(OBJECT_MAPPER.readValue(text, Object.class));
      } catch (IOException error) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "JSON 文件必须是数组或 { items: [] }");
      }
    }
    return parseDelimitedImportText(text);
  }

  private String decodeImportText(byte[] data) {
    String text = new String(data == null ? new byte[0] : data, StandardCharsets.UTF_8);
    if (text.indexOf('\uFFFD') >= 0) {
      text = new String(data, Charset.forName("GBK"));
    }
    return text.replaceFirst("^\\uFEFF", "");
  }

  private List<Map<String, Object>> parseDelimitedImportText(String text) {
    List<String> lines =
        java.util.Arrays.stream(text.split("\\R"))
            .map(String::trim)
            .filter(StringUtils::hasText)
            .toList();
    if (lines.isEmpty()) {
      return List.of();
    }
    String separator =
        countChar(lines.get(0), '\t') > countChar(lines.get(0), ',') ? "\t" : ",";
    List<String> headers =
        parseDelimitedLine(lines.get(0), separator.charAt(0)).stream()
            .map(String::trim)
            .toList();
    List<Map<String, Object>> items = new java.util.ArrayList<>();
    for (String line : lines.subList(1, lines.size())) {
      List<String> values = parseDelimitedLine(line, separator.charAt(0));
      Map<String, Object> item = new LinkedHashMap<>();
      for (int index = 0; index < headers.size(); index++) {
        String header = headers.get(index);
        if (StringUtils.hasText(header)) {
          item.put(header, index < values.size() ? values.get(index) : "");
        }
      }
      items.add(item);
    }
    return items;
  }

  private List<String> parseDelimitedLine(String line, char separator) {
    List<String> cells = new java.util.ArrayList<>();
    StringBuilder current = new StringBuilder();
    boolean quoted = false;
    for (int index = 0; index < line.length(); index++) {
      char currentChar = line.charAt(index);
      char nextChar = index + 1 < line.length() ? line.charAt(index + 1) : '\0';
      if (currentChar == '"' && quoted && nextChar == '"') {
        current.append('"');
        index++;
        continue;
      }
      if (currentChar == '"') {
        quoted = !quoted;
        continue;
      }
      if (currentChar == separator && !quoted) {
        cells.add(current.toString().trim());
        current.setLength(0);
        continue;
      }
      current.append(currentChar);
    }
    cells.add(current.toString().trim());
    return cells;
  }

  private long countChar(String value, char target) {
    return value == null ? 0 : value.chars().filter(current -> current == target).count();
  }

  private List<Map<String, Object>> castMapList(List<?> list) {
    List<Map<String, Object>> items = new java.util.ArrayList<>();
    for (Object item : list) {
      if (!(item instanceof Map<?, ?> map)) {
        items.add(Map.of());
        continue;
      }
      Map<String, Object> converted = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        converted.put(String.valueOf(entry.getKey()), entry.getValue());
      }
      items.add(converted);
    }
    return items;
  }

  private CrawlerSourceUpdateRequest emptyCrawlerSourceUpdate() {
    return new CrawlerSourceUpdateRequest(null, null, null, null, null, null, null, null, null);
  }

  private OutreachTemplateSaveRequest emptyOutreachTemplateSave() {
    return new OutreachTemplateSaveRequest(null, null, null, null, null, null, null);
  }

  private RadarLeadVisitRequest emptyRadarLeadVisit() {
    return new RadarLeadVisitRequest(null, null, null, null, null);
  }

  private List<String> parsePlaceholderJson(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(this::normalizeTemplateText).filter(StringUtils::hasText).toList();
    }
    String text = normalizeTemplateText(value);
    if (!StringUtils.hasText(text)) {
      return List.of();
    }
    if (text.startsWith("[") && text.endsWith("]")) {
      String inner = text.substring(1, text.length() - 1).trim();
      if (!StringUtils.hasText(inner)) {
        return List.of();
      }
      return java.util.Arrays.stream(inner.split(","))
          .map(item -> item.replace("\"", "").replace("'", ""))
          .map(this::normalizeTemplateText)
          .filter(StringUtils::hasText)
          .toList();
    }
    return List.of();
  }

  private Set<String> resolveUsedPlaceholders(String content) {
    Set<String> used = new LinkedHashSet<>();
    Matcher matcher = OUTREACH_PLACEHOLDER_PATTERN.matcher(content);
    while (matcher.find()) {
      String key = normalizeTemplateText(matcher.group(1));
      if (StringUtils.hasText(key)) {
        used.add(key);
      }
    }
    return used;
  }

  private String fillOutreachTemplateContent(String content, Map<String, String> data) {
    Matcher matcher = OUTREACH_PLACEHOLDER_PATTERN.matcher(content);
    StringBuffer buffer = new StringBuffer();
    while (matcher.find()) {
      String replacement = data.getOrDefault(matcher.group(1), "-");
      matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
    }
    matcher.appendTail(buffer);
    return buffer.toString();
  }

  private String normalizeTemplateText(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private List<Integer> authorizedParkIds(UserTokenPayload user) {
    if (user == null || user.parks() == null) {
      return List.of();
    }
    return user.parks().stream()
        .map(park -> park == null ? null : park.get("parkId"))
        .map(this::integerOrNull)
        .filter(value -> value != null && value > 0)
        .distinct()
        .toList();
  }

  private Integer integerOrNull(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }
}
