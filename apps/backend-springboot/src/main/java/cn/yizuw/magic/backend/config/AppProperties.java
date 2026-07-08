package cn.yizuw.magic.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

  private final Cors cors = new Cors();
  private String defaultCustomerId = "default";
  private final Hezhong hezhong = new Hezhong();
  private String iosStoreUrl =
      "https://apps.apple.com/cn/app/%E7%9E%B0%E7%BB%B4%E6%99%BA%E7%AE%A1/id6760279136";
  private final InternalApi internalApi = new InternalApi();
  private final Jwt jwt = new Jwt();
  private final Kafka kafka = new Kafka();
  private final RabbitMq rabbitMq = new RabbitMq();
  private final RefreshCookie refreshCookie = new RefreshCookie();
  private final Redis redis = new Redis();
  private final Sms sms = new Sms();
  private final XxlJob xxlJob = new XxlJob();
  private final Ymsino ymsino = new Ymsino();

  public Cors getCors() {
    return cors;
  }

  public String getDefaultCustomerId() {
    return defaultCustomerId;
  }

  public Hezhong getHezhong() {
    return hezhong;
  }

  public void setDefaultCustomerId(String defaultCustomerId) {
    this.defaultCustomerId = defaultCustomerId;
  }

  public InternalApi getInternalApi() {
    return internalApi;
  }

  public String getIosStoreUrl() {
    return iosStoreUrl;
  }

  public void setIosStoreUrl(String iosStoreUrl) {
    this.iosStoreUrl = iosStoreUrl;
  }

  public Jwt getJwt() {
    return jwt;
  }

  public Kafka getKafka() {
    return kafka;
  }

  public RabbitMq getRabbitMq() {
    return rabbitMq;
  }

  public RefreshCookie getRefreshCookie() {
    return refreshCookie;
  }

  public Redis getRedis() {
    return redis;
  }

  public Sms getSms() {
    return sms;
  }

  public XxlJob getXxlJob() {
    return xxlJob;
  }

  public Ymsino getYmsino() {
    return ymsino;
  }

  public static class Cors {
    private String allowedOrigins = "*";

    public String getAllowedOrigins() {
      return allowedOrigins;
    }

    public void setAllowedOrigins(String allowedOrigins) {
      this.allowedOrigins = allowedOrigins;
    }
  }

  public static class Jwt {
    private String accessTokenExpiresIn = "30m";
    private String accessTokenSecret = "";
    private String refreshTokenExpiresIn = "7d";
    private String refreshTokenSecret = "";

    public String getAccessTokenExpiresIn() {
      return accessTokenExpiresIn;
    }

    public void setAccessTokenExpiresIn(String accessTokenExpiresIn) {
      this.accessTokenExpiresIn = accessTokenExpiresIn;
    }

    public String getAccessTokenSecret() {
      return accessTokenSecret;
    }

    public void setAccessTokenSecret(String accessTokenSecret) {
      this.accessTokenSecret = accessTokenSecret;
    }

    public String getRefreshTokenExpiresIn() {
      return refreshTokenExpiresIn;
    }

    public void setRefreshTokenExpiresIn(String refreshTokenExpiresIn) {
      this.refreshTokenExpiresIn = refreshTokenExpiresIn;
    }

    public String getRefreshTokenSecret() {
      return refreshTokenSecret;
    }

    public void setRefreshTokenSecret(String refreshTokenSecret) {
      this.refreshTokenSecret = refreshTokenSecret;
    }
  }

  public static class Hezhong {
    private String baseUrl = "https://devhzeb.szhzzd.top";
    private String loginKey = "";
    private String loginUsername = "";
    private long timeoutMs = 15000;
    private long tokenRefreshLeewayMs = 120000;

    public String getBaseUrl() {
      return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    public String getLoginKey() {
      return loginKey;
    }

    public void setLoginKey(String loginKey) {
      this.loginKey = loginKey;
    }

    public String getLoginUsername() {
      return loginUsername;
    }

    public void setLoginUsername(String loginUsername) {
      this.loginUsername = loginUsername;
    }

    public long getTimeoutMs() {
      return timeoutMs;
    }

    public void setTimeoutMs(long timeoutMs) {
      this.timeoutMs = timeoutMs;
    }

    public long getTokenRefreshLeewayMs() {
      return tokenRefreshLeewayMs;
    }

    public void setTokenRefreshLeewayMs(long tokenRefreshLeewayMs) {
      this.tokenRefreshLeewayMs = tokenRefreshLeewayMs;
    }
  }

  public static class Kafka {
    private boolean consumerEnabled;
    private boolean outboxDispatchEnabled;
    private boolean outboxEventWriteEnabled;
    private long outboxDispatchIntervalMs = 5000;
    private boolean required = true;

    public boolean isConsumerEnabled() {
      return consumerEnabled;
    }

    public void setConsumerEnabled(boolean consumerEnabled) {
      this.consumerEnabled = consumerEnabled;
    }

    public long getOutboxDispatchIntervalMs() {
      return outboxDispatchIntervalMs;
    }

    public void setOutboxDispatchIntervalMs(long outboxDispatchIntervalMs) {
      this.outboxDispatchIntervalMs = outboxDispatchIntervalMs;
    }

    public boolean isOutboxDispatchEnabled() {
      return outboxDispatchEnabled;
    }

    public void setOutboxDispatchEnabled(boolean outboxDispatchEnabled) {
      this.outboxDispatchEnabled = outboxDispatchEnabled;
    }

    public boolean isOutboxEventWriteEnabled() {
      return outboxEventWriteEnabled;
    }

    public void setOutboxEventWriteEnabled(boolean outboxEventWriteEnabled) {
      this.outboxEventWriteEnabled = outboxEventWriteEnabled;
    }

    public boolean isRequired() {
      return required;
    }

    public void setRequired(boolean required) {
      this.required = required;
    }
  }

  public static class RabbitMq {
    private boolean consumerEnabled;
    private boolean enabled = true;
    private boolean notificationConsumerDelegationEnabled;
    private String notificationConsumerDelegationRouteGuard =
        "organization_provisioning_completed";
    private boolean notificationDispatchEnabled;
    private boolean notificationRoutingConsumerEnabled;
    private boolean organizationProvisioningNotificationConsumerEnabled;
    private String organizationProvisioningProviderChannelGuard = "in_app";
    private boolean organizationProvisioningInAppNotificationDdlApplied;
    private boolean organizationProvisioningInAppNotificationInsertEnabled;
    private boolean organizationProvisioningInAppProviderClaimEnabled;
    private boolean organizationProvisioningInAppProviderListenerAutoExecutionEnabled;
    private boolean organizationProvisioningInAppProviderMarkFailureEnabled;
    private boolean organizationProvisioningInAppProviderMarkSuccessEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterListenerNoopEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterValidatorEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterBridgeEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled;
    private boolean organizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled;
    private boolean organizationProvisioningProviderSendEnabled;
    private boolean notificationPublishEnabled;
    private boolean required = true;
    private long retryDelayMs = 60000;

    public boolean isConsumerEnabled() {
      return consumerEnabled;
    }

    public void setConsumerEnabled(boolean consumerEnabled) {
      this.consumerEnabled = consumerEnabled;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public boolean isNotificationPublishEnabled() {
      return notificationPublishEnabled;
    }

    public boolean isNotificationConsumerDelegationEnabled() {
      return notificationConsumerDelegationEnabled;
    }

    public void setNotificationConsumerDelegationEnabled(
        boolean notificationConsumerDelegationEnabled) {
      this.notificationConsumerDelegationEnabled = notificationConsumerDelegationEnabled;
    }

    public String getNotificationConsumerDelegationRouteGuard() {
      return notificationConsumerDelegationRouteGuard;
    }

    public void setNotificationConsumerDelegationRouteGuard(
        String notificationConsumerDelegationRouteGuard) {
      this.notificationConsumerDelegationRouteGuard =
          notificationConsumerDelegationRouteGuard;
    }

    public boolean isNotificationDispatchEnabled() {
      return notificationDispatchEnabled;
    }

    public void setNotificationDispatchEnabled(boolean notificationDispatchEnabled) {
      this.notificationDispatchEnabled = notificationDispatchEnabled;
    }

    public boolean isNotificationRoutingConsumerEnabled() {
      return notificationRoutingConsumerEnabled;
    }

    public boolean isOrganizationProvisioningNotificationConsumerEnabled() {
      return organizationProvisioningNotificationConsumerEnabled;
    }

    public String getOrganizationProvisioningProviderChannelGuard() {
      return organizationProvisioningProviderChannelGuard;
    }

    public boolean isOrganizationProvisioningInAppNotificationDdlApplied() {
      return organizationProvisioningInAppNotificationDdlApplied;
    }

    public boolean isOrganizationProvisioningInAppNotificationInsertEnabled() {
      return organizationProvisioningInAppNotificationInsertEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderClaimEnabled() {
      return organizationProvisioningInAppProviderClaimEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderListenerAutoExecutionEnabled() {
      return organizationProvisioningInAppProviderListenerAutoExecutionEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderMarkFailureEnabled() {
      return organizationProvisioningInAppProviderMarkFailureEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderMarkSuccessEnabled() {
      return organizationProvisioningInAppProviderMarkSuccessEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterEnabled() {
      return organizationProvisioningInAppProviderResultAdapterEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled() {
      return organizationProvisioningInAppProviderResultAdapterListenerNoopEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled() {
      return organizationProvisioningInAppProviderResultAdapterValidatorEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled() {
      return organizationProvisioningInAppProviderResultAdapterBridgeEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled() {
      return organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled() {
      return organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled;
    }

    public boolean isOrganizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled() {
      return organizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled;
    }

    public void setNotificationRoutingConsumerEnabled(
        boolean notificationRoutingConsumerEnabled) {
      this.notificationRoutingConsumerEnabled = notificationRoutingConsumerEnabled;
    }

    public boolean isOrganizationProvisioningProviderSendEnabled() {
      return organizationProvisioningProviderSendEnabled;
    }

    public void setOrganizationProvisioningNotificationConsumerEnabled(
        boolean organizationProvisioningNotificationConsumerEnabled) {
      this.organizationProvisioningNotificationConsumerEnabled =
          organizationProvisioningNotificationConsumerEnabled;
    }

    public void setOrganizationProvisioningInAppNotificationDdlApplied(
        boolean organizationProvisioningInAppNotificationDdlApplied) {
      this.organizationProvisioningInAppNotificationDdlApplied =
          organizationProvisioningInAppNotificationDdlApplied;
    }

    public void setOrganizationProvisioningInAppNotificationInsertEnabled(
        boolean organizationProvisioningInAppNotificationInsertEnabled) {
      this.organizationProvisioningInAppNotificationInsertEnabled =
          organizationProvisioningInAppNotificationInsertEnabled;
    }

    public void setOrganizationProvisioningInAppProviderClaimEnabled(
        boolean organizationProvisioningInAppProviderClaimEnabled) {
      this.organizationProvisioningInAppProviderClaimEnabled =
          organizationProvisioningInAppProviderClaimEnabled;
    }

    public void setOrganizationProvisioningInAppProviderListenerAutoExecutionEnabled(
        boolean organizationProvisioningInAppProviderListenerAutoExecutionEnabled) {
      this.organizationProvisioningInAppProviderListenerAutoExecutionEnabled =
          organizationProvisioningInAppProviderListenerAutoExecutionEnabled;
    }

    public void setOrganizationProvisioningInAppProviderMarkFailureEnabled(
        boolean organizationProvisioningInAppProviderMarkFailureEnabled) {
      this.organizationProvisioningInAppProviderMarkFailureEnabled =
          organizationProvisioningInAppProviderMarkFailureEnabled;
    }

    public void setOrganizationProvisioningInAppProviderMarkSuccessEnabled(
        boolean organizationProvisioningInAppProviderMarkSuccessEnabled) {
      this.organizationProvisioningInAppProviderMarkSuccessEnabled =
          organizationProvisioningInAppProviderMarkSuccessEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterEnabled =
          organizationProvisioningInAppProviderResultAdapterEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterListenerNoopEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterListenerNoopEnabled =
          organizationProvisioningInAppProviderResultAdapterListenerNoopEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterValidatorEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterValidatorEnabled =
          organizationProvisioningInAppProviderResultAdapterValidatorEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterBridgeEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterBridgeEnabled =
          organizationProvisioningInAppProviderResultAdapterBridgeEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled =
          organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled =
          organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled;
    }

    public void setOrganizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled(
        boolean organizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled) {
      this.organizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled =
          organizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled;
    }

    public void setOrganizationProvisioningProviderChannelGuard(
        String organizationProvisioningProviderChannelGuard) {
      this.organizationProvisioningProviderChannelGuard =
          organizationProvisioningProviderChannelGuard;
    }

    public void setOrganizationProvisioningProviderSendEnabled(
        boolean organizationProvisioningProviderSendEnabled) {
      this.organizationProvisioningProviderSendEnabled =
          organizationProvisioningProviderSendEnabled;
    }

    public void setNotificationPublishEnabled(boolean notificationPublishEnabled) {
      this.notificationPublishEnabled = notificationPublishEnabled;
    }

    public boolean isRequired() {
      return required;
    }

    public void setRequired(boolean required) {
      this.required = required;
    }

    public long getRetryDelayMs() {
      return retryDelayMs;
    }

    public void setRetryDelayMs(long retryDelayMs) {
      this.retryDelayMs = retryDelayMs;
    }
  }

  public static class RefreshCookie {
    private long maxAgeSeconds = 604800;
    private String name = "jwt";
    private boolean secure;

    public long getMaxAgeSeconds() {
      return maxAgeSeconds;
    }

    public void setMaxAgeSeconds(long maxAgeSeconds) {
      this.maxAgeSeconds = maxAgeSeconds;
    }

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public boolean isSecure() {
      return secure;
    }

    public void setSecure(boolean secure) {
      this.secure = secure;
    }
  }

  public static class Redis {
    private boolean organizationProvisioningRefreshEnabled;

    public boolean isOrganizationProvisioningRefreshEnabled() {
      return organizationProvisioningRefreshEnabled;
    }

    public void setOrganizationProvisioningRefreshEnabled(
        boolean organizationProvisioningRefreshEnabled) {
      this.organizationProvisioningRefreshEnabled = organizationProvisioningRefreshEnabled;
    }
  }

  public static class Sms {
    private int codeLength = 6;
    private long codeTtlSeconds = 300;
    private int maxVerifyAttempts = 5;
    private long resendIntervalSeconds = 60;

    public int getCodeLength() {
      return codeLength;
    }

    public void setCodeLength(int codeLength) {
      this.codeLength = codeLength;
    }

    public long getCodeTtlSeconds() {
      return codeTtlSeconds;
    }

    public void setCodeTtlSeconds(long codeTtlSeconds) {
      this.codeTtlSeconds = codeTtlSeconds;
    }

    public int getMaxVerifyAttempts() {
      return maxVerifyAttempts;
    }

    public void setMaxVerifyAttempts(int maxVerifyAttempts) {
      this.maxVerifyAttempts = maxVerifyAttempts;
    }

    public long getResendIntervalSeconds() {
      return resendIntervalSeconds;
    }

    public void setResendIntervalSeconds(long resendIntervalSeconds) {
      this.resendIntervalSeconds = resendIntervalSeconds;
    }
  }

  public static class XxlJob {
    private String accessToken = "";
    private String adminAddresses = "";
    private boolean enabled;
    private String executorAddress = "";
    private String executorAppname = "magic-backend-springboot";
    private String executorIp = "";
    private int executorPort = 9999;
    private String logPath = "./logs/xxl-job";
    private int logRetentionDays = 30;

    public String getAccessToken() {
      return accessToken;
    }

    public void setAccessToken(String accessToken) {
      this.accessToken = accessToken;
    }

    public String getAdminAddresses() {
      return adminAddresses;
    }

    public void setAdminAddresses(String adminAddresses) {
      this.adminAddresses = adminAddresses;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public String getExecutorAddress() {
      return executorAddress;
    }

    public void setExecutorAddress(String executorAddress) {
      this.executorAddress = executorAddress;
    }

    public String getExecutorAppname() {
      return executorAppname;
    }

    public void setExecutorAppname(String executorAppname) {
      this.executorAppname = executorAppname;
    }

    public String getExecutorIp() {
      return executorIp;
    }

    public void setExecutorIp(String executorIp) {
      this.executorIp = executorIp;
    }

    public int getExecutorPort() {
      return executorPort;
    }

    public void setExecutorPort(int executorPort) {
      this.executorPort = executorPort;
    }

    public String getLogPath() {
      return logPath;
    }

    public void setLogPath(String logPath) {
      this.logPath = logPath;
    }

    public int getLogRetentionDays() {
      return logRetentionDays;
    }

    public void setLogRetentionDays(int logRetentionDays) {
      this.logRetentionDays = logRetentionDays;
    }
  }

  public static class Ymsino {
    private String baseUrl = "http://pt.ymsino1.com/ymcb/inter";
    private String defaultPtId = "YZWL";
    private String electricTjType = "0";
    private String orgId = "1024";
    private String password = "";
    private long refreshLeewayMs = 600000;
    private long timeoutMs = 15000;
    private String username = "";
    private String waterTjType = "1";

    public String getBaseUrl() {
      return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    public String getDefaultPtId() {
      return defaultPtId;
    }

    public void setDefaultPtId(String defaultPtId) {
      this.defaultPtId = defaultPtId;
    }

    public String getElectricTjType() {
      return electricTjType;
    }

    public void setElectricTjType(String electricTjType) {
      this.electricTjType = electricTjType;
    }

    public String getOrgId() {
      return orgId;
    }

    public void setOrgId(String orgId) {
      this.orgId = orgId;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public long getRefreshLeewayMs() {
      return refreshLeewayMs;
    }

    public void setRefreshLeewayMs(long refreshLeewayMs) {
      this.refreshLeewayMs = refreshLeewayMs;
    }

    public long getTimeoutMs() {
      return timeoutMs;
    }

    public void setTimeoutMs(long timeoutMs) {
      this.timeoutMs = timeoutMs;
    }

    public String getUsername() {
      return username;
    }

    public void setUsername(String username) {
      this.username = username;
    }

    public String getWaterTjType() {
      return waterTjType;
    }

    public void setWaterTjType(String waterTjType) {
      this.waterTjType = waterTjType;
    }
  }

  public static class InternalApi {
    private String token = "";

    public String getToken() {
      return token;
    }

    public void setToken(String token) {
      this.token = token;
    }
  }
}
