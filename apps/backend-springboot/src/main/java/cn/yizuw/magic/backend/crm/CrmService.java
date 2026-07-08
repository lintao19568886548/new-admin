package cn.yizuw.magic.backend.crm;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** CRM 只读业务层，负责登录态、销售数据范围和配置状态组装。 */
@Service
@Transactional(readOnly = true)
public class CrmService {

  private static final String DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE = "pages/home/index";
  private static final List<String> REQUIRED_CONFIG_KEYS =
      List.of(
          "WECHAT_APP_ID",
          "WECHAT_APP_SECRET",
          "WECHAT_MINIPROGRAM_APP_ID",
          "WECHAT_MINIPROGRAM_APP_SECRET",
          "CRM_MINIPROGRAM_QRCODE_PAGE",
          "CRM_INVITE_H5_BASE_URL",
          "WEWORK_CORP_ID",
          "WEWORK_CUSTOMER_CONTACT_SECRET",
          "WEWORK_CALLBACK_TOKEN",
          "WEWORK_CALLBACK_AES_KEY");

  private final CrmRepository crmRepository;
  private final Environment environment;

  public CrmService(CrmRepository crmRepository, Environment environment) {
    this.crmRepository = crmRepository;
    this.environment = environment;
  }

  /** CRM 配置状态只读接口，不暴露真实密钥值。 */
  public Map<String, Object> getConfigStatus(String origin, String referer) {
    TenantRequired.currentUser();
    String publicOrigin = buildPublicOrigin(origin, referer);
    String qrcodePage =
        envText("CRM_MINIPROGRAM_QRCODE_PAGE", DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("callbackUrl", publicOrigin + "/api/wework/callback");
    result.put(
        "h5Oauth",
        Map.of(
            "appIdConfigured",
            hasEnv("WECHAT_APP_ID"),
            "appSecretConfigured",
            hasEnv("WECHAT_APP_SECRET"),
            "h5BaseUrlConfigured",
            hasEnv("CRM_INVITE_H5_BASE_URL")));
    result.put("inviteH5Url", publicOrigin + "/invite/crm");
    result.put(
        "miniprogram",
        Map.of(
            "appIdConfigured",
            hasEnv("WECHAT_MINIPROGRAM_APP_ID"),
            "appSecretConfigured",
            hasEnv("WECHAT_MINIPROGRAM_APP_SECRET"),
            "h5BaseUrlConfigured",
            hasEnv("CRM_INVITE_H5_BASE_URL"),
            "qrcodePage",
            qrcodePage,
            "qrcodePageConfigured",
            hasEnv("CRM_MINIPROGRAM_QRCODE_PAGE")));
    result.put(
        "required",
        REQUIRED_CONFIG_KEYS.stream()
            .map(key -> Map.of("configured", hasEnv(key), "key", key))
            .toList());
    result.put(
        "wework",
        Map.of(
            "aesKeyConfigured",
            hasEnv("WEWORK_CALLBACK_AES_KEY"),
            "callbackTokenConfigured",
            hasEnv("WEWORK_CALLBACK_TOKEN"),
            "corpIdConfigured",
            hasEnv("WEWORK_CORP_ID"),
            "customerContactSecretConfigured",
            hasEnv("WEWORK_CUSTOMER_CONTACT_SECRET")));
    return result;
  }

  /** CRM 概览统计，非 Super 自动限定当前中心用户作为销售。 */
  public Map<String, Object> getOverview() {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer salesUserId = scopedSalesUserId(payload, null);
    return crmRepository.findOverview(salesUserId, Instant.now());
  }

  /** 销售获客渠道列表，非 Super 自动限定当前中心用户作为销售。 */
  public Map<String, Object> getSalesChannels(CrmSalesChannelQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer salesUserId = scopedSalesUserId(payload, query.salesUserId());
    return crmRepository.findSalesChannels(query, salesUserId);
  }

  /** 新增销售渠道；普通账号只能给自己创建，Super 可指定销售。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createSalesChannel(CrmSalesChannelCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer salesUserId = writableSalesUserId(payload, request == null ? null : request.salesUserId());
    Integer createdById = currentCenterUserId(payload);
    return crmRepository.createSalesChannel(request, salesUserId, createdById);
  }

  /** 更新销售渠道；普通账号只能更新自己的渠道。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateSalesChannel(CrmSalesChannelUpdateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    int channelId = positiveInteger(request == null ? null : request.id(), "id必须是有效的正整数");
    Integer scopedSalesUserId = scopedSalesUserId(payload, null);
    if (scopedSalesUserId != null && !crmRepository.salesChannelBelongsTo(channelId, scopedSalesUserId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无权操作该获客渠道");
    }
    return crmRepository.updateSalesChannel(channelId, request);
  }

  /** CRM 扫码日志列表，非 Super 自动限定当前中心用户作为销售。 */
  public Map<String, Object> getScanLogs(CrmScanLogQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer salesUserId = scopedSalesUserId(payload, query.salesUserId());
    return crmRepository.findScanLogs(query, salesUserId);
  }

  /** 客户归属绑定列表，缺表时返回旧接口风格的 CRM 初始化错误。 */
  public Map<String, Object> getOwnerBindings(CrmOwnerBindingQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer salesUserId = scopedSalesUserId(payload, query.salesUserId());
    return crmRepository.findOwnerBindings(query, salesUserId);
  }

  /** 更新客户归属启停状态；普通账号只能操作自己的客户归属。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateOwnerBindingStatus(CrmOwnerBindingStatusRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    int bindingId = positiveInteger(request == null ? null : request.id(), "id必须是有效的正整数");
    Integer scopedSalesUserId = scopedSalesUserId(payload, null);
    if (scopedSalesUserId != null && !crmRepository.ownerBindingBelongsTo(bindingId, scopedSalesUserId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无权操作该客户归属");
    }
    return crmRepository.updateOwnerBindingStatus(bindingId, request, currentCenterUserId(payload));
  }

  /** 手工新增客户归属；普通账号只能给自己新增，Super 可指定销售。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createOwnerBinding(CrmOwnerBindingCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer ownerSalesUserId =
        writableSalesUserId(payload, request == null ? null : request.ownerSalesUserId());
    return crmRepository.createOwnerBinding(request, ownerSalesUserId, currentCenterUserId(payload));
  }

  /** 编辑客户归属身份字段；普通账号只能编辑自己的客户归属。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateOwnerBinding(CrmOwnerBindingUpdateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    int bindingId = positiveInteger(request == null ? null : request.id(), "id必须是有效的正整数");
    assertOwnerBindingWritable(payload, bindingId);
    return crmRepository.updateOwnerBinding(bindingId, request, currentCenterUserId(payload));
  }

  /** 删除客户归属；普通账号只能删除自己的客户归属。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteOwnerBinding(CrmOwnerBindingDeleteRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    int bindingId = positiveInteger(request == null ? null : request.id(), "id必须是有效的正整数");
    assertOwnerBindingWritable(payload, bindingId);
    return crmRepository.deleteOwnerBinding(bindingId, request, currentCenterUserId(payload));
  }

  /** 转移客户归属；旧端只要求当前归属可操作，目标销售可由请求指定。 */
  @Transactional(readOnly = false)
  public Map<String, Object> transferOwnerBinding(CrmOwnerBindingTransferRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    int bindingId = positiveInteger(request == null ? null : request.id(), "id必须是有效的正整数");
    int toSalesUserId =
        positiveInteger(
            request == null ? null : request.toSalesUserId(), "toSalesUserId必须是有效的正整数");
    assertOwnerBindingWritable(payload, bindingId);
    return crmRepository.transferOwnerBinding(
        bindingId, toSalesUserId, request, currentCenterUserId(payload));
  }

  /** 企微外部联系人回调列表，缺表时返回旧接口风格的 CRM 初始化错误。 */
  public Map<String, Object> getExternalContactLogs(CrmExternalContactQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Integer salesUserId = scopedSalesUserId(payload, query.salesUserId());
    return crmRepository.findExternalContactLogs(query, salesUserId);
  }

  /** 生成 H5 邀请二维码；本地生成 PNG Data URL，不调用微信或企微。 */
  public Map<String, Object> getInviteH5Qrcode(
      String origin, String referer, String sceneValue, Integer width) {
    String scene = normalizeScene(sceneValue);
    Map<String, Object> channel = crmRepository.findActiveSalesChannelByScene(scene);
    String inviteUrl = buildPublicOrigin(origin, referer) + "/invite/crm?scene=" + urlEncode(scene);
    Map<String, Object> qrcode = new LinkedHashMap<>();
    qrcode.put("dataUrl", SimpleQrCodeGenerator.toPngDataUrl(inviteUrl, width == null ? 430 : width));
    qrcode.put("mimeType", "image/png");
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("channel", channel);
    result.put("inviteUrl", inviteUrl);
    result.put("qrcode", qrcode);
    result.put("scene", scene);
    return result;
  }

  /** 生成小程序 URL Link 本地兼容结果；不申请微信小程序 url_link。 */
  public Map<String, Object> getInviteUrlLink(
      String origin,
      String referer,
      String sceneValue,
      String pageValue,
      String envVersionValue,
      Integer expireIntervalValue) {
    String scene = normalizeScene(sceneValue);
    Map<String, Object> channel = crmRepository.findActiveSalesChannelByScene(scene);
    String page = normalizeMiniProgramPage(pageValue);
    String envVersion = normalizeEnvVersion(envVersionValue);
    int expireInterval = normalizeExpireInterval(expireIntervalValue);
    String query = "scene=" + urlEncode(scene);
    String urlLink =
        buildInviteUrl(
            origin,
            referer,
            Map.of("envVersion", envVersion, "page", page, "scene", scene, "source", "local"));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("channel", channel);
    result.put("envVersion", envVersion);
    result.put(
        "expireAt", Instant.now().plus(expireInterval, ChronoUnit.DAYS).toString());
    result.put("expireInterval", expireInterval);
    result.put("page", page);
    result.put("query", query);
    result.put("scene", scene);
    result.put("urlLink", urlLink);
    return result;
  }

  /** 生成小程序码本地兼容 PNG Data URL；二维码内容指向本地 H5 邀请页。 */
  public Map<String, Object> getInviteWxacode(
      String origin,
      String referer,
      String sceneValue,
      String pageValue,
      String envVersionValue,
      Integer width) {
    String scene = normalizeScene(sceneValue);
    Map<String, Object> channel = crmRepository.findActiveSalesChannelByScene(scene);
    String page = normalizeMiniProgramPage(pageValue);
    String envVersion = normalizeEnvVersion(envVersionValue);
    String codeContent =
        buildInviteUrl(origin, referer, Map.of("envVersion", envVersion, "page", page, "scene", scene));
    Map<String, Object> wxacode = new LinkedHashMap<>();
    wxacode.put("dataUrl", SimpleQrCodeGenerator.toPngDataUrl(codeContent, width == null ? 430 : width));
    wxacode.put("mimeType", "image/png");
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("channel", channel);
    result.put("envVersion", envVersion);
    result.put("page", page);
    result.put("scene", scene);
    result.put("wxacode", wxacode);
    return result;
  }

  /** 发起微信 OAuth 的跳转地址；配置缺失时沿用旧端回跳 H5 并携带错误码。 */
  public String getWechatOauthStartRedirect(String origin, String referer, String sceneValue) {
    String scene;
    try {
      scene = normalizeScene(sceneValue);
    } catch (BusinessException error) {
      return buildInviteUrl(
          origin,
          referer,
          Map.of("oauth_error", "bad_scene", "scene", sceneValue == null ? "" : sceneValue));
    }
    String appId = envText("WECHAT_APP_ID", "");
    String appSecret = envText("WECHAT_APP_SECRET", "");
    if (!StringUtils.hasText(appId) || !StringUtils.hasText(appSecret)) {
      return buildInviteUrl(origin, referer, Map.of("oauth_error", "not_configured", "scene", scene));
    }
    String callbackUrl = buildPublicOrigin(origin, referer) + "/api/crm/invite/wechat-oauth/callback";
    return "https://open.weixin.qq.com/connect/oauth2/authorize"
        + "?appid="
        + urlEncode(appId)
        + "&redirect_uri="
        + urlEncode(callbackUrl)
        + "&response_type=code&scope=snsapi_userinfo&state="
        + urlEncode(scene)
        + "#wechat_redirect";
  }

  /**
   * 微信 OAuth callback 的本地兼容回跳。
   *
   * <p>旧接口会向微信换取 access_token 和 userinfo；迁移期不外呼微信，只把状态带回邀请 H5，
   * 避免灰度环境因为缺少公众号配置或网络权限而阻塞扫码链路。
   */
  public String getWechatOauthCallbackRedirect(
      String origin, String referer, String codeValue, String stateValue, String sceneValue) {
    String sceneText = firstText(stateValue, sceneValue);
    String scene;
    try {
      scene = normalizeScene(sceneText);
    } catch (BusinessException error) {
      return buildInviteUrl(
          origin,
          referer,
          Map.of("oauth_error", "bad_scene", "scene", sceneText));
    }
    String code = normalizedText(codeValue, 256);
    if (!StringUtils.hasText(code)) {
      return buildInviteUrl(origin, referer, Map.of("oauth_error", "denied", "scene", scene));
    }
    String errorCode =
        hasEnv("WECHAT_APP_ID") && hasEnv("WECHAT_APP_SECRET")
            ? "external_disabled"
            : "not_configured";
    return buildInviteUrl(
        origin,
        referer,
        Map.of("oauth_error", errorCode, "scene", scene, "source", "wechat"));
  }

  /** 解析 CRM 邀请扫码归属；只写本地中心库 CRM 表，不调用企微。 */
  @Transactional(readOnly = false)
  public Map<String, Object> resolveInvite(CrmInviteResolveRequest request) {
    Map<String, Object> result = crmRepository.resolveInvite(request);
    Map<String, Object> binding = objectMap(result.get("binding"));
    Map<String, Object> owner = objectMap(result.get("owner"));
    Map<String, Object> contactWay = null;
    String contactWayError = "";
    Integer salesUserId = objectInteger(owner.get("salesUserId"));
    Integer bindingId = objectInteger(binding.get("id"));
    String weworkUserId = normalizedText(owner.get("weworkUserId"), 100);
    if (bindingId != null && salesUserId != null && StringUtils.hasText(weworkUserId)) {
      String state = "crm_binding_" + bindingId;
      contactWay = crmRepository.findActiveContactWay(salesUserId, state);
      if (contactWay == null) {
        contactWay = createLocalContactWay(salesUserId, state, weworkUserId);
      }
      Map<String, Object> nextOwner = new LinkedHashMap<>(owner);
      nextOwner.put("contactQrCode", contactWay.get("qrCode"));
      result.put("owner", nextOwner);
    }
    result.put("contactWay", contactWay);
    result.put("contactWayError", contactWayError);
    return result;
  }

  /** 生成销售联系二维码本地记录；普通账号只能为自己生成。 */
  @Transactional(readOnly = false)
  public Map<String, Object> getSalesContactWay(
      Integer salesUserId,
      Integer bindingId,
      Boolean refresh,
      String stateValue,
      String weworkUserIdValue) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (bindingId != null) {
      int checkedBindingId = positiveInteger(bindingId, "bindingId必须是有效的正整数");
      assertOwnerBindingWritable(payload, checkedBindingId);
    }
    Integer resolvedSalesUserId = writableSalesUserId(payload, salesUserId);
    int checkedSalesUserId =
        positiveInteger(resolvedSalesUserId, "salesUserId必须是有效的正整数");
    boolean isSuper = payload.roles() != null && payload.roles().contains("Super");
    String defaultState = bindingId == null ? "crm_sales_" + checkedSalesUserId : "crm_binding_" + bindingId;
    String state = isSuper && StringUtils.hasText(stateValue) ? normalizedText(stateValue, 128) : defaultState;
    Map<String, Object> existing = crmRepository.findActiveContactWay(checkedSalesUserId, state);
    if (existing != null && !Boolean.TRUE.equals(refresh)) {
      return existing;
    }
    String weworkUserId =
        crmRepository.resolveContactWayWeworkUserId(checkedSalesUserId, weworkUserIdValue);
    if (!StringUtils.hasText(weworkUserId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "weworkUserId不能为空");
    }
    return createLocalContactWay(checkedSalesUserId, state, weworkUserId);
  }

  /** 新建销售渠道二维码入口；微信小程序码改为本地 PNG 兼容生成。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createSalesQrcode(CrmSalesQrcodeRequest request) {
    Map<String, Object> channel =
        createSalesChannel(request == null ? null : request.toSalesChannelCreateRequest());
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("channel", channel);
    if (request != null && Boolean.TRUE.equals(request.generateWxacode())) {
      String scene = normalizedText(channel.get("scene"), 32);
      result.put(
          "wxacode",
          localMiniProgramCode(scene, request.page(), request.envVersion(), request.width()));
    }
    return result;
  }

  /** 生成小程序测试码本地兼容结果；不依赖微信小程序配置。 */
  public Map<String, Object> createMiniProgramQrcodeTest(
      CrmMiniProgramQrcodeTestRequest request) {
    String scene = normalizedText(request == null ? null : request.scene(), 32);
    if (!StringUtils.hasText(scene)) {
      scene = buildTestScene();
    }
    if (!StringUtils.hasText(scene)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "scene不能为空");
    }
    if (scene.length() > 32) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信小程序 scene 长度不能超过32个字符");
    }
    String page = normalizeMiniProgramPage(request == null ? null : normalizedText(request.page(), 128));
    String envVersion = normalizeEnvVersion(request == null ? null : normalizedText(request.envVersion(), 16));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("envVersion", envVersion);
    result.put("page", page);
    result.put("scene", scene);
    result.put(
        "wxacode",
        localMiniProgramCode(
            scene, page, envVersion, request == null ? null : request.width()));
    return result;
  }

  /** 小程序登录 session 本地兼容结果；不请求微信 jscode2session。 */
  public Map<String, Object> exchangeMiniProgramSessionLocal(Map<String, Object> body) {
    String code = normalizedText(body == null ? null : body.get("code"), 256);
    if (!StringUtils.hasText(code)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "code不能为空");
    }
    return Map.of(
        "configured",
        hasEnv("WECHAT_MINIPROGRAM_APP_ID") && hasEnv("WECHAT_MINIPROGRAM_APP_SECRET"),
        "externalCall",
        false,
        "mode",
        "local_stub",
        "openid",
        "",
        "unionid",
        "");
  }

  /** 小程序手机号授权本地兼容结果；不请求微信手机号接口。 */
  public Map<String, Object> getMiniProgramPhoneLocal(Map<String, Object> body) {
    String code = normalizedText(body == null ? null : body.get("code"), 256);
    if (!StringUtils.hasText(code)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "手机号授权 code 不能为空");
    }
    return Map.of(
        "configured",
        hasEnv("WECHAT_MINIPROGRAM_APP_ID") && hasEnv("WECHAT_MINIPROGRAM_APP_SECRET"),
        "externalCall",
        false,
        "mode",
        "local_stub",
        "phoneNumber",
        "");
  }

  private Integer scopedSalesUserId(UserTokenPayload payload, Integer requestedSalesUserId) {
    if (payload.roles() != null && payload.roles().contains("Super")) {
      return requestedSalesUserId;
    }
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
      return Integer.MAX_VALUE;
    }
    return centerUserId.intValue();
  }

  private Integer writableSalesUserId(UserTokenPayload payload, Object requestedSalesUserId) {
    if (payload.roles() != null && payload.roles().contains("Super")) {
      if (requestedSalesUserId != null) {
        return positiveInteger(requestedSalesUserId, "salesUserId必须是有效的正整数");
      }
      return currentCenterUserId(payload);
    }
    Integer currentUserId = currentCenterUserId(payload);
    return currentUserId == null ? Integer.MAX_VALUE : currentUserId;
  }

  private void assertOwnerBindingWritable(UserTokenPayload payload, int bindingId) {
    Integer scopedSalesUserId = scopedSalesUserId(payload, null);
    if (scopedSalesUserId != null && !crmRepository.ownerBindingBelongsTo(bindingId, scopedSalesUserId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无权操作该客户归属");
    }
  }

  private Integer currentCenterUserId(UserTokenPayload payload) {
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
      return null;
    }
    return centerUserId.intValue();
  }

  private int positiveInteger(Object value, String message) {
    if (value instanceof Number number && number.intValue() > 0) {
      return number.intValue();
    }
    try {
      int parsed = Integer.parseInt(String.valueOf(value == null ? "" : value).trim());
      if (parsed > 0) {
        return parsed;
      }
    } catch (RuntimeException ignored) {
      // Fall through to old CRM validation message.
    }
    throw new BusinessException(HttpStatus.BAD_REQUEST, message);
  }

  private String normalizeScene(String value) {
    String scene = value == null ? "" : value.trim();
    if (!StringUtils.hasText(scene)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "scene不能为空");
    }
    if (scene.length() > 32) {
      scene = scene.substring(0, 32);
    }
    if (!scene.matches("^[\\w:-]+$")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "scene 只能包含字母、数字、下划线、中横线和冒号");
    }
    return scene;
  }

  private String urlEncode(String value) {
    return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
  }

  private Map<String, Object> createLocalContactWay(
      int salesUserId, String state, String weworkUserId) {
    String qrContent =
        "wework://contact-way?state=" + urlEncode(state) + "&user=" + urlEncode(weworkUserId);
    String configId =
        "local_" + Integer.toUnsignedString((state + ":" + weworkUserId).hashCode(), 36);
    String qrCode = SimpleQrCodeGenerator.toPngDataUrl(qrContent, 430);
    return crmRepository.saveLocalContactWay(salesUserId, state, weworkUserId, configId, qrCode);
  }

  private String buildInviteUrl(String origin, String referer, Map<String, String> params) {
    String base = buildPublicOrigin(origin, referer);
    StringBuilder url = new StringBuilder(StringUtils.hasText(base) ? base : "");
    url.append("/invite/crm");
    boolean first = true;
    for (Map.Entry<String, String> entry : params.entrySet()) {
      if (StringUtils.hasText(entry.getValue())) {
        url.append(first ? "?" : "&")
            .append(urlEncode(entry.getKey()))
            .append("=")
            .append(urlEncode(entry.getValue()));
        first = false;
      }
    }
    return url.toString();
  }

  private String normalizeMiniProgramPage(String value) {
    return firstText(
        normalizedText(value, 128),
        envText("CRM_MINIPROGRAM_QRCODE_PAGE", DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE));
  }

  private String normalizeEnvVersion(String value) {
    String envVersion = normalizedText(value, 16);
    if (!StringUtils.hasText(envVersion)) {
      return "release";
    }
    return envVersion.matches("^(release|trial|develop)$") ? envVersion : "release";
  }

  private int normalizeExpireInterval(Integer value) {
    int days = value == null ? 30 : value;
    return Math.min(30, Math.max(1, days));
  }

  private Map<String, Object> localMiniProgramCode(
      String scene, Object pageValue, Object envVersionValue, Integer width) {
    String page = normalizeMiniProgramPage(normalizedText(pageValue, 128));
    String envVersion = normalizeEnvVersion(normalizedText(envVersionValue, 16));
    String content =
        "miniprogram://local-qrcode?page="
            + urlEncode(page)
            + "&scene="
            + urlEncode(scene)
            + "&envVersion="
            + urlEncode(envVersion);
    Map<String, Object> wxacode = new LinkedHashMap<>();
    wxacode.put("dataUrl", SimpleQrCodeGenerator.toPngDataUrl(content, width == null ? 430 : width));
    wxacode.put("mimeType", "image/png");
    return wxacode;
  }

  private String buildTestScene() {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    String scene = "test_" + Long.toString(System.currentTimeMillis(), 36) + "_" + suffix;
    return scene.length() <= 32 ? scene : scene.substring(0, 32);
  }

  private String normalizedText(Object value, int maxLength) {
    if (value == null) {
      return "";
    }
    String text = String.valueOf(value).trim();
    return text.length() <= maxLength ? text : text.substring(0, maxLength);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> objectMap(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
  }

  private Integer objectInteger(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private String firstText(Object... values) {
    for (Object value : values) {
      String text = normalizedText(value, 512);
      if (StringUtils.hasText(text)) {
        return text;
      }
    }
    return "";
  }

  private String buildPublicOrigin(String origin, String referer) {
    String requestOrigin = normalizeOrigin(StringUtils.hasText(origin) ? origin : referer);
    if (isLocalPublicOrigin(requestOrigin)) {
      return requestOrigin;
    }
    String configured = envText("CRM_INVITE_H5_BASE_URL", "");
    if (StringUtils.hasText(configured)) {
      String normalized = normalizeOrigin(configured);
      return StringUtils.hasText(normalized) ? normalized : configured.replaceAll("/+$", "");
    }
    return StringUtils.hasText(requestOrigin) ? requestOrigin : "";
  }

  private String normalizeOrigin(String value) {
    if (!StringUtils.hasText(value)) {
      return "";
    }
    try {
      URI uri = URI.create(value.trim());
      if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
        return "";
      }
      int port = uri.getPort();
      String authority = port > 0 ? uri.getHost() + ":" + port : uri.getHost();
      return uri.getScheme() + "://" + authority;
    } catch (RuntimeException error) {
      return "";
    }
  }

  private boolean isLocalPublicOrigin(String origin) {
    if (!StringUtils.hasText(origin)) {
      return false;
    }
    try {
      String hostname = URI.create(origin).getHost();
      return "localhost".equals(hostname)
          || "127.0.0.1".equals(hostname)
          || "0.0.0.0".equals(hostname)
          || hostname.startsWith("10.")
          || hostname.startsWith("192.168.")
          || hostname.matches("^172\\.(1[6-9]|2\\d|3[01])\\..*");
    } catch (RuntimeException error) {
      return false;
    }
  }

  private boolean hasEnv(String name) {
    return StringUtils.hasText(envText(name, ""));
  }

  private String envText(String name, String fallback) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : fallback;
  }

  static BusinessException schemaMissingException() {
    return new BusinessException(
        HttpStatus.INTERNAL_SERVER_ERROR, "CRM数据表未初始化，请先执行中心库 db push 后再测试绑定");
  }
}
