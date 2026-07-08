package cn.yizuw.magic.backend.investment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import cn.yizuw.magic.backend.common.BusinessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/**
 * 招商和招商雷达只读数据访问层。
 *
 * <p>共享雷达库在迁移期仍可能存在表结构漂移，因此本层先通过 `information_schema.columns` 检测字段，
 * 缺表时返回空列表或 null，避免只读接口在灰度环境直接 500。
 */
@Repository
public class InvestmentRepository {

  private static final Set<String> CRAWLER_READY_SOURCE_CODES =
      Set.of(
          "INTERNAL_CONTRACT_EXPIRY",
          "PUBLIC_EIA_NOTICE_MEE_CANDIDATE",
          "PUBLIC_RECRUITMENT_51JOB_CANDIDATE",
          "PUBLIC_TENDER_CCGP_CANDIDATE",
          "PUBLIC_OPPORTUNITY_99CFW",
          "PUBLIC_FACTORY_LISTING_CFZSW68",
          "PUBLIC_FACTORY_LISTING_99CFW_DG",
          "PUBLIC_FACTORY_LISTING_TOODC_DG",
          "PUBLIC_FACTORY_LISTING_SZAQFDC_DG",
          "PUBLIC_FACTORY_LISTING_FANG_DG",
          "PUBLIC_FACTORY_LISTING_TZGD_GD",
          "PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD",
          "PUBLIC_FACTORY_LISTING_GDCFZS_GD",
          "PUBLIC_FACTORY_LISTING_SZCFW_GD",
          "PUBLIC_FACTORY_LISTING_SZKKW_GD",
          "PUBLIC_FACTORY_LISTING_HFDPT_GD",
          "PUBLIC_FACTORY_LISTING_CHANGFANG88_GD",
          "PUBLIC_FACTORY_LISTING_YSOL_GD",
          "PUBLIC_FACTORY_LISTING_99CFW_GD",
          "PUBLIC_FACTORY_LISTING_TOODC_GD",
          "PUBLIC_FACTORY_LISTING_FANG_GD",
          "PUBLIC_DEMAND_99CFW_GD",
          "PUBLIC_DEMAND_ZHAOSHANG_NET_GD");

  private static final Set<String> PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES =
      Set.of(
          "PUBLIC_OPPORTUNITY_99CFW",
          "PUBLIC_FACTORY_LISTING_CFZSW68",
          "PUBLIC_FACTORY_LISTING_99CFW_DG",
          "PUBLIC_FACTORY_LISTING_TOODC_DG",
          "PUBLIC_FACTORY_LISTING_SZAQFDC_DG",
          "PUBLIC_FACTORY_LISTING_FANG_DG",
          "PUBLIC_FACTORY_LISTING_TZGD_GD",
          "PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD",
          "PUBLIC_FACTORY_LISTING_GDCFZS_GD",
          "PUBLIC_FACTORY_LISTING_SZCFW_GD",
          "PUBLIC_FACTORY_LISTING_SZKKW_GD",
          "PUBLIC_FACTORY_LISTING_HFDPT_GD",
          "PUBLIC_FACTORY_LISTING_CHANGFANG88_GD",
          "PUBLIC_FACTORY_LISTING_YSOL_GD",
          "PUBLIC_FACTORY_LISTING_99CFW_GD",
          "PUBLIC_FACTORY_LISTING_TOODC_GD",
          "PUBLIC_FACTORY_LISTING_FANG_GD",
          "PUBLIC_DEMAND_99CFW_GD",
          "PUBLIC_DEMAND_ZHAOSHANG_NET_GD");

  private static final String PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE = "PUBLIC_OPPORTUNITY_99CFW";
  private static final List<String> PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS =
      List.of("/changfangxuqiu/", "/xuqiu/");
  private static final String PUBLIC_FACTORY_CFZSW68_SOURCE_CODE = "PUBLIC_FACTORY_LISTING_CFZSW68";
  private static final List<String> PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS =
      List.of("/sz/cfcz/", "/dg/cfcz/", "/gz/cfcz/", "/fs/cfcz/", "/zs/cfcz/", "/jm/cfcz/");
  private static final String PUBLIC_OPPORTUNITY_CRAWLER_SCHEDULER_VERSION =
      "public-crawler-daily-8-demand-v1";
  private static final int PUBLIC_OPPORTUNITY_AUDIT_PREVIEW_LIMIT = 50;

  private static final Set<String> RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES =
      Set.of(
          "PUBLIC_DEMAND_021CF_GD",
          "PUBLIC_DEMAND_CFZX_GD",
          "PUBLIC_DEMAND_CHANGFANGHOME_GD",
          "PUBLIC_DEMAND_ZGZSW_GD",
          "PUBLIC_FACTORY_LISTING_021CF_GD",
          "PUBLIC_FACTORY_LISTING_58_DG",
          "PUBLIC_FACTORY_LISTING_58_GD",
          "PUBLIC_FACTORY_LISTING_CANGXIAOER_DG",
          "PUBLIC_FACTORY_LISTING_CANGXIAOER_GD",
          "PUBLIC_FACTORY_LISTING_CFZX_GD",
          "PUBLIC_FACTORY_LISTING_CHANGFANGHOME_GD",
          "PUBLIC_FACTORY_LISTING_ZGZSW_GD");

  private static final Set<String> RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES =
      Set.of(
          "021cf",
          "021cf.com",
          "58.com",
          "cangxiaoer",
          "cangxiaoer.com",
          "cfzx",
          "changfanghome",
          "changfanghome.com",
          "zgzsw");

  private static final List<String> PUBLIC_OPPORTUNITY_DEMAND_SOURCE_CODES =
      List.of("PUBLIC_OPPORTUNITY_99CFW", "PUBLIC_DEMAND_99CFW_GD", "PUBLIC_DEMAND_ZHAOSHANG_NET_GD");

  private static final List<String> PUBLIC_OPPORTUNITY_SUPPLY_SOURCE_CODES =
      List.of(
          "PUBLIC_FACTORY_LISTING_CFZSW68",
          "PUBLIC_FACTORY_LISTING_99CFW_DG",
          "PUBLIC_FACTORY_LISTING_TOODC_DG",
          "PUBLIC_FACTORY_LISTING_SZAQFDC_DG",
          "PUBLIC_FACTORY_LISTING_FANG_DG",
          "PUBLIC_FACTORY_LISTING_TZGD_GD",
          "PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD",
          "PUBLIC_FACTORY_LISTING_GDCFZS_GD",
          "PUBLIC_FACTORY_LISTING_SZCFW_GD",
          "PUBLIC_FACTORY_LISTING_SZKKW_GD",
          "PUBLIC_FACTORY_LISTING_HFDPT_GD",
          "PUBLIC_FACTORY_LISTING_CHANGFANG88_GD",
          "PUBLIC_FACTORY_LISTING_YSOL_GD",
          "PUBLIC_FACTORY_LISTING_99CFW_GD",
          "PUBLIC_FACTORY_LISTING_TOODC_GD",
          "PUBLIC_FACTORY_LISTING_FANG_GD");

  private static final int PUBLIC_OPPORTUNITY_CRAWLER_BATCH_SIZE_DEFAULT = 10;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_BATCH_SIZE_MAX = 50;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_FRESHNESS_DAYS = 180;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_LIST_DISCOVERY_DELAY_MS = 800;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_MAX_LIST_PAGES_DEFAULT = 60;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_MAX_LIST_PAGES_MAX = 120;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_MAX_RETRY_COUNT_DEFAULT = 3;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_RETRY_DELAY_MINUTES_DEFAULT = 30;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_STALE_REPROCESS_MINUTES_DEFAULT = 24 * 60;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_MAX_CONCURRENCY_DEFAULT = 4;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_MAX_ROUNDS_DEFAULT = 1;
  private static final int PUBLIC_OPPORTUNITY_CRAWLER_TARGET_COUNT_MAX = 100_000;
  private static final int RADAR_PROPERTY_MATCH_BATCH_LIMIT_DEFAULT = 200;
  private static final int RADAR_PROPERTY_MATCH_BATCH_LIMIT_MAX = 1000;
  private static final int INTERNAL_CONTRACT_EXPIRY_HORIZON_DAYS = 90;

  private static final String TRACEABLE_SOURCE_URL_PATTERN = "^https?://";
  private static final String EARLIEST_REASONABLE_PUBLISHED_AT = "2000-01-01 00:00:00";
  private static final int FUTURE_PUBLISHED_TOLERANCE_DAYS = 2;
  private static final int CREATED_PUBLISHED_TOLERANCE_DAYS = 7;
  private static final int PUBLIC_OPPORTUNITY_PARSE_HTML_MAX_LENGTH = 2_000_000;
  private static final int PUBLIC_OPPORTUNITY_REPAIR_BATCH_SIZE = 500;
  private static final int PUBLIC_OPPORTUNITY_REPAIR_LIMIT_DEFAULT = 50;
  private static final int PUBLIC_OPPORTUNITY_REPAIR_LIMIT_MAX = 500;
  private static final String UNKNOWN_CITY_VALUE_PATTERN = "^(未知|unknown|none|null|n/a|na|-|--)$";
  private static final Set<String> PUBLIC_OPPORTUNITY_LEAD_INCLUDE_KEYWORDS =
      Set.of("扩产", "搬迁", "迁建", "新建厂房", "技改", "生产线", "仓储", "求租", "租厂房", "厂房需求", "产业园", "项目落地", "招商引资");
  private static final Set<String> PUBLIC_OPPORTUNITY_LEAD_EXCLUDE_KEYWORDS =
      Set.of("住宅", "商铺", "个人", "培训", "会议", "活动宣传", "招聘普通岗位");

  private static final List<String> GUANGDONG_REGION_SCOPE =
      List.of(
          "广东省",
          "广州",
          "深圳",
          "珠海",
          "汕头",
          "佛山",
          "韶关",
          "湛江",
          "肇庆",
          "江门",
          "茂名",
          "惠州",
          "梅州",
          "汕尾",
          "河源",
          "阳江",
          "清远",
          "东莞",
          "中山",
          "潮州",
          "揭阳",
          "云浮");

  private final ObjectMapper objectMapper = new ObjectMapper();

  /** 触达模板写入前的规范化字段快照。 */
  private record OutreachTemplateFields(
      String channel,
      String content,
      String placeholderJson,
      String priorityLevel,
      String taskType,
      String templateCode,
      String templateName) {}

  /** 企业画像刷新时按公司聚合后的派生字段。 */
  private record EnterpriseProfileDerived(
      Object address,
      String companyName,
      Object enterpriseId,
      String industryName,
      List<String> industryTags,
      Object lastSignalTime,
      String latestIntentType,
      Object regionCity,
      Object regionDistrict,
      Object regionProvince,
      Object registeredCapital,
      int signalCount,
      Object unifiedSocialCreditCode) {}

  /** 手工解析公开需求页 HTML 得到的字段快照；不包含任何外部抓取结果。 */
  private record ParsedDemandPage(
      String areaText,
      String city,
      String contactName,
      String description,
      Map<String, Object> detailJson,
      String district,
      String industryText,
      String phoneNumber,
      String priceText,
      Timestamp publishedAt,
      String publishedDateText,
      String sourceSite,
      String sourceUrl,
      String title) {}

  /** 公开机会历史数据修复候选，保留审计规则算出的目标降级状态。 */
  private record PublicOpportunityRepairCandidate(
      String detailJson,
      Long opportunityId,
      String proposedDowngradeStatus) {}

  /** 从公开机会池重建外部线索时读取的源数据快照。 */
  private record PublicOpportunityLeadSource(
      Object areaSqm,
      String areaText,
      String city,
      String contactName,
      String description,
      String detailJson,
      String district,
      String industryText,
      Long opportunityId,
      String opportunityType,
      String phoneNumber,
      String priceText,
      Timestamp publishedAt,
      String sourceSite,
      String sourceTable,
      String sourceUrl,
      String tagsJson,
      String title,
      Timestamp lastSyncedAt) {}

  /** 公开机会转换外部线索的构造结果；skipReason 非空时不落 company_lead。 */
  private record ExternalLeadBuildResult(
      String companyName,
      int confidenceScore,
      String demandType,
      String evidenceText,
      List<String> matchedKeywords,
      PublicOpportunityLeadSource source,
      String skipReason,
      String summary) {}

  /** JSON 导入招商雷达线索后的规范化字段。 */
  private record RadarLeadImportItem(
      String address,
      String city,
      String contactName,
      String enterpriseName,
      String industryName,
      BigDecimal intentArea,
      int intentScore,
      String leadSource,
      int matchScore,
      Long ownerUserId,
      Long parkId,
      String phoneNumber,
      String priorityLevel,
      int reachableScore,
      BigDecimal registerCapital,
      String sourceLatest,
      String stage,
      boolean stageExplicit,
      int totalScore,
      String unifiedSocialCreditCode) {}

  /** 房源匹配算法的候选房源快照，只读取本地房源和楼层数据。 */
  private record PropertyMatchCandidate(
      String address,
      BigDecimal availableArea,
      long factoryId,
      String factoryName,
      int floorCount,
      List<String> floorFeatures,
      long parkId,
      String parkName,
      BigDecimal rentPrice,
      String tag,
      BigDecimal totalArea,
      BigDecimal usedArea) {}

  /** 线索房源匹配计算结果，最终写入 property_match_result。 */
  private record PropertyMatchCandidateResult(
      String address,
      BigDecimal availableArea,
      long factoryId,
      String factoryName,
      int floorCount,
      List<String> matchReasons,
      int matchScore,
      List<String> mismatchReminders,
      long parkId,
      String parkName,
      BigDecimal rentPrice,
      String rentPriceText,
      String salesPitch,
      String tag,
      BigDecimal totalArea,
      BigDecimal usedArea) {}

  /** 查询招商项目分页列表，并补齐旧接口的 `parkName` 和 `imageUrlList`。 */
  public Map<String, Object> findInvestmentPage(JdbcTemplate jdbcTemplate, InvestmentListQuery query) {
    if (!hasColumns(
        jdbcTemplate,
        "investment",
        "investment_id",
        "agent_name",
        "tenant_name",
        "intent_level",
        "intent_area",
        "progress",
        "phone_number",
        "meeting_time",
        "remark",
        "create_time",
        "update_time",
        "park_id")) {
      return listResult(List.of(), 0);
    }

    List<Object> args = new ArrayList<>();
    String where = buildInvestmentWhere(query, args);
    String parkJoin =
        hasColumns(jdbcTemplate, "park", "park_id", "park_name")
            ? "LEFT JOIN park p ON p.park_id = i.park_id"
            : "";
    String parkNameSelect = parkJoin.isBlank() ? "NULL AS parkName" : "p.park_name AS parkName";
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM investment i " + where, Long.class, args.toArray());

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              i.investment_id AS investmentId,
              i.agent_name AS agentName,
              i.tenant_name AS tenantName,
              i.intent_level AS intentLevel,
              i.intent_area AS intentArea,
              i.progress,
              i.phone_number AS phoneNumber,
              i.meeting_time AS meetingTime,
              i.remark,
              i.create_time AS createTime,
              i.update_time AS updateTime,
              i.park_id AS parkId,
            """
                + parkNameSelect
                + """
            FROM investment i
            """
                + parkJoin
                + " "
                + where
                + """
            ORDER BY i.meeting_time DESC
            LIMIT ?, ?
            """,
            (rs, rowNum) -> investmentMap(rs, true),
            pageArgs.toArray());
    appendInvestmentImages(jdbcTemplate, rows);
    return listResult(rows, total == null ? 0 : total);
  }

  /** 查询招商表单可选择园区。旧接口读共享雷达库并只返回未删除园区。 */
  public List<Map<String, Object>> findInvestmentParks(JdbcTemplate jdbcTemplate) {
    if (!hasColumns(jdbcTemplate, "park", "park_id", "park_name", "is_deleted")) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT park_id, park_name
        FROM park
        WHERE is_deleted = false
        ORDER BY park_id ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("parkId", rs.getInt("park_id"));
          map.put("parkName", rs.getString("park_name"));
          return map;
        });
  }

  /** 查询招商项目详情；旧接口是 Prisma `findUnique`，不 include 图片和园区对象。 */
  public Map<String, Object> findInvestmentById(JdbcTemplate jdbcTemplate, int id) {
    if (!hasColumns(
        jdbcTemplate,
        "investment",
        "investment_id",
        "agent_name",
        "tenant_name",
        "intent_level",
        "intent_area",
        "progress",
        "phone_number",
        "meeting_time",
        "remark",
        "create_time",
        "update_time",
        "park_id")) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              investment_id AS investmentId,
              agent_name AS agentName,
              tenant_name AS tenantName,
              intent_level AS intentLevel,
              intent_area AS intentArea,
              progress,
              phone_number AS phoneNumber,
              meeting_time AS meetingTime,
              remark,
              create_time AS createTime,
              update_time AS updateTime,
              park_id AS parkId
            FROM investment
            WHERE investment_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> investmentMap(rs, false),
            id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 新增招商项目主表记录；字段白名单与更新接口保持一致，不写图片和雷达线索表。 */
  public Map<String, Object> createInvestment(
      JdbcTemplate jdbcTemplate, InvestmentCreateRequest request) {
    if (!hasColumns(
        jdbcTemplate,
        "investment",
        "investment_id",
        "agent_name",
        "tenant_name",
        "intent_level",
        "intent_area",
        "progress",
        "phone_number",
        "meeting_time",
        "remark",
        "create_time",
        "update_time",
        "park_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "招商项目表结构不完整");
    }
    if (request == null
        || !StringUtils.hasText(request.intentLevel())
        || !StringUtils.hasText(request.progress())
        || !StringUtils.hasText(request.meetingTime())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }

    List<String> columns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendInvestmentStringValue(columns, args, "agent_name", request.agentName());
    appendInvestmentStringValue(columns, args, "tenant_name", request.tenantName());
    appendInvestmentStringValue(columns, args, "intent_level", request.intentLevel());
    if (request.intentArea() != null) {
      columns.add("intent_area");
      args.add(request.intentArea());
    }
    appendInvestmentStringValue(columns, args, "progress", request.progress());
    appendInvestmentStringValue(columns, args, "phone_number", request.phoneNumber());
    columns.add("meeting_time");
    args.add(toTimestamp(request.meetingTime(), "meetingTime参数错误"));
    appendInvestmentStringValue(columns, args, "remark", request.remark());
    if (request.parkId() != null) {
      columns.add("park_id");
      args.add(nullablePositiveInteger(request.parkId(), "parkId参数错误"));
    }
    Timestamp now = Timestamp.from(Instant.now());
    columns.add("create_time");
    args.add(now);
    columns.add("update_time");
    args.add(now);

    jdbcTemplate.update(
        "INSERT INTO investment ("
            + String.join(", ", columns)
            + ") VALUES ("
            + placeholders(columns.size())
            + ")",
        args.toArray());
    Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (id == null || id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "create investment failed");
    }
    Map<String, Object> result = findInvestmentById(jdbcTemplate, id);
    if (result == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "create investment failed");
    }
    return result;
  }

  /** 更新招商项目主表白名单字段；不处理图片、跟进记录或雷达线索联动。 */
  public Map<String, Object> updateInvestment(
      JdbcTemplate jdbcTemplate, int id, InvestmentUpdateRequest request) {
    if (findInvestmentById(jdbcTemplate, id) == null) {
      return null;
    }
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    if (request != null && request.agentName() != null) {
      assignments.add("agent_name = ?");
      args.add(blankToNullObject(request.agentName()));
    }
    if (request != null && request.tenantName() != null) {
      assignments.add("tenant_name = ?");
      args.add(blankToNullObject(request.tenantName()));
    }
    if (request != null && request.intentLevel() != null) {
      assignments.add("intent_level = ?");
      args.add(blankToNullObject(request.intentLevel()));
    }
    if (request != null && request.intentArea() != null) {
      assignments.add("intent_area = ?");
      args.add(request.intentArea());
    }
    if (request != null && request.progress() != null) {
      assignments.add("progress = ?");
      args.add(blankToNullObject(request.progress()));
    }
    if (request != null && request.phoneNumber() != null) {
      assignments.add("phone_number = ?");
      args.add(blankToNullObject(request.phoneNumber()));
    }
    if (request != null && request.meetingTime() != null) {
      assignments.add("meeting_time = ?");
      args.add(toTimestamp(request.meetingTime(), "meetingTime参数错误"));
    }
    if (request != null && request.remark() != null) {
      assignments.add("remark = ?");
      args.add(blankToNullObject(request.remark()));
    }
    if (request != null && request.parkId() != null) {
      assignments.add("park_id = ?");
      args.add(nullablePositiveInteger(request.parkId(), "parkId参数错误"));
    }
    if (assignments.isEmpty()) {
      return findInvestmentById(jdbcTemplate, id);
    }
    args.add(id);
    int affected =
        jdbcTemplate.update(
            "UPDATE investment SET "
                + String.join(", ", assignments)
                + ", update_time = NOW(3) WHERE investment_id = ?",
            args.toArray());
    return affected == 0 ? null : findInvestmentById(jdbcTemplate, id);
  }

  /** 删除招商项目主表，返回删除前快照；旧接口没有处理图片关系或园区权限。 */
  public Map<String, Object> deleteInvestment(JdbcTemplate jdbcTemplate, int id) {
    Map<String, Object> snapshot = findInvestmentById(jdbcTemplate, id);
    if (snapshot == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "招商项目不存在");
    }
    jdbcTemplate.update("DELETE FROM investment WHERE investment_id = ?", id);
    return snapshot;
  }

  /** 查询雷达评分规则列表。GET 迁移保持只读，不复刻旧接口的自动 seed 写库副作用。 */
  public Map<String, Object> findLeadScoreRules(JdbcTemplate jdbcTemplate) {
    if (!hasColumns(
        jdbcTemplate,
        "lead_score_rule",
        "rule_id",
        "rule_code",
        "rule_name",
        "event_type",
        "keyword_json",
        "score_delta",
        "enabled",
        "rule_description",
        "create_time",
        "update_time")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              rule_id AS ruleId,
              rule_code AS ruleCode,
              rule_name AS ruleName,
              event_type AS eventType,
              keyword_json AS keywordJson,
              score_delta AS scoreDelta,
              enabled,
              rule_description AS ruleDescription,
              create_time AS createTime,
              update_time AS updateTime
            FROM lead_score_rule
            ORDER BY rule_id ASC
            """,
            (rs, rowNum) -> leadScoreRuleMap(rs));
    return listResult(rows, rows.size());
  }

  /** 更新评分规则白名单字段；只写 lead_score_rule，不执行默认规则 seed 或线索分数重算。 */
  public Map<String, Object> updateLeadScoreRule(
      JdbcTemplate jdbcTemplate, long ruleId, Map<String, Object> request) {
    if (!hasColumns(
        jdbcTemplate,
        "lead_score_rule",
        "rule_id",
        "rule_code",
        "rule_name",
        "event_type",
        "keyword_json",
        "score_delta",
        "enabled",
        "rule_description",
        "create_time",
        "update_time")) {
      return null;
    }
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    if (request.containsKey("enabled")) {
      assignments.add("enabled = ?");
      args.add(jsBoolean(request.get("enabled")) ? 1 : 0);
    }
    if (request.containsKey("scoreDelta")) {
      assignments.add("score_delta = ?");
      args.add(parseScoreDelta(request.get("scoreDelta")));
    }
    if (request.containsKey("keywordJson")) {
      assignments.add("keyword_json = ?");
      args.add(keywordJsonText(request.get("keywordJson")));
    }
    if (request.containsKey("ruleDescription")) {
      assignments.add("rule_description = ?");
      Object value = request.get("ruleDescription");
      args.add(value == null ? null : String.valueOf(value));
    }

    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Radar DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    Integer affected =
        transactionTemplate.execute(
            ignored -> {
              if (assignments.isEmpty()) {
                return 1;
              }
              List<Object> updateArgs = new ArrayList<>(args);
              updateArgs.add(ruleId);
              return jdbcTemplate.update(
                  "UPDATE lead_score_rule SET "
                      + String.join(", ", assignments)
                      + ", update_time = NOW(3) WHERE rule_id = ?",
                  updateArgs.toArray());
            });
    if (affected == null || affected == 0) {
      return null;
    }
    return findLeadScoreRuleById(jdbcTemplate, ruleId);
  }

  private Map<String, Object> findLeadScoreRuleById(JdbcTemplate jdbcTemplate, long ruleId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              rule_id AS ruleId,
              rule_code AS ruleCode,
              rule_name AS ruleName,
              event_type AS eventType,
              keyword_json AS keywordJson,
              score_delta AS scoreDelta,
              enabled,
              rule_description AS ruleDescription,
              create_time AS createTime,
              update_time AS updateTime
            FROM lead_score_rule
            WHERE rule_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> leadScoreRuleMap(rs),
            ruleId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private boolean jsBoolean(Object value) {
    if (value == null) {
      return false;
    }
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.doubleValue() != 0;
    }
    return !String.valueOf(value).isEmpty();
  }

  private int parseScoreDelta(Object value) {
    double parsed;
    if (value == null) {
      parsed = 0;
    } else if (value instanceof Number number) {
      parsed = number.doubleValue();
    } else {
      String text = String.valueOf(value).trim();
      if (!StringUtils.hasText(text)) {
        parsed = 0;
      } else {
        try {
          parsed = Double.parseDouble(text);
        } catch (NumberFormatException error) {
          throw new BusinessException(HttpStatus.BAD_REQUEST, "scoreDelta 无效");
        }
      }
    }
    if (!Double.isFinite(parsed)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "scoreDelta 无效");
    }
    return (int) Math.round(parsed);
  }

  private String keywordJsonText(Object value) {
    if (value == null) {
      return null;
    }
    if (!(value instanceof List<?> list)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "keywordJson 必须是字符串数组或 null");
    }
    List<String> keywords = new ArrayList<>();
    for (Object item : list) {
      if (!(item instanceof String text)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "keywordJson 必须是字符串数组或 null");
      }
      String trimmed = text.trim();
      if (StringUtils.hasText(trimmed)) {
        keywords.add(trimmed);
      }
    }
    try {
      return objectMapper.writeValueAsString(keywords);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("Unable to serialize keywordJson", error);
    }
  }

  /** 查询雷达采集源列表。GET 迁移保持只读，不复刻旧接口的自动 catalog seed 写库副作用。 */
  public Map<String, Object> findCrawlerSources(JdbcTemplate jdbcTemplate) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_source",
        "source_id",
        "source_code",
        "source_name",
        "source_type",
        "base_url",
        "robots_url",
        "enabled",
        "crawl_interval_minutes",
        "rate_limit_per_minute",
        "allowed_paths_json",
        "blocked_paths_json",
        "keyword_include_json",
        "keyword_exclude_json",
        "region_scope_json",
        "last_crawled_at",
        "create_time",
        "update_time")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              source_id AS sourceId,
              source_code AS sourceCode,
              source_name AS sourceName,
              source_type AS sourceType,
              base_url AS baseUrl,
              robots_url AS robotsUrl,
              enabled,
              crawl_interval_minutes AS crawlIntervalMinutes,
              rate_limit_per_minute AS rateLimitPerMinute,
              allowed_paths_json AS allowedPathsJson,
              blocked_paths_json AS blockedPathsJson,
              keyword_include_json AS keywordIncludeJson,
              keyword_exclude_json AS keywordExcludeJson,
              region_scope_json AS regionScopeJson,
              last_crawled_at AS lastCrawledAt,
              create_time AS createTime,
              update_time AS updateTime
            FROM crawler_source
            ORDER BY source_id ASC
            """,
            (rs, rowNum) -> crawlerSourceMap(rs))
            .stream()
            .filter(row -> !"DEMO".equals(row.get("sourceType")))
            .filter(row -> !RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.contains(String.valueOf(row.get("sourceCode"))))
            .toList();
    return listResult(rows, rows.size());
  }

  /** 更新采集源配置白名单字段；不执行 catalog seed、启停任务或爬虫调度。 */
  public Map<String, Object> updateCrawlerSource(
      JdbcTemplate jdbcTemplate, long sourceId, CrawlerSourceUpdateRequest request) {
    Map<String, Object> source = findCrawlerSourceById(jdbcTemplate, sourceId);
    if (source == null) {
      return null;
    }
    String sourceCode = String.valueOf(source.get("sourceCode"));
    validateCrawlerSourcePolicyUpdate(sourceCode, request);

    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    boolean publicOpportunity99Cfw = PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE.equals(sourceCode);
    boolean publicFactoryCfzsw68 = PUBLIC_FACTORY_CFZSW68_SOURCE_CODE.equals(sourceCode);
    List<String> allowedPaths = request.allowedPathsJson();
    List<String> regionScope = request.regionScopeJson();
    String robotsUrl = request.robotsUrl();
    if (publicOpportunity99Cfw) {
      allowedPaths = PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS;
      regionScope = GUANGDONG_REGION_SCOPE;
      robotsUrl = null;
    } else if (publicFactoryCfzsw68) {
      allowedPaths = PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS;
      regionScope = List.of("深圳");
      robotsUrl = null;
    }
    if (request.enabled() != null) {
      assignments.add("enabled = ?");
      args.add(jsBoolean(request.enabled()) ? 1 : 0);
    }
    if (request.crawlIntervalMinutes() != null) {
      assignments.add("crawl_interval_minutes = ?");
      args.add(nonNegativeInteger(request.crawlIntervalMinutes(), "crawlIntervalMinutes is invalid"));
    }
    if (request.rateLimitPerMinute() != null) {
      assignments.add("rate_limit_per_minute = ?");
      args.add(positiveInteger(request.rateLimitPerMinute(), "rateLimitPerMinute is invalid"));
    }
    if (request.robotsUrl() != null || publicOpportunity99Cfw || publicFactoryCfzsw68) {
      assignments.add("robots_url = ?");
      args.add(robotsUrl == null ? null : blankToNullObject(robotsUrl));
    }
    appendCrawlerJsonArrayUpdate(assignments, args, "allowed_paths_json", allowedPaths);
    appendCrawlerJsonArrayUpdate(assignments, args, "blocked_paths_json", request.blockedPathsJson());
    appendCrawlerJsonArrayUpdate(assignments, args, "keyword_include_json", request.keywordIncludeJson());
    appendCrawlerJsonArrayUpdate(assignments, args, "keyword_exclude_json", request.keywordExcludeJson());
    appendCrawlerJsonArrayUpdate(assignments, args, "region_scope_json", regionScope);

    if (assignments.isEmpty()) {
      return source;
    }
    args.add(sourceId);
    jdbcTemplate.update(
        "UPDATE crawler_source SET "
            + String.join(", ", assignments)
            + ", update_time = NOW(3) WHERE source_id = ?",
        args.toArray());
    return findCrawlerSourceById(jdbcTemplate, sourceId);
  }

  /** 启停采集源；只写 enabled/update_time，不触发采集源 seed 或爬虫任务。 */
  public Map<String, Object> setCrawlerSourceEnabled(
      JdbcTemplate jdbcTemplate, long sourceId, boolean enabled) {
    Map<String, Object> source = findCrawlerSourceById(jdbcTemplate, sourceId);
    if (source == null) {
      return null;
    }
    jdbcTemplate.update(
        """
        UPDATE crawler_source
        SET enabled = ?, update_time = NOW(3)
        WHERE source_id = ?
        """,
        enabled ? 1 : 0,
        sourceId);
    return findCrawlerSourceById(jdbcTemplate, sourceId);
  }

  /** 查询雷达销售负责人候选。只读取用户、园区和有效线索数量，不修改分配关系。 */
  public Map<String, Object> findRadarSalesUsers(
      JdbcTemplate jdbcTemplate, Integer parkId, String keyword) {
    if (!hasColumns(jdbcTemplate, "user", "id", "real_name", "username", "status", "park_id")) {
      return listResult(List.of(), 0);
    }

    boolean hasPark = hasColumns(jdbcTemplate, "park", "park_id", "park_name");
    boolean hasLead =
        hasColumns(
            jdbcTemplate, "investment_lead", "lead_id", "owner_user_id", "is_deleted", "stage");
    String parkJoin = hasPark ? "LEFT JOIN park p ON p.park_id = u.park_id" : "";
    String leadJoin =
        hasLead
            ? """
            LEFT JOIN investment_lead l
              ON l.owner_user_id = u.id
              AND l.is_deleted = 0
              AND l.stage NOT IN ('CLOSED', 'DEAL', 'INVALID')
            """
            : "";
    String activeLeadSelect = hasLead ? "COUNT(l.lead_id) AS activeLeadCount" : "0 AS activeLeadCount";
    String parkNameSelect = hasPark ? "p.park_name AS parkName" : "NULL AS parkName";

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("COALESCE(u.status, 1) = 1");
    if (parkId != null && parkId > 0) {
      conditions.add("(u.park_id = ? OR u.park_id IS NULL)");
      args.add(parkId);
    }
    if (StringUtils.hasText(keyword)) {
      conditions.add("(u.real_name LIKE ? OR u.username LIKE ?)");
      args.add(like(keyword));
      args.add(like(keyword));
    }
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    String groupBySql =
        hasLead
            ? "GROUP BY u.id, userName, u.park_id" + (hasPark ? ", p.park_name" : "")
            : "";

    List<Object> queryArgs = new ArrayList<>(args);
    queryArgs.add(parkId != null && parkId > 0 ? parkId : 0);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              u.id AS userId,
              COALESCE(NULLIF(u.real_name, ''), u.username) AS userName,
              u.park_id AS parkId,
            """
                + parkNameSelect
                + ",\n"
                + activeLeadSelect
                + """

            FROM user u
            """
                + parkJoin
                + "\n"
                + leadJoin
                + whereSql
                + "\n"
                + groupBySql
                + """

            ORDER BY
              CASE WHEN u.park_id = ? THEN 0 ELSE 1 END,
              activeLeadCount ASC,
              userName ASC
            LIMIT 100
            """,
            (rs, rowNum) -> radarSalesUserMap(rs),
            queryArgs.toArray());
    return listResult(rows, rows.size());
  }

  /** 查询雷达采集任务。GET 迁移保持只读，不复刻旧接口的采集源 catalog seed。 */
  public Map<String, Object> findCrawlerTasks(
      JdbcTemplate jdbcTemplate, int currentPage, int pageSize, Integer sourceId, String status) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_task",
        "task_id",
        "source_id",
        "task_type",
        "status",
        "started_at",
        "finished_at",
        "crawl_started_at",
        "crawl_ended_at",
        "fetched_count",
        "created_lead_count",
        "updated_lead_count",
        "skipped_count",
        "error_message",
        "retry_count",
        "max_retry_count",
        "next_retry_at",
        "skip_reason",
        "request_config_json",
        "create_time",
        "update_time")) {
      return pageResult(List.of(), 0, currentPage, pageSize);
    }

    boolean hasSource = hasColumns(jdbcTemplate, "crawler_source", "source_id", "source_code", "source_name");
    boolean hasTaskItem = hasColumns(jdbcTemplate, "crawler_task_item", "last_task_id", "status");
    String sourceJoin = hasSource ? "LEFT JOIN crawler_source s ON s.source_id = t.source_id" : "";
    String sourceSelect =
        hasSource
            ? """
              s.source_code AS sourceCode,
              s.source_name AS sourceName,
            """
            : """
              NULL AS sourceCode,
              NULL AS sourceName,
            """;
    String itemStatsJoin =
        hasTaskItem
            ? """
            LEFT JOIN (
              SELECT
                last_task_id,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'RETRY_WAITING' THEN 1 ELSE 0 END) AS retry_waiting_count,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
                SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS skipped_count
              FROM crawler_task_item
              WHERE last_task_id IS NOT NULL
              GROUP BY last_task_id
            ) item_stats ON item_stats.last_task_id = t.task_id
            """
            : "";
    String itemStatsSelect =
        hasTaskItem
            ? """
              COALESCE(item_stats.pending_count, 0) AS pendingItemCount,
              COALESCE(item_stats.retry_waiting_count, 0) AS retryWaitingItemCount,
              COALESCE(item_stats.success_count, 0) AS successItemCount,
              COALESCE(item_stats.failed_count, 0) AS failedItemCount,
              COALESCE(item_stats.skipped_count, 0) AS skippedItemCount
            """
            : """
              0 AS pendingItemCount,
              0 AS retryWaitingItemCount,
              0 AS successItemCount,
              0 AS failedItemCount,
              0 AS skippedItemCount
            """;

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("1 = 1");
    appendEquals(conditions, args, "t.status = ?", status);
    if (sourceId != null && sourceId > 0) {
      conditions.add("t.source_id = ?");
      args.add(sourceId);
    }
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total =
        count(jdbcTemplate, "SELECT COUNT(*) FROM crawler_task t " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((currentPage - 1) * pageSize);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.task_id AS taskId,
              t.source_id AS sourceId,
            """
                + sourceSelect
                + """
              t.task_type AS taskType,
              t.status,
              t.started_at AS startedAt,
              t.finished_at AS finishedAt,
              t.crawl_started_at AS crawlStartedAt,
              t.crawl_ended_at AS crawlEndedAt,
              t.fetched_count AS fetchedCount,
              t.created_lead_count AS createdLeadCount,
              t.updated_lead_count AS updatedLeadCount,
              t.skipped_count AS skippedCount,
              t.error_message AS errorMessage,
              t.retry_count AS retryCount,
              t.max_retry_count AS maxRetryCount,
              t.next_retry_at AS nextRetryAt,
              t.skip_reason AS skipReason,
              t.request_config_json AS requestConfigJson,
              t.create_time AS createTime,
              t.update_time AS updateTime,
            """
                + itemStatsSelect
                + """

            FROM crawler_task t
            """
                + sourceJoin
                + "\n"
                + itemStatsJoin
                + whereSql
                + """

            ORDER BY t.create_time DESC, t.task_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> crawlerTaskMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, currentPage, pageSize);
  }

  /** 查询雷达采集任务详情。GET 迁移保持只读，不触发旧接口的 catalog seed。 */
  public Map<String, Object> findCrawlerTaskById(JdbcTemplate jdbcTemplate, long taskId) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_task",
        "task_id",
        "source_id",
        "task_type",
        "status",
        "started_at",
        "finished_at",
        "crawl_started_at",
        "crawl_ended_at",
        "fetched_count",
        "created_lead_count",
        "updated_lead_count",
        "skipped_count",
        "error_message",
        "retry_count",
        "max_retry_count",
        "next_retry_at",
        "skip_reason",
        "request_config_json",
        "create_time",
        "update_time")) {
      return null;
    }

    boolean hasSource = hasColumns(jdbcTemplate, "crawler_source", "source_id", "source_code", "source_name");
    boolean hasTaskItem = hasColumns(jdbcTemplate, "crawler_task_item", "last_task_id", "status");
    String sourceJoin = hasSource ? "LEFT JOIN crawler_source s ON s.source_id = t.source_id" : "";
    String sourceSelect =
        hasSource
            ? """
              s.source_code AS sourceCode,
              s.source_name AS sourceName,
            """
            : """
              NULL AS sourceCode,
              NULL AS sourceName,
            """;
    String itemStatsJoin =
        hasTaskItem
            ? """
            LEFT JOIN (
              SELECT
                last_task_id,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'RETRY_WAITING' THEN 1 ELSE 0 END) AS retry_waiting_count,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
                SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS skipped_count
              FROM crawler_task_item
              WHERE last_task_id IS NOT NULL
              GROUP BY last_task_id
            ) item_stats ON item_stats.last_task_id = t.task_id
            """
            : "";
    String itemStatsSelect =
        hasTaskItem
            ? """
              COALESCE(item_stats.pending_count, 0) AS pendingItemCount,
              COALESCE(item_stats.retry_waiting_count, 0) AS retryWaitingItemCount,
              COALESCE(item_stats.success_count, 0) AS successItemCount,
              COALESCE(item_stats.failed_count, 0) AS failedItemCount,
              COALESCE(item_stats.skipped_count, 0) AS skippedItemCount
            """
            : """
              0 AS pendingItemCount,
              0 AS retryWaitingItemCount,
              0 AS successItemCount,
              0 AS failedItemCount,
              0 AS skippedItemCount
            """;

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.task_id AS taskId,
              t.source_id AS sourceId,
            """
                + sourceSelect
                + """
              t.task_type AS taskType,
              t.status,
              t.started_at AS startedAt,
              t.finished_at AS finishedAt,
              t.crawl_started_at AS crawlStartedAt,
              t.crawl_ended_at AS crawlEndedAt,
              t.fetched_count AS fetchedCount,
              t.created_lead_count AS createdLeadCount,
              t.updated_lead_count AS updatedLeadCount,
              t.skipped_count AS skippedCount,
              t.error_message AS errorMessage,
              t.retry_count AS retryCount,
              t.max_retry_count AS maxRetryCount,
              t.next_retry_at AS nextRetryAt,
              t.skip_reason AS skipReason,
              t.request_config_json AS requestConfigJson,
              t.create_time AS createTime,
              t.update_time AS updateTime,
            """
                + itemStatsSelect
                + """

            FROM crawler_task t
            """
                + sourceJoin
                + "\n"
                + itemStatsJoin
                + """
            WHERE t.task_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> crawlerTaskMap(rs),
            taskId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询雷达采集任务日志。 */
  public Map<String, Object> findCrawlerTaskLogs(JdbcTemplate jdbcTemplate, long taskId) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_task_log",
        "log_id",
        "task_id",
        "level",
        "stage",
        "message",
        "detail_json",
        "create_time")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              log_id AS logId,
              task_id AS taskId,
              level,
              stage,
              message,
              detail_json AS detailJson,
              create_time AS createTime
            FROM crawler_task_log
            WHERE task_id = ?
            ORDER BY log_id ASC
            """,
            (rs, rowNum) -> crawlerTaskLogMap(rs),
            taskId);
    return listResult(rows, rows.size());
  }

  /** 查询雷达采集任务 URL 项分页列表。 */
  public Map<String, Object> findCrawlerTaskItems(
      JdbcTemplate jdbcTemplate,
      long taskId,
      int currentPage,
      int pageSize,
      Integer sourceId,
      String status) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_task_item",
        "item_id",
        "source_id",
        "last_task_id",
        "source_ref_type",
        "source_ref_id",
        "source_url",
        "status",
        "retry_count",
        "max_retry_count",
        "next_retry_at",
        "last_http_status",
        "last_error",
        "skip_reason",
        "published_at",
        "last_started_at",
        "last_finished_at",
        "last_success_at",
        "create_time",
        "update_time")) {
      return pageResult(List.of(), 0, currentPage, pageSize);
    }

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("last_task_id = ?");
    args.add(taskId);
    if (sourceId != null && sourceId > 0) {
      conditions.add("source_id = ?");
      args.add(sourceId);
    }
    appendEquals(conditions, args, "status = ?", status);
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) FROM crawler_task_item " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((currentPage - 1) * pageSize);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              item_id AS itemId,
              source_id AS sourceId,
              last_task_id AS lastTaskId,
              source_ref_type AS sourceRefType,
              source_ref_id AS sourceRefId,
              source_url AS sourceUrl,
              status,
              retry_count AS retryCount,
              max_retry_count AS maxRetryCount,
              next_retry_at AS nextRetryAt,
              last_http_status AS lastHttpStatus,
              last_error AS lastError,
              skip_reason AS skipReason,
              published_at AS publishedAt,
              last_started_at AS lastStartedAt,
              last_finished_at AS lastFinishedAt,
              last_success_at AS lastSuccessAt,
              create_time AS createTime,
              update_time AS updateTime
            FROM crawler_task_item
            """
                + whereSql
                + """

            ORDER BY update_time DESC, item_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> crawlerTaskItemMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, currentPage, pageSize);
  }

  /** 取消待执行采集任务；不执行 worker，只写任务状态和本地任务日志。 */
  public Map<String, Object> cancelCrawlerTask(JdbcTemplate jdbcTemplate, long taskId) {
    Map<String, Object> task = findCrawlerTaskById(jdbcTemplate, taskId);
    if (task == null) {
      return null;
    }
    if (!"PENDING".equals(String.valueOf(task.get("status")))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "仅 PENDING 任务允许取消");
    }
    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Radar DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    transactionTemplate.executeWithoutResult(
        ignored -> {
          jdbcTemplate.update(
              """
              UPDATE crawler_task
              SET status = 'CANCELED',
                  finished_at = NOW(3),
                  skip_reason = 'MANUAL_CANCEL',
                  update_time = NOW(3)
              WHERE task_id = ?
              """,
              taskId);
          if (hasColumns(jdbcTemplate, "crawler_task_log", "task_id", "level", "stage", "message", "detail_json")) {
            jdbcTemplate.update(
                """
                INSERT INTO crawler_task_log (task_id, level, stage, message, detail_json, create_time)
                VALUES (?, 'WARN', 'FINISH', '任务已手动取消', ?, NOW(3))
                """,
                taskId,
                "{\"status\":\"CANCELED\"}");
          }
        });
    return findCrawlerTaskById(jdbcTemplate, taskId);
  }

  /** 重新入队失败/等待重试/跳过的 URL 项；只写 crawler_task_item，不触发任务执行。 */
  public Map<String, Object> requeueCrawlerTaskItems(
      JdbcTemplate jdbcTemplate, CrawlerTaskItemRequeueRequest request) {
    Map<String, Object> source =
        findCrawlerSourceForOps(
            jdbcTemplate,
            nullableIntegerObject(request == null ? null : request.sourceId()),
            stringObject(request == null ? null : request.sourceCode()));
    if (source == null || !hasCrawlerTaskItemWriteColumns(jdbcTemplate)) {
      return null;
    }

    long sourceId = longValue(source.get("sourceId"));
    List<Long> itemIds = normalizedPositiveLongList(request == null ? null : request.itemIds());
    List<String> statuses = normalizedCrawlerRequeueStatuses(request == null ? null : request.statuses());
    if (statuses.isEmpty()) {
      return crawlerRequeueResult(0, sourceId);
    }

    List<String> whereClauses = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    whereClauses.add("source_id = ?");
    args.add(sourceId);
    whereClauses.add("status IN (" + placeholders(statuses.size()) + ")");
    args.addAll(statuses);
    if (!itemIds.isEmpty()) {
      whereClauses.add("item_id IN (" + placeholders(itemIds.size()) + ")");
      args.addAll(itemIds);
    }

    int affected =
        jdbcTemplate.update(
            """
            UPDATE crawler_task_item
            SET status = 'PENDING',
                retry_count = 0,
                next_retry_at = NULL,
                last_error = NULL,
                skip_reason = NULL,
                update_time = NOW(3)
            WHERE
            """
                + String.join(" AND ", whereClauses),
            args.toArray());
    return crawlerRequeueResult(affected, sourceId);
  }

  /** 回收卡住的 RUNNING URL 项；不启动 worker，只更新重试状态。 */
  public Map<String, Object> reclaimStaleCrawlerTaskItems(
      JdbcTemplate jdbcTemplate, CrawlerTaskItemReclaimRequest request) {
    Map<String, Object> source =
        findCrawlerSourceForOps(
            jdbcTemplate,
            nullableIntegerObject(request == null ? null : request.sourceId()),
            stringObject(request == null ? null : request.sourceCode()));
    if (source == null || !hasCrawlerTaskItemWriteColumns(jdbcTemplate)) {
      return null;
    }

    long sourceId = longValue(source.get("sourceId"));
    int staleMinutes = positiveIntegerOrDefault(request == null ? null : request.staleMinutes(), 15, 1, 24 * 60);
    int affected =
        jdbcTemplate.update(
            """
            UPDATE crawler_task_item
            SET retry_count = retry_count + 1,
                status = CASE
                  WHEN retry_count + 1 >= max_retry_count THEN 'FAILED'
                  ELSE 'RETRY_WAITING'
                END,
                next_retry_at = CASE
                  WHEN retry_count + 1 >= max_retry_count THEN NULL
                  ELSE NOW(3)
                END,
                last_finished_at = NOW(3),
                last_error = 'STALE_RUNNING_RECLAIMED',
                update_time = NOW(3)
            WHERE source_id = ?
              AND status = 'RUNNING'
              AND last_started_at IS NOT NULL
              AND last_started_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)
            """,
            sourceId,
            staleMinutes);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("reclaimedCount", affected);
    result.put("sourceId", sourceId);
    result.put("staleMinutes", staleMinutes);
    return result;
  }

  /** 查询雷达公开机会采集任务详情。旧 GET 会 ensure 表结构；Spring Boot 只读现有任务表。 */
  public Map<String, Object> findRadarCollectTaskById(JdbcTemplate jdbcTemplate, String taskId) {
    if (!StringUtils.hasText(taskId) || !hasRadarCollectTaskColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              task_id AS taskId,
              status,
              created,
              updated,
              skipped,
              total,
              duration_ms AS durationMs,
              error_reason AS errorReason,
              started_at AS startedAt,
              completed_at AS completedAt
            FROM investment_radar_collect_task
            WHERE task_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> radarCollectTaskMap(rs),
            taskId.trim());
    return rows.isEmpty() ? null : rows.get(0);
  }

  /**
   * 创建公开机会采集任务。
   *
   * <p>旧端会在任务内重建公开机会外部线索；这里保留本地 DB 派生动作，不做任何外部采集。
   */
  public Map<String, Object> createRadarCollectTask(JdbcTemplate jdbcTemplate) {
    if (!hasRadarCollectTaskColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "公开机会采集任务表结构未准备好");
    }
    String taskId = "radar_collect_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
    Instant startedAt = Instant.now();
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_radar_collect_task (
                    task_id, status, created, updated, skipped, total,
                    started_at, create_time, update_time
                  )
                  VALUES (?, 'RUNNING', 0, 0, 0, 0, NOW(3), NOW(3), NOW(3))
                  """,
                  taskId);
              try {
                Map<String, Object> rebuild = rebuildExternalLeadsFromPublicOpportunity(jdbcTemplate);
                int created = (int) longValue(rebuild.get("createdLeadCount"));
                int updated = (int) longValue(rebuild.get("updatedLeadCount"));
                int skipped = (int) longValue(rebuild.get("skippedCount"));
                int total = (int) longValue(rebuild.get("scannedCount"));
                jdbcTemplate.update(
                    """
                    UPDATE investment_radar_collect_task
                    SET status = 'SUCCESS',
                        created = ?,
                        updated = ?,
                        skipped = ?,
                        total = ?,
                        duration_ms = ?,
                        error_reason = NULL,
                        completed_at = NOW(3),
                        update_time = NOW(3)
                    WHERE task_id = ?
                    """,
                    created,
                    updated,
                    skipped,
                    total,
                    durationMillisSince(startedAt),
                    taskId);
              } catch (RuntimeException error) {
                jdbcTemplate.update(
                    """
                    UPDATE investment_radar_collect_task
                    SET status = 'FAILED',
                        duration_ms = ?,
                        error_reason = ?,
                        completed_at = NOW(3),
                        update_time = NOW(3)
                    WHERE task_id = ?
                    """,
                    durationMillisSince(startedAt),
                    trimToMax(error.getMessage(), 500),
                    taskId);
              }
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("task", findRadarCollectTaskById(jdbcTemplate, taskId));
              result.put("taskId", taskId);
              return result;
            });
  }

  /** 查询雷达信号事件。GET 迁移保持只读，不触发旧接口的外部线索刷新。 */
  public Map<String, Object> findSignalEvents(
      JdbcTemplate jdbcTemplate,
      int currentPage,
      int pageSize,
      String companyName,
      String eventType,
      String keyword,
      String sourceName,
      String sourceType,
      String status) {
    if (!hasColumns(
        jdbcTemplate,
        "signal_event",
        "event_id",
        "enterprise_id",
        "company_name",
        "event_type",
        "event_title",
        "event_summary",
        "event_time",
        "source_type",
        "source_name",
        "source_url",
        "confidence_score",
        "status",
        "related_external_lead_id",
        "related_radar_lead_id",
        "content_hash",
        "raw_payload_json",
        "create_time",
        "update_time",
        "is_deleted")) {
      return pageResult(List.of(), 0, currentPage, pageSize);
    }

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("is_deleted = 0");
    appendEquals(conditions, args, "event_type = ?", eventType);
    appendEquals(conditions, args, "status = ?", status);
    appendEquals(conditions, args, "source_type = ?", sourceType);
    appendLike(conditions, args, "company_name LIKE ?", companyName);
    appendLike(conditions, args, "source_name LIKE ?", sourceName);
    if (StringUtils.hasText(keyword)) {
      conditions.add(
          "(company_name LIKE ? OR event_title LIKE ? OR event_summary LIKE ? OR source_url LIKE ?)");
      String likeKeyword = like(keyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) FROM signal_event " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((currentPage - 1) * pageSize);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              event_id AS eventId,
              enterprise_id AS enterpriseId,
              company_name AS companyName,
              event_type AS eventType,
              event_title AS eventTitle,
              event_summary AS eventSummary,
              event_time AS eventTime,
              source_type AS sourceType,
              source_name AS sourceName,
              source_url AS sourceUrl,
              confidence_score AS confidenceScore,
              status,
              related_external_lead_id AS relatedExternalLeadId,
              related_radar_lead_id AS relatedRadarLeadId,
              content_hash AS contentHash,
              raw_payload_json AS rawPayloadJson,
              create_time AS createTime,
              update_time AS updateTime
            FROM signal_event
            """
                + whereSql
                + """

            ORDER BY event_time DESC, update_time DESC, event_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> signalEventMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, currentPage, pageSize);
  }

  /** 查询雷达信号事件详情，并按旧接口附带证据数组。 */
  public Map<String, Object> findSignalEventById(JdbcTemplate jdbcTemplate, long eventId) {
    if (!hasColumns(
        jdbcTemplate,
        "signal_event",
        "event_id",
        "enterprise_id",
        "company_name",
        "event_type",
        "event_title",
        "event_summary",
        "event_time",
        "source_type",
        "source_name",
        "source_url",
        "confidence_score",
        "status",
        "related_external_lead_id",
        "related_radar_lead_id",
        "content_hash",
        "raw_payload_json",
        "create_time",
        "update_time",
        "is_deleted")) {
      return null;
    }

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              event_id AS eventId,
              enterprise_id AS enterpriseId,
              company_name AS companyName,
              event_type AS eventType,
              event_title AS eventTitle,
              event_summary AS eventSummary,
              event_time AS eventTime,
              source_type AS sourceType,
              source_name AS sourceName,
              source_url AS sourceUrl,
              confidence_score AS confidenceScore,
              status,
              related_external_lead_id AS relatedExternalLeadId,
              related_radar_lead_id AS relatedRadarLeadId,
              content_hash AS contentHash,
              raw_payload_json AS rawPayloadJson,
              create_time AS createTime,
              update_time AS updateTime
            FROM signal_event
            WHERE event_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> signalEventMap(rs),
            eventId);
    if (rows.isEmpty()) {
      return null;
    }
    Map<String, Object> event = new LinkedHashMap<>(rows.get(0));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> evidences =
        (List<Map<String, Object>>) findSignalEventEvidences(jdbcTemplate, eventId).get("items");
    event.put("evidences", evidences);
    return event;
  }

  /** 更新企业信号状态；只写 `signal_event.status`，不执行信号刷新或转线索。 */
  public Map<String, Object> updateSignalEvent(
      JdbcTemplate jdbcTemplate, long eventId, SignalEventUpdateRequest request) {
    if (!hasSignalEventWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "企业信号表结构未准备好");
    }
    String status = cleanText(request == null ? null : request.status());
    if (!Set.of("CONVERTED", "IGNORED", "NEW", "REVIEWED").contains(status)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "status 无效");
    }
    int affected =
        jdbcTemplate.update(
            """
            UPDATE signal_event
            SET status = ?, update_time = NOW(3)
            WHERE event_id = ? AND is_deleted = 0
            """,
            status,
            eventId);
    return affected == 0 ? null : findSignalEventById(jdbcTemplate, eventId);
  }

  /** 企业信号转招商雷达线索；仅落本地企业、线索和信号状态，不触发外部发送。 */
  public Map<String, Object> convertSignalEventToRadarLead(
      JdbcTemplate jdbcTemplate, long eventId, RadarLeadConvertRequest request) {
    if (!hasSignalEventConvertColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "企业信号转换表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> event = findSignalEventConversionSeed(jdbcTemplate, eventId);
              if (event == null) {
                return null;
              }
              Object relatedRadarLeadId = event.get("relatedRadarLeadId");
              if (relatedRadarLeadId instanceof Number number && number.longValue() > 0) {
                return signalEventConvertResult(eventId, number.longValue(), true);
              }

              long radarLeadId;
              boolean reused;
              Object relatedExternalLeadId = event.get("relatedExternalLeadId");
              if (relatedExternalLeadId instanceof Number number && number.longValue() > 0) {
                RadarLeadConvertRequest externalRequest =
                    new RadarLeadConvertRequest(
                        request == null ? null : request.ownerUserId(),
                        defaultString(
                            cleanText(request == null ? null : request.remark()),
                            "企业信号确认有效，转入雷达潜客"));
                Map<String, Object> externalResult =
                    convertExternalLeadToRadarLead(jdbcTemplate, number.longValue(), externalRequest);
                if (externalResult == null) {
                  throw new IllegalStateException("related external lead convert failed");
                }
                radarLeadId = longValue(externalResult.get("radarLeadId"));
                reused = booleanValue(externalResult.get("reused"));
              } else {
                long enterpriseId = longValue(event.get("enterpriseId"));
                if (enterpriseId <= 0) {
                  enterpriseId =
                      findEnterpriseIdByName(jdbcTemplate, stringObject(event.get("companyName")));
                }
                if (enterpriseId <= 0) {
                  enterpriseId = createEnterpriseFromSignalEvent(jdbcTemplate, event);
                }
                long existingRadarLeadId = findExistingRadarLeadId(jdbcTemplate, enterpriseId);
                reused = existingRadarLeadId > 0;
                radarLeadId =
                    existingRadarLeadId > 0
                        ? existingRadarLeadId
                        : createRadarLeadFromSignalEvent(jdbcTemplate, enterpriseId, event, request);
              }

              jdbcTemplate.update(
                  """
                  UPDATE signal_event
                  SET related_radar_lead_id = ?,
                      status = 'CONVERTED',
                      update_time = NOW(3)
                  WHERE event_id = ? AND is_deleted = 0
                  """,
                  radarLeadId,
                  eventId);
              return signalEventConvertResult(eventId, radarLeadId, reused);
            });
  }

  /** 查询雷达信号事件证据。 */
  public Map<String, Object> findSignalEventEvidences(JdbcTemplate jdbcTemplate, long eventId) {
    if (!hasColumns(
        jdbcTemplate,
        "signal_evidence",
        "evidence_id",
        "event_id",
        "evidence_type",
        "source_title",
        "source_link",
        "raw_text",
        "matched_keywords_json",
        "matched_sentences_json",
        "score_delta",
        "content_hash",
        "published_at",
        "crawled_at",
        "is_deleted")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              evidence_id AS evidenceId,
              event_id AS eventId,
              evidence_type AS evidenceType,
              source_title AS sourceTitle,
              source_link AS sourceLink,
              raw_text AS rawText,
              matched_keywords_json AS matchedKeywordsJson,
              matched_sentences_json AS matchedSentencesJson,
              score_delta AS scoreDelta,
              content_hash AS contentHash,
              published_at AS publishedAt,
              crawled_at AS crawledAt
            FROM signal_evidence
            WHERE event_id = ? AND is_deleted = 0
            ORDER BY score_delta DESC, evidence_id ASC
            """,
            (rs, rowNum) -> signalEventEvidenceMap(rs),
            eventId);
    return listResult(rows, rows.size());
  }

  /** 从现有 company_lead/lead_evidence 刷新 signal_event/signal_evidence。 */
  public Map<String, Object> refreshSignalEventsFromExternalLeads(JdbcTemplate jdbcTemplate) {
    if (!hasSignalEventRefreshColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "企业信号刷新表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              int deletedDirtyEventCount = softDeleteDirtySignalEvents(jdbcTemplate);
              List<Map<String, Object>> leads = findSignalRefreshSourceLeads(jdbcTemplate);
              int createdEventCount = 0;
              int updatedEventCount = 0;
              int createdEvidenceCount = 0;
              int updatedEvidenceCount = 0;

              for (Map<String, Object> lead : leads) {
                if (!canRefreshSignalFromLead(lead)) {
                  continue;
                }
                String contentHash = signalEventHash(lead);
                Long existingEventId = findSignalEventIdByHash(jdbcTemplate, contentHash);
                upsertSignalEventFromLead(jdbcTemplate, lead, contentHash);
                long eventId =
                    existingEventId == null
                        ? defaultLong(findSignalEventIdByHash(jdbcTemplate, contentHash))
                        : existingEventId;
                if (eventId <= 0) {
                  continue;
                }
                if (existingEventId == null) {
                  createdEventCount += 1;
                } else {
                  updatedEventCount += 1;
                }

                for (Map<String, Object> evidence : findLeadEvidenceSeeds(jdbcTemplate, lead.get("leadId"))) {
                  String evidenceHash = signalEvidenceHash(evidence);
                  Long existingEvidenceId =
                      findSignalEvidenceIdByHash(jdbcTemplate, eventId, evidenceHash);
                  upsertSignalEvidenceFromLeadEvidence(
                      jdbcTemplate, eventId, evidence, evidenceHash);
                  if (existingEvidenceId == null) {
                    createdEvidenceCount += 1;
                  } else {
                    updatedEvidenceCount += 1;
                  }
                }
              }

              Map<String, Object> result = new LinkedHashMap<>();
              result.put("createdEventCount", createdEventCount);
              result.put("createdEvidenceCount", createdEvidenceCount);
              result.put("deletedDirtyEventCount", deletedDirtyEventCount);
              result.put("totalSourceLeadCount", leads.size());
              result.put("updatedEventCount", updatedEventCount);
              result.put("updatedEvidenceCount", updatedEvidenceCount);
              return result;
            });
  }

  /** 查询雷达外部线索。GET 迁移保持只读，不执行旧接口的 schema repair/seed。 */
  public Map<String, Object> findExternalLeads(
      JdbcTemplate jdbcTemplate,
      int currentPage,
      int pageSize,
      String confidenceLevel,
      String demandType,
      String industryName,
      String keyword,
      String regionCity,
      String sourceName,
      String sourceType,
      String status) {
    if (!hasColumns(
        jdbcTemplate,
        "company_lead",
        "lead_id",
        "source_id",
        "source_name",
        "source_url",
        "source_title",
        "source_type",
        "company_name",
        "lead_title",
        "summary",
        "demand_type",
        "confidence_score",
        "confidence_level",
        "industry_name",
        "region_province",
        "region_city",
        "region_district",
        "hit_keywords",
        "evidence_count",
        "status",
        "owner_user_id",
        "invalid_reason",
        "remark",
        "converted_radar_lead_id",
        "converted_at",
        "first_seen_at",
        "last_seen_at",
        "crawled_at",
        "update_time",
        "is_deleted")) {
      return pageResult(List.of(), 0, currentPage, pageSize);
    }

    boolean hasUser = hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
    boolean hasRadarLead =
        hasColumns(jdbcTemplate, "investment_lead", "lead_id", "is_deleted");
    String userJoin = hasUser ? "LEFT JOIN user u ON u.id = l.owner_user_id" : "";
    String ownerNameSelect = hasUser ? "COALESCE(u.real_name, u.username) AS ownerName" : "NULL AS ownerName";
    String radarLeadJoin =
        hasRadarLead
            ? """
            LEFT JOIN investment_lead radar_lead
              ON radar_lead.lead_id = l.converted_radar_lead_id
              AND radar_lead.is_deleted = 0
            """
            : "";
    String convertedSelect =
        hasRadarLead
            ? """
              CASE
                WHEN radar_lead.lead_id IS NULL THEN NULL
                ELSE l.converted_radar_lead_id
              END AS convertedRadarLeadId,
              CASE
                WHEN radar_lead.lead_id IS NULL THEN NULL
                ELSE l.converted_at
              END AS convertedAt,
            """
            : """
              l.converted_radar_lead_id AS convertedRadarLeadId,
              l.converted_at AS convertedAt,
            """;

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("l.is_deleted = 0");
    appendEquals(conditions, args, "l.status = ?", status);
    appendEquals(conditions, args, "l.confidence_level = ?", confidenceLevel);
    appendEquals(conditions, args, "l.demand_type = ?", demandType);
    appendLike(conditions, args, "l.region_city LIKE ?", regionCity);
    appendLike(conditions, args, "l.industry_name LIKE ?", industryName);
    appendLike(conditions, args, "l.source_name LIKE ?", sourceName);
    appendEquals(conditions, args, "l.source_type = ?", sourceType);
    if (StringUtils.hasText(keyword)) {
      conditions.add(
          "(l.company_name LIKE ? OR l.lead_title LIKE ? OR l.summary LIKE ? OR l.source_url LIKE ?)");
      String likeKeyword = like(keyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) FROM company_lead l " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((currentPage - 1) * pageSize);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.source_id AS sourceId,
              l.source_name AS sourceName,
              l.source_url AS sourceUrl,
              l.source_title AS sourceTitle,
              l.source_type AS sourceType,
              l.company_name AS companyName,
              l.lead_title AS leadTitle,
              l.summary,
              l.demand_type AS demandType,
              l.confidence_score AS confidenceScore,
              l.confidence_level AS confidenceLevel,
              l.industry_name AS industryName,
              l.region_province AS regionProvince,
              l.region_city AS regionCity,
              l.region_district AS regionDistrict,
              l.hit_keywords AS hitKeywords,
              l.evidence_count AS evidenceCount,
              l.status,
              l.owner_user_id AS ownerUserId,
            """
                + ownerNameSelect
                + ",\n"
                + """
              l.invalid_reason AS invalidReason,
              l.remark,
            """
                + convertedSelect
                + """
              l.first_seen_at AS firstSeenAt,
              l.last_seen_at AS lastSeenAt,
              l.crawled_at AS crawledAt,
              l.update_time AS updateTime
            FROM company_lead l
            """
                + userJoin
                + "\n"
                + radarLeadJoin
                + whereSql
                + """

            ORDER BY l.update_time DESC, l.lead_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> externalLeadMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, currentPage, pageSize);
  }

  /** 查询雷达外部公开线索详情，并按旧接口附带证据数组。 */
  public Map<String, Object> findExternalLeadById(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(
        jdbcTemplate,
        "company_lead",
        "lead_id",
        "source_id",
        "source_name",
        "source_url",
        "source_title",
        "source_type",
        "company_name",
        "lead_title",
        "summary",
        "demand_type",
        "confidence_score",
        "confidence_level",
        "industry_name",
        "region_province",
        "region_city",
        "region_district",
        "hit_keywords",
        "evidence_count",
        "status",
        "owner_user_id",
        "invalid_reason",
        "remark",
        "converted_radar_lead_id",
        "converted_at",
        "first_seen_at",
        "last_seen_at",
        "crawled_at",
        "update_time",
        "is_deleted")) {
      return null;
    }

    boolean hasUser = hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
    boolean hasRadarLead =
        hasColumns(jdbcTemplate, "investment_lead", "lead_id", "is_deleted");
    String userJoin = hasUser ? "LEFT JOIN user u ON u.id = l.owner_user_id" : "";
    String ownerNameSelect = hasUser ? "COALESCE(u.real_name, u.username) AS ownerName" : "NULL AS ownerName";
    String radarLeadJoin =
        hasRadarLead
            ? """
            LEFT JOIN investment_lead radar_lead
              ON radar_lead.lead_id = l.converted_radar_lead_id
              AND radar_lead.is_deleted = 0
            """
            : "";
    String convertedSelect =
        hasRadarLead
            ? """
              CASE
                WHEN radar_lead.lead_id IS NULL THEN NULL
                ELSE l.converted_radar_lead_id
              END AS convertedRadarLeadId,
              CASE
                WHEN radar_lead.lead_id IS NULL THEN NULL
                ELSE l.converted_at
              END AS convertedAt,
            """
            : """
              l.converted_radar_lead_id AS convertedRadarLeadId,
              l.converted_at AS convertedAt,
            """;

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.source_id AS sourceId,
              l.source_name AS sourceName,
              l.source_url AS sourceUrl,
              l.source_title AS sourceTitle,
              l.source_type AS sourceType,
              l.company_name AS companyName,
              l.lead_title AS leadTitle,
              l.summary,
              l.demand_type AS demandType,
              l.confidence_score AS confidenceScore,
              l.confidence_level AS confidenceLevel,
              l.industry_name AS industryName,
              l.region_province AS regionProvince,
              l.region_city AS regionCity,
              l.region_district AS regionDistrict,
              l.hit_keywords AS hitKeywords,
              l.evidence_count AS evidenceCount,
              l.status,
              l.owner_user_id AS ownerUserId,
            """
                + ownerNameSelect
                + ",\n"
                + """
              l.invalid_reason AS invalidReason,
              l.remark,
            """
                + convertedSelect
                + """
              l.first_seen_at AS firstSeenAt,
              l.last_seen_at AS lastSeenAt,
              l.crawled_at AS crawledAt,
              l.update_time AS updateTime
            FROM company_lead l
            """
                + userJoin
                + "\n"
                + radarLeadJoin
                + """
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> externalLeadMap(rs),
            leadId);
    if (rows.isEmpty()) {
      return null;
    }
    Map<String, Object> lead = new LinkedHashMap<>(rows.get(0));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> evidences =
        (List<Map<String, Object>>) findExternalLeadEvidences(jdbcTemplate, leadId).get("items");
    lead.put("evidences", evidences);
    return lead;
  }

  /** 查询雷达外部公开线索证据。 */
  public Map<String, Object> findExternalLeadEvidences(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(
        jdbcTemplate,
        "lead_evidence",
        "evidence_id",
        "lead_id",
        "evidence_type",
        "source_title",
        "source_link",
        "raw_text",
        "matched_keywords",
        "matched_sentences",
        "score_delta",
        "content_hash",
        "published_at",
        "crawled_at",
        "is_deleted")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              evidence_id AS evidenceId,
              lead_id AS leadId,
              evidence_type AS evidenceType,
              source_title AS sourceTitle,
              source_link AS sourceLink,
              raw_text AS rawText,
              matched_keywords AS matchedKeywords,
              matched_sentences AS matchedSentences,
              score_delta AS scoreDelta,
              content_hash AS contentHash,
              published_at AS publishedAt,
              crawled_at AS crawledAt
            FROM lead_evidence
            WHERE lead_id = ? AND is_deleted = 0
            ORDER BY score_delta DESC, evidence_id ASC
            """,
            (rs, rowNum) -> externalLeadEvidenceMap(rs),
            leadId);
    return listResult(rows, rows.size());
  }

  /** 更新外部公开线索本地字段；不触发旧端 convert 或 evidence 修复逻辑。 */
  public Map<String, Object> updateExternalLead(
      JdbcTemplate jdbcTemplate, long leadId, ExternalLeadUpdateRequest request) {
    if (!hasExternalLeadWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "外部公开线索表结构未准备好");
    }
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    if (request != null && request.statusPresent()) {
      String status = cleanText(request.status());
      if (!Set.of("ASSIGNED", "FOLLOWING", "INVALID", "NEW", "PENDING_REVIEW", "VISITED", "WON")
          .contains(status)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "status 无效");
      }
      assignments.add("status = ?");
      args.add(status);
    }
    if (request != null && request.ownerUserIdPresent()) {
      if (request.ownerUserId() == null) {
        assignments.add("owner_user_id = ?");
        args.add(null);
      } else {
      Long ownerUserId = nullableLongObject(request.ownerUserId());
      if (ownerUserId == null) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "ownerUserId 无效");
      }
      assignments.add("owner_user_id = ?");
      args.add(ownerUserId);
      }
    }
    if (request != null && request.remarkPresent()) {
      assignments.add("remark = ?");
      args.add(blankToNullObject(request.remark()));
    }
    if (request != null && request.invalidReasonPresent()) {
      assignments.add("invalid_reason = ?");
      args.add(blankToNullObject(request.invalidReason()));
    }
    if (assignments.isEmpty()) {
      return findExternalLeadUpdateResult(jdbcTemplate, leadId);
    }
    assignments.add("update_time = NOW(3)");
    args.add(leadId);
    int affected =
        jdbcTemplate.update(
            "UPDATE company_lead SET "
                + String.join(", ", assignments)
                + " WHERE lead_id = ? AND is_deleted = 0",
            args.toArray());
    return affected == 0 ? null : findExternalLeadUpdateResult(jdbcTemplate, leadId);
  }

  /** 外部公开线索转招商雷达线索；复刻旧端本地写库流程，不触发爬虫或外部服务。 */
  public Map<String, Object> convertExternalLeadToRadarLead(
      JdbcTemplate jdbcTemplate, long leadId, RadarLeadConvertRequest request) {
    if (!hasExternalLeadConvertColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "外部公开线索转换表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> lead = findExternalLeadConversionSeed(jdbcTemplate, leadId);
              if (lead == null) {
                return null;
              }
              Object convertedRadarLeadId = lead.get("convertedRadarLeadId");
              if (convertedRadarLeadId instanceof Number number && number.longValue() > 0) {
                return radarLeadConvertResult(
                    "externalLeadId",
                    leadId,
                    number.longValue(),
                    true,
                    lead.get("convertedAt"));
              }

              long enterpriseId =
                  findEnterpriseIdByName(jdbcTemplate, stringObject(lead.get("companyName")));
              if (enterpriseId <= 0) {
                enterpriseId = createEnterpriseFromExternalLead(jdbcTemplate, lead);
              }
              long radarLeadId = findExistingRadarLeadId(jdbcTemplate, enterpriseId);
              boolean reused = radarLeadId > 0;
              if (radarLeadId <= 0) {
                radarLeadId = createRadarLeadFromExternalLead(jdbcTemplate, enterpriseId, lead, request);
              }

              String remark = cleanText(request == null ? null : request.remark());
              jdbcTemplate.update(
                  """
                  UPDATE company_lead
                  SET converted_radar_lead_id = ?,
                      converted_at = COALESCE(converted_at, NOW(3)),
                      status = CASE WHEN status = 'NEW' THEN 'PENDING_REVIEW' ELSE status END,
                      owner_user_id = COALESCE(?, owner_user_id),
                      remark = CASE WHEN ? = '' THEN remark ELSE ? END,
                      update_time = NOW(3)
                  WHERE lead_id = ? AND is_deleted = 0
                  """,
                  radarLeadId,
                  nullableLongObject(request == null ? null : request.ownerUserId()),
                  defaultString(remark),
                  remark,
                  leadId);
              Map<String, Object> updated = findExternalLeadConversionSeed(jdbcTemplate, leadId);
              return radarLeadConvertResult(
                  "externalLeadId",
                  leadId,
                  radarLeadId,
                  reused,
                  updated == null ? null : updated.get("convertedAt"));
            });
  }

  /** 查询雷达企业画像。GET 迁移保持只读，不触发旧接口的画像重建。 */
  public Map<String, Object> findEnterpriseProfiles(
      JdbcTemplate jdbcTemplate,
      int currentPage,
      int pageSize,
      String industryName,
      String keyword,
      String regionCity) {
    if (!hasColumns(
        jdbcTemplate,
        "enterprise_profile",
        "profile_id",
        "enterprise_id",
        "company_name",
        "unified_social_credit_code",
        "industry_name",
        "industry_tags_json",
        "region_province",
        "region_city",
        "region_district",
        "registered_capital",
        "employee_scale",
        "business_scope",
        "address",
        "last_signal_time",
        "signal_count",
        "latest_intent_type",
        "profile_completeness",
        "create_time",
        "update_time",
        "is_deleted")) {
      return pageResult(List.of(), 0, currentPage, pageSize);
    }

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("is_deleted = 0");
    appendLike(conditions, args, "industry_name LIKE ?", industryName);
    appendLike(conditions, args, "region_city LIKE ?", regionCity);
    if (StringUtils.hasText(keyword)) {
      conditions.add("(company_name LIKE ? OR industry_name LIKE ? OR region_city LIKE ? OR address LIKE ?)");
      String likeKeyword = like(keyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) FROM enterprise_profile " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((currentPage - 1) * pageSize);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              profile_id AS profileId,
              enterprise_id AS enterpriseId,
              company_name AS companyName,
              unified_social_credit_code AS unifiedSocialCreditCode,
              industry_name AS industryName,
              industry_tags_json AS industryTagsJson,
              region_province AS regionProvince,
              region_city AS regionCity,
              region_district AS regionDistrict,
              registered_capital AS registeredCapital,
              employee_scale AS employeeScale,
              business_scope AS businessScope,
              address,
              last_signal_time AS lastSignalTime,
              signal_count AS signalCount,
              latest_intent_type AS latestIntentType,
              profile_completeness AS profileCompleteness,
              create_time AS createTime,
              update_time AS updateTime
            FROM enterprise_profile
            """
                + whereSql
                + """

            ORDER BY last_signal_time DESC, update_time DESC, profile_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> enterpriseProfileMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, currentPage, pageSize);
  }

  /** 查询雷达企业画像详情。 */
  public Map<String, Object> findEnterpriseProfileById(JdbcTemplate jdbcTemplate, long profileId) {
    if (!hasColumns(
        jdbcTemplate,
        "enterprise_profile",
        "profile_id",
        "enterprise_id",
        "company_name",
        "unified_social_credit_code",
        "industry_name",
        "industry_tags_json",
        "region_province",
        "region_city",
        "region_district",
        "registered_capital",
        "employee_scale",
        "business_scope",
        "address",
        "last_signal_time",
        "signal_count",
        "latest_intent_type",
        "profile_completeness",
        "create_time",
        "update_time",
        "is_deleted")) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              profile_id AS profileId,
              enterprise_id AS enterpriseId,
              company_name AS companyName,
              unified_social_credit_code AS unifiedSocialCreditCode,
              industry_name AS industryName,
              industry_tags_json AS industryTagsJson,
              region_province AS regionProvince,
              region_city AS regionCity,
              region_district AS regionDistrict,
              registered_capital AS registeredCapital,
              employee_scale AS employeeScale,
              business_scope AS businessScope,
              address,
              last_signal_time AS lastSignalTime,
              signal_count AS signalCount,
              latest_intent_type AS latestIntentType,
              profile_completeness AS profileCompleteness,
              create_time AS createTime,
              update_time AS updateTime
            FROM enterprise_profile
            WHERE profile_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> enterpriseProfileMap(rs),
            profileId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询雷达企业画像关联信号。 */
  public Map<String, Object> findEnterpriseProfileSignals(
      JdbcTemplate jdbcTemplate, long profileId) {
    Map<String, Object> profile = findEnterpriseProfileById(jdbcTemplate, profileId);
    if (profile == null) {
      return null;
    }
    if (!hasColumns(
        jdbcTemplate,
        "signal_event",
        "event_id",
        "company_name",
        "event_type",
        "event_title",
        "event_summary",
        "event_time",
        "source_type",
        "source_name",
        "source_url",
        "confidence_score",
        "status",
        "related_external_lead_id",
        "related_radar_lead_id",
        "is_deleted")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              event_id AS eventId,
              company_name AS companyName,
              event_type AS eventType,
              event_title AS eventTitle,
              event_summary AS eventSummary,
              event_time AS eventTime,
              source_type AS sourceType,
              source_name AS sourceName,
              source_url AS sourceUrl,
              confidence_score AS confidenceScore,
              status,
              related_external_lead_id AS relatedExternalLeadId,
              related_radar_lead_id AS relatedRadarLeadId
            FROM signal_event
            WHERE company_name = ? AND is_deleted = 0
            ORDER BY event_time DESC, event_id DESC
            """,
            (rs, rowNum) -> enterpriseProfileSignalMap(rs),
            profile.get("companyName"));
    return listResult(rows, rows.size());
  }

  /** 查询雷达企业画像标签。 */
  public Map<String, Object> findEnterpriseProfileTags(JdbcTemplate jdbcTemplate, long profileId) {
    Map<String, Object> profile = findEnterpriseProfileById(jdbcTemplate, profileId);
    if (profile == null) {
      return null;
    }
    if (!hasColumns(
        jdbcTemplate,
        "enterprise_tag",
        "tag_id",
        "enterprise_id",
        "company_name",
        "tag_type",
        "tag_name",
        "tag_source",
        "confidence_score",
        "create_time",
        "update_time",
        "is_deleted")) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              tag_id AS tagId,
              enterprise_id AS enterpriseId,
              company_name AS companyName,
              tag_type AS tagType,
              tag_name AS tagName,
              tag_source AS tagSource,
              confidence_score AS confidenceScore,
              create_time AS createTime,
              update_time AS updateTime
            FROM enterprise_tag
            WHERE company_name = ? AND is_deleted = 0
            ORDER BY tag_type ASC, confidence_score DESC, tag_id ASC
            """,
            (rs, rowNum) -> enterpriseProfileTagMap(rs),
            profile.get("companyName"));
    return listResult(rows, rows.size());
  }

  /** 从现有 signal_event/company_lead/investment_enterprise 刷新企业画像和标签。 */
  public Map<String, Object> refreshEnterpriseProfilesFromSignals(JdbcTemplate jdbcTemplate) {
    if (!hasEnterpriseProfileRefreshColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "企业画像刷新表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              List<Map<String, Object>> rows = findEnterpriseProfileRefreshRows(jdbcTemplate);
              Map<String, List<Map<String, Object>>> grouped = groupRowsByCompanyName(rows);
              int createdProfileCount = 0;
              int updatedProfileCount = 0;
              int createdTagCount = 0;
              int updatedTagCount = 0;

              for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
                EnterpriseProfileDerived derived = deriveEnterpriseProfile(entry.getKey(), entry.getValue());
                boolean existingProfile = findEnterpriseProfileIdByCompanyName(jdbcTemplate, entry.getKey()) != null;
                upsertEnterpriseProfile(jdbcTemplate, derived);
                if (existingProfile) {
                  updatedProfileCount += 1;
                } else {
                  createdProfileCount += 1;
                }

                jdbcTemplate.update(
                    "UPDATE enterprise_tag SET is_deleted = 1, update_time = NOW(3) WHERE company_name = ?",
                    entry.getKey());
                for (String tagName : derived.industryTags()) {
                  boolean existed =
                      upsertEnterpriseTag(
                          jdbcTemplate,
                          derived.enterpriseId(),
                          entry.getKey(),
                          tagName,
                          enterpriseProfileTagType(tagName),
                          "SIGNAL_EVENT",
                          maxConfidenceScore(entry.getValue()));
                  if (existed) {
                    updatedTagCount += 1;
                  } else {
                    createdTagCount += 1;
                  }
                }
                for (String eventType : eventTypes(entry.getValue())) {
                  String tagName = eventTypeLabel(eventType);
                  boolean existed =
                      upsertEnterpriseTag(
                          jdbcTemplate,
                          derived.enterpriseId(),
                          entry.getKey(),
                          tagName,
                          "INTENT",
                          "SIGNAL_EVENT",
                          maxConfidenceScore(entry.getValue()));
                  if (existed) {
                    updatedTagCount += 1;
                  } else {
                    createdTagCount += 1;
                  }
                }
              }

              Map<String, Object> result = new LinkedHashMap<>();
              result.put("createdProfileCount", createdProfileCount);
              result.put("createdTagCount", createdTagCount);
              result.put("signalEventCount", rows.size());
              result.put("sourceCompanyCount", grouped.size());
              result.put("updatedProfileCount", updatedProfileCount);
              result.put("updatedTagCount", updatedTagCount);
              return result;
            });
  }

  /** 查询公开机会有效列表。只读迁移不执行旧 `ensurePublicOpportunityStorage` 的建表/补字段。 */
  public Map<String, Object> findPublicOpportunityEffectiveList(
      JdbcTemplate jdbcTemplate, PublicOpportunityQuery query) {
    if (!hasPublicOpportunityColumns(jdbcTemplate)) {
      return emptyPublicOpportunityList(query);
    }

    List<Object> args = new ArrayList<>();
    String whereSql = buildPublicOpportunityWhere(query, query.scope(), args);
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT
            """
                + publicOpportunitySelectColumns("opo.")
                + """

            FROM investment_public_opportunity opo
            WHERE
            """
                + whereSql
                + """

            ORDER BY
              CASE WHEN opo.published_at IS NULL THEN 1 ELSE 0 END ASC,
              opo.published_at DESC,
              opo.last_synced_at DESC,
              opo.opportunity_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> publicOpportunityMap(rs),
            pageArgs.toArray());

    if (!query.includeMeta()) {
      if (!query.includeTotal()) {
        Long knownTotal =
            query.currentPage() == 1 && items.size() < query.pageSize() ? (long) items.size() : null;
        Map<String, Object> result =
            publicOpportunityPageResult(items, query, knownTotal, knownTotal != null);
        result.put("totalKnown", knownTotal != null);
        return result;
      }
      long total = count(jdbcTemplate, "SELECT COUNT(*) FROM investment_public_opportunity opo WHERE " + whereSql, args);
      return publicOpportunityPageResult(items, query, total, true);
    }

    Map<String, Object> stats = findPublicOpportunityEffectiveStats(jdbcTemplate, query);
    Map<String, Object> options = findPublicOpportunityEffectiveOptions(jdbcTemplate, query);
    Map<String, Object> result =
        publicOpportunityPageResult(items, query, longValue(stats.get("total")), true);
    result.put("filters", options.get("filters"));
    result.put("strictTotal", stats.get("strictTotal"));
    return result;
  }

  /** 查询公开机会筛选项，返回来源站点和发布时间标签。 */
  public Map<String, Object> findPublicOpportunityEffectiveOptions(
      JdbcTemplate jdbcTemplate, PublicOpportunityQuery query) {
    if (!hasPublicOpportunityColumns(jdbcTemplate)) {
      return publicOpportunityFiltersResult(List.of(), List.of(), query.scope());
    }

    List<Object> args = new ArrayList<>();
    String whereSql = buildPublicOpportunityWhere(query, query.scope(), args);
    List<String> sourceSites =
        jdbcTemplate.queryForList(
            """
            SELECT DISTINCT opo.source_site AS value
            FROM investment_public_opportunity opo
            WHERE
            """
                + whereSql
                + """

              AND opo.source_site IS NOT NULL
              AND TRIM(opo.source_site) <> ''
            ORDER BY opo.source_site ASC
            LIMIT 100
            """,
            String.class,
            args.toArray());
    List<String> publishedAgeLabels =
        jdbcTemplate
            .query(
                """
                SELECT
                  """
                    + publicOpportunityPublishedAgeSql("opo.")
                    + """
                   AS value,
                  MIN(TIMESTAMPDIFF(HOUR, opo.published_at, NOW())) AS sortValue
                FROM investment_public_opportunity opo
                WHERE
                """
                    + whereSql
                    + """

                  AND opo.published_at IS NOT NULL
                GROUP BY value
                HAVING value IS NOT NULL AND value <> ''
                ORDER BY sortValue ASC
                LIMIT 100
                """,
                (rs, rowNum) -> rs.getString("value"),
                args.toArray())
            .stream()
            .map(this::nullableString)
            .filter(StringUtils::hasText)
            .toList();
    return publicOpportunityFiltersResult(
        sourceSites.stream().map(this::nullableString).filter(StringUtils::hasText).toList(),
        publishedAgeLabels,
        query.scope());
  }

  /** 查询公开机会统计，保持旧接口 `total/strictTotal/scope` 字段。 */
  public Map<String, Object> findPublicOpportunityEffectiveStats(
      JdbcTemplate jdbcTemplate, PublicOpportunityQuery query) {
    if (!hasPublicOpportunityColumns(jdbcTemplate)) {
      return publicOpportunityStatsResult(query.scope(), 0, 0);
    }

    List<Object> args = new ArrayList<>();
    String whereSql = buildPublicOpportunityWhere(query, query.scope(), args);
    long total =
        count(jdbcTemplate, "SELECT COUNT(*) FROM investment_public_opportunity opo WHERE " + whereSql, args);
    long strictTotal;
    if ("reviewable".equals(query.scope())) {
      strictTotal = 0;
    } else if ("strict".equals(query.scope())) {
      strictTotal = total;
    } else {
      List<Object> strictArgs = new ArrayList<>();
      String strictWhereSql = buildPublicOpportunityWhere(query, "strict", strictArgs);
      strictTotal =
          count(
              jdbcTemplate,
              "SELECT COUNT(*) FROM investment_public_opportunity opo WHERE " + strictWhereSql,
              strictArgs);
    }
    return publicOpportunityStatsResult(query.scope(), total, strictTotal);
  }

  /** 查询公开机会采集进度，只读汇总采集源、最新任务和 URL 项状态。 */
  public Map<String, Object> findPublicOpportunityEffectiveProgress(
      JdbcTemplate jdbcTemplate, String opportunityType) {
    String normalizedType = normalizePublicOpportunityType(opportunityType);
    List<String> sourceCodes = publicOpportunityProgressSourceCodes(normalizedType);
    if (!hasColumns(jdbcTemplate, "crawler_source", "source_id", "source_code", "source_name", "enabled")) {
      return publicOpportunityProgressResult(normalizedType, List.of());
    }

    List<Map<String, Object>> sourceRows =
        jdbcTemplate.query(
            """
            SELECT
              source_id AS sourceId,
              source_code AS sourceCode,
              source_name AS sourceName
            FROM crawler_source
            WHERE source_code IN (
            """
                + placeholders(sourceCodes.size())
                + """
            )
              AND enabled = 1
            ORDER BY source_id ASC
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("sourceCode", rs.getString("sourceCode"));
              map.put("sourceId", rs.getLong("sourceId"));
              map.put("sourceName", defaultString(rs.getString("sourceName")));
              return map;
            },
            sourceCodes.toArray());
    Map<String, Map<String, Object>> latestTaskBySource =
        publicOpportunityLatestTaskBySource(jdbcTemplate, sourceCodes);
    Map<String, Map<String, Integer>> itemStatusBySource =
        publicOpportunityItemStatusBySource(jdbcTemplate, sourceCodes);

    List<Map<String, Object>> sources =
        sourceRows.stream()
            .map(
                source -> {
                  String sourceCode = String.valueOf(source.get("sourceCode"));
                  Map<String, Object> row = new LinkedHashMap<>(source);
                  row.put("itemStatus", itemStatusBySource.getOrDefault(sourceCode, Map.of()));
                  row.put("latestTask", latestTaskBySource.getOrDefault(sourceCode, null));
                  return row;
                })
            .toList();
    return publicOpportunityProgressResult(normalizedType, sources);
  }

  /** 公开机会历史数据审计统计。旧端有内存缓存和 refresh 参数；Spring Boot 只做只读实时计算。 */
  public Map<String, Object> findPublicOpportunityAuditSummary(
      JdbcTemplate jdbcTemplate, String refresh) {
    if (!hasPublicOpportunityAuditColumns(jdbcTemplate)) {
      return emptyPublicOpportunityAuditSummary();
    }
    Map<String, Object> summary = publicOpportunityAuditCounts(jdbcTemplate, "");
    Map<String, Object> typeStats = new LinkedHashMap<>();
    for (String opportunityType : List.of("DEMAND", "SUPPLY")) {
      typeStats.put(
          opportunityType,
          publicOpportunityAuditCounts(jdbcTemplate, "WHERE opportunity_type = '" + opportunityType + "'"));
    }

    Map<String, Object> dashboard = publicOpportunityAuditDashboard(jdbcTemplate, summary);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("auditMode", "DRY_RUN");
    result.put("dashboard", dashboard);
    result.put("dryRun", true);
    result.put("generatedAt", Instant.now().toString());
    result.put("refresh", isTruthyText(refresh));
    result.put("summary", summary);
    result.put("typeStats", typeStats);
    return result;
  }

  /** 公开机会历史数据审计预览，返回问题权重最高的前 50 条。 */
  public Map<String, Object> findPublicOpportunityAuditPreview(JdbcTemplate jdbcTemplate) {
    if (!hasPublicOpportunityAuditColumns(jdbcTemplate)) {
      return publicOpportunityAuditPreviewResult(List.of(), 0);
    }
    String issueSql = publicOpportunityAuditIssueSql();
    long total =
        count(
            jdbcTemplate,
            "SELECT COUNT(*) FROM investment_public_opportunity opo WHERE " + issueSql,
            List.of(
                FUTURE_PUBLISHED_TOLERANCE_DAYS,
                EARLIEST_REASONABLE_PUBLISHED_AT,
                CREATED_PUBLISHED_TOLERANCE_DAYS));
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              opo.opportunity_id AS opportunityId,
              opo.opportunity_type AS opportunityType,
              opo.source_site AS sourceSite,
              opo.source_url AS sourceUrl,
              opo.source_table AS sourceTable,
              opo.source_id AS sourceId,
              opo.title,
              opo.city,
              opo.district,
              opo.area_text AS areaText,
              opo.published_at AS publishedAt,
              opo.published_date_text AS publishedDateText,
              opo.opportunity_status AS opportunityStatus,
              opo.score,
              LEFT(opo.description, 300) AS descriptionPreview,
              LEFT(opo.detail_json, 300) AS detailJsonPreview,
              opo.last_synced_at AS lastSyncedAt,
              opo.create_time AS createTime,
              opo.update_time AS updateTime,
              COALESCE(opo.is_guangdong, 0) AS isGuangdong,
              CASE WHEN opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED') THEN 1 ELSE 0 END AS isEffective,
              CASE WHEN opo.source_url IS NULL OR TRIM(opo.source_url) = '' OR LOWER(TRIM(opo.source_url)) NOT REGEXP ? THEN 1 ELSE 0 END AS missingSourceUrl,
              CASE WHEN opo.city IS NULL OR TRIM(opo.city) = '' OR LOWER(TRIM(opo.city)) REGEXP ? THEN 1 ELSE 0 END AS missingCity,
              CASE WHEN opo.published_at IS NULL THEN 1 ELSE 0 END AS missingPublishedAt,
              CASE
                WHEN opo.published_at IS NOT NULL
                  AND (
                    opo.published_at > DATE_ADD(NOW(3), INTERVAL ? DAY)
                    OR opo.published_at < ?
                    OR (
                      COALESCE(opo.last_synced_at, opo.update_time, opo.create_time) IS NOT NULL
                      AND opo.published_at > DATE_ADD(COALESCE(opo.last_synced_at, opo.update_time, opo.create_time), INTERVAL ? DAY)
                    )
                  )
                THEN 1 ELSE 0
              END AS suspiciousPublishedAt,
              CASE WHEN COALESCE(opo.has_detail_evidence, 0) = 0 THEN 1 ELSE 0 END AS missingHashOrDetailEvidence,
              CASE
                WHEN opo.city IS NULL OR TRIM(opo.city) = '' OR LOWER(TRIM(opo.city)) REGEXP ? THEN 1
                WHEN opo.opportunity_type = 'SUPPLY' AND (opo.district IS NULL OR TRIM(opo.district) = '') THEN 1
                ELSE 0
              END AS missingSupplyLocation,
              CASE
                WHEN COALESCE(opo.is_guangdong, 0) = 0 THEN 'OUT_OF_SCOPE'
                WHEN opo.source_url IS NULL OR TRIM(opo.source_url) = '' OR LOWER(TRIM(opo.source_url)) NOT REGEXP ? THEN 'SOURCE_LOST'
                WHEN opo.published_at IS NULL THEN 'UNKNOWN_TIME'
                WHEN opo.city IS NULL OR TRIM(opo.city) = '' THEN 'INVALID'
                WHEN COALESCE(opo.has_detail_evidence, 0) = 0 THEN 'INVALID'
                ELSE NULL
              END AS proposedDowngradeStatus
            FROM investment_public_opportunity opo
            WHERE
            """
                + issueSql
                + """

            ORDER BY
              (
                (CASE WHEN COALESCE(opo.is_guangdong, 0) = 0 THEN 16 ELSE 0 END)
                + (CASE WHEN opo.source_url IS NULL OR TRIM(opo.source_url) = '' THEN 8 ELSE 0 END)
                + (CASE WHEN opo.opportunity_type = 'SUPPLY' AND (opo.district IS NULL OR TRIM(opo.district) = '') THEN 6 ELSE 0 END)
                + (CASE WHEN opo.published_at IS NULL THEN 4 ELSE 0 END)
                + (CASE WHEN COALESCE(opo.has_detail_evidence, 0) = 0 THEN 1 ELSE 0 END)
              ) DESC,
              opo.opportunity_id ASC
            LIMIT ?
            """,
            (rs, rowNum) -> publicOpportunityAuditPreviewMap(rs),
            TRACEABLE_SOURCE_URL_PATTERN,
            UNKNOWN_CITY_VALUE_PATTERN,
            FUTURE_PUBLISHED_TOLERANCE_DAYS,
            EARLIEST_REASONABLE_PUBLISHED_AT,
            CREATED_PUBLISHED_TOLERANCE_DAYS,
            UNKNOWN_CITY_VALUE_PATTERN,
            TRACEABLE_SOURCE_URL_PATTERN,
            FUTURE_PUBLISHED_TOLERANCE_DAYS,
            EARLIEST_REASONABLE_PUBLISHED_AT,
            CREATED_PUBLISHED_TOLERANCE_DAYS,
            PUBLIC_OPPORTUNITY_AUDIT_PREVIEW_LIMIT);
    return publicOpportunityAuditPreviewResult(rows, total);
  }

  /** 手工录入公开机会；不执行旧端 ensure/ALTER，也不触发线索转换。 */
  public Map<String, Object> upsertManualPublicOpportunity(
      JdbcTemplate jdbcTemplate, PublicOpportunityManualRequest request) {
    if (!hasPublicOpportunityWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "公开机会表结构未准备好");
    }

    PublicOpportunityManualRequest safeRequest =
        request == null
            ? new PublicOpportunityManualRequest(null, null, null, null, null, null, null, null, null, null, null, null)
            : request;
    String title = requiredText(safeRequest.title(), "标题不能为空", 255);
    String opportunityType = "SUPPLY".equals(safeRequest.opportunityType()) ? "SUPPLY" : "DEMAND";
    String sourceUrl =
        defaultString(
            cleanTextMax(safeRequest.sourceUrl(), 500),
            "manual://public-opportunity/" + UUID.randomUUID());
    String sourceSite =
        defaultString(
            cleanTextMax(safeRequest.sourceSite(), 100),
            defaultString(inferSourceSite(sourceUrl), "manual"));
    long sourceId = manualPublicOpportunitySourceId(sourceUrl);
    String sourceKey = sourceUrl.length() > 160 ? sourceUrl.substring(0, 160) : sourceUrl;
    String sourceCode = resolveManualPublicOpportunitySourceCode(opportunityType, sourceSite);
    String qualityGrade = sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://") ? "VERIFIED" : "EFFECTIVE";
    boolean isGuangdong = isGuangdongPublicOpportunity(safeRequest.city(), safeRequest.district(), title);
    String tagsJson = jsonString(List.of("manual", opportunityType));
    String detailJson = manualPublicOpportunityDetailJson(safeRequest, sourceUrl, qualityGrade);

    Map<String, Object> existing = findManualPublicOpportunityBySourceId(jdbcTemplate, sourceId);
    if (existing != null) {
      long opportunityId = longValue(existing.get("opportunityId"));
      jdbcTemplate.update(
          """
          UPDATE investment_public_opportunity
          SET opportunity_type = ?,
              source_site = ?,
              source_table = 'manual_input',
              source_id = ?,
              source_key = ?,
              title = ?,
              city = ?,
              district = ?,
              area_text = ?,
              price_text = ?,
              industry_text = ?,
              contact_name = ?,
              phone_number = ?,
              description = ?,
              published_at = NOW(3),
              published_date_text = DATE_FORMAT(NOW(), '%Y-%m-%d'),
              opportunity_status = 'EFFECTIVE',
              source_code = ?,
              is_guangdong = ?,
              has_detail_evidence = 0,
              quality_grade = ?,
              score = 70,
              tags_json = ?,
              detail_json = ?,
              last_synced_at = NOW(3),
              update_time = NOW(3)
          WHERE opportunity_id = ?
          """,
          opportunityType,
          sourceSite,
          sourceId,
          sourceKey,
          title,
          cleanTextMax(safeRequest.city(), 100),
          cleanTextMax(safeRequest.district(), 100),
          cleanTextMax(safeRequest.areaText(), 100),
          cleanTextMax(safeRequest.priceText(), 100),
          cleanTextMax(safeRequest.industryText(), 100),
          cleanTextMax(safeRequest.contactName(), 100),
          cleanTextMax(safeRequest.phoneNumber(), 50),
          cleanTextMax(safeRequest.description(), 5000),
          sourceCode,
          isGuangdong ? 1 : 0,
          qualityGrade,
          tagsJson,
          detailJson,
          opportunityId);
      return manualPublicOpportunityResult(false, findPublicOpportunityById(jdbcTemplate, opportunityId));
    }

    jdbcTemplate.update(
        """
        INSERT INTO investment_public_opportunity (
          opportunity_type, source_site, source_url, source_key, source_table, source_id,
          title, city, district, area_text, price_text, industry_text,
          contact_name, phone_number, description, published_at,
          published_date_text, opportunity_status, source_code, is_guangdong,
          has_detail_evidence, quality_grade, score, tags_json,
          detail_json, last_synced_at, create_time, update_time
        )
        VALUES (
          ?, ?, ?, ?, 'manual_input', ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, NOW(3),
          DATE_FORMAT(NOW(), '%Y-%m-%d'), 'EFFECTIVE', ?, ?, 0, ?, 70, ?,
          ?, NOW(3), NOW(3), NOW(3)
        )
        """,
        opportunityType,
        sourceSite,
        sourceUrl,
        sourceKey,
        sourceId,
        title,
        cleanTextMax(safeRequest.city(), 100),
        cleanTextMax(safeRequest.district(), 100),
        cleanTextMax(safeRequest.areaText(), 100),
        cleanTextMax(safeRequest.priceText(), 100),
        cleanTextMax(safeRequest.industryText(), 100),
        cleanTextMax(safeRequest.contactName(), 100),
        cleanTextMax(safeRequest.phoneNumber(), 50),
        cleanTextMax(safeRequest.description(), 5000),
        sourceCode,
        isGuangdong ? 1 : 0,
        qualityGrade,
        tagsJson,
        detailJson);
    Map<String, Object> created = findManualPublicOpportunityBySourceId(jdbcTemplate, sourceId);
    return manualPublicOpportunityResult(true, created);
  }

  /** 批量导入公开机会 URL；只 seed crawler_task_item，不调用公开爬虫 adapter。 */
  public Map<String, Object> importPublicOpportunityUrls(
      JdbcTemplate jdbcTemplate, PublicOpportunityImportUrlsRequest request) {
    request =
        request == null
            ? new PublicOpportunityImportUrlsRequest(null, null, null, null, null)
            : request;
    String sourceCode = stringObject(request.sourceCode());
    if (!StringUtils.hasText(sourceCode)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "采集平台不能为空");
    }
    sourceCode = sourceCode.trim();
    if (!PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.contains(sourceCode)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "采集平台不属于公开房源/公开需求范围");
    }

    List<String> rawUrls = extractPublicOpportunityImportUrls(request);
    if (rawUrls.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "URL 列表不能为空");
    }
    if (rawUrls.size() > 5000) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "单次最多导入 5000 个 URL");
    }

    Map<String, Object> source = findCrawlerSourceByCode(jdbcTemplate, sourceCode);
    if (source == null || !hasCrawlerTaskItemWriteColumns(jdbcTemplate)) {
      return null;
    }

    List<String> acceptedUrls = new ArrayList<>();
    List<Map<String, Object>> rejectedItems = new ArrayList<>();
    Set<String> seen = new LinkedHashSet<>();
    int duplicateInputCount = 0;
    for (int index = 0; index < rawUrls.size(); index++) {
      String rawUrl = rawUrls.get(index);
      String sourceUrl = normalizeImportUrl(rawUrl);
      if (!StringUtils.hasText(sourceUrl)) {
        rejectedItems.add(rejectedImportUrl(index, "URL_INVALID", rawUrl));
        continue;
      }
      if (!seen.add(sourceUrl)) {
        duplicateInputCount++;
        continue;
      }
      String policyReason = validatePublicOpportunityImportUrlPolicy(sourceUrl, source);
      if (StringUtils.hasText(policyReason)) {
        rejectedItems.add(rejectedImportUrl(index, policyReason, sourceUrl));
        continue;
      }
      acceptedUrls.add(sourceUrl);
    }

    int maxRetryCount = positiveIntegerOrDefault(request.maxRetryCount(), 3, 1, 10);
    boolean forcePending = request.requeueExisting() == null || jsBoolean(request.requeueExisting());
    Map<String, Object> seed =
        seedCrawlerTaskItems(
            jdbcTemplate,
            acceptedUrls,
            longValue(source.get("sourceId")),
            maxRetryCount,
            forcePending);

    Map<String, Object> sourceSummary = new LinkedHashMap<>();
    sourceSummary.put("enabled", source.get("enabled"));
    sourceSummary.put("sourceCode", source.get("sourceCode"));
    sourceSummary.put("sourceId", source.get("sourceId"));
    sourceSummary.put("sourceName", source.get("sourceName"));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("acceptedCount", acceptedUrls.size());
    result.put("acceptedUrls", acceptedUrls);
    result.put("duplicateInputCount", duplicateInputCount);
    result.put("opportunityType", publicOpportunityTypeBySourceCode(sourceCode));
    result.put("rejectedCount", rejectedItems.size());
    result.put("rejectedItems", rejectedItems);
    result.put("seed", seed);
    result.put("source", sourceSummary);
    result.put("sourceCode", sourceCode);
    result.put("sourceId", source.get("sourceId"));
    result.put("sourceName", source.get("sourceName"));
    result.put("totalInputCount", rawUrls.size());
    return result;
  }

  /** 手工解析公开需求页 HTML 并写入公开机会池；不访问外部 URL，不触发爬虫。 */
  public Map<String, Object> parsePublicOpportunityDemandPage(
      JdbcTemplate jdbcTemplate, PublicOpportunityParseDemandPageRequest request) {
    if (!hasPublicOpportunityWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "公开机会表结构未准备好");
    }
    ParsedDemandPage parsed = parseDemandPageRequest(request);
    if (!StringUtils.hasText(parsed.title())) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("accepted", false);
      result.put("created", false);
      result.put("opportunity", null);
      result.put("parsed", parsedDemandPageMap(parsed));
      result.put("qualityResult", null);
      result.put("skipReason", "TITLE_MISSING");
      return result;
    }

    Map<String, Object> qualityResult = evaluateParsedDemandQuality(parsed);
    if (!Set.of("EFFECTIVE", "VERIFIED").contains(stringObject(qualityResult.get("status")))) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("accepted", false);
      result.put("created", false);
      result.put("opportunity", null);
      result.put("parsed", parsedDemandPageMap(parsed));
      result.put("qualityResult", qualityResult);
      result.put("skipReason", publicOpportunityQualitySkipReason(qualityResult));
      return result;
    }

    Map<String, Object> upsert = upsertCrawlerPublicOpportunity(jdbcTemplate, parsed, qualityResult);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("accepted", true);
    result.put("created", upsert.get("created"));
    result.put("opportunity", upsert.get("opportunity"));
    result.put("parsed", parsedDemandPageMap(parsed));
    result.put("qualityResult", qualityResult);
    result.put("skipReason", null);
    return result;
  }

  /** 公开机会历史数据修复；dryRun 默认只返回预览和统计，显式 false 才会降级历史状态。 */
  public Map<String, Object> repairPublicOpportunityHistory(
      JdbcTemplate jdbcTemplate, PublicOpportunityRepairRequest request) {
    if (!hasPublicOpportunityAuditColumns(jdbcTemplate)) {
      return emptyPublicOpportunityRepairResult(true, PUBLIC_OPPORTUNITY_REPAIR_LIMIT_DEFAULT);
    }
    boolean dryRun = request == null || request.dryRun() == null || booleanValue(request.dryRun());
    int limit =
        positiveIntegerOrDefault(
            request == null ? null : request.limit(),
            PUBLIC_OPPORTUNITY_REPAIR_LIMIT_DEFAULT,
            1,
            PUBLIC_OPPORTUNITY_REPAIR_LIMIT_MAX);
    Map<String, Object> before = publicOpportunityAuditCounts(jdbcTemplate, "");
    List<Map<String, Object>> previewItems =
        findPublicOpportunityRepairCandidates(jdbcTemplate, limit).stream()
            .map(candidate -> publicOpportunityRepairPreviewItem(jdbcTemplate, candidate))
            .toList();
    Map<String, Integer> reasonCounts = publicOpportunityRepairReasonCounts(before);
    int repairedCount = 0;

    if (!dryRun) {
      List<PublicOpportunityRepairCandidate> batch =
          findPublicOpportunityRepairCandidates(jdbcTemplate, PUBLIC_OPPORTUNITY_REPAIR_BATCH_SIZE);
      while (!batch.isEmpty()) {
        for (PublicOpportunityRepairCandidate candidate : batch) {
          if (repairPublicOpportunityCandidate(jdbcTemplate, candidate)) {
            repairedCount++;
          }
        }
        batch = findPublicOpportunityRepairCandidates(jdbcTemplate, PUBLIC_OPPORTUNITY_REPAIR_BATCH_SIZE);
      }
      createRadarOperationAudit(
          jdbcTemplate,
          "PUBLIC_OPPORTUNITY_REPAIR",
          "PUBLIC_OPPORTUNITY",
          null,
          "SUCCESS",
          null,
          null,
          "api",
          "/api/investment/radar/public-opportunity/repair",
          Map.of("repairedCount", repairedCount, "dryRun", false));
    }

    Map<String, Object> after = dryRun ? before : publicOpportunityAuditCounts(jdbcTemplate, "");
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("after", after);
    result.put("auditMode", dryRun ? "DRY_RUN" : "APPLY");
    result.put("before", before);
    result.put("downgradedCount", repairedCount);
    result.put("dryRun", dryRun);
    result.put("generatedAt", Instant.now().toString());
    result.put("limit", limit);
    result.put("plannedDowngradeCount", longValue(before.get("proposedDowngradeCount")));
    result.put("previewItems", previewItems);
    result.put("reasonCounts", reasonCounts);
    result.put("repairedCount", repairedCount);
    result.put("scannedCount", dryRun ? longValue(before.get("proposedDowngradeCount")) : repairedCount);
    return result;
  }

  /** 从本地公开机会池重建外部线索；只写 company_lead/lead_evidence，不执行爬虫。 */
  public Map<String, Object> rebuildExternalLeadsFromPublicOpportunity(JdbcTemplate jdbcTemplate) {
    if (!hasPublicOpportunityColumns(jdbcTemplate) || !hasExternalLeadRebuildColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "公开机会或外部线索表结构未准备好");
    }
    Map<String, Integer> skipReasons = publicOpportunityLeadSkipReasonMap();
    List<Long> sampleLeadIds = new ArrayList<>();
    List<Long> sampleEvidenceIds = new ArrayList<>();
    int createdLeadCount = 0;
    int evidenceCreatedCount = 0;
    int matchedCount = 0;
    int updatedLeadCount = 0;
    List<PublicOpportunityLeadSource> sources = findPublicOpportunityLeadSources(jdbcTemplate);

    for (PublicOpportunityLeadSource source : sources) {
      ExternalLeadBuildResult buildResult = buildExternalLeadFromPublicOpportunity(source);
      if (StringUtils.hasText(buildResult.skipReason())) {
        skipReasons.compute(buildResult.skipReason(), (key, value) -> value == null ? 1 : value + 1);
        continue;
      }
      matchedCount++;
      Map<String, Object> upsert = upsertExternalLeadFromPublicOpportunity(jdbcTemplate, buildResult);
      if (Boolean.TRUE.equals(upsert.get("created"))) {
        createdLeadCount++;
      }
      if (Boolean.TRUE.equals(upsert.get("updated"))) {
        updatedLeadCount++;
      }
      evidenceCreatedCount += (int) longValue(upsert.get("evidenceCreatedCount"));
      pushSampleId(sampleLeadIds, longValue(upsert.get("leadId")));
      @SuppressWarnings("unchecked")
      List<Long> evidenceIds = (List<Long>) upsert.getOrDefault("evidenceIds", List.of());
      evidenceIds.forEach(id -> pushSampleId(sampleEvidenceIds, id));
    }

    int skippedCount = skipReasons.values().stream().mapToInt(Integer::intValue).sum();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("createdLeadCount", createdLeadCount);
    result.put("evidenceCreatedCount", evidenceCreatedCount);
    result.put("matchedCount", matchedCount);
    result.put("sampleEvidenceIds", sampleEvidenceIds);
    result.put("sampleLeadIds", sampleLeadIds);
    result.put("scannedCount", sources.size());
    result.put("skippedCount", skippedCount);
    result.put("skipReasons", skipReasons);
    result.put("updatedLeadCount", updatedLeadCount);
    return result;
  }

  /** 查询公开机会详情。 */
  public Map<String, Object> findPublicOpportunityById(JdbcTemplate jdbcTemplate, long opportunityId) {
    if (!hasPublicOpportunityColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
            """
                + publicOpportunitySelectColumns("")
                + """

            FROM investment_public_opportunity
            WHERE opportunity_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> publicOpportunityMap(rs),
            opportunityId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询触达模板列表。GET 迁移保持只读，不执行旧端默认模板 seed 或 ALTER。 */
  public Map<String, Object> findOutreachTemplates(
      JdbcTemplate jdbcTemplate, OutreachTemplateQuery query) {
    if (!hasOutreachTemplateColumns(jdbcTemplate)) {
      return pageResult(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("1 = 1");
    appendEquals(conditions, args, "channel = ?", query.channel());
    appendEquals(conditions, args, "task_type = ?", query.taskType());
    if (StringUtils.hasText(query.enabled()) && !"ALL".equalsIgnoreCase(query.enabled())) {
      conditions.add("enabled = ?");
      args.add(isTruthyText(query.enabled()) ? 1 : 0);
    }
    if (StringUtils.hasText(query.approvalStatus())
        && !"ALL".equalsIgnoreCase(query.approvalStatus())) {
      conditions.add("approval_status = ?");
      args.add(query.approvalStatus());
    }
    if (StringUtils.hasText(query.keyword())) {
      conditions.add("(template_code LIKE ? OR template_name LIKE ? OR content LIKE ?)");
      String likeKeyword = like(query.keyword());
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) FROM investment_outreach_template " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              template_id AS templateId,
              template_code AS templateCode,
              template_name AS templateName,
              task_type AS taskType,
              channel,
              priority_level AS priorityLevel,
              content,
              placeholder_json AS placeholderJson,
              enabled,
              approval_status AS approvalStatus,
              version_no AS versionNo,
              create_time AS createTime,
              update_time AS updateTime
            FROM investment_outreach_template
            """
                + whereSql
                + """

            ORDER BY enabled DESC, priority_level ASC, template_id ASC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> outreachTemplateMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, query.currentPage(), query.pageSize());
  }

  /** 查询触达模板统计。缺少任务表时仍返回模板列表和 0 统计。 */
  public Map<String, Object> findOutreachTemplateStats(JdbcTemplate jdbcTemplate) {
    if (!hasOutreachTemplateColumns(jdbcTemplate)) {
      return listResult(List.of(), 0);
    }
    boolean hasTask = hasOutreachTaskColumns(jdbcTemplate);
    String sql =
        hasTask
            ? """
            SELECT
              t.template_id AS templateId,
              t.template_code AS templateCode,
              t.template_name AS templateName,
              COUNT(ot.task_id) AS totalTasks,
              SUM(CASE WHEN ot.status = 'SENT' THEN 1 ELSE 0 END) AS sentTasks,
              SUM(CASE WHEN ot.result_code IS NOT NULL AND ot.result_code <> 'SUCCESS' THEN 1 ELSE 0 END) AS failedTasks,
              SUM(CASE WHEN ot.reply_status IN ('POSITIVE', 'INTERESTED') THEN 1 ELSE 0 END) AS positiveReplies,
              SUM(CASE WHEN ot.reply_status IN ('NEGATIVE', 'REFUSED', 'UNSUBSCRIBED', 'BLACKLIST', 'BLACKLISTED') THEN 1 ELSE 0 END) AS negativeReplies
            FROM investment_outreach_template t
            LEFT JOIN investment_outreach_task ot
              ON ot.template_code = t.template_code
            GROUP BY t.template_id, t.template_code, t.template_name
            ORDER BY totalTasks DESC, t.template_id ASC
            """
            : """
            SELECT
              template_id AS templateId,
              template_code AS templateCode,
              template_name AS templateName,
              0 AS totalTasks,
              0 AS sentTasks,
              0 AS failedTasks,
              0 AS positiveReplies,
              0 AS negativeReplies
            FROM investment_outreach_template
            ORDER BY template_id ASC
            """;
    List<Map<String, Object>> rows =
        jdbcTemplate.query(sql, (rs, rowNum) -> outreachTemplateStatsMap(rs));
    return listResult(rows, rows.size());
  }

  /** 查询触达模板版本。旧端会先 ensure 表；新端只读，缺表时返回空列表。 */
  public Map<String, Object> findOutreachTemplateVersions(
      JdbcTemplate jdbcTemplate, long templateId) {
    if (!hasOutreachTemplateVersionColumns(jdbcTemplate)) {
      return listResult(List.of(), 0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              version_id AS versionId,
              template_id AS templateId,
              template_code AS templateCode,
              template_name AS templateName,
              task_type AS taskType,
              channel,
              priority_level AS priorityLevel,
              content,
              placeholder_json AS placeholderJson,
              approval_status AS approvalStatus,
              version_no AS versionNo,
              change_type AS changeType,
              create_time AS createTime,
              create_time AS updateTime,
              CASE WHEN approval_status = 'APPROVED' THEN 1 ELSE 0 END AS enabled
            FROM investment_outreach_template_version
            WHERE template_id = ?
            ORDER BY version_no DESC, version_id DESC
            """,
            (rs, rowNum) -> outreachTemplateVersionMap(rs),
            templateId);
    return listResult(rows, rows.size());
  }

  /** 创建触达模板；不执行旧端 ensure/seed，仅写主表和版本快照。 */
  public Map<String, Object> createOutreachTemplate(
      JdbcTemplate jdbcTemplate, OutreachTemplateSaveRequest request) {
    ensureOutreachTemplateWritable(jdbcTemplate);
    OutreachTemplateFields fields = outreachTemplateFields(request);
    try {
      return radarTransactionTemplate(jdbcTemplate)
          .execute(
              ignored -> {
                jdbcTemplate.update(
                    """
                    INSERT INTO investment_outreach_template
                      (template_code, template_name, task_type, channel, priority_level,
                       content, placeholder_json, enabled, approval_status, version_no,
                       create_time, update_time)
                    VALUES
                      (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_APPROVAL', 1, NOW(3), NOW(3))
                    """,
                    fields.templateCode(),
                    fields.templateName(),
                    fields.taskType(),
                    fields.channel(),
                    fields.priorityLevel(),
                    fields.content(),
                    fields.placeholderJson());
                Map<String, Object> template =
                    findOutreachTemplateByCode(jdbcTemplate, fields.templateCode());
                if (template == null) {
                  throw new IllegalStateException("Created outreach template cannot be loaded");
                }
                insertOutreachTemplateVersion(jdbcTemplate, longValue(template.get("templateId")), "CREATE");
                return template;
              });
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "模板编码已存在");
    }
  }

  /** 更新触达模板；更新后重置为待审批，避免未审批内容被继续使用。 */
  public Map<String, Object> updateOutreachTemplate(
      JdbcTemplate jdbcTemplate, long templateId, OutreachTemplateSaveRequest request) {
    ensureOutreachTemplateWritable(jdbcTemplate);
    OutreachTemplateFields fields = outreachTemplateFields(request);
    try {
      return radarTransactionTemplate(jdbcTemplate)
          .execute(
              ignored -> {
                int affected =
                    jdbcTemplate.update(
                        """
                        UPDATE investment_outreach_template
                        SET
                          template_code = ?,
                          template_name = ?,
                          task_type = ?,
                          channel = ?,
                          priority_level = ?,
                          content = ?,
                          placeholder_json = ?,
                          enabled = 0,
                          approval_status = 'PENDING_APPROVAL',
                          version_no = version_no + 1,
                          update_time = NOW(3)
                        WHERE template_id = ?
                        """,
                        fields.templateCode(),
                        fields.templateName(),
                        fields.taskType(),
                        fields.channel(),
                        fields.priorityLevel(),
                        fields.content(),
                        fields.placeholderJson(),
                        templateId);
                if (affected == 0) {
                  return null;
                }
                insertOutreachTemplateVersion(jdbcTemplate, templateId, "UPDATE");
                return findOutreachTemplateById(jdbcTemplate, templateId);
              });
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "模板编码已存在");
    }
  }

  /** 提交触达模板审批；只切换状态并记录版本，不调用外部审批系统。 */
  public Map<String, Object> submitOutreachTemplateApproval(
      JdbcTemplate jdbcTemplate, long templateId) {
    ensureOutreachTemplateWritable(jdbcTemplate);
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              int affected =
                  jdbcTemplate.update(
                      """
                      UPDATE investment_outreach_template
                      SET approval_status = 'PENDING_APPROVAL',
                          enabled = 0,
                          update_time = NOW(3)
                      WHERE template_id = ?
                      """,
                      templateId);
              if (affected == 0) {
                return null;
              }
              insertOutreachTemplateVersion(jdbcTemplate, templateId, "SUBMIT_APPROVAL");
              return findOutreachTemplateById(jdbcTemplate, templateId);
            });
  }

  /** 审批触达模板；通过后启用，驳回后禁用，不创建任何触达任务。 */
  public Map<String, Object> setOutreachTemplateApproval(
      JdbcTemplate jdbcTemplate, long templateId, String approvalStatus) {
    ensureOutreachTemplateWritable(jdbcTemplate);
    String normalizedStatus = cleanText(approvalStatus);
    if (!"APPROVED".equals(normalizedStatus) && !"REJECTED".equals(normalizedStatus)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "approvalStatus 无效");
    }
    int enabled = "APPROVED".equals(normalizedStatus) ? 1 : 0;
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              int affected =
                  jdbcTemplate.update(
                      """
                      UPDATE investment_outreach_template
                      SET approval_status = ?,
                          enabled = ?,
                          update_time = NOW(3)
                      WHERE template_id = ?
                      """,
                      normalizedStatus,
                      enabled,
                      templateId);
              if (affected == 0) {
                return null;
              }
              insertOutreachTemplateVersion(jdbcTemplate, templateId, normalizedStatus);
              return findOutreachTemplateById(jdbcTemplate, templateId);
            });
  }

  /** 启停触达模板；启用时要求模板已审批通过，不创建触达任务。 */
  public Map<String, Object> setOutreachTemplateEnabled(
      JdbcTemplate jdbcTemplate, long templateId, boolean enabled) {
    Map<String, Object> template = findOutreachTemplateById(jdbcTemplate, templateId);
    if (template == null) {
      return null;
    }
    if (enabled && !"APPROVED".equals(String.valueOf(template.get("approvalStatus")))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "模板未审批通过，不能启用");
    }
    jdbcTemplate.update(
        """
        UPDATE investment_outreach_template
        SET enabled = ?, update_time = NOW(3)
        WHERE template_id = ?
        """,
        enabled ? 1 : 0,
        templateId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("enabled", enabled);
    result.put("templateId", templateId);
    return result;
  }

  /** 查询触达任务列表。只读迁移不执行旧 `ensureOutreachTaskTable` 的补字段副作用。 */
  public Map<String, Object> findOutreachTasks(JdbcTemplate jdbcTemplate, OutreachTaskQuery query) {
    if (!hasOutreachTaskListColumns(jdbcTemplate)) {
      Map<String, Object> result = pageResult(List.of(), 0, query.currentPage(), query.pageSize());
      result.put("summary", outreachTaskEmptySummary());
      return result;
    }

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("l.is_deleted = 0");
    appendEquals(conditions, args, "t.status = ?", query.status());
    appendEquals(conditions, args, "t.reply_status = ?", query.replyStatus());
    appendEquals(conditions, args, "t.channel = ?", query.channel());
    appendEquals(conditions, args, "t.task_type = ?", query.taskType());
    appendEquals(conditions, args, "l.stage = ?", query.stage());
    appendEquals(conditions, args, "l.priority_level = ?", query.priorityLevel());
    if (StringUtils.hasText(query.keyword())) {
      conditions.add(
          "(e.enterprise_name LIKE ? OR e.phone_number LIKE ? OR t.phone_number LIKE ? OR p.park_name LIKE ? OR t.template_code LIKE ?)");
      String likeKeyword = like(query.keyword());
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String fromSql = outreachTaskFromSql(false);
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) " + fromSql + " " + whereSql, args);
    Map<String, Object> summary = findOutreachTaskSummary(jdbcTemplate, fromSql, whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.task_id AS taskId,
              t.lead_id AS leadId,
              t.task_type AS taskType,
              t.channel,
              t.phone_number AS phoneNumber,
              t.status,
              t.template_code AS templateCode,
              t.content AS content,
              t.scheduled_at AS scheduledAt,
              t.sent_at AS sentAt,
              COALESCE(u.real_name, u.username) AS sentByName,
              t.result_code AS resultCode,
              t.result_message AS resultMessage,
              t.provider_task_id AS providerTaskId,
              t.provider_response_json AS providerResponseJson,
              t.reply_status AS replyStatus,
              t.reply_content AS replyContent,
              t.reply_time AS replyTime,
              t.create_time AS createTime,
              t.update_time AS updateTime,
              e.enterprise_name AS enterpriseName,
              e.contact_name AS contactName,
              e.source_latest AS latestSignalType,
              p.park_name AS parkName,
              l.priority_level AS priorityLevel,
              l.stage,
              l.total_score AS totalScore,
              l.latest_contact_time AS latestContactTime
            """
                + fromSql
                + " "
                + whereSql
                + """

            ORDER BY
              CASE
                WHEN t.status IN ('PENDING', 'RUNNING') THEN 0
                WHEN t.reply_status = 'POSITIVE' THEN 1
                WHEN t.reply_status IN ('REPLIED', 'NEGATIVE') THEN 2
                WHEN t.status IN ('SENT', 'SUCCESS', 'REPLIED') THEN 3
                ELSE 4
              END,
              COALESCE(t.scheduled_at, t.sent_at, t.create_time) DESC,
              t.task_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> outreachTaskListMap(rs),
            pageArgs.toArray());
    Map<String, Object> result = pageResult(rows, total, query.currentPage(), query.pageSize());
    result.put("summary", summary);
    return result;
  }

  /** 查询触达任务详情。 */
  public Map<String, Object> findOutreachTaskById(JdbcTemplate jdbcTemplate, long taskId) {
    if (!hasOutreachTaskDetailColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.task_id AS taskId,
              t.lead_id AS leadId,
              t.task_type AS taskType,
              t.channel,
              t.phone_number AS phoneNumber,
              t.status,
              t.template_code AS templateCode,
              t.content AS content,
              t.scheduled_at AS scheduledAt,
              t.sent_at AS sentAt,
              COALESCE(sender.real_name, sender.username) AS sentByName,
              t.result_code AS resultCode,
              t.result_message AS resultMessage,
              t.provider_task_id AS providerTaskId,
              t.provider_response_json AS providerResponseJson,
              t.reply_status AS replyStatus,
              t.reply_content AS replyContent,
              t.reply_time AS replyTime,
              t.create_time AS createTime,
              t.update_time AS updateTime,
              l.enterprise_id AS enterpriseId,
              l.park_id AS parkId,
              l.lead_source AS leadSource,
              l.intent_area AS intentArea,
              l.intent_score AS intentScore,
              l.match_score AS matchScore,
              l.reachable_score AS reachableScore,
              l.total_score AS totalScore,
              l.priority_level AS priorityLevel,
              l.stage,
              l.owner_user_id AS ownerUserId,
              l.latest_contact_time AS latestContactTime,
              l.invalid_reason AS invalidReason,
              e.enterprise_name AS enterpriseName,
              e.unified_social_credit_code AS unifiedSocialCreditCode,
              e.contact_name AS contactName,
              e.industry_name AS industryName,
              e.address,
              e.city,
              e.register_capital AS registerCapital,
              e.source_first AS sourceFirst,
              e.source_latest AS sourceLatest,
              e.last_signal_time AS latestSignalTime,
              p.park_name AS parkName,
              COALESCE(owner.real_name, owner.username) AS ownerName
            """
                + outreachTaskFromSql(true)
                + """

            WHERE t.task_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> outreachTaskDetailMap(rs),
            taskId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 创建本地触达任务，只进入 PENDING 状态，不触发短信、企微或异步发送。 */
  public Map<String, Object> createOutreachTask(
      JdbcTemplate jdbcTemplate, Long operatorUserId, OutreachTaskCreateRequest request) {
    if (!hasOutreachTaskCreateColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达任务表结构未准备好");
    }
    long leadId = positiveLongObject(request == null ? null : request.leadId(), "leadId 无效");
    String phoneNumber = normalizeContactPhone(request == null ? null : request.phoneNumber());
    if (!StringUtils.hasText(phoneNumber)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达号码不能为空");
    }
    String taskType = defaultString(cleanText(request == null ? null : request.taskType()), "OUTREACH");
    String channel = defaultString(cleanText(request == null ? null : request.channel()), "SMS");
    String templateCode = cleanText(request == null ? null : request.templateCode());
    String content = cleanText(request == null ? null : request.content());

    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> lead = findRadarLeadContactSeed(jdbcTemplate, leadId);
              if (lead == null) {
                return null;
              }
              Map<String, Object> restriction =
                  findContactRestrictionCheck(
                      jdbcTemplate,
                      nullableLongObject(lead.get("enterpriseId")),
                      leadId,
                      phoneNumber);
              if (!Boolean.TRUE.equals(restriction.get("canContact"))) {
                throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    defaultString(stringObject(restriction.get("reason")), "当前联系人不建议触达"));
              }
              if (countPendingOutreachTasks(jdbcTemplate, leadId) > 0) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "该线索存在未完成的触达任务");
              }
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_outreach_task
                    (lead_id, task_type, channel, phone_number, status, template_code, content,
                     scheduled_at, result_code, result_message, reply_status, sent_by, create_time, update_time)
                  VALUES (?, ?, ?, ?, 'PENDING', ?, ?, NOW(3), NULL, ?, 'NO_REPLY', ?, NOW(3), NOW(3))
                  """,
                  leadId,
                  taskType,
                  channel,
                  phoneNumber,
                  templateCode,
                  content,
                  content,
                  operatorUserId);
              long taskId = lastInsertId(jdbcTemplate);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("channel", channel);
              result.put("content", defaultString(content));
              result.put("createTime", Instant.now().toString());
              result.put("leadId", leadId);
              result.put("phoneNumber", phoneNumber);
              result.put("status", "PENDING");
              result.put("taskId", taskId);
              result.put("taskType", taskType);
              result.put("templateCode", defaultString(templateCode));
              return result;
            });
  }

  /** 取消待执行触达任务；不调用发送通道，不写外部 provider 状态。 */
  public Map<String, Object> cancelOutreachTask(JdbcTemplate jdbcTemplate, long taskId) {
    if (!hasOutreachTaskColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达任务表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> task = findOutreachTaskBaseById(jdbcTemplate, taskId);
              if (task == null) {
                return null;
              }
              String status = defaultString(stringObject(task.get("status")));
              if (!Set.of("PENDING", "RUNNING").contains(status)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "仅待执行任务允许取消");
              }
              jdbcTemplate.update(
                  """
                  UPDATE investment_outreach_task
                  SET status = 'CANCELED',
                      result_code = 'CANCELED',
                      result_message = '任务已取消',
                      update_time = NOW(3)
                  WHERE task_id = ?
                  """,
                  taskId);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("resultCode", "CANCELED");
              result.put("resultMessage", "任务已取消");
              result.put("status", "CANCELED");
              result.put("taskId", taskId);
              return result;
            });
  }

  /** 本地兼容发送触达任务；状态流转与旧端一致，但不连接短信/企微供应商。 */
  public Map<String, Object> sendOutreachTask(JdbcTemplate jdbcTemplate, long taskId, Long operatorUserId) {
    if (!hasOutreachTaskSendColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达任务表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> task = findOutreachTaskDeliverySeed(jdbcTemplate, taskId);
              if (task == null) {
                return null;
              }
              String status = defaultString(stringObject(task.get("status")));
              if (!Set.of("PENDING", "RUNNING").contains(status)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "当前任务状态不允许发送");
              }
              Map<String, Object> restriction =
                  findContactRestrictionCheck(
                      jdbcTemplate,
                      nullableLongObject(task.get("enterpriseId")),
                      nullableLongObject(task.get("leadId")),
                      stringObject(task.get("phoneNumber")));
              if (!Boolean.TRUE.equals(restriction.get("canContact"))) {
                String reason = defaultString(stringObject(restriction.get("reason")), "当前联系人不建议触达");
                jdbcTemplate.update(
                    """
                    UPDATE investment_outreach_task
                    SET status = 'CANCELED',
                        result_code = 'CONTACT_RESTRICTED',
                        result_message = ?,
                        update_time = NOW(3)
                    WHERE task_id = ?
                    """,
                    reason,
                    taskId);
                return outreachSendResult(taskId, "CANCELED", "CONTACT_RESTRICTED", reason, null, null);
              }

              String content = buildOutreachTaskContent(task);
              if (!StringUtils.hasText(content)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "触达内容为空，无法发送");
              }
              String providerTaskId = "springboot-local-" + taskId + "-" + Instant.now().toEpochMilli();
              Map<String, Object> providerResponse = new LinkedHashMap<>();
              providerResponse.put("localOnly", true);
              providerResponse.put("message", "Spring Boot migration local send compatibility mode");
              providerResponse.put("providerTaskId", providerTaskId);
              jdbcTemplate.update(
                  """
                  UPDATE investment_outreach_task
                  SET status = 'SENT',
                      content = ?,
                      sent_at = NOW(3),
                      sent_by = ?,
                      result_code = 'LOCAL_SENT',
                      result_message = '本地兼容发送成功，未调用外部通道',
                      provider_task_id = ?,
                      provider_response_json = ?,
                      update_time = NOW(3)
                  WHERE task_id = ?
                  """,
                  content,
                  operatorUserId,
                  providerTaskId,
                  jsonString(providerResponse),
                  taskId);
              long leadId = longValue(task.get("leadId"));
              if (leadId > 0) {
                jdbcTemplate.update(
                    """
                    UPDATE investment_lead
                    SET latest_contact_time = NOW(3),
                        stage = CASE WHEN stage = 'PENDING_CONTACT' THEN 'CONTACTED' ELSE stage END,
                        update_time = NOW(3)
                    WHERE lead_id = ?
                    """,
                    leadId);
              }
              return outreachSendResult(
                  taskId,
                  "SENT",
                  "LOCAL_SENT",
                  "本地兼容发送成功，未调用外部通道",
                  operatorUserId,
                  providerTaskId);
            });
  }

  /** 记录触达任务回复；本地推进任务、线索阶段，并按回复内容维护触达限制。 */
  public Map<String, Object> replyOutreachTask(
      JdbcTemplate jdbcTemplate,
      long taskId,
      Long operatorUserId,
      String operatorName,
      OutreachTaskReplyRequest request) {
    if (!hasOutreachTaskReplyColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达任务表结构未准备好");
    }
    String replyStatus = cleanText(request == null ? null : request.replyStatus());
    if (!Set.of("BLACKLIST", "NEGATIVE", "POSITIVE", "REPLIED", "UNSUBSCRIBED").contains(replyStatus)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "replyStatus 无效");
    }
    String replyContent = cleanText(request == null ? null : request.replyContent());
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> task = findOutreachTaskReplySeed(jdbcTemplate, taskId);
              if (task == null) {
                return null;
              }
              String status = defaultString(stringObject(task.get("status")));
              if (!Set.of("SENT", "SUCCESS").contains(status)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "请先发送触达任务，再记录回复");
              }
              jdbcTemplate.update(
                  """
                  UPDATE investment_outreach_task
                  SET status = 'REPLIED',
                      reply_status = ?,
                      reply_content = ?,
                      reply_time = NOW(3),
                      update_time = NOW(3)
                  WHERE task_id = ?
                  """,
                  replyStatus,
                  replyContent,
                  taskId);
              long leadId = longValue(task.get("leadId"));
              if (leadId > 0) {
                updateLeadStageAfterOutreachReply(jdbcTemplate, leadId, replyStatus);
                upsertContactRestrictionFromReply(
                    jdbcTemplate,
                    leadId,
                    nullableLongObject(task.get("enterpriseId")),
                    stringObject(task.get("phoneNumber")),
                    replyStatus,
                    replyContent,
                    operatorUserId,
                    operatorName);
              }
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("replyContent", defaultString(replyContent));
              result.put("replyStatus", replyStatus);
              result.put("replyTime", Instant.now().toString());
              result.put("taskId", taskId);
              return result;
            });
  }

  /** 招商雷达分析总览。只读迁移不执行旧端刷新、重建或补偿类副作用。 */
  public Map<String, Object> findRadarAnalysisSummary(JdbcTemplate jdbcTemplate) {
    if (!hasLeadAnalyticsColumns(jdbcTemplate)) {
      return emptyRadarAnalysisSummary();
    }

    Map<String, Object> funnel =
        jdbcTemplate.queryForObject(
            """
            SELECT
              COUNT(*) AS totalLeads,
              SUM(CASE WHEN l.stage <> 'INVALID' THEN 1 ELSE 0 END) AS activeLeads,
              SUM(CASE WHEN l.priority_level = 'A' THEN 1 ELSE 0 END) AS highPriorityLeads,
              SUM(CASE WHEN l.latest_contact_time IS NOT NULL OR l.stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
              SUM(CASE WHEN l.stage IN ('REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS repliedLeads,
              SUM(CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitLeads,
              SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads
            FROM investment_lead l
            WHERE l.is_deleted = 0
            """,
            (rs, rowNum) -> radarFunnelMap(rs));
    List<Map<String, Object>> sourceStats = findRadarSourceStats(jdbcTemplate, 8);
    List<Map<String, Object>> channelStats = findRadarChannelStats(jdbcTemplate, false, 8);
    List<Map<String, Object>> templateStats = findRadarTemplateStats(jdbcTemplate, false, 8);
    List<Map<String, Object>> signalTypeStats = findRadarSignalTypeStats(jdbcTemplate, 8);
    List<Map<String, Object>> ownerStats = findRadarSalesStats(jdbcTemplate, 8);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("channelStats", channelStats);
    result.put("funnel", funnel == null ? emptyRadarFunnel() : funnel);
    result.put("generatedAt", Instant.now().toString());
    result.put("ownerStats", ownerStats);
    result.put("signalTypeStats", signalTypeStats);
    result.put("sopStats", findRadarSopStats(jdbcTemplate, ownerStats));
    result.put("sourceStats", sourceStats);
    result.put("suggestions", buildRadarSuggestions(result));
    result.put("templateStats", templateStats);
    return result;
  }

  /** 招商雷达获客分析。 */
  public Map<String, Object> findRadarAcquisitionAnalytics(JdbcTemplate jdbcTemplate) {
    boolean hasCompanyLead = hasCompanyLeadAnalyticsColumns(jdbcTemplate);
    boolean hasSignalEvent = hasSignalEventAnalyticsColumns(jdbcTemplate);

    long companyLeadTotal = 0;
    long convertedToRadar = 0;
    if (hasCompanyLead) {
      Map<String, Object> row =
          jdbcTemplate.queryForMap(
              """
              SELECT
                COUNT(*) AS totalLeads,
                SUM(CASE WHEN converted_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedLeads
              FROM company_lead
              WHERE is_deleted = 0
              """);
      companyLeadTotal = longValue(row.get("totalLeads"));
      convertedToRadar = longValue(row.get("convertedLeads"));
    }

    long signalEventTotal = 0;
    long signalConvertedEvents = 0;
    if (hasSignalEvent) {
      Map<String, Object> row =
          jdbcTemplate.queryForMap(
              """
              SELECT
                COUNT(*) AS totalEvents,
                SUM(CASE WHEN status = 'CONVERTED' OR related_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedEvents
              FROM signal_event
              WHERE is_deleted = 0
              """);
      signalEventTotal = longValue(row.get("totalEvents"));
      signalConvertedEvents = longValue(row.get("convertedEvents"));
    }

    Map<String, Object> funnel = new LinkedHashMap<>();
    funnel.put("companyLeadTotal", companyLeadTotal);
    funnel.put("conversionRate", rate(convertedToRadar, companyLeadTotal));
    funnel.put("convertedToRadar", convertedToRadar);
    funnel.put("signalConversionRate", rate(signalConvertedEvents, signalEventTotal));
    funnel.put("signalConvertedEvents", signalConvertedEvents);
    funnel.put("signalEventTotal", signalEventTotal);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("funnel", funnel);
    result.put("sourceConversion", findRadarSourceStats(jdbcTemplate, 10));
    result.put("signalTypeConversion", findRadarSignalTypeStats(jdbcTemplate, 10));
    return result;
  }

  /** 招商雷达渠道触达分析，保持旧接口近 90 天统计口径。 */
  public List<Map<String, Object>> findRadarChannelAnalytics(JdbcTemplate jdbcTemplate) {
    return findRadarChannelStats(jdbcTemplate, true, 10);
  }

  /** 招商雷达话术模板分析，保持旧接口近 90 天统计口径。 */
  public List<Map<String, Object>> findRadarTemplateAnalytics(JdbcTemplate jdbcTemplate) {
    return findRadarTemplateStats(jdbcTemplate, true, 10);
  }

  /** 招商雷达销售绩效分析。 */
  public List<Map<String, Object>> findRadarSalesAnalytics(JdbcTemplate jdbcTemplate) {
    return findRadarSalesStats(jdbcTemplate, 10);
  }

  /** 招商雷达销售转化漏斗。旧端会额外校验雷达分析权限，本方法只负责只读数据口径。 */
  public Map<String, Object> findRadarSalesFunnelAnalytics(JdbcTemplate jdbcTemplate) {
    if (!hasLeadAnalyticsColumns(jdbcTemplate)) {
      return emptyRadarSalesFunnel();
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COUNT(*) AS totalLeads,
              SUM(CASE WHEN owner_user_id IS NOT NULL THEN 1 ELSE 0 END) AS assignedLeads,
              SUM(CASE WHEN stage IN ('NEW', 'PENDING_CONTACT') THEN 1 ELSE 0 END) AS newLeads,
              SUM(CASE WHEN latest_contact_time IS NOT NULL OR stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
              SUM(CASE WHEN stage IN ('REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS repliedLeads,
              SUM(CASE WHEN stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitLeads,
              SUM(CASE WHEN stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads
            FROM investment_lead
            WHERE is_deleted = 0
            """,
            (rs, rowNum) -> radarSalesFunnelMap(rs));
    return rows.isEmpty() ? emptyRadarSalesFunnel() : rows.get(0);
  }

  /** 招商雷达 ROI 分析。成本为旧端固定估算值，GET 不触发真实费用同步。 */
  public List<Map<String, Object>> findRadarRoiAnalytics(JdbcTemplate jdbcTemplate) {
    if (!hasRadarRoiAnalyticsColumns(jdbcTemplate)) {
      return List.of();
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COALESCE(NULLIF(t.channel, ''), 'UNKNOWN') AS channel,
              SUM(CASE WHEN t.status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
              COUNT(DISTINCT CASE WHEN l.stage = 'DEAL' THEN l.lead_id ELSE NULL END) AS dealLeads
            FROM investment_outreach_task t
            LEFT JOIN investment_lead l ON l.lead_id = t.lead_id AND l.is_deleted = 0
            WHERE t.create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY channel
            ORDER BY sentTasks DESC
            LIMIT 10
            """,
            (rs, rowNum) -> radarRoiStatsMap(rs));
    return rows;
  }

  /** 招商雷达话术转化分析。旧端会额外校验分析权限，本方法只做近 90 天只读统计。 */
  public List<Map<String, Object>> findRadarTemplateConversionAnalytics(JdbcTemplate jdbcTemplate) {
    if (!hasRadarTemplateConversionColumns(jdbcTemplate)) {
      return List.of();
    }
    boolean hasTemplate = hasOutreachTemplateColumns(jdbcTemplate);
    String templateJoin =
        hasTemplate
            ? """
            LEFT JOIN investment_outreach_template tpl
              ON tpl.template_code COLLATE utf8mb4_unicode_ci =
                t.template_code COLLATE utf8mb4_unicode_ci
            """
            : "";
    String templateIdSelect = hasTemplate ? "tpl.template_id AS templateId," : "NULL AS templateId,";
    String templateNameSelect =
        hasTemplate
            ? "COALESCE(NULLIF(tpl.template_name, ''), NULLIF(t.template_code, ''), '未设置话术') AS templateName,"
            : "COALESCE(NULLIF(t.template_code, ''), '未设置话术') AS templateName,";
    String groupByTemplateId = hasTemplate ? "templateId, " : "";
    return jdbcTemplate.query(
        """
        SELECT
        """
            + templateIdSelect
            + """

          COALESCE(NULLIF(t.template_code, ''), 'UNSET') AS templateCode,
        """
            + templateNameSelect
            + """

          COUNT(*) AS totalTasks,
          SUM(CASE WHEN t.status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
          SUM(CASE WHEN t.reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
          SUM(CASE WHEN t.reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies,
          COUNT(DISTINCT CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN l.lead_id ELSE NULL END) AS visitLeads,
          COUNT(DISTINCT CASE WHEN l.stage = 'DEAL' THEN l.lead_id ELSE NULL END) AS dealLeads
        FROM investment_outreach_task t
        LEFT JOIN investment_lead l ON l.lead_id = t.lead_id AND l.is_deleted = 0
        """
            + templateJoin
            + """

        WHERE t.create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY
        """
            + groupByTemplateId
            + """
          templateCode, templateName
        ORDER BY dealLeads DESC, positiveReplies DESC, totalTasks DESC
        LIMIT 20
        """,
        (rs, rowNum) -> radarTemplateConversionMap(rs));
  }

  /**
   * 查询公开机会爬虫运维摘要。
   *
   * <p>旧端读取前会执行采集源 catalog seed；Spring Boot 迁移期只读取真实存在的采集源和任务数据。
   */
  public Map<String, Object> findCrawlerOpsSummary(
      JdbcTemplate jdbcTemplate, Integer sourceId, String sourceCode) {
    Map<String, Object> source = findCrawlerSourceForOps(jdbcTemplate, sourceId, sourceCode);
    if (source == null) {
      return emptyCrawlerOpsSummary("SOURCE_NOT_FOUND");
    }

    long resolvedSourceId = longValue(source.get("sourceId"));
    Map<String, Object> latestTask = findLatestCrawlerTaskBySourceId(jdbcTemplate, resolvedSourceId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("itemStatus", countCrawlerTaskItemsByStatus(jdbcTemplate, resolvedSourceId));
    result.put("latestFailedItems", findLatestFailedCrawlerTaskItems(jdbcTemplate, resolvedSourceId, 5));
    result.put("latestTask", latestTask);
    result.put("scheduler", crawlerSchedulerStatusWithPolicy(source));
    result.put("source", source);
    result.put("taskStatus", countCrawlerTasksByStatus(jdbcTemplate, resolvedSourceId));
    return result;
  }

  /** 查询公开机会爬虫健康度汇总。GET 不触发采集源 catalog seed。 */
  public Map<String, Object> findPublicCrawlerHealth(JdbcTemplate jdbcTemplate) {
    if (!hasCrawlerSourceColumns(jdbcTemplate)) {
      return publicCrawlerHealthResult(List.of());
    }
    List<Map<String, Object>> sources = findPublicCrawlerHealthSources(jdbcTemplate);
    if (sources.isEmpty()) {
      return publicCrawlerHealthResult(List.of());
    }
    Map<Long, Map<String, Object>> taskStatsBySource = publicCrawlerTaskStats(jdbcTemplate, sources);
    Map<Long, Map<String, Object>> itemStatsBySource = publicCrawlerItemStats(jdbcTemplate, sources);
    Map<Long, Map<String, Object>> latestTaskBySource = publicCrawlerLatestTaskStats(jdbcTemplate, sources);
    List<Map<String, Object>> healthSources = new ArrayList<>();
    for (Map<String, Object> source : sources) {
      long id = longValue(source.get("sourceId"));
      Map<String, Object> taskStats = taskStatsBySource.getOrDefault(id, Map.of());
      Map<String, Object> itemStats = itemStatsBySource.getOrDefault(id, Map.of());
      Map<String, Object> latestTask = latestTaskBySource.getOrDefault(id, Map.of());
      long totalItems = longValue(itemStats.get("totalItems"));
      long successItems = longValue(itemStats.get("successItems"));
      long failedItems = longValue(itemStats.get("failedItems"));
      long pendingItems = longValue(itemStats.get("pendingItems"));
      long failedTasks = longValue(taskStats.get("failedTasks"));
      long zeroOutputTaskCount = longValue(taskStats.get("zeroOutputTaskCount"));
      double successRate = rate(successItems, totalItems);
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("failedItems", failedItems);
      item.put("failedTasks", failedTasks);
      item.put(
          "healthStatus",
          resolvePublicCrawlerHealthStatus(
              booleanValue(source.get("enabled")),
              failedTasks,
              zeroOutputTaskCount,
              stringObject(latestTask.get("latestError")),
              pendingItems,
              successRate,
              totalItems));
      item.put("latestError", latestTask.getOrDefault("latestError", null));
      item.put("latestTaskId", latestTask.getOrDefault("latestTaskId", null));
      item.put("latestTaskStatus", latestTask.getOrDefault("latestTaskStatus", null));
      item.put("pendingItems", pendingItems);
      item.put("sourceCode", source.get("sourceCode"));
      item.put("sourceId", source.get("sourceId"));
      item.put("sourceName", source.get("sourceName"));
      item.put("successItems", successItems);
      item.put("successRate", successRate);
      item.put("totalItems", totalItems);
      item.put("zeroOutputTaskCount", zeroOutputTaskCount);
      healthSources.add(item);
    }
    return publicCrawlerHealthResult(healthSources);
  }

  /** 查询招商雷达操作审计。旧端 GET 会 ensure/index；Spring Boot 只读现有表。 */
  public Map<String, Object> findRadarOperationAudits(
      JdbcTemplate jdbcTemplate, RadarOperationAuditQuery query) {
    if (!hasRadarOperationAuditColumns(jdbcTemplate)) {
      return pageResult(List.of(), 0, query.currentPage(), query.pageSize());
    }
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("1 = 1");
    appendEquals(conditions, args, "action = ?", query.action());
    appendEquals(conditions, args, "object_type = ?", query.objectType());
    appendEquals(conditions, args, "result = ?", query.result());
    if (StringUtils.hasText(query.keyword())) {
      conditions.add(
          """
          (
            COALESCE(actor_name, '') LIKE ?
            OR COALESCE(action, '') LIKE ?
            OR COALESCE(object_type, '') LIKE ?
            OR COALESCE(object_id, '') LIKE ?
            OR COALESCE(source, '') LIKE ?
          )
          """);
      String keyword = like(query.keyword());
      args.add(keyword);
      args.add(keyword);
      args.add(keyword);
      args.add(keyword);
      args.add(keyword);
    }

    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total =
        count(
            jdbcTemplate,
            "SELECT COUNT(*) FROM investment_radar_operation_audit_log " + whereSql,
            args);
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              audit_id AS auditId,
              action,
              object_type AS objectType,
              object_id AS objectId,
              result,
              actor_id AS actorId,
              actor_name AS actorName,
              source,
              request_path AS requestPath,
              ip_address AS ipAddress,
              detail_json AS detailJson,
              create_time AS createTime
            FROM investment_radar_operation_audit_log
            """
                + whereSql
                + """

            ORDER BY create_time DESC, audit_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> radarOperationAuditMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, query.currentPage(), query.pageSize());
  }

  /** 返回 Spring Boot 本地的公开机会采集调度状态；真实调度执行器后续由 XXL-Job 专项接管。 */
  public Map<String, Object> crawlerSchedulerStatus() {
    return crawlerSchedulerStatusBase();
  }

  /** 启动公开机会采集调度的本地状态；不创建 Java 定时器，避免灰度期和旧 Nitro 双跑。 */
  public Map<String, Object> startCrawlerTaskScheduler(
      JdbcTemplate jdbcTemplate, Long actorId, String actorName) {
    Map<String, Object> scheduler = crawlerSchedulerStatusBase();
    scheduler.put("active", true);
    scheduler.put("enabled", true);
    scheduler.put("envEnabled", true);
    scheduler.put("nextRunAt", nextDailyRunAt((int) longValue(scheduler.get("dailyRunHour"))));
    scheduler.put("startSource", "api");
    scheduler.put("startedAt", Instant.now().toString());
    scheduler.put("stoppedAt", null);
    createRadarOperationAudit(
        jdbcTemplate,
        "CRAWLER_SCHEDULER_START",
        "CRAWLER_SCHEDULER",
        null,
        "SUCCESS",
        actorId,
        actorName,
        "api",
        "/api/investment/radar/crawler-task/scheduler/start",
        scheduler);
    return scheduler;
  }

  /** 停止公开机会采集调度的本地状态；真实调度迁移到 XXL-Job 后再做持久化开关。 */
  public Map<String, Object> stopCrawlerTaskScheduler(
      JdbcTemplate jdbcTemplate, Long actorId, String actorName) {
    Map<String, Object> scheduler = crawlerSchedulerStatusBase();
    scheduler.put("active", false);
    scheduler.put("enabled", false);
    scheduler.put("nextRunAt", null);
    scheduler.put("running", false);
    scheduler.put("stoppedAt", Instant.now().toString());
    createRadarOperationAudit(
        jdbcTemplate,
        "CRAWLER_SCHEDULER_STOP",
        "CRAWLER_SCHEDULER",
        null,
        "SUCCESS",
        actorId,
        actorName,
        "api",
        "/api/investment/radar/crawler-task/scheduler/stop",
        scheduler);
    return scheduler;
  }

  /** 创建公开机会单平台采集任务；只入队本地任务，不执行 HTTP 抓取。 */
  public Map<String, Object> createPublicOpportunityCrawlerTask(
      JdbcTemplate jdbcTemplate,
      PublicOpportunityCrawlerRunRequest request,
      Long actorId,
      String actorName,
      String requestPath) {
    Map<String, Object> source =
        findCrawlerSourceForOps(jdbcTemplate, null, stringObject(request == null ? null : request.sourceCode()));
    if (source == null || !hasCrawlerTaskColumns(jdbcTemplate)) {
      return null;
    }
    Map<String, Object> options = normalizePublicOpportunityCrawlerOptions(request);
    options.put("sourceCode", source.get("sourceCode"));
    Map<String, Object> task =
        createPendingCrawlerTask(
            jdbcTemplate,
            longValue(source.get("sourceId")),
            "PUBLIC_OPPORTUNITY_URL_BATCH",
            options,
            "SPRINGBOOT_LOCAL_QUEUE");
    createRadarOperationAudit(
        jdbcTemplate,
        "CRAWLER_RUN",
        "CRAWLER_TASK",
        stringObject(task.get("taskId")),
        "SUCCESS",
        actorId,
        actorName,
        "api",
        requestPath,
        Map.of(
            "batchSize", options.get("batchSize"),
            "createdTaskId", task.get("taskId"),
            "mode", "LOCAL_QUEUE_ONLY",
            "sourceCode", source.get("sourceCode")));
    return localQueuedCrawlerRunResult(task, source, options);
  }

  /** 创建内置公开信号/内部合同到期采集任务；只落本地队列，不执行 adapter 或合同扫描。 */
  public Map<String, Object> createNamedCrawlerTask(
      JdbcTemplate jdbcTemplate, String crawlerCode, Long actorId, String actorName) {
    Map<String, Object> spec = namedCrawlerSpec(crawlerCode);
    String sourceCode = stringObject(spec.get("sourceCode"));
    Map<String, Object> source = findCrawlerSourceForOps(jdbcTemplate, null, sourceCode);
    if (source == null || !hasCrawlerTaskColumns(jdbcTemplate)) {
      return null;
    }
    Map<String, Object> options = new LinkedHashMap<>();
    options.put("mode", "manual");
    options.put("maxRetryCount", PUBLIC_OPPORTUNITY_CRAWLER_MAX_RETRY_COUNT_DEFAULT);
    options.put("sourceCode", source.get("sourceCode"));
    options.put("sourceName", source.get("sourceName"));
    options.put("workerMode", "LOCAL_QUEUE_ONLY");
    if (spec.containsKey("horizonDays")) {
      options.put("horizonDays", spec.get("horizonDays"));
    }
    Map<String, Object> task =
        createPendingCrawlerTask(
            jdbcTemplate,
            longValue(source.get("sourceId")),
            stringObject(spec.get("taskType")),
            options,
            "SPRINGBOOT_LOCAL_QUEUE");
    String requestPath = stringObject(spec.get("requestPath"));
    createRadarOperationAudit(
        jdbcTemplate,
        "CRAWLER_RUN",
        "CRAWLER_TASK",
        stringObject(task.get("taskId")),
        "SUCCESS",
        actorId,
        actorName,
        "api",
        requestPath,
        Map.of(
            "createdTaskId", task.get("taskId"),
            "mode", "LOCAL_QUEUE_ONLY",
            "sourceCode", source.get("sourceCode"),
            "taskType", spec.get("taskType")));
    return localQueuedCrawlerRunResult(task, source, options);
  }

  /** 同步内部合同到期信号；只扫描本地租户合同并派生本地雷达线索，不执行外部爬虫。 */
  public Map<String, Object> syncInternalContractExpiryToRadar(
      JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds, Long actorId, String actorName) {
    if (!hasInternalContractExpirySyncColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "内部合同到期同步表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> source =
                  findCrawlerSourceForOps(jdbcTemplate, null, "INTERNAL_CONTRACT_EXPIRY");
              List<Map<String, Object>> tenants =
                  findInternalContractExpiryTenants(jdbcTemplate, authorizedParkIds);
              int createdLeadCount = 0;
              int updatedLeadCount = 0;
              int convertedCount = 0;
              int reusedCount = 0;
              List<Long> radarLeadIds = new ArrayList<>();
              List<Long> externalLeadIds = new ArrayList<>();
              for (Map<String, Object> tenant : tenants) {
                Map<String, Object> upsert =
                    upsertInternalContractExpiryExternalLead(jdbcTemplate, tenant, source);
                if (Boolean.TRUE.equals(upsert.get("created"))) {
                  createdLeadCount++;
                } else {
                  updatedLeadCount++;
                }
                long externalLeadId = longValue(upsert.get("leadId"));
                pushSampleId(externalLeadIds, externalLeadId);
                Map<String, Object> convert =
                    convertExternalLeadToRadarLead(
                        jdbcTemplate,
                        externalLeadId,
                        new RadarLeadConvertRequest(actorId, "内部合同到期同步到雷达潜客"));
                if (convert == null) {
                  continue;
                }
                if (Boolean.TRUE.equals(convert.get("reused"))) {
                  reusedCount++;
                } else {
                  convertedCount++;
                }
                pushSampleId(radarLeadIds, longValue(convert.get("radarLeadId")));
              }
              Map<String, Object> signalResult =
                  tenants.isEmpty()
                      ? Map.of(
                          "createdEventCount",
                          0,
                          "createdEvidenceCount",
                          0,
                          "deletedDirtyEventCount",
                          0,
                          "updatedEventCount",
                          0,
                          "updatedEvidenceCount",
                          0)
                      : refreshSignalEventsFromExternalLeads(jdbcTemplate);
              createRadarOperationAudit(
                  jdbcTemplate,
                  "SYNC_INTERNAL_CONTRACT_EXPIRY",
                  "CRAWLER_TASK",
                  null,
                  "SUCCESS",
                  actorId,
                  actorName,
                  "api",
                  "/api/investment/radar/crawler-task/sync-internal-contract-expiry",
                  Map.of(
                      "convertedCount",
                      convertedCount,
                      "createdLeadCount",
                      createdLeadCount,
                      "horizonDays",
                      INTERNAL_CONTRACT_EXPIRY_HORIZON_DAYS,
                      "reusedCount",
                      reusedCount,
                      "scannedCount",
                      tenants.size(),
                      "updatedLeadCount",
                      updatedLeadCount));
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("convertedCount", convertedCount);
              result.put("createdLeadCount", createdLeadCount);
              result.put("externalLeadIds", externalLeadIds);
              result.put("horizonDays", INTERNAL_CONTRACT_EXPIRY_HORIZON_DAYS);
              result.put("radarLeadIds", radarLeadIds);
              result.put("reusedCount", reusedCount);
              result.put("scannedCount", tenants.size());
              result.put("signalSummary", signalResult);
              result.put("updatedLeadCount", updatedLeadCount);
              result.put("workerMode", "SPRINGBOOT_LOCAL_DB_SCAN");
              return result;
            });
  }

  /** 批量创建公开机会采集任务；每个平台一条 PENDING crawler_task，等待后续 worker 消费。 */
  public Map<String, Object> createPublicOpportunityCrawlerBatch(
      JdbcTemplate jdbcTemplate,
      PublicOpportunityBatchRunRequest request,
      Long actorId,
      String actorName) {
    String mode = normalizePublicOpportunityBatchMode(request == null ? null : request.mode());
    if (!hasCrawlerTaskColumns(jdbcTemplate)) {
      return emptyPublicOpportunityBatchRunResult(mode);
    }
    Map<String, Object> options = normalizePublicOpportunityBatchOptions(request, mode);
    List<Map<String, Object>> sources = findPublicOpportunityCrawlerSourcesForBatch(jdbcTemplate, mode);
    List<Map<String, Object>> items = new ArrayList<>();
    for (Map<String, Object> source : sources) {
      Map<String, Object> taskOptions = new LinkedHashMap<>(options);
      taskOptions.put("sourceCode", source.get("sourceCode"));
      Map<String, Object> task =
          createPendingCrawlerTask(
              jdbcTemplate,
              longValue(source.get("sourceId")),
              "PUBLIC_OPPORTUNITY_URL_BATCH",
              taskOptions,
              "SPRINGBOOT_BATCH_LOCAL_QUEUE");
      items.add(localQueuedBatchPlatformResult(source, task));
    }
    Map<String, Object> total = publicOpportunityBatchTotals(items);
    createRadarOperationAudit(
        jdbcTemplate,
        "CRAWLER_BATCH_RUN",
        "PUBLIC_CRAWLER_BATCH",
        null,
        "SUCCESS",
        actorId,
        actorName,
        "api",
        "/api/investment/radar/crawler-task/run-public-opportunity-batch",
        Map.of("mode", mode, "queuedTaskCount", items.size(), "total", total));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("finishedAt", Instant.now().toString());
    result.put("items", items);
    result.put("maxRounds", options.get("maxRounds"));
    result.put("mode", mode);
    result.put("remainingCount", options.get("targetCount"));
    result.put("roundCount", items.isEmpty() ? 0 : 1);
    result.put("startedAt", Instant.now().toString());
    result.put("targetReached", false);
    result.put("total", total);
    return result;
  }

  /** 查询招商雷达线索列表。 */
  public Map<String, Object> findRadarLeads(JdbcTemplate jdbcTemplate, RadarLeadQuery query) {
    if (!hasRadarLeadListColumns(jdbcTemplate)) {
      return pageResult(List.of(), 0, query.currentPage(), query.pageSize());
    }
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("l.is_deleted = 0");
    appendEquals(conditions, args, "l.priority_level = ?", query.priorityLevel());
    appendEquals(conditions, args, "l.stage = ?", query.stage());
    if (query.parkId() != null) {
      conditions.add("l.park_id = ?");
      args.add(query.parkId());
    }
    if (StringUtils.hasText(query.keyword())) {
      conditions.add("(e.enterprise_name LIKE ? OR e.phone_number LIKE ? OR p.park_name LIKE ?)");
      String likeKeyword = like(query.keyword());
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String fromSql =
        """
        FROM investment_lead l
        LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
        LEFT JOIN park p ON p.park_id = l.park_id
        LEFT JOIN user u ON u.id = l.owner_user_id
        """;
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) " + fromSql + " " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              e.enterprise_name AS enterpriseName,
              e.phone_number AS phoneNumber,
              p.park_name AS parkName,
              l.lead_source AS leadSource,
              l.intent_area AS intentArea,
              l.intent_score AS intentScore,
              l.match_score AS matchScore,
              l.reachable_score AS reachableScore,
              l.total_score AS totalScore,
              l.priority_level AS priorityLevel,
              l.stage,
              l.latest_contact_time AS latestContactTime,
              e.last_signal_time AS latestSignalTime,
              e.source_latest AS latestSignalType,
              COALESCE(u.real_name, u.username) AS ownerName
            """
                + fromSql
                + " "
                + whereSql
                + """

            ORDER BY l.update_time DESC, l.lead_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> radarLeadListMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, query.currentPage(), query.pageSize());
  }

  /** 查询招商雷达线索详情，附带上一条/下一条、触达任务和采集任务快照。 */
  public Map<String, Object> findRadarLeadById(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasRadarLeadDetailColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.enterprise_id AS enterpriseId,
              l.park_id AS parkId,
              l.lead_source AS leadSource,
              l.intent_area AS intentArea,
              l.intent_score AS intentScore,
              l.match_score AS matchScore,
              l.reachable_score AS reachableScore,
              l.total_score AS totalScore,
              l.priority_level AS priorityLevel,
              l.stage,
              l.owner_user_id AS ownerUserId,
              l.latest_task_id AS latestTaskId,
              l.latest_contact_time AS latestContactTime,
              l.invalid_reason AS invalidReason,
              l.create_time AS createTime,
              l.update_time AS updateTime,
              e.enterprise_name AS enterpriseName,
              e.unified_social_credit_code AS unifiedSocialCreditCode,
              e.phone_number AS phoneNumber,
              e.contact_name AS contactName,
              e.industry_name AS industryName,
              e.address,
              e.city,
              e.register_capital AS registerCapital,
              e.source_first AS sourceFirst,
              e.source_latest AS sourceLatest,
              e.last_signal_time AS latestSignalTime,
              p.park_name AS parkName,
              COALESCE(u.real_name, u.username) AS ownerName
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            LEFT JOIN park p ON p.park_id = l.park_id
            LEFT JOIN user u ON u.id = l.owner_user_id
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> radarLeadDetailMap(rs),
            leadId);
    if (rows.isEmpty()) {
      return null;
    }
    Map<String, Object> lead = rows.get(0);
    lead.put("collectTask", findRadarLeadCollectTask(jdbcTemplate, lead.get("latestTaskId")));
    List<Map<String, Object>> outreachTasks = findRadarLeadOutreachTasks(jdbcTemplate, leadId);
    Map<String, Object> outreachSummary = new LinkedHashMap<>();
    outreachSummary.put("count", outreachTasks.size());
    outreachSummary.put("latestSentAt", outreachTasks.isEmpty() ? null : outreachTasks.get(0).get("sentAt"));
    lead.put("outreachSummary", outreachSummary);
    lead.put("outreachTasks", outreachTasks);
    lead.put("navigation", findRadarLeadNavigation(jdbcTemplate, leadId, lead.get("updateTime")));
    return lead;
  }

  /** JSON 数据导入招商雷达线索；只写 investment_enterprise / investment_lead 本地表。 */
  public Map<String, Object> importRadarLeads(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> items, Long actorId, String actorName) {
    if (!hasRadarLeadImportColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "招商雷达线索导入表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              int success = 0;
              List<Map<String, Object>> failItems = new ArrayList<>();
              List<Long> leadIds = new ArrayList<>();
              List<Map<String, Object>> sourceItems = items == null ? List.of() : items;
              for (int index = 0; index < sourceItems.size(); index++) {
                Map<String, Object> rawItem = sourceItems.get(index);
                try {
                  RadarLeadImportItem normalized = normalizeRadarLeadImportItem(rawItem);
                  long enterpriseId = upsertImportedRadarEnterprise(jdbcTemplate, normalized);
                  long leadId = upsertImportedRadarLead(jdbcTemplate, enterpriseId, normalized);
                  success++;
                  pushSampleId(leadIds, leadId);
                } catch (RuntimeException error) {
                  Map<String, Object> failItem = new LinkedHashMap<>();
                  failItem.put("enterpriseName", firstImportText(rawItem, "enterpriseName", "companyName", "企业名称"));
                  failItem.put("error", error.getMessage());
                  failItem.put("index", index);
                  failItem.put("rawData", rawItem);
                  failItem.put("rowNumber", index + 1);
                  failItems.add(failItem);
                }
              }
              createRadarOperationAudit(
                  jdbcTemplate,
                  "IMPORT_RADAR_LEAD",
                  "INVESTMENT_LEAD",
                  null,
                  failItems.isEmpty() ? "SUCCESS" : "PARTIAL_SUCCESS",
                  actorId,
                  actorName,
                  "api",
                  "/api/investment/radar/lead/import",
                  Map.of("failCount", failItems.size(), "success", success, "total", sourceItems.size()));
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("failItems", failItems);
              result.put("leadIds", leadIds);
              result.put("success", success);
              return result;
            });
  }

  /** 查询招商雷达线索评分拆解。只读迁移不执行旧端 `ensureProfileScoreStorage` 的建表动作。 */
  public Map<String, Object> findRadarLeadScoreBreakdown(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(jdbcTemplate, "investment_lead", "lead_id", "is_deleted")) {
      return listResult(List.of(), 0);
    }
    if (!hasLeadScoreBreakdownColumns(jdbcTemplate)) {
      return listResult(List.of(), 0);
    }
    String signalJoin =
        hasColumns(jdbcTemplate, "signal_event", "event_id", "event_title", "event_type")
            ? "LEFT JOIN signal_event se ON se.event_id = b.event_id"
            : "";
    String eventTitleSelect = signalJoin.isBlank() ? "NULL AS eventTitle" : "se.event_title AS eventTitle";
    String eventTypeSelect = signalJoin.isBlank() ? "NULL AS eventType" : "se.event_type AS eventType";
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              b.breakdown_id AS breakdownId,
              b.lead_id AS leadId,
              b.event_id AS eventId,
              b.rule_id AS ruleId,
              b.rule_code AS ruleCode,
              b.rule_name AS ruleName,
              b.score_delta AS scoreDelta,
              b.reason,
              b.create_time AS createTime,
            """
                + eventTitleSelect
                + ", "
                + eventTypeSelect
                + """

            FROM lead_score_breakdown b
            """
                + signalJoin
                + """

            WHERE b.lead_id = ?
            ORDER BY b.score_delta DESC, b.breakdown_id ASC
            """,
            (rs, rowNum) -> radarLeadScoreBreakdownMap(rs),
            leadId);
    return listResult(rows, rows.size());
  }

  /** 重算线索评分；只基于现有 signal_event、signal_evidence 和 lead_score_rule。 */
  public Map<String, Object> recalculateRadarLeadScore(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasRadarLeadScoreRecalculateColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "线索评分表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> lead = findRadarLeadScoreSeed(jdbcTemplate, leadId);
              if (lead == null) {
                return null;
              }
              List<Map<String, Object>> events = findRadarLeadScoringEvents(jdbcTemplate, lead);
              List<Map<String, Object>> rules = findEnabledLeadScoreRuleSeeds(jdbcTemplate);
              List<Map<String, Object>> hits = buildLeadScoreHits(events, rules);
              int intentScore =
                  clampScore(hits.stream().mapToInt(hit -> (int) hit.get("scoreDelta")).sum());
              String priorityLevel = resolvePriorityLevel(intentScore);

              jdbcTemplate.update("DELETE FROM lead_score_breakdown WHERE lead_id = ?", leadId);
              for (Map<String, Object> hit : hits) {
                jdbcTemplate.update(
                    """
                    INSERT INTO lead_score_breakdown (
                      lead_id, event_id, rule_id, rule_code, rule_name,
                      score_delta, reason, create_time
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
                    """,
                    leadId,
                    hit.get("eventId"),
                    hit.get("ruleId"),
                    hit.get("ruleCode"),
                    hit.get("ruleName"),
                    hit.get("scoreDelta"),
                    hit.get("reason"));
              }
              jdbcTemplate.update(
                  """
                  UPDATE investment_lead
                  SET intent_score = ?,
                      total_score = ?,
                      priority_level = ?,
                      update_time = NOW(3)
                  WHERE lead_id = ? AND is_deleted = 0
                  """,
                  intentScore,
                  intentScore,
                  priorityLevel,
                  leadId);

              Map<String, Object> result = new LinkedHashMap<>();
              result.put("breakdownCount", hits.size());
              result.put("intentScore", intentScore);
              result.put("leadId", leadId);
              result.put("matchedEventCount", events.size());
              result.put("priorityLevel", priorityLevel);
              result.put("totalScore", intentScore);
              return result;
            });
  }

  /** 批量重算公开来源/信号来源线索评分；不执行信号刷新和默认规则 seed。 */
  public Map<String, Object> recalculateRadarLeadScores(JdbcTemplate jdbcTemplate) {
    if (!hasRadarLeadScoreRecalculateColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "线索评分表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              List<Long> leadIds = findRadarLeadIdsForScoreRecalculate(jdbcTemplate);
              List<Map<String, Object>> items = new ArrayList<>();
              for (Long leadId : leadIds) {
                Map<String, Object> item = recalculateRadarLeadScore(jdbcTemplate, leadId);
                if (item != null) {
                  items.add(item);
                }
              }
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("items", items);
              result.put("recalculatedCount", items.size());
              result.put("totalLeadCount", leadIds.size());
              return result;
            });
  }

  /** 手动分配招商雷达线索负责人，写入分配日志。 */
  public Map<String, Object> assignRadarLeadOwner(
      JdbcTemplate jdbcTemplate, long leadId, RadarLeadAssignOwnerRequest request) {
    if (!hasRadarLeadAssignColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "线索分配表结构未准备好");
    }
    long ownerUserId = positiveLongObject(request == null ? null : request.ownerUserId(), "请选择负责人");
    String assignReason = defaultString(cleanText(request == null ? null : request.assignReason()), "人工调整负责人");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> lead = findRadarLeadAssignmentSeed(jdbcTemplate, leadId);
              if (lead == null) {
                return null;
              }
              Map<String, Object> owner = findActiveRadarUser(jdbcTemplate, ownerUserId);
              if (owner == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "负责人不存在或已停用");
              }
              String previousStage = defaultString(stringObject(lead.get("stage")));
              String nextStage = "NEW".equals(previousStage) ? "PENDING_CONTACT" : previousStage;
              jdbcTemplate.update(
                  """
                  UPDATE investment_lead
                  SET owner_user_id = ?,
                      stage = CASE WHEN stage = 'NEW' THEN 'PENDING_CONTACT' ELSE stage END,
                      update_time = NOW(3)
                  WHERE lead_id = ? AND is_deleted = 0
                  """,
                  ownerUserId,
                  leadId);
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_lead_assignment_log
                    (lead_id, previous_owner_user_id, owner_user_id, owner_name,
                     assignment_source, assign_reason, create_time)
                  VALUES (?, ?, ?, ?, 'MANUAL', ?, NOW(3))
                  """,
                  leadId,
                  lead.get("previousOwnerUserId"),
                  ownerUserId,
                  owner.get("ownerName"),
                  assignReason);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("leadId", leadId);
              result.put("ownerName", defaultString(stringObject(owner.get("ownerName"))));
              result.put("ownerUserId", ownerUserId);
              result.put("stage", nextStage);
              return result;
            });
  }

  /** 新增线索跟进记录，并按旧端跟进结果规则推进线索阶段。 */
  public Map<String, Object> createRadarLeadFollow(
      JdbcTemplate jdbcTemplate,
      long leadId,
      Long operatorUserId,
      String operatorName,
      RadarLeadFollowRequest request) {
    if (!hasRadarLeadFollowWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "线索跟进表结构未准备好");
    }
    String content = cleanText(request == null ? null : request.content());
    if (!StringUtils.hasText(content)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "跟进内容不能为空");
    }
    String followResult = normalizeFollowResult(request == null ? null : request.followResult());
    String followType = normalizeFollowType(request == null ? null : request.followType());
    String invalidReason =
        defaultString(cleanText(request == null ? null : request.invalidReason()), "INVALID".equals(followResult) ? content : null);
    Timestamp nextFollowTime =
        toTimestamp(request == null ? null : request.nextFollowTime(), "nextFollowTime 无效");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> lead = findRadarLeadContactSeed(jdbcTemplate, leadId);
              if (lead == null) {
                return null;
              }
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_follow_record
                    (lead_id, follow_type, follow_result, content, next_action, next_follow_time,
                     operator_user_id, create_time)
                  VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
                  """,
                  leadId,
                  followType,
                  followResult,
                  content,
                  blankToNullObject(request == null ? null : request.nextAction()),
                  nextFollowTime,
                  operatorUserId);
              long recordId = lastInsertId(jdbcTemplate);
              jdbcTemplate.update(
                  """
                  UPDATE investment_lead
                  SET latest_contact_time = NOW(3),
                      stage = CASE
                        WHEN ? IN ('POSITIVE', 'INTENTED', 'REPLIED')
                          AND stage IN ('NEW', 'PENDING_CONTACT', 'CONTACTED')
                          THEN 'REPLIED'
                        WHEN ? = 'INVALID'
                          THEN 'INVALID'
                        WHEN stage IN ('NEW', 'PENDING_CONTACT')
                          THEN 'CONTACTED'
                        ELSE stage
                      END,
                      invalid_reason = CASE WHEN ? = 'INVALID' THEN ? ELSE invalid_reason END,
                      update_time = NOW(3)
                  WHERE lead_id = ?
                  """,
                  followResult,
                  followResult,
                  followResult,
                  invalidReason,
                  leadId);
              upsertContactRestrictionFromReply(
                  jdbcTemplate,
                  leadId,
                  nullableLongObject(lead.get("enterpriseId")),
                  stringObject(lead.get("phoneNumber")),
                  followResult,
                  content,
                  operatorUserId,
                  operatorName);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("recordId", recordId);
              return result;
            });
  }

  /** 关闭线索为成交或失效，同步本地跟进记录、SOP 和未执行触达任务。 */
  public Map<String, Object> closeRadarLead(
      JdbcTemplate jdbcTemplate, long leadId, Long operatorUserId, RadarLeadCloseRequest request) {
    if (!hasRadarLeadCloseWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "线索关闭表结构未准备好");
    }
    String stage = cleanText(request == null ? null : request.stage());
    if (!Set.of("DEAL", "INVALID").contains(stage)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "线索阶段无效");
    }
    String reason = cleanText(request == null ? null : request.reason());
    if ("INVALID".equals(stage) && !StringUtils.hasText(reason)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请填写失效原因");
    }
    String stageLabel = "DEAL".equals(stage) ? "成交" : "失效";
    String finalReason = defaultString(reason, "DEAL".equals(stage) ? "客户已成交" : "线索已失效");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              if (!radarLeadExists(jdbcTemplate, leadId)) {
                return null;
              }
              jdbcTemplate.update(
                  """
                  UPDATE investment_lead
                  SET stage = ?,
                      invalid_reason = CASE WHEN ? = 'INVALID' THEN ? ELSE NULL END,
                      update_time = NOW(3)
                  WHERE lead_id = ?
                  """,
                  stage,
                  stage,
                  finalReason,
                  leadId);
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_follow_record
                    (lead_id, follow_type, follow_result, content, next_action, next_follow_time,
                     operator_user_id, create_time)
                  VALUES (?, 'VISIT', ?, ?, NULL, NULL, ?, NOW(3))
                  """,
                  leadId,
                  "DEAL".equals(stage) ? "POSITIVE" : "INVALID",
                  stageLabel + "：" + finalReason,
                  operatorUserId);
              if (hasRadarSopReminderColumns(jdbcTemplate)) {
                jdbcTemplate.update(
                    """
                    UPDATE investment_sop_reminder
                    SET reminder_status = 'DONE',
                        handled_time = COALESCE(handled_time, NOW(3)),
                        update_time = NOW(3)
                    WHERE lead_id = ?
                      AND reminder_status IN ('PENDING', 'OVERDUE')
                    """,
                    leadId);
              }
              if (hasOutreachTaskColumns(jdbcTemplate)) {
                jdbcTemplate.update(
                    """
                    UPDATE investment_outreach_task
                    SET status = 'CANCELED',
                        result_code = 'LEAD_CLOSED',
                        result_message = ?,
                        update_time = NOW(3)
                    WHERE lead_id = ?
                      AND status IN ('PENDING', 'SCHEDULED', 'RUNNING')
                    """,
                    "线索已" + stageLabel + "，未执行触达已自动取消",
                    leadId);
              }
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("invalidReason", "INVALID".equals(stage) ? finalReason : null);
              result.put("leadId", leadId);
              result.put("stage", stage);
              result.put("updateTime", Instant.now().toString());
              return result;
            });
  }

  /** 查询已保存的线索房源匹配快照。旧 GET 会自动重建快照；Spring Boot 只读现有结果。 */
  public List<Map<String, Object>> findRadarLeadPropertyMatches(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(jdbcTemplate, "investment_lead", "lead_id", "is_deleted")) {
      return null;
    }
    long leadCount =
        count(
            jdbcTemplate,
            "SELECT COUNT(*) FROM investment_lead WHERE lead_id = ? AND is_deleted = 0",
            List.of(leadId));
    if (leadCount <= 0) {
      return null;
    }
    if (!hasPropertyMatchResultColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          factory_id AS factoryId,
          park_id AS parkId,
          factory_name AS factoryName,
          park_name AS parkName,
          address,
          match_score AS matchScore,
          available_area AS availableArea,
          total_area AS totalArea,
          used_area AS usedArea,
          rent_price AS rentPrice,
          rent_price_text AS rentPriceText,
          floor_count AS floorCount,
          tag,
          match_reasons_json AS matchReasonsJson,
          mismatch_reminders_json AS mismatchRemindersJson,
          sales_pitch AS salesPitch
        FROM property_match_result
        WHERE lead_id = ?
        ORDER BY match_score DESC, computed_at DESC, match_id ASC
        LIMIT 10
        """,
        (rs, rowNum) -> propertyMatchMap(rs),
        leadId);
  }

  /** 重建单条线索房源匹配快照；只基于本地房源、楼层和标签数据。 */
  public Map<String, Object> rebuildRadarLeadPropertyMatch(
      JdbcTemplate jdbcTemplate, long leadId, List<Integer> authorizedParkIds) {
    if (!hasPropertyMatchRebuildColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "房源匹配表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> lead = findRadarLeadPropertyMatchSeed(jdbcTemplate, leadId);
              if (lead == null) {
                return null;
              }
              List<PropertyMatchCandidateResult> matches =
                  calculatePropertyMatches(
                      findPropertyMatchCandidates(jdbcTemplate, authorizedParkIds), lead, 50);
              replacePropertyMatchResults(jdbcTemplate, leadId, matches);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("matches", matches.stream().map(this::propertyMatchResultMap).limit(10).toList());
              result.put("rebuiltAt", Instant.now().toString());
              result.put("totalCount", matches.size());
              return result;
            });
  }

  /** 批量重建线索房源匹配快照；限制单次处理数量，避免 HTTP 请求内全量重建。 */
  public Map<String, Object> rebuildRadarLeadPropertyMatchBatch(
      JdbcTemplate jdbcTemplate, Object limitValue) {
    if (!hasPropertyMatchRebuildColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "房源匹配表结构未准备好");
    }
    int limit =
        positiveIntegerOrDefault(
            limitValue, RADAR_PROPERTY_MATCH_BATCH_LIMIT_DEFAULT, 1, RADAR_PROPERTY_MATCH_BATCH_LIMIT_MAX);
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              List<Long> leadIds = findRadarLeadIdsForPropertyMatchRebuild(jdbcTemplate, limit);
              List<Map<String, Object>> items = new ArrayList<>();
              for (long leadId : leadIds) {
                Map<String, Object> item = rebuildRadarLeadPropertyMatch(jdbcTemplate, leadId, List.of());
                if (item != null) {
                  Map<String, Object> row = new LinkedHashMap<>();
                  row.put("leadId", leadId);
                  row.put("matchCount", longValue(item.get("totalCount")));
                  Object matchesValue = item.get("matches");
                  Object topMatchScore = 0;
                  if (matchesValue instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> map) {
                    topMatchScore = map.get("matchScore");
                  }
                  row.put("topMatchScore", topMatchScore);
                  items.add(row);
                }
              }
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("items", items);
              result.put("rebuiltAt", Instant.now().toString());
              result.put("rebuiltLeadCount", items.size());
              return result;
            });
  }

  /** 刷新本地主动获客链路；串联信号、画像、评分和轻量销售动作派生，不调用外部系统。 */
  public Map<String, Object> rebuildRadarAcquisitionPipeline(
      JdbcTemplate jdbcTemplate, Long actorId, String actorName) {
    Map<String, Object> signalResult = refreshSignalEventsFromExternalLeads(jdbcTemplate);
    Map<String, Object> profileResult = refreshEnterpriseProfilesFromSignals(jdbcTemplate);
    Map<String, Object> scoreResult = recalculateRadarLeadScores(jdbcTemplate);
    Map<String, Object> salesActionResult = rebuildLocalRadarSalesActions(jdbcTemplate);
    Map<String, Object> outreachActionResult = rebuildLocalRadarOutreachActions(jdbcTemplate);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("assignedLeadCount", salesActionResult.get("assignedLeadCount"));
    result.put("createdOutreachTaskCount", outreachActionResult.get("createdOutreachTaskCount"));
    result.put("createdProfileCount", profileResult.get("createdProfileCount"));
    result.put("createdSignalEventCount", signalResult.get("createdEventCount"));
    result.put("createdSignalEvidenceCount", signalResult.get("createdEvidenceCount"));
    result.put("createdSopReminderCount", salesActionResult.get("createdSopReminderCount"));
    result.put("createdTagCount", profileResult.get("createdTagCount"));
    result.put("deletedDirtySignalEventCount", signalResult.get("deletedDirtyEventCount"));
    result.put("finishedAt", Instant.now().toString());
    result.put("outreachTargetLeadCount", outreachActionResult.get("outreachTargetLeadCount"));
    result.put("pendingOutreachTaskCount", outreachActionResult.get("pendingOutreachTaskCount"));
    result.put("pendingSopReminderCount", salesActionResult.get("pendingSopReminderCount"));
    result.put("profileCompanyCount", profileResult.get("sourceCompanyCount"));
    result.put("recalculatedLeadCount", scoreResult.get("recalculatedCount"));
    result.put("sourceLeadCount", signalResult.get("totalSourceLeadCount"));
    result.put("targetLeadCount", salesActionResult.get("targetLeadCount"));
    result.put("totalLeadCount", scoreResult.get("totalLeadCount"));
    result.put("updatedProfileCount", profileResult.get("updatedProfileCount"));
    result.put("updatedSignalEventCount", signalResult.get("updatedEventCount"));
    result.put("updatedSignalEvidenceCount", signalResult.get("updatedEvidenceCount"));
    result.put("updatedTagCount", profileResult.get("updatedTagCount"));
    createRadarOperationAudit(
        jdbcTemplate,
        "REBUILD_RADAR_PIPELINE",
        "RADAR_PIPELINE",
        null,
        "SUCCESS",
        actorId,
        actorName,
        "api",
        "/api/investment/radar/pipeline/rebuild",
        result);
    return result;
  }

  /** 更新房源标签；只同步标签表和已有匹配结果，不触发匹配重建。 */
  public Map<String, Object> updateRadarPropertyTags(
      JdbcTemplate jdbcTemplate, long factoryId, Long operatorUserId, PropertyTagUpdateRequest request) {
    if (!hasRadarPropertyTagWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "房源标签表结构未准备好");
    }
    Map<String, Object> factory = findRadarFactoryForTags(jdbcTemplate, factoryId);
    if (factory == null) {
      return null;
    }
    Object rawTags = request == null || request.tags() == null ? null : request.tags();
    if (rawTags == null && request != null) {
      rawTags = request.tagsJson();
    }
    List<String> tags = normalizePropertyTags(rawTags);
    String tagsJson = jsonString(tags);
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_property_tag
                    (factory_id, tags_json, operator_user_id, create_time, update_time)
                  VALUES (?, ?, ?, NOW(3), NOW(3))
                  ON DUPLICATE KEY UPDATE
                    tags_json = VALUES(tags_json),
                    operator_user_id = VALUES(operator_user_id),
                    update_time = NOW(3)
                  """,
                  factoryId,
                  tagsJson,
                  operatorUserId);
              if (hasColumns(jdbcTemplate, "property_match_result", "factory_id", "tag", "update_time")) {
                jdbcTemplate.update(
                    """
                    UPDATE property_match_result
                    SET tag = ?, update_time = NOW(3)
                    WHERE factory_id = ?
                    """,
                    compactPropertyTags(tags),
                    factoryId);
              }
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("factoryId", factoryId);
              result.put("factoryName", factory.get("factoryName"));
              result.put("tags", tags);
              result.put("updateTime", Instant.now().toString());
              return result;
            });
  }

  /** 新增带看预约，仅写带看记录并推进线索阶段。 */
  public Map<String, Object> createRadarLeadVisit(
      JdbcTemplate jdbcTemplate, long leadId, Long operatorUserId, RadarLeadVisitRequest request) {
    if (!hasRadarVisitWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "带看记录表结构未准备好");
    }
    Timestamp scheduledTime = toTimestamp(request == null ? null : request.scheduledTime(), "预约时间无效");
    if (scheduledTime == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "预约时间无效");
    }
    Long factoryFloorId = nullableLongObject(request == null ? null : request.factoryFloorId());
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              if (!radarLeadExists(jdbcTemplate, leadId)) {
                return null;
              }
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_visit_record
                    (lead_id, factory_floor_id, scheduled_time, visitor_name, visitor_phone,
                     visit_status, feedback, operator_user_id, create_time, update_time)
                  VALUES (?, ?, ?, ?, ?, 'PLANNED', ?, ?, NOW(3), NOW(3))
                  """,
                  leadId,
                  factoryFloorId,
                  scheduledTime,
                  blankToNullObject(request == null ? null : request.visitorName()),
                  blankToNullObject(request == null ? null : request.visitorPhone()),
                  blankToNullObject(request == null ? null : request.feedback()),
                  operatorUserId);
              long visitId = lastInsertId(jdbcTemplate);
              jdbcTemplate.update(
                  """
                  UPDATE investment_lead
                  SET stage = CASE
                        WHEN stage IN ('PENDING_CONTACT', 'CONTACTED', 'REPLIED') THEN 'VISIT'
                        ELSE stage
                      END,
                      update_time = NOW(3)
                  WHERE lead_id = ?
                  """,
                  leadId);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("visitId", visitId);
              return result;
            });
  }

  /** 查询 SOP 待办列表。旧 GET 会写库刷新逾期状态；Spring Boot GET 保持只读计算。 */
  public Map<String, Object> findRadarSopReminders(
      JdbcTemplate jdbcTemplate, RadarLeadQuery query, String reminderStatus, String reminderType) {
    if (!hasRadarSopReminderListColumns(jdbcTemplate)) {
      Map<String, Object> result = pageResult(List.of(), 0, query.currentPage(), query.pageSize());
      result.put("summary", emptyRadarSopReminderSummary());
      return result;
    }
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("l.is_deleted = 0");
    String normalizedStatus = cleanText(reminderStatus);
    if (StringUtils.hasText(normalizedStatus)) {
      conditions.add("r.reminder_status = ?");
      args.add(normalizedStatus);
    } else {
      conditions.add("r.reminder_status IN ('PENDING', 'OVERDUE')");
    }
    appendEquals(conditions, args, "r.reminder_type = ?", cleanText(reminderType));
    appendEquals(conditions, args, "l.stage = ?", query.stage());
    appendEquals(conditions, args, "l.priority_level = ?", query.priorityLevel());
    if (StringUtils.hasText(query.keyword())) {
      conditions.add(
          "(e.enterprise_name LIKE ? OR e.contact_name LIKE ? OR e.phone_number LIKE ? OR p.park_name LIKE ? OR r.title LIKE ?)");
      String likeKeyword = like(query.keyword());
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
    String fromSql = radarSopReminderFromSql();
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) " + fromSql + " " + whereSql, args);
    Map<String, Object> summary = findRadarSopReminderSummary(jdbcTemplate, fromSql, whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              r.reminder_id AS reminderId,
              r.lead_id AS leadId,
              r.reminder_type AS reminderType,
              r.title,
              r.description,
              r.due_time AS dueTime,
              r.reminder_status AS reminderStatus,
              r.handled_time AS handledTime,
              r.create_time AS createTime,
              r.update_time AS updateTime,
              e.enterprise_name AS enterpriseName,
              e.contact_name AS contactName,
              e.phone_number AS phoneNumber,
              p.park_name AS parkName,
              l.stage,
              l.priority_level AS priorityLevel,
              l.total_score AS totalScore,
              l.latest_contact_time AS latestContactTime,
              COALESCE(owner.real_name, owner.username) AS ownerName
            """
                + fromSql
                + " "
                + whereSql
                + """

            ORDER BY
              CASE WHEN (r.reminder_status = 'OVERDUE' OR (r.reminder_status = 'PENDING' AND r.due_time < NOW(3))) THEN 0 ELSE 1 END,
              r.due_time ASC,
              r.reminder_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> radarSopReminderMap(rs),
            pageArgs.toArray());
    Map<String, Object> result = pageResult(rows, total, query.currentPage(), query.pageSize());
    result.put("summary", summary);
    return result;
  }

  /** 查询线索 SOP 明细。只读返回历史表记录和内存生成提醒，不同步写回提醒表。 */
  public Map<String, Object> findRadarLeadSop(JdbcTemplate jdbcTemplate, long leadId) {
    Map<String, Object> lead = findRadarLeadSopSeed(jdbcTemplate, leadId);
    if (lead == null) {
      return null;
    }
    List<Map<String, Object>> followRecords = findRadarLeadFollowRecords(jdbcTemplate, leadId);
    List<Map<String, Object>> visitRecords = findRadarLeadVisitRecords(jdbcTemplate, leadId);
    List<Map<String, Object>> storedReminders = findRadarLeadStoredReminders(jdbcTemplate, leadId);
    List<Map<String, Object>> reminders =
        storedReminders.isEmpty() ? generateRadarSopReminders(lead, followRecords, visitRecords) : storedReminders;
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("assignmentRecords", findRadarLeadAssignmentRecords(jdbcTemplate, leadId));
    result.put("followRecords", followRecords);
    result.put("reminders", reminders);
    result.put("visitRecords", visitRecords);
    return result;
  }

  /** 完成 SOP 提醒，只更新本地提醒状态。 */
  public Map<String, Object> completeRadarSopReminder(JdbcTemplate jdbcTemplate, long reminderId) {
    if (!hasRadarSopReminderColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "SOP 提醒表结构未准备好");
    }
    Map<String, Object> reminder = findRadarSopReminderById(jdbcTemplate, reminderId);
    if (reminder == null) {
      return null;
    }
    if (!"DONE".equals(defaultString(stringObject(reminder.get("reminderStatus"))))) {
      jdbcTemplate.update(
          """
          UPDATE investment_sop_reminder
          SET reminder_status = 'DONE',
              handled_time = NOW(3),
              update_time = NOW(3)
          WHERE reminder_id = ?
            AND reminder_status IN ('PENDING', 'OVERDUE')
          """,
          reminderId);
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("handledTime", Instant.now().toString());
    result.put("reminderId", reminderId);
    result.put("status", "DONE");
    return result;
  }

  /** 完成带看记录，写入反馈并保持线索在 VISIT 阶段。 */
  public Map<String, Object> completeRadarVisitRecord(
      JdbcTemplate jdbcTemplate, long visitId, Long operatorUserId, RadarVisitCompleteRequest request) {
    if (!hasRadarVisitWriteColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "带看记录表结构未准备好");
    }
    String feedback = cleanText(request == null ? null : request.feedback());
    if (!StringUtils.hasText(feedback)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "带看反馈不能为空");
    }
    Timestamp actualTime =
        toTimestampOrNow(request == null ? null : request.actualTime(), "actualTime 无效");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> visit = findRadarVisitById(jdbcTemplate, visitId);
              if (visit == null) {
                return null;
              }
              jdbcTemplate.update(
                  """
                  UPDATE investment_visit_record
                  SET visit_status = 'DONE',
                      actual_time = ?,
                      feedback = ?,
                      operator_user_id = ?,
                      update_time = NOW(3)
                  WHERE visit_id = ?
                  """,
                  actualTime,
                  feedback,
                  operatorUserId,
                  visitId);
              jdbcTemplate.update(
                  """
                  UPDATE investment_lead
                  SET stage = CASE
                        WHEN stage IN ('NEW', 'PENDING_CONTACT', 'CONTACTED', 'REPLIED') THEN 'VISIT'
                        ELSE stage
                      END,
                      update_time = NOW(3)
                  WHERE lead_id = ?
                  """,
                  visit.get("leadId"));
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("actualTime", actualTime.toInstant().toString());
              result.put("feedback", feedback);
              result.put("visitId", visitId);
              result.put("visitStatus", "DONE");
              return result;
            });
  }

  /** 查询线索触达建议。只读组合线索状态、触达限制和已启用话术模板。 */
  public Map<String, Object> findRadarLeadOutreachSuggestion(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasRadarLeadOutreachSuggestionColumns(jdbcTemplate)) {
      return null;
    }
    boolean hasPark = hasColumns(jdbcTemplate, "park", "park_id", "park_name");
    String parkJoin = hasPark ? "LEFT JOIN park p ON p.park_id = l.park_id" : "";
    String parkNameSelect = hasPark ? "p.park_name AS parkName" : "NULL AS parkName";
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.enterprise_id AS enterpriseId,
              l.intent_area AS intentArea,
              l.priority_level AS priorityLevel,
              l.stage,
              l.total_score AS totalScore,
              l.invalid_reason AS invalidReason,
              l.latest_contact_time AS latestContactTime,
              e.enterprise_name AS companyName,
              e.contact_name AS contactName,
              e.phone_number AS phoneNumber,
              e.industry_name AS industryName,
              e.city,
            """
                + parkNameSelect
                + """

            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            """
                + parkJoin
                + """

            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> radarLeadOutreachSuggestionSeedMap(rs),
            leadId);
    if (rows.isEmpty()) {
      return null;
    }

    Map<String, Object> lead = rows.get(0);
    long pendingTaskCount = countPendingOutreachTasks(jdbcTemplate, leadId);
    Map<String, Object> restriction =
        findContactRestrictionCheck(
            jdbcTemplate,
            nullableLongObject(lead.get("enterpriseId")),
            leadId,
            stringObject(lead.get("phoneNumber")));
    List<Map<String, Object>> templates =
        selectOutreachTemplatesForLead(
            findEnabledOutreachTemplates(jdbcTemplate), stringObject(lead.get("priorityLevel")));

    String phoneNumber = defaultString(stringObject(lead.get("phoneNumber"))).trim();
    String stage = defaultString(stringObject(lead.get("stage")));
    boolean invalidStage = Set.of("CLOSED", "DEAL", "INVALID").contains(stage);
    List<String> restrictionReasons = new ArrayList<>();
    if (!StringUtils.hasText(phoneNumber)) {
      restrictionReasons.add("缺少联系电话");
    }
    String invalidReason = cleanText((String) lead.get("invalidReason"));
    if (StringUtils.hasText(invalidReason)) {
      restrictionReasons.add(invalidReason);
    }
    if (invalidStage) {
      restrictionReasons.add("当前阶段不建议触达");
    }
    if (pendingTaskCount > 0) {
      restrictionReasons.add("存在未完成的触达任务");
    }
    if (!booleanValue(restriction.get("canContact"))) {
      restrictionReasons.add(defaultString((String) restriction.get("reason")));
    }

    boolean canContact =
        StringUtils.hasText(phoneNumber)
            && !StringUtils.hasText(invalidReason)
            && !invalidStage
            && pendingTaskCount == 0
            && booleanValue(restriction.get("canContact"));
    Map<String, String> templateData =
        Map.of(
            "companyName", defaultString((String) lead.get("companyName"), "该企业"),
            "intentArea", formatIntentArea(lead.get("intentArea")),
            "parkName", defaultString((String) lead.get("parkName"), "园区"));
    List<Map<String, Object>> suggestions =
        templates.stream()
            .map(template -> outreachSuggestionTemplateMap(template, templateData))
            .toList();

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("canContact", canContact);
    result.put("city", defaultString((String) lead.get("city")));
    result.put("companyName", defaultString((String) lead.get("companyName")));
    result.put("contactName", defaultString((String) lead.get("contactName")));
    result.put("contactRestrictionReason", String.join("；", restrictionReasons));
    result.put("industryName", defaultString((String) lead.get("industryName")));
    result.put("intentArea", templateData.get("intentArea"));
    result.put("leadId", lead.get("leadId"));
    result.put("latestContactTime", defaultString((String) lead.get("latestContactTime")));
    result.put("parkName", defaultString((String) lead.get("parkName")));
    result.put("phoneNumber", phoneNumber);
    result.put("priorityLevel", defaultString((String) lead.get("priorityLevel"), "C"));
    result.put("stage", stage);
    result.put("suggestions", suggestions);
    result.put("totalScore", lead.get("totalScore"));
    return result;
  }

  /** 查询触达限制名单。旧端 GET 会 ensure/ALTER；Spring Boot 只读，不补 schema。 */
  public Map<String, Object> findContactRestrictions(
      JdbcTemplate jdbcTemplate, ContactRestrictionQuery query) {
    if (!hasContactRestrictionCoreColumns(jdbcTemplate)) {
      Map<String, Object> result = pageResult(List.of(), 0, query.currentPage(), query.pageSize());
      result.put("summary", emptyContactRestrictionSummary());
      return result;
    }

    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("1 = 1");
    appendContactRestrictionStatusCondition(
        jdbcTemplate, conditions, args, cleanText(query.status()));
    appendEquals(conditions, args, "r.restriction_type = ?", query.restrictionType());
    appendContactRestrictionKeywordCondition(jdbcTemplate, conditions, args, query.keyword());

    String fromSql = contactRestrictionFromSql(jdbcTemplate);
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    long total = count(jdbcTemplate, "SELECT COUNT(*) " + fromSql + " " + whereSql, args);
    Map<String, Object> summary =
        contactRestrictionSummary(jdbcTemplate, fromSql, whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              r.restriction_id AS restrictionId,
              r.lead_id AS leadId,
              r.enterprise_id AS enterpriseId,
            """
                + contactRestrictionNameSelect(jdbcTemplate)
                + """
              r.phone_number AS phoneNumber,
              r.restriction_type AS restrictionType,
              r.reason,
            """
                + optionalColumnSelect(
                    jdbcTemplate, "contact_restriction", "release_status", "r", "releaseStatus")
                + optionalColumnSelect(
                    jdbcTemplate, "contact_restriction", "release_reason", "r", "releaseReason")
                + optionalColumnSelect(
                    jdbcTemplate,
                    "contact_restriction",
                    "release_request_time",
                    "r",
                    "releaseRequestTime")
                + optionalColumnSelect(
                    jdbcTemplate,
                    "contact_restriction",
                    "release_review_time",
                    "r",
                    "releaseReviewTime")
                + optionalColumnSelect(
                    jdbcTemplate,
                    "contact_restriction",
                    "release_reviewer_id",
                    "r",
                    "releaseReviewerId")
                + """
              r.status,
              r.create_time AS createTime,
              r.update_time AS updateTime
            """
                + fromSql
                + " "
                + whereSql
                + """

            ORDER BY
              CASE WHEN r.status = 'ACTIVE' THEN 0 ELSE 1 END,
              r.update_time DESC,
              r.restriction_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> contactRestrictionMap(rs),
            pageArgs.toArray());
    Map<String, Object> result = pageResult(rows, total, query.currentPage(), query.pageSize());
    result.put("summary", summary);
    return result;
  }

  /** 导出触达限制名单。默认返回全量 rows；CSV 由服务层复用同一份数据生成。 */
  public Map<String, Object> exportContactRestrictions(
      JdbcTemplate jdbcTemplate, String keyword, String restrictionType, String status) {
    ContactRestrictionQuery query =
        ContactRestrictionQuery.of(1, keyword, 100, restrictionType, status);
    if (!hasContactRestrictionCoreColumns(jdbcTemplate)) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("rows", List.of());
      result.put("total", 0L);
      return result;
    }
    Map<String, Object> firstPage = findContactRestrictions(jdbcTemplate, query);
    long total = longValue(firstPage.get("total"));
    int pageSize = (int) Math.max(1, Math.min(10_000, total == 0 ? 100 : total));
    Map<String, Object> fullPage =
        findContactRestrictions(
            jdbcTemplate, ContactRestrictionQuery.of(1, keyword, pageSize, restrictionType, status));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("rows", fullPage.getOrDefault("items", List.of()));
    result.put("total", fullPage.getOrDefault("total", 0L));
    return result;
  }

  public String contactRestrictionsCsv(Map<String, Object> result) {
    List<String> header =
        List.of(
            "restrictionId",
            "enterpriseName",
            "contactName",
            "phoneNumber",
            "restrictionType",
            "status",
            "reason",
            "releaseStatus",
            "releaseReason",
            "createTime",
            "updateTime");
    StringBuilder builder = new StringBuilder("\uFEFF").append(String.join(",", header));
    Object rows = result.get("rows");
    if (rows instanceof List<?> list) {
      for (Object rowObject : list) {
        if (!(rowObject instanceof Map<?, ?> row)) {
          continue;
        }
        builder.append('\n');
        for (int i = 0; i < header.size(); i++) {
          if (i > 0) {
            builder.append(',');
          }
          builder.append(csvCell(row.get(header.get(i))));
        }
      }
    }
    return builder.toString();
  }

  /** 查询触达限制审计日志。 */
  public Map<String, Object> findContactRestrictionAudits(
      JdbcTemplate jdbcTemplate, ContactRestrictionAuditQuery query) {
    if (!hasContactRestrictionAuditColumns(jdbcTemplate)) {
      return pageResult(List.of(), 0, query.currentPage(), query.pageSize());
    }
    boolean hasRestriction = hasContactRestrictionAuditJoinColumns(jdbcTemplate);
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("1 = 1");
    if (query.restrictionId() != null) {
      conditions.add("a.restriction_id = ?");
      args.add(query.restrictionId());
    }
    appendEquals(conditions, args, "a.action = ?", query.action());
    appendContactRestrictionAuditKeywordCondition(hasRestriction, conditions, args, query.keyword());

    String restrictionJoin =
        hasRestriction
            ? "LEFT JOIN contact_restriction r ON r.restriction_id = a.restriction_id"
            : "";
    String whereSql = "WHERE " + String.join(" AND ", conditions);
    String fromSql = "FROM contact_restriction_audit_log a " + restrictionJoin;
    long total = count(jdbcTemplate, "SELECT COUNT(*) " + fromSql + " " + whereSql, args);

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(query.pageSize());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              a.audit_id AS auditId,
              a.restriction_id AS restrictionId,
              a.action,
              a.actor_id AS actorId,
              a.actor_name AS actorName,
              a.before_json AS beforeJson,
              a.after_json AS afterJson,
              a.remark,
              a.create_time AS createTime,
            """
                + (hasRestriction
                    ? """
                      r.phone_number AS phoneNumber,
                      r.restriction_type AS restrictionType,
                      r.status
                    """
                    : """
                      NULL AS phoneNumber,
                      NULL AS restrictionType,
                      NULL AS status
                    """)
                + """

            """
                + fromSql
                + " "
                + whereSql
                + """

            ORDER BY a.create_time DESC, a.audit_id DESC
            LIMIT ? OFFSET ?
            """,
            (rs, rowNum) -> contactRestrictionAuditMap(rs),
            pageArgs.toArray());
    return pageResult(rows, total, query.currentPage(), query.pageSize());
  }

  /** 批量导入触达限制名单；单行校验失败不影响其他行写入。 */
  public Map<String, Object> importContactRestrictions(
      JdbcTemplate jdbcTemplate,
      Long actorId,
      String actorName,
      List<Map<String, Object>> items) {
    if (!hasContactRestrictionUpsertColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达限制表结构未准备好");
    }
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              List<Map<String, Object>> errors = new ArrayList<>();
              int success = 0;
              for (int index = 0; index < items.size(); index++) {
                Map<String, Object> item = items.get(index);
                try {
                  importContactRestrictionItem(jdbcTemplate, actorId, actorName, item);
                  success += 1;
                } catch (RuntimeException error) {
                  Map<String, Object> rowError = new LinkedHashMap<>();
                  rowError.put("index", index);
                  rowError.put("message", error.getMessage());
                  rowError.put("row", item);
                  errors.add(rowError);
                }
              }
              Map<String, Object> after = new LinkedHashMap<>();
              after.put("failed", errors.size());
              after.put("success", success);
              after.put("total", items.size());
              insertContactRestrictionAudit(
                  jdbcTemplate,
                  null,
                  "IMPORT",
                  actorId,
                  actorName,
                  null,
                  after,
                  "批量导入 " + items.size() + " 条");
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("errors", errors);
              result.put("failed", errors.size());
              result.put("success", success);
              result.put("total", items.size());
              return result;
            });
  }

  /** 提交触达限制解除申请；只写 release 字段和本地审计日志。 */
  public Map<String, Object> submitContactRestrictionRelease(
      JdbcTemplate jdbcTemplate,
      long restrictionId,
      Long actorId,
      String actorName,
      ContactRestrictionReleaseRequest request) {
    ensureContactRestrictionReleaseWritable(jdbcTemplate);
    String remark = defaultString(cleanText(request == null ? null : request.remark()), "申请解除触达限制");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> before = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
              if (before == null) {
                return null;
              }
              if (!"ACTIVE".equals(defaultString(stringObject(before.get("status"))))) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("restrictionId", restrictionId);
                result.put("status", before.get("status"));
                return result;
              }
              jdbcTemplate.update(
                  """
                  UPDATE contact_restriction
                  SET release_status = 'PENDING',
                      release_reason = ?,
                      release_request_time = NOW(3),
                      update_time = NOW(3)
                  WHERE restriction_id = ?
                  """,
                  remark,
                  restrictionId);
              Map<String, Object> after = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
              insertContactRestrictionAudit(
                  jdbcTemplate,
                  restrictionId,
                  "SUBMIT_RELEASE",
                  actorId,
                  actorName,
                  before,
                  after,
                  remark);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("restrictionId", restrictionId);
              result.put("status", "RELEASE_PENDING");
              return result;
            });
  }

  /** 审批通过触达限制解除；只写本地限制状态和审计日志。 */
  public Map<String, Object> approveContactRestrictionRelease(
      JdbcTemplate jdbcTemplate,
      long restrictionId,
      Long actorId,
      String actorName,
      ContactRestrictionReleaseRequest request) {
    ensureContactRestrictionReleaseWritable(jdbcTemplate);
    String remark = defaultString(cleanText(request == null ? null : request.remark()), "审批通过解除限制");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> before = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
              if (before == null) {
                return null;
              }
              if ("ACTIVE".equals(defaultString(stringObject(before.get("status"))))) {
                jdbcTemplate.update(
                    """
                    UPDATE contact_restriction
                    SET status = 'RELEASED',
                        release_status = 'APPROVED',
                        release_review_time = NOW(3),
                        release_reviewer_id = ?,
                        update_time = NOW(3)
                    WHERE restriction_id = ?
                    """,
                    actorId,
                    restrictionId);
              }
              Map<String, Object> after = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
              insertContactRestrictionAudit(
                  jdbcTemplate,
                  restrictionId,
                  "APPROVE_RELEASE",
                  actorId,
                  actorName,
                  before,
                  after,
                  remark);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("restrictionId", restrictionId);
              result.put("status", "RELEASED");
              return result;
            });
  }

  /** 驳回触达限制解除；只写 release_status 和本地审计日志。 */
  public Map<String, Object> rejectContactRestrictionRelease(
      JdbcTemplate jdbcTemplate,
      long restrictionId,
      Long actorId,
      String actorName,
      ContactRestrictionReleaseRequest request) {
    ensureContactRestrictionReleaseWritable(jdbcTemplate);
    String remark = defaultString(cleanText(request == null ? null : request.remark()), "驳回解除限制");
    return radarTransactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              Map<String, Object> before = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
              if (before == null) {
                return null;
              }
              if ("ACTIVE".equals(defaultString(stringObject(before.get("status"))))) {
                jdbcTemplate.update(
                    """
                    UPDATE contact_restriction
                    SET release_status = 'REJECTED',
                        release_review_time = NOW(3),
                        release_reviewer_id = ?,
                        update_time = NOW(3)
                    WHERE restriction_id = ?
                    """,
                    actorId,
                    restrictionId);
              }
              Map<String, Object> after = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
              insertContactRestrictionAudit(
                  jdbcTemplate,
                  restrictionId,
                  "REJECT_RELEASE",
                  actorId,
                  actorName,
                  before,
                  after,
                  remark);
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("restrictionId", restrictionId);
              result.put("status", "RELEASE_REJECTED");
              return result;
            });
  }

  private String buildInvestmentWhere(InvestmentListQuery query, List<Object> args) {
    List<String> conditions = new ArrayList<>();
    if (query.currentPark() != null && query.currentPark() > 0) {
      conditions.add("i.park_id = ?");
      args.add(query.currentPark());
    }
    if (StringUtils.hasText(query.agentName())) {
      conditions.add("i.agent_name LIKE ?");
      args.add(like(query.agentName()));
    }
    if (StringUtils.hasText(query.tenantName())) {
      conditions.add("i.tenant_name LIKE ?");
      args.add(like(query.tenantName()));
    }
    if (StringUtils.hasText(query.intentLevel())) {
      conditions.add("i.intent_level = ?");
      args.add(query.intentLevel().trim());
    }
    appendIntentAreaCondition(query.intentArea(), conditions, args);
    if (StringUtils.hasText(query.progress())) {
      conditions.add("i.progress = ?");
      args.add(query.progress().trim());
    }
    if (StringUtils.hasText(query.startTime()) && StringUtils.hasText(query.endTime())) {
      conditions.add("i.meeting_time >= ? AND i.meeting_time <= ?");
      args.add(query.startTime().trim());
      args.add(query.endTime().trim());
    }
    return conditions.isEmpty() ? "" : "WHERE " + String.join(" AND ", conditions);
  }

  private void appendIntentAreaCondition(String intentArea, List<String> conditions, List<Object> args) {
    if (!StringUtils.hasText(intentArea)) {
      return;
    }
    String[] parts = intentArea.split(",");
    if (parts.length >= 2 && "equal".equals(parts[0])) {
      Double value = parseDouble(parts[1]);
      if (value != null) {
        conditions.add("i.intent_area = ?");
        args.add(value);
      }
    } else if (parts.length >= 3 && "between".equals(parts[0])) {
      Double min = parseDouble(parts[1]);
      Double max = parseDouble(parts[2]);
      if (min != null && max != null) {
        conditions.add("i.intent_area >= ? AND i.intent_area <= ?");
        args.add(min);
        args.add(max);
      }
    }
  }

  private boolean hasPublicOpportunityColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_public_opportunity",
        "opportunity_id",
        "opportunity_type",
        "source_site",
        "source_url",
        "source_table",
        "source_id",
        "title",
        "city",
        "district",
        "area_text",
        "area_sqm",
        "price_text",
        "industry_text",
        "contact_name",
        "phone_number",
        "description",
        "published_at",
        "published_date_text",
        "effective_until",
        "opportunity_status",
        "source_code",
        "is_guangdong",
        "has_detail_evidence",
        "quality_grade",
        "score",
        "tags_json",
        "detail_json",
        "last_synced_at",
        "create_time",
        "update_time");
  }

  private boolean hasPublicOpportunityWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasPublicOpportunityColumns(jdbcTemplate)
        && hasColumns(jdbcTemplate, "investment_public_opportunity", "source_key");
  }

  private boolean hasPublicOpportunityAuditColumns(JdbcTemplate jdbcTemplate) {
    return hasPublicOpportunityColumns(jdbcTemplate);
  }

  private boolean hasExternalLeadRebuildColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "company_lead",
            "lead_id",
            "source_type",
            "source_name",
            "source_id",
            "source_url",
            "source_title",
            "company_name",
            "lead_title",
            "summary",
            "industry_name",
            "region_province",
            "region_city",
            "region_district",
            "demand_type",
            "confidence_score",
            "confidence_level",
            "hit_keywords",
            "first_seen_at",
            "last_seen_at",
            "crawled_at",
            "status",
            "evidence_count",
            "create_time",
            "update_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "lead_evidence",
            "evidence_id",
            "lead_id",
            "evidence_type",
            "source_title",
            "source_link",
            "raw_text",
            "matched_keywords",
            "matched_sentences",
            "score_delta",
            "content_hash",
            "published_at",
            "crawled_at",
            "create_time",
            "update_time",
            "is_deleted");
  }

  private boolean hasRadarCollectTaskColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_radar_collect_task",
        "task_id",
        "status",
        "created",
        "updated",
        "skipped",
        "total",
        "duration_ms",
        "error_reason",
        "started_at",
        "completed_at");
  }

  private boolean hasCrawlerTaskLogColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "crawler_task_log",
        "task_id",
        "level",
        "stage",
        "message",
        "detail_json",
        "create_time");
  }

  private boolean hasPropertyMatchResultColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "property_match_result",
        "match_id",
        "lead_id",
        "factory_id",
        "park_id",
        "factory_name",
        "park_name",
        "address",
        "match_score",
        "available_area",
        "total_area",
        "used_area",
        "rent_price",
        "rent_price_text",
        "floor_count",
        "tag",
        "match_reasons_json",
        "mismatch_reminders_json",
        "sales_pitch",
        "computed_at",
        "create_time",
        "update_time");
  }

  private boolean hasOutreachTemplateColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_outreach_template",
        "template_id",
        "template_code",
        "template_name",
        "task_type",
        "channel",
        "priority_level",
        "content",
        "placeholder_json",
        "enabled",
        "approval_status",
        "version_no",
        "create_time",
        "update_time");
  }

  private boolean hasOutreachTemplateVersionColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_outreach_template_version",
        "version_id",
        "template_id",
        "template_code",
        "template_name",
        "task_type",
        "channel",
        "priority_level",
        "content",
        "placeholder_json",
        "approval_status",
        "version_no",
        "change_type",
        "create_time");
  }

  private boolean hasOutreachTaskColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_outreach_task",
        "task_id",
        "lead_id",
        "task_type",
        "channel",
        "phone_number",
        "status",
        "template_code",
        "content",
        "scheduled_at",
        "sent_at",
        "sent_by",
        "result_code",
        "result_message",
        "provider_task_id",
        "provider_response_json",
        "reply_status",
        "reply_content",
        "reply_time",
        "create_time",
        "update_time");
  }

  private boolean hasOutreachTaskCreateColumns(JdbcTemplate jdbcTemplate) {
    return hasOutreachTaskColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "is_deleted")
        && hasContactRestrictionCoreColumns(jdbcTemplate);
  }

  private boolean hasOutreachTaskReplyColumns(JdbcTemplate jdbcTemplate) {
    return hasOutreachTaskColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "stage",
            "latest_contact_time",
            "is_deleted",
            "update_time")
        && hasContactRestrictionUpsertColumns(jdbcTemplate);
  }

  private boolean hasOutreachTaskSendColumns(JdbcTemplate jdbcTemplate) {
    return hasOutreachTaskColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "intent_area",
            "stage",
            "latest_contact_time",
            "is_deleted",
            "update_time")
        && hasColumns(
            jdbcTemplate,
            "investment_enterprise",
            "enterprise_id",
            "enterprise_name",
            "contact_name")
        && hasContactRestrictionCoreColumns(jdbcTemplate);
  }

  private boolean hasOutreachTaskListColumns(JdbcTemplate jdbcTemplate) {
    return hasOutreachTaskColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "park_id",
            "priority_level",
            "stage",
            "total_score",
            "latest_contact_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "investment_enterprise",
            "enterprise_id",
            "enterprise_name",
            "phone_number",
            "contact_name",
            "source_latest")
        && hasColumns(jdbcTemplate, "park", "park_id", "park_name")
        && hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
  }

  private boolean hasOutreachTaskDetailColumns(JdbcTemplate jdbcTemplate) {
    return hasOutreachTaskColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "park_id",
            "lead_source",
            "intent_area",
            "intent_score",
            "match_score",
            "reachable_score",
            "total_score",
            "priority_level",
            "stage",
            "owner_user_id",
            "latest_contact_time",
            "invalid_reason",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "investment_enterprise",
            "enterprise_id",
            "enterprise_name",
            "unified_social_credit_code",
            "contact_name",
            "industry_name",
            "address",
            "city",
            "register_capital",
            "source_first",
            "source_latest",
            "last_signal_time")
        && hasColumns(jdbcTemplate, "park", "park_id", "park_name")
        && hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
  }

  private boolean hasLeadAnalyticsColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_lead",
        "lead_id",
        "owner_user_id",
        "priority_level",
        "stage",
        "latest_contact_time",
        "create_time",
        "is_deleted");
  }

  private boolean hasCompanyLeadAnalyticsColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "company_lead",
        "source_name",
        "source_type",
        "confidence_level",
        "converted_radar_lead_id",
        "evidence_count",
        "is_deleted");
  }

  private boolean hasExternalLeadWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "company_lead",
        "lead_id",
        "status",
        "owner_user_id",
        "remark",
        "invalid_reason",
        "update_time",
        "is_deleted");
  }

  private boolean hasExternalLeadConvertColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "company_lead",
            "lead_id",
            "company_name",
            "confidence_score",
            "industry_name",
            "region_province",
            "region_city",
            "region_district",
            "demand_type",
            "owner_user_id",
            "converted_radar_lead_id",
            "converted_at",
            "status",
            "remark",
            "crawled_at",
            "update_time",
            "is_deleted")
        && hasRadarLeadInsertColumns(jdbcTemplate)
        && hasInvestmentEnterpriseInsertColumns(jdbcTemplate);
  }

  private boolean hasSignalEventAnalyticsColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "signal_event",
        "event_type",
        "status",
        "related_radar_lead_id",
        "is_deleted");
  }

  private boolean hasSignalEventWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "signal_event",
        "event_id",
        "enterprise_id",
        "company_name",
        "event_type",
        "event_title",
        "event_summary",
        "event_time",
        "source_type",
        "source_name",
        "source_url",
        "confidence_score",
        "status",
        "related_external_lead_id",
        "related_radar_lead_id",
        "content_hash",
        "raw_payload_json",
        "create_time",
        "update_time",
        "is_deleted");
  }

  private boolean hasSignalEventRefreshColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "company_lead",
            "lead_id",
            "company_name",
            "lead_title",
            "summary",
            "demand_type",
            "confidence_score",
            "confidence_level",
            "evidence_count",
            "source_type",
            "source_name",
            "source_url",
            "hit_keywords",
            "converted_radar_lead_id",
            "crawled_at",
            "update_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "lead_evidence",
            "lead_id",
            "evidence_type",
            "source_title",
            "source_link",
            "raw_text",
            "matched_keywords",
            "matched_sentences",
            "score_delta",
            "published_at",
            "crawled_at",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "signal_event",
            "event_id",
            "enterprise_id",
            "company_name",
            "event_type",
            "event_title",
            "event_summary",
            "event_time",
            "source_type",
            "source_name",
            "source_url",
            "confidence_score",
            "status",
            "related_external_lead_id",
            "related_radar_lead_id",
            "content_hash",
            "raw_payload_json",
            "create_time",
            "update_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "signal_evidence",
            "evidence_id",
            "event_id",
            "evidence_type",
            "source_title",
            "source_link",
            "raw_text",
            "matched_keywords_json",
            "matched_sentences_json",
            "score_delta",
            "content_hash",
            "published_at",
            "crawled_at",
            "create_time",
            "update_time",
            "is_deleted");
  }

  private boolean hasSignalEventConvertColumns(JdbcTemplate jdbcTemplate) {
    return hasSignalEventWriteColumns(jdbcTemplate)
        && hasRadarLeadInsertColumns(jdbcTemplate)
        && hasInvestmentEnterpriseInsertColumns(jdbcTemplate);
  }

  private boolean hasOutreachTaskAnalyticsColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_outreach_task",
        "channel",
        "status",
        "reply_status",
        "template_code",
        "create_time");
  }

  private boolean hasRadarLeadCoreColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_lead",
        "lead_id",
        "enterprise_id",
        "park_id",
        "lead_source",
        "intent_area",
        "intent_score",
        "match_score",
        "reachable_score",
        "total_score",
        "priority_level",
        "stage",
        "owner_user_id",
        "latest_task_id",
        "latest_contact_time",
        "invalid_reason",
        "create_time",
        "update_time",
        "is_deleted");
  }

  private boolean hasRadarLeadInsertColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_lead",
        "lead_id",
        "enterprise_id",
        "park_id",
        "lead_source",
        "intent_area",
        "intent_score",
        "match_score",
        "reachable_score",
        "total_score",
        "priority_level",
        "stage",
        "owner_user_id",
        "latest_contact_time",
        "invalid_reason",
        "create_time",
        "update_time",
        "is_deleted");
  }

  private boolean hasInvestmentEnterpriseColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_enterprise",
        "enterprise_id",
        "enterprise_name",
        "unified_social_credit_code",
        "phone_number",
        "contact_name",
        "industry_name",
        "address",
        "city",
        "register_capital",
        "source_first",
        "source_latest",
        "last_signal_time",
        "create_time",
        "update_time",
        "is_deleted");
  }

  private boolean hasInvestmentEnterpriseInsertColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_enterprise",
        "enterprise_id",
        "enterprise_name",
        "industry_name",
        "address",
        "city",
        "source_first",
        "source_latest",
        "last_signal_time",
        "create_time",
        "update_time");
  }

  private boolean hasRadarLeadListColumns(JdbcTemplate jdbcTemplate) {
    return hasRadarLeadCoreColumns(jdbcTemplate)
        && hasInvestmentEnterpriseColumns(jdbcTemplate)
        && hasColumns(jdbcTemplate, "park", "park_id", "park_name")
        && hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
  }

  private boolean hasRadarLeadDetailColumns(JdbcTemplate jdbcTemplate) {
    return hasRadarLeadListColumns(jdbcTemplate);
  }

  private boolean hasLeadScoreBreakdownColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "lead_score_breakdown",
        "breakdown_id",
        "lead_id",
        "event_id",
        "rule_id",
        "rule_code",
        "rule_name",
        "score_delta",
        "reason",
        "create_time");
  }

  private boolean hasEnterpriseProfileRefreshColumns(JdbcTemplate jdbcTemplate) {
    return hasSignalEventRefreshColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "enterprise_profile",
            "profile_id",
            "enterprise_id",
            "company_name",
            "unified_social_credit_code",
            "industry_name",
            "industry_tags_json",
            "region_province",
            "region_city",
            "region_district",
            "registered_capital",
            "employee_scale",
            "business_scope",
            "address",
            "last_signal_time",
            "signal_count",
            "latest_intent_type",
            "profile_completeness",
            "create_time",
            "update_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "enterprise_tag",
            "tag_id",
            "enterprise_id",
            "company_name",
            "tag_type",
            "tag_name",
            "tag_source",
            "confidence_score",
            "create_time",
            "update_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "investment_enterprise",
            "enterprise_id",
            "enterprise_name",
            "unified_social_credit_code",
            "industry_name",
            "city",
            "address",
            "register_capital");
  }

  private boolean hasRadarLeadScoreRecalculateColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "intent_score",
            "total_score",
            "priority_level",
            "update_time",
            "is_deleted")
        && hasColumns(jdbcTemplate, "investment_enterprise", "enterprise_id", "enterprise_name")
        && hasColumns(
            jdbcTemplate,
            "signal_event",
            "event_id",
            "enterprise_id",
            "company_name",
            "event_type",
            "event_title",
            "event_summary",
            "source_url",
            "related_radar_lead_id",
            "event_time",
            "is_deleted")
        && hasLeadScoreBreakdownColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "lead_score_rule",
            "rule_id",
            "rule_code",
            "rule_name",
            "event_type",
            "keyword_json",
            "score_delta",
            "enabled");
  }

  private boolean hasRadarSopReminderColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_sop_reminder",
        "reminder_id",
        "lead_id",
        "reminder_type",
        "title",
        "description",
        "due_time",
        "reminder_status",
        "handled_time",
        "create_time",
        "update_time");
  }

  private boolean hasRadarLeadAssignColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "owner_user_id",
            "stage",
            "is_deleted",
            "update_time")
        && hasColumns(jdbcTemplate, "user", "id", "real_name", "username", "status")
        && hasColumns(
            jdbcTemplate,
            "investment_lead_assignment_log",
            "lead_id",
            "previous_owner_user_id",
            "owner_user_id",
            "owner_name",
            "assignment_source",
            "assign_reason",
            "create_time");
  }

  private boolean hasRadarLeadFollowWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "stage",
            "latest_contact_time",
            "invalid_reason",
            "is_deleted",
            "update_time")
        && hasColumns(
            jdbcTemplate,
            "investment_follow_record",
            "record_id",
            "lead_id",
            "follow_type",
            "follow_result",
            "content",
            "next_action",
            "next_follow_time",
            "operator_user_id",
            "create_time");
  }

  private boolean hasRadarLeadCloseWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "stage",
            "invalid_reason",
            "is_deleted",
            "update_time")
        && hasColumns(
            jdbcTemplate,
            "investment_follow_record",
            "record_id",
            "lead_id",
            "follow_type",
            "follow_result",
            "content",
            "next_action",
            "next_follow_time",
            "operator_user_id",
            "create_time");
  }

  private boolean hasRadarVisitWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(jdbcTemplate, "investment_lead", "lead_id", "stage", "is_deleted", "update_time")
        && hasColumns(
            jdbcTemplate,
            "investment_visit_record",
            "visit_id",
            "lead_id",
            "factory_floor_id",
            "scheduled_time",
            "actual_time",
            "visitor_name",
            "visitor_phone",
            "visit_status",
            "feedback",
            "operator_user_id",
            "create_time",
            "update_time");
  }

  private boolean hasRadarSopReminderListColumns(JdbcTemplate jdbcTemplate) {
    return hasRadarSopReminderColumns(jdbcTemplate)
        && hasRadarLeadCoreColumns(jdbcTemplate)
        && hasInvestmentEnterpriseColumns(jdbcTemplate)
        && hasColumns(jdbcTemplate, "park", "park_id", "park_name")
        && hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
  }

  private boolean hasRadarRoiAnalyticsColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_outreach_task",
            "lead_id",
            "channel",
            "status",
            "create_time")
        && hasColumns(jdbcTemplate, "investment_lead", "lead_id", "stage", "is_deleted");
  }

  private boolean hasRadarTemplateConversionColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_outreach_task",
            "lead_id",
            "status",
            "reply_status",
            "template_code",
            "create_time")
        && hasColumns(jdbcTemplate, "investment_lead", "lead_id", "stage", "is_deleted");
  }

  private boolean hasCrawlerSourceColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "crawler_source",
        "source_id",
        "source_code",
        "source_name",
        "source_type",
        "base_url",
        "robots_url",
        "enabled",
        "crawl_interval_minutes",
        "rate_limit_per_minute",
        "allowed_paths_json",
        "blocked_paths_json",
        "keyword_include_json",
        "keyword_exclude_json",
        "region_scope_json",
        "last_crawled_at",
        "create_time",
        "update_time");
  }

  private boolean hasCrawlerTaskColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "crawler_task",
        "task_id",
        "source_id",
        "task_type",
        "status",
        "started_at",
        "finished_at",
        "crawl_started_at",
        "crawl_ended_at",
        "fetched_count",
        "created_lead_count",
        "updated_lead_count",
        "skipped_count",
        "error_message",
        "retry_count",
        "max_retry_count",
        "next_retry_at",
        "skip_reason",
        "request_config_json",
        "create_time",
        "update_time");
  }

  private boolean hasCrawlerTaskItemColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "crawler_task_item",
        "item_id",
        "source_id",
        "last_task_id",
        "source_ref_type",
        "source_ref_id",
        "source_url",
        "status",
        "retry_count",
        "max_retry_count",
        "next_retry_at",
        "last_http_status",
        "last_error",
        "skip_reason",
        "published_at",
        "last_started_at",
        "last_finished_at",
        "last_success_at",
        "create_time",
        "update_time");
  }

  private boolean hasCrawlerTaskItemWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasCrawlerTaskItemColumns(jdbcTemplate)
        && hasColumns(
            jdbcTemplate,
            "crawler_task_item",
            "url_hash",
            "parsed_payload_json",
            "response_hash");
  }

  private boolean hasRadarOperationAuditColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_radar_operation_audit_log",
        "audit_id",
        "action",
        "object_type",
        "object_id",
        "result",
        "actor_id",
        "actor_name",
        "source",
        "request_path",
        "ip_address",
        "detail_json",
        "create_time");
  }

  private boolean hasRadarLeadOutreachSuggestionColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "investment_lead",
            "lead_id",
            "enterprise_id",
            "intent_area",
            "priority_level",
            "stage",
            "total_score",
            "invalid_reason",
            "latest_contact_time",
            "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "investment_enterprise",
            "enterprise_id",
            "enterprise_name",
            "contact_name",
            "phone_number",
            "industry_name",
            "city");
  }

  private boolean hasContactRestrictionCoreColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "contact_restriction",
        "restriction_id",
        "lead_id",
        "enterprise_id",
        "phone_number",
        "restriction_type",
        "reason",
        "status",
        "create_time",
        "update_time");
  }

  private boolean hasContactRestrictionReleaseColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "contact_restriction",
        "restriction_id",
        "lead_id",
        "enterprise_id",
        "phone_number",
        "restriction_type",
        "reason",
        "status",
        "release_status",
        "release_reason",
        "release_request_time",
        "release_review_time",
        "release_reviewer_id",
        "create_time",
        "update_time");
  }

  private boolean hasContactRestrictionUpsertColumns(JdbcTemplate jdbcTemplate) {
    return hasContactRestrictionReleaseColumns(jdbcTemplate) && hasContactRestrictionAuditColumns(jdbcTemplate);
  }

  private boolean hasRadarPropertyTagWriteColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(jdbcTemplate, "factory", "factory_id", "factory_name", "is_deleted")
        && hasColumns(
            jdbcTemplate,
            "investment_property_tag",
            "factory_id",
            "tags_json",
            "operator_user_id",
            "create_time",
            "update_time");
  }

  private boolean hasContactRestrictionAuditColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "contact_restriction_audit_log",
        "audit_id",
        "restriction_id",
        "action",
        "actor_id",
        "actor_name",
        "before_json",
        "after_json",
        "remark",
        "create_time");
  }

  private boolean hasContactRestrictionAuditJoinColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "contact_restriction",
        "restriction_id",
        "phone_number",
        "restriction_type",
        "reason",
        "status");
  }

  private String outreachTaskFromSql(boolean detail) {
    return detail
        ? """
          FROM investment_outreach_task t
          INNER JOIN investment_lead l ON l.lead_id = t.lead_id
          LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
          LEFT JOIN park p ON p.park_id = l.park_id
          LEFT JOIN user sender ON sender.id = t.sent_by
          LEFT JOIN user owner ON owner.id = l.owner_user_id
          """
        : """
          FROM investment_outreach_task t
          INNER JOIN investment_lead l ON l.lead_id = t.lead_id
          LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
          LEFT JOIN park p ON p.park_id = l.park_id
          LEFT JOIN user u ON u.id = t.sent_by
          """;
  }

  private Map<String, Object> findOutreachTaskSummary(
      JdbcTemplate jdbcTemplate, String fromSql, String whereSql, List<Object> args) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COUNT(*) AS totalTasks,
              SUM(CASE WHEN t.status IN ('PENDING', 'RUNNING') THEN 1 ELSE 0 END) AS pendingTasks,
              SUM(CASE WHEN t.status IN ('SENT', 'SUCCESS', 'REPLIED') THEN 1 ELSE 0 END) AS sentTasks,
              SUM(CASE WHEN t.status IN ('FAILED', 'ERROR') THEN 1 ELSE 0 END) AS failedTasks,
              SUM(CASE WHEN t.reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
              SUM(CASE WHEN t.reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies,
              SUM(CASE WHEN t.channel = 'SMS' THEN 1 ELSE 0 END) AS smsTasks,
              SUM(CASE WHEN t.channel = 'CALL' THEN 1 ELSE 0 END) AS callTasks
            """
                + fromSql
                + " "
                + whereSql,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("callTasks", rs.getLong("callTasks"));
              map.put("failedTasks", rs.getLong("failedTasks"));
              map.put("pendingTasks", rs.getLong("pendingTasks"));
              map.put("positiveReplies", rs.getLong("positiveReplies"));
              map.put("repliedTasks", rs.getLong("repliedTasks"));
              map.put("sentTasks", rs.getLong("sentTasks"));
              map.put("smsTasks", rs.getLong("smsTasks"));
              map.put("totalTasks", rs.getLong("totalTasks"));
              return map;
            },
            args.toArray());
    return rows.isEmpty() ? outreachTaskEmptySummary() : rows.get(0);
  }

  private Map<String, Object> outreachTaskEmptySummary() {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("callTasks", 0L);
    summary.put("failedTasks", 0L);
    summary.put("pendingTasks", 0L);
    summary.put("positiveReplies", 0L);
    summary.put("repliedTasks", 0L);
    summary.put("sentTasks", 0L);
    summary.put("smsTasks", 0L);
    summary.put("totalTasks", 0L);
    return summary;
  }

  private void appendContactRestrictionStatusCondition(
      JdbcTemplate jdbcTemplate, List<String> conditions, List<Object> args, String status) {
    String normalizedStatus = StringUtils.hasText(status) ? status.trim() : "ACTIVE";
    boolean hasReleaseStatus = hasColumn(jdbcTemplate, "contact_restriction", "release_status");
    if ("RELEASE_PENDING".equals(normalizedStatus)) {
      conditions.add(hasReleaseStatus ? "r.status = 'ACTIVE' AND r.release_status = 'PENDING'" : "1 = 0");
      return;
    }
    if ("RELEASE_REJECTED".equals(normalizedStatus)) {
      conditions.add(hasReleaseStatus ? "r.status = 'ACTIVE' AND r.release_status = 'REJECTED'" : "1 = 0");
      return;
    }
    if (StringUtils.hasText(normalizedStatus) && !"ALL".equalsIgnoreCase(normalizedStatus)) {
      conditions.add("r.status = ?");
      args.add(normalizedStatus);
    }
  }

  private void appendContactRestrictionKeywordCondition(
      JdbcTemplate jdbcTemplate, List<String> conditions, List<Object> args, String keyword) {
    if (!StringUtils.hasText(keyword)) {
      return;
    }
    List<String> keywordParts = new ArrayList<>();
    if (hasContactRestrictionLeadJoinColumns(jdbcTemplate)) {
      keywordParts.add("COALESCE(le.enterprise_name, '') LIKE ?");
      keywordParts.add("COALESCE(le.contact_name, '') LIKE ?");
      args.add(like(keyword));
      args.add(like(keyword));
    }
    if (hasContactRestrictionEnterpriseJoinColumns(jdbcTemplate)) {
      keywordParts.add("COALESCE(ee.enterprise_name, '') LIKE ?");
      keywordParts.add("COALESCE(ee.contact_name, '') LIKE ?");
      args.add(like(keyword));
      args.add(like(keyword));
    }
    if (hasContactRestrictionLeadJoinColumns(jdbcTemplate)
        && hasColumns(jdbcTemplate, "park", "park_id", "park_name")) {
      keywordParts.add("COALESCE(p.park_name, '') LIKE ?");
      args.add(like(keyword));
    }
    keywordParts.add("COALESCE(r.phone_number, '') LIKE ?");
    keywordParts.add("COALESCE(r.reason, '') LIKE ?");
    args.add(like(keyword));
    args.add(like(keyword));
    conditions.add("(" + String.join(" OR ", keywordParts) + ")");
  }

  private void appendContactRestrictionAuditKeywordCondition(
      boolean hasRestriction, List<String> conditions, List<Object> args, String keyword) {
    if (!StringUtils.hasText(keyword)) {
      return;
    }
    List<String> keywordParts = new ArrayList<>();
    keywordParts.add("COALESCE(a.actor_name, '') LIKE ?");
    keywordParts.add("COALESCE(a.remark, '') LIKE ?");
    args.add(like(keyword));
    args.add(like(keyword));
    if (hasRestriction) {
      keywordParts.add("COALESCE(r.phone_number, '') LIKE ?");
      keywordParts.add("COALESCE(r.reason, '') LIKE ?");
      args.add(like(keyword));
      args.add(like(keyword));
    }
    conditions.add("(" + String.join(" OR ", keywordParts) + ")");
  }

  private String contactRestrictionFromSql(JdbcTemplate jdbcTemplate) {
    String leadJoin =
        hasContactRestrictionLeadJoinColumns(jdbcTemplate)
            ? "LEFT JOIN investment_lead l ON l.lead_id = r.lead_id "
            : "";
    String leadEnterpriseJoin =
        hasContactRestrictionLeadJoinColumns(jdbcTemplate)
            ? "LEFT JOIN investment_enterprise le ON le.enterprise_id = l.enterprise_id "
            : "";
    String directEnterpriseJoin =
        hasContactRestrictionEnterpriseJoinColumns(jdbcTemplate)
            ? "LEFT JOIN investment_enterprise ee ON ee.enterprise_id = r.enterprise_id "
            : "";
    String parkJoin =
        hasContactRestrictionLeadJoinColumns(jdbcTemplate)
                && hasColumns(jdbcTemplate, "park", "park_id", "park_name")
            ? "LEFT JOIN park p ON p.park_id = l.park_id "
            : "";
    return "FROM contact_restriction r "
        + leadJoin
        + leadEnterpriseJoin
        + directEnterpriseJoin
        + parkJoin;
  }

  private String contactRestrictionNameSelect(JdbcTemplate jdbcTemplate) {
    boolean hasLeadEnterprise = hasContactRestrictionLeadJoinColumns(jdbcTemplate);
    boolean hasDirectEnterprise = hasContactRestrictionEnterpriseJoinColumns(jdbcTemplate);
    boolean hasPark =
        hasLeadEnterprise && hasColumns(jdbcTemplate, "park", "park_id", "park_name");
    String enterpriseName;
    String contactName;
    if (hasLeadEnterprise && hasDirectEnterprise) {
      enterpriseName = "COALESCE(le.enterprise_name, ee.enterprise_name)";
      contactName = "COALESCE(le.contact_name, ee.contact_name)";
    } else if (hasLeadEnterprise) {
      enterpriseName = "le.enterprise_name";
      contactName = "le.contact_name";
    } else if (hasDirectEnterprise) {
      enterpriseName = "ee.enterprise_name";
      contactName = "ee.contact_name";
    } else {
      enterpriseName = "NULL";
      contactName = "NULL";
    }
    String parkName = hasPark ? "p.park_name" : "NULL";
    return enterpriseName
        + " AS enterpriseName,\n"
        + contactName
        + " AS contactName,\n"
        + parkName
        + " AS parkName,\n";
  }

  private boolean hasContactRestrictionLeadJoinColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(jdbcTemplate, "investment_lead", "lead_id", "enterprise_id", "park_id")
        && hasColumns(
            jdbcTemplate,
            "investment_enterprise",
            "enterprise_id",
            "enterprise_name",
            "contact_name");
  }

  private boolean hasContactRestrictionEnterpriseJoinColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
        jdbcTemplate,
        "investment_enterprise",
        "enterprise_id",
        "enterprise_name",
        "contact_name");
  }

  private Map<String, Object> contactRestrictionSummary(
      JdbcTemplate jdbcTemplate, String fromSql, String whereSql, List<Object> args) {
    if (!hasContactRestrictionCoreColumns(jdbcTemplate)) {
      return emptyContactRestrictionSummary();
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COUNT(*) AS totalRestrictions,
              SUM(CASE WHEN r.status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeRestrictions,
              SUM(CASE WHEN r.status <> 'ACTIVE' THEN 1 ELSE 0 END) AS releasedRestrictions,
              SUM(CASE WHEN r.restriction_type = 'BLACKLIST' THEN 1 ELSE 0 END) AS blacklistRestrictions,
              SUM(CASE WHEN r.restriction_type = 'UNSUBSCRIBED' THEN 1 ELSE 0 END) AS unsubscribedRestrictions,
              SUM(CASE WHEN r.restriction_type = 'NEGATIVE_REPLY' THEN 1 ELSE 0 END) AS negativeReplyRestrictions
            """
                + fromSql
                + " "
                + whereSql,
            (rs, rowNum) -> contactRestrictionSummaryMap(rs),
            args.toArray());
    return rows.isEmpty() ? emptyContactRestrictionSummary() : rows.get(0);
  }

  private Map<String, Object> findCrawlerSourceForOps(
      JdbcTemplate jdbcTemplate, Integer sourceId, String sourceCode) {
    if (!hasCrawlerSourceColumns(jdbcTemplate)) {
      return null;
    }
    if (sourceId != null && sourceId > 0) {
      return findCrawlerSourceById(jdbcTemplate, sourceId);
    }
    String normalizedCode =
        StringUtils.hasText(sourceCode) ? sourceCode.trim() : PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE;
    return findCrawlerSourceByCode(jdbcTemplate, normalizedCode);
  }

  private Map<String, Object> findCrawlerSourceById(JdbcTemplate jdbcTemplate, long sourceId) {
    if (!hasCrawlerSourceColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              source_id AS sourceId,
              source_code AS sourceCode,
              source_name AS sourceName,
              source_type AS sourceType,
              base_url AS baseUrl,
              robots_url AS robotsUrl,
              enabled,
              crawl_interval_minutes AS crawlIntervalMinutes,
              rate_limit_per_minute AS rateLimitPerMinute,
              allowed_paths_json AS allowedPathsJson,
              blocked_paths_json AS blockedPathsJson,
              keyword_include_json AS keywordIncludeJson,
              keyword_exclude_json AS keywordExcludeJson,
              region_scope_json AS regionScopeJson,
              last_crawled_at AS lastCrawledAt,
              create_time AS createTime,
              update_time AS updateTime
            FROM crawler_source
            WHERE source_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> crawlerSourceMap(rs),
            sourceId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findCrawlerSourceByCode(JdbcTemplate jdbcTemplate, String sourceCode) {
    if (!StringUtils.hasText(sourceCode) || RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.contains(sourceCode)) {
      return null;
    }
    if (!hasCrawlerSourceColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              source_id AS sourceId,
              source_code AS sourceCode,
              source_name AS sourceName,
              source_type AS sourceType,
              base_url AS baseUrl,
              robots_url AS robotsUrl,
              enabled,
              crawl_interval_minutes AS crawlIntervalMinutes,
              rate_limit_per_minute AS rateLimitPerMinute,
              allowed_paths_json AS allowedPathsJson,
              blocked_paths_json AS blockedPathsJson,
              keyword_include_json AS keywordIncludeJson,
              keyword_exclude_json AS keywordExcludeJson,
              region_scope_json AS regionScopeJson,
              last_crawled_at AS lastCrawledAt,
              create_time AS createTime,
              update_time AS updateTime
            FROM crawler_source
            WHERE source_code = ?
            LIMIT 1
            """,
            (rs, rowNum) -> crawlerSourceMap(rs),
            sourceCode.trim());
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findLatestCrawlerTaskBySourceId(
      JdbcTemplate jdbcTemplate, long sourceId) {
    if (!hasCrawlerTaskColumns(jdbcTemplate)) {
      return null;
    }
    Map<String, Object> page = findCrawlerTasks(jdbcTemplate, 1, 1, (int) sourceId, null);
    Object items = page.get("items");
    if (items instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> map) {
      Map<String, Object> result = new LinkedHashMap<>();
      map.forEach((key, value) -> result.put(String.valueOf(key), value));
      return result;
    }
    return null;
  }

  private Map<String, Object> countCrawlerTasksByStatus(
      JdbcTemplate jdbcTemplate, long sourceId) {
    if (!hasColumns(jdbcTemplate, "crawler_task", "source_id", "status")) {
      return Map.of();
    }
    return statusCountMap(
        jdbcTemplate,
        """
        SELECT status, COUNT(*) AS count
        FROM crawler_task
        WHERE source_id = ?
        GROUP BY status
        """,
        sourceId);
  }

  private Map<String, Object> countCrawlerTaskItemsByStatus(
      JdbcTemplate jdbcTemplate, long sourceId) {
    if (!hasColumns(jdbcTemplate, "crawler_task_item", "source_id", "status")) {
      return Map.of();
    }
    return statusCountMap(
        jdbcTemplate,
        """
        SELECT status, COUNT(*) AS count
        FROM crawler_task_item
        WHERE source_id = ?
        GROUP BY status
        """,
        sourceId);
  }

  private Map<String, Object> statusCountMap(JdbcTemplate jdbcTemplate, String sql, Object... args) {
    Map<String, Object> result = new LinkedHashMap<>();
    jdbcTemplate
        .query(
            sql,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("status", defaultString(rs.getString("status"), "UNKNOWN"));
              row.put("count", rs.getLong("count"));
              return row;
            },
            args)
        .forEach(row -> result.put(String.valueOf(row.get("status")), row.get("count")));
    return result;
  }

  private List<Map<String, Object>> findLatestFailedCrawlerTaskItems(
      JdbcTemplate jdbcTemplate, long sourceId, int limit) {
    if (!hasCrawlerTaskItemColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          item_id AS itemId,
          source_id AS sourceId,
          last_task_id AS lastTaskId,
          source_ref_type AS sourceRefType,
          source_ref_id AS sourceRefId,
          source_url AS sourceUrl,
          status,
          retry_count AS retryCount,
          max_retry_count AS maxRetryCount,
          next_retry_at AS nextRetryAt,
          last_http_status AS lastHttpStatus,
          last_error AS lastError,
          skip_reason AS skipReason,
          published_at AS publishedAt,
          last_started_at AS lastStartedAt,
          last_finished_at AS lastFinishedAt,
          last_success_at AS lastSuccessAt,
          create_time AS createTime,
          update_time AS updateTime
        FROM crawler_task_item
        WHERE source_id = ?
          AND status IN ('FAILED', 'RETRY_WAITING')
        ORDER BY update_time DESC, item_id DESC
        LIMIT ?
        """,
        (rs, rowNum) -> crawlerTaskItemMap(rs),
        sourceId,
        Math.max(1, Math.min(20, limit)));
  }

  private Map<String, Object> crawlerSchedulerStatusWithPolicy(Map<String, Object> source) {
    Map<String, Object> scheduler = crawlerSchedulerStatusBase();
    String policyReason = crawlerSourcePolicyReason(source);
    String intervalReason = policyReason == null ? crawlerIntervalPolicyReason(source) : policyReason;
    scheduler.put("canRunNow", policyReason == null && intervalReason == null);
    scheduler.put("reason", policyReason == null ? intervalReason : policyReason);
    return scheduler;
  }

  private Map<String, Object> crawlerSchedulerStatusBase() {
    boolean envEnabled =
        !"false"
            .equalsIgnoreCase(defaultString(settingValue("INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED"), "true"));
    boolean enabled = envEnabled;
    int dailyRunHour =
        normalizedHour(longValue(settingValue("INVESTMENT_RADAR_PUBLIC_CRAWLER_DAILY_HOUR")), 8);
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("active", false);
    map.put("dailyRunHour", dailyRunHour);
    map.put("enabled", enabled);
    map.put("envEnabled", envEnabled);
    map.put(
        "intervalMs",
        positiveLong(settingValue("INVESTMENT_RADAR_PUBLIC_CRAWLER_INTERVAL_MS"), 24L * 60 * 60 * 1000));
    map.put("lastError", null);
    map.put("lastSkipReason", null);
    map.put("lastTaskId", null);
    map.put("lastTickFinishedAt", null);
    map.put("lastTickStartedAt", null);
    map.put("mode", defaultString(settingValue("INVESTMENT_RADAR_PUBLIC_CRAWLER_MODE"), "DEMAND"));
    map.put("nextRunAt", enabled ? nextDailyRunAt(dailyRunHour) : null);
    map.put("running", false);
    map.put("scheduleType", "DAILY");
    map.put("startSource", null);
    map.put("startedAt", null);
    map.put("stoppedAt", null);
    map.put("version", PUBLIC_OPPORTUNITY_CRAWLER_SCHEDULER_VERSION);
    return map;
  }

  private String crawlerSourcePolicyReason(Map<String, Object> source) {
    if (!booleanValue(source.get("enabled"))) {
      return "SOURCE_DISABLED";
    }
    if (longValue(source.get("rateLimitPerMinute")) <= 0) {
      return "RATE_LIMIT_INVALID";
    }
    long intervalMinutes = longValue(source.get("crawlIntervalMinutes"));
    if (intervalMinutes < 0 || ("PUBLIC_OPPORTUNITY".equals(source.get("sourceType")) && intervalMinutes <= 0)) {
      return "CRAWL_INTERVAL_INVALID";
    }
    String sourceCode = stringObject(source.get("sourceCode"));
    if (PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE.equals(sourceCode)
        && !isPublicOpportunity99CfwAllowedPathPolicy(source.get("allowedPathsJson"))) {
      return "SOURCE_PATH_ALLOWLIST_WOULD_BROADEN";
    }
    return null;
  }

  private String crawlerIntervalPolicyReason(Map<String, Object> source) {
    Instant lastCrawledAt = instantValue(source.get("lastCrawledAt"), null);
    long intervalMinutes = longValue(source.get("crawlIntervalMinutes"));
    if (lastCrawledAt == null || intervalMinutes <= 0) {
      return null;
    }
    Instant nextAllowed = lastCrawledAt.plusSeconds(intervalMinutes * 60);
    return Instant.now().isBefore(nextAllowed) ? "CRAWL_INTERVAL_NOT_REACHED" : null;
  }

  private boolean isPublicOpportunity99CfwAllowedPathPolicy(Object value) {
    if (!(value instanceof List<?> items) || items.size() != 2) {
      return false;
    }
    return "/changfangxuqiu/".equals(String.valueOf(items.get(0)))
        && "/xuqiu/".equals(String.valueOf(items.get(1)));
  }

  private Map<String, Object> emptyCrawlerOpsSummary(String reason) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("itemStatus", Map.of());
    result.put("latestFailedItems", List.of());
    result.put("latestTask", null);
    Map<String, Object> scheduler = crawlerSchedulerStatusBase();
    scheduler.put("canRunNow", false);
    scheduler.put("reason", reason);
    result.put("scheduler", scheduler);
    result.put("source", null);
    result.put("taskStatus", Map.of());
    return result;
  }

  private List<Map<String, Object>> findPublicCrawlerHealthSources(JdbcTemplate jdbcTemplate) {
    if (!hasCrawlerSourceColumns(jdbcTemplate)) {
      return List.of();
    }
    List<String> sourceCodes = new ArrayList<>(PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES);
    return jdbcTemplate.query(
        """
        SELECT
          source_id AS sourceId,
          source_code AS sourceCode,
          source_name AS sourceName,
          source_type AS sourceType,
          base_url AS baseUrl,
          robots_url AS robotsUrl,
          enabled,
          crawl_interval_minutes AS crawlIntervalMinutes,
          rate_limit_per_minute AS rateLimitPerMinute,
          allowed_paths_json AS allowedPathsJson,
          blocked_paths_json AS blockedPathsJson,
          keyword_include_json AS keywordIncludeJson,
          keyword_exclude_json AS keywordExcludeJson,
          region_scope_json AS regionScopeJson,
          last_crawled_at AS lastCrawledAt,
          create_time AS createTime,
          update_time AS updateTime
        FROM crawler_source
        WHERE source_code IN (
        """
            + placeholders(sourceCodes.size())
            + """
        )
        ORDER BY source_code ASC
        """,
        (rs, rowNum) -> crawlerSourceMap(rs),
        sourceCodes.toArray());
  }

  private Map<Long, Map<String, Object>> publicCrawlerTaskStats(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> sources) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_task",
        "source_id",
        "status",
        "fetched_count",
        "created_lead_count",
        "updated_lead_count",
        "create_time")) {
      return Map.of();
    }
    List<Long> sourceIds = sourceIds(sources);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              source_id AS sourceId,
              SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedTasks,
              SUM(CASE WHEN status = 'SUCCESS' AND fetched_count = 0 AND created_lead_count = 0 AND updated_lead_count = 0 THEN 1 ELSE 0 END) AS zeroOutputTaskCount
            FROM crawler_task
            WHERE source_id IN (
            """
                + placeholders(sourceIds.size())
                + """
            )
              AND create_time >= DATE_SUB(NOW(3), INTERVAL 7 DAY)
            GROUP BY source_id
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("failedTasks", rs.getLong("failedTasks"));
              map.put("sourceId", rs.getLong("sourceId"));
              map.put("zeroOutputTaskCount", rs.getLong("zeroOutputTaskCount"));
              return map;
            },
            sourceIds.toArray());
    return rowsByLongKey(rows, "sourceId");
  }

  private Map<Long, Map<String, Object>> publicCrawlerItemStats(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> sources) {
    if (!hasColumns(jdbcTemplate, "crawler_task_item", "source_id", "status")) {
      return Map.of();
    }
    List<Long> sourceIds = sourceIds(sources);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              source_id AS sourceId,
              COUNT(*) AS totalItems,
              SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successItems,
              SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedItems,
              SUM(CASE WHEN status IN ('PENDING', 'RUNNING', 'RETRY_WAITING') THEN 1 ELSE 0 END) AS pendingItems
            FROM crawler_task_item
            WHERE source_id IN (
            """
                + placeholders(sourceIds.size())
                + """
            )
            GROUP BY source_id
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("failedItems", rs.getLong("failedItems"));
              map.put("pendingItems", rs.getLong("pendingItems"));
              map.put("sourceId", rs.getLong("sourceId"));
              map.put("successItems", rs.getLong("successItems"));
              map.put("totalItems", rs.getLong("totalItems"));
              return map;
            },
            sourceIds.toArray());
    return rowsByLongKey(rows, "sourceId");
  }

  private Map<Long, Map<String, Object>> publicCrawlerLatestTaskStats(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> sources) {
    if (!hasColumns(jdbcTemplate, "crawler_task", "source_id", "task_id", "status", "error_message", "create_time")) {
      return Map.of();
    }
    List<Long> sourceIds = sourceIds(sources);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT latest.*
            FROM (
              SELECT
                source_id AS sourceId,
                task_id AS latestTaskId,
                status AS latestTaskStatus,
                error_message AS latestError,
                ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY create_time DESC, task_id DESC) AS rowNum
              FROM crawler_task
              WHERE source_id IN (
            """
                + placeholders(sourceIds.size())
                + """
              )
            ) latest
            WHERE latest.rowNum = 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("latestError", rs.getString("latestError"));
              map.put("latestTaskId", nullableLong(rs, "latestTaskId"));
              map.put("latestTaskStatus", rs.getString("latestTaskStatus"));
              map.put("sourceId", rs.getLong("sourceId"));
              return map;
            },
            sourceIds.toArray());
    return rowsByLongKey(rows, "sourceId");
  }

  private List<Long> sourceIds(List<Map<String, Object>> sources) {
    return sources.stream().map(source -> longValue(source.get("sourceId"))).filter(id -> id > 0).toList();
  }

  private Map<Long, Map<String, Object>> rowsByLongKey(List<Map<String, Object>> rows, String key) {
    Map<Long, Map<String, Object>> result = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      result.put(longValue(row.get(key)), row);
    }
    return result;
  }

  private String resolvePublicCrawlerHealthStatus(
      boolean enabled,
      long failedTasks,
      long zeroOutputTaskCount,
      String latestError,
      long pendingItems,
      double successRate,
      long totalItems) {
    if (!enabled) {
      return "DISABLED";
    }
    if (StringUtils.hasText(latestError)
        && latestError.matches("(?i).*?(403|captcha|forbidden|anti|blocked|timeout|ECONN|ENOTFOUND).*")) {
      return "BLOCKED";
    }
    if (failedTasks > 0 || zeroOutputTaskCount > 0) {
      return "WARNING";
    }
    if (totalItems > 0 && successRate < 50) {
      return "STALE";
    }
    if (pendingItems > 0 && successRate == 0) {
      return "STALE";
    }
    return "HEALTHY";
  }

  private Map<String, Object> publicCrawlerHealthResult(List<Map<String, Object>> sources) {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put(
        "blockedSourceCount",
        sources.stream().filter(source -> "BLOCKED".equals(source.get("healthStatus"))).count());
    summary.put("failedTaskCount", sumLong(sources, "failedTasks"));
    summary.put(
        "healthySourceCount",
        sources.stream().filter(source -> "HEALTHY".equals(source.get("healthStatus"))).count());
    summary.put("sourceCount", sources.size());
    summary.put(
        "warningSourceCount",
        sources.stream()
            .filter(source -> Set.of("BLOCKED", "STALE", "WARNING").contains(source.get("healthStatus")))
            .count());
    summary.put("zeroOutputTaskCount", sumLong(sources, "zeroOutputTaskCount"));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("generatedAt", Instant.now().toString());
    result.put("scheduler", crawlerSchedulerStatusBase());
    result.put("sources", sources);
    result.put("summary", summary);
    return result;
  }

  private Map<String, Object> createPendingCrawlerTask(
      JdbcTemplate jdbcTemplate,
      long sourceId,
      String taskType,
      Map<String, Object> requestConfig,
      String skipReason) {
    long taskId =
        radarTransactionTemplate(jdbcTemplate)
            .execute(
                ignored -> {
                  jdbcTemplate.update(
                      """
                      INSERT INTO crawler_task (
                        source_id, task_type, status, retry_count, max_retry_count,
                        skip_reason, request_config_json, create_time, update_time
                      )
                      VALUES (?, ?, 'PENDING', 0, ?, ?, ?, NOW(3), NOW(3))
                      """,
                      sourceId,
                      taskType,
                      longValue(requestConfig.get("maxRetryCount")),
                      skipReason,
                      jsonString(requestConfig));
                  long createdTaskId = lastInsertId(jdbcTemplate);
                  appendCrawlerTaskLog(
                      jdbcTemplate,
                      createdTaskId,
                      "INFO",
                      "QUEUE",
                      "Spring Boot 已创建本地采集任务，等待 worker 执行",
                      Map.of("requestConfig", requestConfig, "skipReason", skipReason));
                  return createdTaskId;
                });
    return findCrawlerTaskById(jdbcTemplate, taskId);
  }

  private void appendCrawlerTaskLog(
      JdbcTemplate jdbcTemplate,
      long taskId,
      String level,
      String stage,
      String message,
      Map<String, Object> detail) {
    if (!hasCrawlerTaskLogColumns(jdbcTemplate)) {
      return;
    }
    jdbcTemplate.update(
        """
        INSERT INTO crawler_task_log (task_id, level, stage, message, detail_json, create_time)
        VALUES (?, ?, ?, ?, ?, NOW(3))
        """,
        taskId,
        cleanTextMax(level, 20),
        cleanTextMax(stage, 50),
        cleanTextMax(message, 500),
        jsonString(detail == null ? Map.of() : detail));
  }

  private Map<String, Object> localQueuedCrawlerRunResult(
      Map<String, Object> task, Map<String, Object> source, Map<String, Object> options) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("createdLeadCount", 0);
    result.put("discoveredUrlCount", 0);
    result.put("fetchedCount", 0);
    result.put("listDiscovery", null);
    result.put("requestConfig", options);
    result.put("skippedCount", 0);
    result.put("sourceCode", source.get("sourceCode"));
    result.put("sourceId", source.get("sourceId"));
    result.put("status", "PENDING");
    result.put("task", task);
    result.put("taskId", task == null ? null : task.get("taskId"));
    result.put("updatedLeadCount", 0);
    result.put("workerMode", "LOCAL_QUEUE_ONLY");
    return result;
  }

  private Map<String, Object> localQueuedBatchPlatformResult(
      Map<String, Object> source, Map<String, Object> task) {
    String sourceCode = stringObject(source.get("sourceCode"));
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("collectedEffectiveCount", 0);
    item.put("createdLeadCount", 0);
    item.put("discoveredUrlCount", 0);
    item.put("errorMessage", null);
    item.put("fetchSuccessCount", 0);
    item.put("opportunityType", publicOpportunityTypeBySourceCode(sourceCode));
    item.put("roundIndex", 1);
    item.put("skippedCount", 0);
    item.put("sourceCode", sourceCode);
    item.put("sourceName", source.get("sourceName"));
    item.put("status", "PENDING");
    item.put("task", task);
    item.put("taskId", task == null ? null : task.get("taskId"));
    item.put("upsertedCount", 0);
    item.put("workerMode", "LOCAL_QUEUE_ONLY");
    item.put("yieldedEffective", false);
    item.put("zeroOutput", true);
    return item;
  }

  private Map<String, Object> publicOpportunityBatchTotals(List<Map<String, Object>> items) {
    Map<String, Object> total = new LinkedHashMap<>();
    total.put("collectedEffectiveCount", 0);
    total.put("createdLeadCount", 0);
    total.put("discoveredUrlCount", 0);
    total.put("failedPlatformCount", 0);
    total.put("fetchSuccessCount", 0);
    total.put("fetchedCount", 0);
    total.put("onlyZeroOutput", items.isEmpty());
    total.put("queuedPlatformCount", items.size());
    total.put("skippedCount", 0);
    total.put("successPlatformCount", 0);
    total.put("totalPlatformCount", items.size());
    total.put("updatedLeadCount", 0);
    total.put("upsertedCount", 0);
    total.put("zeroOutputPlatformCount", items.size());
    return total;
  }

  private Map<String, Object> emptyPublicOpportunityBatchRunResult(String mode) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("finishedAt", Instant.now().toString());
    result.put("items", List.of());
    result.put("maxRounds", 0);
    result.put("mode", mode);
    result.put("remainingCount", null);
    result.put("roundCount", 0);
    result.put("startedAt", Instant.now().toString());
    result.put("targetReached", false);
    result.put("total", publicOpportunityBatchTotals(List.of()));
    return result;
  }

  private Map<String, Object> normalizePublicOpportunityCrawlerOptions(
      PublicOpportunityCrawlerRunRequest request) {
    Map<String, Object> options = new LinkedHashMap<>();
    options.put(
        "batchSize",
        positiveIntegerOrDefault(
            request == null ? null : request.batchSize(),
            PUBLIC_OPPORTUNITY_CRAWLER_BATCH_SIZE_DEFAULT,
            1,
            PUBLIC_OPPORTUNITY_CRAWLER_BATCH_SIZE_MAX));
    options.put("discoverList", booleanValueOrDefault(request == null ? null : request.discoverList(), true));
    options.put(
        "freshnessDays",
        positiveIntegerOrDefault(
            request == null ? null : request.freshnessDays(),
            PUBLIC_OPPORTUNITY_CRAWLER_FRESHNESS_DAYS,
            1,
            PUBLIC_OPPORTUNITY_CRAWLER_FRESHNESS_DAYS));
    options.put("ignoreInterval", booleanValue(request == null ? null : request.ignoreInterval()));
    options.put(
        "listDiscoveryDelayMs",
        positiveIntegerOrDefault(
            request == null ? null : request.listDiscoveryDelayMs(),
            PUBLIC_OPPORTUNITY_CRAWLER_LIST_DISCOVERY_DELAY_MS,
            0,
            60_000));
    options.put(
        "maxListPages",
        positiveIntegerOrDefault(
            request == null ? null : request.maxListPages(),
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_LIST_PAGES_DEFAULT,
            1,
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_LIST_PAGES_MAX));
    options.put(
        "maxRetryCount",
        positiveIntegerOrDefault(
            request == null ? null : request.maxRetryCount(),
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_RETRY_COUNT_DEFAULT,
            1,
            10));
    options.put("reprocessSuccess", booleanValue(request == null ? null : request.reprocessSuccess()));
    options.put(
        "retryDelayMinutes",
        positiveIntegerOrDefault(
            request == null ? null : request.retryDelayMinutes(),
            PUBLIC_OPPORTUNITY_CRAWLER_RETRY_DELAY_MINUTES_DEFAULT,
            1,
            24 * 60));
    options.put(
        "staleReprocessMinutes",
        positiveIntegerOrDefault(
            request == null ? null : request.staleReprocessMinutes(),
            PUBLIC_OPPORTUNITY_CRAWLER_STALE_REPROCESS_MINUTES_DEFAULT,
            1,
            24 * 60));
    return options;
  }

  private Map<String, Object> normalizePublicOpportunityBatchOptions(
      PublicOpportunityBatchRunRequest request, String mode) {
    Map<String, Object> options =
        normalizePublicOpportunityCrawlerOptions(
            new PublicOpportunityCrawlerRunRequest(
                request == null ? null : request.batchSize(),
                request == null ? null : request.discoverList(),
                request == null ? null : request.freshnessDays(),
                request == null ? null : request.ignoreInterval(),
                request == null ? null : request.listDiscoveryDelayMs(),
                request == null ? null : request.maxListPages(),
                request == null ? null : request.maxRetryCount(),
                request == null ? null : request.reprocessSuccess(),
                request == null ? null : request.retryDelayMinutes(),
                request == null ? null : request.staleReprocessMinutes(),
                null));
    options.put("continueOnError", booleanValueOrDefault(request == null ? null : request.continueOnError(), true));
    options.put(
        "maxConcurrency",
        positiveIntegerOrDefault(
            request == null ? null : request.maxConcurrency(),
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_CONCURRENCY_DEFAULT,
            1,
            8));
    options.put(
        "maxListPages",
        positiveIntegerOrDefault(
            request == null ? null : request.maxListPages(),
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_LIST_PAGES_DEFAULT,
            1,
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_LIST_PAGES_MAX));
    options.put(
        "maxRounds",
        positiveIntegerOrDefault(
            request == null ? null : request.maxRounds(),
            PUBLIC_OPPORTUNITY_CRAWLER_MAX_ROUNDS_DEFAULT,
            1,
            10));
    options.put("mode", mode);
    options.put(
        "targetCount",
        nullableIntegerInRange(
            request == null ? null : request.targetCount(), 1, PUBLIC_OPPORTUNITY_CRAWLER_TARGET_COUNT_MAX));
    return options;
  }

  private String normalizePublicOpportunityBatchMode(Object value) {
    String text = defaultString(stringObject(value), "ALL").trim().toUpperCase(Locale.ROOT);
    if ("LISTING".equals(text) || "LISTINGS".equals(text) || "房源".equals(text)) {
      return "SUPPLY";
    }
    if ("需求".equals(text)) {
      return "DEMAND";
    }
    if (Set.of("ALL", "DEMAND", "SUPPLY").contains(text)) {
      return text;
    }
    throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_PUBLIC_OPPORTUNITY_BATCH_MODE");
  }

  private Map<String, Object> namedCrawlerSpec(String crawlerCode) {
    String normalized = defaultString(crawlerCode).trim().toUpperCase(Locale.ROOT);
    return switch (normalized) {
      case "EIA" ->
          Map.of(
              "requestPath",
              "/api/investment/radar/crawler-task/run-eia",
              "sourceCode",
              "PUBLIC_EIA_NOTICE_MEE_CANDIDATE",
              "taskType",
              "MANUAL_EIA");
      case "INTERNAL_CONTRACT_EXPIRY" ->
          Map.of(
              "horizonDays",
              90,
              "requestPath",
              "/api/investment/radar/crawler-task/run-internal-contract-expiry",
              "sourceCode",
              "INTERNAL_CONTRACT_EXPIRY",
              "taskType",
              "INTERNAL_CONTRACT_EXPIRY");
      case "RECRUITMENT" ->
          Map.of(
              "requestPath",
              "/api/investment/radar/crawler-task/run-recruitment",
              "sourceCode",
              "PUBLIC_RECRUITMENT_51JOB_CANDIDATE",
              "taskType",
              "MANUAL_RECRUITMENT");
      case "TENDER" ->
          Map.of(
              "requestPath",
              "/api/investment/radar/crawler-task/run-tender",
              "sourceCode",
              "PUBLIC_TENDER_CCGP_CANDIDATE",
              "taskType",
              "MANUAL_TENDER");
      default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "crawlerCode 无效");
    };
  }

  private List<Map<String, Object>> findPublicOpportunityCrawlerSourcesForBatch(
      JdbcTemplate jdbcTemplate, String mode) {
    if (!hasCrawlerSourceColumns(jdbcTemplate)) {
      return List.of();
    }
    List<String> sourceCodes =
        PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.stream()
            .filter(sourceCode -> "ALL".equals(mode) || mode.equals(publicOpportunityTypeBySourceCode(sourceCode)))
            .toList();
    if (sourceCodes.isEmpty()) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          source_id AS sourceId,
          source_code AS sourceCode,
          source_name AS sourceName,
          source_type AS sourceType,
          base_url AS baseUrl,
          robots_url AS robotsUrl,
          enabled,
          crawl_interval_minutes AS crawlIntervalMinutes,
          rate_limit_per_minute AS rateLimitPerMinute,
          allowed_paths_json AS allowedPathsJson,
          blocked_paths_json AS blockedPathsJson,
          keyword_include_json AS keywordIncludeJson,
          keyword_exclude_json AS keywordExcludeJson,
          region_scope_json AS regionScopeJson,
          last_crawled_at AS lastCrawledAt,
          create_time AS createTime,
          update_time AS updateTime
        FROM crawler_source
        WHERE enabled = 1
          AND source_code IN (
        """
            + placeholders(sourceCodes.size())
            + """
        )
        ORDER BY source_code ASC
        """,
        (rs, rowNum) -> crawlerSourceMap(rs),
        sourceCodes.toArray());
  }

  private String optionalColumnSelect(
      JdbcTemplate jdbcTemplate, String tableName, String columnName, String tableAlias, String fieldAlias) {
    String expression =
        hasColumn(jdbcTemplate, tableName, columnName)
            ? tableAlias + "." + columnName
            : "NULL";
    return expression + " AS " + fieldAlias + ",\n";
  }

  private long countPendingOutreachTasks(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(jdbcTemplate, "investment_outreach_task", "lead_id", "status")) {
      return 0;
    }
    return count(
        jdbcTemplate,
        """
        SELECT COUNT(*)
        FROM investment_outreach_task
        WHERE lead_id = ? AND status IN ('PENDING', 'RUNNING', 'SENT')
        """,
        List.of(leadId));
  }

  private Map<String, Object> findContactRestrictionCheck(
      JdbcTemplate jdbcTemplate, Long enterpriseId, long leadId, String phoneNumber) {
    Map<String, Object> allowed = new LinkedHashMap<>();
    allowed.put("canContact", true);
    allowed.put("reason", "");
    if (!hasContactRestrictionCoreColumns(jdbcTemplate)) {
      return allowed;
    }
    String normalizedPhoneNumber = normalizeContactPhone(phoneNumber);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT restriction_type AS restrictionType, reason
            FROM contact_restriction
            WHERE status = 'ACTIVE'
              AND (
                (lead_id IS NOT NULL AND lead_id = ?)
                OR (enterprise_id IS NOT NULL AND enterprise_id = ?)
                OR (
                  phone_number IS NOT NULL
                  AND phone_number <> ''
                  AND (phone_number = ? OR phone_number = ?)
                )
              )
            ORDER BY
              CASE restriction_type
                WHEN 'UNSUBSCRIBED' THEN 0
                WHEN 'BLACKLIST' THEN 1
                WHEN 'NEGATIVE_REPLY' THEN 2
                ELSE 3
              END,
              restriction_id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("reason", rs.getString("reason"));
              map.put("restrictionType", rs.getString("restrictionType"));
              return map;
            },
            leadId,
            enterpriseId,
            cleanText(phoneNumber),
            normalizedPhoneNumber);
    if (rows.isEmpty()) {
      return allowed;
    }
    Map<String, Object> restriction = rows.get(0);
    Map<String, Object> blocked = new LinkedHashMap<>();
    blocked.put("canContact", false);
    blocked.put(
        "reason",
        defaultString(
            stringObject(restriction.get("reason")),
            mapRestrictionReason(stringObject(restriction.get("restrictionType")))));
    return blocked;
  }

  private List<Map<String, Object>> findEnabledOutreachTemplates(JdbcTemplate jdbcTemplate) {
    if (!hasOutreachTemplateColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          template_id AS templateId,
          template_code AS templateCode,
          template_name AS templateName,
          task_type AS taskType,
          channel,
          priority_level AS priorityLevel,
          content,
          placeholder_json AS placeholderJson,
          enabled,
          approval_status AS approvalStatus,
          version_no AS versionNo,
          create_time AS createTime,
          update_time AS updateTime
        FROM investment_outreach_template
        WHERE enabled = 1 AND approval_status = 'APPROVED'
        ORDER BY enabled DESC, priority_level ASC, template_id ASC
        LIMIT 100
        """,
        (rs, rowNum) -> outreachTemplateMap(rs));
  }

  private Map<String, Object> findOutreachTemplateById(JdbcTemplate jdbcTemplate, long templateId) {
    if (!hasOutreachTemplateColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              template_id AS templateId,
              template_code AS templateCode,
              template_name AS templateName,
              task_type AS taskType,
              channel,
              priority_level AS priorityLevel,
              content,
              placeholder_json AS placeholderJson,
              enabled,
              approval_status AS approvalStatus,
              version_no AS versionNo,
              create_time AS createTime,
              update_time AS updateTime
            FROM investment_outreach_template
            WHERE template_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> outreachTemplateMap(rs),
            templateId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findOutreachTemplateByCode(JdbcTemplate jdbcTemplate, String templateCode) {
    if (!hasOutreachTemplateColumns(jdbcTemplate)) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              template_id AS templateId,
              template_code AS templateCode,
              template_name AS templateName,
              task_type AS taskType,
              channel,
              priority_level AS priorityLevel,
              content,
              placeholder_json AS placeholderJson,
              enabled,
              approval_status AS approvalStatus,
              version_no AS versionNo,
              create_time AS createTime,
              update_time AS updateTime
            FROM investment_outreach_template
            WHERE template_code = ?
            LIMIT 1
            """,
            (rs, rowNum) -> outreachTemplateMap(rs),
            templateCode);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findOutreachTaskBaseById(JdbcTemplate jdbcTemplate, long taskId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT task_id AS taskId, status
            FROM investment_outreach_task
            WHERE task_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("status", rs.getString("status"));
              map.put("taskId", rs.getLong("taskId"));
              return map;
            },
            taskId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findOutreachTaskDeliverySeed(JdbcTemplate jdbcTemplate, long taskId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.task_id AS taskId,
              t.lead_id AS leadId,
              t.task_type AS taskType,
              t.channel,
              t.phone_number AS phoneNumber,
              t.status,
              t.template_code AS templateCode,
              t.content,
              t.result_message AS resultMessage,
              l.enterprise_id AS enterpriseId,
              l.intent_area AS intentArea,
              COALESCE(e.enterprise_name, '该企业') AS companyName,
              e.contact_name AS contactName,
              COALESCE(p.park_name, '园区') AS parkName,
              tpl.content AS templateContent
            FROM investment_outreach_task t
            INNER JOIN investment_lead l
              ON l.lead_id = t.lead_id
              AND l.is_deleted = 0
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            LEFT JOIN park p ON p.park_id = l.park_id
            LEFT JOIN investment_outreach_template tpl
              ON tpl.template_code = t.template_code
            WHERE t.task_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("channel", rs.getString("channel"));
              map.put("companyName", rs.getString("companyName"));
              map.put("contactName", rs.getString("contactName"));
              map.put("content", rs.getString("content"));
              map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
              map.put("intentArea", rs.getObject("intentArea"));
              map.put("leadId", nullableLong(rs, "leadId"));
              map.put("parkName", rs.getString("parkName"));
              map.put("phoneNumber", rs.getString("phoneNumber"));
              map.put("resultMessage", rs.getString("resultMessage"));
              map.put("status", rs.getString("status"));
              map.put("taskId", rs.getLong("taskId"));
              map.put("taskType", rs.getString("taskType"));
              map.put("templateCode", rs.getString("templateCode"));
              map.put("templateContent", rs.getString("templateContent"));
              return map;
            },
            taskId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findExternalLeadUpdateResult(JdbcTemplate jdbcTemplate, long leadId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT lead_id AS leadId, status
            FROM company_lead
            WHERE lead_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("leadId", rs.getLong("leadId"));
              map.put("status", defaultString(rs.getString("status"), "NEW"));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findOutreachTaskReplySeed(JdbcTemplate jdbcTemplate, long taskId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.task_id AS taskId,
              t.lead_id AS leadId,
              t.phone_number AS phoneNumber,
              t.status,
              l.enterprise_id AS enterpriseId
            FROM investment_outreach_task t
            LEFT JOIN investment_lead l
              ON l.lead_id = t.lead_id
              AND l.is_deleted = 0
            WHERE t.task_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
              map.put("leadId", rs.getLong("leadId"));
              map.put("phoneNumber", rs.getString("phoneNumber"));
              map.put("status", rs.getString("status"));
              map.put("taskId", rs.getLong("taskId"));
              return map;
            },
            taskId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findRadarLeadContactSeed(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(jdbcTemplate, "investment_enterprise", "enterprise_id", "phone_number")) {
      List<Map<String, Object>> rows =
          jdbcTemplate.query(
              """
              SELECT lead_id AS leadId, enterprise_id AS enterpriseId
              FROM investment_lead
              WHERE lead_id = ? AND is_deleted = 0
              LIMIT 1
              """,
              (rs, rowNum) -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
                map.put("leadId", rs.getLong("leadId"));
                map.put("phoneNumber", null);
                return map;
              },
              leadId);
      return rows.isEmpty() ? null : rows.get(0);
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.enterprise_id AS enterpriseId,
              e.phone_number AS phoneNumber
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
              map.put("leadId", rs.getLong("leadId"));
              map.put("phoneNumber", rs.getString("phoneNumber"));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findRadarLeadAssignmentSeed(JdbcTemplate jdbcTemplate, long leadId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT owner_user_id AS previousOwnerUserId, stage
            FROM investment_lead
            WHERE lead_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("previousOwnerUserId", nullableLong(rs, "previousOwnerUserId"));
              map.put("stage", rs.getString("stage"));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findActiveRadarUser(JdbcTemplate jdbcTemplate, long userId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT COALESCE(NULLIF(real_name, ''), username) AS ownerName
            FROM user
            WHERE id = ? AND COALESCE(status, 1) = 1
            LIMIT 1
            """,
            (rs, rowNum) -> Map.of("ownerName", defaultString(rs.getString("ownerName"))),
            userId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private boolean radarLeadExists(JdbcTemplate jdbcTemplate, long leadId) {
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM investment_lead WHERE lead_id = ? AND is_deleted = 0",
            Long.class,
            leadId);
    return count != null && count > 0;
  }

  private Map<String, Object> findRadarSopReminderById(JdbcTemplate jdbcTemplate, long reminderId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT reminder_id AS reminderId, reminder_status AS reminderStatus
            FROM investment_sop_reminder
            WHERE reminder_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("reminderId", rs.getLong("reminderId"));
              map.put("reminderStatus", rs.getString("reminderStatus"));
              return map;
            },
            reminderId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findRadarVisitById(JdbcTemplate jdbcTemplate, long visitId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT visit_id AS visitId, lead_id AS leadId, visit_status AS visitStatus
            FROM investment_visit_record
            WHERE visit_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("leadId", rs.getLong("leadId"));
              map.put("visitId", rs.getLong("visitId"));
              map.put("visitStatus", rs.getString("visitStatus"));
              return map;
            },
            visitId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findRadarFactoryForTags(JdbcTemplate jdbcTemplate, long factoryId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT factory_id AS factoryId, factory_name AS factoryName
            FROM factory
            WHERE factory_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("factoryId", rs.getLong("factoryId"));
              map.put("factoryName", rs.getString("factoryName"));
              return map;
            },
            factoryId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void ensureContactRestrictionReleaseWritable(JdbcTemplate jdbcTemplate) {
    if (!hasContactRestrictionReleaseColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达限制释放字段未准备好");
    }
    if (!hasContactRestrictionAuditColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达限制审计表结构未准备好");
    }
  }

  private Map<String, Object> findContactRestrictionSnapshot(
      JdbcTemplate jdbcTemplate, long restrictionId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              restriction_id AS restrictionId,
              lead_id AS leadId,
              enterprise_id AS enterpriseId,
              phone_number AS phoneNumber,
              restriction_type AS restrictionType,
              reason,
              status,
              release_status AS releaseStatus,
              release_reason AS releaseReason,
              release_request_time AS releaseRequestTime,
              release_review_time AS releaseReviewTime,
              release_reviewer_id AS releaseReviewerId,
              create_time AS createTime,
              update_time AS updateTime
            FROM contact_restriction
            WHERE restriction_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> contactRestrictionSnapshotMap(rs),
            restrictionId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void insertContactRestrictionAudit(
      JdbcTemplate jdbcTemplate,
      Long restrictionId,
      String action,
      Long actorId,
      String actorName,
      Map<String, Object> before,
      Map<String, Object> after,
      String remark) {
    jdbcTemplate.update(
        """
        INSERT INTO contact_restriction_audit_log
          (restriction_id, action, actor_id, actor_name, before_json, after_json, remark, create_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
        """,
        restrictionId,
        action,
        actorId,
        blankToNullObject(actorName),
        before == null ? null : jsonString(before),
        after == null ? null : jsonString(after),
        blankToNullObject(remark));
  }

  private void importContactRestrictionItem(
      JdbcTemplate jdbcTemplate, Long actorId, String actorName, Map<String, Object> item) {
    String restrictionType = cleanText(stringObject(item.get("restrictionType")));
    Long leadId = nullableLongObject(item.get("leadId"));
    Long enterpriseId = nullableLongObject(item.get("enterpriseId"));
    String phoneNumber = normalizeContactPhone(stringObject(item.get("phoneNumber")));
    if (!StringUtils.hasText(restrictionType)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "restrictionType 不能为空");
    }
    if ((leadId == null || leadId <= 0)
        && (enterpriseId == null || enterpriseId <= 0)
        && !StringUtils.hasText(phoneNumber)) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "leadId、enterpriseId、phoneNumber 至少提供一个");
    }
    String reason =
        defaultString(cleanText(stringObject(item.get("reason"))), "批量导入限制名单");
    upsertContactRestriction(
        jdbcTemplate,
        leadId == null ? 0 : leadId,
        enterpriseId,
        phoneNumber,
        restrictionType,
        reason,
        actorId,
        actorName);
  }

  private void upsertContactRestriction(
      JdbcTemplate jdbcTemplate,
      long leadId,
      Long enterpriseId,
      String phoneNumber,
      String restrictionType,
      String reason,
      Long actorId,
      String actorName) {
    String normalizedPhoneNumber = normalizeContactPhone(phoneNumber);
    Long existingRestrictionId =
        findExistingContactRestrictionId(
            jdbcTemplate, leadId, enterpriseId, normalizedPhoneNumber, restrictionType);
    Map<String, Object> before =
        existingRestrictionId == null ? null : findContactRestrictionSnapshot(jdbcTemplate, existingRestrictionId);
    jdbcTemplate.update(
        """
        INSERT INTO contact_restriction
          (lead_id, enterprise_id, phone_number, restriction_type, reason, status, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          enterprise_id = COALESCE(VALUES(enterprise_id), enterprise_id),
          phone_number = COALESCE(VALUES(phone_number), phone_number),
          reason = VALUES(reason),
          status = 'ACTIVE',
          release_status = NULL,
          release_reason = NULL,
          release_request_time = NULL,
          release_review_time = NULL,
          release_reviewer_id = NULL,
          update_time = NOW(3)
        """,
        leadId > 0 ? leadId : null,
        enterpriseId,
        normalizedPhoneNumber,
        restrictionType,
        reason);
    Long restrictionId =
        existingRestrictionId == null
            ? findExistingContactRestrictionId(
                jdbcTemplate, leadId, enterpriseId, normalizedPhoneNumber, restrictionType)
            : existingRestrictionId;
    if (restrictionId == null || restrictionId <= 0) {
      return;
    }
    Map<String, Object> after = findContactRestrictionSnapshot(jdbcTemplate, restrictionId);
    insertContactRestrictionAudit(
        jdbcTemplate,
        restrictionId,
        before == null ? "CREATE" : "UPDATE",
        actorId,
        actorName,
        before,
        after,
        reason);
  }

  private void updateLeadStageAfterOutreachReply(
      JdbcTemplate jdbcTemplate, long leadId, String replyStatus) {
    if ("POSITIVE".equals(replyStatus)) {
      jdbcTemplate.update(
          """
          UPDATE investment_lead
          SET latest_contact_time = COALESCE(latest_contact_time, NOW(3)),
              stage = CASE
                WHEN stage IN ('PENDING_CONTACT', 'CONTACTED') THEN 'REPLIED'
                ELSE stage
              END,
              update_time = NOW(3)
          WHERE lead_id = ?
          """,
          leadId);
      return;
    }
    jdbcTemplate.update(
        """
        UPDATE investment_lead
        SET latest_contact_time = COALESCE(latest_contact_time, NOW(3)),
            stage = CASE
              WHEN stage = 'PENDING_CONTACT' THEN 'CONTACTED'
              ELSE stage
            END,
            update_time = NOW(3)
        WHERE lead_id = ?
        """,
        leadId);
  }

  private void upsertContactRestrictionFromReply(
      JdbcTemplate jdbcTemplate,
      long leadId,
      Long enterpriseId,
      String phoneNumber,
      String replyStatus,
      String replyContent,
      Long actorId,
      String actorName) {
    Map<String, String> restriction = inferContactRestrictionFromReply(replyStatus, replyContent);
    if (restriction == null) {
      return;
    }
    if (!hasContactRestrictionUpsertColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达限制表结构未准备好");
    }
    String restrictionType = restriction.get("restrictionType");
    String reason = defaultString(restriction.get("reason"), mapRestrictionReason(restrictionType));
    upsertContactRestriction(
        jdbcTemplate, leadId, enterpriseId, phoneNumber, restrictionType, reason, actorId, actorName);
  }

  private Long findExistingContactRestrictionId(
      JdbcTemplate jdbcTemplate,
      long leadId,
      Long enterpriseId,
      String phoneNumber,
      String restrictionType) {
    String normalizedPhoneNumber = normalizeContactPhone(phoneNumber);
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("restriction_type = ?");
    args.add(restrictionType);
    if (leadId > 0) {
      conditions.add("lead_id = ?");
      args.add(leadId);
    } else if (enterpriseId != null && enterpriseId > 0) {
      conditions.add("enterprise_id = ?");
      args.add(enterpriseId);
    } else if (StringUtils.hasText(normalizedPhoneNumber)) {
      conditions.add("phone_number = ?");
      args.add(normalizedPhoneNumber);
    } else {
      return null;
    }
    List<Long> ids =
        jdbcTemplate.query(
            """
            SELECT restriction_id AS restrictionId
            FROM contact_restriction
            WHERE
            """
                + String.join(" AND ", conditions)
                + """

            ORDER BY restriction_id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("restrictionId"),
            args.toArray());
    return ids.isEmpty() ? null : ids.get(0);
  }

  private Map<String, String> inferContactRestrictionFromReply(
      String replyStatus, String replyContent) {
    String status = defaultString(replyStatus).trim().toUpperCase(Locale.ROOT);
    String content = defaultString(replyContent).trim();
    if ("BLACKLIST".equals(status) || content.matches(".*(黑名单|拉黑|封存).*")) {
      return Map.of(
          "reason", defaultString(content, mapRestrictionReason("BLACKLIST")),
          "restrictionType", "BLACKLIST");
    }
    if ("UNSUBSCRIBED".equals(status)
        || content.matches(".*(退订|不要再联系|别再联系|停止联系|勿扰|拒绝联系).*")) {
      return Map.of(
          "reason", defaultString(content, mapRestrictionReason("UNSUBSCRIBED")),
          "restrictionType", "UNSUBSCRIBED");
    }
    if ("NEGATIVE".equals(status)) {
      return Map.of(
          "reason", defaultString(content, mapRestrictionReason("NEGATIVE_REPLY")),
          "restrictionType", "NEGATIVE_REPLY");
    }
    return null;
  }

  private long lastInsertId(JdbcTemplate jdbcTemplate) {
    Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    return id == null ? 0 : id;
  }

  private Map<String, Object> findExternalLeadConversionSeed(
      JdbcTemplate jdbcTemplate, long leadId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.company_name AS companyName,
              l.confidence_score AS confidenceScore,
              l.industry_name AS industryName,
              l.region_province AS regionProvince,
              l.region_city AS regionCity,
              l.region_district AS regionDistrict,
              l.demand_type AS demandType,
              l.owner_user_id AS ownerUserId,
              CASE
                WHEN radar_lead.lead_id IS NULL THEN NULL
                ELSE l.converted_radar_lead_id
              END AS convertedRadarLeadId,
              CASE
                WHEN radar_lead.lead_id IS NULL THEN NULL
                ELSE l.converted_at
              END AS convertedAt,
              l.crawled_at AS crawledAt
            FROM company_lead l
            LEFT JOIN investment_lead radar_lead
              ON radar_lead.lead_id = l.converted_radar_lead_id
              AND radar_lead.is_deleted = 0
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("companyName", defaultString(rs.getString("companyName")));
              map.put("confidenceScore", rs.getInt("confidenceScore"));
              map.put("convertedAt", toIso(safeTimestamp(rs, "convertedAt")));
              map.put("convertedRadarLeadId", nullableLong(rs, "convertedRadarLeadId"));
              map.put("crawledAt", safeTimestamp(rs, "crawledAt"));
              map.put("demandType", rs.getString("demandType"));
              map.put("industryName", rs.getString("industryName"));
              map.put("leadId", rs.getLong("leadId"));
              map.put("ownerUserId", nullableLong(rs, "ownerUserId"));
              map.put("regionCity", rs.getString("regionCity"));
              map.put("regionDistrict", rs.getString("regionDistrict"));
              map.put("regionProvince", rs.getString("regionProvince"));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findSignalEventConversionSeed(
      JdbcTemplate jdbcTemplate, long eventId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              event_id AS eventId,
              enterprise_id AS enterpriseId,
              company_name AS companyName,
              event_type AS eventType,
              event_title AS eventTitle,
              event_summary AS eventSummary,
              event_time AS eventTime,
              confidence_score AS confidenceScore,
              related_external_lead_id AS relatedExternalLeadId,
              related_radar_lead_id AS relatedRadarLeadId
            FROM signal_event
            WHERE event_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("companyName", defaultString(rs.getString("companyName")));
              map.put("confidenceScore", rs.getInt("confidenceScore"));
              map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
              map.put("eventId", rs.getLong("eventId"));
              map.put("eventSummary", rs.getString("eventSummary"));
              map.put("eventTime", safeTimestamp(rs, "eventTime"));
              map.put("eventTitle", defaultString(rs.getString("eventTitle")));
              map.put("eventType", defaultString(rs.getString("eventType"), "UNKNOWN"));
              map.put("relatedExternalLeadId", nullableLong(rs, "relatedExternalLeadId"));
              map.put("relatedRadarLeadId", nullableLong(rs, "relatedRadarLeadId"));
              return map;
            },
            eventId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private long findEnterpriseIdByName(JdbcTemplate jdbcTemplate, String companyName) {
    if (!StringUtils.hasText(companyName)) {
      return 0;
    }
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT enterprise_id AS enterpriseId
            FROM investment_enterprise
            WHERE enterprise_name = ?
            ORDER BY enterprise_id ASC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("enterpriseId"),
            companyName.trim());
    return rows.isEmpty() ? 0 : rows.get(0);
  }

  private long createEnterpriseFromExternalLead(
      JdbcTemplate jdbcTemplate, Map<String, Object> lead) {
    jdbcTemplate.update(
        """
        INSERT INTO investment_enterprise (
          enterprise_name, industry_name, city, address,
          source_first, source_latest, last_signal_time,
          create_time, update_time
        )
        VALUES (?, ?, ?, ?, 'EXTERNAL_PUBLIC', ?, ?, NOW(3), NOW(3))
        """,
        requiredText(stringObject(lead.get("companyName")), "companyName 不能为空", 200),
        cleanTextMax(stringObject(lead.get("industryName")), 100),
        cleanTextMax(stringObject(lead.get("regionCity")), 100),
        externalLeadAddress(lead),
        cleanTextMax(stringObject(lead.get("demandType")), 100),
        lead.get("crawledAt"));
    return lastInsertId(jdbcTemplate);
  }

  private long createEnterpriseFromSignalEvent(
      JdbcTemplate jdbcTemplate, Map<String, Object> event) {
    jdbcTemplate.update(
        """
        INSERT INTO investment_enterprise (
          enterprise_name, source_first, source_latest, last_signal_time,
          create_time, update_time
        )
        VALUES (?, 'SIGNAL_EVENT', ?, ?, NOW(3), NOW(3))
        """,
        requiredText(stringObject(event.get("companyName")), "companyName 不能为空", 200),
        cleanTextMax(stringObject(event.get("eventType")), 100),
        event.get("eventTime"));
    return lastInsertId(jdbcTemplate);
  }

  private long findExistingRadarLeadId(JdbcTemplate jdbcTemplate, long enterpriseId) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT lead_id AS leadId
            FROM investment_lead
            WHERE enterprise_id = ? AND is_deleted = 0
            ORDER BY lead_id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("leadId"),
            enterpriseId);
    return rows.isEmpty() ? 0 : rows.get(0);
  }

  private long createRadarLeadFromExternalLead(
      JdbcTemplate jdbcTemplate,
      long enterpriseId,
      Map<String, Object> lead,
      RadarLeadConvertRequest request) {
    int confidenceScore = clampScore(longValue(lead.get("confidenceScore")));
    Long ownerUserId = nullableLongObject(request == null ? null : request.ownerUserId());
    if (ownerUserId == null) {
      ownerUserId = nullableLongObject(lead.get("ownerUserId"));
    }
    return createRadarLead(
        jdbcTemplate, enterpriseId, "EXTERNAL_PUBLIC", confidenceScore, ownerUserId);
  }

  private long createRadarLeadFromSignalEvent(
      JdbcTemplate jdbcTemplate,
      long enterpriseId,
      Map<String, Object> event,
      RadarLeadConvertRequest request) {
    int confidenceScore = clampScore(longValue(event.get("confidenceScore")));
    Long ownerUserId = nullableLongObject(request == null ? null : request.ownerUserId());
    return createRadarLead(jdbcTemplate, enterpriseId, "SIGNAL_EVENT", confidenceScore, ownerUserId);
  }

  private long createRadarLead(
      JdbcTemplate jdbcTemplate,
      long enterpriseId,
      String leadSource,
      int intentScore,
      Long ownerUserId) {
    jdbcTemplate.update(
        """
        INSERT INTO investment_lead (
          enterprise_id, park_id, lead_source,
          intent_area, intent_score, match_score, reachable_score, total_score,
          priority_level, stage, owner_user_id, latest_contact_time,
          invalid_reason, create_time, update_time, is_deleted
        )
        VALUES (?, NULL, ?, NULL, ?, 0, 40, ?, ?, 'NEW', ?, NULL, NULL, NOW(3), NOW(3), 0)
        """,
        enterpriseId,
        leadSource,
        intentScore,
        intentScore,
        resolvePriorityLevel(intentScore),
        ownerUserId);
    return lastInsertId(jdbcTemplate);
  }

  private Map<String, Object> radarLeadConvertResult(
      String sourceIdName, long sourceId, long radarLeadId, boolean reused, Object convertedAt) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("convertedAt", convertedAt);
    result.put(sourceIdName, sourceId);
    result.put("radarLeadId", radarLeadId);
    result.put("reused", reused);
    return result;
  }

  private Map<String, Object> signalEventConvertResult(
      long eventId, long radarLeadId, boolean reused) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("eventId", eventId);
    result.put("radarLeadId", radarLeadId);
    result.put("reused", reused);
    return result;
  }

  private String externalLeadAddress(Map<String, Object> lead) {
    String address =
        java.util.stream.Stream.of(
                stringObject(lead.get("regionProvince")),
                stringObject(lead.get("regionCity")),
                stringObject(lead.get("regionDistrict")))
            .filter(StringUtils::hasText)
            .map(String::trim)
            .collect(Collectors.joining(" "));
    return cleanTextMax(address, 500);
  }

  private Map<String, Object> findRadarLeadScoreSeed(JdbcTemplate jdbcTemplate, long leadId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.enterprise_id AS enterpriseId,
              e.enterprise_name AS enterpriseName
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
              map.put("enterpriseName", defaultString(rs.getString("enterpriseName")));
              map.put("leadId", rs.getLong("leadId"));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<Map<String, Object>> findRadarLeadScoringEvents(
      JdbcTemplate jdbcTemplate, Map<String, Object> lead) {
    List<String> matchClauses = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    matchClauses.add("se.related_radar_lead_id = ?");
    args.add(lead.get("leadId"));
    if (StringUtils.hasText(stringObject(lead.get("enterpriseName")))) {
      matchClauses.add("se.company_name = ?");
      args.add(lead.get("enterpriseName"));
    }
    if (lead.get("enterpriseId") instanceof Number number && number.longValue() > 0) {
      matchClauses.add("se.enterprise_id = ?");
      args.add(number.longValue());
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              se.event_id AS eventId,
              se.company_name AS companyName,
              se.event_type AS eventType,
              se.event_title AS eventTitle,
              se.event_summary AS eventSummary,
              se.source_url AS sourceUrl,
              se.confidence_score AS confidenceScore
            FROM signal_event se
            WHERE se.is_deleted = 0
              AND (
            """
                + String.join(" OR ", matchClauses)
                + """
              )
            ORDER BY se.event_time DESC, se.event_id DESC
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              long eventId = rs.getLong("eventId");
              String evidenceText = scoringEvidenceText(jdbcTemplate, eventId);
              map.put("companyName", defaultString(rs.getString("companyName")));
              map.put("confidenceScore", rs.getInt("confidenceScore"));
              map.put("eventId", eventId);
              map.put("eventSummary", defaultString(rs.getString("eventSummary")));
              map.put("eventTitle", defaultString(rs.getString("eventTitle")));
              map.put("eventType", defaultString(rs.getString("eventType"), "UNKNOWN"));
              map.put(
                  "scoreText",
                  String.join(
                          " ",
                          defaultString(rs.getString("companyName")),
                          defaultString(rs.getString("eventTitle")),
                          defaultString(rs.getString("eventSummary")),
                          defaultString(rs.getString("sourceUrl")),
                          evidenceText)
                      .toLowerCase(Locale.ROOT));
              map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
              return map;
            },
            args.toArray());
    return rows;
  }

  private int softDeleteDirtySignalEvents(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.update(
        """
        UPDATE signal_event se
        INNER JOIN company_lead cl
          ON cl.lead_id = se.related_external_lead_id
        SET se.is_deleted = 1,
            se.update_time = NOW(3)
        WHERE se.is_deleted = 0
          AND se.related_external_lead_id IS NOT NULL
          AND (
            cl.is_deleted <> 0
            OR cl.source_url IS NULL
            OR cl.source_url = ''
            OR cl.evidence_count <= 0
            OR cl.confidence_level = 'LOW'
            OR cl.confidence_score < 60
          )
        """);
  }

  private List<Map<String, Object>> findSignalRefreshSourceLeads(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(
        """
        SELECT
          lead_id AS leadId,
          company_name AS companyName,
          lead_title AS leadTitle,
          summary,
          demand_type AS demandType,
          confidence_score AS confidenceScore,
          confidence_level AS confidenceLevel,
          evidence_count AS evidenceCount,
          source_type AS sourceType,
          source_name AS sourceName,
          source_url AS sourceUrl,
          hit_keywords AS hitKeywords,
          converted_radar_lead_id AS convertedRadarLeadId,
          crawled_at AS crawledAt,
          update_time AS updateTime
        FROM company_lead
        WHERE is_deleted = 0
          AND source_url <> ''
          AND evidence_count > 0
          AND confidence_level <> 'LOW'
          AND confidence_score >= 60
        ORDER BY update_time DESC, lead_id DESC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("companyName", defaultString(rs.getString("companyName")));
          map.put("confidenceLevel", defaultString(rs.getString("confidenceLevel")));
          map.put("confidenceScore", rs.getInt("confidenceScore"));
          map.put("convertedRadarLeadId", nullableLong(rs, "convertedRadarLeadId"));
          map.put("crawledAt", safeTimestamp(rs, "crawledAt"));
          map.put("demandType", rs.getString("demandType"));
          map.put("evidenceCount", rs.getInt("evidenceCount"));
          map.put("hitKeywords", rs.getString("hitKeywords"));
          map.put("leadId", rs.getLong("leadId"));
          map.put("leadTitle", defaultString(rs.getString("leadTitle")));
          map.put("sourceName", defaultString(rs.getString("sourceName")));
          map.put("sourceType", defaultString(rs.getString("sourceType"), "EXTERNAL_PUBLIC"));
          map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
          map.put("summary", rs.getString("summary"));
          map.put("updateTime", safeTimestamp(rs, "updateTime"));
          return map;
        });
  }

  private boolean canRefreshSignalFromLead(Map<String, Object> lead) {
    return StringUtils.hasText(stringObject(lead.get("sourceUrl")))
        && longValue(lead.get("evidenceCount")) > 0
        && !"LOW".equals(stringObject(lead.get("confidenceLevel")))
        && longValue(lead.get("confidenceScore")) >= 60;
  }

  private void upsertSignalEventFromLead(
      JdbcTemplate jdbcTemplate, Map<String, Object> lead, String contentHash) {
    jdbcTemplate.update(
        """
        INSERT INTO signal_event (
          enterprise_id, company_name, event_type, event_title, event_summary,
          event_time, source_type, source_name, source_url, confidence_score,
          status, related_external_lead_id, related_radar_lead_id,
          content_hash, raw_payload_json, create_time, update_time
        )
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          company_name = VALUES(company_name),
          event_type = VALUES(event_type),
          event_title = VALUES(event_title),
          event_summary = VALUES(event_summary),
          event_time = VALUES(event_time),
          source_type = VALUES(source_type),
          source_name = VALUES(source_name),
          source_url = VALUES(source_url),
          confidence_score = VALUES(confidence_score),
          related_external_lead_id = VALUES(related_external_lead_id),
          related_radar_lead_id = COALESCE(signal_event.related_radar_lead_id, VALUES(related_radar_lead_id)),
          is_deleted = 0,
          raw_payload_json = VALUES(raw_payload_json),
          update_time = NOW(3)
        """,
        lead.get("companyName"),
        inferSignalEventType(lead),
        lead.get("leadTitle"),
        lead.get("summary"),
        firstNonNull(lead.get("crawledAt"), lead.get("updateTime")),
        defaultString(stringObject(lead.get("sourceType")), "EXTERNAL_PUBLIC"),
        lead.get("sourceName"),
        lead.get("sourceUrl"),
        (int) longValue(lead.get("confidenceScore")),
        lead.get("convertedRadarLeadId") == null ? "NEW" : "CONVERTED",
        lead.get("leadId"),
        lead.get("convertedRadarLeadId"),
        contentHash,
        jsonString(
            Map.of(
                "externalLeadId", lead.get("leadId"),
                "hitKeywords", parseJsonArray(stringObject(lead.get("hitKeywords")), false),
                "pipeline", "Signal events are refreshed from company_lead and lead_evidence.")));
  }

  private List<Map<String, Object>> findLeadEvidenceSeeds(JdbcTemplate jdbcTemplate, Object leadId) {
    return jdbcTemplate.query(
        """
        SELECT
          evidence_type AS evidenceType,
          source_title AS sourceTitle,
          source_link AS sourceLink,
          raw_text AS rawText,
          matched_keywords AS matchedKeywords,
          matched_sentences AS matchedSentences,
          score_delta AS scoreDelta,
          published_at AS publishedAt,
          crawled_at AS crawledAt
        FROM lead_evidence
        WHERE lead_id = ? AND is_deleted = 0
        ORDER BY score_delta DESC, evidence_id ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("crawledAt", safeTimestamp(rs, "crawledAt"));
          map.put("evidenceType", defaultString(rs.getString("evidenceType")));
          map.put("matchedKeywords", rs.getString("matchedKeywords"));
          map.put("matchedSentences", rs.getString("matchedSentences"));
          map.put("publishedAt", safeTimestamp(rs, "publishedAt"));
          map.put("rawText", rs.getString("rawText"));
          map.put("scoreDelta", rs.getInt("scoreDelta"));
          map.put("sourceLink", defaultString(rs.getString("sourceLink")));
          map.put("sourceTitle", rs.getString("sourceTitle"));
          return map;
        },
        leadId);
  }

  private void upsertSignalEvidenceFromLeadEvidence(
      JdbcTemplate jdbcTemplate, long eventId, Map<String, Object> evidence, String evidenceHash) {
    jdbcTemplate.update(
        """
        INSERT INTO signal_evidence (
          event_id, evidence_type, source_title, source_link, raw_text,
          matched_keywords_json, matched_sentences_json, score_delta,
          content_hash, published_at, crawled_at, create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          is_deleted = 0,
          evidence_type = VALUES(evidence_type),
          source_title = VALUES(source_title),
          source_link = VALUES(source_link),
          raw_text = VALUES(raw_text),
          matched_keywords_json = VALUES(matched_keywords_json),
          matched_sentences_json = VALUES(matched_sentences_json),
          score_delta = VALUES(score_delta),
          published_at = VALUES(published_at),
          crawled_at = VALUES(crawled_at),
          update_time = NOW(3)
        """,
        eventId,
        evidence.get("evidenceType"),
        evidence.get("sourceTitle"),
        evidence.get("sourceLink"),
        evidence.get("rawText"),
        jsonString(parseJsonArray(stringObject(evidence.get("matchedKeywords")), false)),
        jsonString(parseJsonArray(stringObject(evidence.get("matchedSentences")), false)),
        (int) longValue(evidence.get("scoreDelta")),
        evidenceHash,
        evidence.get("publishedAt"),
        evidence.get("crawledAt"));
  }

  private Long findSignalEventIdByHash(JdbcTemplate jdbcTemplate, String contentHash) {
    List<Long> rows =
        jdbcTemplate.query(
            "SELECT event_id AS eventId FROM signal_event WHERE content_hash = ? LIMIT 1",
            (rs, rowNum) -> rs.getLong("eventId"),
            contentHash);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Long findSignalEvidenceIdByHash(
      JdbcTemplate jdbcTemplate, long eventId, String contentHash) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT evidence_id AS evidenceId
            FROM signal_evidence
            WHERE event_id = ? AND content_hash = ?
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("evidenceId"),
            eventId,
            contentHash);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private String signalEventHash(Map<String, Object> lead) {
    return sha256Hex(
        String.join(
            "|",
            defaultString(stringObject(lead.get("leadId"))),
            defaultString(stringObject(lead.get("companyName"))),
            defaultString(stringObject(lead.get("sourceUrl"))),
            defaultString(stringObject(lead.get("leadTitle")))));
  }

  private String signalEvidenceHash(Map<String, Object> evidence) {
    return sha256Hex(
        String.join(
            "|",
            defaultString(stringObject(evidence.get("sourceLink"))),
            defaultString(stringObject(evidence.get("evidenceType"))),
            defaultString(stringObject(evidence.get("rawText")))));
  }

  private String inferSignalEventType(Map<String, Object> lead) {
    String text =
        String.join(
                " ",
                defaultString(stringObject(lead.get("demandType"))),
                defaultString(stringObject(lead.get("leadTitle"))),
                jsonArrayText(lead.get("hitKeywords")))
            .toLowerCase(Locale.ROOT);
    if ("RELOCATION".equals(lead.get("demandType")) || text.matches(".*(搬迁|遷|relocation).*")) {
      return "RELOCATION";
    }
    if ("RENT_FACTORY".equals(lead.get("demandType")) || text.matches(".*(租厂|厂房|factory).*")) {
      return "FACTORY_RENT_DEMAND";
    }
    if (text.matches(".*(招聘|recruitment|hiring).*")) {
      return "RECRUITMENT_EXPAND";
    }
    if (text.matches(".*(环评|eia|公示|扩建|新增产线|expand).*")) {
      return "EIA_EXPAND";
    }
    if (text.matches(".*(公开机会|public).*")) {
      return "PUBLIC_FACTORY_DEMAND";
    }
    if (text.matches(".*(新闻|news).*")) {
      return "NEWS_EXPAND";
    }
    return "UNKNOWN";
  }

  private List<Map<String, Object>> findEnterpriseProfileRefreshRows(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(
        """
        SELECT
          se.event_id AS eventId,
          se.enterprise_id AS signalEnterpriseId,
          se.company_name AS companyName,
          se.event_type AS eventType,
          se.event_title AS eventTitle,
          se.event_summary AS eventSummary,
          se.event_time AS eventTime,
          se.source_name AS sourceName,
          se.confidence_score AS confidenceScore,
          se.related_radar_lead_id AS relatedRadarLeadId,
          cl.industry_name AS leadIndustryName,
          cl.region_province AS leadRegionProvince,
          cl.region_city AS leadRegionCity,
          cl.region_district AS leadRegionDistrict,
          cl.hit_keywords AS leadHitKeywords,
          ie.enterprise_id AS enterpriseId,
          ie.unified_social_credit_code AS unifiedSocialCreditCode,
          ie.industry_name AS enterpriseIndustryName,
          ie.city AS enterpriseCity,
          ie.address AS enterpriseAddress,
          ie.register_capital AS registeredCapital
        FROM signal_event se
        LEFT JOIN company_lead cl
          ON cl.lead_id = se.related_external_lead_id AND cl.is_deleted = 0
        LEFT JOIN investment_enterprise ie
          ON ie.enterprise_id = se.enterprise_id OR ie.enterprise_name = se.company_name
        WHERE se.is_deleted = 0
        ORDER BY se.company_name ASC, se.event_time DESC, se.event_id DESC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("companyName", defaultString(rs.getString("companyName")));
          map.put("confidenceScore", rs.getInt("confidenceScore"));
          map.put("enterpriseAddress", rs.getString("enterpriseAddress"));
          map.put("enterpriseCity", rs.getString("enterpriseCity"));
          map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
          map.put("enterpriseIndustryName", rs.getString("enterpriseIndustryName"));
          map.put("eventId", rs.getLong("eventId"));
          map.put("eventSummary", rs.getString("eventSummary"));
          map.put("eventTime", safeTimestamp(rs, "eventTime"));
          map.put("eventTitle", defaultString(rs.getString("eventTitle")));
          map.put("eventType", defaultString(rs.getString("eventType"), "UNKNOWN"));
          map.put("leadHitKeywords", rs.getString("leadHitKeywords"));
          map.put("leadIndustryName", rs.getString("leadIndustryName"));
          map.put("leadRegionCity", rs.getString("leadRegionCity"));
          map.put("leadRegionDistrict", rs.getString("leadRegionDistrict"));
          map.put("leadRegionProvince", rs.getString("leadRegionProvince"));
          map.put("registeredCapital", rs.getObject("registeredCapital"));
          map.put("signalEnterpriseId", nullableLong(rs, "signalEnterpriseId"));
          map.put("unifiedSocialCreditCode", rs.getString("unifiedSocialCreditCode"));
          return map;
        });
  }

  private Map<String, List<Map<String, Object>>> groupRowsByCompanyName(
      List<Map<String, Object>> rows) {
    Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      String companyName = cleanText(stringObject(row.get("companyName")));
      if (!StringUtils.hasText(companyName)) {
        continue;
      }
      List<Map<String, Object>> companyRows = grouped.computeIfAbsent(companyName, ignored -> new ArrayList<>());
      boolean exists =
          companyRows.stream()
              .anyMatch(item -> String.valueOf(item.get("eventId")).equals(String.valueOf(row.get("eventId"))));
      if (!exists) {
        companyRows.add(row);
      }
    }
    return grouped;
  }

  private EnterpriseProfileDerived deriveEnterpriseProfile(
      String companyName, List<Map<String, Object>> companyRows) {
    Map<String, Object> latest = companyRows.get(0);
    Set<String> eventTypes = eventTypes(companyRows);
    Set<String> keywordTags = keywordTags(companyRows);
    String text =
        companyRows.stream()
            .map(row -> String.join(
                " ",
                defaultString(stringObject(row.get("eventTitle"))),
                defaultString(stringObject(row.get("eventSummary"))),
                defaultString(stringObject(row.get("leadHitKeywords")))))
            .collect(Collectors.joining(" "));
    Object enterpriseId =
        firstNonEmptyObject(companyRows, "enterpriseId", "signalEnterpriseId");
    String industryName =
        cleanText(
            stringObject(
                firstNonNull(
                    firstNonEmptyObject(companyRows, "leadIndustryName", "enterpriseIndustryName"),
                    inferIndustryName(text))));
    List<String> industryTags = buildEnterpriseProfileTags(eventTypes, industryName, keywordTags);
    Object regionProvince = firstNonEmptyObject(companyRows, "leadRegionProvince");
    Object regionCity = firstNonEmptyObject(companyRows, "leadRegionCity", "enterpriseCity");
    Object regionDistrict = firstNonEmptyObject(companyRows, "leadRegionDistrict");
    Object address =
        firstNonNull(
            firstNonEmptyObject(companyRows, "enterpriseAddress"),
            cleanText(
                java.util.stream.Stream.of(regionProvince, regionCity, regionDistrict)
                    .map(this::stringObject)
                    .filter(StringUtils::hasText)
                    .collect(Collectors.joining(" "))));
    Object registeredCapital = firstNonEmptyObject(companyRows, "registeredCapital");
    Object unifiedSocialCreditCode = firstNonEmptyObject(companyRows, "unifiedSocialCreditCode");
    String latestIntentType = defaultString(stringObject(latest.get("eventType")), "UNKNOWN");
    return new EnterpriseProfileDerived(
        address,
        companyName,
        enterpriseId,
        industryName,
        industryTags,
        latest.get("eventTime"),
        latestIntentType,
        regionCity,
        regionDistrict,
        regionProvince,
        registeredCapital,
        companyRows.size(),
        unifiedSocialCreditCode);
  }

  private Long findEnterpriseProfileIdByCompanyName(JdbcTemplate jdbcTemplate, String companyName) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT profile_id AS profileId
            FROM enterprise_profile
            WHERE company_name = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("profileId"),
            companyName);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void upsertEnterpriseProfile(JdbcTemplate jdbcTemplate, EnterpriseProfileDerived profile) {
    jdbcTemplate.update(
        """
        INSERT INTO enterprise_profile (
          enterprise_id, company_name, unified_social_credit_code,
          industry_name, industry_tags_json, region_province, region_city,
          region_district, registered_capital, employee_scale, business_scope,
          address, last_signal_time, signal_count, latest_intent_type,
          profile_completeness, create_time, update_time, is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NOW(3), NOW(3), 0)
        ON DUPLICATE KEY UPDATE
          enterprise_id = VALUES(enterprise_id),
          unified_social_credit_code = VALUES(unified_social_credit_code),
          industry_name = VALUES(industry_name),
          industry_tags_json = VALUES(industry_tags_json),
          region_province = VALUES(region_province),
          region_city = VALUES(region_city),
          region_district = VALUES(region_district),
          registered_capital = VALUES(registered_capital),
          address = VALUES(address),
          last_signal_time = VALUES(last_signal_time),
          signal_count = VALUES(signal_count),
          latest_intent_type = VALUES(latest_intent_type),
          profile_completeness = VALUES(profile_completeness),
          is_deleted = 0,
          update_time = NOW(3)
        """,
        profile.enterpriseId(),
        profile.companyName(),
        profile.unifiedSocialCreditCode(),
        profile.industryName(),
        jsonString(profile.industryTags()),
        profile.regionProvince(),
        profile.regionCity(),
        profile.regionDistrict(),
        profile.registeredCapital(),
        profile.address(),
        profile.lastSignalTime(),
        profile.signalCount(),
        profile.latestIntentType(),
        calculateProfileCompleteness(profile));
  }

  private boolean upsertEnterpriseTag(
      JdbcTemplate jdbcTemplate,
      Object enterpriseId,
      String companyName,
      String tagName,
      String tagType,
      String tagSource,
      int confidenceScore) {
    boolean existed = findEnterpriseTagId(jdbcTemplate, companyName, tagType, tagName) != null;
    jdbcTemplate.update(
        """
        INSERT INTO enterprise_tag (
          enterprise_id, company_name, tag_type, tag_name, tag_source,
          confidence_score, create_time, update_time, is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), 0)
        ON DUPLICATE KEY UPDATE
          enterprise_id = VALUES(enterprise_id),
          tag_source = VALUES(tag_source),
          confidence_score = VALUES(confidence_score),
          is_deleted = 0,
          update_time = NOW(3)
        """,
        enterpriseId,
        companyName,
        tagType,
        tagName,
        tagSource,
        confidenceScore);
    return existed;
  }

  private Long findEnterpriseTagId(
      JdbcTemplate jdbcTemplate, String companyName, String tagType, String tagName) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT tag_id AS tagId
            FROM enterprise_tag
            WHERE company_name = ? AND tag_type = ? AND tag_name = ?
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("tagId"),
            companyName,
            tagType,
            tagName);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<Long> findRadarLeadIdsForScoreRecalculate(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(
        """
        SELECT DISTINCT l.lead_id AS leadId
        FROM investment_lead l
        LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
        WHERE l.is_deleted = 0
          AND (
            l.lead_source IN ('EXTERNAL_PUBLIC', 'SIGNAL_EVENT')
            OR EXISTS (
              SELECT 1
              FROM signal_event se
              WHERE se.is_deleted = 0
                AND (
                  se.related_radar_lead_id = l.lead_id
                  OR se.company_name = e.enterprise_name
                  OR se.enterprise_id = l.enterprise_id
                )
            )
          )
        ORDER BY l.lead_id ASC
        """,
        (rs, rowNum) -> rs.getLong("leadId"));
  }

  private String scoringEvidenceText(JdbcTemplate jdbcTemplate, long eventId) {
    if (!hasColumns(
        jdbcTemplate,
        "signal_evidence",
        "event_id",
        "raw_text",
        "matched_keywords_json",
        "matched_sentences_json",
        "is_deleted")) {
      return "";
    }
    return jdbcTemplate
        .query(
            """
            SELECT raw_text AS rawText,
                   matched_keywords_json AS matchedKeywordsJson,
                   matched_sentences_json AS matchedSentencesJson
            FROM signal_evidence
            WHERE event_id = ? AND is_deleted = 0
            """,
            (rs, rowNum) ->
                String.join(
                    " ",
                    defaultString(rs.getString("rawText")),
                    defaultString(rs.getString("matchedKeywordsJson")),
                    defaultString(rs.getString("matchedSentencesJson"))),
            eventId)
        .stream()
        .collect(Collectors.joining(" "));
  }

  private List<Map<String, Object>> findEnabledLeadScoreRuleSeeds(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(
        """
        SELECT
          rule_id AS ruleId,
          rule_code AS ruleCode,
          rule_name AS ruleName,
          event_type AS eventType,
          keyword_json AS keywordJson,
          score_delta AS scoreDelta
        FROM lead_score_rule
        WHERE enabled = 1
        ORDER BY rule_id ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("eventType", cleanText(rs.getString("eventType")));
          map.put("keywordJson", parseJsonArray(rs.getString("keywordJson"), false));
          map.put("ruleCode", defaultString(rs.getString("ruleCode")));
          map.put("ruleId", rs.getLong("ruleId"));
          map.put("ruleName", defaultString(rs.getString("ruleName")));
          map.put("scoreDelta", rs.getInt("scoreDelta"));
          return map;
        });
  }

  private List<Map<String, Object>> buildLeadScoreHits(
      List<Map<String, Object>> events, List<Map<String, Object>> rules) {
    List<Map<String, Object>> hits = new ArrayList<>();
    for (Map<String, Object> event : events) {
      for (Map<String, Object> rule : rules) {
        String ruleEventType = stringObject(rule.get("eventType"));
        if (StringUtils.hasText(ruleEventType)
            && ruleEventType.equals(stringObject(event.get("eventType")))) {
          hits.add(
              leadScoreHit(
                  event,
                  rule,
                  "事件类型 "
                      + event.get("eventType")
                      + " 命中："
                      + defaultString(stringObject(event.get("eventTitle")))));
          continue;
        }

        @SuppressWarnings("unchecked")
        List<Object> keywords = (List<Object>) rule.get("keywordJson");
        for (Object keyword : keywords) {
          String normalizedKeyword = defaultString(stringObject(keyword)).toLowerCase(Locale.ROOT);
          if (StringUtils.hasText(normalizedKeyword)
              && defaultString(stringObject(event.get("scoreText"))).contains(normalizedKeyword)) {
            hits.add(
                leadScoreHit(
                    event,
                    rule,
                    "关键词“"
                        + keyword
                        + "”命中："
                        + defaultString(stringObject(event.get("eventTitle")))));
            break;
          }
        }
      }
    }
    return hits;
  }

  private Map<String, Object> leadScoreHit(
      Map<String, Object> event, Map<String, Object> rule, String reason) {
    Map<String, Object> hit = new LinkedHashMap<>();
    hit.put("eventId", event.get("eventId"));
    hit.put("reason", trimToMax(reason, 500));
    hit.put("ruleCode", rule.get("ruleCode"));
    hit.put("ruleId", rule.get("ruleId"));
    hit.put("ruleName", rule.get("ruleName"));
    hit.put("scoreDelta", (int) longValue(rule.get("scoreDelta")));
    return hit;
  }

  private int clampScore(long value) {
    return (int) Math.max(0, Math.min(100, Math.round(value)));
  }

  private String resolvePriorityLevel(int score) {
    if (score >= 80) {
      return "A";
    }
    if (score >= 60) {
      return "B";
    }
    if (score >= 40) {
      return "C";
    }
    return "D";
  }

  private Set<String> eventTypes(List<Map<String, Object>> rows) {
    return rows.stream()
        .map(row -> defaultString(stringObject(row.get("eventType")), "UNKNOWN"))
        .filter(StringUtils::hasText)
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private Set<String> keywordTags(List<Map<String, Object>> rows) {
    Set<String> tags = new LinkedHashSet<>();
    for (Map<String, Object> row : rows) {
      tags.addAll(jsonArrayItems(row.get("leadHitKeywords")));
    }
    return tags;
  }

  private List<String> buildEnterpriseProfileTags(
      Set<String> eventTypes, String industryName, Set<String> keywordTags) {
    Set<String> tags = new LinkedHashSet<>();
    if (StringUtils.hasText(industryName)) {
      tags.add(industryName);
    }
    for (String eventType : eventTypes) {
      tags.add(eventTypeLabel(eventType));
    }
    tags.addAll(keywordTags);
    return tags.stream().filter(StringUtils::hasText).toList();
  }

  private String eventTypeLabel(String eventType) {
    return switch (defaultString(eventType)) {
      case "EIA_EXPAND" -> "扩产信号";
      case "FACTORY_RENT_DEMAND" -> "租厂需求";
      case "NEWS_EXPAND" -> "新闻扩张";
      case "PUBLIC_FACTORY_DEMAND" -> "公开厂房需求";
      case "RECRUITMENT_EXPAND" -> "招聘扩张";
      case "RELOCATION" -> "搬迁信号";
      case "UNKNOWN" -> "未知信号";
      default -> eventType;
    };
  }

  private String enterpriseProfileTagType(String tagName) {
    return Set.of("扩产信号", "租厂需求", "新闻扩张", "公开厂房需求", "招聘扩张", "搬迁信号", "未知信号")
        .contains(tagName)
        ? "INTENT"
        : "PROFILE";
  }

  private int maxConfidenceScore(List<Map<String, Object>> rows) {
    return rows.stream().map(row -> row.get("confidenceScore")).mapToInt(value -> (int) longValue(value)).max().orElse(0);
  }

  private int calculateProfileCompleteness(EnterpriseProfileDerived profile) {
    int completed = 0;
    completed += StringUtils.hasText(profile.companyName()) ? 1 : 0;
    completed += profile.unifiedSocialCreditCode() == null ? 0 : 1;
    completed += StringUtils.hasText(profile.industryName()) ? 1 : 0;
    completed += profile.industryTags().isEmpty() ? 0 : 1;
    completed += profile.regionCity() == null ? 0 : 1;
    completed += profile.address() == null ? 0 : 1;
    completed += profile.registeredCapital() == null ? 0 : 1;
    completed += profile.lastSignalTime() == null ? 0 : 1;
    completed += profile.signalCount() > 0 ? 1 : 0;
    completed += StringUtils.hasText(profile.latestIntentType()) ? 1 : 0;
    return (int) Math.round((completed / 10.0) * 100);
  }

  private Object firstNonEmptyObject(List<Map<String, Object>> rows, String... keys) {
    for (Map<String, Object> row : rows) {
      for (String key : keys) {
        Object value = row.get(key);
        if (value instanceof String text && !StringUtils.hasText(text)) {
          continue;
        }
        if (value != null) {
          return value;
        }
      }
    }
    return null;
  }

  private Object firstNonNull(Object... values) {
    for (Object value : values) {
      if (value instanceof String text && !StringUtils.hasText(text)) {
        continue;
      }
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  private long defaultLong(Long value) {
    return value == null ? 0 : value;
  }

  private String inferIndustryName(String text) {
    String value = defaultString(text);
    if (value.matches(".*(电子|半导体|芯片|电路|智能终端).*")) {
      return "电子信息";
    }
    if (value.matches(".*(汽车|零部件|新能源车).*")) {
      return "汽车及零部件";
    }
    if (value.matches(".*(医药|医疗|生物).*")) {
      return "生物医药";
    }
    if (value.matches(".*(仓储|物流|供应链).*")) {
      return "仓储物流";
    }
    if (value.matches(".*(机械|装备|制造|产线|扩建|厂房).*")) {
      return "先进制造";
    }
    return null;
  }

  private List<String> jsonArrayItems(Object value) {
    Object parsed = parseJsonArray(stringObject(value), false);
    if (!(parsed instanceof List<?> list)) {
      return List.of();
    }
    return list.stream()
        .map(this::stringObject)
        .filter(StringUtils::hasText)
        .toList();
  }

  private String jsonArrayText(Object value) {
    return String.join(" ", jsonArrayItems(value));
  }

  private void insertOutreachTemplateVersion(
      JdbcTemplate jdbcTemplate, long templateId, String changeType) {
    jdbcTemplate.update(
        """
        INSERT INTO investment_outreach_template_version
          (template_id, template_code, template_name, task_type, channel, priority_level,
           content, placeholder_json, approval_status, version_no, change_type, create_time)
        SELECT
          template_id, template_code, template_name, task_type, channel, priority_level,
          content, placeholder_json, approval_status, version_no, ?, NOW(3)
        FROM investment_outreach_template
        WHERE template_id = ?
        """,
        changeType,
        templateId);
  }

  private void ensureOutreachTemplateWritable(JdbcTemplate jdbcTemplate) {
    if (!hasOutreachTemplateColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达模板表结构未准备好");
    }
    if (!hasOutreachTemplateVersionColumns(jdbcTemplate)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "触达模板版本表结构未准备好");
    }
  }

  private TransactionTemplate radarTransactionTemplate(JdbcTemplate jdbcTemplate) {
    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Radar DataSource is not available");
    }
    return new TransactionTemplate(new DataSourceTransactionManager(dataSource));
  }

  private List<Map<String, Object>> selectOutreachTemplatesForLead(
      List<Map<String, Object>> templates, String priorityLevel) {
    String normalizedPriority = StringUtils.hasText(priorityLevel) ? priorityLevel.trim() : "C";
    return templates.stream()
        .filter(
            template -> {
              String templatePriority = stringObject(template.get("priorityLevel"));
              if ("A".equals(normalizedPriority)) {
                return "A".equals(templatePriority) || "B".equals(templatePriority);
              }
              return normalizedPriority.equals(templatePriority);
            })
        .toList();
  }

  private Map<String, Object> outreachSuggestionTemplateMap(
      Map<String, Object> template, Map<String, String> templateData) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("channel", template.get("channel"));
    map.put("priorityLevel", template.get("priorityLevel"));
    map.put(
        "suggestedContent",
        fillOutreachTemplateContent(stringObject(template.get("content")), templateData));
    map.put("taskType", template.get("taskType"));
    map.put("templateCode", template.get("templateCode"));
    map.put("templateId", template.get("templateId"));
    map.put("templateName", template.get("templateName"));
    return map;
  }

  private String fillOutreachTemplateContent(String content, Map<String, String> data) {
    String result = defaultString(content);
    for (Map.Entry<String, String> entry : data.entrySet()) {
      result = result.replace("{" + entry.getKey() + "}", defaultString(entry.getValue(), "-"));
    }
    return result;
  }

  private String formatIntentArea(Object value) {
    double numericValue = doubleValue(value);
    if (numericValue <= 0) {
      return "待确认面积";
    }
    return NumberFormat.getIntegerInstance(Locale.CHINA).format(Math.round(numericValue)) + "m²";
  }

  private String mapRestrictionReason(String restrictionType) {
    return switch (defaultString(restrictionType)) {
      case "BLACKLIST" -> "该联系人已加入触达限制";
      case "NEGATIVE_REPLY" -> "客户已明确表示暂无需求";
      case "UNSUBSCRIBED" -> "客户已退订或拒绝继续触达";
      default -> "当前联系人不建议触达";
    };
  }

  private String normalizeFollowResult(String value) {
    String result = defaultString(value, "CONTACTED").trim().toUpperCase(Locale.ROOT);
    return Set.of(
            "BLACKLIST",
            "CONTACTED",
            "INTENTED",
            "INVALID",
            "NEGATIVE",
            "NO_ANSWER",
            "POSITIVE",
            "REPLIED",
            "UNSUBSCRIBED")
        .contains(result)
        ? result
        : "CONTACTED";
  }

  private String normalizeFollowType(String value) {
    String type = defaultString(value, "PHONE").trim().toUpperCase(Locale.ROOT);
    return Set.of("PHONE", "VISIT", "WECHAT").contains(type) ? type : "PHONE";
  }

  private String normalizeContactPhone(String value) {
    return defaultString(value).trim().replaceAll("[\\s-]", "");
  }

  private List<Map<String, Object>> findRadarSourceStats(JdbcTemplate jdbcTemplate, int limit) {
    if (!hasCompanyLeadAnalyticsColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          COALESCE(NULLIF(source_name, ''), '未知来源') AS sourceName,
          COALESCE(NULLIF(source_type, ''), 'PUBLIC') AS sourceType,
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN confidence_level = 'HIGH' THEN 1 ELSE 0 END) AS highConfidenceLeads,
          SUM(CASE WHEN converted_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedLeads,
          SUM(COALESCE(evidence_count, 0)) AS evidenceCount
        FROM company_lead
        WHERE is_deleted = 0
        GROUP BY sourceType, sourceName
        ORDER BY convertedLeads DESC, totalLeads DESC
        LIMIT ?
        """,
        (rs, rowNum) -> radarSourceStatsMap(rs),
        limit);
  }

  private List<Map<String, Object>> findRadarSignalTypeStats(JdbcTemplate jdbcTemplate, int limit) {
    if (!hasSignalEventAnalyticsColumns(jdbcTemplate) || !hasLeadAnalyticsColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          se.event_type AS eventType,
          COUNT(*) AS totalEvents,
          SUM(CASE WHEN se.status = 'CONVERTED' OR se.related_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedEvents,
          COUNT(DISTINCT se.related_radar_lead_id) AS radarLeads,
          SUM(CASE WHEN l.latest_contact_time IS NOT NULL OR l.stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
          SUM(CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitLeads,
          SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads
        FROM signal_event se
        LEFT JOIN investment_lead l
          ON l.lead_id = se.related_radar_lead_id AND l.is_deleted = 0
        WHERE se.is_deleted = 0
        GROUP BY se.event_type
        ORDER BY totalEvents DESC
        LIMIT ?
        """,
        (rs, rowNum) -> radarSignalTypeStatsMap(rs),
        limit);
  }

  private List<Map<String, Object>> findRadarChannelStats(
      JdbcTemplate jdbcTemplate, boolean latest90DaysOnly, int limit) {
    if (!hasOutreachTaskAnalyticsColumns(jdbcTemplate)) {
      return List.of();
    }
    String whereSql = latest90DaysOnly ? "WHERE create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)" : "";
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COALESCE(NULLIF(channel, ''), '未知渠道') AS channel,
              COUNT(*) AS totalTasks,
              SUM(CASE WHEN status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
              SUM(CASE WHEN reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
              SUM(CASE WHEN reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies
            FROM investment_outreach_task
            """
                + whereSql
                + """

            GROUP BY channel
            ORDER BY totalTasks DESC
            LIMIT ?
            """,
            (rs, rowNum) -> radarChannelStatsMap(rs),
            limit);
    if (latest90DaysOnly) {
      rows.forEach(row -> row.put("sendRate", rate(row.get("sentTasks"), row.get("totalTasks"))));
    }
    return rows;
  }

  private List<Map<String, Object>> findRadarTemplateStats(
      JdbcTemplate jdbcTemplate, boolean latest90DaysOnly, int limit) {
    if (!hasOutreachTaskAnalyticsColumns(jdbcTemplate)) {
      return List.of();
    }
    String whereSql = latest90DaysOnly ? "WHERE create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)" : "";
    return jdbcTemplate.query(
        """
        SELECT
          COALESCE(NULLIF(template_code, ''), '未设置话术') AS templateCode,
          COALESCE(NULLIF(template_code, ''), '未设置话术') AS templateName,
          COUNT(*) AS totalTasks,
          SUM(CASE WHEN reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
          SUM(CASE WHEN reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies
        FROM investment_outreach_task
        """
            + whereSql
            + """

        GROUP BY templateCode, templateName
        ORDER BY totalTasks DESC
        LIMIT ?
        """,
        (rs, rowNum) -> radarTemplateStatsMap(rs),
        limit);
  }

  private List<Map<String, Object>> findRadarSalesStats(JdbcTemplate jdbcTemplate, int limit) {
    if (!hasLeadAnalyticsColumns(jdbcTemplate)) {
      return List.of();
    }
    boolean hasUser = hasColumns(jdbcTemplate, "user", "id", "real_name", "username");
    boolean hasFollowRecord = hasColumns(jdbcTemplate, "investment_follow_record", "lead_id");
    boolean hasVisitRecord = hasColumns(jdbcTemplate, "investment_visit_record", "lead_id");
    String userJoin = hasUser ? "LEFT JOIN user u ON u.id = l.owner_user_id" : "";
    String ownerNameSelect =
        hasUser
            ? "COALESCE(NULLIF(COALESCE(u.real_name, u.username), ''), '未分配') AS ownerName,"
            : "'未分配' AS ownerName,";
    String followJoin =
        hasFollowRecord
            ? """
              LEFT JOIN (
                SELECT lead_id, COUNT(*) AS followCount
                FROM investment_follow_record
                GROUP BY lead_id
              ) fr ON fr.lead_id = l.lead_id
              """
            : "";
    String followCountExpression = hasFollowRecord ? "SUM(COALESCE(fr.followCount, 0))" : "0";
    String visitJoin =
        hasVisitRecord
            ? """
              LEFT JOIN (
                SELECT lead_id, COUNT(*) AS visitCount
                FROM investment_visit_record
                GROUP BY lead_id
              ) vr ON vr.lead_id = l.lead_id
              """
            : "";
    String visitCountExpression = hasVisitRecord ? "SUM(COALESCE(vr.visitCount, 0))" : "0";

    return jdbcTemplate.query(
        """
        SELECT
          l.owner_user_id AS ownerUserId,
        """
            + ownerNameSelect
            + """
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.latest_contact_time IS NOT NULL OR l.stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
          """
            + visitCountExpression
            + """
           AS visitCount,
          SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads,
          """
            + followCountExpression
            + """
           AS followCount,
          AVG(
            CASE
              WHEN l.latest_contact_time IS NULL THEN NULL
              ELSE TIMESTAMPDIFF(HOUR, l.create_time, l.latest_contact_time)
            END
          ) AS firstContactAvgHours
        FROM investment_lead l
        """
            + userJoin
            + " "
            + followJoin
            + " "
            + visitJoin
            + """

        WHERE l.is_deleted = 0
        GROUP BY l.owner_user_id, ownerName
        ORDER BY totalLeads DESC
        LIMIT ?
        """,
        (rs, rowNum) -> radarSalesStatsMap(rs),
        limit);
  }

  private Map<String, Object> findRadarSopStats(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> ownerStats) {
    long pendingReminders = 0;
    long overdueReminders = 0;
    if (hasColumns(jdbcTemplate, "investment_sop_reminder", "reminder_status", "due_time")) {
      Map<String, Object> row =
          jdbcTemplate.queryForMap(
              """
              SELECT
                SUM(CASE WHEN reminder_status = 'PENDING' AND due_time >= NOW() THEN 1 ELSE 0 END) AS pendingReminders,
                SUM(CASE WHEN reminder_status = 'PENDING' AND due_time < NOW() THEN 1 ELSE 0 END) AS overdueReminders
              FROM investment_sop_reminder
              """);
      pendingReminders = longValue(row.get("pendingReminders"));
      overdueReminders = longValue(row.get("overdueReminders"));
    }

    Map<String, Object> map = new LinkedHashMap<>();
    map.put("followCount", sumLong(ownerStats, "followCount"));
    map.put("overdueReminders", overdueReminders);
    map.put("pendingReminders", pendingReminders);
    map.put("visitCount", sumLong(ownerStats, "visitCount"));
    return map;
  }

  private Map<String, Object> emptyRadarAnalysisSummary() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("channelStats", List.of());
    result.put("funnel", emptyRadarFunnel());
    result.put("generatedAt", Instant.now().toString());
    result.put("ownerStats", List.of());
    result.put("signalTypeStats", List.of());
    Map<String, Object> sopStats = new LinkedHashMap<>();
    sopStats.put("followCount", 0L);
    sopStats.put("overdueReminders", 0L);
    sopStats.put("pendingReminders", 0L);
    sopStats.put("visitCount", 0L);
    result.put("sopStats", sopStats);
    result.put("sourceStats", List.of());
    result.put(
        "suggestions",
        List.of(
            radarSuggestion(
                "补充线索池", "暂无有效招商线索，请先同步公开机会或导入线索。", "warning")));
    result.put("templateStats", List.of());
    return result;
  }

  private Map<String, Object> emptyRadarFunnel() {
    Map<String, Object> funnel = new LinkedHashMap<>();
    funnel.put("activeLeads", 0L);
    funnel.put("contactedLeads", 0L);
    funnel.put("contactRate", 0);
    funnel.put("dealLeads", 0L);
    funnel.put("dealRate", 0);
    funnel.put("highPriorityLeads", 0L);
    funnel.put("repliedLeads", 0L);
    funnel.put("replyRate", 0);
    funnel.put("totalLeads", 0L);
    funnel.put("visitLeads", 0L);
    funnel.put("visitRate", 0);
    return funnel;
  }

  private Map<String, Object> emptyRadarSalesFunnel() {
    Map<String, Object> funnel = new LinkedHashMap<>();
    funnel.put("assignedLeads", 0L);
    funnel.put("contactedLeads", 0L);
    funnel.put("contactRate", 0);
    funnel.put("dealLeads", 0L);
    funnel.put("dealRate", 0);
    funnel.put("newLeads", 0L);
    funnel.put("repliedLeads", 0L);
    funnel.put("replyRate", 0);
    funnel.put("visitLeads", 0L);
    funnel.put("visitRate", 0);
    return funnel;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> buildRadarSuggestions(Map<String, Object> summary) {
    Map<String, Object> funnel = (Map<String, Object>) summary.getOrDefault("funnel", emptyRadarFunnel());
    List<Map<String, Object>> ownerStats =
        (List<Map<String, Object>>) summary.getOrDefault("ownerStats", List.of());
    List<Map<String, Object>> sourceStats =
        (List<Map<String, Object>>) summary.getOrDefault("sourceStats", List.of());

    List<Map<String, Object>> suggestions = new ArrayList<>();
    if (longValue(funnel.get("totalLeads")) == 0) {
      suggestions.add(radarSuggestion("补充线索池", "暂无有效招商线索，请先同步公开机会或导入线索。", "warning"));
      return suggestions;
    }
    if (doubleValue(funnel.get("contactRate")) < 50) {
      suggestions.add(radarSuggestion("提升触达", "触达率偏低，建议优先处理 A 级与高分线索。", "warning"));
    }
    if (longValue(funnel.get("dealLeads")) > 0 && doubleValue(funnel.get("dealRate")) >= 30) {
      suggestions.add(radarSuggestion("复用高效策略", "成交转化表现较好，可复用当前跟进节奏和渠道组合。", "success"));
    }

    sourceStats.stream()
        .filter(item -> doubleValue(item.get("conversionRate")) > 0)
        .max((left, right) -> Double.compare(doubleValue(left.get("conversionRate")), doubleValue(right.get("conversionRate"))))
        .ifPresent(
            bestSource ->
                suggestions.add(
                    radarSuggestion(
                        "强化优质来源",
                        defaultString(String.valueOf(bestSource.get("sourceName")), "未知来源")
                            + " 转雷达效果较好，建议提高该来源的采集频次。",
                        "success")));

    ownerStats.stream()
        .filter(item -> doubleValue(item.get("contactRate")) < 50)
        .min((left, right) -> Double.compare(doubleValue(left.get("contactRate")), doubleValue(right.get("contactRate"))))
        .ifPresent(
            slowOwner ->
                suggestions.add(
                    radarSuggestion(
                        "跟进提醒",
                        defaultString(String.valueOf(slowOwner.get("ownerName")), "未分配")
                            + " 名下线索触达率偏低，建议补齐首联动作。",
                        "danger")));
    return suggestions.stream().limit(4).toList();
  }

  private Map<String, Object> radarSuggestion(String title, String content, String level) {
    Map<String, Object> suggestion = new LinkedHashMap<>();
    suggestion.put("content", content);
    suggestion.put("level", level);
    suggestion.put("title", title);
    return suggestion;
  }

  private Map<String, Object> findRadarLeadCollectTask(JdbcTemplate jdbcTemplate, Object latestTaskId) {
    if (!StringUtils.hasText(String.valueOf(latestTaskId))
        || !hasColumns(
            jdbcTemplate,
            "investment_radar_collect_task",
            "task_id",
            "status",
            "created",
            "updated",
            "skipped",
            "total",
            "duration_ms",
            "error_reason",
            "started_at",
            "completed_at")) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              task_id AS taskId,
              status,
              created,
              updated,
              skipped,
              total,
              duration_ms AS durationMs,
              error_reason AS errorReason,
              started_at AS startedAt,
              completed_at AS completedAt
            FROM investment_radar_collect_task
            WHERE task_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> radarCollectTaskMap(rs),
            String.valueOf(latestTaskId));
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<Map<String, Object>> findRadarLeadOutreachTasks(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasOutreachTaskColumns(jdbcTemplate)) {
      return List.of();
    }
    String userJoin = hasColumns(jdbcTemplate, "user", "id", "real_name", "username")
        ? "LEFT JOIN user u ON u.id = t.sent_by"
        : "";
    String sentByNameSelect =
        userJoin.isBlank() ? "NULL AS sentByName" : "COALESCE(u.real_name, u.username) AS sentByName";
    return jdbcTemplate.query(
        """
        SELECT
          t.task_id AS taskId,
          t.task_type AS taskType,
          t.channel,
          t.phone_number AS phoneNumber,
          t.status,
          t.template_code AS templateCode,
          t.scheduled_at AS scheduledAt,
          t.sent_at AS sentAt,
        """
            + sentByNameSelect
            + """
          ,
          t.result_code AS resultCode,
          t.result_message AS resultMessage,
          t.reply_status AS replyStatus,
          t.reply_content AS replyContent,
          t.reply_time AS replyTime,
          t.create_time AS createTime,
          t.update_time AS updateTime
        FROM investment_outreach_task t
        """
            + userJoin
            + """

        WHERE t.lead_id = ?
        ORDER BY t.create_time DESC, t.task_id DESC
        LIMIT 20
        """,
        (rs, rowNum) -> radarLeadOutreachTaskMap(rs),
        leadId);
  }

  private Map<String, Object> findRadarLeadNavigation(
      JdbcTemplate jdbcTemplate, long leadId, Object updateTime) {
    Map<String, Object> navigation = new LinkedHashMap<>();
    if (updateTime == null || !hasRadarLeadListColumns(jdbcTemplate)) {
      navigation.put("nextLead", null);
      navigation.put("previousLead", null);
      return navigation;
    }
    navigation.put(
        "nextLead",
        findRadarLeadNavigationItem(
            jdbcTemplate,
            """
            l.is_deleted = 0
              AND (l.update_time < ? OR (l.update_time = ? AND l.lead_id < ?))
            ORDER BY l.update_time DESC, l.lead_id DESC
            """,
            updateTime,
            leadId));
    navigation.put(
        "previousLead",
        findRadarLeadNavigationItem(
            jdbcTemplate,
            """
            l.is_deleted = 0
              AND (l.update_time > ? OR (l.update_time = ? AND l.lead_id > ?))
            ORDER BY l.update_time ASC, l.lead_id ASC
            """,
            updateTime,
            leadId));
    return navigation;
  }

  private Map<String, Object> findRadarLeadNavigationItem(
      JdbcTemplate jdbcTemplate, String conditionAndOrderSql, Object updateTime, long leadId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              e.enterprise_name AS enterpriseName,
              l.total_score AS totalScore,
              l.stage
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            WHERE
            """
                + conditionAndOrderSql
                + """

            LIMIT 1
            """,
            (rs, rowNum) -> radarLeadNavigationMap(rs),
            updateTime,
            updateTime,
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private String radarSopReminderFromSql() {
    return """
        FROM investment_sop_reminder r
        INNER JOIN investment_lead l ON l.lead_id = r.lead_id
        LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
        LEFT JOIN park p ON p.park_id = l.park_id
        LEFT JOIN user owner ON owner.id = l.owner_user_id
        """;
  }

  private Map<String, Object> findRadarSopReminderSummary(
      JdbcTemplate jdbcTemplate, String fromSql, String whereSql, List<Object> args) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COUNT(*) AS totalReminders,
              SUM(CASE WHEN r.reminder_status = 'PENDING' AND r.due_time >= NOW(3) THEN 1 ELSE 0 END) AS pendingReminders,
              SUM(CASE WHEN r.reminder_status = 'OVERDUE' OR (r.reminder_status = 'PENDING' AND r.due_time < NOW(3)) THEN 1 ELSE 0 END) AS overdueReminders,
              SUM(CASE WHEN r.reminder_type = 'NEW_LEAD' THEN 1 ELSE 0 END) AS newLeadReminders,
              SUM(CASE WHEN r.reminder_type = 'NEED_VISIT' THEN 1 ELSE 0 END) AS needVisitReminders,
              SUM(CASE WHEN r.reminder_type = 'VISIT_FEEDBACK' THEN 1 ELSE 0 END) AS visitFeedbackReminders,
              SUM(CASE WHEN r.reminder_type = 'WEEKLY_FOLLOW_UP' THEN 1 ELSE 0 END) AS weeklyFollowUpReminders
            """
                + fromSql
                + " "
                + whereSql,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("needVisitReminders", rs.getLong("needVisitReminders"));
              map.put("newLeadReminders", rs.getLong("newLeadReminders"));
              map.put("overdueReminders", rs.getLong("overdueReminders"));
              map.put("pendingReminders", rs.getLong("pendingReminders"));
              map.put("totalReminders", rs.getLong("totalReminders"));
              map.put("visitFeedbackReminders", rs.getLong("visitFeedbackReminders"));
              map.put("weeklyFollowUpReminders", rs.getLong("weeklyFollowUpReminders"));
              return map;
            },
            args.toArray());
    return rows.isEmpty() ? emptyRadarSopReminderSummary() : rows.get(0);
  }

  private Map<String, Object> emptyRadarSopReminderSummary() {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("needVisitReminders", 0L);
    map.put("newLeadReminders", 0L);
    map.put("overdueReminders", 0L);
    map.put("pendingReminders", 0L);
    map.put("totalReminders", 0L);
    map.put("visitFeedbackReminders", 0L);
    map.put("weeklyFollowUpReminders", 0L);
    return map;
  }

  private Map<String, Object> findRadarLeadSopSeed(JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(
        jdbcTemplate,
        "investment_lead",
        "lead_id",
        "stage",
        "create_time",
        "latest_contact_time",
        "is_deleted")) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              lead_id AS leadId,
              stage,
              create_time AS createTime,
              latest_contact_time AS latestContactTime
            FROM investment_lead
            WHERE lead_id = ? AND is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
              map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
              map.put("leadId", rs.getLong("leadId"));
              map.put("stage", defaultString(rs.getString("stage")));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<Map<String, Object>> findRadarLeadAssignmentRecords(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(
        jdbcTemplate,
        "investment_lead_assignment_log",
        "assignment_id",
        "lead_id",
        "owner_name",
        "assignment_source",
        "assign_reason",
        "create_time")) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          owner_name AS ownerName,
          assignment_source AS assignmentSource,
          assign_reason AS assignReason,
          create_time AS createTime
        FROM investment_lead_assignment_log
        WHERE lead_id = ?
        ORDER BY create_time DESC, assignment_id DESC
        LIMIT 20
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("assignReason", rs.getString("assignReason"));
          map.put("assignmentSource", defaultString(rs.getString("assignmentSource")));
          map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
          map.put("ownerName", rs.getString("ownerName"));
          return map;
        },
        leadId);
  }

  private List<Map<String, Object>> findRadarLeadFollowRecords(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(
        jdbcTemplate,
        "investment_follow_record",
        "record_id",
        "lead_id",
        "follow_type",
        "follow_result",
        "content",
        "next_action",
        "next_follow_time",
        "operator_user_id",
        "create_time")) {
      return List.of();
    }
    String userJoin = hasColumns(jdbcTemplate, "user", "id", "real_name", "username")
        ? "LEFT JOIN user u ON u.id = r.operator_user_id"
        : "";
    String operatorSelect =
        userJoin.isBlank() ? "NULL AS operatorName" : "COALESCE(u.real_name, u.username) AS operatorName";
    return jdbcTemplate.query(
        """
        SELECT
          r.record_id AS recordId,
          r.follow_type AS followType,
          r.follow_result AS followResult,
          r.content,
          r.next_action AS nextAction,
          r.next_follow_time AS nextFollowTime,
        """
            + operatorSelect
            + """
          ,
          r.create_time AS createTime
        FROM investment_follow_record r
        """
            + userJoin
            + """

        WHERE r.lead_id = ?
        ORDER BY r.create_time DESC, r.record_id DESC
        LIMIT 20
        """,
        (rs, rowNum) -> radarFollowRecordMap(rs),
        leadId);
  }

  private List<Map<String, Object>> findRadarLeadVisitRecords(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasColumns(
        jdbcTemplate,
        "investment_visit_record",
        "visit_id",
        "lead_id",
        "factory_floor_id",
        "scheduled_time",
        "actual_time",
        "visitor_name",
        "visitor_phone",
        "visit_status",
        "feedback",
        "operator_user_id",
        "create_time")) {
      return List.of();
    }
    String userJoin = hasColumns(jdbcTemplate, "user", "id", "real_name", "username")
        ? "LEFT JOIN user u ON u.id = v.operator_user_id"
        : "";
    String operatorSelect =
        userJoin.isBlank() ? "NULL AS operatorName" : "COALESCE(u.real_name, u.username) AS operatorName";
    return jdbcTemplate.query(
        """
        SELECT
          v.visit_id AS visitId,
          v.factory_floor_id AS factoryFloorId,
          v.scheduled_time AS scheduledTime,
          v.actual_time AS actualTime,
          v.visitor_name AS visitorName,
          v.visitor_phone AS visitorPhone,
          v.visit_status AS visitStatus,
          v.feedback,
        """
            + operatorSelect
            + """
          ,
          v.create_time AS createTime
        FROM investment_visit_record v
        """
            + userJoin
            + """

        WHERE v.lead_id = ?
        ORDER BY v.scheduled_time DESC, v.visit_id DESC
        LIMIT 20
        """,
        (rs, rowNum) -> radarVisitRecordMap(rs),
        leadId);
  }

  private List<Map<String, Object>> findRadarLeadStoredReminders(
      JdbcTemplate jdbcTemplate, long leadId) {
    if (!hasRadarSopReminderColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          reminder_id AS reminderId,
          reminder_type AS reminderType,
          title,
          description,
          due_time AS dueTime,
          reminder_status AS reminderStatus,
          handled_time AS handledTime,
          create_time AS createTime,
          update_time AS updateTime
        FROM investment_sop_reminder
        WHERE lead_id = ? AND reminder_status IN ('PENDING', 'OVERDUE')
        ORDER BY
          CASE WHEN reminder_status = 'PENDING' THEN 0 ELSE 1 END,
          due_time ASC,
          reminder_id DESC
        LIMIT 20
        """,
        (rs, rowNum) -> radarSopReminderBaseMap(rs),
        leadId);
  }

  private List<Map<String, Object>> generateRadarSopReminders(
      Map<String, Object> lead,
      List<Map<String, Object>> followRecords,
      List<Map<String, Object>> visitRecords) {
    String stage = defaultString(String.valueOf(lead.get("stage")));
    if (Set.of("CLOSED", "DEAL", "INVALID").contains(stage)) {
      return List.of();
    }
    Instant now = Instant.now();
    Instant createTime = instantValue(lead.get("createTime"), now);
    Instant latestContactTime = instantValue(lead.get("latestContactTime"), null);
    boolean hasFollowRecord = !followRecords.isEmpty();
    boolean hasVisitRecord = !visitRecords.isEmpty();
    Map<String, Object> lastVisitRecord = hasVisitRecord ? visitRecords.get(0) : null;
    boolean hasVisitFeedback =
        lastVisitRecord != null && StringUtils.hasText(String.valueOf(lastVisitRecord.get("feedback")));
    List<Map<String, Object>> reminders = new ArrayList<>();

    if (latestContactTime == null && !hasFollowRecord) {
      Instant dueTime = createTime.plusSeconds(24 * 60 * 60);
      reminders.add(
          generatedRadarReminder(
              "NEW_LEAD",
              "新线索待联系",
              "新线索创建后24小时内未进行任何联系，请及时跟进",
              createTime,
              dueTime,
              now));
    }

    boolean hasPositiveFollow =
        followRecords.stream()
            .anyMatch(
                record ->
                    Set.of("POSITIVE", "INTENTED")
                        .contains(defaultString(String.valueOf(record.get("followResult")))));
    if ("REPLIED".equals(stage) || hasPositiveFollow) {
      Instant positiveTime =
          followRecords.stream()
              .filter(
                  record ->
                      Set.of("POSITIVE", "INTENTED")
                          .contains(defaultString(String.valueOf(record.get("followResult")))))
              .map(record -> instantValue(record.get("createTime"), null))
              .filter(value -> value != null)
              .findFirst()
              .orElse(now.minusSeconds(48 * 60 * 60));
      Instant dueTime = positiveTime.plusSeconds(48 * 60 * 60);
      if (!hasVisitRecord) {
        reminders.add(
            generatedRadarReminder(
                "NEED_VISIT",
                "待安排带看",
                "客户已正向回复，请在48小时内安排带看",
                positiveTime,
                dueTime,
                now));
      }
    }

    if (lastVisitRecord != null && !hasVisitFeedback) {
      Instant visitTime =
          firstInstant(lastVisitRecord.get("actualTime"), lastVisitRecord.get("scheduledTime"));
      if (visitTime != null) {
        reminders.add(
            generatedRadarReminder(
                "VISIT_FEEDBACK",
                "待记录带看反馈",
                "带看已完成，请及时记录客户反馈",
                visitTime,
                visitTime.plusSeconds(24 * 60 * 60),
                now));
      }
    }

    if ("VISIT".equals(stage) && lastVisitRecord != null && hasVisitFeedback) {
      Instant latestFollowTime =
          followRecords.stream()
              .map(record -> instantValue(record.get("createTime"), null))
              .filter(value -> value != null)
              .findFirst()
              .orElse(null);
      Instant latestVisitTime =
          firstInstant(
              lastVisitRecord.get("actualTime"),
              lastVisitRecord.get("scheduledTime"),
              lastVisitRecord.get("createTime"));
      Instant latestActivity = latestInstant(latestFollowTime, latestVisitTime, latestContactTime);
      if (latestActivity != null) {
        reminders.add(
            generatedRadarReminder(
                "WEEKLY_FOLLOW_UP",
                "持续跟进提醒",
                "客户已进入带看后推进阶段，请每周至少跟进一次并记录结果",
                latestActivity,
                latestActivity.plusSeconds(7 * 24 * 60 * 60),
                now));
      }
    }
    return reminders.stream()
        .sorted((left, right) -> String.valueOf(left.get("dueTime")).compareTo(String.valueOf(right.get("dueTime"))))
        .toList();
  }

  private Map<String, Object> generatedRadarReminder(
      String reminderType, String title, String description, Instant createTime, Instant dueTime, Instant now) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", createTime.toString());
    map.put("description", description);
    map.put("dueTime", dueTime.toString());
    map.put("handledTime", null);
    map.put("reminderId", 0L);
    map.put("reminderStatus", now.isAfter(dueTime) ? "OVERDUE" : "PENDING");
    map.put("reminderType", reminderType);
    map.put("title", title);
    return map;
  }

  private String buildPublicOpportunityWhere(
      PublicOpportunityQuery query, String scope, List<Object> args) {
    List<String> conditions = new ArrayList<>();
    String normalizedScope = StringUtils.hasText(scope) ? scope : "strict";
    if ("raw".equals(normalizedScope) && isKnownPublicOpportunityType(query.opportunityType())) {
      conditions.add("opo.opportunity_type = ?");
      args.add(query.opportunityType());
    } else if ("collected".equals(normalizedScope) || "raw".equals(normalizedScope)) {
      conditions.add("opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')");
      conditions.add("opo.source_url IS NOT NULL");
      conditions.add("TRIM(opo.source_url) <> ''");
      conditions.add("opo.published_at IS NOT NULL");
      conditions.add("opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)");
      appendKnownOpportunityTypeFilter(query, conditions, args);
      appendRetiredPublicOpportunityFilters(conditions, args);
    } else if ("reviewable".equals(normalizedScope)) {
      conditions.add("opo.source_url IS NOT NULL");
      conditions.add("TRIM(opo.source_url) <> ''");
      conditions.add("LOWER(TRIM(opo.source_url)) REGEXP ?");
      args.add(TRACEABLE_SOURCE_URL_PATTERN);
      conditions.add("opo.opportunity_status NOT IN ('OUT_OF_SCOPE', 'RAW')");
      conditions.add(
          "CONCAT_WS(' ', opo.city, opo.district, opo.title, opo.source_site, opo.source_url) REGEXP ?");
      args.add(guangdongRegionPattern());
      conditions.add(
          "CONCAT_WS(' ', opo.city, opo.district, opo.title, opo.source_site, opo.source_url) NOT REGEXP ?");
      args.add(nonGuangdongRegionPattern());
      appendRetiredPublicOpportunityFilters(conditions, args);
    } else {
      conditions.add("opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')");
      conditions.add("LOWER(TRIM(opo.source_url)) REGEXP ?");
      args.add(TRACEABLE_SOURCE_URL_PATTERN);
      conditions.add("opo.city IS NOT NULL");
      conditions.add("TRIM(opo.city) <> ''");
      conditions.add("opo.published_at IS NOT NULL");
      conditions.add("opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)");
      conditions.add("opo.published_at <= DATE_ADD(NOW(3), INTERVAL ? DAY)");
      args.add(FUTURE_PUBLISHED_TOLERANCE_DAYS);
      conditions.add("opo.published_at >= ?");
      args.add(EARLIEST_REASONABLE_PUBLISHED_AT);
      conditions.add("COALESCE(opo.is_guangdong, 0) = 1");
      conditions.add("COALESCE(opo.has_detail_evidence, 0) = 1");
      conditions.add(
          "(opo.opportunity_type <> 'SUPPLY' OR (opo.district IS NOT NULL AND TRIM(opo.district) <> ''))");
      conditions.add(reliablePublicOpportunitySupplySql());
      appendKnownOpportunityTypeFilter(query, conditions, args);
      appendRetiredPublicOpportunityFilters(conditions, args);
    }

    appendPublicOpportunityFilters(query, conditions, args);
    return conditions.isEmpty() ? "1 = 1" : String.join(" AND ", conditions);
  }

  private void appendPublicOpportunityFilters(
      PublicOpportunityQuery query, List<String> conditions, List<Object> args) {
    appendLike(conditions, args, "opo.city LIKE ?", query.city());
    appendEquals(conditions, args, "opo.source_site = ?", query.sourceSite());
    if (StringUtils.hasText(query.publishedAgeLabel())) {
      if (query.publishedAgeValue() != null) {
        if (query.publishedAgeLabel().toLowerCase(Locale.ROOT).contains("hour")
            || query.publishedAgeLabel().contains("小时")) {
          conditions.add(
              """
              opo.published_at IS NOT NULL
                AND opo.published_at <= DATE_SUB(NOW(3), INTERVAL ? HOUR)
                AND opo.published_at > DATE_SUB(NOW(3), INTERVAL ? HOUR)
              """);
        } else {
          conditions.add(
              """
              opo.published_at IS NOT NULL
                AND opo.published_at <= DATE_SUB(NOW(3), INTERVAL ? DAY)
                AND opo.published_at > DATE_SUB(NOW(3), INTERVAL ? DAY)
              """);
        }
        args.add(query.publishedAgeValue());
        args.add(query.publishedAgeValue() + 1);
      } else {
        conditions.add(publicOpportunityPublishedAgeSql("opo.") + " = ?");
        args.add(query.publishedAgeLabel());
      }
    }
    if (StringUtils.hasText(query.opportunityType()) && !containsOpportunityTypeCondition(conditions)) {
      conditions.add("opo.opportunity_type = ?");
      args.add(query.opportunityType());
    }
    if (StringUtils.hasText(query.keyword())) {
      conditions.add(
          "(opo.title LIKE ? OR opo.contact_name LIKE ? OR opo.phone_number LIKE ? OR opo.source_url LIKE ?)");
      String likeKeyword = like(query.keyword());
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
      args.add(likeKeyword);
    }
  }

  private void appendKnownOpportunityTypeFilter(
      PublicOpportunityQuery query, List<String> conditions, List<Object> args) {
    if (!isKnownPublicOpportunityType(query.opportunityType())) {
      return;
    }
    conditions.add("opo.opportunity_type = ?");
    args.add(query.opportunityType());
  }

  private boolean containsOpportunityTypeCondition(List<String> conditions) {
    return conditions.stream().anyMatch(condition -> condition.contains("opo.opportunity_type = ?"));
  }

  private boolean isKnownPublicOpportunityType(String value) {
    return "DEMAND".equals(value) || "SUPPLY".equals(value);
  }

  private String normalizePublicOpportunityType(String value) {
    String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    return isKnownPublicOpportunityType(normalized) ? normalized : "";
  }

  private void appendRetiredPublicOpportunityFilters(List<String> conditions, List<Object> args) {
    conditions.add(
        "(opo.source_code IS NULL OR opo.source_code = '' OR opo.source_code NOT IN ("
            + placeholders(RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.size())
            + "))");
    args.addAll(RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES);
    conditions.add(
        "(opo.source_site IS NULL OR opo.source_site = '' OR opo.source_site NOT IN ("
            + placeholders(RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES.size())
            + "))");
    args.addAll(RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES);
  }

  private List<String> publicOpportunityProgressSourceCodes(String opportunityType) {
    if ("DEMAND".equals(opportunityType)) {
      return PUBLIC_OPPORTUNITY_DEMAND_SOURCE_CODES;
    }
    if ("SUPPLY".equals(opportunityType)) {
      return PUBLIC_OPPORTUNITY_SUPPLY_SOURCE_CODES;
    }
    List<String> sourceCodes = new ArrayList<>(PUBLIC_OPPORTUNITY_DEMAND_SOURCE_CODES);
    sourceCodes.addAll(PUBLIC_OPPORTUNITY_SUPPLY_SOURCE_CODES);
    return sourceCodes;
  }

  private Map<String, Map<String, Object>> publicOpportunityLatestTaskBySource(
      JdbcTemplate jdbcTemplate, List<String> sourceCodes) {
    if (!hasColumns(
        jdbcTemplate,
        "crawler_task",
        "task_id",
        "source_id",
        "status",
        "started_at",
        "finished_at",
        "fetched_count",
        "created_lead_count",
        "updated_lead_count",
        "skipped_count",
        "error_message",
        "create_time")
        || !hasColumns(jdbcTemplate, "crawler_source", "source_id", "source_code")) {
      return Map.of();
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT *
            FROM (
              SELECT
                s.source_code AS sourceCode,
                t.task_id AS taskId,
                t.status,
                t.started_at AS startedAt,
                t.finished_at AS finishedAt,
                t.fetched_count AS fetchedCount,
                t.created_lead_count AS createdLeadCount,
                t.updated_lead_count AS updatedLeadCount,
                t.skipped_count AS skippedCount,
                t.error_message AS errorMessage,
                ROW_NUMBER() OVER (
                  PARTITION BY t.source_id
                  ORDER BY t.create_time DESC, t.task_id DESC
                ) AS taskRank
              FROM crawler_task t
              INNER JOIN crawler_source s ON s.source_id = t.source_id
              WHERE s.source_code IN (
            """
                + placeholders(sourceCodes.size())
                + """
              )
            ) latest_task
            WHERE taskRank = 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("sourceCode", rs.getString("sourceCode"));
              map.put("createdLeadCount", rs.getInt("createdLeadCount"));
              map.put("errorMessage", rs.getString("errorMessage"));
              map.put("fetchedCount", rs.getInt("fetchedCount"));
              map.put("finishedAt", toIso(safeTimestamp(rs, "finishedAt")));
              map.put("skippedCount", rs.getInt("skippedCount"));
              map.put("startedAt", toIso(safeTimestamp(rs, "startedAt")));
              map.put("status", defaultString(rs.getString("status")));
              map.put("taskId", rs.getLong("taskId"));
              map.put("updatedLeadCount", rs.getInt("updatedLeadCount"));
              return map;
            },
            sourceCodes.toArray());
    Map<String, Map<String, Object>> result = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      String sourceCode = String.valueOf(row.remove("sourceCode"));
      result.put(sourceCode, row);
    }
    return result;
  }

  private Map<String, Map<String, Integer>> publicOpportunityItemStatusBySource(
      JdbcTemplate jdbcTemplate, List<String> sourceCodes) {
    if (!hasColumns(jdbcTemplate, "crawler_task_item", "source_id", "status")
        || !hasColumns(jdbcTemplate, "crawler_source", "source_id", "source_code")) {
      return Map.of();
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              s.source_code AS sourceCode,
              i.status,
              COUNT(*) AS count
            FROM crawler_task_item i
            INNER JOIN crawler_source s ON s.source_id = i.source_id
            WHERE s.source_code IN (
            """
                + placeholders(sourceCodes.size())
                + """
            )
            GROUP BY s.source_code, i.status
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("count", rs.getInt("count"));
              map.put("sourceCode", rs.getString("sourceCode"));
              map.put("status", defaultString(rs.getString("status"), "UNKNOWN"));
              return map;
            },
            sourceCodes.toArray());
    Map<String, Map<String, Integer>> result = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      String sourceCode = String.valueOf(row.get("sourceCode"));
      String status = String.valueOf(row.get("status"));
      int count = ((Number) row.get("count")).intValue();
      result.computeIfAbsent(sourceCode, ignored -> new LinkedHashMap<>()).put(status, count);
    }
    return result;
  }

  private Map<String, Object> emptyPublicOpportunityList(PublicOpportunityQuery query) {
    return publicOpportunityPageResult(List.of(), query, 0L, true);
  }

  private Map<String, Object> publicOpportunityPageResult(
      List<Map<String, Object>> items, PublicOpportunityQuery query, Long total, boolean totalKnown) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    Map<String, Object> page = new LinkedHashMap<>();
    page.put("currentPage", query.currentPage());
    page.put("pageSize", query.pageSize());
    if (total != null) {
      page.put("total", total);
      result.put("total", total);
    }
    result.put("page", page);
    result.put("scope", query.scope());
    if (!totalKnown) {
      result.put("totalKnown", false);
    }
    return result;
  }

  private Map<String, Object> publicOpportunityFiltersResult(
      List<String> sourceSites, List<String> publishedAgeLabels, String scope) {
    Map<String, Object> filters = new LinkedHashMap<>();
    filters.put("publishedAgeLabels", publishedAgeLabels);
    filters.put("sourceSites", sourceSites);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("filters", filters);
    result.put("scope", scope);
    return result;
  }

  private Map<String, Object> publicOpportunityStatsResult(String scope, long total, long strictTotal) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("scope", scope);
    result.put("strictTotal", strictTotal);
    result.put("total", total);
    return result;
  }

  private Map<String, Object> publicOpportunityProgressResult(
      String opportunityType, List<Map<String, Object>> sources) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("note", "crawler_progress_only_not_effective_counts");
    result.put("opportunityType", StringUtils.hasText(opportunityType) ? opportunityType : null);
    result.put("sourceCount", sources.size());
    result.put("sources", sources);
    return result;
  }

  private ParsedDemandPage parseDemandPageRequest(PublicOpportunityParseDemandPageRequest request) {
    String sourceUrl = normalizeHttpUrl(request == null ? null : request.sourceUrl());
    if (!StringUtils.hasText(sourceUrl)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "来源链接必须是有效的 HTTP/HTTPS 地址");
    }
    String html = cleanText(request == null ? null : request.html());
    if (!StringUtils.hasText(html)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "网页 HTML 不能为空");
    }
    if (html.length() > PUBLIC_OPPORTUNITY_PARSE_HTML_MAX_LENGTH) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "网页 HTML 不能超过 2MB");
    }
    String readable = htmlToReadableText(html);
    Map<String, Object> detailJson = normalizeDetailJsonObject(request == null ? null : request.detailJson());
    String publishedDateText = firstText(extractLabeledValue(readable, "发布时间", "发布日期", "更新时间"), regexFirst(readable, "(20\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?)"));
    Timestamp publishedAt = parsePublishedTimestamp(publishedDateText);
    detailJson.put("crawlerSourceCode", "PUBLIC_DEMAND_LOCAL_PAGE");
    detailJson.put("crawlerSourceName", "本地公开需求页");
    detailJson.put("parserEntry", "manual_html_parse");
    detailJson.put("sourceUrl", sourceUrl);
    detailJson.put("readablePreview", trimToMax(readable, 2000));
    Map<String, Object> qualityInput = new LinkedHashMap<>();
    qualityInput.put("publishedDateText", publishedDateText);
    qualityInput.put("source", "springboot-local-html-parser");
    detailJson.put("parser", qualityInput);

    String sourceSite =
        defaultString(
            cleanTextMax(request == null ? null : request.sourceSite(), 100),
            defaultString(inferSourceSite(sourceUrl), "local-public-page"));
    String city = firstText(extractGuangdongCity(readable), extractGuangdongCity(sourceUrl));
    String district = regexFirst(readable, "([\\u4E00-\\u9FA5]{2,12}(?:区|县|镇|街道|开发区|高新区|新区|产业园))");
    return new ParsedDemandPage(
        firstText(extractLabeledValue(readable, "需求面积", "求租面积", "厂房面积", "面积"), regexFirst(readable, "(\\d[0-9.,]*(?:\\s*[-~至到—–]\\s*\\d[0-9.,]*)?\\s*(?:万\\s*)?(?:平方米|平米|平方|㎡|m²|m2|亩))")),
        city,
        firstText(extractLabeledValue(readable, "联系人", "联系人姓名", "负责人", "对接人"), regexFirst(readable, "(?:联系人|负责人|对接人)[:：\\s]*([\\u4E00-\\u9FA5]{2,4})")),
        trimToMax(readable, 2000),
        detailJson,
        district,
        firstText(extractLabeledValue(readable, "行业", "所属行业", "产业类型"), regexFirst(readable, "(?:行业|所属行业|产业类型)[:：\\s]*([\\u4E00-\\u9FA5A-Z0-9、/-]{2,40})")),
        normalizeContactPhone(firstText(extractLabeledValue(readable, "联系电话", "联系手机", "电话", "手机", "联系方式"), regexFirst(readable, "((?:\\+?86[-\\s]?)?1[3-9](?:[-\\s]?\\d){9}|(?:0\\d{2,3}[-\\s]?)?\\d{7,8}|400[-\\s]?\\d{3}[-\\s]?\\d{4})"))),
        firstText(extractLabeledValue(readable, "价格", "预算", "租金", "期望租金"), regexFirst(readable, "((?:¥|￥)?\\s*\\d[0-9.,]*(?:\\s*[-~至到—–]\\s*\\d[0-9.,]*)?\\s*(?:万元|亿元|元|万|亿|块)[^\\s,，。；;]*)")),
        publishedAt,
        publishedDateText,
        sourceSite,
        sourceUrl,
        firstText(extractHtmlTitle(html), regexFirst(readable, "^(.{2,120})")));
  }

  private Map<String, Object> parsedDemandPageMap(ParsedDemandPage parsed) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("areaText", parsed.areaText());
    map.put("city", parsed.city());
    map.put("contactName", parsed.contactName());
    map.put("description", parsed.description());
    map.put("detailJson", parsed.detailJson());
    map.put("district", parsed.district());
    map.put("industryText", parsed.industryText());
    map.put("opportunityType", "DEMAND");
    map.put("phoneNumber", parsed.phoneNumber());
    map.put("priceText", parsed.priceText());
    map.put("publishedAt", toIso(parsed.publishedAt()));
    map.put("publishedDateText", parsed.publishedDateText());
    map.put("sourceSite", parsed.sourceSite());
    map.put("sourceUrl", parsed.sourceUrl());
    map.put("title", parsed.title());
    return map;
  }

  private Map<String, Object> evaluateParsedDemandQuality(ParsedDemandPage parsed) {
    List<String> missingFields = new ArrayList<>();
    if (!StringUtils.hasText(parsed.title())) {
      missingFields.add("title");
    }
    if (!StringUtils.hasText(parsed.city())) {
      missingFields.add("city");
    }
    if (!StringUtils.hasText(parsed.areaText())) {
      missingFields.add("area");
    }
    if (!StringUtils.hasText(parsed.sourceUrl())) {
      missingFields.add("sourceUrl");
    }
    if (parsed.publishedAt() == null) {
      missingFields.add("publishedDateText");
    }
    String status;
    List<String> reasons = new ArrayList<>();
    if (!StringUtils.hasText(parsed.sourceUrl()) || !parsed.sourceUrl().matches("(?i)^https?://.*")) {
      status = "SOURCE_LOST";
      reasons.add("SOURCE_URL_MISSING_OR_INVALID");
    } else if (!StringUtils.hasText(parsed.city()) || !isGuangdongPublicOpportunity(parsed.city(), parsed.district(), parsed.title())) {
      status = "OUT_OF_SCOPE";
      reasons.add("NON_GUANGDONG");
    } else if (parsed.publishedAt() == null) {
      status = "UNKNOWN_TIME";
      reasons.add("PUBLISHED_TIME_MISSING_OR_SUSPICIOUS");
    } else if (!StringUtils.hasText(parsed.title()) || !StringUtils.hasText(parsed.areaText())) {
      status = "INVALID";
      reasons.add("CITY_MISSING_OR_UNCONFIRMED_OR_DETAIL_EVIDENCE");
    } else {
      status = StringUtils.hasText(parsed.phoneNumber()) || StringUtils.hasText(parsed.contactName()) ? "VERIFIED" : "EFFECTIVE";
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("city", parsed.city());
    result.put("missingFields", missingFields);
    result.put("reasons", reasons);
    result.put("status", status);
    return result;
  }

  private String publicOpportunityQualitySkipReason(Map<String, Object> qualityResult) {
    String status = defaultString(stringObject(qualityResult.get("status")), "INVALID");
    Object reasons = qualityResult.get("reasons");
    if (reasons instanceof List<?> list && !list.isEmpty()) {
      String detail =
          list.stream()
              .map(this::stringObject)
              .filter(StringUtils::hasText)
              .collect(Collectors.joining(","));
      return StringUtils.hasText(detail) ? "QUALITY_" + status + ":" + detail : "QUALITY_" + status;
    }
    return "QUALITY_" + status;
  }

  private Map<String, Object> upsertCrawlerPublicOpportunity(
      JdbcTemplate jdbcTemplate, ParsedDemandPage parsed, Map<String, Object> qualityResult) {
    String sourceKey = trimToMax(parsed.sourceUrl(), 160);
    String sourceId = String.valueOf(manualPublicOpportunitySourceId(parsed.sourceUrl()));
    String qualityStatus = stringObject(qualityResult.get("status"));
    String qualityGrade = "VERIFIED".equals(qualityStatus) ? "VERIFIED" : "EFFECTIVE";
    String sourceCode = "PUBLIC_DEMAND_LOCAL_PAGE";
    boolean isGuangdong = isGuangdongPublicOpportunity(parsed.city(), parsed.district(), parsed.title());
    Map<String, Object> detail = new LinkedHashMap<>(parsed.detailJson());
    detail.put("qualityResult", qualityResult);
    String tagsJson = jsonString(List.of("crawler", "DEMAND", sourceCode));
    String detailJson = jsonString(detail);
    Long existingId = findExistingCrawlerPublicOpportunityId(jdbcTemplate, "DEMAND", "public_local_page_adapter", sourceKey, parsed.sourceUrl());
    if (existingId != null && existingId > 0) {
      jdbcTemplate.update(
          """
          UPDATE investment_public_opportunity
          SET opportunity_type = 'DEMAND',
              source_site = ?,
              source_url = ?,
              source_key = ?,
              source_table = 'public_local_page_adapter',
              source_id = ?,
              title = ?,
              city = ?,
              district = ?,
              area_text = ?,
              price_text = ?,
              industry_text = ?,
              contact_name = ?,
              phone_number = ?,
              description = ?,
              published_at = ?,
              published_date_text = ?,
              opportunity_status = ?,
              source_code = ?,
              is_guangdong = ?,
              has_detail_evidence = 1,
              quality_grade = ?,
              score = 75,
              tags_json = ?,
              detail_json = ?,
              last_synced_at = NOW(3),
              update_time = NOW(3)
          WHERE opportunity_id = ?
          """,
          parsed.sourceSite(),
          parsed.sourceUrl(),
          sourceKey,
          sourceId,
          cleanTextMax(parsed.title(), 255),
          cleanTextMax(parsed.city(), 100),
          cleanTextMax(parsed.district(), 100),
          cleanTextMax(parsed.areaText(), 100),
          cleanTextMax(parsed.priceText(), 100),
          cleanTextMax(parsed.industryText(), 100),
          cleanTextMax(parsed.contactName(), 100),
          cleanTextMax(parsed.phoneNumber(), 50),
          cleanTextMax(parsed.description(), 5000),
          parsed.publishedAt(),
          cleanTextMax(parsed.publishedDateText(), 100),
          qualityStatus,
          sourceCode,
          isGuangdong ? 1 : 0,
          qualityGrade,
          tagsJson,
          detailJson,
          existingId);
      return manualPublicOpportunityResult(false, findPublicOpportunityById(jdbcTemplate, existingId));
    }

    jdbcTemplate.update(
        """
        INSERT INTO investment_public_opportunity (
          opportunity_type, source_site, source_url, source_key, source_table, source_id,
          title, city, district, area_text, price_text, industry_text,
          contact_name, phone_number, description, published_at,
          published_date_text, opportunity_status, source_code, is_guangdong,
          has_detail_evidence, quality_grade, score, tags_json,
          detail_json, last_synced_at, create_time, update_time
        )
        VALUES (
          'DEMAND', ?, ?, ?, 'public_local_page_adapter', ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, 1, ?, 75, ?,
          ?, NOW(3), NOW(3), NOW(3)
        )
        """,
        parsed.sourceSite(),
        parsed.sourceUrl(),
        sourceKey,
        sourceId,
        cleanTextMax(parsed.title(), 255),
        cleanTextMax(parsed.city(), 100),
        cleanTextMax(parsed.district(), 100),
        cleanTextMax(parsed.areaText(), 100),
        cleanTextMax(parsed.priceText(), 100),
        cleanTextMax(parsed.industryText(), 100),
        cleanTextMax(parsed.contactName(), 100),
        cleanTextMax(parsed.phoneNumber(), 50),
        cleanTextMax(parsed.description(), 5000),
        parsed.publishedAt(),
        cleanTextMax(parsed.publishedDateText(), 100),
        qualityStatus,
        sourceCode,
        isGuangdong ? 1 : 0,
        qualityGrade,
        tagsJson,
        detailJson);
    Long createdId = findExistingCrawlerPublicOpportunityId(jdbcTemplate, "DEMAND", "public_local_page_adapter", sourceKey, parsed.sourceUrl());
    return manualPublicOpportunityResult(true, findPublicOpportunityById(jdbcTemplate, createdId == null ? 0 : createdId));
  }

  private List<PublicOpportunityRepairCandidate> findPublicOpportunityRepairCandidates(
      JdbcTemplate jdbcTemplate, int limit) {
    String issueSql = publicOpportunityAuditIssueSql();
    return jdbcTemplate.query(
        """
        SELECT
          opo.opportunity_id AS opportunityId,
          opo.detail_json AS detailJson,
          CASE
            WHEN COALESCE(opo.is_guangdong, 0) = 0 THEN 'OUT_OF_SCOPE'
            WHEN opo.source_url IS NULL OR TRIM(opo.source_url) = '' OR LOWER(TRIM(opo.source_url)) NOT REGEXP ? THEN 'SOURCE_LOST'
            WHEN opo.published_at IS NULL THEN 'UNKNOWN_TIME'
            WHEN opo.city IS NULL OR TRIM(opo.city) = '' THEN 'INVALID'
            WHEN COALESCE(opo.has_detail_evidence, 0) = 0 THEN 'INVALID'
            ELSE NULL
          END AS proposedDowngradeStatus
        FROM investment_public_opportunity opo
        WHERE
        """
            + issueSql
            + """

        ORDER BY
          (
            (CASE WHEN COALESCE(opo.is_guangdong, 0) = 0 THEN 16 ELSE 0 END)
            + (CASE WHEN opo.source_url IS NULL OR TRIM(opo.source_url) = '' THEN 8 ELSE 0 END)
            + (CASE WHEN opo.opportunity_type = 'SUPPLY' AND (opo.district IS NULL OR TRIM(opo.district) = '') THEN 6 ELSE 0 END)
            + (CASE WHEN opo.published_at IS NULL THEN 4 ELSE 0 END)
            + (CASE WHEN COALESCE(opo.has_detail_evidence, 0) = 0 THEN 1 ELSE 0 END)
          ) DESC,
          opo.opportunity_id ASC
        LIMIT ?
        """,
        (rs, rowNum) ->
            new PublicOpportunityRepairCandidate(
                rs.getString("detailJson"),
                nullableLong(rs, "opportunityId"),
                rs.getString("proposedDowngradeStatus")),
        TRACEABLE_SOURCE_URL_PATTERN,
        FUTURE_PUBLISHED_TOLERANCE_DAYS,
        EARLIEST_REASONABLE_PUBLISHED_AT,
        CREATED_PUBLISHED_TOLERANCE_DAYS,
        Math.max(1, Math.min(PUBLIC_OPPORTUNITY_REPAIR_LIMIT_MAX, limit)));
  }

  private Map<String, Object> publicOpportunityRepairPreviewItem(
      JdbcTemplate jdbcTemplate, PublicOpportunityRepairCandidate candidate) {
    Map<String, Object> item = findPublicOpportunityById(jdbcTemplate, longValue(candidate.opportunityId()));
    if (item == null) {
      item = new LinkedHashMap<>();
      item.put("opportunityId", candidate.opportunityId());
    }
    item.put("proposedDowngradeStatus", candidate.proposedDowngradeStatus());
    return item;
  }

  private boolean repairPublicOpportunityCandidate(
      JdbcTemplate jdbcTemplate, PublicOpportunityRepairCandidate candidate) {
    if (candidate.opportunityId() == null || !StringUtils.hasText(candidate.proposedDowngradeStatus())) {
      return false;
    }
    Map<String, Object> detail = normalizeDetailJsonObject(candidate.detailJson());
    detail.put(
        "repairAudit",
        Map.of(
            "reasonCode",
            publicOpportunityRepairReasonCode(candidate.proposedDowngradeStatus()),
            "repairedAt",
            Instant.now().toString(),
            "source",
            "springboot-public-opportunity-repair",
            "status",
            candidate.proposedDowngradeStatus()));
    int affected =
        jdbcTemplate.update(
            """
            UPDATE investment_public_opportunity
            SET opportunity_status = ?,
                detail_json = ?,
                update_time = NOW(3)
            WHERE opportunity_id = ?
              AND opportunity_status IN ('EFFECTIVE', 'VERIFIED')
            """,
            candidate.proposedDowngradeStatus(),
            jsonString(detail),
            candidate.opportunityId());
    return affected > 0;
  }

  private Map<String, Integer> publicOpportunityRepairReasonCounts(Map<String, Object> before) {
    Map<String, Integer> result = new LinkedHashMap<>();
    result.put("INVALID", (int) longValue(before.get("invalidCount")));
    result.put("OUT_OF_SCOPE", (int) longValue(before.get("outOfScopeCount")));
    result.put("SOURCE_LOST", (int) longValue(before.get("sourceLostCount")));
    result.put("UNKNOWN_TIME", (int) longValue(before.get("unknownTimeCount")));
    return result;
  }

  private String publicOpportunityRepairReasonCode(String status) {
    return switch (defaultString(status)) {
      case "OUT_OF_SCOPE" -> "NON_GUANGDONG";
      case "SOURCE_LOST" -> "SOURCE_URL_MISSING_OR_INVALID";
      case "UNKNOWN_TIME" -> "PUBLISHED_TIME_MISSING_OR_SUSPICIOUS";
      default -> "CITY_MISSING_OR_UNCONFIRMED_OR_DETAIL_EVIDENCE";
    };
  }

  private Map<String, Object> emptyPublicOpportunityRepairResult(boolean dryRun, int limit) {
    Map<String, Object> counts = emptyPublicOpportunityAuditCounts();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("after", counts);
    result.put("auditMode", dryRun ? "DRY_RUN" : "APPLY");
    result.put("before", counts);
    result.put("downgradedCount", 0);
    result.put("dryRun", dryRun);
    result.put("generatedAt", Instant.now().toString());
    result.put("limit", limit);
    result.put("plannedDowngradeCount", 0);
    result.put("previewItems", List.of());
    result.put("reasonCounts", publicOpportunityRepairReasonCounts(counts));
    result.put("repairedCount", 0);
    result.put("scannedCount", 0);
    return result;
  }

  private List<PublicOpportunityLeadSource> findPublicOpportunityLeadSources(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(
        """
        SELECT
          opportunity_id AS opportunityId,
          opportunity_type AS opportunityType,
          source_site AS sourceSite,
          source_url AS sourceUrl,
          source_table AS sourceTable,
          title,
          city,
          district,
          area_text AS areaText,
          area_sqm AS areaSqm,
          industry_text AS industryText,
          contact_name AS contactName,
          phone_number AS phoneNumber,
          price_text AS priceText,
          description,
          published_at AS publishedAt,
          tags_json AS tagsJson,
          detail_json AS detailJson,
          last_synced_at AS lastSyncedAt
        FROM investment_public_opportunity
        ORDER BY opportunity_id ASC
        """,
        (rs, rowNum) ->
            new PublicOpportunityLeadSource(
                rs.getObject("areaSqm"),
                rs.getString("areaText"),
                rs.getString("city"),
                rs.getString("contactName"),
                rs.getString("description"),
                rs.getString("detailJson"),
                rs.getString("district"),
                rs.getString("industryText"),
                nullableLong(rs, "opportunityId"),
                rs.getString("opportunityType"),
                rs.getString("phoneNumber"),
                rs.getString("priceText"),
                safeTimestamp(rs, "publishedAt"),
                rs.getString("sourceSite"),
                rs.getString("sourceTable"),
                rs.getString("sourceUrl"),
                rs.getString("tagsJson"),
                rs.getString("title"),
                safeTimestamp(rs, "lastSyncedAt")));
  }

  private ExternalLeadBuildResult buildExternalLeadFromPublicOpportunity(PublicOpportunityLeadSource source) {
    if (!"DEMAND".equalsIgnoreCase(defaultString(source.opportunityType()))) {
      return skippedExternalLead(source, "NOT_DEMAND");
    }
    if (!StringUtils.hasText(source.sourceUrl())) {
      return skippedExternalLead(source, "MISSING_SOURCE_URL");
    }
    String searchText =
        String.join(
            " ",
            defaultString(source.title()),
            defaultString(source.description()),
            defaultString(source.industryText()),
            defaultString(source.tagsJson()),
            defaultString(source.detailJson()));
    List<String> matchedKeywords =
        PUBLIC_OPPORTUNITY_LEAD_INCLUDE_KEYWORDS.stream().filter(searchText::contains).toList();
    if (matchedKeywords.isEmpty()) {
      return skippedExternalLead(source, "NO_INCLUDE_KEYWORD");
    }
    if (PUBLIC_OPPORTUNITY_LEAD_EXCLUDE_KEYWORDS.stream().anyMatch(searchText::contains)) {
      return skippedExternalLead(source, "EXCLUDED_KEYWORD");
    }
    String companyName = extractCompanyNameFromPublicOpportunity(source);
    if (!StringUtils.hasText(companyName)) {
      return skippedExternalLead(source, "NO_RELIABLE_COMPANY_NAME");
    }
    int confidenceScore = calculatePublicOpportunityLeadConfidence(source, companyName, matchedKeywords);
    if (confidenceScore < 60) {
      return skippedExternalLead(source, "LOW_CONFIDENCE");
    }
    String summary =
        List.of(
                defaultString(source.description()),
                StringUtils.hasText(source.areaText()) ? "面积：" + source.areaText() : "",
                StringUtils.hasText(source.industryText()) ? "行业：" + source.industryText() : "",
                StringUtils.hasText(source.contactName()) ? "联系人：" + source.contactName() : "",
                StringUtils.hasText(source.phoneNumber()) ? "电话：" + source.phoneNumber() : "")
            .stream()
            .filter(StringUtils::hasText)
            .collect(Collectors.joining("\n"));
    String region =
        List.of(defaultString(source.city()), defaultString(source.district())).stream()
            .filter(StringUtils::hasText)
            .collect(Collectors.joining(" / "));
    String evidenceText =
        List.of(
                StringUtils.hasText(source.title()) ? "标题：" + source.title() : "",
                StringUtils.hasText(source.description()) ? "描述：" + source.description() : "",
                StringUtils.hasText(source.areaText()) ? "面积：" + source.areaText() : "",
                StringUtils.hasText(source.industryText()) ? "行业：" + source.industryText() : "",
                StringUtils.hasText(region) ? "区域：" + region : "",
                StringUtils.hasText(source.tagsJson()) ? "标签：" + source.tagsJson() : "",
                StringUtils.hasText(source.detailJson()) ? "详情：" + source.detailJson() : "")
            .stream()
            .filter(StringUtils::hasText)
            .collect(Collectors.joining("\n"));
    return new ExternalLeadBuildResult(
        companyName,
        confidenceScore,
        resolvePublicOpportunityDemandType(matchedKeywords),
        evidenceText,
        matchedKeywords,
        source,
        null,
        StringUtils.hasText(summary) ? summary : source.title());
  }

  private ExternalLeadBuildResult skippedExternalLead(PublicOpportunityLeadSource source, String reason) {
    return new ExternalLeadBuildResult(null, 0, null, null, List.of(), source, reason, null);
  }

  private Map<String, Object> upsertExternalLeadFromPublicOpportunity(
      JdbcTemplate jdbcTemplate, ExternalLeadBuildResult buildResult) {
    return upsertExternalLeadFromPublicOpportunity(jdbcTemplate, buildResult, "PUBLIC_OPPORTUNITY");
  }

  private Map<String, Object> upsertExternalLeadFromPublicOpportunity(
      JdbcTemplate jdbcTemplate, ExternalLeadBuildResult buildResult, String sourceType) {
    PublicOpportunityLeadSource source = buildResult.source();
    String normalizedSourceType = defaultString(cleanText(sourceType), "PUBLIC_OPPORTUNITY");
    String confidenceLevel = buildResult.confidenceScore() >= 80 ? "HIGH" : "MEDIUM";
    String leadTitle = defaultString(source.title(), "公开机会 #" + source.opportunityId());
    boolean created = false;
    boolean updated = false;
    Long leadId = findExternalLeadIdBySource(jdbcTemplate, normalizedSourceType, source.opportunityId());
    Timestamp crawledAt = source.lastSyncedAt() == null ? Timestamp.from(Instant.now()) : source.lastSyncedAt();
    if (leadId == null) {
      jdbcTemplate.update(
          """
          INSERT INTO company_lead (
            source_type, source_name, source_id, source_url, source_title,
            company_name, lead_title, summary, industry_name, region_province,
            region_city, region_district, demand_type, confidence_score,
            confidence_level, hit_keywords, first_seen_at, last_seen_at,
            crawled_at, status, evidence_count, create_time, update_time, is_deleted
          )
          VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, NULL,
            ?, ?, ?, ?,
            ?, ?, NOW(3), NOW(3),
            ?, 'NEW', 0, NOW(3), NOW(3), 0
          )
          """,
          normalizedSourceType,
          defaultString(source.sourceSite(), "public_opportunity"),
          source.opportunityId(),
          source.sourceUrl(),
          source.title(),
          buildResult.companyName(),
          leadTitle,
          buildResult.summary(),
          source.industryText(),
          source.city(),
          source.district(),
          buildResult.demandType(),
          buildResult.confidenceScore(),
          confidenceLevel,
          jsonString(buildResult.matchedKeywords()),
          crawledAt);
      leadId = lastInsertId(jdbcTemplate);
      created = true;
    } else {
      jdbcTemplate.update(
          """
          UPDATE company_lead
          SET source_name = ?,
              source_url = ?,
              source_title = ?,
              company_name = ?,
              lead_title = ?,
              summary = ?,
              industry_name = ?,
              region_city = ?,
              region_district = ?,
              demand_type = ?,
              confidence_score = ?,
              confidence_level = ?,
              hit_keywords = ?,
              last_seen_at = NOW(3),
              crawled_at = ?,
              is_deleted = 0,
              update_time = NOW(3)
          WHERE lead_id = ?
          """,
          defaultString(source.sourceSite(), "public_opportunity"),
          source.sourceUrl(),
          source.title(),
          buildResult.companyName(),
          leadTitle,
          buildResult.summary(),
          source.industryText(),
          source.city(),
          source.district(),
          buildResult.demandType(),
          buildResult.confidenceScore(),
          confidenceLevel,
          jsonString(buildResult.matchedKeywords()),
          crawledAt,
          leadId);
      updated = true;
    }

    List<Long> evidenceIds = upsertExternalLeadEvidence(jdbcTemplate, leadId, buildResult, crawledAt);
    jdbcTemplate.update(
        """
        UPDATE company_lead
        SET evidence_count = (
              SELECT COUNT(*) FROM lead_evidence WHERE lead_id = ? AND is_deleted = 0
            ),
            update_time = NOW(3)
        WHERE lead_id = ?
        """,
        leadId,
        leadId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("created", created);
    result.put("evidenceCreatedCount", evidenceIds.size());
    result.put("evidenceIds", evidenceIds);
    result.put("leadId", leadId);
    result.put("updated", updated);
    return result;
  }

  private List<Long> upsertExternalLeadEvidence(
      JdbcTemplate jdbcTemplate, long leadId, ExternalLeadBuildResult buildResult, Timestamp crawledAt) {
    String contentHash =
        sha256Hex(
            String.join(
                "|",
                defaultString(buildResult.source().sourceUrl()),
                defaultString(buildResult.source().title()),
                defaultString(buildResult.evidenceText())));
    Long evidenceId = findLeadEvidenceIdByHash(jdbcTemplate, leadId, contentHash);
    Object matchedSentences =
        jsonString(List.of(defaultString(buildResult.source().title()), defaultString(buildResult.source().description())));
    if (evidenceId != null) {
      jdbcTemplate.update(
          """
          UPDATE lead_evidence
          SET evidence_type = 'NOTICE',
              source_title = ?,
              source_link = ?,
              raw_text = ?,
              matched_keywords = ?,
              matched_sentences = ?,
              score_delta = ?,
              published_at = ?,
              crawled_at = ?,
              is_deleted = 0,
              update_time = NOW(3)
          WHERE evidence_id = ?
          """,
          defaultString(buildResult.source().title(), "公开机会 #" + buildResult.source().opportunityId()),
          buildResult.source().sourceUrl(),
          buildResult.evidenceText(),
          jsonString(buildResult.matchedKeywords()),
          matchedSentences,
          Math.min(30, buildResult.matchedKeywords().size() * 5),
          buildResult.source().publishedAt(),
          crawledAt,
          evidenceId);
      return List.of();
    }
    jdbcTemplate.update(
        """
        INSERT INTO lead_evidence (
          lead_id, evidence_type, source_title, source_link, raw_text,
          matched_keywords, matched_sentences, score_delta, content_hash,
          published_at, crawled_at, create_time, update_time, is_deleted
        )
        VALUES (?, 'NOTICE', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), 0)
        """,
        leadId,
        defaultString(buildResult.source().title(), "公开机会 #" + buildResult.source().opportunityId()),
        buildResult.source().sourceUrl(),
        buildResult.evidenceText(),
        jsonString(buildResult.matchedKeywords()),
        matchedSentences,
        Math.min(30, buildResult.matchedKeywords().size() * 5),
        contentHash,
        buildResult.source().publishedAt(),
        crawledAt);
    return List.of(lastInsertId(jdbcTemplate));
  }

  private Map<String, Integer> publicOpportunityLeadSkipReasonMap() {
    Map<String, Integer> result = new LinkedHashMap<>();
    result.put("EXCLUDED_KEYWORD", 0);
    result.put("LOW_CONFIDENCE", 0);
    result.put("MISSING_SOURCE_URL", 0);
    result.put("NO_INCLUDE_KEYWORD", 0);
    result.put("NO_RELIABLE_COMPANY_NAME", 0);
    result.put("NOT_DEMAND", 0);
    return result;
  }

  private Map<String, Object> publicOpportunityAuditCounts(JdbcTemplate jdbcTemplate, String whereSql) {
    String where = StringUtils.hasText(whereSql) ? whereSql : "";
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              COUNT(*) AS totalCount,
              SUM(CASE WHEN COALESCE(is_guangdong, 0) = 1 THEN 1 ELSE 0 END) AS guangdongValidCount,
              SUM(CASE WHEN COALESCE(is_guangdong, 0) = 0 THEN 1 ELSE 0 END) AS nonGuangdongCount,
              SUM(CASE WHEN source_url IS NULL OR TRIM(source_url) = '' OR LOWER(TRIM(source_url)) NOT REGEXP ? THEN 1 ELSE 0 END) AS missingSourceUrlCount,
              SUM(CASE WHEN city IS NULL OR TRIM(city) = '' OR LOWER(TRIM(city)) REGEXP ? THEN 1 ELSE 0 END) AS missingSupplyLocationCount,
              SUM(CASE WHEN published_at IS NULL THEN 1 ELSE 0 END) AS missingPublishedAtCount,
              SUM(CASE
                WHEN published_at IS NOT NULL
                  AND (
                    published_at > DATE_ADD(NOW(3), INTERVAL ? DAY)
                    OR published_at < ?
                    OR (
                      COALESCE(last_synced_at, update_time, create_time) IS NOT NULL
                      AND published_at > DATE_ADD(COALESCE(last_synced_at, update_time, create_time), INTERVAL ? DAY)
                    )
                  )
                THEN 1 ELSE 0
              END) AS suspiciousPublishedAtCount,
              SUM(CASE WHEN COALESCE(has_detail_evidence, 0) = 0 THEN 1 ELSE 0 END) AS missingHashOrDetailEvidenceCount,
              SUM(CASE WHEN opportunity_status IN ('EFFECTIVE', 'VERIFIED') AND COALESCE(is_guangdong, 0) = 0 THEN 1 ELSE 0 END) AS outOfScopeCount,
              SUM(CASE
                WHEN opportunity_status IN ('EFFECTIVE', 'VERIFIED')
                  AND (source_url IS NULL OR TRIM(source_url) = '' OR LOWER(TRIM(source_url)) NOT REGEXP ?)
                THEN 1 ELSE 0
              END) AS sourceLostCount,
              SUM(CASE
                WHEN opportunity_status IN ('EFFECTIVE', 'VERIFIED')
                  AND (published_at IS NULL OR published_at > DATE_ADD(NOW(3), INTERVAL ? DAY) OR published_at < ?)
                THEN 1 ELSE 0
              END) AS unknownTimeCount,
              SUM(CASE
                WHEN opportunity_status IN ('EFFECTIVE', 'VERIFIED')
                  AND (
                    COALESCE(is_guangdong, 0) = 0
                    OR source_url IS NULL
                    OR TRIM(source_url) = ''
                    OR published_at IS NULL
                    OR COALESCE(has_detail_evidence, 0) = 0
                  )
                THEN 1 ELSE 0
              END) AS proposedDowngradeCount,
              SUM(CASE
                WHEN city IS NULL OR TRIM(city) = ''
                  OR (opportunity_type = 'SUPPLY' AND (district IS NULL OR TRIM(district) = ''))
                  OR COALESCE(has_detail_evidence, 0) = 0
                THEN 1 ELSE 0
              END) AS invalidCount
            FROM investment_public_opportunity
            """
                + where,
            (rs, rowNum) -> publicOpportunityAuditCountsMap(rs),
            TRACEABLE_SOURCE_URL_PATTERN,
            UNKNOWN_CITY_VALUE_PATTERN,
            FUTURE_PUBLISHED_TOLERANCE_DAYS,
            EARLIEST_REASONABLE_PUBLISHED_AT,
            CREATED_PUBLISHED_TOLERANCE_DAYS,
            TRACEABLE_SOURCE_URL_PATTERN,
            FUTURE_PUBLISHED_TOLERANCE_DAYS,
            EARLIEST_REASONABLE_PUBLISHED_AT);
    return rows.isEmpty() ? emptyPublicOpportunityAuditCounts() : rows.get(0);
  }

  private String publicOpportunityAuditIssueSql() {
    return """
        (
          COALESCE(opo.is_guangdong, 0) = 0
          OR opo.source_url IS NULL
          OR TRIM(opo.source_url) = ''
          OR LOWER(TRIM(opo.source_url)) NOT REGEXP ?
          OR opo.published_at IS NULL
          OR opo.published_at > DATE_ADD(NOW(3), INTERVAL ? DAY)
          OR opo.published_at < ?
          OR (
            COALESCE(opo.last_synced_at, opo.update_time, opo.create_time) IS NOT NULL
            AND opo.published_at > DATE_ADD(COALESCE(opo.last_synced_at, opo.update_time, opo.create_time), INTERVAL ? DAY)
          )
          OR COALESCE(opo.has_detail_evidence, 0) = 0
          OR opo.city IS NULL
          OR TRIM(opo.city) = ''
          OR LOWER(TRIM(opo.city)) REGEXP ?
          OR (opo.opportunity_type = 'SUPPLY' AND (opo.district IS NULL OR TRIM(opo.district) = ''))
        )
        """;
  }

  private Map<String, Object> publicOpportunityAuditDashboard(
      JdbcTemplate jdbcTemplate, Map<String, Object> summary) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("generatedAt", Instant.now().toString());
    result.put("summary", summary);
    result.put("progress", publicOpportunityAuditProgress(summary));
    result.put("platformStats", publicOpportunityAuditPlatformStats(jdbcTemplate));
    result.put("cityStats", publicOpportunityAuditCityStats(jdbcTemplate));
    result.put("runtimeStats", publicOpportunityAuditRuntimeStats(jdbcTemplate));
    return result;
  }

  private Map<String, Object> publicOpportunityAuditProgress(Map<String, Object> summary) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("totalCount", summary.get("totalCount"));
    result.put("guangdongValidCount", summary.get("guangdongValidCount"));
    result.put("pendingVerifyCount", summary.get("proposedDowngradeCount"));
    result.put("pendingVerifyOverdueCount", summary.get("suspiciousPublishedAtCount"));
    result.put("nonGuangdongHiddenCount", summary.get("nonGuangdongCount"));
    result.put("nonGuangdongHiddenRate", rate(summary.get("nonGuangdongCount"), summary.get("totalCount")));
    return result;
  }

  private List<Map<String, Object>> publicOpportunityAuditPlatformStats(JdbcTemplate jdbcTemplate) {
    if (!hasPublicOpportunityAuditColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          COALESCE(NULLIF(source_code, ''), NULLIF(source_site, ''), 'UNKNOWN') AS sourceCode,
          COALESCE(NULLIF(source_site, ''), NULLIF(source_code, ''), 'UNKNOWN') AS platformName,
          COUNT(*) AS totalCount,
          SUM(CASE WHEN opportunity_type = 'DEMAND' THEN 1 ELSE 0 END) AS demandCount,
          SUM(CASE WHEN opportunity_type = 'SUPPLY' THEN 1 ELSE 0 END) AS listingCount
        FROM investment_public_opportunity
        GROUP BY sourceCode, platformName
        ORDER BY totalCount DESC
        LIMIT 20
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("demandCount", rs.getLong("demandCount"));
          map.put("listingCount", rs.getLong("listingCount"));
          map.put("platformCode", rs.getString("sourceCode"));
          map.put("platformName", rs.getString("platformName"));
          map.put("sourceCode", rs.getString("sourceCode"));
          map.put("totalCount", rs.getLong("totalCount"));
          return map;
        });
  }

  private List<Map<String, Object>> publicOpportunityAuditCityStats(JdbcTemplate jdbcTemplate) {
    if (!hasPublicOpportunityAuditColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT
          COALESCE(NULLIF(city, ''), '未知城市') AS cityName,
          COUNT(*) AS totalCount,
          SUM(CASE WHEN opportunity_type = 'DEMAND' THEN 1 ELSE 0 END) AS demandCount,
          SUM(CASE WHEN opportunity_type = 'SUPPLY' THEN 1 ELSE 0 END) AS listingCount
        FROM investment_public_opportunity
        GROUP BY cityName
        ORDER BY totalCount DESC
        LIMIT 20
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("cityName", rs.getString("cityName"));
          map.put("demandCount", rs.getLong("demandCount"));
          map.put("listingCount", rs.getLong("listingCount"));
          map.put("totalCount", rs.getLong("totalCount"));
          return map;
        });
  }

  private List<Map<String, Object>> publicOpportunityAuditRuntimeStats(JdbcTemplate jdbcTemplate) {
    if (!hasCrawlerTaskColumns(jdbcTemplate) || !hasCrawlerSourceColumns(jdbcTemplate)) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT latest.*
        FROM (
          SELECT
            s.source_code AS sourceCode,
            s.source_name AS sourceName,
            t.task_id AS taskId,
            t.status,
            t.fetched_count AS fetchedCount,
            t.created_lead_count AS createdLeadCount,
            t.updated_lead_count AS updatedLeadCount,
            t.finished_at AS finishedAt,
            ROW_NUMBER() OVER (PARTITION BY t.source_id ORDER BY t.create_time DESC, t.task_id DESC) AS rowNum
          FROM crawler_task t
          INNER JOIN crawler_source s ON s.source_id = t.source_id
          WHERE s.source_code IN (
        """
            + placeholders(PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.size())
            + """
          )
        ) latest
        WHERE latest.rowNum = 1
        ORDER BY sourceCode ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("fetchedCount", rs.getLong("fetchedCount"));
          map.put("finishedAt", toIso(safeTimestamp(rs, "finishedAt")));
          map.put("latestTaskStatus", rs.getString("status"));
          map.put("sourceCode", rs.getString("sourceCode"));
          map.put("sourceName", rs.getString("sourceName"));
          map.put("taskId", nullableLong(rs, "taskId"));
          map.put("updatedCount", rs.getLong("updatedLeadCount"));
          map.put("upsertedCount", rs.getLong("createdLeadCount") + rs.getLong("updatedLeadCount"));
          return map;
        },
        PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.toArray());
  }

  private Map<String, Object> publicOpportunityAuditPreviewResult(
      List<Map<String, Object>> items, long totalPreviewCount) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("auditMode", "DRY_RUN");
    result.put("dryRun", true);
    result.put("generatedAt", Instant.now().toString());
    result.put("items", items);
    result.put("limit", PUBLIC_OPPORTUNITY_AUDIT_PREVIEW_LIMIT);
    result.put("totalPreviewCount", totalPreviewCount);
    return result;
  }

  private Map<String, Object> emptyPublicOpportunityAuditSummary() {
    Map<String, Object> summary = emptyPublicOpportunityAuditCounts();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("auditMode", "DRY_RUN");
    result.put("dashboard", emptyPublicOpportunityAuditDashboard(summary));
    result.put("dryRun", true);
    result.put("generatedAt", Instant.now().toString());
    result.put("summary", summary);
    result.put(
        "typeStats",
        Map.of(
            "DEMAND", emptyPublicOpportunityAuditTypeCounts("DEMAND"),
            "SUPPLY", emptyPublicOpportunityAuditTypeCounts("SUPPLY")));
    return result;
  }

  private Map<String, Object> emptyPublicOpportunityAuditCounts() {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("guangdongValidCount", 0L);
    map.put("invalidCount", 0L);
    map.put("missingHashOrDetailEvidenceCount", 0L);
    map.put("missingPublishedAtCount", 0L);
    map.put("missingSourceUrlCount", 0L);
    map.put("missingSupplyLocationCount", 0L);
    map.put("nonGuangdongCount", 0L);
    map.put("outOfScopeCount", 0L);
    map.put("proposedDowngradeCount", 0L);
    map.put("sourceLostCount", 0L);
    map.put("suspiciousPublishedAtCount", 0L);
    map.put("totalCount", 0L);
    map.put("unknownTimeCount", 0L);
    return map;
  }

  private Map<String, Object> emptyPublicOpportunityAuditTypeCounts(String opportunityType) {
    Map<String, Object> map = emptyPublicOpportunityAuditCounts();
    map.put("opportunityType", opportunityType);
    map.put("opportunityTypeLabel", opportunityTypeLabel(opportunityType));
    return map;
  }

  private Map<String, Object> emptyPublicOpportunityAuditDashboard(Map<String, Object> summary) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("generatedAt", Instant.now().toString());
    result.put("summary", summary);
    result.put("progress", publicOpportunityAuditProgress(summary));
    result.put("platformStats", List.of());
    result.put("cityStats", List.of());
    result.put("runtimeStats", List.of());
    return result;
  }

  private String publicOpportunitySelectColumns(String prefix) {
    return """
              ${prefix}opportunity_id AS opportunityId,
              ${prefix}opportunity_type AS opportunityType,
              ${prefix}source_site AS sourceSite,
              ${prefix}source_url AS sourceUrl,
              ${prefix}source_table AS sourceTable,
              ${prefix}source_id AS sourceId,
              ${prefix}source_code AS sourceCode,
              ${prefix}title,
              ${prefix}city,
              ${prefix}district,
              ${prefix}area_text AS areaText,
              ${prefix}area_sqm AS areaSqm,
              ${prefix}price_text AS priceText,
              ${prefix}industry_text AS industryText,
              ${prefix}contact_name AS contactName,
              ${prefix}phone_number AS phoneNumber,
              ${prefix}description,
              ${prefix}published_at AS publishedAt,
              ${prefix}published_date_text AS publishedDateText,
              ${prefix}effective_until AS effectiveUntil,
              ${prefix}opportunity_status AS opportunityStatus,
              ${prefix}is_guangdong AS isGuangdong,
              ${prefix}has_detail_evidence AS hasDetailEvidence,
              ${prefix}quality_grade AS qualityGrade,
              ${prefix}score,
              ${prefix}tags_json AS tagsJson,
              ${prefix}detail_json AS detailJson,
              ${prefix}last_synced_at AS lastSyncedAt,
          """
        .replace("${prefix}", prefix)
        + publicOpportunityPublishedAgeSql(prefix)
        + " AS publishedAgeLabel";
  }

  private String publicOpportunityPublishedAgeSql(String prefix) {
    return """
          CASE
            WHEN ${prefix}published_at IS NULL THEN NULL
            WHEN TIMESTAMPDIFF(HOUR, ${prefix}published_at, NOW()) < 24
              THEN CONCAT(TIMESTAMPDIFF(HOUR, ${prefix}published_at, NOW()), ' 小时前')
            ELSE CONCAT(TIMESTAMPDIFF(DAY, ${prefix}published_at, NOW()), ' 天前')
          END
          """
        .replace("${prefix}", prefix);
  }

  private String reliablePublicOpportunitySupplySql() {
    return """
        (
          opo.opportunity_type <> 'SUPPLY'
          OR (
            CASE
              WHEN JSON_VALID(opo.detail_json)
                THEN JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.extractionPolicy'))
              ELSE NULL
            END = 'STRICT_DETAIL_PAGE_LABELS_ONLY'
            AND CASE
              WHEN JSON_VALID(opo.detail_json)
                THEN JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.responseHash'))
              ELSE NULL
            END IS NOT NULL
          )
        )
        """;
  }

  private String guangdongRegionPattern() {
    return String.join("|", GUANGDONG_REGION_SCOPE);
  }

  private String nonGuangdongRegionPattern() {
    return "北京|天津|上海|重庆|河北|山西|内蒙古|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广西|海南|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|香港|澳门|台湾";
  }

  private Map<String, Object> investmentMap(ResultSet rs, boolean includeParkName) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("investmentId", rs.getInt("investmentId"));
    map.put("agentName", rs.getString("agentName"));
    map.put("tenantName", rs.getString("tenantName"));
    map.put("intentLevel", rs.getString("intentLevel"));
    map.put("intentArea", numericObject(rs.getObject("intentArea")));
    map.put("progress", rs.getString("progress"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("meetingTime", toIso(safeTimestamp(rs, "meetingTime")));
    map.put("remark", rs.getString("remark"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    map.put("parkId", nullableInteger(rs, "parkId"));
    if (includeParkName) {
      map.put("parkName", rs.getString("parkName"));
      map.put("imageUrlList", new ArrayList<String>());
    }
    return map;
  }

  private Map<String, Object> leadScoreRuleMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enabled", booleanValue(rs.getObject("enabled")));
    map.put("eventType", rs.getString("eventType"));
    map.put("keywordJson", parseJsonArray(rs.getString("keywordJson"), false));
    map.put("ruleCode", defaultString(rs.getString("ruleCode")));
    map.put("ruleDescription", rs.getString("ruleDescription"));
    map.put("ruleId", rs.getLong("ruleId"));
    map.put("ruleName", defaultString(rs.getString("ruleName")));
    map.put("scoreDelta", rs.getInt("scoreDelta"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> crawlerSourceMap(ResultSet rs) throws SQLException {
    String sourceCode = defaultString(rs.getString("sourceCode"));
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("adapterStatus", CRAWLER_READY_SOURCE_CODES.contains(sourceCode) ? "READY" : "CANDIDATE");
    map.put("allowedPathsJson", crawlerAllowedPaths(sourceCode, rs.getString("allowedPathsJson")));
    map.put("baseUrl", defaultString(rs.getString("baseUrl")));
    map.put("blockedPathsJson", parseJsonArray(rs.getString("blockedPathsJson"), true));
    map.put("crawlIntervalMinutes", rs.getInt("crawlIntervalMinutes"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enabled", booleanValue(rs.getObject("enabled")));
    map.put("keywordExcludeJson", parseJsonArray(rs.getString("keywordExcludeJson"), true));
    map.put("keywordIncludeJson", parseJsonArray(rs.getString("keywordIncludeJson"), true));
    map.put("lastCrawledAt", toIso(safeTimestamp(rs, "lastCrawledAt")));
    map.put("rateLimitPerMinute", rs.getInt("rateLimitPerMinute"));
    map.put("regionScopeJson", crawlerRegionScope(sourceCode, rs.getString("regionScopeJson")));
    map.put("robotsUrl", rs.getString("robotsUrl"));
    map.put("sourceCode", sourceCode);
    map.put("sourceId", rs.getLong("sourceId"));
    map.put("sourceName", defaultString(rs.getString("sourceName")));
    map.put("sourceType", defaultString(rs.getString("sourceType"), "PUBLIC_OPPORTUNITY"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> radarSalesUserMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("activeLeadCount", rs.getInt("activeLeadCount"));
    map.put("parkName", defaultString(rs.getString("parkName")));
    map.put("userId", rs.getInt("userId"));
    map.put("userName", defaultString(rs.getString("userName")));
    return map;
  }

  private Map<String, Object> crawlerTaskMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("crawlEndedAt", toIso(safeTimestamp(rs, "crawlEndedAt")));
    map.put("crawlStartedAt", toIso(safeTimestamp(rs, "crawlStartedAt")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("createdLeadCount", rs.getInt("createdLeadCount"));
    map.put("errorMessage", rs.getString("errorMessage"));
    map.put("failedItemCount", rs.getInt("failedItemCount"));
    map.put("fetchedCount", rs.getInt("fetchedCount"));
    map.put("finishedAt", toIso(safeTimestamp(rs, "finishedAt")));
    map.put("maxRetryCount", rs.getInt("maxRetryCount"));
    map.put("nextRetryAt", toIso(safeTimestamp(rs, "nextRetryAt")));
    map.put("pendingItemCount", rs.getInt("pendingItemCount"));
    map.put("requestConfigJson", parseJsonObject(rs.getString("requestConfigJson")));
    map.put("retryCount", rs.getInt("retryCount"));
    map.put("retryWaitingItemCount", rs.getInt("retryWaitingItemCount"));
    map.put("skippedCount", rs.getInt("skippedCount"));
    map.put("skippedItemCount", rs.getInt("skippedItemCount"));
    map.put("skipReason", rs.getString("skipReason"));
    map.put("sourceCode", rs.getString("sourceCode"));
    map.put("sourceId", rs.getLong("sourceId"));
    map.put("sourceName", rs.getString("sourceName"));
    map.put("successItemCount", rs.getInt("successItemCount"));
    map.put("startedAt", toIso(safeTimestamp(rs, "startedAt")));
    map.put("status", defaultString(rs.getString("status"), "PENDING"));
    map.put("taskId", rs.getLong("taskId"));
    map.put("taskType", defaultString(rs.getString("taskType")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    map.put("updatedLeadCount", rs.getInt("updatedLeadCount"));
    return map;
  }

  private Map<String, Object> crawlerTaskLogMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("detailJson", parseJsonObject(rs.getString("detailJson")));
    map.put("level", defaultString(rs.getString("level"), "INFO"));
    map.put("logId", rs.getLong("logId"));
    map.put("message", defaultString(rs.getString("message")));
    map.put("stage", defaultString(rs.getString("stage")));
    map.put("taskId", rs.getLong("taskId"));
    return map;
  }

  private Map<String, Object> crawlerTaskItemMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("itemId", rs.getLong("itemId"));
    map.put("lastError", rs.getString("lastError"));
    map.put("lastFinishedAt", toIso(safeTimestamp(rs, "lastFinishedAt")));
    map.put("lastHttpStatus", nullableInteger(rs, "lastHttpStatus"));
    map.put("lastStartedAt", toIso(safeTimestamp(rs, "lastStartedAt")));
    map.put("lastSuccessAt", toIso(safeTimestamp(rs, "lastSuccessAt")));
    map.put("lastTaskId", nullableLong(rs, "lastTaskId"));
    map.put("maxRetryCount", rs.getInt("maxRetryCount"));
    map.put("nextRetryAt", toIso(safeTimestamp(rs, "nextRetryAt")));
    map.put("publishedAt", toIso(safeTimestamp(rs, "publishedAt")));
    map.put("retryCount", rs.getInt("retryCount"));
    map.put("skipReason", rs.getString("skipReason"));
    map.put("sourceId", rs.getLong("sourceId"));
    map.put("sourceRefId", nullableLong(rs, "sourceRefId"));
    map.put("sourceRefType", rs.getString("sourceRefType"));
    map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
    map.put("status", defaultString(rs.getString("status"), "PENDING"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> signalEventMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("companyName", defaultString(rs.getString("companyName")));
    map.put("confidenceScore", rs.getInt("confidenceScore"));
    map.put("contentHash", defaultString(rs.getString("contentHash")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("eventId", rs.getLong("eventId"));
    map.put("eventSummary", rs.getString("eventSummary"));
    map.put("eventTime", toIso(safeTimestamp(rs, "eventTime")));
    map.put("eventTitle", defaultString(rs.getString("eventTitle")));
    map.put("eventType", defaultString(rs.getString("eventType"), "UNKNOWN"));
    map.put("rawPayloadJson", parseJsonObject(rs.getString("rawPayloadJson")));
    map.put("relatedExternalLeadId", nullableLong(rs, "relatedExternalLeadId"));
    map.put("relatedRadarLeadId", nullableLong(rs, "relatedRadarLeadId"));
    map.put("sourceName", defaultString(rs.getString("sourceName")));
    map.put("sourceType", defaultString(rs.getString("sourceType")));
    map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
    map.put("status", defaultString(rs.getString("status"), "NEW"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> signalEventEvidenceMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("contentHash", defaultString(rs.getString("contentHash")));
    map.put("crawledAt", toIso(safeTimestamp(rs, "crawledAt")));
    map.put("evidenceId", rs.getLong("evidenceId"));
    map.put("evidenceType", defaultString(rs.getString("evidenceType")));
    map.put("eventId", rs.getLong("eventId"));
    map.put("matchedKeywords", parseJsonArray(rs.getString("matchedKeywordsJson"), false));
    map.put("matchedSentences", parseJsonArray(rs.getString("matchedSentencesJson"), false));
    map.put("publishedAt", toIso(safeTimestamp(rs, "publishedAt")));
    map.put("rawText", rs.getString("rawText"));
    map.put("scoreDelta", rs.getInt("scoreDelta"));
    map.put("sourceLink", defaultString(rs.getString("sourceLink")));
    map.put("sourceTitle", defaultString(rs.getString("sourceTitle")));
    return map;
  }

  private Map<String, Object> externalLeadMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("companyName", defaultString(rs.getString("companyName")));
    map.put("confidenceLevel", defaultString(rs.getString("confidenceLevel"), "LOW"));
    map.put("confidenceScore", rs.getInt("confidenceScore"));
    map.put("convertedAt", toIso(safeTimestamp(rs, "convertedAt")));
    map.put("convertedRadarLeadId", nullableLong(rs, "convertedRadarLeadId"));
    map.put("crawledAt", toIso(safeTimestamp(rs, "crawledAt")));
    map.put("demandType", defaultString(rs.getString("demandType"), "UNKNOWN"));
    map.put("evidenceCount", rs.getInt("evidenceCount"));
    map.put("firstSeenAt", toIso(safeTimestamp(rs, "firstSeenAt")));
    map.put("hitKeywords", parseJsonArray(rs.getString("hitKeywords"), false));
    map.put("industryName", rs.getString("industryName"));
    map.put("invalidReason", rs.getString("invalidReason"));
    map.put("lastSeenAt", toIso(safeTimestamp(rs, "lastSeenAt")));
    map.put("leadId", rs.getLong("leadId"));
    map.put("leadTitle", defaultString(rs.getString("leadTitle")));
    map.put("ownerName", rs.getString("ownerName"));
    map.put("ownerUserId", nullableInteger(rs, "ownerUserId"));
    map.put("regionCity", rs.getString("regionCity"));
    map.put("regionDistrict", rs.getString("regionDistrict"));
    map.put("regionProvince", rs.getString("regionProvince"));
    map.put("remark", rs.getString("remark"));
    map.put("sourceId", nullableLong(rs, "sourceId"));
    map.put("sourceName", defaultString(rs.getString("sourceName")));
    map.put("sourceTitle", rs.getString("sourceTitle"));
    map.put("sourceType", defaultString(rs.getString("sourceType"), "PUBLIC"));
    map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
    map.put("status", defaultString(rs.getString("status"), "NEW"));
    map.put("summary", rs.getString("summary"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> externalLeadEvidenceMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("contentHash", defaultString(rs.getString("contentHash")));
    map.put("crawledAt", toIso(safeTimestamp(rs, "crawledAt")));
    map.put("evidenceId", rs.getLong("evidenceId"));
    map.put("evidenceType", defaultString(rs.getString("evidenceType")));
    map.put("leadId", rs.getLong("leadId"));
    map.put("matchedKeywords", parseJsonArray(rs.getString("matchedKeywords"), false));
    map.put("matchedSentences", parseJsonArray(rs.getString("matchedSentences"), false));
    map.put("publishedAt", toIso(safeTimestamp(rs, "publishedAt")));
    map.put("rawText", rs.getString("rawText"));
    map.put("scoreDelta", rs.getInt("scoreDelta"));
    map.put("sourceLink", defaultString(rs.getString("sourceLink")));
    map.put("sourceTitle", defaultString(rs.getString("sourceTitle")));
    return map;
  }

  private Map<String, Object> enterpriseProfileMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("address", rs.getString("address"));
    map.put("businessScope", rs.getString("businessScope"));
    map.put("companyName", defaultString(rs.getString("companyName")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("employeeScale", rs.getString("employeeScale"));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("industryName", rs.getString("industryName"));
    map.put("industryTags", parseJsonArray(rs.getString("industryTagsJson"), false));
    map.put("lastSignalTime", toIso(safeTimestamp(rs, "lastSignalTime")));
    map.put("latestIntentType", rs.getString("latestIntentType"));
    map.put("profileCompleteness", rs.getInt("profileCompleteness"));
    map.put("profileId", rs.getLong("profileId"));
    map.put("regionCity", rs.getString("regionCity"));
    map.put("regionDistrict", rs.getString("regionDistrict"));
    map.put("regionProvince", rs.getString("regionProvince"));
    map.put("registeredCapital", numericObject(rs.getObject("registeredCapital")));
    map.put("signalCount", rs.getInt("signalCount"));
    map.put("unifiedSocialCreditCode", rs.getString("unifiedSocialCreditCode"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> enterpriseProfileSignalMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("companyName", defaultString(rs.getString("companyName")));
    map.put("confidenceScore", rs.getInt("confidenceScore"));
    map.put("eventId", rs.getLong("eventId"));
    map.put("eventSummary", rs.getString("eventSummary"));
    map.put("eventTime", toIso(safeTimestamp(rs, "eventTime")));
    map.put("eventTitle", defaultString(rs.getString("eventTitle")));
    map.put("eventType", defaultString(rs.getString("eventType"), "UNKNOWN"));
    map.put("relatedExternalLeadId", nullableLong(rs, "relatedExternalLeadId"));
    map.put("relatedRadarLeadId", nullableLong(rs, "relatedRadarLeadId"));
    map.put("sourceName", defaultString(rs.getString("sourceName")));
    map.put("sourceType", defaultString(rs.getString("sourceType")));
    map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
    map.put("status", defaultString(rs.getString("status"), "NEW"));
    return map;
  }

  private Map<String, Object> enterpriseProfileTagMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("companyName", defaultString(rs.getString("companyName")));
    map.put("confidenceScore", rs.getInt("confidenceScore"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("tagId", rs.getLong("tagId"));
    map.put("tagName", defaultString(rs.getString("tagName")));
    map.put("tagSource", defaultString(rs.getString("tagSource")));
    map.put("tagType", defaultString(rs.getString("tagType")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> publicOpportunityMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("areaSqm", numericObject(rs.getObject("areaSqm")));
    map.put("areaText", nullableString(rs.getString("areaText")));
    map.put("city", nullableString(rs.getString("city")));
    map.put("contactName", nullableString(rs.getString("contactName")));
    map.put("description", nullableString(rs.getString("description")));
    map.put("detailJson", parseJsonObject(rs.getString("detailJson")));
    map.put("district", nullableString(rs.getString("district")));
    map.put("effectiveUntil", toIso(safeTimestamp(rs, "effectiveUntil")));
    map.put("hasDetailEvidence", booleanValue(rs.getObject("hasDetailEvidence")));
    map.put("industryText", nullableString(rs.getString("industryText")));
    map.put("isGuangdong", booleanValue(rs.getObject("isGuangdong")));
    map.put("lastSyncedAt", toIso(safeTimestamp(rs, "lastSyncedAt")));
    map.put("opportunityId", rs.getLong("opportunityId"));
    map.put("opportunityStatus", defaultString(rs.getString("opportunityStatus"), "UNKNOWN"));
    map.put("opportunityType", defaultString(rs.getString("opportunityType"), "UNKNOWN"));
    map.put("phoneNumber", nullableString(rs.getString("phoneNumber")));
    map.put("priceText", nullableString(rs.getString("priceText")));
    map.put("publishedAgeLabel", nullableString(rs.getString("publishedAgeLabel")));
    map.put("publishedAt", toIso(safeTimestamp(rs, "publishedAt")));
    map.put("publishedDateText", nullableString(rs.getString("publishedDateText")));
    map.put("qualityGrade", nullableString(rs.getString("qualityGrade")));
    map.put("score", numericObject(rs.getObject("score")));
    map.put("sourceCode", nullableString(rs.getString("sourceCode")));
    map.put("sourceId", nullableLong(rs, "sourceId"));
    map.put("sourceSite", nullableString(rs.getString("sourceSite")));
    map.put("sourceTable", nullableString(rs.getString("sourceTable")));
    map.put("sourceUrl", defaultString(rs.getString("sourceUrl")));
    map.put("tagsJson", parseJsonArray(rs.getString("tagsJson"), false));
    map.put("title", nullableString(rs.getString("title")));
    return map;
  }

  private Map<String, Object> publicOpportunityAuditCountsMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = emptyPublicOpportunityAuditCounts();
    map.replace("guangdongValidCount", rs.getLong("guangdongValidCount"));
    map.replace("invalidCount", rs.getLong("invalidCount"));
    map.replace("missingHashOrDetailEvidenceCount", rs.getLong("missingHashOrDetailEvidenceCount"));
    map.replace("missingPublishedAtCount", rs.getLong("missingPublishedAtCount"));
    map.replace("missingSourceUrlCount", rs.getLong("missingSourceUrlCount"));
    map.replace("missingSupplyLocationCount", rs.getLong("missingSupplyLocationCount"));
    map.replace("nonGuangdongCount", rs.getLong("nonGuangdongCount"));
    map.replace("outOfScopeCount", rs.getLong("outOfScopeCount"));
    map.replace("proposedDowngradeCount", rs.getLong("proposedDowngradeCount"));
    map.replace("sourceLostCount", rs.getLong("sourceLostCount"));
    map.replace("suspiciousPublishedAtCount", rs.getLong("suspiciousPublishedAtCount"));
    map.replace("totalCount", rs.getLong("totalCount"));
    map.replace("unknownTimeCount", rs.getLong("unknownTimeCount"));
    return map;
  }

  private Map<String, Object> publicOpportunityAuditPreviewMap(ResultSet rs)
      throws SQLException {
    boolean isGuangdong = booleanValue(rs.getObject("isGuangdong"));
    boolean missingSourceUrl = booleanValue(rs.getObject("missingSourceUrl"));
    boolean missingPublishedAt = booleanValue(rs.getObject("missingPublishedAt"));
    boolean suspiciousPublishedAt = booleanValue(rs.getObject("suspiciousPublishedAt"));
    boolean missingHashOrDetailEvidence = booleanValue(rs.getObject("missingHashOrDetailEvidence"));
    boolean missingSupplyLocation = booleanValue(rs.getObject("missingSupplyLocation"));
    List<String> reasons = new ArrayList<>();
    if (!isGuangdong) {
      reasons.add("未识别为广东数据");
    }
    if (missingSourceUrl) {
      reasons.add("缺少可追溯 HTTP(S) 来源链接");
    }
    if (missingPublishedAt) {
      reasons.add("缺少发布时间");
    }
    if (suspiciousPublishedAt) {
      reasons.add("发布时间疑似异常");
    }
    if (missingHashOrDetailEvidence) {
      reasons.add("缺少 hash 或详情证据");
    }
    if (missingSupplyLocation) {
      reasons.add("缺少或未确认广东 21 城城市/房源区域");
    }
    Map<String, Object> flags = new LinkedHashMap<>();
    flags.put("missingHashOrDetailEvidence", missingHashOrDetailEvidence);
    flags.put("missingPublishedAt", missingPublishedAt);
    flags.put("missingSourceUrl", missingSourceUrl);
    flags.put("missingSupplyLocation", missingSupplyLocation);
    flags.put("nonGuangdong", !isGuangdong);
    flags.put("suspiciousPublishedAt", suspiciousPublishedAt);

    String opportunityType = defaultString(rs.getString("opportunityType"), "UNKNOWN");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("areaText", nullableString(rs.getString("areaText")));
    map.put("city", nullableString(rs.getString("city")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("descriptionPreview", nullableString(rs.getString("descriptionPreview")));
    map.put("detailJsonPreview", nullableString(rs.getString("detailJsonPreview")));
    map.put("district", nullableString(rs.getString("district")));
    map.put("issueFlags", flags);
    map.put("issueReasons", reasons);
    map.put("lastSyncedAt", toIso(safeTimestamp(rs, "lastSyncedAt")));
    map.put("opportunityId", rs.getLong("opportunityId"));
    map.put("opportunityStatus", nullableString(rs.getString("opportunityStatus")));
    map.put("opportunityType", opportunityType);
    map.put("opportunityTypeLabel", opportunityTypeLabel(opportunityType));
    map.put("proposedDowngradeStatus", nullableString(rs.getString("proposedDowngradeStatus")));
    map.put("publishedAt", toIso(safeTimestamp(rs, "publishedAt")));
    map.put("publishedDateText", nullableString(rs.getString("publishedDateText")));
    map.put("score", numericObject(rs.getObject("score")));
    map.put("sourceId", stringObject(rs.getObject("sourceId")));
    map.put("sourceKey", null);
    map.put("sourceSite", nullableString(rs.getString("sourceSite")));
    map.put("sourceTable", nullableString(rs.getString("sourceTable")));
    map.put("sourceUrl", nullableString(rs.getString("sourceUrl")));
    map.put("title", nullableString(rs.getString("title")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> propertyMatchMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("address", rs.getString("address"));
    map.put("availableArea", numericObject(rs.getObject("availableArea")));
    map.put("factoryId", rs.getLong("factoryId"));
    map.put("factoryName", defaultString(rs.getString("factoryName"), "未命名房源"));
    map.put("floorCount", nullableInteger(rs, "floorCount"));
    map.put("matchReasons", parseJsonArray(rs.getString("matchReasonsJson"), false));
    map.put("matchScore", rs.getInt("matchScore"));
    map.put("mismatchReminders", parseJsonArray(rs.getString("mismatchRemindersJson"), false));
    map.put("parkId", nullableLong(rs, "parkId"));
    map.put("parkName", rs.getString("parkName"));
    map.put("rentPrice", numericObject(rs.getObject("rentPrice")));
    map.put("rentPriceText", rs.getString("rentPriceText"));
    map.put("salesPitch", defaultString(rs.getString("salesPitch")));
    map.put("tag", rs.getString("tag"));
    map.put("title", rs.getString("factoryName"));
    map.put("totalArea", numericObject(rs.getObject("totalArea")));
    map.put("usedArea", numericObject(rs.getObject("usedArea")));
    return map;
  }

  private Map<String, Object> outreachTemplateMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("approvalStatus", defaultString(rs.getString("approvalStatus"), "APPROVED"));
    map.put("channel", defaultString(rs.getString("channel")));
    map.put("content", defaultString(rs.getString("content")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enabled", booleanValue(rs.getObject("enabled")));
    map.put("placeholderJson", parseJsonArray(rs.getString("placeholderJson"), false));
    map.put("priorityLevel", defaultString(rs.getString("priorityLevel")));
    map.put("taskType", defaultString(rs.getString("taskType")));
    map.put("templateCode", defaultString(rs.getString("templateCode")));
    map.put("templateId", rs.getLong("templateId"));
    map.put("templateName", defaultString(rs.getString("templateName")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    map.put("versionNo", rs.getInt("versionNo"));
    return map;
  }

  private Map<String, Object> outreachTemplateVersionMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = outreachTemplateMap(rs);
    map.put("changeType", defaultString(rs.getString("changeType")));
    map.put("versionId", rs.getLong("versionId"));
    return map;
  }

  private Map<String, Object> outreachTemplateStatsMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("failedTasks", rs.getLong("failedTasks"));
    map.put("negativeReplies", rs.getLong("negativeReplies"));
    map.put("positiveReplies", rs.getLong("positiveReplies"));
    map.put("sentTasks", rs.getLong("sentTasks"));
    map.put("templateCode", defaultString(rs.getString("templateCode")));
    map.put("templateId", rs.getLong("templateId"));
    map.put("templateName", defaultString(rs.getString("templateName")));
    map.put("totalTasks", rs.getLong("totalTasks"));
    return map;
  }

  private Map<String, Object> outreachTaskListMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    appendOutreachTaskBase(map, rs);
    map.put("contactName", rs.getString("contactName"));
    map.put("enterpriseName", defaultString(rs.getString("enterpriseName"), "-"));
    map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
    map.put("latestSignalType", rs.getString("latestSignalType"));
    map.put("parkName", rs.getString("parkName"));
    map.put("priorityLevel", rs.getString("priorityLevel"));
    map.put("stage", rs.getString("stage"));
    map.put("totalScore", rs.getInt("totalScore"));
    return map;
  }

  private Map<String, Object> outreachTaskDetailMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    appendOutreachTaskBase(map, rs);
    map.put("address", rs.getString("address"));
    map.put("city", rs.getString("city"));
    map.put("contactName", rs.getString("contactName"));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("enterpriseName", defaultString(rs.getString("enterpriseName"), "-"));
    map.put("industryName", rs.getString("industryName"));
    map.put("intentArea", numericObject(rs.getObject("intentArea")));
    map.put("intentScore", rs.getInt("intentScore"));
    map.put("invalidReason", rs.getString("invalidReason"));
    map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
    map.put("latestSignalTime", toIso(safeTimestamp(rs, "latestSignalTime")));
    map.put("leadSource", rs.getString("leadSource"));
    map.put("matchScore", rs.getInt("matchScore"));
    map.put("ownerName", rs.getString("ownerName"));
    map.put("ownerUserId", nullableInteger(rs, "ownerUserId"));
    map.put("parkId", nullableInteger(rs, "parkId"));
    map.put("parkName", rs.getString("parkName"));
    map.put("priorityLevel", rs.getString("priorityLevel"));
    map.put("reachableScore", rs.getInt("reachableScore"));
    map.put("registerCapital", numericObject(rs.getObject("registerCapital")));
    map.put("sourceFirst", rs.getString("sourceFirst"));
    map.put("sourceLatest", rs.getString("sourceLatest"));
    map.put("stage", rs.getString("stage"));
    map.put("totalScore", rs.getInt("totalScore"));
    map.put("unifiedSocialCreditCode", rs.getString("unifiedSocialCreditCode"));
    return map;
  }

  private void appendOutreachTaskBase(Map<String, Object> map, ResultSet rs) throws SQLException {
    map.put("channel", defaultString(rs.getString("channel")));
    map.put("content", rs.getString("content"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("leadId", rs.getLong("leadId"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("providerResponseJson", parseJsonObject(rs.getString("providerResponseJson")));
    map.put("providerTaskId", rs.getString("providerTaskId"));
    map.put("replyContent", rs.getString("replyContent"));
    map.put("replyStatus", defaultString(rs.getString("replyStatus")));
    map.put("replyTime", toIso(safeTimestamp(rs, "replyTime")));
    map.put("resultCode", rs.getString("resultCode"));
    map.put("resultMessage", rs.getString("resultMessage"));
    map.put("scheduledAt", toIso(safeTimestamp(rs, "scheduledAt")));
    map.put("sentAt", toIso(safeTimestamp(rs, "sentAt")));
    map.put("sentByName", rs.getString("sentByName"));
    map.put("status", defaultString(rs.getString("status")));
    map.put("taskId", rs.getLong("taskId"));
    map.put("taskType", defaultString(rs.getString("taskType")));
    map.put("templateCode", defaultString(rs.getString("templateCode")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
  }

  private Map<String, Object> radarFunnelMap(ResultSet rs) throws SQLException {
    long totalLeads = rs.getLong("totalLeads");
    long contactedLeads = rs.getLong("contactedLeads");
    long repliedLeads = rs.getLong("repliedLeads");
    long visitLeads = rs.getLong("visitLeads");
    long dealLeads = rs.getLong("dealLeads");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("activeLeads", rs.getLong("activeLeads"));
    map.put("contactedLeads", contactedLeads);
    map.put("contactRate", rate(contactedLeads, totalLeads));
    map.put("dealLeads", dealLeads);
    map.put("dealRate", rate(dealLeads, Math.max(visitLeads, 1)));
    map.put("highPriorityLeads", rs.getLong("highPriorityLeads"));
    map.put("repliedLeads", repliedLeads);
    map.put("replyRate", rate(repliedLeads, Math.max(contactedLeads, 1)));
    map.put("totalLeads", totalLeads);
    map.put("visitLeads", visitLeads);
    map.put("visitRate", rate(visitLeads, Math.max(repliedLeads, 1)));
    return map;
  }

  private Map<String, Object> radarSalesFunnelMap(ResultSet rs) throws SQLException {
    long totalLeads = rs.getLong("totalLeads");
    long contactedLeads = rs.getLong("contactedLeads");
    long repliedLeads = rs.getLong("repliedLeads");
    long visitLeads = rs.getLong("visitLeads");
    long dealLeads = rs.getLong("dealLeads");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("assignedLeads", rs.getLong("assignedLeads"));
    map.put("contactedLeads", contactedLeads);
    map.put("contactRate", rate(contactedLeads, totalLeads));
    map.put("dealLeads", dealLeads);
    map.put("dealRate", rate(dealLeads, totalLeads));
    map.put("newLeads", rs.getLong("newLeads"));
    map.put("repliedLeads", repliedLeads);
    map.put("replyRate", rate(repliedLeads, contactedLeads));
    map.put("visitLeads", visitLeads);
    map.put("visitRate", rate(visitLeads, repliedLeads));
    return map;
  }

  private Map<String, Object> radarRoiStatsMap(ResultSet rs) throws SQLException {
    String channel = defaultString(rs.getString("channel"), "UNKNOWN");
    long sentTasks = rs.getLong("sentTasks");
    long dealLeads = rs.getLong("dealLeads");
    double estimatedCost = Math.round(sentTasks * channelCost(channel) * 100.0) / 100.0;
    long estimatedRevenue = dealLeads * 10_000L;
    double roi =
        estimatedCost > 0 ? Math.round(((estimatedRevenue - estimatedCost) / estimatedCost) * 100.0) / 100.0 : 0;
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("channel", channel);
    map.put("dealLeads", dealLeads);
    map.put("estimatedCost", estimatedCost);
    map.put("estimatedRevenue", estimatedRevenue);
    map.put("roi", roi);
    map.put("sentTasks", sentTasks);
    return map;
  }

  private Map<String, Object> radarTemplateConversionMap(ResultSet rs) throws SQLException {
    long totalTasks = rs.getLong("totalTasks");
    long sentTasks = rs.getLong("sentTasks");
    long repliedTasks = rs.getLong("repliedTasks");
    long positiveReplies = rs.getLong("positiveReplies");
    long visitLeads = rs.getLong("visitLeads");
    long dealLeads = rs.getLong("dealLeads");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("dealLeads", dealLeads);
    map.put("dealRate", rate(dealLeads, sentTasks));
    map.put("positiveRate", rate(positiveReplies, repliedTasks));
    map.put("positiveReplies", positiveReplies);
    map.put("repliedTasks", repliedTasks);
    map.put("replyRate", rate(repliedTasks, sentTasks == 0 ? totalTasks : sentTasks));
    map.put("sentTasks", sentTasks);
    map.put("templateCode", defaultString(rs.getString("templateCode"), "UNSET"));
    map.put("templateId", nullableLong(rs, "templateId"));
    map.put("templateName", defaultString(rs.getString("templateName"), "未设置话术"));
    map.put("totalTasks", totalTasks);
    map.put("visitLeads", visitLeads);
    map.put("visitRate", rate(visitLeads, sentTasks));
    return map;
  }

  private Map<String, Object> radarSourceStatsMap(ResultSet rs) throws SQLException {
    long totalLeads = rs.getLong("totalLeads");
    long convertedLeads = rs.getLong("convertedLeads");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("conversionRate", rate(convertedLeads, totalLeads));
    map.put("convertedLeads", convertedLeads);
    map.put("evidenceCount", rs.getLong("evidenceCount"));
    map.put("highConfidenceLeads", rs.getLong("highConfidenceLeads"));
    map.put("sourceName", defaultString(rs.getString("sourceName"), "未知来源"));
    map.put("sourceType", defaultString(rs.getString("sourceType"), "PUBLIC"));
    map.put("totalLeads", totalLeads);
    return map;
  }

  private Map<String, Object> radarSignalTypeStatsMap(ResultSet rs) throws SQLException {
    long radarLeads = rs.getLong("radarLeads");
    long contactedLeads = rs.getLong("contactedLeads");
    long visitLeads = rs.getLong("visitLeads");
    long dealLeads = rs.getLong("dealLeads");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("contactedLeads", contactedLeads);
    map.put("contactRate", rate(contactedLeads, radarLeads));
    map.put("convertedEvents", rs.getLong("convertedEvents"));
    map.put("dealLeads", dealLeads);
    map.put("dealRate", rate(dealLeads, radarLeads));
    map.put("eventType", defaultString(rs.getString("eventType"), "UNKNOWN"));
    map.put("radarLeads", radarLeads);
    map.put("totalEvents", rs.getLong("totalEvents"));
    map.put("visitLeads", visitLeads);
    map.put("visitRate", rate(visitLeads, radarLeads));
    return map;
  }

  private Map<String, Object> radarChannelStatsMap(ResultSet rs) throws SQLException {
    long totalTasks = rs.getLong("totalTasks");
    long sentTasks = rs.getLong("sentTasks");
    long repliedTasks = rs.getLong("repliedTasks");
    long positiveReplies = rs.getLong("positiveReplies");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("channel", defaultString(rs.getString("channel"), "未知渠道"));
    map.put("positiveRate", rate(positiveReplies, repliedTasks));
    map.put("positiveReplies", positiveReplies);
    map.put("repliedTasks", repliedTasks);
    map.put("replyRate", rate(repliedTasks, sentTasks == 0 ? totalTasks : sentTasks));
    map.put("sentTasks", sentTasks);
    map.put("totalTasks", totalTasks);
    return map;
  }

  private Map<String, Object> radarTemplateStatsMap(ResultSet rs) throws SQLException {
    long totalTasks = rs.getLong("totalTasks");
    long repliedTasks = rs.getLong("repliedTasks");
    long positiveReplies = rs.getLong("positiveReplies");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("positiveRate", rate(positiveReplies, repliedTasks));
    map.put("positiveReplies", positiveReplies);
    map.put("repliedTasks", repliedTasks);
    map.put("replyRate", rate(repliedTasks, totalTasks));
    map.put("templateCode", defaultString(rs.getString("templateCode"), "unknown"));
    map.put("templateName", defaultString(rs.getString("templateName"), "未设置话术"));
    map.put("totalTasks", totalTasks);
    return map;
  }

  private Map<String, Object> radarSalesStatsMap(ResultSet rs) throws SQLException {
    long totalLeads = rs.getLong("totalLeads");
    long contactedLeads = rs.getLong("contactedLeads");
    long dealLeads = rs.getLong("dealLeads");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("contactedLeads", contactedLeads);
    map.put("contactRate", rate(contactedLeads, totalLeads));
    map.put("dealLeads", dealLeads);
    map.put("dealRate", rate(dealLeads, totalLeads));
    map.put("firstContactAvgHours", round1(rs.getObject("firstContactAvgHours")));
    map.put("followCount", rs.getLong("followCount"));
    map.put("ownerName", defaultString(rs.getString("ownerName"), "未分配"));
    map.put("ownerUserId", nullableLong(rs, "ownerUserId"));
    map.put("totalLeads", totalLeads);
    map.put("visitCount", rs.getLong("visitCount"));
    return map;
  }

  private Map<String, Object> radarLeadListMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("enterpriseName", defaultString(rs.getString("enterpriseName"), "-"));
    map.put("intentArea", numericObject(rs.getObject("intentArea")));
    map.put("intentScore", rs.getInt("intentScore"));
    map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
    map.put("latestSignalTime", toIso(safeTimestamp(rs, "latestSignalTime")));
    map.put("latestSignalType", rs.getString("latestSignalType"));
    map.put("leadId", rs.getLong("leadId"));
    map.put("leadSource", defaultString(rs.getString("leadSource")));
    map.put("matchScore", rs.getInt("matchScore"));
    map.put("ownerName", rs.getString("ownerName"));
    map.put("parkName", rs.getString("parkName"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("priorityLevel", defaultString(rs.getString("priorityLevel")));
    map.put("reachableScore", rs.getInt("reachableScore"));
    map.put("stage", defaultString(rs.getString("stage")));
    map.put("totalScore", rs.getInt("totalScore"));
    return map;
  }

  private Map<String, Object> radarLeadDetailMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("address", rs.getString("address"));
    map.put("city", rs.getString("city"));
    map.put("contactName", rs.getString("contactName"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("enterpriseName", defaultString(rs.getString("enterpriseName"), "-"));
    map.put("industryName", rs.getString("industryName"));
    map.put("intentArea", numericObject(rs.getObject("intentArea")));
    map.put("intentScore", rs.getInt("intentScore"));
    map.put("invalidReason", rs.getString("invalidReason"));
    map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
    map.put("latestSignalTime", toIso(safeTimestamp(rs, "latestSignalTime")));
    map.put("latestTaskId", rs.getString("latestTaskId"));
    map.put("leadId", rs.getLong("leadId"));
    map.put("leadSource", defaultString(rs.getString("leadSource")));
    map.put("matchScore", rs.getInt("matchScore"));
    map.put("ownerName", rs.getString("ownerName"));
    map.put("ownerUserId", nullableInteger(rs, "ownerUserId"));
    map.put("parkId", nullableLong(rs, "parkId"));
    map.put("parkName", rs.getString("parkName"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("priorityLevel", defaultString(rs.getString("priorityLevel")));
    map.put("reachableScore", rs.getInt("reachableScore"));
    map.put("registerCapital", numericObject(rs.getObject("registerCapital")));
    map.put("sourceFirst", rs.getString("sourceFirst"));
    map.put("sourceLatest", rs.getString("sourceLatest"));
    map.put("stage", defaultString(rs.getString("stage")));
    map.put("totalScore", rs.getInt("totalScore"));
    map.put("unifiedSocialCreditCode", rs.getString("unifiedSocialCreditCode"));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> radarLeadOutreachSuggestionSeedMap(ResultSet rs)
      throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("city", rs.getString("city"));
    map.put("companyName", rs.getString("companyName"));
    map.put("contactName", rs.getString("contactName"));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("industryName", rs.getString("industryName"));
    map.put("intentArea", numericObject(rs.getObject("intentArea")));
    map.put("invalidReason", rs.getString("invalidReason"));
    map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
    map.put("leadId", rs.getLong("leadId"));
    map.put("parkName", rs.getString("parkName"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("priorityLevel", defaultString(rs.getString("priorityLevel"), "C"));
    map.put("stage", defaultString(rs.getString("stage")));
    map.put("totalScore", rs.getInt("totalScore"));
    return map;
  }

  private Map<String, Object> radarCollectTaskMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("completedAt", toIso(safeTimestamp(rs, "completedAt")));
    map.put("created", rs.getInt("created"));
    map.put("durationMs", nullableInteger(rs, "durationMs"));
    map.put("errorReason", rs.getString("errorReason"));
    map.put("skipped", rs.getInt("skipped"));
    map.put("startedAt", toIso(safeTimestamp(rs, "startedAt")));
    map.put("status", defaultString(rs.getString("status")));
    map.put("taskId", rs.getString("taskId"));
    map.put("total", rs.getInt("total"));
    map.put("updated", rs.getInt("updated"));
    return map;
  }

  private Map<String, Object> radarLeadOutreachTaskMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("channel", defaultString(rs.getString("channel")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("replyContent", rs.getString("replyContent"));
    map.put("replyStatus", defaultString(rs.getString("replyStatus")));
    map.put("replyTime", toIso(safeTimestamp(rs, "replyTime")));
    map.put("resultCode", rs.getString("resultCode"));
    map.put("resultMessage", rs.getString("resultMessage"));
    map.put("scheduledAt", toIso(safeTimestamp(rs, "scheduledAt")));
    map.put("sentAt", toIso(safeTimestamp(rs, "sentAt")));
    map.put("sentByName", rs.getString("sentByName"));
    map.put("status", defaultString(rs.getString("status")));
    map.put("taskId", rs.getLong("taskId"));
    map.put("taskType", defaultString(rs.getString("taskType")));
    map.put("templateCode", defaultString(rs.getString("templateCode")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> radarLeadNavigationMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("enterpriseName", defaultString(rs.getString("enterpriseName"), "-"));
    map.put("leadId", rs.getLong("leadId"));
    map.put("stage", defaultString(rs.getString("stage")));
    map.put("totalScore", rs.getInt("totalScore"));
    return map;
  }

  private Map<String, Object> radarLeadScoreBreakdownMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("breakdownId", rs.getLong("breakdownId"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("eventId", nullableLong(rs, "eventId"));
    map.put("eventTitle", rs.getString("eventTitle"));
    map.put("eventType", rs.getString("eventType"));
    map.put("leadId", rs.getLong("leadId"));
    map.put("reason", defaultString(rs.getString("reason")));
    map.put("ruleCode", defaultString(rs.getString("ruleCode")));
    map.put("ruleId", rs.getLong("ruleId"));
    map.put("ruleName", defaultString(rs.getString("ruleName")));
    map.put("scoreDelta", rs.getInt("scoreDelta"));
    return map;
  }

  private Map<String, Object> radarSopReminderMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = radarSopReminderBaseMap(rs);
    String storedStatus = defaultString(rs.getString("reminderStatus"));
    Timestamp dueTime = safeTimestamp(rs, "dueTime");
    if ("PENDING".equals(storedStatus)
        && dueTime != null
        && dueTime.toInstant().isBefore(Instant.now())) {
      map.put("reminderStatus", "OVERDUE");
    }
    map.put("contactName", rs.getString("contactName"));
    map.put("enterpriseName", defaultString(rs.getString("enterpriseName"), "-"));
    map.put("latestContactTime", toIso(safeTimestamp(rs, "latestContactTime")));
    map.put("ownerName", rs.getString("ownerName"));
    map.put("parkName", rs.getString("parkName"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("priorityLevel", defaultString(rs.getString("priorityLevel")));
    map.put("stage", defaultString(rs.getString("stage")));
    map.put("totalScore", rs.getInt("totalScore"));
    return map;
  }

  private Map<String, Object> radarSopReminderBaseMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("description", rs.getString("description"));
    map.put("dueTime", toIso(safeTimestamp(rs, "dueTime")));
    map.put("handledTime", toIso(safeTimestamp(rs, "handledTime")));
    map.put("leadId", safeLong(rs, "leadId"));
    map.put("reminderId", rs.getLong("reminderId"));
    map.put("reminderStatus", defaultString(rs.getString("reminderStatus")));
    map.put("reminderType", defaultString(rs.getString("reminderType")));
    map.put("title", defaultString(rs.getString("title")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> radarFollowRecordMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("content", rs.getString("content"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("followResult", defaultString(rs.getString("followResult")));
    map.put("followType", defaultString(rs.getString("followType")));
    map.put("nextAction", rs.getString("nextAction"));
    map.put("nextFollowTime", toIso(safeTimestamp(rs, "nextFollowTime")));
    map.put("operatorName", rs.getString("operatorName"));
    map.put("recordId", rs.getLong("recordId"));
    return map;
  }

  private Map<String, Object> radarVisitRecordMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("actualTime", toIso(safeTimestamp(rs, "actualTime")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("factoryFloorId", nullableLong(rs, "factoryFloorId"));
    map.put("feedback", rs.getString("feedback"));
    map.put("operatorName", rs.getString("operatorName"));
    map.put("scheduledTime", toIso(safeTimestamp(rs, "scheduledTime")));
    map.put("visitId", rs.getLong("visitId"));
    map.put("visitStatus", defaultString(rs.getString("visitStatus")));
    map.put("visitorName", rs.getString("visitorName"));
    map.put("visitorPhone", rs.getString("visitorPhone"));
    return map;
  }

  private Map<String, Object> contactRestrictionMap(ResultSet rs) throws SQLException {
    String status = defaultString(rs.getString("status"));
    String releaseStatus = rs.getString("releaseStatus");
    if ("ACTIVE".equals(status) && "PENDING".equals(releaseStatus)) {
      status = "RELEASE_PENDING";
    } else if ("ACTIVE".equals(status) && "REJECTED".equals(releaseStatus)) {
      status = "RELEASE_REJECTED";
    }
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("contactName", rs.getString("contactName"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("enterpriseName", rs.getString("enterpriseName"));
    map.put("leadId", nullableLong(rs, "leadId"));
    map.put("parkName", rs.getString("parkName"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("reason", rs.getString("reason"));
    map.put("releaseReason", rs.getString("releaseReason"));
    map.put("releaseRequestTime", toIso(safeTimestamp(rs, "releaseRequestTime")));
    map.put("releaseReviewTime", toIso(safeTimestamp(rs, "releaseReviewTime")));
    map.put("releaseReviewerId", nullableLong(rs, "releaseReviewerId"));
    map.put("releaseStatus", releaseStatus);
    map.put("restrictionId", rs.getLong("restrictionId"));
    map.put("restrictionType", defaultString(rs.getString("restrictionType")));
    map.put("status", status);
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> contactRestrictionAuditMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("action", defaultString(rs.getString("action")));
    map.put("actorId", nullableLong(rs, "actorId"));
    map.put("actorName", rs.getString("actorName"));
    map.put("afterJson", parseJsonObject(rs.getString("afterJson")));
    map.put("auditId", rs.getLong("auditId"));
    map.put("beforeJson", parseJsonObject(rs.getString("beforeJson")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("remark", rs.getString("remark"));
    map.put("restrictionId", nullableLong(rs, "restrictionId"));
    map.put("restrictionType", rs.getString("restrictionType"));
    map.put("status", rs.getString("status"));
    return map;
  }

  private Map<String, Object> contactRestrictionSnapshotMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("enterpriseId", nullableLong(rs, "enterpriseId"));
    map.put("leadId", nullableLong(rs, "leadId"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("reason", rs.getString("reason"));
    map.put("releaseReason", rs.getString("releaseReason"));
    map.put("releaseRequestTime", toIso(safeTimestamp(rs, "releaseRequestTime")));
    map.put("releaseReviewTime", toIso(safeTimestamp(rs, "releaseReviewTime")));
    map.put("releaseReviewerId", nullableLong(rs, "releaseReviewerId"));
    map.put("releaseStatus", rs.getString("releaseStatus"));
    map.put("restrictionId", rs.getLong("restrictionId"));
    map.put("restrictionType", defaultString(rs.getString("restrictionType")));
    map.put("status", defaultString(rs.getString("status")));
    map.put("updateTime", toIso(safeTimestamp(rs, "updateTime")));
    return map;
  }

  private Map<String, Object> radarOperationAuditMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("action", defaultString(rs.getString("action")));
    map.put("actorId", nullableLong(rs, "actorId"));
    map.put("actorName", rs.getString("actorName"));
    map.put("auditId", rs.getLong("auditId"));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    map.put("detailJson", parseJsonObject(rs.getString("detailJson")));
    map.put("ipAddress", rs.getString("ipAddress"));
    map.put("objectId", rs.getString("objectId"));
    map.put("objectType", rs.getString("objectType"));
    map.put("requestPath", rs.getString("requestPath"));
    map.put("result", defaultString(rs.getString("result")));
    map.put("source", rs.getString("source"));
    return map;
  }

  private void createRadarOperationAudit(
      JdbcTemplate jdbcTemplate,
      String action,
      String objectType,
      String objectId,
      String result,
      Long actorId,
      String actorName,
      String source,
      String requestPath,
      Map<String, Object> detailJson) {
    if (!hasRadarOperationAuditColumns(jdbcTemplate)) {
      return;
    }
    jdbcTemplate.update(
        """
        INSERT INTO investment_radar_operation_audit_log (
          action, object_type, object_id, result, actor_id, actor_name,
          source, request_path, ip_address, detail_json, create_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NOW(3))
        """,
        action,
        objectType,
        objectId,
        result,
        actorId,
        actorName,
        source,
        requestPath,
        jsonString(detailJson == null ? Map.of() : detailJson));
  }

  private Map<String, Object> contactRestrictionSummaryMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("activeRestrictions", rs.getLong("activeRestrictions"));
    map.put("blacklistRestrictions", rs.getLong("blacklistRestrictions"));
    map.put("negativeReplyRestrictions", rs.getLong("negativeReplyRestrictions"));
    map.put("releasedRestrictions", rs.getLong("releasedRestrictions"));
    map.put("totalRestrictions", rs.getLong("totalRestrictions"));
    map.put("unsubscribedRestrictions", rs.getLong("unsubscribedRestrictions"));
    return map;
  }

  private Map<String, Object> emptyContactRestrictionSummary() {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("activeRestrictions", 0L);
    map.put("blacklistRestrictions", 0L);
    map.put("negativeReplyRestrictions", 0L);
    map.put("releasedRestrictions", 0L);
    map.put("totalRestrictions", 0L);
    map.put("unsubscribedRestrictions", 0L);
    return map;
  }

  private Object crawlerAllowedPaths(String sourceCode, String rawJson) {
    if ("PUBLIC_OPPORTUNITY_99CFW".equals(sourceCode)) {
      return PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS;
    }
    if (PUBLIC_FACTORY_CFZSW68_SOURCE_CODE.equals(sourceCode)) {
      return PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS;
    }
    return parseJsonArray(rawJson, true);
  }

  private Object crawlerRegionScope(String sourceCode, String rawJson) {
    if (PUBLIC_FACTORY_CFZSW68_SOURCE_CODE.equals(sourceCode)) {
      return List.of("深圳");
    }
    Object stored = parseJsonArray(rawJson, true);
    if (stored != null) {
      return stored;
    }
    return PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.contains(sourceCode) ? GUANGDONG_REGION_SCOPE : null;
  }

  private Map<String, Object> crawlerRequeueResult(int requeuedCount, long sourceId) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("requeuedCount", requeuedCount);
    result.put("sourceId", sourceId);
    result.put("status", "PENDING");
    return result;
  }

  private boolean hasInternalContractExpirySyncColumns(JdbcTemplate jdbcTemplate) {
    return hasColumns(
            jdbcTemplate,
            "rental_tenant",
            "rental_tenant_id",
            "tenant_name",
            "park_id",
            "phone_number",
            "area",
            "rent",
            "contract_start",
            "contract_end",
            "transaction_type",
            "is_deleted")
        && hasExternalLeadRebuildColumns(jdbcTemplate)
        && hasExternalLeadConvertColumns(jdbcTemplate);
  }

  private boolean hasRadarLeadImportColumns(JdbcTemplate jdbcTemplate) {
    return hasInvestmentEnterpriseColumns(jdbcTemplate) && hasRadarLeadInsertColumns(jdbcTemplate);
  }

  private boolean hasPropertyMatchRebuildColumns(JdbcTemplate jdbcTemplate) {
    return hasPropertyMatchResultColumns(jdbcTemplate)
        && hasRadarLeadDetailColumns(jdbcTemplate)
        && hasColumns(jdbcTemplate, "factory", "factory_id", "factory_name", "park_id", "address", "create_time", "is_deleted")
        && hasColumns(jdbcTemplate, "park", "park_id", "park_name")
        && hasColumns(jdbcTemplate, "investment_property_tag", "factory_id", "tags_json")
        && hasColumns(
            jdbcTemplate,
            "factory_floor",
            "floor_id",
            "factory_id",
            "total_area",
            "used_area",
            "rent_price",
            "floor_height",
            "load_bearing",
            "description",
            "status",
            "is_deleted");
  }

  private List<Map<String, Object>> findInternalContractExpiryTenants(
      JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("rt.is_deleted = 0");
    conditions.add("rt.transaction_type = TRUE");
    conditions.add("rt.contract_end >= CURDATE()");
    conditions.add("rt.contract_end <= DATE_ADD(CURDATE(), INTERVAL ? DAY)");
    args.add(INTERNAL_CONTRACT_EXPIRY_HORIZON_DAYS);
    if (authorizedParkIds != null && !authorizedParkIds.isEmpty()) {
      conditions.add("rt.park_id IN (" + placeholders(authorizedParkIds.size()) + ")");
      args.addAll(authorizedParkIds);
    }
    return jdbcTemplate.query(
        """
        SELECT
          rt.rental_tenant_id AS rentalTenantId,
          rt.tenant_name AS tenantName,
          rt.park_id AS parkId,
          rt.phone_number AS phoneNumber,
          rt.area,
          rt.rent,
          rt.contract_start AS contractStart,
          rt.contract_end AS contractEnd,
          p.park_name AS parkName
        FROM rental_tenant rt
        LEFT JOIN park p ON p.park_id = rt.park_id
        WHERE
        """
            + String.join(" AND ", conditions)
            + """

        ORDER BY rt.contract_end ASC, rt.rental_tenant_id ASC
        LIMIT 500
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("area", numericObject(rs.getObject("area")));
          map.put("contractEnd", safeTimestamp(rs, "contractEnd"));
          map.put("contractStart", safeTimestamp(rs, "contractStart"));
          map.put("parkId", nullableLong(rs, "parkId"));
          map.put("parkName", rs.getString("parkName"));
          map.put("phoneNumber", rs.getString("phoneNumber"));
          map.put("rent", numericObject(rs.getObject("rent")));
          map.put("rentalTenantId", rs.getLong("rentalTenantId"));
          map.put("tenantName", rs.getString("tenantName"));
          return map;
        },
        args.toArray());
  }

  private Map<String, Object> upsertInternalContractExpiryExternalLead(
      JdbcTemplate jdbcTemplate, Map<String, Object> tenant, Map<String, Object> source) {
    long rentalTenantId = longValue(tenant.get("rentalTenantId"));
    String tenantName = requiredText(stringObject(tenant.get("tenantName")), "租户名称不能为空", 200);
    Timestamp contractEnd = (Timestamp) tenant.get("contractEnd");
    String sourceUrl = "internal://rental-tenant/" + rentalTenantId + "/contract-expiry";
    int daysLeft =
        contractEnd == null
            ? INTERNAL_CONTRACT_EXPIRY_HORIZON_DAYS
            : daysBetween(Instant.now(), contractEnd.toInstant());
    int confidenceScore = internalContractConfidenceScore(daysLeft);
    String summary =
        List.of(
                tenantName
                    + " 合同将于 "
                    + (contractEnd == null ? "-" : contractEnd.toLocalDateTime().toLocalDate())
                    + " 到期",
                StringUtils.hasText(stringObject(tenant.get("parkName"))) ? "所属园区：" + tenant.get("parkName") : "",
                tenant.get("area") == null ? "" : "租赁面积：" + tenant.get("area") + "m²",
                tenant.get("rent") == null ? "" : "租金：" + tenant.get("rent"))
            .stream()
            .filter(StringUtils::hasText)
            .collect(Collectors.joining("；"));
    ExternalLeadBuildResult buildResult =
        new ExternalLeadBuildResult(
            tenantName,
            confidenceScore,
            "RENT_FACTORY",
            summary,
            List.of("合同到期", "续租", "退租", "搬迁", "扩租"),
            new PublicOpportunityLeadSource(
                tenant.get("area"),
                tenant.get("area") == null ? null : tenant.get("area") + "m²",
                null,
                tenantName,
                summary,
                jsonString(Map.of("rentalTenantId", rentalTenantId, "source", "internal-contract-expiry")),
                null,
                null,
                rentalTenantId,
                "DEMAND",
                stringObject(tenant.get("phoneNumber")),
                null,
                contractEnd,
                defaultString(stringObject(source == null ? null : source.get("sourceName")), "Internal contract expiry signal"),
                "rental_tenant",
                sourceUrl,
                jsonString(List.of("合同到期", "内部租户")),
                tenantName + " 合同到期提醒",
                Timestamp.from(Instant.now())),
            null,
            summary);
    return upsertExternalLeadFromPublicOpportunity(jdbcTemplate, buildResult, "INTERNAL_CONTRACT");
  }

  private RadarLeadImportItem normalizeRadarLeadImportItem(Map<String, Object> raw) {
    String enterpriseName =
        requiredText(
            firstImportText(raw, "enterpriseName", "companyName", "tenantName", "企业名称", "公司名称", "客户名称"),
            "企业名称不能为空",
            200);
    int intentScore = clampScore(Math.round(importNumber(raw, 60, "intentScore", "意图分", "意向分")));
    int matchScore = clampScore(Math.round(importNumber(raw, 0, "matchScore", "匹配分", "房源匹配分")));
    int reachableScore = clampScore(Math.round(importNumber(raw, 40, "reachableScore", "可触达分", "触达分")));
    Object totalScoreValue = firstImportValue(raw, "totalScore", "总分");
    int totalScore =
        clampScore(
            Math.round(
                totalScoreValue == null
                    ? intentScore * 0.6 + matchScore * 0.25 + reachableScore * 0.15
                    : importNumber(raw, 0, "totalScore", "总分")));
    String stageText = cleanText(firstImportText(raw, "stage", "阶段", "当前阶段"));
    boolean stageExplicit = StringUtils.hasText(stageText);
    return new RadarLeadImportItem(
        cleanTextMax(firstImportText(raw, "address", "地址"), 500),
        cleanTextMax(firstImportText(raw, "city", "regionCity", "城市", "所在城市"), 100),
        cleanTextMax(firstImportText(raw, "contactName", "contact", "联系人"), 100),
        enterpriseName,
        cleanTextMax(firstImportText(raw, "industryName", "industry", "行业"), 100),
        bigDecimalOrNull(firstImportValue(raw, "intentArea", "area", "需求面积", "意向面积")),
        intentScore,
        defaultString(cleanText(firstImportText(raw, "leadSource", "source", "来源")), "MANUAL_IMPORT"),
        matchScore,
        nullableLongObject(firstImportValue(raw, "ownerUserId", "负责人ID")),
        nullableLongObject(firstImportValue(raw, "parkId", "园区ID")),
        cleanTextMax(firstImportText(raw, "phoneNumber", "phone", "mobile", "联系电话", "电话", "手机号"), 50),
        normalizeRadarPriorityLevel(firstImportText(raw, "priorityLevel", "优先级"), totalScore),
        reachableScore,
        bigDecimalOrNull(firstImportValue(raw, "registerCapital", "registeredCapital", "注册资本")),
        defaultString(cleanText(firstImportText(raw, "sourceLatest", "latestSignalType", "最近信号")), "MANUAL_IMPORT"),
        normalizeRadarLeadStage(stageText),
        stageExplicit,
        totalScore,
        cleanTextMax(firstImportText(raw, "unifiedSocialCreditCode", "creditCode", "统一社会信用代码"), 100));
  }

  private long upsertImportedRadarEnterprise(JdbcTemplate jdbcTemplate, RadarLeadImportItem item) {
    long enterpriseId = findEnterpriseIdByName(jdbcTemplate, item.enterpriseName());
    if (enterpriseId > 0) {
      jdbcTemplate.update(
          """
          UPDATE investment_enterprise
          SET address = COALESCE(?, address),
              city = COALESCE(?, city),
              contact_name = COALESCE(?, contact_name),
              industry_name = COALESCE(?, industry_name),
              phone_number = COALESCE(?, phone_number),
              register_capital = COALESCE(?, register_capital),
              source_latest = ?,
              unified_social_credit_code = COALESCE(?, unified_social_credit_code),
              last_signal_time = NOW(3),
              update_time = NOW(3)
          WHERE enterprise_id = ?
          """,
          item.address(),
          item.city(),
          item.contactName(),
          item.industryName(),
          item.phoneNumber(),
          item.registerCapital(),
          item.sourceLatest(),
          item.unifiedSocialCreditCode(),
          enterpriseId);
      return enterpriseId;
    }
    jdbcTemplate.update(
        """
        INSERT INTO investment_enterprise (
          enterprise_name, unified_social_credit_code, phone_number, contact_name,
          industry_name, address, city, register_capital, source_first,
          source_latest, last_signal_time, create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
        """,
        item.enterpriseName(),
        item.unifiedSocialCreditCode(),
        item.phoneNumber(),
        item.contactName(),
        item.industryName(),
        item.address(),
        item.city(),
        item.registerCapital(),
        item.leadSource(),
        item.sourceLatest());
    return lastInsertId(jdbcTemplate);
  }

  private long upsertImportedRadarLead(JdbcTemplate jdbcTemplate, long enterpriseId, RadarLeadImportItem item) {
    long leadId = findExistingRadarLeadId(jdbcTemplate, enterpriseId);
    if (leadId > 0) {
      List<String> assignments = new ArrayList<>();
      List<Object> args = new ArrayList<>();
      assignments.add("intent_area = ?");
      args.add(item.intentArea());
      assignments.add("intent_score = ?");
      args.add(item.intentScore());
      assignments.add("lead_source = ?");
      args.add(item.leadSource());
      assignments.add("match_score = ?");
      args.add(item.matchScore());
      assignments.add("owner_user_id = ?");
      args.add(item.ownerUserId());
      assignments.add("park_id = ?");
      args.add(item.parkId());
      assignments.add("priority_level = ?");
      args.add(item.priorityLevel());
      assignments.add("reachable_score = ?");
      args.add(item.reachableScore());
      assignments.add("total_score = ?");
      args.add(item.totalScore());
      if (item.stageExplicit()) {
        assignments.add("stage = ?");
        args.add(item.stage());
      }
      assignments.add("update_time = NOW(3)");
      args.add(leadId);
      jdbcTemplate.update(
          "UPDATE investment_lead SET " + String.join(", ", assignments) + " WHERE lead_id = ?",
          args.toArray());
      return leadId;
    }
    jdbcTemplate.update(
        """
        INSERT INTO investment_lead (
          enterprise_id, park_id, lead_source, intent_area, intent_score,
          match_score, reachable_score, total_score, priority_level, stage,
          owner_user_id, latest_contact_time, invalid_reason, create_time,
          update_time, is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW(3), NOW(3), 0)
        """,
        enterpriseId,
        item.parkId(),
        item.leadSource(),
        item.intentArea(),
        item.intentScore(),
        item.matchScore(),
        item.reachableScore(),
        item.totalScore(),
        item.priorityLevel(),
        item.stage(),
        item.ownerUserId());
    return lastInsertId(jdbcTemplate);
  }

  private Map<String, Object> findRadarLeadPropertyMatchSeed(JdbcTemplate jdbcTemplate, long leadId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.intent_area AS intentArea,
              l.park_id AS parkId,
              e.enterprise_name AS enterpriseName,
              e.industry_name AS industryName,
              e.city
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("city", rs.getString("city"));
              map.put("enterpriseName", rs.getString("enterpriseName"));
              map.put("industryName", rs.getString("industryName"));
              map.put("intentArea", numericObject(rs.getObject("intentArea")));
              map.put("leadId", rs.getLong("leadId"));
              map.put("parkId", nullableLong(rs, "parkId"));
              return map;
            },
            leadId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<PropertyMatchCandidate> findPropertyMatchCandidates(
      JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    conditions.add("f.is_deleted = 0");
    conditions.add("ff.is_deleted = 0");
    if (authorizedParkIds != null && !authorizedParkIds.isEmpty()) {
      conditions.add("(f.park_id IS NULL OR f.park_id IN (" + placeholders(authorizedParkIds.size()) + "))");
      args.addAll(authorizedParkIds);
    }
    return jdbcTemplate.query(
        """
        SELECT
          f.factory_id AS factoryId,
          f.factory_name AS factoryName,
          f.park_id AS parkId,
          f.address,
          p.park_name AS parkName,
          COUNT(ff.floor_id) AS floorCount,
          COALESCE(SUM(ff.total_area), 0) AS totalArea,
          COALESCE(SUM(ff.used_area), 0) AS usedArea,
          MIN(NULLIF(ff.rent_price, 0)) AS rentPrice,
          GROUP_CONCAT(DISTINCT ff.description SEPARATOR ' ') AS floorDescription,
          GROUP_CONCAT(DISTINCT ff.status SEPARATOR ' ') AS floorStatus,
          MAX(ff.floor_height) AS maxFloorHeight,
          MAX(ff.load_bearing) AS maxLoadBearing,
          tag.tags_json AS tagsJson
        FROM factory f
        INNER JOIN factory_floor ff ON ff.factory_id = f.factory_id
        LEFT JOIN park p ON p.park_id = f.park_id
        LEFT JOIN investment_property_tag tag ON tag.factory_id = f.factory_id
        WHERE
        """
            + String.join(" AND ", conditions)
            + """

        GROUP BY f.factory_id, f.factory_name, f.park_id, f.address, p.park_name, tag.tags_json
        HAVING totalArea > 0 OR COALESCE(SUM(ff.total_area - ff.used_area), 0) > 0
        ORDER BY f.create_time DESC, f.factory_id DESC
        LIMIT 200
        """,
        (rs, rowNum) -> {
          BigDecimal totalArea = decimalObject(rs.getObject("totalArea"));
          BigDecimal usedArea = decimalObject(rs.getObject("usedArea"));
          BigDecimal availableArea = totalArea.subtract(usedArea).max(BigDecimal.ZERO);
          List<String> propertyTags = jsonArrayItems(rs.getString("tagsJson"));
          List<String> features =
              buildPropertyMatchFeatures(
                  rs.getString("floorDescription"),
                  rs.getString("floorStatus"),
                  rs.getObject("maxFloorHeight"),
                  rs.getObject("maxLoadBearing"),
                  propertyTags);
          return new PropertyMatchCandidate(
              rs.getString("address"),
              availableArea,
              rs.getLong("factoryId"),
              defaultString(rs.getString("factoryName"), "未命名房源"),
              rs.getInt("floorCount"),
              features,
              nullableLong(rs, "parkId") == null ? 0 : nullableLong(rs, "parkId"),
              rs.getString("parkName"),
              decimalObject(rs.getObject("rentPrice")),
              propertyTags.isEmpty() ? null : propertyTags.get(0),
              totalArea,
              usedArea);
        },
        args.toArray());
  }

  private List<PropertyMatchCandidateResult> calculatePropertyMatches(
      List<PropertyMatchCandidate> candidates, Map<String, Object> lead, int limit) {
    return candidates.stream()
        .map(candidate -> calculatePropertyMatch(candidate, lead))
        .filter(item -> item.totalArea().compareTo(BigDecimal.ZERO) > 0 || item.availableArea().compareTo(BigDecimal.ZERO) > 0)
        .sorted((left, right) -> Integer.compare(right.matchScore(), left.matchScore()))
        .limit(limit)
        .toList();
  }

  private PropertyMatchCandidateResult calculatePropertyMatch(
      PropertyMatchCandidate candidate, Map<String, Object> lead) {
    BigDecimal intentArea = decimalObject(lead.get("intentArea"));
    List<String> reasons = new ArrayList<>();
    int score = 50;
    if (intentArea.compareTo(BigDecimal.ZERO) > 0 && candidate.availableArea().compareTo(BigDecimal.ZERO) > 0) {
      double ratio = candidate.availableArea().doubleValue() / intentArea.doubleValue();
      if (ratio >= 0.8 && ratio <= 1.5) {
        score += 28;
        reasons.add(ratio <= 1.25 ? "面积高度贴合" : "面积区间匹配");
      } else if (ratio >= 0.5) {
        score += 14;
        reasons.add(candidate.availableArea().compareTo(intentArea) > 0 ? "面积充裕" : "面积接近");
      }
    }
    Long leadParkId = nullableLongObject(lead.get("parkId"));
    if (leadParkId != null && leadParkId > 0 && candidate.parkId() == leadParkId) {
      score += 12;
      reasons.add("同园区");
    } else if (StringUtils.hasText(stringObject(lead.get("city")))
        && defaultString(candidate.parkName()).contains(stringObject(lead.get("city")))) {
      score += 8;
      reasons.add("同城区域");
    }
    String searchableText =
        String.join(
                " ",
                defaultString(candidate.factoryName()),
                defaultString(candidate.address()),
                defaultString(candidate.parkName()),
                defaultString(candidate.tag()),
                String.join(" ", candidate.floorFeatures()))
            .toLowerCase(Locale.ROOT);
    for (String keyword : industryKeywords(stringObject(lead.get("industryName")))) {
      if (searchableText.contains(keyword.toLowerCase(Locale.ROOT))) {
        score += 10;
        reasons.add("行业/用途匹配");
        break;
      }
    }
    if (!candidate.floorFeatures().isEmpty()) {
      score += Math.min(candidate.floorFeatures().size() * 3, 9);
      reasons.addAll(candidate.floorFeatures().stream().limit(3).toList());
    }
    if (candidate.availableArea().compareTo(BigDecimal.ZERO) > 0
        && candidate.usedArea().compareTo(BigDecimal.ZERO) == 0) {
      score += 6;
      reasons.add("整层/整栋可快速排布");
    }
    if (candidate.floorCount() <= 2 && candidate.availableArea().compareTo(BigDecimal.ZERO) > 0) {
      score += 4;
      reasons.add("楼层使用便利");
    }
    if (candidate.rentPrice().compareTo(BigDecimal.ZERO) > 0) {
      if (candidate.rentPrice().compareTo(BigDecimal.valueOf(60)) <= 0) {
        score += 8;
        reasons.add("租金优势明显");
      } else if (candidate.rentPrice().compareTo(BigDecimal.valueOf(80)) <= 0) {
        score += 5;
        reasons.add("租金可控");
      }
    }
    if (candidate.availableArea().compareTo(BigDecimal.ZERO) <= 0) {
      score = Math.min(score, 40);
    }
    int matchScore = Math.max(0, Math.min(score, 100));
    List<String> finalReasons = reasons.stream().filter(StringUtils::hasText).distinct().toList();
    if (finalReasons.isEmpty()) {
      finalReasons = List.of("可用房源");
    }
    List<String> reminders = propertyMismatchReminders(candidate, intentArea, leadParkId);
    return new PropertyMatchCandidateResult(
        candidate.address(),
        candidate.availableArea(),
        candidate.factoryId(),
        candidate.factoryName(),
        candidate.floorCount(),
        finalReasons,
        matchScore,
        reminders,
        candidate.parkId(),
        candidate.parkName(),
        candidate.rentPrice().compareTo(BigDecimal.ZERO) > 0 ? candidate.rentPrice() : null,
        candidate.rentPrice().compareTo(BigDecimal.ZERO) > 0 ? candidate.rentPrice().stripTrailingZeros() + "元/m²/月起" : null,
        propertySalesPitch(candidate, lead, matchScore),
        candidate.tag(),
        candidate.totalArea(),
        candidate.usedArea());
  }

  private void replacePropertyMatchResults(
      JdbcTemplate jdbcTemplate, long leadId, List<PropertyMatchCandidateResult> matches) {
    jdbcTemplate.update("DELETE FROM property_match_result WHERE lead_id = ?", leadId);
    for (PropertyMatchCandidateResult match : matches) {
      jdbcTemplate.update(
          """
          INSERT INTO property_match_result (
            lead_id, factory_id, park_id, factory_name, park_name, address,
            match_score, available_area, total_area, used_area, rent_price,
            rent_price_text, floor_count, tag, match_reasons_json,
            mismatch_reminders_json, sales_pitch, snapshot_json,
            computed_at, create_time, update_time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
          """,
          leadId,
          match.factoryId(),
          match.parkId() <= 0 ? null : match.parkId(),
          match.factoryName(),
          match.parkName(),
          match.address(),
          match.matchScore(),
          match.availableArea(),
          match.totalArea(),
          match.usedArea(),
          match.rentPrice(),
          match.rentPriceText(),
          match.floorCount(),
          match.tag(),
          jsonString(match.matchReasons()),
          jsonString(match.mismatchReminders()),
          match.salesPitch(),
          jsonString(propertyMatchResultMap(match)));
    }
  }

  private Map<String, Object> propertyMatchResultMap(PropertyMatchCandidateResult match) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("address", match.address());
    map.put("availableArea", numericObject(match.availableArea()));
    map.put("factoryId", match.factoryId());
    map.put("factoryName", match.factoryName());
    map.put("floorCount", match.floorCount());
    map.put("matchReasons", match.matchReasons());
    map.put("matchScore", match.matchScore());
    map.put("mismatchReminders", match.mismatchReminders());
    map.put("parkId", match.parkId() <= 0 ? null : match.parkId());
    map.put("parkName", match.parkName());
    map.put("rentPrice", numericObject(match.rentPrice()));
    map.put("rentPriceText", match.rentPriceText());
    map.put("salesPitch", match.salesPitch());
    map.put("tag", match.tag());
    map.put("title", match.factoryName());
    map.put("totalArea", numericObject(match.totalArea()));
    map.put("usedArea", numericObject(match.usedArea()));
    return map;
  }

  private List<Long> findRadarLeadIdsForPropertyMatchRebuild(JdbcTemplate jdbcTemplate, int limit) {
    int normalizedLimit =
        positiveIntegerOrDefault(limit, RADAR_PROPERTY_MATCH_BATCH_LIMIT_DEFAULT, 1, RADAR_PROPERTY_MATCH_BATCH_LIMIT_MAX);
    return jdbcTemplate.query(
        """
        SELECT l.lead_id AS leadId
        FROM investment_lead l
        LEFT JOIN property_match_result pmr
          ON pmr.lead_id = l.lead_id
        WHERE l.is_deleted = 0
        GROUP BY l.lead_id
        ORDER BY
          CASE WHEN COUNT(pmr.match_id) = 0 THEN 0 ELSE 1 END,
          COALESCE(MAX(pmr.computed_at), l.update_time) ASC,
          l.lead_id ASC
        LIMIT ?
        """,
        (rs, rowNum) -> rs.getLong("leadId"),
        normalizedLimit);
  }

  private List<String> buildPropertyMatchFeatures(
      String floorDescription, String floorStatus, Object maxFloorHeight, Object maxLoadBearing, List<String> tags) {
    List<String> features = new ArrayList<>();
    String searchableText =
        (defaultString(floorDescription) + " " + defaultString(floorStatus) + " " + String.join(" ", tags)).trim();
    if (searchableText.matches(".*(空置|可租|出租|可用).*")) {
      features.add("当前可租");
    }
    if (searchableText.matches(".*(独栋|整栋|整层|单层).*")) {
      features.add("整租条件好");
    }
    if (searchableText.matches(".*(物流|仓储|装卸|货梯|月台).*")) {
      features.add("适合仓储物流");
    }
    if (searchableText.matches(".*(生产|制造|加工|厂房|车间).*")) {
      features.add("适合生产制造");
    }
    if (searchableText.matches(".*(研发|办公|总部|展示).*")) {
      features.add("兼容研发办公");
    }
    BigDecimal height = decimalObject(maxFloorHeight);
    if (height.compareTo(BigDecimal.valueOf(5)) >= 0) {
      features.add("层高充足");
    }
    BigDecimal bearing = decimalObject(maxLoadBearing);
    if (bearing.compareTo(BigDecimal.valueOf(0.8)) >= 0) {
      features.add("承重条件较好");
    }
    tags.stream()
        .filter(StringUtils::hasText)
        .limit(5)
        .forEach(features::add);
    return features.stream().filter(StringUtils::hasText).distinct().limit(8).toList();
  }

  private List<String> industryKeywords(String industryName) {
    String text = defaultString(industryName);
    if (!StringUtils.hasText(text)) {
      return List.of();
    }
    List<String> keywords = new ArrayList<>();
    if (text.matches(".*(电子|半导体|芯片|电路|智能|终端).*")) {
      keywords.addAll(List.of("电子", "半导体", "洁净", "研发", "生产"));
    }
    if (text.matches(".*(汽车|零部件|新能源).*")) {
      keywords.addAll(List.of("汽车", "新能源", "制造", "装配", "重载"));
    }
    if (text.matches(".*(物流|仓储|供应链).*")) {
      keywords.addAll(List.of("物流", "仓储", "月台", "货梯", "装卸"));
    }
    if (text.matches(".*(医药|医疗|生物).*")) {
      keywords.addAll(List.of("医药", "医疗", "生物", "研发", "洁净"));
    }
    if (text.matches(".*(机械|装备|制造|五金|模具).*")) {
      keywords.addAll(List.of("机械", "装备", "制造", "车间", "承重"));
    }
    keywords.add(text);
    return keywords.stream()
        .map(item -> item == null ? "" : item.trim())
        .filter(StringUtils::hasText)
        .distinct()
        .toList();
  }

  private List<String> propertyMismatchReminders(
      PropertyMatchCandidate candidate, BigDecimal intentArea, Long leadParkId) {
    List<String> reminders = new ArrayList<>();
    if (candidate.availableArea().compareTo(BigDecimal.ZERO) <= 0) {
      reminders.add("可用面积不足，需先确认空置情况");
    } else if (intentArea.compareTo(BigDecimal.ZERO) > 0
        && candidate.availableArea().compareTo(intentArea.multiply(BigDecimal.valueOf(0.5))) < 0) {
      reminders.add("面积明显偏小，需确认客户是否可拆分入驻");
    } else if (intentArea.compareTo(BigDecimal.ZERO) > 0
        && candidate.availableArea().compareTo(intentArea.multiply(BigDecimal.valueOf(2))) > 0) {
      reminders.add("面积偏大，需评估分租或成长空间");
    }
    if (leadParkId != null && leadParkId > 0 && candidate.parkId() > 0 && candidate.parkId() != leadParkId) {
      reminders.add("非客户意向园区，需确认区域接受度");
    }
    if (candidate.rentPrice().compareTo(BigDecimal.valueOf(90)) > 0) {
      reminders.add("租金较高，需提前沟通预算");
    }
    if (candidate.floorFeatures().isEmpty()) {
      reminders.add("房源标签较少，建议现场核实层高、承重和用途");
    }
    return reminders.stream().distinct().limit(5).toList();
  }

  private String propertySalesPitch(
      PropertyMatchCandidate candidate, Map<String, Object> lead, int matchScore) {
    String companyName = defaultString(stringObject(lead.get("enterpriseName")), "客户");
    String areaText =
        candidate.availableArea().compareTo(BigDecimal.ZERO) > 0
            ? candidate.availableArea().stripTrailingZeros() + "m²可用"
            : "可用面积待确认";
    List<String> parts = new ArrayList<>();
    parts.add(companyName + "可优先看" + candidate.factoryName());
    parts.add(areaText);
    if (StringUtils.hasText(candidate.parkName())) {
      parts.add("位于" + candidate.parkName());
    }
    if (!candidate.floorFeatures().isEmpty()) {
      parts.add("亮点：" + String.join("、", candidate.floorFeatures().stream().limit(3).toList()));
    }
    parts.add("匹配度" + matchScore + "分");
    return trimToMax(String.join("，", parts), 500);
  }

  private Map<String, Object> rebuildLocalRadarSalesActions(JdbcTemplate jdbcTemplate) {
    Map<String, Object> result = new LinkedHashMap<>();
    if (!hasRadarLeadCoreColumns(jdbcTemplate)) {
      result.put("assignedLeadCount", 0);
      result.put("createdSopReminderCount", 0);
      result.put("pendingSopReminderCount", 0);
      result.put("targetLeadCount", 0);
      return result;
    }
    long targetLeadCount =
        count(
            jdbcTemplate,
            """
            SELECT COUNT(*)
            FROM investment_lead
            WHERE is_deleted = 0
              AND stage IN ('NEW', 'PENDING_CONTACT', 'CONTACTED')
            """,
            List.of());
    int assignedLeadCount = 0;
    if (hasColumns(jdbcTemplate, "user", "id", "is_deleted")
        && hasColumns(jdbcTemplate, "investment_lead", "lead_id", "owner_user_id", "update_time")) {
      List<Long> ownerIds =
          jdbcTemplate.query(
              """
              SELECT id
              FROM user
              WHERE is_deleted = 0
              ORDER BY id ASC
              LIMIT 1
              """,
              (rs, rowNum) -> rs.getLong("id"));
      if (!ownerIds.isEmpty()) {
        assignedLeadCount =
            jdbcTemplate.update(
                """
                UPDATE investment_lead
                SET owner_user_id = ?, update_time = NOW(3)
                WHERE is_deleted = 0
                  AND owner_user_id IS NULL
                  AND stage IN ('NEW', 'PENDING_CONTACT')
                LIMIT 200
                """,
                ownerIds.get(0));
      }
    }
    int createdSopReminderCount = 0;
    long pendingSopReminderCount = 0;
    if (hasRadarSopReminderColumns(jdbcTemplate)) {
      List<Long> reminderLeadIds =
          jdbcTemplate.query(
              """
              SELECT l.lead_id AS leadId
              FROM investment_lead l
              LEFT JOIN investment_sop_reminder r
                ON r.lead_id = l.lead_id
                AND r.reminder_type = 'FIRST_CONTACT'
              WHERE l.is_deleted = 0
                AND l.stage IN ('NEW', 'PENDING_CONTACT')
                AND r.reminder_id IS NULL
              ORDER BY l.total_score DESC, l.lead_id ASC
              LIMIT 200
              """,
              (rs, rowNum) -> rs.getLong("leadId"));
      for (Long leadId : reminderLeadIds) {
        try {
          createdSopReminderCount +=
              jdbcTemplate.update(
                  """
                  INSERT INTO investment_sop_reminder (
                    lead_id, reminder_type, title, description, due_time,
                    reminder_status, handled_time, create_time, update_time
                  )
                  VALUES (?, 'FIRST_CONTACT', '首次触达提醒',
                          '主动获客链路本地重建后生成的首次触达提醒',
                          DATE_ADD(NOW(3), INTERVAL 1 DAY),
                          'PENDING', NULL, NOW(3), NOW(3))
                  """,
                  leadId);
        } catch (DuplicateKeyException ignored) {
          // 并发或历史数据已存在时跳过，保持重建接口幂等。
        }
      }
      pendingSopReminderCount =
          count(
              jdbcTemplate,
              """
              SELECT COUNT(*)
              FROM investment_sop_reminder
              WHERE reminder_status IN ('PENDING', 'OVERDUE')
              """,
              List.of());
    }
    result.put("assignedLeadCount", assignedLeadCount);
    result.put("createdSopReminderCount", createdSopReminderCount);
    result.put("pendingSopReminderCount", pendingSopReminderCount);
    result.put("targetLeadCount", targetLeadCount);
    return result;
  }

  private Map<String, Object> rebuildLocalRadarOutreachActions(JdbcTemplate jdbcTemplate) {
    Map<String, Object> result = new LinkedHashMap<>();
    if (!hasOutreachTaskColumns(jdbcTemplate)
        || !hasRadarLeadCoreColumns(jdbcTemplate)
        || !hasInvestmentEnterpriseColumns(jdbcTemplate)) {
      result.put("createdOutreachTaskCount", 0);
      result.put("outreachTargetLeadCount", 0);
      result.put("pendingOutreachTaskCount", 0);
      return result;
    }
    List<Map<String, Object>> leads =
        jdbcTemplate.query(
            """
            SELECT
              l.lead_id AS leadId,
              l.priority_level AS priorityLevel,
              e.phone_number AS phoneNumber
            FROM investment_lead l
            INNER JOIN investment_enterprise e
              ON e.enterprise_id = l.enterprise_id
              AND e.is_deleted = 0
            WHERE l.is_deleted = 0
              AND l.stage IN ('NEW', 'PENDING_CONTACT')
              AND e.phone_number IS NOT NULL
              AND e.phone_number <> ''
            ORDER BY l.total_score DESC, l.lead_id ASC
            LIMIT 200
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("leadId", rs.getLong("leadId"));
              map.put("phoneNumber", rs.getString("phoneNumber"));
              map.put("priorityLevel", rs.getString("priorityLevel"));
              return map;
            });
    int createdOutreachTaskCount = 0;
    for (Map<String, Object> lead : leads) {
      long leadId = longValue(lead.get("leadId"));
      if (countPendingOutreachTasks(jdbcTemplate, leadId) > 0) {
        continue;
      }
      jdbcTemplate.update(
          """
          INSERT INTO investment_outreach_task (
            lead_id, task_type, channel, phone_number, status, template_code,
            content, scheduled_at, sent_at, sent_by, result_code, result_message,
            provider_task_id, provider_response_json, reply_status, reply_content,
            reply_time, create_time, update_time
          )
          VALUES (?, 'OUTREACH', 'SMS', ?, 'PENDING', ?,
                  ?, DATE_ADD(NOW(3), INTERVAL 2 HOUR), NULL, NULL, NULL, ?,
                  NULL, NULL, 'NO_REPLY', NULL, NULL, NOW(3), NOW(3))
          """,
          leadId,
          lead.get("phoneNumber"),
          "A".equals(defaultString(stringObject(lead.get("priorityLevel"))))
              ? "RADAR_HIGH_PRIORITY"
              : "RADAR_FIRST_TOUCH",
          "您好，我们关注到贵司近期可能有厂房/园区选址需求，可为您匹配合适房源。",
          "主动获客链路本地重建生成，未调用短信或企微通道");
      createdOutreachTaskCount++;
    }
    long pendingOutreachTaskCount =
        count(
            jdbcTemplate,
            """
            SELECT COUNT(*)
            FROM investment_outreach_task
            WHERE status IN ('PENDING', 'RUNNING')
            """,
            List.of());
    result.put("createdOutreachTaskCount", createdOutreachTaskCount);
    result.put("outreachTargetLeadCount", leads.size());
    result.put("pendingOutreachTaskCount", pendingOutreachTaskCount);
    return result;
  }

  private List<Long> normalizedPositiveLongList(List<Object> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    return values.stream()
        .map(this::nullableLongObject)
        .filter(value -> value != null && value > 0)
        .distinct()
        .toList();
  }

  private List<String> normalizedCrawlerRequeueStatuses(List<Object> values) {
    List<Object> input = values == null || values.isEmpty()
        ? List.of("FAILED", "RETRY_WAITING", "SKIPPED")
        : values;
    return input.stream()
        .map(this::stringObject)
        .map(value -> value == null ? "" : value.trim().toUpperCase(Locale.ROOT))
        .filter(status -> Set.of("FAILED", "RETRY_WAITING", "SKIPPED").contains(status))
        .distinct()
        .toList();
  }

  private String manualPublicOpportunityDetailJson(
      PublicOpportunityManualRequest request, String sourceUrl, String qualityGrade) {
    Map<String, Object> qualityResult = new LinkedHashMap<>();
    qualityResult.put("city", nullableString(request.city()));
    qualityResult.put("missingFields", manualPublicOpportunityMissingFields(request, sourceUrl));
    qualityResult.put("reasons", List.of());
    qualityResult.put("status", qualityGrade);

    Map<String, Object> detail = new LinkedHashMap<>();
    detail.put("manual", true);
    detail.put("source", "manual_emergency_input");
    detail.put("qualityResult", qualityResult);
    return jsonString(detail);
  }

  private List<String> manualPublicOpportunityMissingFields(
      PublicOpportunityManualRequest request, String sourceUrl) {
    List<String> fields = new ArrayList<>();
    if (!StringUtils.hasText(request.title())) {
      fields.add("title");
    }
    if (!StringUtils.hasText(request.city())) {
      fields.add("city");
    }
    if ("SUPPLY".equals(request.opportunityType()) && !StringUtils.hasText(request.district())) {
      fields.add("district");
    }
    if (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
      fields.add("sourceUrl");
    }
    if (!StringUtils.hasText(request.areaText())) {
      fields.add("area");
    }
    fields.add("detailEvidence");
    return fields;
  }

  private Map<String, Object> findManualPublicOpportunityBySourceId(
      JdbcTemplate jdbcTemplate, long sourceId) {
    if (!hasPublicOpportunityColumns(jdbcTemplate)) {
      return null;
    }
    List<Long> ids =
        jdbcTemplate.queryForList(
            """
            SELECT opportunity_id
            FROM investment_public_opportunity
            WHERE source_table = 'manual_input' AND source_id = ?
            ORDER BY opportunity_id DESC
            LIMIT 1
            """,
            Long.class,
            sourceId);
    return ids.isEmpty() ? null : findPublicOpportunityById(jdbcTemplate, ids.get(0));
  }

  private Map<String, Object> manualPublicOpportunityResult(
      boolean created, Map<String, Object> opportunity) {
    if (opportunity == null) {
      throw new IllegalStateException("create manual public opportunity failed");
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("created", created);
    result.put("opportunity", opportunity);
    return result;
  }

  private String normalizeHttpUrl(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      URI uri = URI.create(value.trim());
      String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
      if (!Set.of("http", "https").contains(scheme) || !StringUtils.hasText(uri.getHost())) {
        return null;
      }
      return new URI(scheme, null, uri.getHost(), uri.getPort(), uri.getRawPath(), uri.getRawQuery(), null)
          .toString();
    } catch (Exception error) {
      return null;
    }
  }

  private String htmlToReadableText(String html) {
    return defaultString(html)
        .replaceAll("(?is)<script\\b[^>]*>[\\s\\S]*?</script>", " ")
        .replaceAll("(?is)<style\\b[^>]*>[\\s\\S]*?</style>", " ")
        .replaceAll("(?i)<br\\s*/?>", "\n")
        .replaceAll("(?i)</(?:div|p|li|tr|dd|dt|h[1-6]|section|article)>", "\n")
        .replaceAll("(?i)</(?:td|th)>", "\t")
        .replaceAll("<[^>]*>", " ")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replaceAll("[ \\f\\r\\x0B]+", " ")
        .replaceAll("\\t+", "\t")
        .replaceAll("\\s*\\n\\s*", "\n")
        .replaceAll("\\n{2,}", "\n")
        .trim();
  }

  private String extractHtmlTitle(String html) {
    return firstText(
        regexFirst(html, "(?is)<h1[^>]*>([\\s\\S]*?)</h1>"),
        regexFirst(html, "(?is)<h2[^>]*>([\\s\\S]*?)</h2>"),
        regexFirst(html, "(?is)<title[^>]*>([\\s\\S]*?)</title>"));
  }

  private String extractLabeledValue(String text, String... labels) {
    if (!StringUtils.hasText(text)) {
      return null;
    }
    for (String line : text.split("\\n")) {
      String normalizedLine = line.replace('\t', ' ').trim();
      for (String label : labels) {
        String value = regexFirst(normalizedLine, "(?:^|\\s)" + java.util.regex.Pattern.quote(label) + "\\s*[:：\\s]\\s*([^，,。；;\\n]{1,120})");
        if (StringUtils.hasText(value) && !value.equals(label)) {
          return cleanTrailingLabelValue(value);
        }
      }
    }
    return null;
  }

  private String cleanTrailingLabelValue(String value) {
    return cleanText(value == null ? null : value.replaceAll("[,，。；;：:\\s]+$", ""));
  }

  private String regexFirst(String text, String pattern) {
    if (!StringUtils.hasText(text)) {
      return null;
    }
    java.util.regex.Matcher matcher =
        java.util.regex.Pattern.compile(pattern, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(text);
    if (!matcher.find()) {
      return null;
    }
    return cleanText(matcher.groupCount() >= 1 ? matcher.group(1) : matcher.group());
  }

  private String extractGuangdongCity(String text) {
    if (!StringUtils.hasText(text)) {
      return null;
    }
    return GUANGDONG_REGION_SCOPE.stream()
        .filter(city -> !"广东省".equals(city))
        .filter(text::contains)
        .findFirst()
        .orElse(null);
  }

  private Long findExistingCrawlerPublicOpportunityId(
      JdbcTemplate jdbcTemplate, String opportunityType, String sourceTable, String sourceKey, String sourceUrl) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT opportunity_id AS opportunityId
            FROM investment_public_opportunity
            WHERE (opportunity_type = ? AND source_table = ? AND source_key = ?)
              OR (opportunity_type = ? AND source_url = ?)
            ORDER BY
              CASE WHEN opportunity_type = ? AND source_url = ? THEN 0 ELSE 1 END,
              opportunity_id ASC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("opportunityId"),
            opportunityType,
            sourceTable,
            sourceKey,
            opportunityType,
            sourceUrl,
            opportunityType,
            sourceUrl);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> outreachSendResult(
      long taskId, String status, String resultCode, String resultMessage, Long sentBy, String providerTaskId) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("providerTaskId", providerTaskId);
    result.put("resultCode", resultCode);
    result.put("resultMessage", resultMessage);
    result.put("sentAt", sentBy == null ? null : Instant.now().toString());
    result.put("sentBy", sentBy);
    result.put("status", status);
    result.put("taskId", taskId);
    return result;
  }

  private String buildOutreachTaskContent(Map<String, Object> task) {
    String existing = firstText(stringObject(task.get("content")), stringObject(task.get("resultMessage")));
    if (StringUtils.hasText(existing)) {
      return existing;
    }
    String template = cleanText(stringObject(task.get("templateContent")));
    if (!StringUtils.hasText(template)) {
      return "";
    }
    return template
        .replace("{companyName}", defaultString(stringObject(task.get("companyName")), "该企业"))
        .replace("{contactName}", defaultString(stringObject(task.get("contactName")), "客户"))
        .replace("{parkName}", defaultString(stringObject(task.get("parkName")), "园区"))
        .replace("{intentArea}", formatIntentArea(task.get("intentArea")));
  }

  private String inferSourceSite(String sourceUrl) {
    try {
      String host = URI.create(sourceUrl).getHost();
      if (!StringUtils.hasText(host)) {
        return null;
      }
      return trimToMax(host.replaceFirst("^www\\.", ""), 100);
    } catch (RuntimeException error) {
      return null;
    }
  }

  private long manualPublicOpportunitySourceId(String sourceUrl) {
    String hash = sha256Hex(sourceUrl);
    return Long.parseLong(hash.substring(0, 7), 16);
  }

  private String resolveManualPublicOpportunitySourceCode(String opportunityType, String sourceSite) {
    String site = sourceSite == null ? "" : sourceSite.trim().toLowerCase(Locale.ROOT);
    if ("DEMAND".equals(opportunityType) && "99cfw".equals(site)) {
      return "PUBLIC_DEMAND_99CFW_GD";
    }
    if ("SUPPLY".equals(opportunityType) && "cfzsw68.com".equals(site)) {
      return PUBLIC_FACTORY_CFZSW68_SOURCE_CODE;
    }
    if ("SUPPLY".equals(opportunityType) && "99cfw".equals(site)) {
      return "PUBLIC_FACTORY_LISTING_99CFW_GD";
    }
    if ("SUPPLY".equals(opportunityType) && "fang.com".equals(site)) {
      return "PUBLIC_FACTORY_LISTING_FANG_GD";
    }
    if ("DEMAND".equals(opportunityType) && "zhaoshang.net".equals(site)) {
      return "PUBLIC_DEMAND_ZHAOSHANG_NET_GD";
    }
    return null;
  }

  private boolean isGuangdongPublicOpportunity(String city, String district, String title) {
    String text =
        (defaultString(city) + " " + defaultString(district) + " " + defaultString(title)).trim();
    return GUANGDONG_REGION_SCOPE.stream().anyMatch(text::contains);
  }

  private List<String> extractPublicOpportunityImportUrls(PublicOpportunityImportUrlsRequest request) {
    List<String> urls = new ArrayList<>();
    if (request.urls() != null) {
      for (Object item : request.urls()) {
        String text = stringObject(item);
        if (!StringUtils.hasText(text)) {
          continue;
        }
        List<String> extracted = extractHttpUrls(text);
        if (extracted.isEmpty()) {
          urls.add(text.trim());
        } else {
          urls.addAll(extracted);
        }
      }
    }
    urls.addAll(extractHttpUrls(stringObject(request.urlText())));
    return urls;
  }

  private List<String> extractHttpUrls(String text) {
    if (!StringUtils.hasText(text)) {
      return List.of();
    }
    List<String> result = new ArrayList<>();
    java.util.regex.Matcher matcher =
        java.util.regex.Pattern.compile("https?://[^\\s\"'<>，,；;]+", java.util.regex.Pattern.CASE_INSENSITIVE)
            .matcher(text);
    while (matcher.find()) {
      result.add(matcher.group());
    }
    return result;
  }

  private String normalizeImportUrl(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String rawUrl = value.trim().replaceAll("[)）\\]】,，.。;；]+$", "");
    if (!StringUtils.hasText(rawUrl)) {
      return null;
    }
    try {
      URI uri = URI.create(rawUrl);
      String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
      if (!Set.of("http", "https").contains(scheme)
          || StringUtils.hasText(uri.getUserInfo())
          || !StringUtils.hasText(uri.getHost())) {
        return null;
      }
      return new URI(
              scheme,
              null,
              uri.getHost(),
              uri.getPort(),
              uri.getRawPath(),
              uri.getRawQuery(),
              null)
          .toString();
    } catch (Exception error) {
      return null;
    }
  }

  private Map<String, Object> rejectedImportUrl(int index, String reason, String sourceUrl) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("index", index);
    result.put("reason", reason);
    result.put("sourceUrl", sourceUrl);
    return result;
  }

  private String extractCompanyNameFromPublicOpportunity(PublicOpportunityLeadSource source) {
    Map<String, Object> detail = normalizeDetailJsonObject(source.detailJson());
    for (String key :
        List.of(
            "companyName",
            "enterpriseName",
            "tenantName",
            "customerName",
            "orgName",
            "company_name",
            "enterprise_name",
            "企业名称",
            "公司名称",
            "需求企业",
            "需求方",
            "意向企业",
            "项目单位",
            "承租企业",
            "求租企业",
            "联系人单位")) {
      String value = cleanText(stringObject(detail.get(key)));
      if (isReliablePublicOpportunityCompanyName(value)) {
        return value;
      }
    }
    String text =
        String.join(" ", defaultString(source.description()), defaultString(source.detailJson()));
    String matched =
        regexFirst(
            text,
            "(?:公司名称|企业名称|单位名称|需求企业|需求方|意向企业|项目单位|承租企业|求租企业|联系人单位)[：:\\s]*([\\u4E00-\\u9FA5A-Z0-9（）()]{2,80}(?:股份有限公司|有限责任公司|有限公司|集团有限公司|集团|工厂|厂))");
    return isReliablePublicOpportunityCompanyName(matched) ? matched : null;
  }

  private boolean isReliablePublicOpportunityCompanyName(String value) {
    if (!StringUtils.hasText(value)) {
      return false;
    }
    String name =
        value.trim()
            .replaceAll("^[：:\\s,，、;；]+", "")
            .replaceAll("[，,。；;：:\\s]+$", "");
    if (name.length() < 4 || name.length() > 80 || name.matches(".*[?？!！].*")) {
      return false;
    }
    if (!name.matches(".*(公司|集团|工厂|厂)$")) {
      return false;
    }
    return List.of("求租", "求购", "附近", "周边", "平方", "平米", "需要", "寻找", "厂房", "库房", "仓库", "产业园", "房东", "个人")
        .stream()
        .noneMatch(name::contains);
  }

  private int calculatePublicOpportunityLeadConfidence(
      PublicOpportunityLeadSource source, String companyName, List<String> matchedKeywords) {
    int score = 35 + Math.min(matchedKeywords.size() * 8, 25);
    if (StringUtils.hasText(source.city())) {
      score += 5;
    }
    if (StringUtils.hasText(source.district())) {
      score += 3;
    }
    if (StringUtils.hasText(source.areaText()) || source.areaSqm() != null) {
      score += 5;
    }
    if (StringUtils.hasText(source.industryText())) {
      score += 5;
    }
    if (StringUtils.hasText(source.contactName()) || StringUtils.hasText(source.phoneNumber())) {
      score += 5;
    }
    if (StringUtils.hasText(companyName)) {
      score += 10;
    }
    return Math.max(0, Math.min(95, score));
  }

  private String resolvePublicOpportunityDemandType(List<String> matchedKeywords) {
    if (matchedKeywords.stream().anyMatch(Set.of("仓储", "厂房需求", "求租", "租厂房")::contains)) {
      return "RENT_FACTORY";
    }
    if (matchedKeywords.stream().anyMatch(Set.of("搬迁", "迁建")::contains)) {
      return "RELOCATION";
    }
    if (matchedKeywords.stream().anyMatch(Set.of("扩产", "技改")::contains)) {
      return "EXPAND";
    }
    return matchedKeywords.contains("生产线") ? "NEW_LINE" : "UNKNOWN";
  }

  private Long findExternalLeadIdBySource(JdbcTemplate jdbcTemplate, String sourceType, Object sourceId) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT lead_id AS leadId
            FROM company_lead
            WHERE source_type = ? AND source_id = ? AND is_deleted = 0
            ORDER BY lead_id ASC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("leadId"),
            sourceType,
            sourceId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Long findLeadEvidenceIdByHash(JdbcTemplate jdbcTemplate, long leadId, String contentHash) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT evidence_id AS evidenceId
            FROM lead_evidence
            WHERE lead_id = ? AND content_hash = ?
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("evidenceId"),
            leadId,
            contentHash);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void pushSampleId(List<Long> target, long id) {
    if (id <= 0 || target.size() >= 10 || target.contains(id)) {
      return;
    }
    target.add(id);
  }

  private String validatePublicOpportunityImportUrlPolicy(
      String sourceUrl, Map<String, Object> source) {
    URI uri;
    try {
      uri = URI.create(sourceUrl);
    } catch (RuntimeException error) {
      return "URL_INVALID";
    }
    String path = uri.getPath() == null ? "/" : uri.getPath();
    List<String> blockedPaths = stringList(source.get("blockedPathsJson"));
    if (blockedPaths.stream().anyMatch(path::startsWith)) {
      return "URL_PATH_BLOCKED";
    }
    List<String> allowedPaths = stringList(source.get("allowedPathsJson"));
    if (!allowedPaths.isEmpty() && allowedPaths.stream().noneMatch(path::startsWith)) {
      return "URL_DETAIL_PATH_NOT_ALLOWED";
    }
    return null;
  }

  private Map<String, Object> seedCrawlerTaskItems(
      JdbcTemplate jdbcTemplate,
      List<String> acceptedUrls,
      long sourceId,
      int maxRetryCount,
      boolean forcePending) {
    int createdCount = 0;
    int updatedCount = 0;
    for (String sourceUrl : acceptedUrls) {
      String urlHash = sha256Hex(sourceUrl);
      boolean existing =
          count(
                  jdbcTemplate,
                  "SELECT COUNT(*) FROM crawler_task_item WHERE source_id = ? AND url_hash = ?",
                  List.of(sourceId, urlHash))
              > 0;
      jdbcTemplate.update(
          """
          INSERT INTO crawler_task_item (
            source_id, source_ref_type, source_ref_id, source_url, url_hash,
            status, max_retry_count, published_at, create_time, update_time
          )
          VALUES (?, 'manual_url_import', NULL, ?, ?, 'PENDING', ?, NULL, NOW(3), NOW(3))
          ON DUPLICATE KEY UPDATE
            source_ref_type = VALUES(source_ref_type),
            source_ref_id = VALUES(source_ref_id),
            source_url = VALUES(source_url),
            max_retry_count = VALUES(max_retry_count),
            retry_count = CASE
              WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN 0
              ELSE retry_count
            END,
            next_retry_at = CASE
              WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN NULL
              ELSE next_retry_at
            END,
            last_error = CASE
              WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN NULL
              ELSE last_error
            END,
            skip_reason = CASE
              WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN NULL
              ELSE skip_reason
            END,
            status = CASE
              WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN 'PENDING'
              ELSE status
            END,
            update_time = NOW(3)
          """,
          sourceId,
          sourceUrl,
          urlHash,
          maxRetryCount,
          forcePending ? 1 : 0,
          forcePending ? 1 : 0,
          forcePending ? 1 : 0,
          forcePending ? 1 : 0,
          forcePending ? 1 : 0);
      if (existing) {
        updatedCount++;
      } else {
        createdCount++;
      }
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("createdCount", createdCount);
    result.put("updatedCount", updatedCount);
    return result;
  }

  private String publicOpportunityTypeBySourceCode(String sourceCode) {
    return PUBLIC_OPPORTUNITY_DEMAND_SOURCE_CODES.contains(sourceCode) ? "DEMAND" : "SUPPLY";
  }

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream()
          .map(this::stringObject)
          .map(item -> item == null ? "" : item.trim())
          .filter(StringUtils::hasText)
          .toList();
    }
    return List.of();
  }

  private String sha256Hex(String value) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder result = new StringBuilder(digest.length * 2);
      for (byte item : digest) {
        result.append(String.format("%02x", item));
      }
      return result.toString();
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is not available", error);
    }
  }

  private void appendInvestmentImages(JdbcTemplate jdbcTemplate, List<Map<String, Object>> rows) {
    if (rows.isEmpty()
        || !hasColumns(jdbcTemplate, "investment_image", "investment_id", "img_id")
        || !hasColumns(jdbcTemplate, "image", "img_id", "img_url")) {
      return;
    }
    List<Integer> ids =
        rows.stream()
            .map(row -> row.get("investmentId"))
            .filter(Number.class::isInstance)
            .map(Number.class::cast)
            .map(Number::intValue)
            .distinct()
            .toList();
    if (ids.isEmpty()) {
      return;
    }
    Map<Integer, List<String>> imagesByInvestment = new LinkedHashMap<>();
    for (Integer id : ids) {
      imagesByInvestment.put(id, new ArrayList<>());
    }
    String orderBy = hasColumn(jdbcTemplate, "investment_image", "id") ? "ii.id ASC" : "ii.investment_id ASC";
    jdbcTemplate
        .query(
            """
            SELECT ii.investment_id, i.img_url
            FROM investment_image ii
            INNER JOIN image i ON i.img_id = ii.img_id
            WHERE ii.investment_id IN (
            """
                + placeholders(ids.size())
                + """
            )
              AND i.img_url IS NOT NULL
              AND i.img_url <> ''
            ORDER BY
            """
                + orderBy,
            (rs, rowNum) -> Map.of("id", rs.getInt("investment_id"), "url", rs.getString("img_url")),
            ids.toArray())
        .forEach(
            image ->
                imagesByInvestment
                    .computeIfAbsent((Integer) image.get("id"), ignored -> new ArrayList<>())
                    .add((String) image.get("url")));
    for (Map<String, Object> row : rows) {
      Object id = row.get("investmentId");
      if (id instanceof Number number) {
        row.put("imageUrlList", imagesByInvestment.getOrDefault(number.intValue(), List.of()));
      }
    }
  }

  private boolean hasColumns(JdbcTemplate jdbcTemplate, String tableName, String... columns) {
    Set<String> currentColumns = columnSet(jdbcTemplate, tableName);
    for (String column : columns) {
      if (!currentColumns.contains(column.toLowerCase(Locale.ROOT))) {
        return false;
      }
    }
    return true;
  }

  private boolean hasColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
    return columnSet(jdbcTemplate, tableName).contains(columnName.toLowerCase(Locale.ROOT));
  }

  private Set<String> columnSet(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate
        .queryForList(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            String.class,
            tableName)
        .stream()
        .map(name -> name.toLowerCase(Locale.ROOT))
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private Map<String, Object> listResult(List<Map<String, Object>> items, long total) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("total", total);
    return result;
  }

  private Map<String, Object> pageResult(
      List<Map<String, Object>> items, long total, int currentPage, int pageSize) {
    Map<String, Object> result = listResult(items, total);
    Map<String, Object> page = new LinkedHashMap<>();
    page.put("currentPage", currentPage);
    page.put("pageSize", pageSize);
    page.put("total", total);
    result.put("page", page);
    return result;
  }

  private void appendEquals(List<String> conditions, List<Object> args, String sql, String value) {
    if (!StringUtils.hasText(value)) {
      return;
    }
    conditions.add(sql);
    args.add(value.trim());
  }

  private void appendLike(List<String> conditions, List<Object> args, String sql, String value) {
    if (!StringUtils.hasText(value)) {
      return;
    }
    conditions.add(sql);
    args.add(like(value));
  }

  private long count(JdbcTemplate jdbcTemplate, String sql, List<Object> args) {
    Long total = jdbcTemplate.queryForObject(sql, Long.class, args.toArray());
    return total == null ? 0 : total;
  }

  private String placeholders(int count) {
    if (count <= 0) {
      return "NULL";
    }
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private String like(String value) {
    return "%" + value.trim() + "%";
  }

  private Double parseDouble(String value) {
    try {
      return Double.parseDouble(String.valueOf(value).trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Object parseJsonArray(String value, boolean nullWhenEmpty) {
    if (!StringUtils.hasText(value)) {
      return nullWhenEmpty ? null : List.of();
    }
    try {
      List<Object> parsed = objectMapper.readValue(value, new TypeReference<>() {});
      return parsed.stream().map(String::valueOf).filter(StringUtils::hasText).toList();
    } catch (Exception error) {
      return nullWhenEmpty ? null : List.of();
    }
  }

  private Object parseJsonObject(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      Object parsed = objectMapper.readValue(value, new TypeReference<Map<String, Object>>() {});
      return parsed instanceof Map<?, ?> ? parsed : null;
    } catch (Exception error) {
      return null;
    }
  }

  private Map<String, Object> normalizeDetailJsonObject(Object value) {
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> result = new LinkedHashMap<>();
      map.forEach((key, item) -> result.put(String.valueOf(key), item));
      return result;
    }
    if (StringUtils.hasText(stringObject(value))) {
      Object parsed = parseJsonObject(stringObject(value));
      if (parsed instanceof Map<?, ?> map) {
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
      }
    }
    return new LinkedHashMap<>();
  }

  private boolean booleanValue(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    return "true".equalsIgnoreCase(String.valueOf(value)) || "1".equals(String.valueOf(value));
  }

  private boolean isTruthyText(String value) {
    String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    return "1".equals(normalized) || "true".equals(normalized) || "yes".equals(normalized) || "on".equals(normalized);
  }

  private int daysBetween(Instant start, Instant end) {
    if (start == null || end == null) {
      return 0;
    }
    long seconds = end.getEpochSecond() - start.getEpochSecond();
    return (int) Math.max(0, Math.ceil(seconds / 86_400.0));
  }

  private int internalContractConfidenceScore(int daysLeft) {
    if (daysLeft <= 15) {
      return 92;
    }
    if (daysLeft <= 30) {
      return 84;
    }
    if (daysLeft <= 60) {
      return 74;
    }
    return 66;
  }

  private Object numericObject(Object value) {
    if (value instanceof BigDecimal decimal) {
      return decimal.stripTrailingZeros();
    }
    return value;
  }

  private BigDecimal decimalObject(Object value) {
    BigDecimal decimal = bigDecimalOrNull(value);
    return decimal == null ? BigDecimal.ZERO : decimal;
  }

  private BigDecimal bigDecimalOrNull(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    String text = stringObject(value);
    if (!StringUtils.hasText(text)) {
      return null;
    }
    String normalized = text.trim().replace(",", "").replace("，", "");
    if (normalized.endsWith("%")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    try {
      return new BigDecimal(normalized);
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private long longValue(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException error) {
      return 0;
    }
  }

  private double importNumber(Map<String, Object> raw, double fallback, String... keys) {
    Object value = firstImportValue(raw, keys);
    BigDecimal decimal = bigDecimalOrNull(value);
    return decimal == null ? fallback : decimal.doubleValue();
  }

  private double doubleValue(Object value) {
    if (value instanceof Number number) {
      return number.doubleValue();
    }
    try {
      return Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException error) {
      return 0;
    }
  }

  private long sumLong(List<Map<String, Object>> rows, String key) {
    return rows.stream().map(row -> row.get(key)).mapToLong(this::longValue).sum();
  }

  private double rate(Object numerator, Object denominator) {
    double denominatorValue = doubleValue(denominator);
    if (denominatorValue <= 0) {
      return 0;
    }
    return Math.round((doubleValue(numerator) / denominatorValue) * 1000.0) / 10.0;
  }

  private double round1(Object value) {
    return Math.round(doubleValue(value) * 10.0) / 10.0;
  }

  private double channelCost(String channel) {
    return switch (defaultString(channel)) {
      case "CALL" -> 8;
      case "EMAIL" -> 1;
      case "SMS" -> 0.08;
      case "VISIT" -> 120;
      case "WECHAT" -> 2;
      default -> 1;
    };
  }

  private String opportunityTypeLabel(String opportunityType) {
    return switch (defaultString(opportunityType).toUpperCase(Locale.ROOT)) {
      case "DEMAND" -> "需求";
      case "SUPPLY" -> "房源";
      default -> "其他";
    };
  }

  private String csvCell(Object value) {
    String text = value == null ? "" : String.valueOf(value);
    return "\"" + text.replace("\"", "\"\"") + "\"";
  }

  private String settingValue(String name) {
    String value = System.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private long positiveLong(String value, long fallback) {
    long parsed = longValue(value);
    return parsed > 0 ? parsed : fallback;
  }

  private int normalizedHour(long value, int fallback) {
    return value >= 0 && value <= 23 ? (int) value : fallback;
  }

  private long durationMillisSince(Instant startedAt) {
    return Math.max(0, Instant.now().toEpochMilli() - startedAt.toEpochMilli());
  }

  private String nextDailyRunAt(int dailyRunHour) {
    ZonedDateTime nextRunAt = ZonedDateTime.now().withHour(dailyRunHour).withMinute(0).withSecond(0).withNano(0);
    if (!nextRunAt.isAfter(ZonedDateTime.now())) {
      nextRunAt = nextRunAt.plusDays(1);
    }
    return nextRunAt.toInstant().toString();
  }

  private String cleanText(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private String cleanTextMax(String value, int maxLength) {
    String text = cleanText(value);
    return text == null ? null : trimToMax(text, maxLength);
  }

  private String trimToMax(String value, int maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }

  private String requiredText(String value, String message, int maxLength) {
    String text = cleanTextMax(value, maxLength);
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return text;
  }

  private Object blankToNullObject(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private void appendInvestmentStringValue(
      List<String> columns, List<Object> args, String columnName, String value) {
    if (value == null) {
      return;
    }
    columns.add(columnName);
    args.add(blankToNullObject(value));
  }

  private List<String> normalizePropertyTags(Object input) {
    List<String> rawItems = new ArrayList<>();
    if (input instanceof List<?> list) {
      rawItems.addAll(list.stream().map(item -> item == null ? "" : String.valueOf(item)).toList());
    } else if (StringUtils.hasText(stringObject(input))) {
      rawItems.addAll(
          java.util.Arrays.stream(String.valueOf(input).split("[,，、\\n]"))
              .map(String::trim)
              .toList());
    }
    return rawItems.stream()
        .map(item -> item == null ? "" : item.trim())
        .filter(StringUtils::hasText)
        .map(item -> item.length() > 50 ? item.substring(0, 50) : item)
        .distinct()
        .limit(30)
        .toList();
  }

  private String compactPropertyTags(List<String> tags) {
    String text = tags.stream().limit(3).collect(Collectors.joining("、"));
    if (text.length() > 50) {
      text = text.substring(0, 50);
    }
    return StringUtils.hasText(text) ? text : null;
  }

  private String jsonString(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("Unable to serialize radar payload", error);
    }
  }

  private Integer nullablePositiveInteger(Object value, String message) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number number) {
      int parsed = number.intValue();
      if (parsed <= 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, message);
      }
      return parsed;
    }
    String text = String.valueOf(value).trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      int parsed = Integer.parseInt(text);
      if (parsed <= 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, message);
      }
      return parsed;
    } catch (NumberFormatException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Integer nullableIntegerObject(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (!StringUtils.hasText(stringObject(value))) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value).trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private int positiveIntegerOrDefault(Object value, int fallback, int min, int max) {
    Integer parsed = nullableIntegerObject(value);
    int result = parsed == null ? fallback : parsed;
    if (result < min) {
      return min;
    }
    if (result > max) {
      return max;
    }
    return result;
  }

  private boolean booleanValueOrDefault(Object value, boolean fallback) {
    if (value == null) {
      return fallback;
    }
    return booleanValue(value);
  }

  private Integer nullableIntegerInRange(Object value, int min, int max) {
    Integer parsed = nullableIntegerObject(value);
    if (parsed == null) {
      return null;
    }
    if (parsed < min) {
      return min;
    }
    if (parsed > max) {
      return max;
    }
    return parsed;
  }

  private int positiveInteger(Object value, String message) {
    Integer parsed = nullablePositiveInteger(value, message);
    if (parsed == null || parsed <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return parsed;
  }

  private int nonNegativeInteger(Object value, String message) {
    Integer parsed = nullablePositiveIntegerAllowZero(value, message);
    if (parsed == null || parsed < 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return parsed;
  }

  private Integer nullablePositiveIntegerAllowZero(Object value, String message) {
    if (value instanceof Number number) {
      int parsed = number.intValue();
      if (parsed < 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, message);
      }
      return parsed;
    }
    try {
      int parsed = Integer.parseInt(String.valueOf(value).trim());
      if (parsed < 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, message);
      }
      return parsed;
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Timestamp toTimestamp(String value, String message) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String text = value.trim();
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with offset/local legacy date-time formats.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss or yyyy-MM-ddTHH:mm:ss.
    }
    try {
      String normalized = text.replace('T', ' ');
      if (normalized.length() == 10) {
        normalized = normalized + " 00:00:00";
      }
      return Timestamp.valueOf(LocalDateTime.parse(normalized.replace(' ', 'T')));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Timestamp parsePublishedTimestamp(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String normalized = value.trim().replace("年", "-").replace("月", "-").replace("日", "");
    try {
      if (normalized.matches("\\d{4}-\\d{1,2}-\\d{1,2}")) {
        String[] parts = normalized.split("-");
        return Timestamp.valueOf(
            LocalDateTime.of(
                Integer.parseInt(parts[0]),
                Integer.parseInt(parts[1]),
                Integer.parseInt(parts[2]),
                0,
                0));
      }
      return toTimestamp(normalized, "publishedAt 无效");
    } catch (RuntimeException error) {
      return null;
    }
  }

  private void appendCrawlerJsonArrayUpdate(
      List<String> assignments, List<Object> args, String columnName, List<String> value) {
    if (value == null) {
      return;
    }
    List<String> normalized =
        value.stream()
            .map(item -> item == null ? "" : item.trim())
            .filter(StringUtils::hasText)
            .toList();
    assignments.add(columnName + " = ?");
    args.add(toJsonOrNull(normalized));
  }

  private void validateCrawlerSourcePolicyUpdate(String sourceCode, CrawlerSourceUpdateRequest request) {
    if (request == null || request.allowedPathsJson() == null) {
      return;
    }
    List<String> normalized =
        request.allowedPathsJson().stream()
            .map(item -> item == null ? "" : item.trim().toLowerCase(Locale.ROOT))
            .filter(StringUtils::hasText)
            .toList();
    if (PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE.equals(sourceCode)
        && !normalized.equals(PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS)) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "99cfw pilot only allows /changfangxuqiu/ path policy");
    }
    if (PUBLIC_FACTORY_CFZSW68_SOURCE_CODE.equals(sourceCode)
        && (normalized.isEmpty() || !PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS.containsAll(normalized))) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "cfzsw68 pilot only allows configured city path policy");
    }
  }

  private String toJsonOrNull(List<String> value) {
    if (value.isEmpty()) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("Unable to serialize crawler source policy", error);
    }
  }

  private long positiveLongObject(Object value, String message) {
    Long parsed = nullableLongObject(value);
    if (parsed == null || parsed <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return parsed;
  }

  private Timestamp toTimestampOrNow(String value, String message) {
    if (!StringUtils.hasText(value)) {
      return Timestamp.from(Instant.now());
    }
    Timestamp timestamp = toTimestamp(value, message);
    return timestamp == null ? Timestamp.from(Instant.now()) : timestamp;
  }

  private OutreachTemplateFields outreachTemplateFields(OutreachTemplateSaveRequest request) {
    return new OutreachTemplateFields(
        defaultString(cleanText(request == null ? null : request.channel()), "SMS"),
        requiredOutreachTemplateText(request == null ? null : request.content(), "content 不能为空"),
        normalizeOutreachPlaceholderJson(request == null ? null : request.placeholderJson()),
        defaultString(cleanText(request == null ? null : request.priorityLevel()), "C"),
        defaultString(cleanText(request == null ? null : request.taskType()), "OUTREACH"),
        requiredOutreachTemplateText(request == null ? null : request.templateCode(), "templateCode 不能为空"),
        requiredOutreachTemplateText(request == null ? null : request.templateName(), "templateName 不能为空"));
  }

  private String requiredOutreachTemplateText(String value, String message) {
    String text = cleanText(value);
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return text;
  }

  private String normalizeOutreachPlaceholderJson(Object value) {
    List<String> placeholders = new ArrayList<>();
    if (value instanceof List<?> list) {
      placeholders.addAll(normalizedStringList(list));
    } else {
      String text = value == null ? "" : String.valueOf(value).trim();
      if (StringUtils.hasText(text)) {
        try {
          List<Object> parsed = objectMapper.readValue(text, new TypeReference<>() {});
          placeholders.addAll(normalizedStringList(parsed));
        } catch (Exception ignored) {
          placeholders.addAll(
              java.util.Arrays.stream(text.split(","))
                  .map(String::trim)
                  .filter(StringUtils::hasText)
                  .toList());
        }
      }
    }
    try {
      return objectMapper.writeValueAsString(placeholders);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("Unable to serialize outreach template placeholders", error);
    }
  }

  private List<String> normalizedStringList(List<?> list) {
    return list.stream()
        .map(item -> item == null ? "" : String.valueOf(item).trim())
        .filter(StringUtils::hasText)
        .toList();
  }

  private String stringObject(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return null;
  }

  private Object firstImportValue(Map<String, Object> raw, String... keys) {
    if (raw == null || raw.isEmpty()) {
      return null;
    }
    for (String key : keys) {
      if (!StringUtils.hasText(key)) {
        continue;
      }
      if (raw.containsKey(key)) {
        Object value = raw.get(key);
        if (value != null && StringUtils.hasText(stringObject(value))) {
          return value;
        }
      }
      for (Map.Entry<String, Object> entry : raw.entrySet()) {
        if (key.equalsIgnoreCase(defaultString(entry.getKey()))) {
          Object value = entry.getValue();
          if (value != null && StringUtils.hasText(stringObject(value))) {
            return value;
          }
        }
      }
    }
    return null;
  }

  private String firstImportText(Map<String, Object> raw, String... keys) {
    Object value = firstImportValue(raw, keys);
    return cleanText(stringObject(value));
  }

  private String normalizeRadarLeadStage(String value) {
    String text = defaultString(value).trim().toUpperCase(Locale.ROOT);
    if (!StringUtils.hasText(text)) {
      return "NEW";
    }
    return switch (text) {
      case "NEW", "新线索", "新建", "新增" -> "NEW";
      case "PENDING_CONTACT", "待联系", "待触达", "待跟进" -> "PENDING_CONTACT";
      case "CONTACTED", "已联系", "已触达" -> "CONTACTED";
      case "REPLIED", "已回复", "有回复", "有意向" -> "REPLIED";
      case "VISIT", "已邀约", "看房", "到访" -> "VISIT";
      case "DEAL", "成交", "已成交" -> "DEAL";
      case "INVALID", "无效", "失效" -> "INVALID";
      default -> "NEW";
    };
  }

  private String normalizeRadarPriorityLevel(String value, int score) {
    String text = defaultString(value).trim().toUpperCase(Locale.ROOT);
    if (Set.of("A", "B", "C", "D").contains(text)) {
      return text;
    }
    return switch (text) {
      case "高", "高优先级", "HIGH" -> "A";
      case "中", "中优先级", "MEDIUM" -> "B";
      case "低", "低优先级", "LOW" -> "C";
      default -> resolvePriorityLevel(score);
    };
  }

  private Long nullableLongObject(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    if (!StringUtils.hasText(stringObject(value))) {
      return null;
    }
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Integer nullableInteger(ResultSet rs, String columnName) throws SQLException {
    int value = rs.getInt(columnName);
    return rs.wasNull() ? null : value;
  }

  private Long nullableLong(ResultSet rs, String columnName) throws SQLException {
    long value = rs.getLong(columnName);
    return rs.wasNull() ? null : value;
  }

  private Long safeLong(ResultSet rs, String columnName) throws SQLException {
    try {
      return nullableLong(rs, columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private Timestamp safeTimestamp(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getTimestamp(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private Instant instantValue(Object value, Instant fallback) {
    if (value == null) {
      return fallback;
    }
    if (value instanceof Instant instant) {
      return instant;
    }
    if (value instanceof Timestamp timestamp) {
      return timestamp.toInstant();
    }
    try {
      return Instant.parse(String.valueOf(value));
    } catch (Exception error) {
      return fallback;
    }
  }

  private Instant firstInstant(Object... values) {
    for (Object value : values) {
      Instant instant = instantValue(value, null);
      if (instant != null) {
        return instant;
      }
    }
    return null;
  }

  private Instant latestInstant(Instant... values) {
    Instant latest = null;
    for (Instant value : values) {
      if (value != null && (latest == null || value.isAfter(latest))) {
        latest = value;
      }
    }
    return latest;
  }

  private String defaultString(String value) {
    return value == null ? "" : value;
  }

  private String defaultString(String value, String fallback) {
    return StringUtils.hasText(value) ? value : fallback;
  }

  private String nullableString(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}
