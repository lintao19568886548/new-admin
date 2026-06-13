export interface AttendanceOfficeLocation {
  lat: number;
  lng: number;
  name: string;
  radius: number;
}

export interface AttendanceLocationValidation {
  distanceMeters: null | number;
  inRange: boolean;
  isValid: boolean;
  nearestLocation: AttendanceOfficeLocation | null;
}

export const officeLocations: AttendanceOfficeLocation[] = [
  {
    lat: 23.099_596_024_527_226,
    lng: 113.769_574_897_051_29,
    name: '总部办公室',
    radius: 100,
  },
  {
    lat: 23.107_344,
    lng: 113.573_356,
    name: '广州新塘园区夏埔二',
    radius: 100,
  },
  {
    lat: 23.033_413_470_702_452,
    lng: 114.142_578_383_666_77,
    name: '桥头十一宏威',
    radius: 100,
  },
  {
    lat: 23.121_099,
    lng: 113.751_778,
    name: '东莞同兴园区',
    radius: 100,
  },
  {
    lat: 22.936_352_751_584_29,
    lng: 113.149_505_685_088_98,
    name: '佛山乐从园区',
    radius: 100,
  },
  {
    lat: 23.107_068_675_711_43,
    lng: 113.587_792_446_653_94,
    name: '广州西州二园区',
    radius: 100,
  },
  {
    lat: 23.105_772,
    lng: 113.592_908,
    name: '广州园区（西州一）',
    radius: 250,
  },
  {
    lat: 22.880_809,
    lng: 113.014_824,
    name: '佛山九江园区',
    radius: 130,
  },
  {
    lat: 23.105_563,
    lng: 113.592_559,
    name: '广州园区',
    radius: 100,
  },
  {
    lat: 23.112_274,
    lng: 113.590_177,
    name: '广州十一兄弟实业',
    radius: 100,
  },
  {
    lat: 22.769_621,
    lng: 114.377_519,
    name: '深圳坪山23园区',
    radius: 100,
  },
  {
    lat: 23.183_788,
    lng: 113.696_806,
    name: '广州荔新',
    radius: 120,
  },
];

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function isValidAttendanceCoordinate(params: {
  latitude: unknown;
  longitude: unknown;
}) {
  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }

  return Math.abs(latitude) > 0.000_001 || Math.abs(longitude) > 0.000_001;
}

export function getDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

export function validateAttendanceLocation(params: {
  latitude: unknown;
  longitude: unknown;
}): AttendanceLocationValidation {
  if (!isValidAttendanceCoordinate(params)) {
    return {
      distanceMeters: null,
      inRange: false,
      isValid: false,
      nearestLocation: null,
    };
  }

  const point = {
    lat: Number(params.latitude),
    lng: Number(params.longitude),
  };
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestLocation: AttendanceOfficeLocation | null = null;
  let inRange = false;

  for (const location of officeLocations) {
    const distance = getDistanceMeters(location, point);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLocation = location;
    }
    if (distance <= location.radius) {
      inRange = true;
    }
  }

  return {
    distanceMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
    inRange,
    isValid: true,
    nearestLocation,
  };
}
