package cn.yizuw.magic.backend.rental.tenant;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/**
 * 租赁租户与工资模块数据访问层。
 *
 * <p>租赁业务表位于租户库，方法统一接收 Service 传入的 {@link JdbcTemplate}。迁移期真实库和 Prisma
 * schema 可能有字段漂移，所以查询前会检测必要字段，缺表时列表返回空页、详情返回旧接口风格业务错误。
 */
@Repository
public class RentalTenantRepository {

  private static final ZoneId TENANT_ZONE = ZoneId.systemDefault();

  /** 查询租户分页列表，并按当前用户授权园区过滤。 */
  public PageResult<Map<String, Object>> findTenantPage(
      JdbcTemplate jdbcTemplate, RentalTenantListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "rental_tenant");
    if (!readableTable(columns, "rental_tenant_id") || authorizedParkIds.isEmpty()) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE rt.is_deleted = false");
    if (!appendParkFilter(
        where, args, authorizedParkIds, requestedParkId(query.parkId(), query.currentPark()))) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }
    appendLike(where, args, columns, "rt", "tenant_name", query.tenantName());
    appendLike(where, args, columns, "rt", "phone_number", query.phoneNumber());
    appendLike(where, args, columns, "rt", "address", query.address());
    appendTransactionType(where, args, columns, query.transactionType());
    appendTenantStatus(where, args, columns, query.status(), referenceDay(query.date()));
    appendExpiringContract(where, args, columns, query.contractView(), referenceDay(query.date()));
    appendDateRange(where, args, columns, "rt", "contract_start", query.contractDate());
    appendDateRange(where, args, columns, "rt", "increase_date", query.increaseDate());
    appendDateBetween(where, args, columns, "rt", "contract_start", query.contractStart(), query.contractEnd());
    appendDecimalEquals(where, args, columns, "rt", "increase_rate", query.increaseRate());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM rental_tenant rt " + where, Long.class, args.toArray());
    List<Map<String, Object>> tenants =
        jdbcTemplate.query(
            """
            SELECT rt.*, p.park_name
            FROM rental_tenant rt
            LEFT JOIN park p ON p.park_id = rt.park_id
            """
                + where
                + """
                ORDER BY rt.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> rentalTenantMap(rs, columns),
            pageArgs(args, query.currentPage(), query.pageSize()).toArray());
    appendTenantImages(jdbcTemplate, tenants);
    return new PageResult<>(tenants, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询租户详情；旧接口未做园区校验，这里补齐详情权限边界。 */
  public Map<String, Object> findTenantDetail(
      JdbcTemplate jdbcTemplate, int rentalTenantId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "rental_tenant");
    if (!readableTable(columns, "rental_tenant_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户不存在");
    }

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT rt.*, p.park_name
            FROM rental_tenant rt
            LEFT JOIN park p ON p.park_id = rt.park_id
            WHERE rt.rental_tenant_id = ?
              AND rt.is_deleted = false
            LIMIT 1
            """,
            (rs, rowNum) -> rentalTenantMap(rs, columns),
            rentalTenantId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户不存在");
    }
    Map<String, Object> tenant = authorizedDetail(rows, authorizedParkIds, "没有查看权限");
    appendTenantImages(jdbcTemplate, rows);
    return tenant;
  }

  /** 新增租户主表记录；不写 tenant_image，也不调用旧租赁费用财务同步。 */
  public Map<String, Object> createTenant(
      JdbcTemplate jdbcTemplate,
      RentalTenantCreateRequest request,
      List<Integer> authorizedParkIds) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }
    Set<String> columns = columnSet(jdbcTemplate, "rental_tenant");
    if (!readableTable(columns, "rental_tenant_id")
        || !columns.containsAll(Set.of("tenant_name", "phone_number", "address"))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户表结构不完整");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendRequiredStringInsertValue(insertColumns, args, columns, "tenant_name", request.tenantName(), "租户名称不能为空");
    appendRequiredStringInsertValue(insertColumns, args, columns, "phone_number", request.phoneNumber(), "手机号不能为空");
    appendBooleanInsertValue(insertColumns, args, columns, "transaction_type", request.transactionType());
    appendStringInsertValue(insertColumns, args, columns, "status", request.status());
    appendTimestampInsertValue(insertColumns, args, columns, "contract_start", timestampValue(request.contractStart(), "contractStart参数错误"));
    appendTimestampInsertValue(insertColumns, args, columns, "contract_end", timestampValue(request.contractEnd(), "contractEnd参数错误"));
    appendDecimalInsertValue(insertColumns, args, columns, "rental_amount", request.rent());
    appendTimestampInsertValue(insertColumns, args, columns, "increase_date", timestampValue(request.increaseDate(), "increaseDate参数错误"));
    appendDecimalInsertValue(insertColumns, args, columns, "increase_rate", request.increaseRate());
    appendStringInsertValue(insertColumns, args, columns, "increase_data", request.increaseData());
    appendDecimalInsertValue(insertColumns, args, columns, "penalty_rate", request.penaltyRate());
    appendDecimalInsertValue(insertColumns, args, columns, "area", request.area());
    appendRequiredStringInsertValue(insertColumns, args, columns, "address", request.address(), "租赁地址不能为空");
    appendStringInsertValue(insertColumns, args, columns, "remark", request.remark());
    appendTimestampInsertValue(insertColumns, args, columns, "send_message", timestampValue(request.sendMessage(), "sendMessage参数错误"));
    appendParkInsertValue(insertColumns, args, columns, request.parkId(), authorizedParkIds);
    if (columns.contains("is_deleted")) {
      insertColumns.add("is_deleted");
      args.add(false);
    }
    Timestamp now = Timestamp.from(Instant.now());
    appendTimestampInsertValue(insertColumns, args, columns, "create_time", now);
    appendTimestampInsertValue(insertColumns, args, columns, "update_time", now);

    jdbcTemplate.update(
        "INSERT INTO rental_tenant ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer tenantId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (tenantId == null || tenantId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建租户失败");
    }
    return findTenantDetail(jdbcTemplate, tenantId, authorizedParkIds);
  }

  /** 更新租户主表字段；图片关系和租赁财务同步副作用不在本批迁移范围内。 */
  public Map<String, Object> updateTenant(
      JdbcTemplate jdbcTemplate,
      int rentalTenantId,
      RentalTenantUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findTenantDetail(jdbcTemplate, rentalTenantId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "rental_tenant");
    if (!readableTable(columns, "rental_tenant_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户不存在");
    }

    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendStringAssignment(assignments, args, columns, "tenant_name", request == null ? null : request.tenantName());
    appendStringAssignment(assignments, args, columns, "phone_number", request == null ? null : request.phoneNumber());
    appendBooleanAssignment(
        assignments, args, columns, "transaction_type", request == null ? null : request.transactionType());
    appendStringAssignment(assignments, args, columns, "status", request == null ? null : request.status());
    appendTimestampAssignment(
        assignments, args, columns, "contract_start", request == null ? null : request.contractStart());
    appendTimestampAssignment(
        assignments, args, columns, "contract_end", request == null ? null : request.contractEnd());
    appendDecimalAssignment(assignments, args, columns, "rental_amount", request == null ? null : request.rent());
    appendTimestampAssignment(
        assignments, args, columns, "increase_date", request == null ? null : request.increaseDate());
    appendDecimalAssignment(assignments, args, columns, "increase_rate", request == null ? null : request.increaseRate());
    appendStringAssignment(assignments, args, columns, "increase_data", request == null ? null : request.increaseData());
    appendDecimalAssignment(assignments, args, columns, "penalty_rate", request == null ? null : request.penaltyRate());
    appendDecimalAssignment(assignments, args, columns, "area", request == null ? null : request.area());
    appendStringAssignment(assignments, args, columns, "address", request == null ? null : request.address());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendTimestampAssignment(
        assignments, args, columns, "send_message", request == null ? null : request.sendMessage());
    appendParkAssignment(assignments, args, columns, request == null ? null : request.parkId(), authorizedParkIds);
    updateTenantById(jdbcTemplate, rentalTenantId, columns, assignments, args);
    return findTenantDetail(jdbcTemplate, rentalTenantId, authorizedParkIds);
  }

  /** 删除租户；在同一个租户库事务中处理 tenant_image、salary 和 rental_tenant。 */
  public Map<String, Object> deleteTenant(
      JdbcTemplate jdbcTemplate, int rentalTenantId, List<Integer> authorizedParkIds) {
    Map<String, Object> snapshot = findTenantDetail(jdbcTemplate, rentalTenantId, authorizedParkIds);
    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Tenant DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    transactionTemplate.executeWithoutResult(
        ignored -> {
          if (columnSet(jdbcTemplate, "tenant_image").contains("rental_tenant_id")) {
            jdbcTemplate.update("DELETE FROM tenant_image WHERE rental_tenant_id = ?", rentalTenantId);
          }
          Set<String> salaryColumns = columnSet(jdbcTemplate, "salary");
          if (salaryColumns.containsAll(Set.of("rental_tenant_id", "is_deleted"))) {
            jdbcTemplate.update(
                "UPDATE salary SET is_deleted = true WHERE rental_tenant_id = ?",
                rentalTenantId);
          }
          jdbcTemplate.update("DELETE FROM rental_tenant WHERE rental_tenant_id = ?", rentalTenantId);
        });
    return snapshot;
  }

  public List<Map<String, Object>> findTenantSelectList(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds) {
    if (parkIds.isEmpty()) {
      return List.of();
    }
    String placeholders = String.join(",", Collections.nCopies(parkIds.size(), "?"));
    List<Object> args = new ArrayList<>(parkIds);
    return jdbcTemplate.query(
        """
        SELECT rental_tenant_id, tenant_name
        FROM rental_tenant
        WHERE is_deleted = false
          AND park_id IN (
        """
            + placeholders
            + """
          )
        ORDER BY tenant_name ASC
        """,
        (rs, rowNum) ->
            Map.of(
                "tenantId", rs.getInt("rental_tenant_id"),
                "tenantName", rs.getString("tenant_name")),
        args.toArray());
  }

  /** 查询短信模板所需的租户名称、手机号和租期日期。 */
  public Map<String, Object> findTenantSmsInfo(
      JdbcTemplate jdbcTemplate, int rentalTenantId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "rental_tenant");
    if (!readableTable(columns, "rental_tenant_id")
        || !columns.containsAll(Set.of("tenant_name", "phone_number", "increase_date", "contract_end", "park_id"))) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "租户不存在");
    }

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT rental_tenant_id, tenant_name, phone_number, increase_date, contract_end, park_id
            FROM rental_tenant
            WHERE rental_tenant_id = ?
              AND is_deleted = false
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("rentalTenantId", rs.getInt("rental_tenant_id"));
              map.put("tenantName", safeString(rs, "tenant_name"));
              map.put("phoneNumber", safeString(rs, "phone_number"));
              map.put("increaseDate", toLocalDateString(safeTimestamp(rs, "increase_date")));
              map.put("contractEndDate", toLocalDateString(safeTimestamp(rs, "contract_end")));
              map.put("parkId", safeInteger(rs, "park_id"));
              return map;
            },
            rentalTenantId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "租户不存在");
    }
    Map<String, Object> tenant = authorizedDetail(rows, authorizedParkIds, "没有查看权限");
    tenant.remove("rentalTenantId");
    tenant.remove("parkId");
    return tenant;
  }

  /** 查询工资分页列表，先按租户筛选再查工资表，保持旧接口返回 tenantName/phoneNumber 冗余字段。 */
  public PageResult<Map<String, Object>> findSalaryPage(
      JdbcTemplate jdbcTemplate, SalaryListQuery query, List<Integer> authorizedParkIds) {
    Set<String> salaryColumns = columnSet(jdbcTemplate, "salary");
    Set<String> tenantColumns = columnSet(jdbcTemplate, "rental_tenant");
    if (!readableTable(salaryColumns, "salary_id")
        || !readableTable(tenantColumns, "rental_tenant_id")
        || authorizedParkIds.isEmpty()) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(
            """
            WHERE s.is_deleted = false
              AND rt.is_deleted = false
            """);
    if (!appendParkFilter(
        where, args, authorizedParkIds, requestedParkId(query.parkId(), query.currentPark()), "rt")) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }
    appendLike(where, args, tenantColumns, "rt", "tenant_name", query.tenantName());
    appendLike(where, args, tenantColumns, "rt", "phone_number", query.phoneNumber());
    if (query.issued() != null && salaryColumns.contains("issued")) {
      where.append(" AND s.issued = ?");
      args.add(query.issued());
    }
    appendDateRange(where, args, salaryColumns, "s", "issue_date", query.issueDate());
    appendDecimalEquals(where, args, salaryColumns, "s", "salary_amount", query.salaryAmount());

    String from =
        """
        FROM salary s
        LEFT JOIN rental_tenant rt ON rt.rental_tenant_id = s.rental_tenant_id
        """;
    Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) " + from + where, Long.class, args.toArray());
    List<Map<String, Object>> salaries =
        jdbcTemplate.query(
            """
            SELECT s.*, rt.tenant_name, rt.phone_number, rt.park_id, p.park_name
            """
                + from
                + """
                LEFT JOIN park p ON p.park_id = rt.park_id
                """
                + where
                + """
                ORDER BY s.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> salaryMap(rs, salaryColumns),
            pageArgs(args, query.currentPage(), query.pageSize()).toArray());
    appendSalaryImages(jdbcTemplate, salaries);
    return new PageResult<>(salaries, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询工资详情，并通过关联租户园区做权限校验。 */
  public Map<String, Object> findSalaryDetail(
      JdbcTemplate jdbcTemplate, int salaryId, List<Integer> authorizedParkIds) {
    Set<String> salaryColumns = columnSet(jdbcTemplate, "salary");
    if (!readableTable(salaryColumns, "salary_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "工资记录不存在");
    }

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT s.*, rt.tenant_name, rt.phone_number, rt.park_id, p.park_name
            FROM salary s
            LEFT JOIN rental_tenant rt ON rt.rental_tenant_id = s.rental_tenant_id
            LEFT JOIN park p ON p.park_id = rt.park_id
            WHERE s.salary_id = ?
              AND s.is_deleted = false
            LIMIT 1
            """,
            (rs, rowNum) -> salaryMap(rs, salaryColumns),
            salaryId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "工资记录不存在");
    }
    Map<String, Object> salary = authorizedDetail(rows, authorizedParkIds, "没有查看权限");
    appendSalaryImages(jdbcTemplate, rows);
    Object tenant = salary.get("tenant");
    if (tenant == null) {
      salary.put(
          "tenant",
          Map.of(
              "rentalTenantId",
              salary.get("rentalTenantId"),
              "tenantName",
              defaultString(salary.get("tenantName")),
              "phoneNumber",
              defaultString(salary.get("phoneNumber"))));
    }
    return salary;
  }

  /** 新增工资记录主表；通过关联租户校验当前用户园区权限。 */
  public Map<String, Object> createSalary(
      JdbcTemplate jdbcTemplate,
      SalaryCreateRequest request,
      List<Integer> authorizedParkIds) {
    if (request == null || request.rentalTenantId() == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "合同人不能为空");
    }
    Set<String> columns = columnSet(jdbcTemplate, "salary");
    if (!readableTable(columns, "salary_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "工资表缺少必要字段");
    }

    Integer rentalTenantId = integerValue(request.rentalTenantId(), "rentalTenantId参数错误");
    if (rentalTenantId == null || rentalTenantId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "合同人不能为空");
    }
    findTenantDetail(jdbcTemplate, rentalTenantId, authorizedParkIds);

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    insertColumns.add("rental_tenant_id");
    args.add(rentalTenantId);
    appendDecimalInsertValue(insertColumns, args, columns, "salary_amount", request.salaryAmount());
    if (request.issueDate() != null && columns.contains("issue_date")) {
      insertColumns.add("issue_date");
      args.add(timestampValue(request.issueDate(), "issueDate参数错误"));
    }
    if (request.issued() != null && columns.contains("issued")) {
      insertColumns.add("issued");
      args.add(booleanValue(request.issued()));
    }
    appendStringInsertValue(insertColumns, args, columns, "remark", request.remark());
    if (columns.contains("is_deleted")) {
      insertColumns.add("is_deleted");
      args.add(false);
    }
    Timestamp now = Timestamp.from(Instant.now());
    appendTimestampInsertValue(insertColumns, args, columns, "create_time", now);
    appendTimestampInsertValue(insertColumns, args, columns, "update_time", now);

    jdbcTemplate.update(
        "INSERT INTO salary ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer salaryId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (salaryId == null || salaryId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建工资记录失败");
    }
    return findSalaryDetail(jdbcTemplate, salaryId, authorizedParkIds);
  }

  /** 删除工资记录；先返回删除前快照，再在同一个租户库事务中删除图片关系和工资主表。 */
  public Map<String, Object> deleteSalary(
      JdbcTemplate jdbcTemplate, int salaryId, List<Integer> authorizedParkIds) {
    Map<String, Object> snapshot = findSalaryDetail(jdbcTemplate, salaryId, authorizedParkIds);
    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Tenant DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    transactionTemplate.executeWithoutResult(
        ignored -> {
          if (columnSet(jdbcTemplate, "salary_image").contains("salary_id")) {
            jdbcTemplate.update("DELETE FROM salary_image WHERE salary_id = ?", salaryId);
          }
          jdbcTemplate.update("DELETE FROM salary WHERE salary_id = ?", salaryId);
        });
    return snapshot;
  }

  /** 更新工资记录主表字段；图片关系和工资同步副作用留在后续批次处理。 */
  public Map<String, Object> updateSalary(
      JdbcTemplate jdbcTemplate,
      int salaryId,
      SalaryUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findSalaryDetail(jdbcTemplate, salaryId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "salary");
    if (!readableTable(columns, "salary_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "工资记录不存在");
    }

    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    if (request != null && request.rentalTenantId() != null && columns.contains("rental_tenant_id")) {
      Integer rentalTenantId = integerValue(request.rentalTenantId(), "rentalTenantId参数错误");
      if (rentalTenantId == null || rentalTenantId <= 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "rentalTenantId参数错误");
      }
      findTenantDetail(jdbcTemplate, rentalTenantId, authorizedParkIds);
      assignments.add("rental_tenant_id = ?");
      args.add(rentalTenantId);
    }
    if (request != null && request.salaryAmount() != null && columns.contains("salary_amount")) {
      assignments.add("salary_amount = ?");
      args.add(request.salaryAmount());
    }
    if (request != null && request.issueDate() != null && columns.contains("issue_date")) {
      assignments.add("issue_date = ?");
      args.add(timestampValue(request.issueDate(), "issueDate参数错误"));
    }
    if (request != null && request.issued() != null && columns.contains("issued")) {
      assignments.add("issued = ?");
      args.add(booleanValue(request.issued()));
    }
    if (request != null && request.remark() != null && columns.contains("remark")) {
      assignments.add("remark = ?");
      args.add(blankToNull(request.remark()));
    }
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供要更新的字段");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(salaryId);
    jdbcTemplate.update(
        "UPDATE salary SET " + String.join(", ", assignments) + " WHERE salary_id = ?",
        args.toArray());
    return findSalaryDetail(jdbcTemplate, salaryId, authorizedParkIds);
  }

  /** 补齐有效合同缺失的工资主表记录；不写 salary_image，也不改变已有工资记录。 */
  public Map<String, Object> syncMissingSalaries(
      JdbcTemplate jdbcTemplate, Object currentPark, List<Integer> authorizedParkIds) {
    if (authorizedParkIds.isEmpty()) {
      return salarySyncResult(0, 0);
    }
    Set<String> tenantColumns = columnSet(jdbcTemplate, "rental_tenant");
    Set<String> salaryColumns = columnSet(jdbcTemplate, "salary");
    if (!readableTable(tenantColumns, "rental_tenant_id")
        || !readableTable(salaryColumns, "salary_id")
        || !salaryColumns.contains("rental_tenant_id")) {
      return salarySyncResult(0, 0);
    }

    Integer requestedParkId = requestedSyncParkId(currentPark);
    List<Integer> scopedParkIds = authorizedParkIds;
    if (requestedParkId != null && requestedParkId != -1) {
      if (!authorizedParkIds.contains(requestedParkId)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
      }
      scopedParkIds = List.of(requestedParkId);
    }

    Timestamp now = Timestamp.from(Instant.now());
    List<Object> tenantArgs = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(
            """
            WHERE is_deleted = false
              AND (contract_end IS NULL OR contract_end >= ?)
              AND (contract_start IS NULL OR contract_start <= ?)
            """);
    tenantArgs.add(now);
    tenantArgs.add(now);
    where.append(" AND park_id IN (").append(placeholders(scopedParkIds.size())).append(")");
    tenantArgs.addAll(scopedParkIds);

    List<Integer> tenantIds =
        jdbcTemplate.query(
            "SELECT rental_tenant_id FROM rental_tenant " + where,
            (rs, rowNum) -> rs.getInt("rental_tenant_id"),
            tenantArgs.toArray());
    if (tenantIds.isEmpty()) {
      return salarySyncResult(0, 0);
    }

    Set<Integer> existingTenantIds =
        jdbcTemplate
            .query(
                "SELECT rental_tenant_id FROM salary WHERE is_deleted = false AND rental_tenant_id IN ("
                    + placeholders(tenantIds.size())
                    + ")",
                (rs, rowNum) -> rs.getInt("rental_tenant_id"),
                tenantIds.toArray())
            .stream()
            .collect(Collectors.toSet());
    List<Integer> missingTenantIds =
        tenantIds.stream().filter(id -> !existingTenantIds.contains(id)).toList();

    if (!missingTenantIds.isEmpty()) {
      List<String> insertColumns = new ArrayList<>();
      insertColumns.add("rental_tenant_id");
      if (salaryColumns.contains("is_deleted")) {
        insertColumns.add("is_deleted");
      }
      if (salaryColumns.contains("create_time")) {
        insertColumns.add("create_time");
      }
      if (salaryColumns.contains("update_time")) {
        insertColumns.add("update_time");
      }

      for (Integer tenantId : missingTenantIds) {
        List<Object> args = new ArrayList<>();
        args.add(tenantId);
        if (salaryColumns.contains("is_deleted")) {
          args.add(false);
        }
        if (salaryColumns.contains("create_time")) {
          args.add(now);
        }
        if (salaryColumns.contains("update_time")) {
          args.add(now);
        }
        jdbcTemplate.update(
            "INSERT INTO salary ("
                + String.join(", ", insertColumns)
                + ") VALUES ("
                + placeholders(insertColumns.size())
                + ")",
            args.toArray());
      }
    }
    return salarySyncResult(tenantIds.size(), missingTenantIds.size());
  }

  public List<Map<String, Object>> findSalaryTenantOptions(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds, String keyword) {
    if (parkIds.isEmpty()) {
      return List.of();
    }
    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT rental_tenant_id, tenant_name, phone_number
            FROM rental_tenant
            WHERE is_deleted = false
              AND (contract_end IS NULL OR contract_end >= ?)
              AND (contract_start IS NULL OR contract_start <= ?)
            """);
    Timestamp now = Timestamp.from(Instant.now());
    args.add(now);
    args.add(now);
    if (!parkIds.isEmpty()) {
      sql.append(" AND park_id IN (")
          .append(String.join(",", Collections.nCopies(parkIds.size(), "?")))
          .append(")");
      args.addAll(parkIds);
    }
    if (StringUtils.hasText(keyword)) {
      sql.append(" AND (tenant_name LIKE ? OR phone_number LIKE ?)");
      String like = "%" + keyword.trim() + "%";
      args.add(like);
      args.add(like);
    }
    sql.append(" ORDER BY tenant_name ASC");

    return jdbcTemplate.query(
        sql.toString(),
        (rs, rowNum) ->
            Map.of(
                "rentalTenantId", rs.getInt("rental_tenant_id"),
                "tenantName", rs.getString("tenant_name"),
                "phoneNumber", rs.getString("phone_number")),
        args.toArray());
  }

  private Map<String, Object> salarySyncResult(int total, int created) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("total", total);
    result.put("created", created);
    result.put("skipped", total - created);
    return result;
  }

  private Integer requestedSyncParkId(Object currentPark) {
    if (currentPark == null || "".equals(String.valueOf(currentPark).trim())) {
      return null;
    }
    return integerValue(currentPark, "currentPark参数错误");
  }

  private boolean appendParkFilter(
      StringBuilder where, List<Object> args, List<Integer> authorizedParkIds, Integer requestedParkId) {
    return appendParkFilter(where, args, authorizedParkIds, requestedParkId, "rt");
  }

  private boolean appendParkFilter(
      StringBuilder where,
      List<Object> args,
      List<Integer> authorizedParkIds,
      Integer requestedParkId,
      String alias) {
    if (authorizedParkIds.isEmpty()) {
      return false;
    }
    if (requestedParkId == null || requestedParkId == -1) {
      where.append(" AND ").append(alias).append(".park_id IN (")
          .append(placeholders(authorizedParkIds.size()))
          .append(")");
      args.addAll(authorizedParkIds);
      return true;
    }
    if (!authorizedParkIds.contains(requestedParkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    where.append(" AND ").append(alias).append(".park_id = ?");
    args.add(requestedParkId);
    return true;
  }

  private Integer requestedParkId(Integer parkId, Integer currentPark) {
    return parkId == null ? currentPark : parkId;
  }

  private void appendLike(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND ").append(alias).append(".").append(column).append(" LIKE ?");
      args.add("%" + value.trim() + "%");
    }
  }

  private void appendTransactionType(
      StringBuilder where, List<Object> args, Set<String> columns, String value) {
    Boolean parsed = parseBoolean(value);
    if (columns.contains("transaction_type") && parsed != null) {
      where.append(" AND rt.transaction_type = ?");
      args.add(parsed);
    }
  }

  private void appendTenantStatus(
      StringBuilder where, List<Object> args, Set<String> columns, String status, LocalDate referenceDay) {
    if (!columns.contains("contract_end") || !StringUtils.hasText(status)) {
      return;
    }
    if ("active".equalsIgnoreCase(status)) {
      where.append(" AND (rt.contract_end >= ? OR rt.contract_end IS NULL)");
      args.add(referenceDay.toString() + " 00:00:00");
    } else if ("expired".equalsIgnoreCase(status)) {
      where.append(" AND rt.contract_end < ?");
      args.add(referenceDay.toString() + " 00:00:00");
    }
  }

  private void appendExpiringContract(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String contractView,
      LocalDate referenceDay) {
    if (!columns.contains("contract_end") || !"expiring".equalsIgnoreCase(contractView)) {
      return;
    }
    LocalDate expiringLimit = referenceDay.plusMonths(1);
    where.append(" AND rt.contract_end BETWEEN ? AND ?");
    args.add(referenceDay.toString() + " 00:00:00");
    args.add(expiringLimit.toString() + " 23:59:59");
  }

  private void appendDateRange(
      StringBuilder where, List<Object> args, Set<String> columns, String alias, String column, String value) {
    if (!columns.contains(column) || !StringUtils.hasText(value)) {
      return;
    }
    String[] parts = value.split(",", 2);
    if (parts.length >= 1 && StringUtils.hasText(parts[0])) {
      where.append(" AND ").append(alias).append(".").append(column).append(" >= ?");
      args.add(parts[0].trim() + " 00:00:00");
    }
    if (parts.length >= 2 && StringUtils.hasText(parts[1])) {
      where.append(" AND ").append(alias).append(".").append(column).append(" <= ?");
      args.add(parts[1].trim() + " 23:59:59");
    }
  }

  private void appendDateBetween(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      String start,
      String end) {
    if (!columns.contains(column) || !StringUtils.hasText(start) || !StringUtils.hasText(end)) {
      return;
    }
    where.append(" AND ").append(alias).append(".").append(column).append(" BETWEEN ? AND ?");
    args.add(start.trim() + " 00:00:00");
    args.add(end.trim() + " 23:59:59");
  }

  private void appendDecimalEquals(
      StringBuilder where, List<Object> args, Set<String> columns, String alias, String column, String value) {
    if (!columns.contains(column) || !StringUtils.hasText(value)) {
      return;
    }
    try {
      where.append(" AND ").append(alias).append(".").append(column).append(" = ?");
      args.add(new BigDecimal(value.trim()));
    } catch (NumberFormatException error) {
      // 旧接口对非法数字筛选实际等同于不筛选，这里保持宽松。
    }
  }

  private void appendStringAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(blankToNull(value));
  }

  private void appendDecimalAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(decimalValue(value, columnName + "参数错误"));
  }

  private void appendDecimalInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(decimalValue(value, columnName + "参数错误"));
    }
  }

  private void appendStringInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(blankToNull(value));
    }
  }

  private void appendRequiredStringInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      String message) {
    if (!columns.contains(columnName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户表结构不完整");
    }
    String normalized = blankToNull(value);
    if (!StringUtils.hasText(normalized)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    insertColumns.add(columnName);
    args.add(normalized);
  }

  private void appendTimestampInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Timestamp value) {
    if (columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(value);
    }
  }

  private void appendBooleanInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(booleanValue(value));
    }
  }

  private void appendParkInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      Object value,
      List<Integer> authorizedParkIds) {
    if (value == null || !columns.contains("park_id")) {
      return;
    }
    Integer parkId = integerValue(value, "parkId参数错误");
    if (parkId == null || !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    insertColumns.add("park_id");
    args.add(parkId);
  }

  private void appendBooleanAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(booleanValue(value));
  }

  private void appendTimestampAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      String value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(timestampValue(value, columnName + "参数错误"));
  }

  private void appendParkAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      Object value,
      List<Integer> authorizedParkIds) {
    if (value == null || !columns.contains("park_id")) {
      return;
    }
    Integer parkId = integerValue(value, "parkId参数错误");
    if (parkId == null || !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    assignments.add("park_id = ?");
    args.add(parkId);
  }

  private void updateTenantById(
      JdbcTemplate jdbcTemplate,
      int rentalTenantId,
      Set<String> columns,
      List<String> assignments,
      List<Object> args) {
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供要更新的字段");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(rentalTenantId);
    jdbcTemplate.update(
        "UPDATE rental_tenant SET "
            + String.join(", ", assignments)
            + " WHERE rental_tenant_id = ?",
        args.toArray());
  }

  private Map<String, Object> rentalTenantMap(ResultSet rs, Set<String> columns) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("rentalTenantId", rs.getInt("rental_tenant_id"));
    map.put("tenantName", safeString(rs, "tenant_name"));
    map.put("phoneNumber", safeString(rs, "phone_number"));
    map.put("transactionType", safeBoolean(rs, "transaction_type"));
    map.put("status", safeString(rs, "status"));
    map.put("contractStart", toIso(safeTimestamp(rs, "contract_start")));
    map.put("contractEnd", toIso(safeTimestamp(rs, "contract_end")));
    map.put("rent", safeBigDecimal(rs, "rental_amount"));
    map.put("increaseDate", toIso(safeTimestamp(rs, "increase_date")));
    map.put("increaseRate", safeBigDecimal(rs, "increase_rate"));
    map.put("increaseData", safeString(rs, "increase_data"));
    map.put("penaltyRate", safeBigDecimal(rs, "penalty_rate"));
    map.put("area", safeBigDecimal(rs, "area"));
    map.put("address", safeString(rs, "address"));
    map.put("remark", safeString(rs, "remark"));
    map.put("sendMessage", toIso(safeTimestamp(rs, "send_message")));
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("parkName", safeString(rs, "park_name"));
    map.put("isDeleted", columns.contains("is_deleted") && Boolean.TRUE.equals(safeBoolean(rs, "is_deleted")));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    return map;
  }

  private Map<String, Object> salaryMap(ResultSet rs, Set<String> columns) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    int rentalTenantId = safeInteger(rs, "rental_tenant_id") == null ? 0 : safeInteger(rs, "rental_tenant_id");
    String tenantName = defaultString(safeString(rs, "tenant_name"));
    String phoneNumber = defaultString(safeString(rs, "phone_number"));
    map.put("salaryId", rs.getInt("salary_id"));
    map.put("rentalTenantId", rentalTenantId);
    map.put("salaryAmount", safeBigDecimal(rs, "salary_amount"));
    map.put("issueDate", toIso(safeTimestamp(rs, "issue_date")));
    map.put("issued", safeBoolean(rs, "issued"));
    map.put("remark", safeString(rs, "remark"));
    map.put("isDeleted", columns.contains("is_deleted") && Boolean.TRUE.equals(safeBoolean(rs, "is_deleted")));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("parkName", safeString(rs, "park_name"));
    map.put("tenantName", tenantName);
    map.put("phoneNumber", phoneNumber);
    map.put(
        "tenant",
        Map.of("rentalTenantId", rentalTenantId, "tenantName", tenantName, "phoneNumber", phoneNumber));
    return map;
  }

  private void appendTenantImages(JdbcTemplate jdbcTemplate, List<Map<String, Object>> tenants) {
    appendImages(jdbcTemplate, tenants, "tenant_image", "rental_tenant_id", "rentalTenantId");
  }

  private void appendSalaryImages(JdbcTemplate jdbcTemplate, List<Map<String, Object>> salaries) {
    appendImages(jdbcTemplate, salaries, "salary_image", "salary_id", "salaryId");
  }

  private void appendImages(
      JdbcTemplate jdbcTemplate,
      List<Map<String, Object>> rows,
      String relationTable,
      String relationIdColumn,
      String idField) {
    if (rows.isEmpty()) {
      return;
    }
    Set<String> relationColumns = columnSet(jdbcTemplate, relationTable);
    Set<String> imageColumns = columnSet(jdbcTemplate, "image");
    if (!relationColumns.containsAll(Set.of(relationIdColumn, "img_id"))
        || !imageColumns.containsAll(Set.of("img_id", "img_url"))) {
      rows.forEach(row -> row.put("images", List.of()));
      return;
    }
    List<Integer> ids =
        rows.stream()
            .map(row -> row.get(idField))
            .filter(Number.class::isInstance)
            .map(Number.class::cast)
            .map(Number::intValue)
            .toList();
    if (ids.isEmpty()) {
      rows.forEach(row -> row.put("images", List.of()));
      return;
    }

    Map<Integer, List<Map<String, Object>>> imagesByOwnerId = new LinkedHashMap<>();
    jdbcTemplate
        .query(
            "SELECT rel."
                + relationIdColumn
                + ", i.img_id, i.img_url FROM "
                + relationTable
                + " rel LEFT JOIN image i ON i.img_id = rel.img_id WHERE rel."
                + relationIdColumn
                + " IN ("
                + placeholders(ids.size())
                + ") AND i.img_url IS NOT NULL AND i.img_url <> '' ORDER BY rel.id ASC",
            (rs, rowNum) -> {
              Map<String, Object> image = new LinkedHashMap<>();
              image.put("ownerId", rs.getInt(relationIdColumn));
              image.put("imgId", rs.getInt("img_id"));
              image.put("url", rs.getString("img_url"));
              return image;
            },
            ids.toArray())
        .forEach(
            image -> {
              Object rawOwnerId = image.remove("ownerId");
              if (rawOwnerId instanceof Number number) {
                imagesByOwnerId.computeIfAbsent(number.intValue(), ignored -> new ArrayList<>()).add(image);
              }
            });
    for (Map<String, Object> row : rows) {
      Object rawId = row.get(idField);
      int id = rawId instanceof Number number ? number.intValue() : 0;
      row.put("images", imagesByOwnerId.getOrDefault(id, List.of()));
    }
  }

  private Map<String, Object> authorizedDetail(
      List<Map<String, Object>> rows, List<Integer> authorizedParkIds, String message) {
    Map<String, Object> row = rows.get(0);
    Object rawParkId = row.get("parkId");
    if (rawParkId instanceof Number number && !authorizedParkIds.contains(number.intValue())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return row;
  }

  private List<Object> pageArgs(List<Object> args, int currentPage, int pageSize) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    return pageArgs;
  }

  private boolean readableTable(Set<String> columns, String idColumn) {
    return columns.contains(idColumn) && columns.contains("is_deleted");
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
        .collect(Collectors.toUnmodifiableSet());
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private LocalDate referenceDay(String value) {
    if (StringUtils.hasText(value)) {
      try {
        return LocalDate.parse(value.trim());
      } catch (RuntimeException error) {
        return LocalDate.now();
      }
    }
    return LocalDate.now();
  }

  private Boolean parseBoolean(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    if ("true".equals(normalized) || "1".equals(normalized)) {
      return true;
    }
    if ("false".equals(normalized) || "0".equals(normalized)) {
      return false;
    }
    return null;
  }

  private Integer safeInteger(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName, Integer.class);
    } catch (SQLException error) {
      return null;
    }
  }

  private Boolean safeBoolean(ResultSet rs, String columnName) throws SQLException {
    try {
      Object value = rs.getObject(columnName);
      if (value instanceof Boolean bool) {
        return bool;
      }
      if (value instanceof Number number) {
        return number.intValue() != 0;
      }
      return value == null ? null : Boolean.valueOf(String.valueOf(value));
    } catch (SQLException error) {
      return null;
    }
  }

  private BigDecimal safeBigDecimal(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getBigDecimal(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String safeString(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getString(columnName);
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

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String blankToNull(Object value) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : null;
  }

  private Integer integerValue(Object value, String message) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return Integer.parseInt(String.valueOf(value).trim());
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private BigDecimal decimalValue(Object value, String message) {
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    try {
      return new BigDecimal(String.valueOf(value).trim());
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Boolean booleanValue(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    String text = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
    return "true".equals(text) || "1".equals(text) || "yes".equals(text);
  }

  private Timestamp timestampValue(String value, String message) {
    String text = value == null ? "" : value.trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with offset or local date-time strings.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss / yyyy-MM-ddTHH:mm:ss.
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

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private String toLocalDateString(Timestamp timestamp) {
    return timestamp == null ? "" : timestamp.toInstant().atZone(TENANT_ZONE).toLocalDate().toString();
  }
}
