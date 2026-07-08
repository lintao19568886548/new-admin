package cn.yizuw.magic.backend.hrm;

import java.math.BigDecimal;
import java.util.Map;

/** 考勤定位校验工具，按旧 Nitro `attendance-location.ts` 的半径和距离口径迁移。 */
final class AttendanceLocationValidator {

  private static final double EARTH_RADIUS_METERS = 6_371_000D;

  private AttendanceLocationValidator() {}

  static ValidationResult validate(BigDecimal latitude, BigDecimal longitude) {
    if (!isValidCoordinate(latitude, longitude)) {
      return new ValidationResult(null, false, false, null);
    }

    double lat = latitude.doubleValue();
    double lng = longitude.doubleValue();
    double nearestDistance = Double.POSITIVE_INFINITY;
    Map<String, Object> nearestLocation = null;
    boolean inRange = false;

    for (Map<String, Object> location : AttendanceOfficeLocations.all()) {
      double distance =
          distanceMeters(
              number(location.get("lat")), number(location.get("lng")), lat, lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLocation = location;
      }
      if (distance <= number(location.get("radius"))) {
        inRange = true;
      }
    }

    return new ValidationResult(
        Double.isFinite(nearestDistance) ? nearestDistance : null,
        inRange,
        true,
        nearestLocation);
  }

  private static boolean isValidCoordinate(BigDecimal latitude, BigDecimal longitude) {
    if (latitude == null || longitude == null) {
      return false;
    }
    double lat = latitude.doubleValue();
    double lng = longitude.doubleValue();
    return Double.isFinite(lat)
        && Double.isFinite(lng)
        && lat >= -90
        && lat <= 90
        && lng >= -180
        && lng <= 180
        && (Math.abs(lat) > 0.000_001D || Math.abs(lng) > 0.000_001D);
  }

  private static double distanceMeters(double fromLat, double fromLng, double toLat, double toLng) {
    double dLat = Math.toRadians(toLat - fromLat);
    double dLng = Math.toRadians(toLng - fromLng);
    double fromLatRadians = Math.toRadians(fromLat);
    double toLatRadians = Math.toRadians(toLat);
    double haversine =
        Math.sin(dLat / 2D) * Math.sin(dLat / 2D)
            + Math.cos(fromLatRadians)
                * Math.cos(toLatRadians)
                * Math.sin(dLng / 2D)
                * Math.sin(dLng / 2D);
    double angularDistance = 2D * Math.atan2(Math.sqrt(haversine), Math.sqrt(1D - haversine));
    return EARTH_RADIUS_METERS * angularDistance;
  }

  private static double number(Object value) {
    return value instanceof Number number ? number.doubleValue() : 0D;
  }

  record ValidationResult(
      Double distanceMeters,
      boolean inRange,
      boolean valid,
      Map<String, Object> nearestLocation) {}
}
