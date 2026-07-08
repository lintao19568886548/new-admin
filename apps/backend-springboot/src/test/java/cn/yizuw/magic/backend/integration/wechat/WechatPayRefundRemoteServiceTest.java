package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付退款远程编排服务测试；只使用 fake transport，不请求生产微信接口。 */
class WechatPayRefundRemoteServiceTest {

  @Test
  void queryRefundSendsVerifiesAndParsesWechatResponse() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    AtomicReference<WechatPayHttpClient.WechatPayHttpRequest> sent = new AtomicReference<>();
    String body =
        "{\"refund_id\":\"5000001\",\"out_refund_no\":\"vip_refund_wxapp_1\","
            + "\"out_trade_no\":\"wxapp_order_1\",\"status\":\"SUCCESS\","
            + "\"amount\":{\"refund\":100,\"total\":300,\"currency\":\"CNY\"}}";
    WechatPayRefundRemoteService service =
        newService(
            keyPair,
            request -> {
              sent.set(request);
              return signedResponse(keyPair, 200, body);
            });

    WechatPayRefundRemoteService.WechatPayRefundRemoteResult result =
        service.queryRefund("vip_refund_wxapp_1");

    assertThat(sent.get().method()).isEqualTo("GET");
    assertThat(sent.get().uri().toString())
        .isEqualTo("https://api.mch.weixin.qq.com/v3/refund/domestic/refunds/vip_refund_wxapp_1");
    assertThat(result.method()).isEqualTo("GET");
    assertThat(result.path()).isEqualTo("/v3/refund/domestic/refunds/vip_refund_wxapp_1");
    assertThat(result.httpStatus()).isEqualTo(200);
    assertThat(result.verification().verified()).isTrue();
    assertThat(result.refund().outRefundNo()).isEqualTo("vip_refund_wxapp_1");
    assertThat(result.refund().localStatus()).isEqualTo("SUCCESS");
    assertThat(result.refund().refundAmount()).isEqualTo(100);
  }

  @Test
  void createRefundSendsPostRequestAndParsesWechatResponse() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    AtomicReference<WechatPayHttpClient.WechatPayHttpRequest> sent = new AtomicReference<>();
    String body =
        "{\"refund_id\":\"5000002\",\"out_refund_no\":\"vip_refund_wxapp_2\","
            + "\"transaction_id\":\"4200000000000000001\",\"status\":\"PROCESSING\","
            + "\"amount\":{\"refund\":80,\"total\":300,\"currency\":\"CNY\"}}";
    WechatPayRefundRemoteService service =
        newService(
            keyPair,
            request -> {
              sent.set(request);
              return signedResponse(keyPair, 200, body);
            });

    WechatPayRefundRemoteService.WechatPayRefundRemoteResult result =
        service.createRefund(
            new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand(
                "wxapp_order_2",
                "4200000000000000001",
                "vip_refund_wxapp_2",
                80,
                300,
                "membership refund",
                "https://api.example.com/api/wechat/pay/refund-notify",
                ""));

    assertThat(sent.get().method()).isEqualTo("POST");
    assertThat(sent.get().uri().toString()).isEqualTo("https://api.mch.weixin.qq.com/v3/refund/domestic/refunds");
    assertThat(sent.get().body()).contains("\"transaction_id\":\"4200000000000000001\"");
    assertThat(sent.get().body()).contains("\"out_refund_no\":\"vip_refund_wxapp_2\"");
    assertThat(result.method()).isEqualTo("POST");
    assertThat(result.path()).isEqualTo("/v3/refund/domestic/refunds");
    assertThat(result.refund().outRefundNo()).isEqualTo("vip_refund_wxapp_2");
    assertThat(result.refund().localStatus()).isEqualTo("PROCESSING");
  }

  @Test
  void queryRefundRejectsVerifiedNonSuccessHttpStatusBeforeBusinessParsing() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    String body = "{\"code\":\"RESOURCE_NOT_EXISTS\",\"message\":\"refund not found\"}";
    WechatPayRefundRemoteService service =
        newService(keyPair, request -> signedResponse(keyPair, 404, body));

    assertThatThrownBy(() -> service.queryRefund("vip_refund_missing"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付退款远程调用失败，HTTP 状态码：404");
  }

  private WechatPayRefundRemoteService newService(
      KeyPair keyPair, WechatPayHttpClient.Transport transport) {
    MockEnvironment signingEnvironment =
        new MockEnvironment()
            .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
            .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "merchant-serial-no")
            .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair));
    WechatPaySigningService signingService = new WechatPaySigningService(signingEnvironment);
    WechatPayHttpClient httpClient =
        new WechatPayHttpClient(
            new MockEnvironment().withProperty("WECHAT_PAY_EXTERNAL_HTTP_ENABLED", "true"),
            transport);
    WechatPayHttpResponseVerificationService verificationService =
        new WechatPayHttpResponseVerificationService(
            new WechatPaySignatureVerificationService(
                new MockEnvironment()
                    .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
                    .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair))));
    return new WechatPayRefundRemoteService(
        new WechatPayRefundQueryRequestFactory(signingService),
        new WechatPayRefundCreateRequestFactory(signingService),
        httpClient,
        verificationService,
        new WechatPayRefundResponseMapper());
  }

  private WechatPayHttpClient.WechatPayHttpResponse signedResponse(
      KeyPair keyPair, int statusCode, String body) throws Exception {
    String timestamp = "1780000000";
    String nonce = "nonce-1";
    return new WechatPayHttpClient.WechatPayHttpResponse(
        statusCode,
        body,
        Map.of(
            "Wechatpay-Serial",
            List.of("PUB_KEY_ID_1"),
            "Wechatpay-Timestamp",
            List.of(timestamp),
            "Wechatpay-Nonce",
            List.of(nonce),
            "Wechatpay-Signature",
            List.of(sign(keyPair, timestamp + "\n" + nonce + "\n" + body + "\n"))));
  }

  private String sign(KeyPair keyPair, String message) throws Exception {
    Signature signer = Signature.getInstance("SHA256withRSA");
    signer.initSign(keyPair.getPrivate());
    signer.update(message.getBytes(StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(signer.sign());
  }

  private KeyPair rsaKeyPair() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      return generator.generateKeyPair();
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  private String privateKeyPem(KeyPair keyPair) {
    return pem("PRIVATE KEY", keyPair.getPrivate().getEncoded());
  }

  private String publicKeyPem(KeyPair keyPair) {
    return pem("PUBLIC KEY", keyPair.getPublic().getEncoded());
  }

  private String pem(String type, byte[] content) {
    return "-----BEGIN "
        + type
        + "-----\n"
        + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
            .encodeToString(content)
        + "\n-----END "
        + type
        + "-----\n";
  }
}
