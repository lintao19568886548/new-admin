package cn.yizuw.magic.backend.cache;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class CacheService {

  private static final Logger LOGGER = LoggerFactory.getLogger(CacheService.class);
  private static final int DELETE_BATCH_SIZE = 500;
  private static final long SCAN_COUNT = 500L;

  private final RedisTemplate<String, Object> redisTemplate;

  public CacheService(RedisTemplate<String, Object> redisTemplate) {
    this.redisTemplate = redisTemplate;
  }

  public <T> T getOrLoad(String key, Class<T> type, Duration ttl, Supplier<T> loader) {
    Optional<T> cached = get(key, type);
    if (cached.isPresent()) {
      return cached.get();
    }
    T value = loader.get();
    put(key, value, ttl);
    return value;
  }

  public <T> Optional<T> get(String key, Class<T> type) {
    try {
      Object value = redisTemplate.opsForValue().get(key);
      if (type.isInstance(value)) {
        return Optional.of(type.cast(value));
      }
    } catch (Exception error) {
      LOGGER.debug("Redis read skipped for key {}", key, error);
    }
    return Optional.empty();
  }

  public void put(String key, Object value, Duration ttl) {
    try {
      redisTemplate.opsForValue().set(key, value, ttl);
    } catch (Exception error) {
      LOGGER.debug("Redis write skipped for key {}", key, error);
    }
  }

  /** 按前缀清理缓存；Redis 不可用时忽略，保证写接口不被缓存清理失败阻断。 */
  public void evictByPrefix(String prefix) {
    if (!StringUtils.hasText(prefix)) {
      LOGGER.warn("Redis evict skipped for blank prefix");
      return;
    }
    try {
      ScanOptions options = ScanOptions.scanOptions().match(prefix + "*").count(SCAN_COUNT).build();
      List<String> batch = new ArrayList<>(DELETE_BATCH_SIZE);
      try (Cursor<String> cursor = redisTemplate.scan(options)) {
        while (cursor.hasNext()) {
          batch.add(cursor.next());
          if (batch.size() >= DELETE_BATCH_SIZE) {
            deleteBatch(batch);
          }
        }
      }
      deleteBatch(batch);
    } catch (Exception error) {
      LOGGER.debug("Redis evict skipped for prefix {}", prefix, error);
    }
  }

  private void deleteBatch(List<String> keys) {
    if (!keys.isEmpty()) {
      redisTemplate.delete(new ArrayList<>(keys));
      keys.clear();
    }
  }
}
