package cn.yizuw.magic.backend.messaging;

/** Kafka 消费日志认领结果，用于控制幂等消费和失败重试。 */
public enum EventConsumeClaimResult {
  /** 当前消费者获得处理权，可以继续执行业务副作用。 */
  CLAIMED,
  /** 当前事件已经成功消费，调用方应幂等跳过。 */
  DUPLICATE_SUCCESS,
  /** 当前事件正在被其它线程/实例处理，调用方应跳过本次处理。 */
  IN_PROGRESS
}
