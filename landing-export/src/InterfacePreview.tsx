import React from 'react';
import { motion } from 'motion/react';
import { features } from './previewData';

export const InterfacePreview: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-white hover:border-blue-100 hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-500 flex flex-col h-full"
          >
            <div className="w-14 h-14 bg-white text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 transition-all duration-500">
              <Icon className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black mb-4 group-hover:text-blue-600 transition-colors duration-300 uppercase tracking-tight">
              {feature.title}
            </h3>
            <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed flex-1">
              {feature.description}
            </p>
            <div className="mt-6 pt-6 border-t border-slate-200/50 flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <span>Подробнее</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
