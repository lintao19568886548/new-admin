package cn.yizuw.magic.backend.example.table;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Vben 示例表格接口，保留内存 mock 数据分页与排序能力。 */
@RestController
public class ExampleTableController {

  private final ExampleTableService exampleTableService;

  public ExampleTableController(ExampleTableService exampleTableService) {
    this.exampleTableService = exampleTableService;
  }

  /** 查询示例表格数据；该接口需要登录，但不访问真实业务库。 */
  @GetMapping("/table/list")
  public ApiResponse<Map<String, Object>> list(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String sortBy,
      @RequestParam(required = false) String sortOrder) {
    return ApiResponse.ok(exampleTableService.getList(page, pageSize, sortBy, sortOrder));
  }
}
