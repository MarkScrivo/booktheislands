import React, { useRef, useEffect } from 'react';
import * as L from 'leaflet';

// Custom Icon for Map Pins
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-8 h-8 bg-teal-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

interface VendorLocationPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
}

export const VendorLocationPicker: React.FC<VendorLocationPickerProps> = ({ lat, lng, onChange }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = lat || 9.73;
    const initialLng = lng || 100.01;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([initialLat, initialLng], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: 'CARTO',
      }).addTo(mapInstanceRef.current);

      mapInstanceRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        onChange(lat, lng);
        updateMarker(lat, lng);
      });
    }

    const map = mapInstanceRef.current;

    const updateMarker = (latitude: number, longitude: number) => {
      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker([latitude, longitude], { icon: createCustomIcon() }).addTo(map);
    };

    if (lat && lng) {
      updateMarker(lat, lng);
      map.setView([lat, lng], map.getZoom());
    }

    // Fix map resize issues when tab changes
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

  }, [lat, lng]);

  return (
    <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold rounded-full shadow-sm z-[1000]">
        Click to set location
      </div>
    </div>
  );
};
