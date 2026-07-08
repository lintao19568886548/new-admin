package cn.yizuw.magic.backend.job;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class JobParameterParser {

  public Map<String, String> parse(String raw) {
    Map<String, String> result = new LinkedHashMap<>();
    if (!StringUtils.hasText(raw)) {
      return result;
    }

    Arrays.stream(raw.split("[,;\\n]"))
        .map(String::trim)
        .filter(StringUtils::hasText)
        .forEach(
            item -> {
              int separator = item.indexOf('=');
              if (separator > 0) {
                result.put(item.substring(0, separator).trim(), item.substring(separator + 1).trim());
              }
            });
    return result;
  }

  public boolean execute(Map<String, String> parameters) {
    return Boolean.parseBoolean(parameters.getOrDefault("execute", "false"));
  }

  public String customerId(Map<String, String> parameters) {
    return parameters.getOrDefault("customerId", "");
  }
}
