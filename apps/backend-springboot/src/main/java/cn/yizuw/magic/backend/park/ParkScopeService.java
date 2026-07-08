package cn.yizuw.magic.backend.park;

import cn.yizuw.magic.backend.security.UserTokenPayload;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ParkScopeService {

  private final ParkRepository parkRepository;

  public ParkScopeService(ParkRepository parkRepository) {
    this.parkRepository = parkRepository;
  }

  public List<Map<String, Object>> resolveAuthorizedParks(
      JdbcTemplate jdbcTemplate, UserTokenPayload payload) {
    if (payload.roles() != null && payload.roles().contains("Super")) {
      return parkRepository.findAllActiveParks(jdbcTemplate);
    }

    List<Map<String, Object>> directParks = parkRepository.findDirectParks(jdbcTemplate, payload.id());
    if (!directParks.isEmpty()) {
      return dedupe(directParks);
    }

    List<Map<String, Object>> legacyParks = parkRepository.findLegacyUserPark(jdbcTemplate, payload.id());
    if (!legacyParks.isEmpty()) {
      return dedupe(legacyParks);
    }

    return dedupe(parkRepository.findRoleParks(jdbcTemplate, payload.id()));
  }

  public List<Integer> resolveAuthorizedParkIds(JdbcTemplate jdbcTemplate, UserTokenPayload payload) {
    return resolveAuthorizedParks(jdbcTemplate, payload).stream()
        .map(park -> Number.class.cast(park.get("parkId")).intValue())
        .distinct()
        .toList();
  }

  private List<Map<String, Object>> dedupe(List<Map<String, Object>> parks) {
    Map<Integer, Map<String, Object>> byId = new LinkedHashMap<>();
    for (Map<String, Object> park : parks) {
      Object rawId = park.get("parkId");
      if (rawId instanceof Number number && number.intValue() > 0) {
        byId.put(number.intValue(), park);
      }
    }
    return List.copyOf(byId.values());
  }
}
