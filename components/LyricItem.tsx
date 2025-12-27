
import React from 'react';
import { LyricLine } from '../types';
import { formatTime } from '../services/tagService';

interface LyricItemProps {
  line: LyricLine;
  isActive: boolean;
  isSyncing: boolean;
  onTextChange: (id: string, text: string) => void;
  onTimeChange: (id: string, time: number) => void;
  onFocus: () => void;
  onSyncFromHere?: () => void;
}

const LyricItem: React.FC<LyricItemProps> = ({ 
  line, 
  isActive, 
  isSyncing,
  onTextChange, 
  onFocus,
  onSyncFromHere
}) => {
  return (
    <div 
      className={`group flex items-center gap-4 p-3 md:p-4 rounded-2xl transition-all duration-300 border border-transparent ${
        isActive ? 'line-active border-white/5 bg-white/5' : 'hover:bg-white/[0.02]'
      }`}
      onClick={onFocus}
    >
      <div className={`flex-shrink-0 w-20 font-mono text-xs tracking-tighter transition-colors flex flex-col ${
        isActive ? 'text-indigo-400 font-bold' : 'text-slate-600'
      }`}>
        <span>{line.time >= 0 ? formatTime(line.time).replace(/[\[\]]/g, '') : '--:--.--'}</span>
      </div>
      
      <input
        type="text"
        value={line.text}
        onChange={(e) => onTextChange(line.id, e.target.value)}
        className={`flex-grow bg-transparent border-none focus:ring-0 text-base transition-all outline-none ${
          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'
        }`}
        placeholder="歌词行内容..."
      />

      {!isSyncing && onSyncFromHere && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSyncFromHere();
          }}
          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all active:scale-90"
          title="从下一句开始重新打点"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default LyricItem;
