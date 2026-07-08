package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 微信支付只读公开配置和本地订单快照接口；支付下单、退款和回调仍按专项迁移。 */
@RestController
public class WechatPayController {

  private final WechatPayRefundOrderService wechatPayRefundOrderService;
  private final WechatJsSdkConfigService wechatJsSdkConfigService;
  private final WechatPayPublicConfigService wechatPayPublicConfigService;

  /** 测试保留的兼容构造器；生产注入使用包含退款订单服务的构造器。 */
  public WechatPayController(WechatPayPublicConfigService wechatPayPublicConfigService) {
    this(null, null, wechatPayPublicConfigService);
  }

  /** 测试保留的兼容构造器；第三十三批退款订单测试不需要 JS-SDK 签名服务。 */
  public WechatPayController(
      WechatPayRefundOrderService wechatPayRefundOrderService,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    this(wechatPayRefundOrderService, null, wechatPayPublicConfigService);
  }

  @Autowired
  public WechatPayController(
      WechatPayRefundOrderService wechatPayRefundOrderService,
      WechatJsSdkConfigService wechatJsSdkConfigService,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    this.wechatPayRefundOrderService = wechatPayRefundOrderService;
    this.wechatJsSdkConfigService = wechatJsSdkConfigService;
    this.wechatPayPublicConfigService = wechatPayPublicConfigService;
  }

  /** App 支付公开配置，不暴露私钥、API v3 key 或证书序列号。 */
  @GetMapping("/wechat/pay/app/config")
  public ApiResponse<Map<String, Object>> appConfig() {
    return ApiResponse.ok(wechatPayPublicConfigService.getAppConfigStatus());
  }

  /** 会员退款订单只读列表；不查询微信、不发起退款、不更新本地退款状态。 */
  @GetMapping("/wechat/pay/refund/orders")
  public ApiResponse<Map<String, Object>> refundOrders() {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    return ApiResponse.ok(wechatPayRefundOrderService.listRefundOrders());
  }

  /** 微信支付查单兼容入口；只读中心库订单快照，不请求微信、不同步会员状态。 */
  @GetMapping("/wechat/pay/query")
  public ApiResponse<Map<String, Object>> queryOrder(
      @RequestParam(required = false) String outTradeNo) {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    return ApiResponse.ok(wechatPayRefundOrderService.queryLocalPaymentOrder(outTradeNo));
  }

  /** 微信 APP 预支付兼容入口；只创建本地订单快照，不请求微信预下单。 */
  @PostMapping("/wechat/pay/app/prepay")
  public ApiResponse<Map<String, Object>> appPrepay(
      @RequestBody(required = false) Map<String, Object> body) {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    return ApiResponse.ok(wechatPayRefundOrderService.createAppPrepayLocal(body));
  }

  /** 微信 H5 预支付兼容入口；只创建本地订单快照，不请求微信预下单。 */
  @PostMapping("/wechat/pay/h5/prepay")
  public ApiResponse<Map<String, Object>> h5Prepay(
      @RequestBody(required = false) Map<String, Object> body) {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    return ApiResponse.ok(wechatPayRefundOrderService.createH5PrepayLocal(body));
  }

  /** 微信支付通知兼容入口；接收原始报文并返回微信要求的原生 SUCCESS/FAIL 结构。 */
  @PostMapping("/wechat/pay/notify")
  public ResponseEntity<Map<String, String>> payNotify(
      @RequestBody(required = false) String rawBody,
      @RequestHeader Map<String, String> headers) {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    if (rawBody == null || rawBody.isBlank()) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("code", "FAIL", "message", "回调报文为空"));
    }
    try {
      wechatPayRefundOrderService.acceptPayNotificationLocal(rawBody, headers);
    } catch (BusinessException error) {
      return ResponseEntity.status(error.getStatus())
          .body(Map.of("code", "FAIL", "message", error.getMessage()));
    }
    return ResponseEntity.ok(Map.of("code", "SUCCESS", "message", "成功"));
  }

  /** 会员退款兼容入口；只登记本地退款申请，不请求微信退款接口。 */
  @PostMapping("/wechat/pay/refund")
  public ApiResponse<Object> refund(@RequestBody(required = false) Map<String, Object> body) {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    return ApiResponse.ok(wechatPayRefundOrderService.createRefundLocal(body));
  }

  /** 微信退款通知兼容入口；接收原始报文并返回微信要求的原生 SUCCESS/FAIL 结构。 */
  @PostMapping("/wechat/pay/refund-notify")
  public ResponseEntity<Map<String, String>> refundNotify(
      @RequestBody(required = false) String rawBody,
      @RequestHeader Map<String, String> headers) {
    if (wechatPayRefundOrderService == null) {
      throw new IllegalStateException("WechatPayRefundOrderService is required");
    }
    if (rawBody == null || rawBody.isBlank()) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("code", "FAIL", "message", "回调报文为空"));
    }
    try {
      wechatPayRefundOrderService.acceptRefundNotificationLocal(rawBody, headers);
    } catch (BusinessException error) {
      return ResponseEntity.status(error.getStatus())
          .body(Map.of("code", "FAIL", "message", error.getMessage()));
    }
    return ResponseEntity.ok(Map.of("code", "SUCCESS", "message", "成功"));
  }

  /** 微信 JS-SDK 配置签名；未配置时返回 enabled=false，不触发支付流程。 */
  @GetMapping("/wechat/js-sdk-config")
  public ApiResponse<Map<String, Object>> jsSdkConfig(
      @RequestParam(required = false) String url,
      @RequestParam(required = false) String debug) {
    if (wechatJsSdkConfigService == null) {
      throw new IllegalStateException("WechatJsSdkConfigService is required");
    }
    return ApiResponse.ok(wechatJsSdkConfigService.buildConfig(url, "1".equals(debug)));
  }
}
