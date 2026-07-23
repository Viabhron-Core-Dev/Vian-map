import React, { useEffect, useState } from 'react';
import { ImageOverlay } from 'react-leaflet';
import { db, Overlay } from '../lib/db';

const MiniLayerOverlay: React.FC = () => {
  const [overlays, setOverlays] = useState<Overlay[]>([]);

  useEffect(() => {
    const fetchOverlays = async () => {
      const all = await db.overlays.toArray();
      setOverlays(all);
    };
    fetchOverlays();

    // Poll for changes in this simplified version
    const interval = setInterval(fetchOverlays, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {overlays.map(overlay => (
        <ImageOverlay
          key={overlay.id}
          url={overlay.url}
          bounds={overlay.bounds}
          opacity={overlay.opacity}
        />
      ))}
    </>
  );
};

export default MiniLayerOverlay;
