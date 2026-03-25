import React from 'react';

interface HistoryPanelProps {
  history: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  activeIndex,
  onSelect,
  onClose,
  isOpen
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-20 left-6 z-20 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[calc(100%-8rem)] animate-in fade-in slide-in-from-left-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">版本历史 ({history.length})</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {history.map((imgData, idx) => {
          const isOriginal = idx === 0;
          const isActive = idx === activeIndex;
          
          return (
            <div 
              key={idx}
              onClick={() => onSelect(idx)}
              className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer border transition-all ${
                isActive 
                  ? 'bg-brand-50 border-brand-500 shadow-sm dark:bg-brand-900/20 dark:border-brand-500' 
                  : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                <img src={`data:image/jpeg;base64,${imgData}`} className="w-full h-full object-cover" alt="" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isOriginal ? '原始图片' : `编辑版本 ${idx}`}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                   {isOriginal ? '上传初始状态' : (idx === history.length - 1 ? '最新编辑' : '历史记录')}
                </div>
              </div>

              {isActive && (
                <div className="w-2 h-2 rounded-full bg-brand-500 mr-1 shadow-sm"></div>
              )}
            </div>
          );
        })}
      </div>
      
      {history.length > 1 && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
           <button 
             onClick={() => onSelect(0)}
             className="w-full py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
           >
             ⏪ 恢复到原图
           </button>
        </div>
      )}
    </div>
  );
};