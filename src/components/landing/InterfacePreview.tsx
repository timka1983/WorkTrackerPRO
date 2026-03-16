import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { features } from './previewData';

export const InterfacePreview: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(features[0]);

  return (
    <section id="interface-preview" className="py-20 bg-white text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-black mb-12 tracking-tight text-center">Интерфейс системы</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Sidebar: Feature List */}
          <div className="md:col-span-4 space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeFeature.id === feature.id;
              return (
                <button
                  key={feature.id}
                  id={`btn-${feature.id}`}
                  onClick={() => setActiveFeature(feature)}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-200 flex items-center gap-4 ${
                    isActive 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' 
                      : 'bg-white border-slate-100 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                  <span className="font-bold text-sm uppercase tracking-wider">{feature.title}</span>
                </button>
              );
            })}
          </div>

          {/* Main Preview Area */}
          <div className="md:col-span-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl min-h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-3xl font-black mb-6">{activeFeature.title}</h3>
                <p className="text-slate-500 font-medium text-base leading-relaxed mb-8 max-w-2xl">
                  {activeFeature.description}
                </p>
                
                {/* Visual Placeholder for the interface */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl h-64 flex items-center justify-center overflow-hidden">
                  <img 
                    src={activeFeature.preview} 
                    alt={activeFeature.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
