package cn.yizuw.magic.backend.system.dept;

import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class SystemDeptService {

  public List<Map<String, Object>> getDeptList() {
    TenantRequired.currentUser();
    String now = OffsetDateTime.now().toString();
    return List.of(
        Map.of(
            "id",
            "dept-ops",
            "pid",
            0,
            "name",
            "运营部",
            "carNumber",
            "赣A00001",
            "status",
            1,
            "accessStatus",
            1,
            "createTime",
            now,
            "registerTime",
            now,
            "remark",
            "Spring Boot 兼容旧 mock 部门列表"),
        Map.of(
            "id",
            "dept-admin",
            "pid",
            0,
            "name",
            "综合部",
            "carNumber",
            "赣A00002",
            "status",
            1,
            "accessStatus",
            0,
            "createTime",
            now,
            "registerTime",
            now,
            "remark",
            "Spring Boot 兼容旧 mock 部门列表"));
  }

  /** 兼容旧 Nitro mock 新增接口：不落库，只校验登录态。 */
  public void createDept() {
    TenantRequired.currentUser();
  }

  /** 兼容旧 Nitro mock 更新接口：不落库，只校验登录态。 */
  public void updateDept(String id) {
    TenantRequired.currentUser();
  }

  /** 兼容旧 Nitro mock 删除接口：不落库，只校验登录态。 */
  public void deleteDept(String id) {
    TenantRequired.currentUser();
  }
}
