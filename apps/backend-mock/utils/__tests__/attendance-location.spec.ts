import { describe, expect, it } from 'vitest';

import {
  officeLocations,
  validateAttendanceLocation,
} from '../attendance-location';

describe('attendance location validation', () => {
  it('rejects zero coordinates from failed location attempts', () => {
    expect(
      validateAttendanceLocation({
        latitude: 0,
        longitude: 0,
      }).isValid,
    ).toBe(false);
  });

  it('accepts configured office coordinates as in range', () => {
    const office = officeLocations[0];

    expect(
      validateAttendanceLocation({
        latitude: office.lat,
        longitude: office.lng,
      }).inRange,
    ).toBe(true);
  });

  it('keeps valid but distant coordinates outside the attendance range', () => {
    const result = validateAttendanceLocation({
      latitude: 39.9,
      longitude: 116.4,
    });

    expect(result.isValid).toBe(true);
    expect(result.inRange).toBe(false);
  });
});
