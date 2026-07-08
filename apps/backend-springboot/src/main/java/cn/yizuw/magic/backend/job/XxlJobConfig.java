package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.AppProperties;
import com.xxl.job.core.executor.impl.XxlJobSpringExecutor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class XxlJobConfig {

  @Bean
  @ConditionalOnProperty(prefix = "app.xxl-job", name = "enabled", havingValue = "true")
  public XxlJobSpringExecutor xxlJobExecutor(AppProperties appProperties) {
    AppProperties.XxlJob xxlJob = appProperties.getXxlJob();
    XxlJobSpringExecutor executor = new XxlJobSpringExecutor();
    executor.setAdminAddresses(xxlJob.getAdminAddresses());
    executor.setAccessToken(xxlJob.getAccessToken());
    executor.setAppname(xxlJob.getExecutorAppname());
    executor.setAddress(xxlJob.getExecutorAddress());
    executor.setIp(xxlJob.getExecutorIp());
    executor.setPort(xxlJob.getExecutorPort());
    executor.setLogPath(xxlJob.getLogPath());
    executor.setLogRetentionDays(xxlJob.getLogRetentionDays());
    return executor;
  }
}
