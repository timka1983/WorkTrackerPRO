import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat: number;
  initialLng: number;
}

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, onLocationSelect, initialLat, initialLng }) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

  if (!isOpen) return null;

  function MapEvents() {
    useMapEvents({
      click(e) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      },
    });
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl dark:shadow-slate-900/40">
        <div className="h-96 w-full mb-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          <MapContainer center={[initialLat, initialLng]} zoom={13} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={position} />
            <MapEvents />
          </MapContainer>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors">Отмена</button>
          <button onClick={() => { onLocationSelect(position[0], position[1]); onClose(); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors">Выбрать</button>
        </div>
      </div>
    </div>
  );
};

export default MapModal;
