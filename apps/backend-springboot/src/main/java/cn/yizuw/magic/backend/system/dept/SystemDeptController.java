package cn.yizuw.magic.backend.system.dept;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemDeptController {

  private final SystemDeptService systemDeptService;

  public SystemDeptController(SystemDeptService systemDeptService) {
    this.systemDeptService = systemDeptService;
  }

  @GetMapping("/system/dept/list")
  public ApiResponse<List<Map<String, Object>>> list() {
    return ApiResponse.ok(systemDeptService.getDeptList());
  }

  /** 旧部门新增接口本身是 mock 写接口，这里仅做登录态校验并返回成功。 */
  @PostMapping("/system/dept")
  public ApiResponse<Void> create() {
    systemDeptService.createDept();
    return ApiResponse.ok(null);
  }

  /** 旧部门接口本身是 mock 写接口，这里仅做登录态校验并返回成功。 */
  @PutMapping("/system/dept/{id}")
  public ApiResponse<Void> update(@PathVariable String id) {
    systemDeptService.updateDept(id);
    return ApiResponse.ok(null);
  }

  /** 旧部门删除接口本身是 mock 写接口，这里仅做登录态校验并返回成功。 */
  @DeleteMapping("/system/dept/{id}")
  public ApiResponse<Void> delete(@PathVariable String id) {
    systemDeptService.deleteDept(id);
    return ApiResponse.ok(null);
  }
}
