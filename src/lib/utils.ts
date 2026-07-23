/**
 * Converts decimal degrees to Degrees, Minutes, Seconds format.
 */
export function toDMS(decimal: number, isLatitude: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
  
  const direction = isLatitude 
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
    
  return `${degrees}°${minutes}'${seconds}" ${direction}`;
}

/**
 * Approximates map scale based on zoom level.
 * Note: This varies by latitude, but for a tactical HUD, a visual cue is often sufficient.
 */
export function getMapScaleLabel(zoom: number): string {
  const base = 591657550.5;
  const scale = Math.round(base / Math.pow(2, zoom));
  return `1:${scale.toLocaleString()}`;
}

/**
 * Calculates meters per pixel at a specific latitude and zoom level.
 * Formula: S = C * cos(lat) / 2^(zoom + 8)
 * where C is the equatorial circumference.
 */
export function getMetersPerPixel(lat: number = 0, zoom: number): number {
  const C = 40075016.686; // Earth's circumference in meters
  return (C * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
}
