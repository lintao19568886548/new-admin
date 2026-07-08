package cn.yizuw.magic.backend.integration.hezhong;

import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 合众表计平台业务层。
 *
 * <p>保持旧接口默认项目编号、默认时间范围、设备树解析和多设备地址分页规则，调用外部平台前仍要求登录。
 */
@Service
@Transactional(readOnly = true)
public class HezhongService {

  private static final DateTimeFormatter TIME_FORMATTER =
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final HezhongClient hezhongClient;

  public HezhongService(HezhongClient hezhongClient) {
    this.hezhongClient = hezhongClient;
  }

  /** 查询水/电表冻结数据；多 comAddress 时按旧接口做跨设备分页拼接。 */
  public Map<String, Object> getData(
      HezhongMeterType meterType,
      String comAddress,
      Integer page,
      Integer pageSize,
      String projCode,
      String timeFrom,
      String timeTo,
      String type) {
    TenantRequired.currentUser();
    int currentPage = PageRequestParams.normalizePage(page, 1);
    int size = PageRequestParams.normalizePageSize(pageSize, 20);
    String resolvedProjCode = StringUtils.hasText(projCode) ? projCode.trim() : "241";
    String resolvedType = StringUtils.hasText(type) ? type.trim() : "2";
    String resolvedTimeFrom =
        StringUtils.hasText(timeFrom) ? timeFrom.trim() : defaultTimeFrom();
    String resolvedTimeTo = StringUtils.hasText(timeTo) ? timeTo.trim() : defaultTimeTo();
    List<String> comAddresses = parseComAddresses(comAddress);

    if (comAddresses.isEmpty()) {
      Map<String, Object> response =
          hezhongClient.getHdmData(
              hdmParams(
                  meterType,
                  null,
                  resolvedProjCode,
                  resolvedType,
                  resolvedTimeFrom,
                  resolvedTimeTo,
                  currentPage,
                  size));
      List<Map<String, Object>> items = normalizeHdm(response);
      return Map.of("items", items, "total", total(response, items.size()));
    }

    List<Long> totals = new ArrayList<>();
    for (String address : comAddresses) {
      Map<String, Object> response =
          hezhongClient.getHdmData(
              hdmParams(
                  meterType,
                  address,
                  resolvedProjCode,
                  resolvedType,
                  resolvedTimeFrom,
                  resolvedTimeTo,
                  1,
                  1));
      totals.add(total(response, 0));
    }

    long total = totals.stream().mapToLong(Long::longValue).sum();
    int remaining = size;
    long offset = (long) (currentPage - 1) * size;
    List<Map<String, Object>> items = new ArrayList<>();
    for (int index = 0; index < comAddresses.size() && remaining > 0; index++) {
      long addressTotal = totals.get(index);
      if (offset >= addressTotal) {
        offset -= addressTotal;
        continue;
      }
      long localSkip = offset;
      int localNeed = (int) Math.min(addressTotal - localSkip, remaining);
      int startPage = (int) (localSkip / size) + 1;
      int withinSkip = (int) (localSkip % size);
      List<Map<String, Object>> firstList =
          normalizeHdm(
              hezhongClient.getHdmData(
                  hdmParams(
                      meterType,
                      comAddresses.get(index),
                      resolvedProjCode,
                      resolvedType,
                      resolvedTimeFrom,
                      resolvedTimeTo,
                      startPage,
                      size)));
      int takeFirst = Math.min(localNeed, Math.max(0, size - withinSkip));
      if (takeFirst > 0) {
        items.addAll(firstList.subList(withinSkip, Math.min(firstList.size(), withinSkip + takeFirst)));
      }
      int remain = localNeed - takeFirst;
      if (remain > 0) {
        List<Map<String, Object>> secondList =
            normalizeHdm(
                hezhongClient.getHdmData(
                    hdmParams(
                        meterType,
                        comAddresses.get(index),
                        resolvedProjCode,
                        resolvedType,
                        resolvedTimeFrom,
                        resolvedTimeTo,
                        startPage + 1,
                        size)));
        items.addAll(secondList.subList(0, Math.min(secondList.size(), remain)));
      }
      remaining -= localNeed;
      offset = 0;
    }
    return Map.of("items", items, "total", total);
  }

  /** 查询水/电表设备树，按地址和管线名称做关键字过滤。 */
  public List<Map<String, Object>> getTree(HezhongMeterType meterType, String keyword) {
    TenantRequired.currentUser();
    Map<String, Object> response =
        hezhongClient.getDevice(
            Map.of(
                "comtype", meterType.comType(),
                "page", "1",
                "pageSize", "1000",
                "projCode", "241"));
    String normalizedKeyword =
        StringUtils.hasText(keyword) ? keyword.trim().toLowerCase(Locale.ROOT) : "";
    List<Map<String, Object>> records =
        normalizeRecords(response).stream()
            .filter(record -> hasAddressOrPipelineName(record))
            .filter(record -> matchesKeyword(record, normalizedKeyword))
            .toList();
    return buildTree(records);
  }

  private Map<String, String> hdmParams(
      HezhongMeterType meterType,
      String comAddress,
      String projCode,
      String type,
      String timeFrom,
      String timeTo,
      int page,
      int pageSize) {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("projCode", projCode);
    params.put("type", type);
    params.put("timeFrom", timeFrom);
    params.put("timeTo", timeTo);
    params.put("comType", meterType.comType());
    params.put("pageSize", String.valueOf(pageSize));
    params.put("page", String.valueOf(page));
    if (StringUtils.hasText(comAddress)) {
      params.put("comAddress", comAddress);
    }
    return params;
  }

  private List<Map<String, Object>> normalizeHdm(Map<String, Object> response) {
    List<Map<String, Object>> records = normalizeRecords(response);
    List<Map<String, Object>> items = new ArrayList<>();
    for (Map<String, Object> record : records) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("comAddress", record.get("comAddress"));
      item.put("dataItemName", record.get("dataItemName"));
      item.put("dataValue4", record.get("dataValue4"));
      item.put("writeTime", record.get("writeTime"));
      item.put("dataValue3", record.get("dataValue3"));
      item.put("comtype", record.get("comtype"));
      item.put("proCode", record.get("proCode"));
      item.put("dataValue2", record.get("dataValue2"));
      item.put("dataValue1", record.get("dataValue1"));
      item.put("dataValue", record.get("dataValue"));
      item.put("freezeTime", record.get("freezeTime"));
      item.put("currentRatio", record.get("currentRatio"));
      items.add(item);
    }
    return items;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> normalizeRecords(Map<String, Object> response) {
    Object list = null;
    Object data = response.get("data");
    if (data instanceof Map<?, ?> dataMap) {
      list = dataMap.get("records");
      if (list == null) {
        list = dataMap.get("items");
      }
    }
    if (list == null) {
      list = response.get("records");
    }
    if (list == null) {
      list = response.get("items");
    }
    if (list instanceof List<?> rawList) {
      return rawList.stream()
          .filter(Map.class::isInstance)
          .map(item -> (Map<String, Object>) item)
          .toList();
    }
    if (list instanceof Map<?, ?> map) {
      return List.of((Map<String, Object>) map);
    }
    return List.of();
  }

  @SuppressWarnings("unchecked")
  private long total(Map<String, Object> response, long fallback) {
    Object data = response.get("data");
    Object rawTotal = null;
    if (data instanceof Map<?, ?> dataMap) {
      rawTotal = dataMap.get("total");
    }
    if (rawTotal == null) {
      rawTotal = response.get("total");
    }
    if (rawTotal instanceof Number number) {
      return number.longValue();
    }
    try {
      return rawTotal == null ? fallback : Long.parseLong(String.valueOf(rawTotal));
    } catch (NumberFormatException error) {
      return fallback;
    }
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

  private boolean hasAddressOrPipelineName(Map<String, Object> record) {
    return StringUtils.hasText(String.valueOf(record.getOrDefault("address", "")))
        || StringUtils.hasText(String.valueOf(record.getOrDefault("piplineName", "")));
  }

  private boolean matchesKeyword(Map<String, Object> record, String keyword) {
    if (!StringUtils.hasText(keyword)) {
      return true;
    }
    String address = String.valueOf(record.getOrDefault("address", "")).toLowerCase(Locale.ROOT);
    String name =
        String.valueOf(record.getOrDefault("piplineName", "")).toLowerCase(Locale.ROOT);
    return address.contains(keyword) || name.contains(keyword);
  }

  private List<Map<String, Object>> buildTree(List<Map<String, Object>> records) {
    Map<String, TreeNode> root = new LinkedHashMap<>();
    for (Map<String, Object> record : records) {
      PathParts parts = extractPath(record);
      Map<String, TreeNode> cursor = root;
      String keyPath = "";
      for (String segment : parts.segments()) {
        keyPath = keyPath.isEmpty() ? segment : keyPath + "/" + segment;
        TreeNode node = cursor.get(segment);
        if (node == null) {
          node = new TreeNode(segment, keyPath);
          cursor.put(segment, node);
        }
        cursor = node.children();
      }
      String leafKey = keyPath + "/" + parts.leaf();
      if (!cursor.containsKey(parts.leaf())) {
        cursor.put(parts.leaf(), TreeNode.leaf(parts.leaf(), leafKey, record));
      }
    }
    return toArray(root);
  }

  private PathParts extractPath(Map<String, Object> record) {
    String address = String.valueOf(record.getOrDefault("address", ""));
    List<String> segments =
        new ArrayList<>(
            java.util.Arrays.stream(address.split("/")).filter(StringUtils::hasText).toList());
    if (!segments.isEmpty()) {
      segments.remove(segments.size() - 1);
    }
    String name = String.valueOf(record.getOrDefault("piplineName", ""));
    java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d{3,})$").matcher(name);
    String leaf =
        matcher.find()
            ? matcher.group(1)
            : !segments.isEmpty() ? segments.get(segments.size() - 1) : name;
    return new PathParts(segments, leaf);
  }

  private List<Map<String, Object>> toArray(Map<String, TreeNode> nodes) {
    List<Map<String, Object>> items = new ArrayList<>();
    for (TreeNode node : nodes.values()) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("title", node.title());
      item.put("key", node.key());
      if (node.leaf()) {
        item.put("isLeaf", true);
        item.put("dataRef", node.dataRef());
      } else {
        item.put("children", toArray(node.children()));
      }
      items.add(item);
    }
    return items;
  }

  private String defaultTimeFrom() {
    return LocalDateTime.of(LocalDate.now().minusDays(7), LocalTime.MIN).format(TIME_FORMATTER);
  }

  private String defaultTimeTo() {
    return LocalDateTime.of(LocalDate.now(), LocalTime.MAX).format(TIME_FORMATTER);
  }

  private record PathParts(List<String> segments, String leaf) {}

  private record TreeNode(
      String title, String key, Map<String, TreeNode> children, boolean leaf, Object dataRef) {
    TreeNode(String title, String key) {
      this(title, key, new LinkedHashMap<>(), false, null);
    }

    static TreeNode leaf(String title, String key, Object dataRef) {
      return new TreeNode(title, key, Map.of(), true, dataRef);
    }
  }
}
