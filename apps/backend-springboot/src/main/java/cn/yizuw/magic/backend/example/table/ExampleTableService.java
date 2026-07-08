package cn.yizuw.magic.backend.example.table;

import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 示例表格服务，使用固定内存数据替代 faker，确保自动化测试结果稳定。 */
@Service
public class ExampleTableService {

  private static final List<Map<String, Object>> MOCK_DATA = buildMockData();

  /** 查询示例数据，并兼容旧接口的 page/pageSize/sortBy/sortOrder 参数。 */
  public Map<String, Object> getList(
      Integer page, Integer pageSize, String sortBy, String sortOrder) {
    TenantRequired.currentUser();
    int currentPage = PageRequestParams.normalizePage(page, 1);
    int size = PageRequestParams.normalizePageSize(pageSize, 10);
    List<Map<String, Object>> rows = new ArrayList<>(MOCK_DATA);
    sortRows(rows, sortBy, sortOrder);

    int fromIndex = Math.min((currentPage - 1) * size, rows.size());
    int toIndex = Math.min(fromIndex + size, rows.size());
    return Map.of("items", rows.subList(fromIndex, toIndex), "total", rows.size());
  }

  private void sortRows(List<Map<String, Object>> rows, String sortBy, String sortOrder) {
    if (!StringUtils.hasText(sortBy) || rows.isEmpty() || !rows.get(0).containsKey(sortBy)) {
      return;
    }
    Comparator<Map<String, Object>> comparator =
        (left, right) -> compareValues(left.get(sortBy), right.get(sortBy));
    if (!"asc".equalsIgnoreCase(sortOrder)) {
      comparator = comparator.reversed();
    }
    rows.sort(comparator);
  }

  private int compareValues(Object left, Object right) {
    if (left instanceof Number leftNumber && right instanceof Number rightNumber) {
      return BigDecimal.valueOf(leftNumber.doubleValue())
          .compareTo(BigDecimal.valueOf(rightNumber.doubleValue()));
    }
    if (left instanceof Boolean leftBoolean && right instanceof Boolean rightBoolean) {
      return Boolean.compare(leftBoolean, rightBoolean);
    }
    return String.valueOf(left == null ? "" : left).compareTo(String.valueOf(right == null ? "" : right));
  }

  private static List<Map<String, Object>> buildMockData() {
    List<Map<String, Object>> rows = new ArrayList<>();
    String[] statuses = {"success", "error", "warning"};
    String[] currencies = {"CNY", "USD", "HKD"};
    String[] categories = {"厂房", "宿舍", "水电", "物业"};
    String[] colors = {"red", "blue", "green", "gray"};
    for (int i = 1; i <= 100; i++) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put(
          "id",
          UUID.nameUUIDFromBytes(("table-row-" + i).getBytes(StandardCharsets.UTF_8)).toString());
      row.put("imageUrl", "https://api.dicebear.com/7.x/initials/svg?seed=row-" + i);
      row.put("imageUrl2", "https://api.dicebear.com/7.x/initials/svg?seed=backup-" + i);
      row.put("open", i % 2 == 0);
      row.put("status", statuses[i % statuses.length]);
      row.put("productName", "示例产品-" + i);
      row.put("price", BigDecimal.valueOf(80 + i * 3L).setScale(2));
      row.put("currency", currencies[i % currencies.length]);
      row.put("quantity", (i * 7) % 100 + 1);
      row.put("available", i % 3 != 0);
      row.put("category", categories[i % categories.length]);
      row.put("releaseDate", LocalDate.of(2025, 1, 1).plusDays(i).toString());
      row.put("rating", BigDecimal.valueOf(10 + i % 40).divide(BigDecimal.TEN));
      row.put("description", "用于前端表格联调的固定演示数据 " + i);
      row.put("weight", BigDecimal.valueOf(5 + i).divide(BigDecimal.TEN));
      row.put("color", colors[i % colors.length]);
      row.put("inProduction", i % 4 != 0);
      row.put("tags", List.of("tag-" + i, "batch-13", "demo"));
      rows.add(row);
    }
    return List.copyOf(rows);
  }
}
