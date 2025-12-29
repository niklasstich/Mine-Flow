import React from 'react';
import { Prefab } from '../types';
import { Plus, Trash2, BoxSelect, ClipboardPaste } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelectPrefab: (prefab: Prefab) => void;
  onAddFrame: () => void;
  prefabs: Prefab[];
  onDeleteTemplate?: (id: string) => void;
  onPaste?: () => void;
  hasClipboard?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onSelectPrefab, onAddFrame, prefabs, onDeleteTemplate, onPaste, hasClipboard }) => {
  // Group by category
  const categories = Array.from(new Set(prefabs.map(p => p.category)));

  return (
    <div 
      className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-2 w-48 z-[100] animate-in fade-in zoom-in-95 duration-100 max-h-[400px] overflow-y-auto"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-2 pb-2 mb-2 border-b border-slate-700 space-y-1">
           {hasClipboard && onPaste && (
               <button 
                    onClick={() => { onPaste(); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-emerald-300 hover:text-white hover:bg-emerald-600/20 rounded transition-colors flex items-center gap-2 font-medium"
               >
                    <ClipboardPaste size={14} /> Paste
               </button>
           )}
           <button 
                onClick={() => { onAddFrame(); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-indigo-300 hover:text-white hover:bg-indigo-600/20 rounded transition-colors flex items-center gap-2 font-medium"
           >
                <BoxSelect size={14} /> Add Frame
           </button>
      </div>

      <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        Add Machine
      </div>
      
      {categories.map(cat => (
        <div key={cat} className="mb-2 last:mb-0">
          <div className="px-3 py-1 text-[10px] text-slate-500 font-bold bg-slate-900/50">{cat}</div>
          {prefabs.filter(p => p.category === cat).map((prefab) => (
            <div key={prefab.id} className="group flex items-center pr-2 hover:bg-slate-700/50">
                <button
                className="flex-1 text-left px-4 py-1.5 text-sm text-slate-200 hover:text-white transition-colors flex items-center gap-2"
                onClick={() => {
                    onSelectPrefab(prefab);
                    onClose();
                }}
                >
                <Plus size={12} className="opacity-50" />
                {prefab.label}
                </button>
                {cat === 'Custom' && onDeleteTemplate && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteTemplate(prefab.id); }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete Template"
                    >
                        <Trash2 size={12}/>
                    </button>
                )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};