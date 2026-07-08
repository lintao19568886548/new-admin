package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 微信支付退款远程调用编排服务；只负责外呼、验签和解析，不更新本地退款状态。 */
@Service
public class WechatPayRefundRemoteService {

  private final WechatPayRefundQueryRequestFactory queryRequestFactory;
  private final WechatPayRefundCreateRequestFactory createRequestFactory;
  private final WechatPayHttpClient httpClient;
  private final WechatPayHttpResponseVerificationService responseVerificationService;
  private final WechatPayRefundResponseMapper responseMapper;

  public WechatPayRefundRemoteService(
      WechatPayRefundQueryRequestFactory queryRequestFactory,
      WechatPayRefundCreateRequestFactory createRequestFactory,
      WechatPayHttpClient httpClient,
      WechatPayHttpResponseVerificationService responseVerificationService,
      WechatPayRefundResponseMapper responseMapper) {
    this.queryRequestFactory = queryRequestFactory;
    this.createRequestFactory = createRequestFactory;
    this.httpClient = httpClient;
    this.responseVerificationService = responseVerificationService;
    this.responseMapper = responseMapper;
  }

  /**
   * 查询微信支付退款单。
   *
   * <p>本方法会构造签名请求、执行 HTTP、校验微信响应签名并解析业务字段；状态写回、权益回滚和 outbox 写入
   * 仍留给后续退款对账 worker 批次。
   */
  public WechatPayRefundRemoteResult queryRefund(String outRefundNo) {
    WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest request =
        queryRequestFactory.build(outRefundNo);
    WechatPayHttpClient.WechatPayHttpResponse response = httpClient.execute(request);
    return verifiedResult(request.method(), request.path(), response);
  }

  /**
   * 创建微信支付退款单。
   *
   * <p>本方法只完成微信侧请求编排和可信响应解析，不更新 `vip_membership_refund`，不撤销会员权益。
   */
  public WechatPayRefundRemoteResult createRefund(
      WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand command) {
    WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest request =
        createRequestFactory.build(command);
    WechatPayHttpClient.WechatPayHttpResponse response = httpClient.execute(request);
    return verifiedResult(request.method(), request.path(), response);
  }

  private WechatPayRefundRemoteResult verifiedResult(
      String method, String path, WechatPayHttpClient.WechatPayHttpResponse response) {
    WechatPayHttpResponseVerificationService.WechatPayHttpResponseVerification verification =
        responseVerificationService.verify(response);
    requireSuccessStatus(response.statusCode());
    return new WechatPayRefundRemoteResult(
        method, path, response.statusCode(), verification, responseMapper.parse(response.body()));
  }

  private void requireSuccessStatus(int statusCode) {
    if (statusCode < 200 || statusCode >= 300) {
      throw new BusinessException(
          HttpStatus.BAD_GATEWAY, "微信支付退款远程调用失败，HTTP 状态码：" + statusCode);
    }
  }

  public record WechatPayRefundRemoteResult(
      String method,
      String path,
      int httpStatus,
      WechatPayHttpResponseVerificationService.WechatPayHttpResponseVerification verification,
      WechatPayRefundResponseMapper.WechatPayRefundResponse refund) {}
}
