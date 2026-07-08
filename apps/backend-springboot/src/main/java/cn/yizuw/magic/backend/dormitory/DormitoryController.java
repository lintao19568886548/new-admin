package cn.yizuw.magic.backend.dormitory;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 宿舍接口迁移入口，路径保持旧 Nitro 接口兼容。 */
@RestController
public class DormitoryController {

  private final DormitoryService dormitoryService;

  public DormitoryController(DormitoryService dormitoryService) {
    this.dormitoryService = dormitoryService;
  }

  /** 新增宿舍主表记录；图片关系仍由后续专项迁移。 */
  @PostMapping("/dormitory")
  public ApiResponse<Map<String, Object>> create(
      @RequestBody(required = false) DormitoryCreateRequest request) {
    return ApiResponse.ok(dormitoryService.createDormitory(request));
  }

  /** 更新宿舍主表字段；图片关系仍由旧后端接口处理。 */
  @PutMapping("/dormitory/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable int id, @RequestBody(required = false) DormitoryUpdateRequest request) {
    return ApiResponse.ok(dormitoryService.updateDormitory(id, request));
  }

  /** 删除宿舍及宿舍图片关联，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  @DeleteMapping("/dormitory/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable int id) {
    return ApiResponse.ok(dormitoryService.deleteDormitory(id));
  }
}
