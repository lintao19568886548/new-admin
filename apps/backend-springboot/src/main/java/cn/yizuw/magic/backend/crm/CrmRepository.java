package cn.yizuw.magic.backend.crm;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * CRM 中心库数据访问层。
 *
 * <p>CRM 表属于中心库，迁移期继续通过 `information_schema.columns` 检测表结构，避免未 db push 的环境直接抛
 * SQL 语法错误。
 */
@Repository
public class CrmRepository {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private static final List<String> CRM_TABLES =
      List.of(
          "crm_sales_channel",
          "crm_customer_owner_binding",
          "crm_scan_log",
          "crm_wework_contact_way",
          "crm_external_contact_log");

  private final JdbcTemplate centerJdbcTemplate;

  public CrmRepository(@Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /** CRM 概览统计，按销售范围过滤。 */
  public Map<String, Object> findOverview(Integer salesUserId, Instant now) {
    ensureCrmTables();
    Timestamp todayStart =
        Timestamp.valueOf(LocalDate.ofInstant(now, ZoneId.systemDefault()).atStartOfDay());
    List<Integer> scopedBindingIds = salesUserId == null ? List.of() : activeBindingIds(salesUserId);
    String channelWhere = salesUserId == null ? "" : " WHERE sales_user_id = ?";
    String bindingWhere = salesUserId == null ? "" : " WHERE owner_sales_user_id = ?";
    String scanWhere =
        salesUserId == null
            ? ""
            : " WHERE (requested_sales_user_id = ? OR resolved_sales_user_id = ?)";
    String contactWayWhere = salesUserId == null ? "" : " WHERE sales_user_id = ?";
    ExternalScope externalScope = externalScope(salesUserId, scopedBindingIds);

    long channelTotal = count("crm_sales_channel", channelWhere, singleArg(salesUserId));
    long activeChannelTotal =
        count(
            "crm_sales_channel",
            appendCondition(channelWhere, "status = 1"),
            salesUserId == null ? List.of() : List.of(salesUserId));
    long bindingTotal = count("crm_customer_owner_binding", bindingWhere, singleArg(salesUserId));
    long activeBindingTotal =
        count(
            "crm_customer_owner_binding",
            appendCondition(bindingWhere, "status = 1"),
            salesUserId == null ? List.of() : List.of(salesUserId));
    long scanTotal = count("crm_scan_log", scanWhere, scanArgs(salesUserId));
    long todayScanTotal =
        count(
            "crm_scan_log",
            appendCondition(scanWhere, "create_time >= ?"),
            appendArgs(scanArgs(salesUserId), todayStart));
    long firstBindTotal =
        count(
            "crm_scan_log",
            appendCondition(scanWhere, "is_first_bind = true"),
            scanArgs(salesUserId));
    long contactWayTotal =
        count("crm_wework_contact_way", contactWayWhere, singleArg(salesUserId));
    long activeContactWayTotal =
        count(
            "crm_wework_contact_way",
            appendCondition(contactWayWhere, "status = 1"),
            salesUserId == null ? List.of() : List.of(salesUserId));
    long externalContactTotal =
        count("crm_external_contact_log", externalScope.where(), externalScope.args());
    long todayExternalContactTotal =
        count(
            "crm_external_contact_log",
            appendCondition(externalScope.where(), "create_time >= ?"),
            appendArgs(externalScope.args(), todayStart));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put(
        "bindings", Map.of("active", activeBindingTotal, "total", bindingTotal));
    result.put(
        "channels",
        Map.of(
            "active",
            activeChannelTotal,
            "disabled",
            Math.max(channelTotal - activeChannelTotal, 0),
            "total",
            channelTotal));
    result.put(
        "contactWays", Map.of("active", activeContactWayTotal, "total", contactWayTotal));
    result.put(
        "externalContacts",
        Map.of("today", todayExternalContactTotal, "total", externalContactTotal));
    result.put(
        "scans", Map.of("firstBind", firstBindTotal, "today", todayScanTotal, "total", scanTotal));
    result.put("updatedAt", Instant.now().toString());
    return result;
  }

  /** 销售获客渠道分页列表，附带扫码、绑定和企微外部联系人统计。 */
  public Map<String, Object> findSalesChannels(
      CrmSalesChannelQuery query, Integer scopedSalesUserId) {
    ensureCrmTables();
    List<Object> args = new ArrayList<>();
    String where = salesChannelWhere(query, scopedSalesUserId, args);
    long total = count("crm_sales_channel", where, args);
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_sales_channel
            """
                + where
                + """
            ORDER BY create_time DESC
            LIMIT ?, ?
            """,
            (rs, rowNum) -> salesChannelMap(rs),
            pageArgs.toArray());
    enrichSalesChannelStats(rows);
    return page(query.currentPage(), query.pageSize(), rows, total);
  }

  /** 新增销售渠道；只写中心库 crm_sales_channel 主表，不生成二维码。 */
  public Map<String, Object> createSalesChannel(
      CrmSalesChannelCreateRequest request, Integer salesUserId, Integer createdById) {
    ensureCrmTables();
    Map<String, Object> salesUser = findActiveUser(salesUserId);
    if (salesUser == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "销售用户不存在或已停用");
    }
    String scene =
        StringUtils.hasText(text(request == null ? null : request.scene(), 32))
            ? normalizeScene(request.scene())
            : "crm_sales_" + salesUserId + "_" + System.currentTimeMillis();
    String defaultSalesName = firstText(salesUser.get("realName"), salesUser.get("username"));
    String channelName =
        firstText(
            text(request == null ? null : request.channelName(), 100),
            firstText(defaultSalesName, salesUserId) + "-默认渠道");
    String channelType = firstText(text(request == null ? null : request.channelType(), 32), "sales");
    String salesName = firstText(text(request == null ? null : request.salesName(), 50), defaultSalesName);
    String weworkUserId = text(request == null ? null : request.weworkUserId(), 100);
    String qrCodeUrl = text(request == null ? null : request.qrCodeUrl(), 1024);
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO crm_sales_channel
            (scene, sales_user_id, sales_name, wework_user_id, channel_name, channel_type,
             qr_code_url, status, created_by_id, create_time, update_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          """,
          scene,
          salesUserId,
          nullIfBlank(salesName),
          nullIfBlank(weworkUserId),
          channelName,
          channelType,
          nullIfBlank(qrCodeUrl),
          createdById);
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "该 scene 已存在，请换一个 scene");
    }
    return findSalesChannelByScene(scene);
  }

  /** 更新销售渠道主表白名单字段。 */
  public Map<String, Object> updateSalesChannel(int channelId, CrmSalesChannelUpdateRequest request) {
    ensureCrmTables();
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendRequiredText(assignments, args, "channel_name", request == null ? null : request.channelName(), 100);
    appendOptionalText(assignments, args, "channel_type", request == null ? null : request.channelType(), 32, "sales");
    appendOptionalText(assignments, args, "sales_name", request == null ? null : request.salesName(), 50, null);
    appendOptionalText(assignments, args, "wework_user_id", request == null ? null : request.weworkUserId(), 100, null);
    appendOptionalText(assignments, args, "qr_code_url", request == null ? null : request.qrCodeUrl(), 1024, null);
    if (request != null && request.status() != null) {
      assignments.add("status = ?");
      args.add(statusValue(request.status()));
    }
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有需要更新的渠道字段");
    }
    assignments.add("update_time = CURRENT_TIMESTAMP");
    args.add(channelId);
    int updated =
        centerJdbcTemplate.update(
            "UPDATE crm_sales_channel SET " + String.join(", ", assignments) + " WHERE id = ?",
            args.toArray());
    if (updated == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "销售渠道不存在");
    }
    return findSalesChannelById(channelId);
  }

  /** CRM 扫码日志分页列表，附带渠道名和销售显示名。 */
  public Map<String, Object> findScanLogs(CrmScanLogQuery query, Integer scopedSalesUserId) {
    ensureCrmTables();
    List<Object> args = new ArrayList<>();
    String where = scanLogWhere(query, scopedSalesUserId, args);
    long total = count("crm_scan_log", where, args);
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_scan_log
            """
                + where
                + """
            ORDER BY create_time DESC
            LIMIT ?, ?
            """,
            (rs, rowNum) -> scanLogMap(rs),
            pageArgs.toArray());
    enrichScanLogDisplay(rows);
    return page(query.currentPage(), query.pageSize(), rows, total);
  }

  /** 查询可用销售渠道；供公开 H5 邀请二维码使用，不强制依赖 CRM 其他表。 */
  public Map<String, Object> findActiveSalesChannelByScene(String scene) {
    ensureSalesChannelTable();
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_sales_channel
            WHERE scene = ?
              AND status = 1
            LIMIT 1
            """,
            (rs, rowNum) -> salesChannelMap(rs),
            scene);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "二维码渠道不存在或已停用");
    }
    return rows.get(0);
  }

  /** 解析公开邀请扫码归属；只写本地 CRM 绑定和扫码日志。 */
  public Map<String, Object> resolveInvite(CrmInviteResolveRequest request) {
    ensureCrmTables();
    String scene = normalizeScene(request == null ? null : request.scene());
    Identity identity =
        new Identity(
            text(request == null ? null : request.customerName(), 50),
            normalizeCrmPhone(request == null ? null : request.phone()),
            text(request == null ? null : request.openid(), 128),
            text(request == null ? null : request.unionid(), 128));
    String ip = text(request == null ? null : request.ip(), 64);
    String userAgent = text(request == null ? null : request.userAgent(), 255);
    String source = detectCrmScanSource(request == null ? null : request.source(), userAgent);
    Map<String, Object> channel = findActiveSalesChannelByScene(scene);
    Integer requestedSalesUserId = objectInteger(channel.get("salesUserId"));

    if (!hasIdentity(identity)) {
      writeInviteScanLog(
          null, channel, identity, false, requestedSalesUserId, null, scene, source, ip, userAgent);
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("binding", null);
      result.put("bound", false);
      result.put("channel", channel);
      result.put("identityRequired", true);
      result.put("isFirstBind", false);
      result.put("owner", getOwnerProfile(requestedSalesUserId));
      result.put("reason", "IDENTITY_REQUIRED");
      return result;
    }

    Map<String, Object> binding = findOwnerBindingByIdentity(identity, 1);
    boolean firstBind = false;
    if (binding == null) {
      binding = findOwnerBindingByIdentity(identity, 0);
    }
    if (binding == null) {
      firstBind = true;
      try {
        centerJdbcTemplate.update(
            """
            INSERT INTO crm_customer_owner_binding
              (customer_name, external_user_id, first_channel_id, first_scene, last_scan_at,
               openid, owner_sales_user_id, owner_wework_user_id, phone, unionid, status,
               create_time, update_time)
            VALUES (?, NULL, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            nullIfBlank(identity.customerName()),
            objectInteger(channel.get("id")),
            scene,
            nullIfBlank(identity.openid()),
            requestedSalesUserId,
            nullIfBlank(defaultString(channel.get("weworkUserId"))),
            nullIfBlank(identity.phone()),
            nullIfBlank(identity.unionid()));
        binding = findOwnerBindingByIdentity(identity);
      } catch (DuplicateKeyException error) {
        firstBind = false;
        binding = findOwnerBindingByIdentity(identity);
      }
    } else {
      binding = updateCrmBindingLastScan(binding, identity);
    }
    if (binding == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "解析扫码归属失败");
    }

    Identity scanIdentity =
        new Identity(
            firstText(identity.customerName(), binding.get("customerName")),
            firstText(identity.phone(), binding.get("phone")),
            firstText(identity.openid(), binding.get("openid")),
            firstText(identity.unionid(), binding.get("unionid")));
    writeInviteScanLog(
        binding,
        channel,
        scanIdentity,
        firstBind,
        requestedSalesUserId,
        objectInteger(binding.get("ownerSalesUserId")),
        scene,
        source,
        ip,
        userAgent);
    Map<String, Object> owner = getOwnerProfile(objectInteger(binding.get("ownerSalesUserId")));
    String ownerWeworkUserId = defaultString(binding.get("ownerWeworkUserId"));
    if (StringUtils.hasText(ownerWeworkUserId)) {
      owner.put("weworkUserId", ownerWeworkUserId);
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("binding", binding);
    result.put("channel", channel);
    result.put("isFirstBind", firstBind);
    result.put("owner", owner);
    return result;
  }

  /** 查询有效企微联系方式记录；用于避免重复生成本地兼容二维码。 */
  public Map<String, Object> findActiveContactWay(int salesUserId, String state) {
    ensureCrmTables();
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_wework_contact_way
            WHERE sales_user_id = ?
              AND state = ?
              AND status = 1
            ORDER BY update_time DESC, create_time DESC
            LIMIT 1
            """,
            (rs, rowNum) -> contactWayMap(rs),
            salesUserId,
            text(state, 128));
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 解析销售对应的企微用户 ID；优先请求参数，再复用渠道和历史联系方式。 */
  public String resolveContactWayWeworkUserId(int salesUserId, String explicitWeworkUserId) {
    ensureCrmTables();
    return resolveWeworkUserId(salesUserId, explicitWeworkUserId, null);
  }

  /** 保存本地兼容企微联系方式；按旧表 state 唯一键语义做 upsert。 */
  public Map<String, Object> saveLocalContactWay(
      int salesUserId, String state, String weworkUserId, String configId, String qrCode) {
    ensureCrmTables();
    String normalizedState = text(state, 128);
    String normalizedConfigId = text(configId, 128);
    String normalizedQrCode = text(qrCode, 1024);
    String normalizedWeworkUserId = text(weworkUserId, 100);
    if (!StringUtils.hasText(normalizedWeworkUserId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "weworkUserId不能为空");
    }
    centerJdbcTemplate.update(
        """
        INSERT INTO crm_wework_contact_way
          (sales_user_id, wework_user_id, config_id, qr_code, state, status, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          sales_user_id = VALUES(sales_user_id),
          wework_user_id = VALUES(wework_user_id),
          config_id = VALUES(config_id),
          qr_code = VALUES(qr_code),
          status = 1,
          update_time = CURRENT_TIMESTAMP
        """,
        salesUserId,
        normalizedWeworkUserId,
        nullIfBlank(normalizedConfigId),
        nullIfBlank(normalizedQrCode),
        normalizedState);
    Map<String, Object> saved = findActiveContactWay(salesUserId, normalizedState);
    if (saved == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "保存企业微信联系二维码失败");
    }
    return saved;
  }

  /** 客户归属绑定分页列表。 */
  public Map<String, Object> findOwnerBindings(
      CrmOwnerBindingQuery query, Integer scopedSalesUserId) {
    ensureCrmTables();
    List<Object> args = new ArrayList<>();
    String where = ownerBindingWhere(query, scopedSalesUserId, args);
    long total = count("crm_customer_owner_binding", where, args);
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_customer_owner_binding
            """
                + where
                + """
            ORDER BY last_scan_at DESC, create_time DESC
            LIMIT ?, ?
            """,
            (rs, rowNum) -> ownerBindingMap(rs),
            pageArgs.toArray());
    enrichOwnerBindingDisplay(rows);
    return page(query.currentPage(), query.pageSize(), rows, total);
  }

  /** 判断销售渠道是否属于当前销售，用于普通账号写入权限校验。 */
  public boolean salesChannelBelongsTo(int channelId, int salesUserId) {
    ensureCrmTables();
    Integer count =
        centerJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM crm_sales_channel WHERE id = ? AND sales_user_id = ?",
            Integer.class,
            channelId,
            salesUserId);
    return count != null && count > 0;
  }

  /** 判断客户归属是否属于当前销售，用于普通账号写入权限校验。 */
  public boolean ownerBindingBelongsTo(int bindingId, int salesUserId) {
    ensureCrmTables();
    Integer count =
        centerJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM crm_customer_owner_binding WHERE id = ? AND owner_sales_user_id = ?",
            Integer.class,
            bindingId,
            salesUserId);
    return count != null && count > 0;
  }

  /** 启停客户归属，并写入本地 crm_scan_log 审计记录。 */
  public Map<String, Object> updateOwnerBindingStatus(
      int bindingId, CrmOwnerBindingStatusRequest request, Integer operatorUserId) {
    ensureCrmTables();
    Map<String, Object> binding = findOwnerBindingById(bindingId);
    if (binding == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "客户归属绑定不存在");
    }
    int status = statusValue(request == null ? null : request.status());
    int updated =
        centerJdbcTemplate.update(
            """
            UPDATE crm_customer_owner_binding
            SET status = ?, last_scan_at = CURRENT_TIMESTAMP, update_time = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            status,
            bindingId);
    if (updated == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "客户归属绑定不存在");
    }
    writeBindingStatusScanLog(binding, status, request == null ? null : request.reason(), operatorUserId);
    Map<String, Object> result = findOwnerBindingById(bindingId);
    return result == null ? Map.of() : result;
  }

  /** 手工新增客户归属；只写中心库 crm_customer_owner_binding 和 crm_scan_log。 */
  public Map<String, Object> createOwnerBinding(
      CrmOwnerBindingCreateRequest request, Integer ownerSalesUserId, Integer operatorUserId) {
    ensureCrmTables();
    Identity identity = identityFromCreate(request);
    Map<String, Object> salesUser = findActiveUser(ownerSalesUserId);
    if (salesUser == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "目标销售用户不存在或已停用");
    }
    if (findOwnerBindingByIdentity(identity) != null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "该客户已存在，请直接编辑原客户归属");
    }
    Map<String, Object> channel =
        resolveManualBindingChannel(
            ownerSalesUserId,
            request == null ? null : request.firstChannelId(),
            request == null ? null : request.scene());
    String firstScene = firstText(channel == null ? null : channel.get("scene"), "manual_" + ownerSalesUserId);
    String ownerWeworkUserId =
        resolveWeworkUserId(
            ownerSalesUserId, channel == null ? null : channel.get("weworkUserId"), null);
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO crm_customer_owner_binding
            (customer_name, external_user_id, first_channel_id, first_scene, last_scan_at,
             openid, owner_sales_user_id, owner_wework_user_id, phone, unionid, status,
             create_time, update_time)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          """,
          nullIfBlank(identity.customerName()),
          nullIfBlank(text(request == null ? null : request.externalUserId(), 128)),
          channel == null ? null : objectInteger(channel.get("id")),
          firstScene.length() <= 64 ? firstScene : firstScene.substring(0, 64),
          nullIfBlank(identity.openid()),
          ownerSalesUserId,
          nullIfBlank(ownerWeworkUserId),
          nullIfBlank(identity.phone()),
          nullIfBlank(identity.unionid()));
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "手机号、OpenID 或 UnionID 已存在");
    }
    Map<String, Object> created = findOwnerBindingByIdentity(identity);
    if (created == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "新增客户归属失败");
    }
    writeOwnerBindingScanLog(
        created,
        identity,
        true,
        ownerSalesUserId,
        ownerSalesUserId,
        "manual_create",
        null,
        operatorUserId);
    return findOwnerBindingById(objectInteger(created.get("id")));
  }

  /** 编辑客户归属身份字段，并写入本地扫码审计。 */
  public Map<String, Object> updateOwnerBinding(
      int bindingId, CrmOwnerBindingUpdateRequest request, Integer operatorUserId) {
    ensureCrmTables();
    Identity identity = identityFromUpdate(request);
    Map<String, Object> binding = requireOwnerBinding(bindingId);
    Map<String, Object> duplicated = findOwnerBindingByIdentity(identity);
    if (duplicated != null && objectInteger(duplicated.get("id")) != bindingId) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "手机号、OpenID 或 UnionID 已被其他客户使用");
    }
    try {
      centerJdbcTemplate.update(
          """
          UPDATE crm_customer_owner_binding
          SET customer_name = ?, external_user_id = ?, last_scan_at = CURRENT_TIMESTAMP,
              openid = ?, phone = ?, unionid = ?, update_time = CURRENT_TIMESTAMP
          WHERE id = ?
          """,
          nullIfBlank(identity.customerName()),
          nullIfBlank(text(request == null ? null : request.externalUserId(), 128)),
          nullIfBlank(identity.openid()),
          nullIfBlank(identity.phone()),
          nullIfBlank(identity.unionid()),
          bindingId);
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "手机号、OpenID 或 UnionID 已被其他客户使用");
    }
    writeOwnerBindingScanLog(
        binding,
        identity,
        false,
        objectInteger(binding.get("ownerSalesUserId")),
        objectInteger(binding.get("ownerSalesUserId")),
        "manual_update",
        null,
        operatorUserId);
    Map<String, Object> result = findOwnerBindingById(bindingId);
    return result == null ? Map.of() : result;
  }

  /** 删除客户归属；旧端为物理删除，删除前写入本地审计日志。 */
  public Map<String, Object> deleteOwnerBinding(
      int bindingId, CrmOwnerBindingDeleteRequest request, Integer operatorUserId) {
    ensureCrmTables();
    Map<String, Object> binding = requireOwnerBinding(bindingId);
    Identity identity = identityFromBinding(binding);
    writeOwnerBindingScanLog(
        binding,
        identity,
        false,
        objectInteger(binding.get("ownerSalesUserId")),
        objectInteger(binding.get("ownerSalesUserId")),
        "manual_delete",
        request == null ? null : request.reason(),
        operatorUserId);
    int deleted =
        centerJdbcTemplate.update("DELETE FROM crm_customer_owner_binding WHERE id = ?", bindingId);
    if (deleted == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "客户归属绑定不存在");
    }
    return binding;
  }

  /** 转移客户归属到目标销售；不创建企微联系方式，仅解析本地已有企微用户快照。 */
  public Map<String, Object> transferOwnerBinding(
      int bindingId,
      int toSalesUserId,
      CrmOwnerBindingTransferRequest request,
      Integer operatorUserId) {
    ensureCrmTables();
    if (findActiveUser(toSalesUserId) == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "目标销售用户不存在或已停用");
    }
    Map<String, Object> binding = requireOwnerBinding(bindingId);
    String nextWeworkUserId =
        resolveWeworkUserId(
            toSalesUserId, request == null ? null : request.toWeworkUserId(), null);
    centerJdbcTemplate.update(
        """
        UPDATE crm_customer_owner_binding
        SET last_scan_at = CURRENT_TIMESTAMP, owner_sales_user_id = ?,
            owner_wework_user_id = ?, status = 1, update_time = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        toSalesUserId,
        nullIfBlank(nextWeworkUserId),
        bindingId);
    writeOwnerBindingScanLog(
        binding,
        identityFromBinding(binding),
        false,
        objectInteger(binding.get("ownerSalesUserId")),
        toSalesUserId,
        "manual_transfer",
        request == null ? null : request.reason(),
        operatorUserId);
    Map<String, Object> updated = findOwnerBindingById(bindingId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("binding", updated == null ? Map.of() : updated);
    result.put("fromOwnerSalesUserId", objectInteger(binding.get("ownerSalesUserId")));
    result.put("reason", text(request == null ? null : request.reason(), 200));
    result.put("toOwnerSalesUserId", toSalesUserId);
    return result;
  }

  private String salesChannelWhere(
      CrmSalesChannelQuery query, Integer scopedSalesUserId, List<Object> args) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE 1 = 1 AND ", "");
    where.setEmptyValue("WHERE 1 = 1");
    appendLike(where, args, "scene", query.scene());
    if (scopedSalesUserId != null) {
      where.add("sales_user_id = ?");
      args.add(scopedSalesUserId);
    }
    Integer status = parseInteger(query.status());
    if (status != null) {
      where.add("status = ?");
      args.add(status);
    }
    return where.toString();
  }

  private Map<String, Object> findSalesChannelByScene(String scene) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            "SELECT * FROM crm_sales_channel WHERE scene = ? LIMIT 1",
            (rs, rowNum) -> salesChannelMap(rs),
            scene);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "销售渠道不存在");
    }
    return rows.get(0);
  }

  private Map<String, Object> findSalesChannelById(int channelId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            "SELECT * FROM crm_sales_channel WHERE id = ? LIMIT 1",
            (rs, rowNum) -> salesChannelMap(rs),
            channelId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "销售渠道不存在");
    }
    return rows.get(0);
  }

  private Map<String, Object> findOwnerBindingById(int bindingId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            "SELECT * FROM crm_customer_owner_binding WHERE id = ? LIMIT 1",
            (rs, rowNum) -> ownerBindingMap(rs),
            bindingId);
    if (rows.isEmpty()) {
      return null;
    }
    enrichOwnerBindingDisplay(rows);
    return rows.get(0);
  }

  private Map<String, Object> requireOwnerBinding(int bindingId) {
    Map<String, Object> binding = findOwnerBindingById(bindingId);
    if (binding == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "客户归属绑定不存在");
    }
    return binding;
  }

  private Map<String, Object> findActiveUser(Integer userId) {
    if (userId == null || userId <= 0) {
      return null;
    }
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, real_name, username, phone, status
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("id", rs.getInt("id"));
              map.put("realName", rs.getString("real_name"));
              map.put("username", rs.getString("username"));
              map.put("phone", rs.getString("phone"));
              map.put("status", objectInteger(rs.getObject("status")));
              return map;
            },
            userId);
    if (rows.isEmpty()) {
      return null;
    }
    Integer status = objectInteger(rows.get(0).get("status"));
    return status == null || status == 1 ? rows.get(0) : null;
  }

  private Map<String, Object> resolveManualBindingChannel(
      Integer ownerSalesUserId, Object firstChannelId, Object sceneValue) {
    Integer channelId = optionalPositiveInteger(firstChannelId, "firstChannelId");
    if (channelId != null) {
      List<Map<String, Object>> rows =
          centerJdbcTemplate.query(
              """
              SELECT *
              FROM crm_sales_channel
              WHERE id = ?
                AND sales_user_id = ?
              LIMIT 1
              """,
              (rs, rowNum) -> salesChannelMap(rs),
              channelId,
              ownerSalesUserId);
      if (rows.isEmpty()) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "获客渠道不存在或不属于该销售");
      }
      return rows.get(0);
    }
    String scene = text(sceneValue, 64);
    if (StringUtils.hasText(scene)) {
      List<Map<String, Object>> rows =
          centerJdbcTemplate.query(
              """
              SELECT *
              FROM crm_sales_channel
              WHERE scene = ?
                AND sales_user_id = ?
              LIMIT 1
              """,
              (rs, rowNum) -> salesChannelMap(rs),
              scene,
              ownerSalesUserId);
      if (!rows.isEmpty()) {
        return rows.get(0);
      }
    }
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_sales_channel
            WHERE sales_user_id = ?
              AND status = 1
            ORDER BY update_time DESC, create_time DESC
            LIMIT 1
            """,
            (rs, rowNum) -> salesChannelMap(rs),
            ownerSalesUserId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private String resolveWeworkUserId(
      Integer salesUserId, Object explicitWeworkUserId, Object fallbackWeworkUserId) {
    String explicit = text(explicitWeworkUserId, 100);
    if (StringUtils.hasText(explicit)) {
      return explicit;
    }
    String fallback = text(fallbackWeworkUserId, 100);
    if (StringUtils.hasText(fallback)) {
      return fallback;
    }
    List<String> channelValues =
        centerJdbcTemplate.queryForList(
            """
            SELECT wework_user_id
            FROM crm_sales_channel
            WHERE sales_user_id = ?
              AND status = 1
              AND wework_user_id IS NOT NULL
              AND wework_user_id <> ''
            ORDER BY update_time DESC, create_time DESC
            LIMIT 1
            """,
            String.class,
            salesUserId);
    if (!channelValues.isEmpty()) {
      return channelValues.get(0);
    }
    List<String> contactValues =
        centerJdbcTemplate.queryForList(
            """
            SELECT wework_user_id
            FROM crm_wework_contact_way
            WHERE sales_user_id = ?
              AND status = 1
            ORDER BY update_time DESC, create_time DESC
            LIMIT 1
            """,
            String.class,
            salesUserId);
    return contactValues.isEmpty() ? "" : contactValues.get(0);
  }

  private void writeBindingStatusScanLog(
      Map<String, Object> binding, int status, Object reason, Integer operatorUserId) {
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO crm_scan_log
            (scene, channel_id, requested_sales_user_id, resolved_sales_user_id, binding_id,
             customer_name, openid, unionid, phone, is_first_bind, source, user_agent, create_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, CURRENT_TIMESTAMP)
          """,
          defaultString(binding.get("firstScene")),
          objectInteger(binding.get("firstChannelId")),
          objectInteger(binding.get("ownerSalesUserId")),
          objectInteger(binding.get("ownerSalesUserId")),
          objectInteger(binding.get("id")),
          nullIfBlank(defaultString(binding.get("customerName"))),
          nullIfBlank(defaultString(binding.get("openid"))),
          nullIfBlank(defaultString(binding.get("unionid"))),
          nullIfBlank(defaultString(binding.get("phone"))),
          status == 1 ? "manual_binding_enable" : "manual_binding_disable",
          auditUserAgent(reason, operatorUserId));
    } catch (RuntimeException ignored) {
      // 旧接口对 scan log 失败仅 warn；状态更新不能被本地审计失败回滚。
    }
  }

  private void writeOwnerBindingScanLog(
      Map<String, Object> binding,
      Identity identity,
      boolean firstBind,
      Integer requestedSalesUserId,
      Integer resolvedSalesUserId,
      String source,
      Object reason,
      Integer operatorUserId) {
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO crm_scan_log
            (scene, channel_id, requested_sales_user_id, resolved_sales_user_id, binding_id,
             customer_name, openid, unionid, phone, is_first_bind, source, user_agent, create_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          """,
          defaultString(binding.get("firstScene")),
          objectInteger(binding.get("firstChannelId")),
          requestedSalesUserId,
          resolvedSalesUserId,
          objectInteger(binding.get("id")),
          nullIfBlank(identity.customerName()),
          nullIfBlank(identity.openid()),
          nullIfBlank(identity.unionid()),
          nullIfBlank(identity.phone()),
          firstBind,
          text(source, 32),
          auditUserAgent(reason, operatorUserId));
    } catch (RuntimeException ignored) {
      // 旧接口对 scan log 失败仅 warn；主业务写入不因本地审计失败回滚。
    }
  }

  private Identity identityFromCreate(CrmOwnerBindingCreateRequest request) {
    return validatedIdentity(
        text(request == null ? null : request.customerName(), 50),
        normalizeCrmPhone(request == null ? null : request.phone()),
        text(request == null ? null : request.openid(), 128),
        text(request == null ? null : request.unionid(), 128));
  }

  private Identity identityFromUpdate(CrmOwnerBindingUpdateRequest request) {
    return validatedIdentity(
        text(request == null ? null : request.customerName(), 50),
        normalizeCrmPhone(request == null ? null : request.phone()),
        text(request == null ? null : request.openid(), 128),
        text(request == null ? null : request.unionid(), 128));
  }

  private Identity identityFromBinding(Map<String, Object> binding) {
    return new Identity(
        defaultString(binding.get("customerName")),
        defaultString(binding.get("phone")),
        defaultString(binding.get("openid")),
        defaultString(binding.get("unionid")));
  }

  private Identity validatedIdentity(String customerName, String phone, String openid, String unionid) {
    if (!StringUtils.hasText(phone) && !StringUtils.hasText(openid) && !StringUtils.hasText(unionid)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请至少填写手机号、OpenID 或 UnionID");
    }
    return new Identity(customerName, phone, openid, unionid);
  }

  private String scanLogWhere(CrmScanLogQuery query, Integer scopedSalesUserId, List<Object> args) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE 1 = 1 AND ", "");
    where.setEmptyValue("WHERE 1 = 1");
    appendLike(where, args, "scene", query.scene());
    appendLike(where, args, "phone", query.phone());
    appendLike(where, args, "openid", query.openid());
    appendLike(where, args, "unionid", query.unionid());
    if (StringUtils.hasText(query.keyword())) {
      where.add("(customer_name LIKE ? OR openid LIKE ? OR phone LIKE ? OR unionid LIKE ?)");
      String like = like(query.keyword());
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    if (scopedSalesUserId != null) {
      where.add("(requested_sales_user_id = ? OR resolved_sales_user_id = ?)");
      args.add(scopedSalesUserId);
      args.add(scopedSalesUserId);
    }
    return where.toString();
  }

  /** 企微外部联系人回调分页列表。 */
  public Map<String, Object> findExternalContactLogs(
      CrmExternalContactQuery query, Integer scopedSalesUserId) {
    ensureCrmTables();
    List<Integer> scopedBindingIds =
        scopedSalesUserId == null ? List.of() : activeBindingIds(scopedSalesUserId);
    List<Integer> keywordBindingIds = matchedBindingIds(query.keyword());
    List<Object> args = new ArrayList<>();
    String where = externalContactWhere(query, scopedSalesUserId, scopedBindingIds, keywordBindingIds, args);
    if (where == null) {
      return page(query.currentPage(), query.pageSize(), List.of(), 0);
    }
    long total = count("crm_external_contact_log", where, args);
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_external_contact_log
            """
                + where
                + """
            ORDER BY create_time DESC
            LIMIT ?, ?
            """,
            (rs, rowNum) -> externalContactLogMap(rs),
            pageArgs.toArray());
    enrichExternalContactDisplay(rows);
    return page(query.currentPage(), query.pageSize(), rows, total);
  }

  /**
   * 记录企业微信外部联系人回调。
   *
   * <p>只写中心库 CRM 本地表；不调用企微接口。若可匹配到客户归属，会同步外部联系人 ID 和最近扫码时间。
   */
  public Map<String, Object> recordExternalContactEvent(
      String changeType,
      String eventType,
      String externalUserId,
      Map<String, Object> rawPayload,
      String state,
      String welcomeCode,
      String weworkUserId) {
    ensureCrmTables();
    String normalizedState = text(state, 128);
    String normalizedWeworkUserId = text(weworkUserId, 100);
    String normalizedExternalUserId = text(externalUserId, 128);
    Integer bindingId =
        resolveExternalContactBinding(normalizedState, normalizedWeworkUserId, normalizedExternalUserId);
    if (bindingId != null && StringUtils.hasText(normalizedExternalUserId)) {
      centerJdbcTemplate.update(
          """
          UPDATE crm_customer_owner_binding
          SET external_user_id = ?,
              owner_wework_user_id = COALESCE(NULLIF(?, ''), owner_wework_user_id),
              last_scan_at = CURRENT_TIMESTAMP,
              update_time = CURRENT_TIMESTAMP
          WHERE id = ?
          """,
          normalizedExternalUserId,
          normalizedWeworkUserId,
          bindingId);
    }

    centerJdbcTemplate.update(
        """
        INSERT INTO crm_external_contact_log
          (event_type, change_type, binding_id, external_user_id, wework_user_id,
           state, welcome_code, raw_payload, create_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CURRENT_TIMESTAMP)
        """,
        nullIfBlank(text(eventType, 64)),
        nullIfBlank(text(changeType, 64)),
        bindingId,
        nullIfBlank(normalizedExternalUserId),
        nullIfBlank(normalizedWeworkUserId),
        nullIfBlank(normalizedState),
        nullIfBlank(text(welcomeCode, 255)),
        json(rawPayload));
    Integer createdId = centerJdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("bindingId", bindingId);
    result.put("changeType", text(changeType, 64));
    result.put("eventType", text(eventType, 64));
    result.put("externalUserId", normalizedExternalUserId);
    result.put("id", createdId);
    result.put("state", normalizedState);
    result.put("weworkUserId", normalizedWeworkUserId);
    return result;
  }

  private String ownerBindingWhere(
      CrmOwnerBindingQuery query, Integer scopedSalesUserId, List<Object> args) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE 1 = 1 AND ", "");
    where.setEmptyValue("WHERE 1 = 1");
    appendLike(where, args, "first_scene", query.scene());
    appendLike(where, args, "phone", query.phone());
    appendLike(where, args, "openid", query.openid());
    appendLike(where, args, "unionid", query.unionid());
    if (StringUtils.hasText(query.keyword())) {
      where.add(
          "(customer_name LIKE ? OR external_user_id LIKE ? OR openid LIKE ? OR phone LIKE ? OR unionid LIKE ?)");
      String like = like(query.keyword());
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    if (scopedSalesUserId != null) {
      where.add("owner_sales_user_id = ?");
      args.add(scopedSalesUserId);
    }
    return where.toString();
  }

  private String externalContactWhere(
      CrmExternalContactQuery query,
      Integer scopedSalesUserId,
      List<Integer> scopedBindingIds,
      List<Integer> keywordBindingIds,
      List<Object> args) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE 1 = 1 AND ", "");
    where.setEmptyValue("WHERE 1 = 1");
    appendLike(where, args, "external_user_id", query.externalUserId());
    appendLike(where, args, "wework_user_id", query.weworkUserId());
    appendLike(where, args, "state", query.state());
    appendLike(where, args, "change_type", query.changeType());
    if (query.bindingId() != null && query.bindingId() > 0) {
      where.add("binding_id = ?");
      args.add(query.bindingId());
    }
    if (StringUtils.hasText(query.keyword())) {
      List<String> keywordConditions = new ArrayList<>();
      keywordConditions.add("external_user_id LIKE ?");
      keywordConditions.add("state LIKE ?");
      args.add(like(query.keyword()));
      args.add(like(query.keyword()));
      if (!keywordBindingIds.isEmpty()) {
        keywordConditions.add("binding_id IN (" + placeholders(keywordBindingIds.size()) + ")");
        args.addAll(keywordBindingIds);
      }
      where.add("(" + String.join(" OR ", keywordConditions) + ")");
    }
    if (scopedSalesUserId != null) {
      if (query.bindingId() != null && query.bindingId() > 0 && !scopedBindingIds.contains(query.bindingId())) {
        return null;
      }
      String salesState = "crm_sales_" + scopedSalesUserId;
      if (query.bindingId() == null || query.bindingId() <= 0) {
        if (scopedBindingIds.isEmpty()) {
          where.add("state = ?");
          args.add(salesState);
        } else {
          where.add("(binding_id IN (" + placeholders(scopedBindingIds.size()) + ") OR state = ?)");
          args.addAll(scopedBindingIds);
          args.add(salesState);
        }
      }
    }
    return where.toString();
  }

  private Map<String, Object> ownerBindingMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("customerName", defaultString(rs.getString("customer_name")));
    map.put("externalUserId", defaultString(rs.getString("external_user_id")));
    map.put("firstChannelId", objectInteger(rs.getObject("first_channel_id")));
    map.put("firstScanAt", toIso(rs.getTimestamp("first_scan_at")));
    map.put("firstScene", defaultString(rs.getString("first_scene")));
    map.put("id", rs.getInt("id"));
    map.put("lastScanAt", toIso(rs.getTimestamp("last_scan_at")));
    map.put("openid", defaultString(rs.getString("openid")));
    map.put("ownerSalesUserId", rs.getInt("owner_sales_user_id"));
    map.put("ownerWeworkUserId", defaultString(rs.getString("owner_wework_user_id")));
    map.put("phone", defaultString(rs.getString("phone")));
    map.put("status", rs.getInt("status"));
    map.put("unionid", defaultString(rs.getString("unionid")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("firstChannelName", "");
    map.put("ownerSalesName", "");
    map.put("ownerUserPhone", "");
    return map;
  }

  private Map<String, Object> externalContactLogMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("bindingId", objectInteger(rs.getObject("binding_id")));
    map.put("changeType", defaultString(rs.getString("change_type")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("eventType", defaultString(rs.getString("event_type")));
    map.put("externalUserId", defaultString(rs.getString("external_user_id")));
    map.put("id", rs.getInt("id"));
    map.put("rawPayload", rs.getString("raw_payload"));
    map.put("state", defaultString(rs.getString("state")));
    map.put("welcomeCode", defaultString(rs.getString("welcome_code")));
    map.put("weworkUserId", defaultString(rs.getString("wework_user_id")));
    map.put("customerName", "");
    map.put("firstChannelName", "");
    map.put("firstScene", "");
    map.put("openid", "");
    map.put("ownerSalesName", "");
    map.put("ownerSalesUserId", null);
    map.put("phone", "");
    map.put("unionid", "");
    return map;
  }

  private Map<String, Object> contactWayMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("configId", defaultString(rs.getString("config_id")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("expiresAt", toIso(rs.getTimestamp("expires_at")));
    map.put("id", rs.getInt("id"));
    map.put("qrCode", defaultString(rs.getString("qr_code")));
    map.put("salesUserId", objectInteger(rs.getObject("sales_user_id")));
    map.put("state", defaultString(rs.getString("state")));
    map.put("status", objectInteger(rs.getObject("status")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("weworkUserId", defaultString(rs.getString("wework_user_id")));
    return map;
  }

  private Map<String, Object> salesChannelMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("channelName", defaultString(rs.getString("channel_name")));
    map.put("channelType", defaultString(rs.getString("channel_type")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("createdById", objectInteger(rs.getObject("created_by_id")));
    map.put("id", rs.getInt("id"));
    map.put("qrCodeUrl", defaultString(rs.getString("qr_code_url")));
    map.put("salesName", defaultString(rs.getString("sales_name")));
    map.put("salesUserId", objectInteger(rs.getObject("sales_user_id")));
    map.put("scene", defaultString(rs.getString("scene")));
    map.put("status", objectInteger(rs.getObject("status")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("weworkUserId", defaultString(rs.getString("wework_user_id")));
    map.put("bindingCount", 0);
    map.put("externalContactCount", 0);
    map.put("scanCount", 0);
    return map;
  }

  private Map<String, Object> scanLogMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("bindingId", objectInteger(rs.getObject("binding_id")));
    map.put("channelId", objectInteger(rs.getObject("channel_id")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("customerName", defaultString(rs.getString("customer_name")));
    map.put("id", rs.getInt("id"));
    map.put("ip", defaultString(rs.getString("ip")));
    map.put("isFirstBind", getBoolean(rs.getObject("is_first_bind")));
    map.put("openid", defaultString(rs.getString("openid")));
    map.put("phone", defaultString(rs.getString("phone")));
    map.put("requestedSalesUserId", objectInteger(rs.getObject("requested_sales_user_id")));
    map.put("resolvedSalesUserId", objectInteger(rs.getObject("resolved_sales_user_id")));
    map.put("scene", defaultString(rs.getString("scene")));
    map.put("source", defaultString(rs.getString("source")));
    map.put("sourceName", scanSourceName(rs.getString("source")));
    map.put("unionid", defaultString(rs.getString("unionid")));
    map.put("userAgent", defaultString(rs.getString("user_agent")));
    map.put("channelName", "");
    map.put("requestedSalesName", "");
    map.put("resolvedSalesName", "");
    return map;
  }

  private void enrichOwnerBindingDisplay(List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Map<Integer, Map<String, Object>> channels =
        findChannels(
            rows.stream().map(row -> objectInteger(row.get("firstChannelId"))).toList());
    Map<Integer, Map<String, Object>> users =
        findUsers(rows.stream().map(row -> objectInteger(row.get("ownerSalesUserId"))).toList());
    for (Map<String, Object> row : rows) {
      Integer channelId = objectInteger(row.get("firstChannelId"));
      Integer userId = objectInteger(row.get("ownerSalesUserId"));
      Map<String, Object> channel = channelId == null ? null : channels.get(channelId);
      Map<String, Object> user = userId == null ? null : users.get(userId);
      row.put("firstChannelName", defaultString(channel == null ? null : channel.get("channelName")));
      row.put(
          "ownerSalesName",
          firstText(
              user == null ? null : user.get("realName"),
              user == null ? null : user.get("username"),
              channel == null ? null : channel.get("salesName")));
      row.put("ownerUserPhone", defaultString(user == null ? null : user.get("phone")));
    }
  }

  private void enrichExternalContactDisplay(List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Map<Integer, Map<String, Object>> bindings =
        findBindings(rows.stream().map(row -> objectInteger(row.get("bindingId"))).toList());
    Map<Integer, Map<String, Object>> channels =
        findChannels(
            bindings.values().stream().map(binding -> objectInteger(binding.get("firstChannelId"))).toList());
    Map<Integer, Map<String, Object>> users =
        findUsers(
            bindings.values().stream().map(binding -> objectInteger(binding.get("ownerSalesUserId"))).toList());
    for (Map<String, Object> row : rows) {
      Integer bindingId = objectInteger(row.get("bindingId"));
      Map<String, Object> binding = bindingId == null ? null : bindings.get(bindingId);
      if (binding == null) {
        continue;
      }
      Map<String, Object> channel = channels.get(objectInteger(binding.get("firstChannelId")));
      Map<String, Object> user = users.get(objectInteger(binding.get("ownerSalesUserId")));
      row.put("customerName", defaultString(binding.get("customerName")));
      row.put("externalUserId", firstText(row.get("externalUserId"), binding.get("externalUserId")));
      row.put("firstChannelName", defaultString(channel == null ? null : channel.get("channelName")));
      row.put("firstScene", defaultString(binding.get("firstScene")));
      row.put("openid", defaultString(binding.get("openid")));
      row.put(
          "ownerSalesName",
          firstText(
              user == null ? null : user.get("realName"),
              user == null ? null : user.get("username"),
              channel == null ? null : channel.get("salesName")));
      row.put("ownerSalesUserId", objectInteger(binding.get("ownerSalesUserId")));
      row.put("phone", defaultString(binding.get("phone")));
      row.put("unionid", defaultString(binding.get("unionid")));
    }
  }

  private void enrichSalesChannelStats(List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    List<Integer> channelIds = positiveIds(rows.stream().map(row -> objectInteger(row.get("id"))).toList());
    List<String> scenes =
        rows.stream()
            .map(row -> defaultString(row.get("scene")))
            .filter(StringUtils::hasText)
            .distinct()
            .toList();
    Map<Integer, Integer> scanCountByChannel = countScanLogsByChannel(channelIds);
    Map<String, Integer> scanCountByScene = countScanLogsBySceneWithoutChannel(scenes);
    List<Map<String, Object>> bindings = findBindingChannelRows(channelIds);
    Map<Integer, Integer> bindingCountByChannel = new HashMap<>();
    Map<Integer, Integer> bindingToChannel = new HashMap<>();
    for (Map<String, Object> binding : bindings) {
      Integer bindingId = objectInteger(binding.get("id"));
      Integer channelId = objectInteger(binding.get("firstChannelId"));
      if (bindingId == null || channelId == null) {
        continue;
      }
      bindingToChannel.put(bindingId, channelId);
      bindingCountByChannel.merge(channelId, 1, Integer::sum);
    }
    Map<Integer, Integer> externalCountByBinding =
        countExternalContactsByBinding(positiveIds(new ArrayList<>(bindingToChannel.keySet())));
    Map<Integer, Integer> externalCountByChannel = new HashMap<>();
    for (Map.Entry<Integer, Integer> entry : externalCountByBinding.entrySet()) {
      Integer channelId = bindingToChannel.get(entry.getKey());
      if (channelId != null) {
        externalCountByChannel.merge(channelId, entry.getValue(), Integer::sum);
      }
    }
    for (Map<String, Object> row : rows) {
      Integer channelId = objectInteger(row.get("id"));
      String scene = defaultString(row.get("scene"));
      int scanCount =
          scanCountByChannel.getOrDefault(channelId, 0) + scanCountByScene.getOrDefault(scene, 0);
      row.put("bindingCount", bindingCountByChannel.getOrDefault(channelId, 0));
      row.put("externalContactCount", externalCountByChannel.getOrDefault(channelId, 0));
      row.put("scanCount", scanCount);
    }
  }

  private void enrichScanLogDisplay(List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Map<Integer, Map<String, Object>> channels =
        findChannels(rows.stream().map(row -> objectInteger(row.get("channelId"))).toList());
    List<Integer> salesUserIds = new ArrayList<>();
    rows.forEach(
        row -> {
          Integer requested = objectInteger(row.get("requestedSalesUserId"));
          Integer resolved = objectInteger(row.get("resolvedSalesUserId"));
          if (requested != null) {
            salesUserIds.add(requested);
          }
          if (resolved != null) {
            salesUserIds.add(resolved);
          }
        });
    Map<Integer, Map<String, Object>> users = findUsers(salesUserIds);
    for (Map<String, Object> row : rows) {
      Map<String, Object> channel = channels.get(objectInteger(row.get("channelId")));
      Map<String, Object> requested = users.get(objectInteger(row.get("requestedSalesUserId")));
      Map<String, Object> resolved = users.get(objectInteger(row.get("resolvedSalesUserId")));
      row.put("channelName", defaultString(channel == null ? null : channel.get("channelName")));
      row.put(
          "requestedSalesName",
          firstText(
              requested == null ? null : requested.get("realName"),
              requested == null ? null : requested.get("username")));
      row.put(
          "resolvedSalesName",
          firstText(
              resolved == null ? null : resolved.get("realName"),
              resolved == null ? null : resolved.get("username")));
    }
  }

  private List<Integer> activeBindingIds(Integer salesUserId) {
    if (salesUserId == null) {
      return List.of();
    }
    return centerJdbcTemplate.queryForList(
        """
        SELECT id
        FROM crm_customer_owner_binding
        WHERE owner_sales_user_id = ?
          AND status = 1
        """,
        Integer.class,
        salesUserId);
  }

  private List<Integer> matchedBindingIds(String keyword) {
    if (!StringUtils.hasText(keyword) || !tableExists("crm_customer_owner_binding")) {
      return List.of();
    }
    String like = like(keyword);
    return centerJdbcTemplate.queryForList(
        """
        SELECT id
        FROM crm_customer_owner_binding
        WHERE customer_name LIKE ?
           OR external_user_id LIKE ?
           OR openid LIKE ?
           OR phone LIKE ?
           OR unionid LIKE ?
        """,
        Integer.class,
        like,
        like,
        like,
        like,
        like);
  }

  private Integer resolveExternalContactBinding(
      String state, String weworkUserId, String externalUserId) {
    Integer bindingId = bindingIdFromState(state);
    if (bindingId != null && bindingExists(bindingId)) {
      return bindingId;
    }
    if (StringUtils.hasText(state) && !state.startsWith("crm_")) {
      List<Object> args = new ArrayList<>();
      args.add(state);
      String sql =
          """
          SELECT id
          FROM crm_customer_owner_binding
          WHERE first_scene = ?
            AND status = 1
          """;
      if (StringUtils.hasText(weworkUserId)) {
        sql += " AND owner_wework_user_id = ?";
        args.add(weworkUserId);
      }
      sql += " ORDER BY last_scan_at DESC, update_time DESC LIMIT 2";
      List<Integer> ids = centerJdbcTemplate.queryForList(sql, Integer.class, args.toArray());
      if (ids.size() == 1) {
        return ids.get(0);
      }
    }
    if (StringUtils.hasText(externalUserId)) {
      List<Integer> ids =
          centerJdbcTemplate.queryForList(
              """
              SELECT id
              FROM crm_customer_owner_binding
              WHERE external_user_id = ?
                AND status = 1
              ORDER BY update_time DESC
              LIMIT 1
              """,
              Integer.class,
              externalUserId);
      return ids.isEmpty() ? null : ids.get(0);
    }
    return null;
  }

  private Integer bindingIdFromState(String state) {
    if (!StringUtils.hasText(state) || !state.startsWith("crm_binding_")) {
      return null;
    }
    return objectInteger(state.substring("crm_binding_".length()));
  }

  private boolean bindingExists(int bindingId) {
    Long count =
        centerJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM crm_customer_owner_binding WHERE id = ? AND status = 1",
            Long.class,
            bindingId);
    return count != null && count > 0;
  }

  private Map<Integer, Map<String, Object>> findBindings(List<Integer> rawIds) {
    List<Integer> ids = positiveIds(rawIds);
    if (ids.isEmpty()) {
      return Map.of();
    }
    Map<Integer, Map<String, Object>> result = new HashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, customer_name, external_user_id, first_channel_id, first_scene,
               openid, owner_sales_user_id, phone, unionid
        FROM crm_customer_owner_binding
        WHERE id IN (
        """
            + placeholders(ids.size())
            + ")",
        rs -> {
          Map<String, Object> binding = new LinkedHashMap<>();
          binding.put("id", rs.getInt("id"));
          binding.put("customerName", rs.getString("customer_name"));
          binding.put("externalUserId", rs.getString("external_user_id"));
          binding.put("firstChannelId", objectInteger(rs.getObject("first_channel_id")));
          binding.put("firstScene", rs.getString("first_scene"));
          binding.put("openid", rs.getString("openid"));
          binding.put("ownerSalesUserId", objectInteger(rs.getObject("owner_sales_user_id")));
          binding.put("phone", rs.getString("phone"));
          binding.put("unionid", rs.getString("unionid"));
          result.put(rs.getInt("id"), binding);
        },
        ids.toArray());
    return result;
  }

  private Map<String, Object> findOwnerBindingByIdentity(Identity identity) {
    if (StringUtils.hasText(identity.phone())) {
      Map<String, Object> byPhone = findOwnerBindingByColumn("phone", identity.phone());
      if (byPhone != null) {
        return byPhone;
      }
    }
    if (StringUtils.hasText(identity.unionid())) {
      Map<String, Object> byUnionid = findOwnerBindingByColumn("unionid", identity.unionid());
      if (byUnionid != null) {
        return byUnionid;
      }
    }
    if (StringUtils.hasText(identity.openid())) {
      Map<String, Object> byOpenid = findOwnerBindingByColumn("openid", identity.openid());
      if (byOpenid != null) {
        return byOpenid;
      }
    }
    return null;
  }

  private Map<String, Object> findOwnerBindingByIdentity(Identity identity, Integer status) {
    if (status == null) {
      return findOwnerBindingByIdentity(identity);
    }
    if (StringUtils.hasText(identity.phone())) {
      Map<String, Object> byPhone = findOwnerBindingByColumn("phone", identity.phone(), status);
      if (byPhone != null) {
        return byPhone;
      }
    }
    if (StringUtils.hasText(identity.unionid())) {
      Map<String, Object> byUnionid = findOwnerBindingByColumn("unionid", identity.unionid(), status);
      if (byUnionid != null) {
        return byUnionid;
      }
    }
    if (StringUtils.hasText(identity.openid())) {
      Map<String, Object> byOpenid = findOwnerBindingByColumn("openid", identity.openid(), status);
      if (byOpenid != null) {
        return byOpenid;
      }
    }
    return null;
  }

  private Map<String, Object> findOwnerBindingByColumn(String columnName, String value) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            "SELECT * FROM crm_customer_owner_binding WHERE " + columnName + " = ? LIMIT 1",
            (rs, rowNum) -> ownerBindingMap(rs),
            value);
    if (rows.isEmpty()) {
      return null;
    }
    enrichOwnerBindingDisplay(rows);
    return rows.get(0);
  }

  private Map<String, Object> findOwnerBindingByColumn(
      String columnName, String value, int status) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            "SELECT * FROM crm_customer_owner_binding WHERE "
                + columnName
                + " = ? AND status = ? LIMIT 1",
            (rs, rowNum) -> ownerBindingMap(rs),
            value,
            status);
    if (rows.isEmpty()) {
      return null;
    }
    enrichOwnerBindingDisplay(rows);
    return rows.get(0);
  }

  private boolean hasIdentity(Identity identity) {
    return StringUtils.hasText(identity.phone())
        || StringUtils.hasText(identity.unionid())
        || StringUtils.hasText(identity.openid());
  }

  private Map<String, Object> updateCrmBindingLastScan(
      Map<String, Object> binding, Identity identity) {
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    assignments.add("last_scan_at = CURRENT_TIMESTAMP");
    if (StringUtils.hasText(identity.customerName())
        && !StringUtils.hasText(defaultString(binding.get("customerName")))) {
      assignments.add("customer_name = ?");
      args.add(identity.customerName());
    }
    if (StringUtils.hasText(identity.phone())
        && !StringUtils.hasText(defaultString(binding.get("phone")))) {
      assignments.add("phone = ?");
      args.add(identity.phone());
    }
    if (StringUtils.hasText(identity.unionid())
        && !StringUtils.hasText(defaultString(binding.get("unionid")))) {
      assignments.add("unionid = ?");
      args.add(identity.unionid());
    }
    if (StringUtils.hasText(identity.openid())
        && !StringUtils.hasText(defaultString(binding.get("openid")))) {
      assignments.add("openid = ?");
      args.add(identity.openid());
    }
    assignments.add("update_time = CURRENT_TIMESTAMP");
    args.add(objectInteger(binding.get("id")));
    try {
      centerJdbcTemplate.update(
          "UPDATE crm_customer_owner_binding SET "
              + String.join(", ", assignments)
              + " WHERE id = ?",
          args.toArray());
    } catch (DuplicateKeyException error) {
      centerJdbcTemplate.update(
          """
          UPDATE crm_customer_owner_binding
          SET last_scan_at = CURRENT_TIMESTAMP, update_time = CURRENT_TIMESTAMP
          WHERE id = ?
          """,
          objectInteger(binding.get("id")));
    }
    Map<String, Object> updated = findOwnerBindingById(objectInteger(binding.get("id")));
    return updated == null ? binding : updated;
  }

  private Map<String, Object> getOwnerProfile(Integer salesUserId) {
    Map<String, Object> user = findUserProfile(salesUserId);
    Map<String, Object> contactWay = latestSalesContactWay(salesUserId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("contactQrCode", defaultString(contactWay.get("qrCode")));
    result.put("phone", defaultString(user.get("phone")));
    result.put(
        "salesName",
        firstText(user.get("realName"), user.get("username"), "销售" + defaultString(salesUserId)));
    result.put("salesUserId", salesUserId);
    result.put("username", defaultString(user.get("username")));
    result.put("weworkUserId", defaultString(contactWay.get("weworkUserId")));
    return result;
  }

  private Map<String, Object> findUserProfile(Integer userId) {
    if (userId == null || userId <= 0) {
      return Map.of();
    }
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, real_name, username, phone
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> user = new LinkedHashMap<>();
              user.put("id", rs.getInt("id"));
              user.put("phone", rs.getString("phone"));
              user.put("realName", rs.getString("real_name"));
              user.put("username", rs.getString("username"));
              return user;
            },
            userId);
    return rows.isEmpty() ? Map.of() : rows.get(0);
  }

  private Map<String, Object> latestSalesContactWay(Integer salesUserId) {
    if (salesUserId == null || salesUserId <= 0) {
      return Map.of();
    }
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM crm_wework_contact_way
            WHERE sales_user_id = ?
              AND status = 1
              AND state = ?
            ORDER BY update_time DESC, create_time DESC
            LIMIT 1
            """,
            (rs, rowNum) -> contactWayMap(rs),
            salesUserId,
            "crm_sales_" + salesUserId);
    return rows.isEmpty() ? Map.of() : rows.get(0);
  }

  private void writeInviteScanLog(
      Map<String, Object> binding,
      Map<String, Object> channel,
      Identity identity,
      boolean firstBind,
      Integer requestedSalesUserId,
      Integer resolvedSalesUserId,
      String scene,
      String source,
      String ip,
      String userAgent) {
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO crm_scan_log
            (scene, channel_id, requested_sales_user_id, resolved_sales_user_id, binding_id,
             customer_name, openid, unionid, phone, is_first_bind, source, ip, user_agent, create_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          """,
          scene,
          objectInteger(channel.get("id")),
          requestedSalesUserId,
          resolvedSalesUserId,
          binding == null ? null : objectInteger(binding.get("id")),
          nullIfBlank(identity.customerName()),
          nullIfBlank(identity.openid()),
          nullIfBlank(identity.unionid()),
          nullIfBlank(identity.phone()),
          firstBind,
          text(source, 32),
          nullIfBlank(ip),
          nullIfBlank(userAgent));
    } catch (RuntimeException ignored) {
      // 旧接口仅记录 warn；扫码日志失败不阻断邀请解析。
    }
  }

  private String detectCrmScanSource(Object fallbackValue, String userAgent) {
    String fallback = text(fallbackValue, 32);
    String ua = defaultString(userAgent).toLowerCase();
    if (ua.matches(".*(miniprogram|mini program|micromessenger.+miniprogram).*")) {
      return "miniprogram";
    }
    if (ua.contains("micromessenger")) {
      return "wechat";
    }
    if (ua.matches(".*(\\bmqqbrowser\\b|\\bqq/).*")) {
      return "qq";
    }
    if (ua.matches(".*(capacitor|wv\\)|; wv\\)).*")) {
      return "app";
    }
    return StringUtils.hasText(fallback) ? fallback : "browser";
  }

  private Map<Integer, Map<String, Object>> findChannels(List<Integer> rawIds) {
    List<Integer> ids = positiveIds(rawIds);
    if (ids.isEmpty()) {
      return Map.of();
    }
    Map<Integer, Map<String, Object>> result = new HashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, channel_name, sales_name, scene
        FROM crm_sales_channel
        WHERE id IN (
        """
            + placeholders(ids.size())
            + ")",
        rs -> {
          Map<String, Object> channel = new LinkedHashMap<>();
          channel.put("id", rs.getInt("id"));
          channel.put("channelName", rs.getString("channel_name"));
          channel.put("salesName", rs.getString("sales_name"));
          channel.put("scene", rs.getString("scene"));
          result.put(rs.getInt("id"), channel);
        },
        ids.toArray());
    return result;
  }

  private Map<Integer, Map<String, Object>> findUsers(List<Integer> rawIds) {
    List<Integer> ids = positiveIds(rawIds);
    if (ids.isEmpty()) {
      return Map.of();
    }
    Map<Integer, Map<String, Object>> result = new HashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, real_name, username, phone
        FROM user
        WHERE id IN (
        """
            + placeholders(ids.size())
            + ")",
        rs -> {
          Map<String, Object> user = new LinkedHashMap<>();
          user.put("id", rs.getInt("id"));
          user.put("realName", rs.getString("real_name"));
          user.put("username", rs.getString("username"));
          user.put("phone", rs.getString("phone"));
          result.put(rs.getInt("id"), user);
        },
        ids.toArray());
    return result;
  }

  private Map<Integer, Integer> countScanLogsByChannel(List<Integer> channelIds) {
    List<Integer> ids = positiveIds(channelIds);
    if (ids.isEmpty()) {
      return Map.of();
    }
    return countGroupedIntegers(
        "SELECT channel_id AS key_id, COUNT(*) AS total FROM crm_scan_log WHERE channel_id IN ("
            + placeholders(ids.size())
            + ") GROUP BY channel_id",
        ids);
  }

  private Map<String, Integer> countScanLogsBySceneWithoutChannel(List<String> scenes) {
    List<String> filtered =
        scenes == null
            ? List.of()
            : scenes.stream().filter(StringUtils::hasText).distinct().toList();
    if (filtered.isEmpty()) {
      return Map.of();
    }
    Map<String, Integer> result = new HashMap<>();
    centerJdbcTemplate.query(
        "SELECT scene, COUNT(*) AS total FROM crm_scan_log WHERE channel_id IS NULL AND scene IN ("
            + placeholders(filtered.size())
            + ") GROUP BY scene",
        (org.springframework.jdbc.core.RowCallbackHandler)
            rs -> result.put(rs.getString("scene"), rs.getInt("total")),
        filtered.toArray());
    return result;
  }

  private List<Map<String, Object>> findBindingChannelRows(List<Integer> channelIds) {
    List<Integer> ids = positiveIds(channelIds);
    if (ids.isEmpty()) {
      return List.of();
    }
    return centerJdbcTemplate.query(
        """
        SELECT id, first_channel_id
        FROM crm_customer_owner_binding
        WHERE first_channel_id IN (
        """
            + placeholders(ids.size())
            + ")",
        (rs, rowNum) ->
            Map.of(
                "firstChannelId",
                rs.getInt("first_channel_id"),
                "id",
                rs.getInt("id")),
        ids.toArray());
  }

  private Map<Integer, Integer> countExternalContactsByBinding(List<Integer> bindingIds) {
    List<Integer> ids = positiveIds(bindingIds);
    if (ids.isEmpty()) {
      return Map.of();
    }
    return countGroupedIntegers(
        "SELECT binding_id AS key_id, COUNT(*) AS total FROM crm_external_contact_log WHERE binding_id IN ("
            + placeholders(ids.size())
            + ") GROUP BY binding_id",
        ids);
  }

  private Map<Integer, Integer> countGroupedIntegers(String sql, List<Integer> ids) {
    Map<Integer, Integer> result = new HashMap<>();
    centerJdbcTemplate.query(
        sql,
        (org.springframework.jdbc.core.RowCallbackHandler)
            rs -> result.put(rs.getInt("key_id"), rs.getInt("total")),
        ids.toArray());
    return result;
  }

  private long count(String table, String where, List<?> args) {
    Long value =
        centerJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM " + table + " " + (where == null ? "" : where),
            Long.class,
            args.toArray());
    return value == null ? 0 : value;
  }

  private void ensureCrmTables() {
    for (String table : CRM_TABLES) {
      if (!tableExists(table)) {
        throw CrmService.schemaMissingException();
      }
    }
  }

  private void ensureSalesChannelTable() {
    if (!tableExists("crm_sales_channel")) {
      throw CrmService.schemaMissingException();
    }
  }

  private boolean tableExists(String tableName) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Long.class,
            tableName);
    return count != null && count > 0;
  }

  private Map<String, Object> page(int currentPage, int pageSize, List<Map<String, Object>> items, long total) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("currentPage", currentPage);
    result.put("items", items);
    result.put("pageSize", pageSize);
    result.put("total", total);
    return result;
  }

  private ExternalScope externalScope(Integer salesUserId, List<Integer> bindingIds) {
    if (salesUserId == null) {
      return new ExternalScope("", List.of());
    }
    String salesState = "crm_sales_" + salesUserId;
    if (bindingIds.isEmpty()) {
      return new ExternalScope(" WHERE state = ?", List.of(salesState));
    }
    List<Object> args = new ArrayList<>(bindingIds);
    args.add(salesState);
    return new ExternalScope(
        " WHERE (binding_id IN (" + placeholders(bindingIds.size()) + ") OR state = ?)", args);
  }

  private void appendLike(StringJoiner where, List<Object> args, String column, String value) {
    if (StringUtils.hasText(value)) {
      where.add(column + " LIKE ?");
      args.add(like(value));
    }
  }

  private void appendRequiredText(
      List<String> assignments, List<Object> args, String columnName, Object value, int maxLength) {
    if (value == null) {
      return;
    }
    String text = text(value, maxLength);
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, camelColumn(columnName) + "不能为空");
    }
    assignments.add(columnName + " = ?");
    args.add(text);
  }

  private void appendOptionalText(
      List<String> assignments,
      List<Object> args,
      String columnName,
      Object value,
      int maxLength,
      String fallback) {
    if (value == null) {
      return;
    }
    String text = text(value, maxLength);
    if (!StringUtils.hasText(text) && fallback != null) {
      text = fallback;
    }
    assignments.add(columnName + " = ?");
    args.add(nullIfBlank(text));
  }

  private String appendCondition(String where, String condition) {
    if (!StringUtils.hasText(where)) {
      return " WHERE " + condition;
    }
    return where + " AND " + condition;
  }

  private List<Object> appendArgs(List<?> args, Object value) {
    List<Object> result = new ArrayList<>(args);
    result.add(value);
    return result;
  }

  private List<Object> scanArgs(Integer salesUserId) {
    return salesUserId == null ? List.of() : List.of(salesUserId, salesUserId);
  }

  private List<Object> singleArg(Integer value) {
    return value == null ? List.of() : List.of(value);
  }

  private List<Integer> positiveIds(List<Integer> rawIds) {
    if (rawIds == null || rawIds.isEmpty()) {
      return List.of();
    }
    return rawIds.stream()
        .filter(id -> id != null && id > 0)
        .collect(Collectors.toCollection(LinkedHashSet::new))
        .stream()
        .toList();
  }

  private String placeholders(int count) {
    return String.join(",", java.util.Collections.nCopies(count, "?"));
  }

  private String like(String value) {
    return "%" + value.trim() + "%";
  }

  private Integer objectInteger(Object value) {
    if (value instanceof Boolean bool) {
      return bool ? 1 : 0;
    }
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value == null) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Integer parseInteger(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private int statusValue(Object value) {
    Integer status = objectInteger(value);
    if (status == null || (status != 0 && status != 1)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "status只能是0或1");
    }
    return status;
  }

  private Integer optionalPositiveInteger(Object value, String fieldName) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    Integer parsed = objectInteger(value);
    if (parsed == null || parsed <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, fieldName + "必须是有效的正整数");
    }
    return parsed;
  }

  private String normalizeCrmPhone(Object value) {
    String normalized = text(value, 20);
    if (!StringUtils.hasText(normalized)) {
      return "";
    }
    String digits = normalized.replaceAll("\\D", "");
    if (!digits.matches("^\\d{11}$")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "手机号格式不正确");
    }
    return digits;
  }

  private String normalizeScene(Object value) {
    String scene = text(value, 32);
    if (!StringUtils.hasText(scene)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "scene不能为空");
    }
    if (!scene.matches("^[\\w:-]+$")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "scene 只能包含字母、数字、下划线、中横线和冒号");
    }
    return scene;
  }

  private String text(Object value, int maxLength) {
    if (value == null) {
      return "";
    }
    String text = String.valueOf(value).trim();
    return text.length() <= maxLength ? text : text.substring(0, maxLength);
  }

  private String nullIfBlank(String value) {
    return StringUtils.hasText(value) ? value : null;
  }

  private String json(Map<String, Object> value) {
    try {
      return OBJECT_MAPPER.writeValueAsString(value == null ? Map.of() : value);
    } catch (Exception error) {
      return "{}";
    }
  }

  private String auditUserAgent(Object reason, Integer operatorUserId) {
    List<String> parts = new ArrayList<>();
    if (operatorUserId != null && operatorUserId > 0) {
      parts.add("operator:" + operatorUserId);
    }
    String reasonText = text(reason, 200);
    if (StringUtils.hasText(reasonText)) {
      parts.add("reason:" + reasonText);
    }
    String value = String.join(" ", parts);
    return value.length() <= 255 ? value : value.substring(0, 255);
  }

  private String camelColumn(String columnName) {
    StringBuilder result = new StringBuilder();
    boolean upperNext = false;
    for (char item : columnName.toCharArray()) {
      if (item == '_') {
        upperNext = true;
      } else if (upperNext) {
        result.append(Character.toUpperCase(item));
        upperNext = false;
      } else {
        result.append(item);
      }
    }
    return result.toString();
  }

  private boolean getBoolean(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    return value != null && Boolean.parseBoolean(String.valueOf(value));
  }

  private String scanSourceName(String source) {
    return switch (defaultString(source).toLowerCase()) {
      case "app" -> "App";
      case "browser", "h5" -> "浏览器";
      case "miniprogram" -> "小程序";
      case "qq" -> "QQ";
      case "wechat" -> "微信";
      default -> "未知";
    };
  }

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String firstText(Object... values) {
    for (Object value : values) {
      if (StringUtils.hasText(defaultString(value))) {
        return defaultString(value);
      }
    }
    return "";
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private record ExternalScope(String where, List<Object> args) {}

  private record Identity(String customerName, String phone, String openid, String unionid) {}
}
