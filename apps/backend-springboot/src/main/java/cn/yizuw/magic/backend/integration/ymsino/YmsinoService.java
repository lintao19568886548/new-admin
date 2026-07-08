package cn.yizuw.magic.backend.integration.ymsino;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 亿玛表计平台只读业务层；仅迁移设备树和日冻结数据查询。 */
@Service
@Transactional(readOnly = true)
public class YmsinoService {

  private final YmsinoClient ymsinoClient;
  private final AppProperties.Ymsino properties;

  public YmsinoService(AppProperties appProperties, YmsinoClient ymsinoClient) {
    this.properties = appProperties.getYmsino();
    this.ymsinoClient = ymsinoClient;
  }

  /** 查询亿玛水/电表日冻结数据，并按旧接口完成设备过滤和分页。 */
  public Map<String, Object> getData(
      YmsinoMeterKind kind,
      String comAddress,
      Integer currentPage,
      Integer pageSize,
      String ptId,
      String tyDate) {
    TenantRequired.currentUser();
    int page = PageRequestParams.normalizePage(currentPage, 1);
    int size = PageRequestParams.normalizePageSize(pageSize, 20);
    String resolvedPtId = StringUtils.hasText(ptId) ? ptId.trim() : properties.getDefaultPtId();
    String resolvedDate = StringUtils.hasText(tyDate) ? tyDate.trim() : LocalDate.now().toString();
    Map<String, Object> response =
        ymsinoClient.getTranDay(
            Map.of("PtId", resolvedPtId, "TyDate", resolvedDate, "TjType", tjType(kind)));
    ensureSuccess(response, "亿玛表计平台日冻结数据查询失败");

    List<Map<String, Object>> readings =
        filterFrozenReadings(dateItems(response), kind, parseComAddresses(comAddress));
    Map<String, Object> pageResult = paginate(readings, page, size);
    Map<String, Object> result = new LinkedHashMap<>(pageResult);
    result.put(
        "diagnostics",
        Map.of(
            "freezeType",
            "day",
            "requestedDevices",
            parseComAddresses(comAddress),
            "unsupportedFields",
            List.of("hourFreeze", "monthFreeze", "offlineBackfill")));
    result.put("source", source(kind));
    return result;
  }

  /** 查询亿玛水/电表设备树；includeDiagnostics=true 时返回诊断包装结构。 */
  public Object getTree(
      YmsinoMeterKind kind, String keyword, String ptId, String includeDiagnostics) {
    TenantRequired.currentUser();
    String resolvedPtId = StringUtils.hasText(ptId) ? ptId.trim() : properties.getDefaultPtId();
    Map<String, Object> response =
        ymsinoClient.getInfo(Map.of("PtId", resolvedPtId, "TjType", tjType(kind)));
    ensureSuccess(response, "亿玛表计平台设备查询失败");

    List<Map<String, Object>> rawItems = dateItems(response);
    ValidationResult validation = validateDeviceList(rawItems);
    List<Map<String, Object>> records = filterDevices(rawItems, kind, keyword);
    List<Map<String, Object>> tree = buildDeviceTree(records);
    if (!includeDiagnostics(includeDiagnostics)) {
      return tree;
    }
    Map<String, Object> diagnostics = new LinkedHashMap<>();
    diagnostics.put("bindingValidated", validation.ok());
    diagnostics.put("errors", validation.errors());
    diagnostics.put("requiredFields", List.of("FactoryNo", "DeviceId", "RmId"));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("diagnostics", diagnostics);
    result.put("items", tree);
    Map<String, Object> source = new LinkedHashMap<>(source(kind));
    Object protocol = records.isEmpty() ? null : records.get(0).get("protocol");
    if (protocol != null) {
      source.put("protocol", protocol);
    }
    result.put("source", source);
    return result;
  }

  private List<Map<String, Object>> filterFrozenReadings(
      List<Map<String, Object>> items, YmsinoMeterKind kind, List<String> comAddresses) {
    Set<String> addressSet = new LinkedHashSet<>(comAddresses);
    List<Map<String, Object>> readings = new ArrayList<>();
    for (Map<String, Object> item : items) {
      if (!matchesKind(item, kind)) {
        continue;
      }
      String factoryNo = text(item.get("FactoryNo"));
      String deviceId = text(item.get("DeviceId"));
      if (!addressSet.isEmpty()
          && !addressSet.contains(factoryNo)
          && !addressSet.contains(deviceId)) {
        continue;
      }
      Map<String, Object> reading = new LinkedHashMap<>(item);
      reading.put("comAddress", StringUtils.hasText(factoryNo) ? factoryNo : deviceId);
      reading.put("currentRatio", item.get("Ct"));
      reading.put("dataValue", item.get("ZTotal"));
      reading.put("dataValue1", item.get("ZTip"));
      reading.put("dataValue2", item.get("ZPeak"));
      reading.put("dataValue3", item.get("ZComm"));
      reading.put("dataValue4", item.get("ZVale"));
      reading.put("freezeTime", item.get("TranDate"));
      reading.put("proCode", item.get("Pt"));
      readings.add(reading);
    }
    return readings;
  }

  private List<Map<String, Object>> filterDevices(
      List<Map<String, Object>> items, YmsinoMeterKind kind, String keyword) {
    String normalizedKeyword =
        StringUtils.hasText(keyword) ? keyword.trim().toLowerCase(Locale.ROOT) : "";
    List<Map<String, Object>> records = new ArrayList<>();
    for (Map<String, Object> item : items) {
      if (!matchesKind(item, kind)) {
        continue;
      }
      if (normalizedKeyword.isEmpty() || deviceHaystack(item).contains(normalizedKeyword)) {
        records.add(item);
      }
    }
    return records;
  }

  private List<Map<String, Object>> buildDeviceTree(List<Map<String, Object>> items) {
    Map<String, TreeNode> buildings = new LinkedHashMap<>();
    for (Map<String, Object> item : items) {
      String title = firstText(item.get("RmName"), item.get("RmId"), "未分组");
      String key = firstText(item.get("RmId"), title);
      TreeNode building = buildings.computeIfAbsent(key, ignored -> new TreeNode(title, key));
      String deviceTitle = firstText(item.get("FactoryNo"), item.get("DeviceId"), title, "未知设备");
      String deviceKey =
          key + "/" + firstText(item.get("DeviceId"), item.get("FactoryNo"), deviceTitle);
      if (building.children().stream().noneMatch(child -> child.key().equals(deviceKey))) {
        building.children().add(TreeNode.leaf(deviceTitle, deviceKey, item));
      }
    }
    return toArray(buildings.values());
  }

  private List<Map<String, Object>> toArray(Iterable<TreeNode> nodes) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (TreeNode node : nodes) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("title", node.title());
      item.put("key", node.key());
      if (node.leaf()) {
        item.put("isLeaf", true);
        item.put("dataRef", node.dataRef());
      } else {
        item.put("children", toArray(node.children()));
      }
      result.add(item);
    }
    return result;
  }

  private ValidationResult validateDeviceList(List<Map<String, Object>> items) {
    List<Map<String, Object>> errors = new ArrayList<>();
    for (int index = 0; index < items.size(); index++) {
      Map<String, Object> item = items.get(index);
      for (String field : List.of("FactoryNo", "DeviceId", "RmId")) {
        if (!StringUtils.hasText(text(item.get(field)))) {
          errors.add(Map.of("index", index, "message", field + " is required"));
        }
      }
    }
    return new ValidationResult(errors.isEmpty(), errors);
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> dateItems(Map<String, Object> response) {
    Object date = response.get("Date");
    if (date instanceof List<?> list) {
      return list.stream()
          .filter(Map.class::isInstance)
          .map(item -> (Map<String, Object>) item)
          .toList();
    }
    if (date instanceof Map<?, ?> map) {
      return List.of((Map<String, Object>) map);
    }
    return List.of();
  }

  private void ensureSuccess(Map<String, Object> response, String message) {
    String code = text(response.get("Code")).toLowerCase(Locale.ROOT);
    if (code.isBlank() || List.of("0", "200", "success", "true").contains(code)) {
      return;
    }
    throw new BusinessException(HttpStatus.BAD_GATEWAY, message + ": " + text(response.get("Msg")));
  }

  private boolean matchesKind(Map<String, Object> item, YmsinoMeterKind kind) {
    String expected = tjType(kind);
    return expected.isBlank() || expected.equals(text(item.get("TjType")));
  }

  private String tjType(YmsinoMeterKind kind) {
    return kind == YmsinoMeterKind.WATER
        ? properties.getWaterTjType()
        : properties.getElectricTjType();
  }

  private boolean includeDiagnostics(String value) {
    String normalized = text(value).toLowerCase(Locale.ROOT);
    return "1".equals(normalized) || "true".equals(normalized);
  }

  private Map<String, Object> paginate(List<Map<String, Object>> items, int page, int pageSize) {
    int from = Math.min(items.size(), (page - 1) * pageSize);
    int to = Math.min(items.size(), from + pageSize);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("currentPage", page);
    result.put("items", items.subList(from, to));
    result.put("pageSize", pageSize);
    result.put("total", items.size());
    return result;
  }

  private List<String> parseComAddresses(String raw) {
    if (!StringUtils.hasText(raw)) {
      return List.of();
    }
    Set<String> values = new LinkedHashSet<>();
    for (String item : raw.split(",")) {
      if (StringUtils.hasText(item)) {
        values.add(item.trim());
      }
    }
    return List.copyOf(values);
  }

  private Map<String, Object> source(YmsinoMeterKind kind) {
    Map<String, Object> source = new LinkedHashMap<>(ymsinoClient.runtimeConfig());
    source.put("kind", kind.value());
    source.put("mode", "vendor-platform");
    return source;
  }

  private String deviceHaystack(Map<String, Object> item) {
    return String.join(
            " ",
            text(item.get("RmId")),
            text(item.get("RmName")),
            text(item.get("DeviceId")),
            text(item.get("FactoryNo")),
            text(item.get("Pt")),
            text(item.get("Ct")))
        .toLowerCase(Locale.ROOT);
  }

  private String firstText(Object... values) {
    for (Object value : values) {
      String text = text(value);
      if (StringUtils.hasText(text)) {
        return text;
      }
    }
    return "";
  }

  private String text(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private record TreeNode(
      String title, String key, List<TreeNode> children, boolean leaf, Object dataRef) {
    TreeNode(String title, String key) {
      this(title, key, new ArrayList<>(), false, null);
    }

    static TreeNode leaf(String title, String key, Object dataRef) {
      return new TreeNode(title, key, List.of(), true, dataRef);
    }
  }

  private record ValidationResult(boolean ok, List<Map<String, Object>> errors) {}
}
