package cn.yizuw.magic.backend.integration.wework;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 企业微信回调接口；GET 用于 URL 验证，POST 只记录本地 CRM 回调日志。 */
@RestController
public class WeworkCallbackController {

  private final WeworkCallbackService weworkCallbackService;

  public WeworkCallbackController(WeworkCallbackService weworkCallbackService) {
    this.weworkCallbackService = weworkCallbackService;
  }

  /** 验证企业微信 URL 回调，签名通过后返回明文 echostr。 */
  @GetMapping("/wework/callback")
  public String verifyCallback(
      @RequestParam(required = false) String echostr,
      @RequestParam(required = false) String msg_signature,
      @RequestParam(required = false) String nonce,
      @RequestParam(required = false) String signature,
      @RequestParam(required = false) String timestamp) {
    return weworkCallbackService.verifyCallback(
        echostr, firstText(signature, msg_signature), nonce, timestamp);
  }

  /** 记录企业微信事件回调；不调用企微外部接口。 */
  @PostMapping("/wework/callback")
  public String recordCallback(
      @RequestBody(required = false) String rawBody,
      @RequestParam(required = false) String msg_signature,
      @RequestParam(required = false) String nonce,
      @RequestParam(required = false) String signature,
      @RequestParam(required = false) String timestamp) {
    return weworkCallbackService.recordCallback(rawBody, msg_signature, nonce, signature, timestamp);
  }

  private String firstText(String first, String second) {
    return org.springframework.util.StringUtils.hasText(first) ? first : second;
  }
}
