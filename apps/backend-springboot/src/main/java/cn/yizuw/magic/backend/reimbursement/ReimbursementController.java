package cn.yizuw.magic.backend.reimbursement;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 报销模块接口。
 *
 * <p>查询接口按审核权限和本人范围过滤；写接口按批次迁移，财务同步副作用继续留给后续专项批次。
 */
@RestController
public class ReimbursementController {

  private final ReimbursementService reimbursementService;

  public ReimbursementController(ReimbursementService reimbursementService) {
    this.reimbursementService = reimbursementService;
  }

  @GetMapping("/reimbursement/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) String claimant,
      @RequestParam(required = false) String department,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) Integer pageNo,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String payee,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String purpose,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer status) {
    return ApiResponse.ok(
        reimbursementService.getList(
            claimant, department, endDate, pageNo, pageSize, payee, parkId, purpose, startDate, status));
  }

  @GetMapping("/reimbursement/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(reimbursementService.getDetail(id));
  }

  /** 新增报销申请主表记录；图片关系和审核通过后的财务同步不在本批范围内。 */
  @PostMapping("/reimbursement")
  public ApiResponse<Map<String, Object>> create(
      @RequestBody(required = false) ReimbursementCreateRequest request) {
    return ApiResponse.ok(reimbursementService.create(request));
  }

  /** 审核报销申请；本批只写报销主表，不同步 finance 财务记录。 */
  @PutMapping("/reimbursement/{id}")
  public ApiResponse<Map<String, Object>> audit(
      @PathVariable int id, @RequestBody(required = false) ReimbursementAuditRequest request) {
    return ApiResponse.ok(reimbursementService.audit(id, request));
  }

  /** 软删除报销申请；审核通过记录的 finance 同步删除留给后续专项批次。 */
  @DeleteMapping("/reimbursement/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable int id) {
    return ApiResponse.ok(reimbursementService.delete(id));
  }

  @GetMapping("/reimbursement/pending-count")
  public ApiResponse<Map<String, Object>> pendingCount() {
    return ApiResponse.ok(reimbursementService.getPendingCount());
  }

  @GetMapping("/reimbursement/summary")
  public ApiResponse<Map<String, Object>> summary(
      @RequestParam(required = false) String claimant,
      @RequestParam(required = false) String department,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String payee,
      @RequestParam(required = false) String purpose,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer status) {
    return ApiResponse.ok(
        reimbursementService.getSummary(
            claimant, department, endDate, parkId, payee, purpose, startDate, status));
  }

  @GetMapping("/reimbursement/analysis")
  public ApiResponse<Map<String, Object>> analysis(
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer status) {
    return ApiResponse.ok(reimbursementService.getAnalysis(endDate, parkId, startDate, status));
  }
}
