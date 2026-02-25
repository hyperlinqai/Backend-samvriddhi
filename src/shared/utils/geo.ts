import { GeoCoordinates } from '../types';

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the Haversine distance between two GPS coordinates.
 * Returns distance in kilometers.
 */
export function haversineDistance(
    point1: GeoCoordinates,
    point2: GeoCoordinates
): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;

    const dLat = toRad(point2.lat - point1.lat);
    const dLng = toRad(point2.lng - point1.lng);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(point1.lat)) *
        Math.cos(toRad(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Check if a coordinate is within a certain radius (in KM) of a center point.
 */
export function isWithinRadius(
    center: GeoCoordinates,
    point: GeoCoordinates,
    radiusKm: number
): boolean {
    return haversineDistance(center, point) <= radiusKm;
}

/**
 * Validate that latitude and longitude are within valid ranges.
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
