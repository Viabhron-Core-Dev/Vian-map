export interface NormPoint { x: number; y: number; }
export interface GeoPoint { lat: number; lng: number; }

export function triangulateBounds(
  p1Img: NormPoint, p2Img: NormPoint,
  p1Geo: GeoPoint, p2Geo: GeoPoint
): [number, number][] {
  // If they clicked the same point or walked nowhere, fallback
  if (p1Img.x === p2Img.x && p1Img.y === p2Img.y) {
    throw new Error("Image points are too close together to triangulate.");
  }
  
  // Calculate differences
  const dxImg = p2Img.x - p1Img.x;
  const dyImg = p2Img.y - p1Img.y;
  
  const dLat = p2Geo.lat - p1Geo.lat;
  const dLng = p2Geo.lng - p1Geo.lng;
  
  // To avoid divide-by-zero if users align points horizontally or vertically:
  // we calculate a uniform scale based on the hypotenuse distance.
  const distImg = Math.sqrt(dxImg * dxImg + dyImg * dyImg);
  if (distImg === 0) throw new Error("Invalid image points");
  
  // Approximating distance in "degrees" (lightweight, not true Haversine distance, but avoids heavy projection libraries for a single overlay)
  const distGeoX = dLng * Math.cos(p1Geo.lat * Math.PI / 180);
  const distGeoY = dLat;
  const distGeo = Math.sqrt(distGeoX * distGeoX + distGeoY * distGeoY);
  
  const scale = distGeo / distImg;
  
  // Assuming the image is oriented correctly (North == Up)
  // Let's find independent scale for axes to ensure both points hit exactly.
  // If user didn't walk diagonally (dx or dy is ~0), we fallback to uniform scale.
  let scaleX = dxImg !== 0 ? dLng / dxImg : scale / Math.cos(p1Geo.lat * Math.PI / 180);
  let scaleY = dyImg !== 0 ? dLat / dyImg : -scale;

  // If one of the points is completely horizontal/vertical, the other scale is guess-timated.
  if (Math.abs(dxImg) < 0.01) scaleX = Math.abs(scaleY) * Math.cos(p1Geo.lat * Math.PI / 180);
  if (Math.abs(dyImg) < 0.01) scaleY = -Math.abs(scaleX) / Math.cos(p1Geo.lat * Math.PI / 180);

  // Top-Left (0, 0)
  const tlLng = p1Geo.lng - (p1Img.x * scaleX);
  const tlLat = p1Geo.lat - (p1Img.y * scaleY); // dyImg vs dLat means scaleY is typically negative
  
  // Bottom-Right (1, 1)
  const brLng = tlLng + scaleX;
  const brLat = tlLat + scaleY;

  // Leaflet expects [ [south, west], [north, east] ]
  // south is min(lat), north is max(lat)
  // west is min(lng), east is max(lng)
  return [
    [Math.min(tlLat, brLat), Math.min(tlLng, brLng)],
    [Math.max(tlLat, brLat), Math.max(tlLng, brLng)]
  ];
}
