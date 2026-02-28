import React from 'react';

interface PhotoPreviewModalProps {
  previewPhoto: string;
  setPreviewPhoto: (photo: string | null) => void;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({ previewPhoto, setPreviewPhoto }) => {
  return (
    <div 
      className="fixed inset-0 z-[120] bg-slate-900/90 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={() => setPreviewPhoto(null)}
    >
      <img src={previewPhoto} className="max-w-full max-h-full rounded-2xl shadow-2xl animate-scaleIn" alt="Preview" />
      <button className="absolute top-8 right-8 text-white text-4xl font-light">&times;</button>
    </div>
  );
};
