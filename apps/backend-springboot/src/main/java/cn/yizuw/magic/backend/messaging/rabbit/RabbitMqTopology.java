package cn.yizuw.magic.backend.messaging.rabbit;

public final class RabbitMqTopology {

  public static final String EXCHANGE_DELAY = "magic.delay.exchange";
  public static final String EXCHANGE_DLX = "magic.dlx.exchange";
  public static final String EXCHANGE_LIGHT_TASK = "magic.light-task.exchange";
  public static final String EXCHANGE_NOTIFICATION = "magic.notification.exchange";

  public static final String QUEUE_DELAY_RETRY = "magic.delay.retry.queue";
  public static final String QUEUE_LIGHT_TASK = "magic.light-task.queue";
  public static final String QUEUE_LIGHT_TASK_DLQ = "magic.light-task.dlq";
  public static final String QUEUE_NOTIFICATION = "magic.notification.queue";
  public static final String QUEUE_NOTIFICATION_DLQ = "magic.notification.dlq";
  public static final String QUEUE_NOTIFICATION_RETRY = "magic.notification.retry.queue";

  public static final String ROUTING_DELAY_RETRY = "delay.retry";
  public static final String ROUTING_LIGHT_TASK = "light-task";
  public static final String ROUTING_LIGHT_TASK_DLQ = "light-task.dlq";
  public static final String ROUTING_NOTIFICATION = "notification";
  public static final String ROUTING_NOTIFICATION_DLQ = "notification.dlq";
  public static final String ROUTING_NOTIFICATION_RETRY = "notification.retry";

  private RabbitMqTopology() {}
}
