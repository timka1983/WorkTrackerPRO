import React, { memo } from 'react';

interface CameraModalProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showCamera: { slot: number; type: 'start' | 'stop' };
  setShowCamera: (val: any) => void;
  isUploadingPhoto: boolean;
  onCapture: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({
  videoRef,
  showCamera,
  setShowCamera,
  isUploadingPhoto,
  onCapture
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
       <div className="bg-white p-2 rounded-[2.5rem] shadow-2xl overflow-hidden mb-8 border-4 border-blue-600">
         <video ref={videoRef} autoPlay playsInline className="w-full max-sm rounded-[2rem] aspect-square object-cover" />
       </div>
       <h3 className="text-white text-xl font-black uppercase tracking-widest mb-2">Фотофиксация</h3>
       <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-8">{showCamera.type === 'start' ? 'Начало смены' : 'Завершение смены'}</p>
       <div className="flex gap-4">
          <button 
            onClick={() => setShowCamera(null)}
            className="px-8 py-4 bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/20"
          >
            Отмена
          </button>
          <button 
            onClick={onCapture}
            disabled={isUploadingPhoto}
            className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            {isUploadingPhoto ? 'Сохранение...' : 'Сфотографировать'}
          </button>
       </div>
    </div>
  );
};

export default memo(CameraModal);
