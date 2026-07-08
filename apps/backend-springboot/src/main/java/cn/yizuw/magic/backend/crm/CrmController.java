package cn.yizuw.magic.backend.crm;

import cn.yizuw.magic.backend.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** CRM/SCRM 只读接口，按批次迁移旧 Nitro 中心库查询能力。 */
@RestController
public class CrmController {

  private final CrmService crmService;

  public CrmController(CrmService crmService) {
    this.crmService = crmService;
  }

  /** 查询 CRM 环境变量和回调地址配置状态。 */
  @GetMapping("/crm/config/status")
  public ApiResponse<Map<String, Object>> configStatus(
      @RequestHeader(value = "Origin", required = false) String origin,
      @RequestHeader(value = "Referer", required = false) String referer) {
    return ApiResponse.ok(crmService.getConfigStatus(origin, referer));
  }

  /** 查询 CRM 概览统计。 */
  @GetMapping("/crm/overview")
  public ApiResponse<Map<String, Object>> overview() {
    return ApiResponse.ok(crmService.getOverview());
  }

  /** 查询销售获客渠道分页列表。 */
  @GetMapping("/crm/sales/channel/list")
  public ApiResponse<Map<String, Object>> salesChannelList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer salesUserId,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) String status) {
    CrmSalesChannelQuery query =
        new CrmSalesChannelQuery(
            normalizePage(currentPage), normalizePageSize(pageSize), salesUserId, scene, status);
    return ApiResponse.ok(crmService.getSalesChannels(query));
  }

  /** 新增 CRM 销售获客渠道；不生成真实二维码，不调用微信/企微。 */
  @PostMapping("/crm/sales/channel")
  public ApiResponse<Map<String, Object>> createSalesChannel(
      @RequestBody(required = false) CrmSalesChannelCreateRequest request) {
    return ApiResponse.ok(crmService.createSalesChannel(request));
  }

  /** 更新 CRM 销售获客渠道主表字段。 */
  @PostMapping("/crm/sales/channel/update")
  public ApiResponse<Map<String, Object>> updateSalesChannel(
      @RequestBody(required = false) CrmSalesChannelUpdateRequest request) {
    return ApiResponse.ok(crmService.updateSalesChannel(request));
  }

  /** 查询 CRM 扫码记录分页列表。 */
  @GetMapping("/crm/scan-log/list")
  public ApiResponse<Map<String, Object>> scanLogList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String openid,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String phone,
      @RequestParam(required = false) Integer salesUserId,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) String unionid) {
    CrmScanLogQuery query =
        new CrmScanLogQuery(
            normalizePage(currentPage),
            keyword,
            openid,
            normalizePageSize(pageSize),
            phone,
            salesUserId,
            scene,
            unionid);
    return ApiResponse.ok(crmService.getScanLogs(query));
  }

  /** 查询客户归属绑定分页列表。 */
  @GetMapping("/crm/binding/list")
  public ApiResponse<Map<String, Object>> bindingList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String openid,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String phone,
      @RequestParam(required = false) Integer salesUserId,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) String unionid) {
    CrmOwnerBindingQuery query =
        new CrmOwnerBindingQuery(
            normalizePage(currentPage),
            normalizePageSize(pageSize),
            keyword,
            openid,
            phone,
            salesUserId,
            scene,
            unionid);
    return ApiResponse.ok(crmService.getOwnerBindings(query));
  }

  /** 启用或停用客户归属绑定，并写入本地扫码日志审计。 */
  @PostMapping("/crm/binding/status")
  public ApiResponse<Map<String, Object>> updateBindingStatus(
      @RequestBody(required = false) CrmOwnerBindingStatusRequest request) {
    return ApiResponse.ok(crmService.updateOwnerBindingStatus(request));
  }

  /** 手工新增客户归属绑定，并写入本地扫码日志审计。 */
  @PostMapping("/crm/binding/create")
  public ApiResponse<Map<String, Object>> createBinding(
      @RequestBody(required = false) CrmOwnerBindingCreateRequest request) {
    return ApiResponse.ok(crmService.createOwnerBinding(request));
  }

  /** 编辑客户归属身份字段，并写入本地扫码日志审计。 */
  @PostMapping("/crm/binding/update")
  public ApiResponse<Map<String, Object>> updateBinding(
      @RequestBody(required = false) CrmOwnerBindingUpdateRequest request) {
    return ApiResponse.ok(crmService.updateOwnerBinding(request));
  }

  /** 删除客户归属绑定；删除前保留本地扫码日志审计。 */
  @PostMapping("/crm/binding/delete")
  public ApiResponse<Map<String, Object>> deleteBinding(
      @RequestBody(required = false) CrmOwnerBindingDeleteRequest request) {
    return ApiResponse.ok(crmService.deleteOwnerBinding(request));
  }

  /** 转移客户归属到其他销售；不调用企微外部接口。 */
  @PostMapping("/crm/binding/transfer")
  public ApiResponse<Map<String, Object>> transferBinding(
      @RequestBody(required = false) CrmOwnerBindingTransferRequest request) {
    return ApiResponse.ok(crmService.transferOwnerBinding(request));
  }

  /** 查询企微外部联系人回调记录分页列表。 */
  @GetMapping("/crm/external-contact/list")
  public ApiResponse<Map<String, Object>> externalContactList(
      @RequestParam(required = false) Integer bindingId,
      @RequestParam(required = false) String changeType,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String externalUserId,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer salesUserId,
      @RequestParam(required = false) String state,
      @RequestParam(required = false) String weworkUserId) {
    CrmExternalContactQuery query =
        new CrmExternalContactQuery(
            bindingId,
            changeType,
            normalizePage(currentPage),
            externalUserId,
            keyword,
            normalizePageSize(pageSize),
            salesUserId,
            state,
            weworkUserId);
    return ApiResponse.ok(crmService.getExternalContactLogs(query));
  }

  /** 生成 H5 邀请二维码；只读取中心库渠道并本地生成 PNG data URL。 */
  @GetMapping("/crm/invite/h5-qrcode")
  public ApiResponse<Map<String, Object>> inviteH5Qrcode(
      @RequestHeader(value = "Origin", required = false) String origin,
      @RequestHeader(value = "Referer", required = false) String referer,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) Integer width) {
    return ApiResponse.ok(crmService.getInviteH5Qrcode(origin, referer, scene, width));
  }

  /** 生成小程序 URL Link 的本地兼容结果；不调用微信接口。 */
  @GetMapping("/crm/invite/url-link")
  public ApiResponse<Map<String, Object>> inviteUrlLink(
      @RequestHeader(value = "Origin", required = false) String origin,
      @RequestHeader(value = "Referer", required = false) String referer,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) String page,
      @RequestParam(required = false) String envVersion,
      @RequestParam(required = false) Integer expireInterval) {
    return ApiResponse.ok(
        crmService.getInviteUrlLink(origin, referer, scene, page, envVersion, expireInterval));
  }

  /** 生成小程序码的本地兼容 PNG data URL；不调用微信接口。 */
  @GetMapping("/crm/invite/wxacode")
  public ApiResponse<Map<String, Object>> inviteWxacode(
      @RequestHeader(value = "Origin", required = false) String origin,
      @RequestHeader(value = "Referer", required = false) String referer,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) String page,
      @RequestParam(required = false) String envVersion,
      @RequestParam(required = false) Integer width) {
    return ApiResponse.ok(
        crmService.getInviteWxacode(origin, referer, scene, page, envVersion, width));
  }

  /** 发起微信 OAuth；仅组装跳转地址，不在本接口请求微信 token。 */
  @GetMapping("/crm/invite/wechat-oauth/start")
  public ResponseEntity<Void> startWechatOauth(
      @RequestHeader(value = "Origin", required = false) String origin,
      @RequestHeader(value = "Referer", required = false) String referer,
      @RequestParam(required = false) String scene) {
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create(crmService.getWechatOauthStartRedirect(origin, referer, scene)))
        .build();
  }

  /** 微信 OAuth callback 本地兼容回跳；迁移期不请求微信 token 或 userinfo。 */
  @GetMapping("/crm/invite/wechat-oauth/callback")
  public ResponseEntity<Void> wechatOauthCallback(
      @RequestHeader(value = "Origin", required = false) String origin,
      @RequestHeader(value = "Referer", required = false) String referer,
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String scene,
      @RequestParam(required = false) String state) {
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create(crmService.getWechatOauthCallbackRedirect(origin, referer, code, state, scene)))
        .build();
  }

  /** 解析 CRM 邀请扫码归属；只写本地绑定、扫码日志和本地联系二维码。 */
  @PostMapping("/crm/invite/resolve")
  public ApiResponse<Map<String, Object>> resolveInvite(
      @RequestBody(required = false) Map<String, Object> body,
      @RequestHeader(value = "User-Agent", required = false) String userAgent,
      HttpServletRequest request) {
    return ApiResponse.ok(crmService.resolveInvite(inviteResolveRequest(body, clientIp(request), userAgent)));
  }

  /** 生成销售企微联系二维码的本地兼容记录；不调用企业微信接口。 */
  @GetMapping("/crm/sales/contact-way")
  public ApiResponse<Map<String, Object>> salesContactWay(
      @RequestParam(required = false) Integer salesUserId,
      @RequestParam(required = false) Integer bindingId,
      @RequestParam(required = false) Boolean refresh,
      @RequestParam(required = false) String state,
      @RequestParam(required = false) String weworkUserId) {
    return ApiResponse.ok(
        crmService.getSalesContactWay(salesUserId, bindingId, refresh, state, weworkUserId));
  }

  /** 新建销售渠道并可生成本地小程序码；不调用微信接口。 */
  @PostMapping("/crm/sales/qrcode")
  public ApiResponse<Map<String, Object>> salesQrcode(
      @RequestBody(required = false) CrmSalesQrcodeRequest request) {
    return ApiResponse.ok(crmService.createSalesQrcode(request));
  }

  /** 生成微信小程序测试码的本地兼容 PNG data URL。 */
  @PostMapping("/crm/miniprogram/qrcode-test")
  public ApiResponse<Map<String, Object>> miniprogramQrcodeTest(
      @RequestBody(required = false) CrmMiniProgramQrcodeTestRequest request) {
    return ApiResponse.ok(crmService.createMiniProgramQrcodeTest(request));
  }

  /** 小程序 code 换 session 兼容入口；迁移期只做本地校验，不调用微信 jscode2session。 */
  @PostMapping("/crm/miniprogram/session")
  public ApiResponse<Map<String, Object>> miniProgramSession(
      @RequestBody(required = false) Map<String, Object> body) {
    return ApiResponse.ok(crmService.exchangeMiniProgramSessionLocal(body));
  }

  /** 小程序手机号授权兼容入口；迁移期只做本地校验，不调用微信手机号接口。 */
  @PostMapping("/crm/miniprogram/phone")
  public ApiResponse<Map<String, Object>> miniProgramPhone(
      @RequestBody(required = false) Map<String, Object> body) {
    return ApiResponse.ok(crmService.getMiniProgramPhoneLocal(body));
  }

  private int normalizePage(Integer value) {
    return value == null || value < 1 ? 1 : value;
  }

  private int normalizePageSize(Integer value) {
    return value == null || value < 1 ? 20 : Math.min(value, 200);
  }

  private String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    String realIp = request.getHeader("X-Real-IP");
    return realIp == null ? "" : realIp.trim();
  }

  private CrmInviteResolveRequest inviteResolveRequest(
      Map<String, Object> body, String clientIp, String userAgent) {
    Map<String, Object> source = body == null ? Map.of() : body;
    return new CrmInviteResolveRequest(
        stringValue(source.get("scene")),
        stringValue(source.get("source")),
        stringValue(source.get("customerName")),
        stringValue(source.get("phone")),
        stringValue(source.get("openid")),
        stringValue(source.get("unionid")),
        clientIp,
        userAgent);
  }

  private String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }
}
