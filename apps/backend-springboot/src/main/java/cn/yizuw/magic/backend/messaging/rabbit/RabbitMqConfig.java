package cn.yizuw.magic.backend.messaging.rabbit;

import cn.yizuw.magic.backend.config.AppProperties;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

  @Bean
  public MessageConverter rabbitMessageConverter() {
    return new JacksonJsonMessageConverter();
  }

  @Bean
  public TopicExchange notificationExchange() {
    return ExchangeBuilder.topicExchange(RabbitMqTopology.EXCHANGE_NOTIFICATION).durable(true).build();
  }

  @Bean
  public TopicExchange lightTaskExchange() {
    return ExchangeBuilder.topicExchange(RabbitMqTopology.EXCHANGE_LIGHT_TASK).durable(true).build();
  }

  @Bean
  public DirectExchange delayExchange() {
    return ExchangeBuilder.directExchange(RabbitMqTopology.EXCHANGE_DELAY).durable(true).build();
  }

  @Bean
  public DirectExchange deadLetterExchange() {
    return ExchangeBuilder.directExchange(RabbitMqTopology.EXCHANGE_DLX).durable(true).build();
  }

  @Bean
  public Queue notificationQueue() {
    return QueueBuilder.durable(RabbitMqTopology.QUEUE_NOTIFICATION)
        .deadLetterExchange(RabbitMqTopology.EXCHANGE_DLX)
        .deadLetterRoutingKey(RabbitMqTopology.ROUTING_NOTIFICATION_DLQ)
        .build();
  }

  @Bean
  public Queue notificationRetryQueue(AppProperties appProperties) {
    return QueueBuilder.durable(RabbitMqTopology.QUEUE_NOTIFICATION_RETRY)
        .ttl((int) appProperties.getRabbitMq().getRetryDelayMs())
        .deadLetterExchange(RabbitMqTopology.EXCHANGE_NOTIFICATION)
        .deadLetterRoutingKey(RabbitMqTopology.ROUTING_NOTIFICATION)
        .build();
  }

  @Bean
  public Queue notificationDeadLetterQueue() {
    return QueueBuilder.durable(RabbitMqTopology.QUEUE_NOTIFICATION_DLQ).build();
  }

  @Bean
  public Queue delayRetryQueue(AppProperties appProperties) {
    return QueueBuilder.durable(RabbitMqTopology.QUEUE_DELAY_RETRY)
        .ttl((int) appProperties.getRabbitMq().getRetryDelayMs())
        .deadLetterExchange(RabbitMqTopology.EXCHANGE_NOTIFICATION)
        .deadLetterRoutingKey(RabbitMqTopology.ROUTING_NOTIFICATION)
        .build();
  }

  @Bean
  public Queue lightTaskQueue() {
    return QueueBuilder.durable(RabbitMqTopology.QUEUE_LIGHT_TASK)
        .deadLetterExchange(RabbitMqTopology.EXCHANGE_DLX)
        .deadLetterRoutingKey(RabbitMqTopology.ROUTING_LIGHT_TASK_DLQ)
        .build();
  }

  @Bean
  public Queue lightTaskDeadLetterQueue() {
    return QueueBuilder.durable(RabbitMqTopology.QUEUE_LIGHT_TASK_DLQ).build();
  }

  @Bean
  public Binding notificationBinding(
      @Qualifier("notificationQueue") Queue notificationQueue,
      @Qualifier("notificationExchange") TopicExchange notificationExchange) {
    return BindingBuilder.bind(notificationQueue)
        .to(notificationExchange)
        .with(RabbitMqTopology.ROUTING_NOTIFICATION);
  }

  @Bean
  public Binding notificationRetryBinding(
      @Qualifier("notificationRetryQueue") Queue notificationRetryQueue,
      @Qualifier("notificationExchange") TopicExchange notificationExchange) {
    return BindingBuilder.bind(notificationRetryQueue)
        .to(notificationExchange)
        .with(RabbitMqTopology.ROUTING_NOTIFICATION_RETRY);
  }

  @Bean
  public Binding notificationDeadLetterBinding(
      @Qualifier("notificationDeadLetterQueue") Queue notificationDeadLetterQueue,
      @Qualifier("deadLetterExchange") DirectExchange deadLetterExchange) {
    return BindingBuilder.bind(notificationDeadLetterQueue)
        .to(deadLetterExchange)
        .with(RabbitMqTopology.ROUTING_NOTIFICATION_DLQ);
  }

  @Bean
  public Binding delayRetryBinding(
      @Qualifier("delayRetryQueue") Queue delayRetryQueue,
      @Qualifier("delayExchange") DirectExchange delayExchange) {
    return BindingBuilder.bind(delayRetryQueue)
        .to(delayExchange)
        .with(RabbitMqTopology.ROUTING_DELAY_RETRY);
  }

  @Bean
  public Binding lightTaskBinding(
      @Qualifier("lightTaskQueue") Queue lightTaskQueue,
      @Qualifier("lightTaskExchange") TopicExchange lightTaskExchange) {
    return BindingBuilder.bind(lightTaskQueue)
        .to(lightTaskExchange)
        .with(RabbitMqTopology.ROUTING_LIGHT_TASK);
  }

  @Bean
  public Binding lightTaskDeadLetterBinding(
      @Qualifier("lightTaskDeadLetterQueue") Queue lightTaskDeadLetterQueue,
      @Qualifier("deadLetterExchange") DirectExchange deadLetterExchange) {
    return BindingBuilder.bind(lightTaskDeadLetterQueue)
        .to(deadLetterExchange)
        .with(RabbitMqTopology.ROUTING_LIGHT_TASK_DLQ);
  }
}
