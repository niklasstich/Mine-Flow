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
      className="fixed bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] py-1 w-48 z-[100] font-mono max-h-[400px] overflow-y-auto custom-scrollbar"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-1 pb-1 mb-1 border-b-2 border-[#333] space-y-0.5">
           {hasClipboard && onPaste && (
               <button 
                    onClick={() => { onPaste(); onClose(); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#55FF55] hover:bg-[#333] hover:text-white transition-colors flex items-center gap-2"
               >
                    <ClipboardPaste size={14} /> Paste
               </button>
           )}
           <button 
                onClick={() => { onAddFrame(); onClose(); }}
                className="w-full text-left px-3 py-2 text-xs text-[#aaa] hover:bg-[#333] hover:text-white transition-colors flex items-center gap-2"
           >
                <BoxSelect size={14} /> Add Frame
           </button>
      </div>

      <div className="px-3 py-1 text-[10px] font-bold text-[#777] uppercase tracking-wider mb-1">
        Add Machine
      </div>
      
      {categories.map(cat => (
        <div key={cat} className="mb-1 last:mb-0">
          <div className="px-3 py-1 text-[10px] text-[#aaa] font-bold bg-[#333]">{cat}</div>
          {prefabs.filter(p => p.category === cat).map((prefab) => (
            <div key={prefab.id} className="group flex items-center hover:bg-[#333] transition-colors">
                <button
                className="flex-1 text-left px-4 py-1.5 text-xs text-[#eee] hover:text-white flex items-center gap-2 truncate"
                onClick={() => {
                    onSelectPrefab(prefab);
                    onClose();
                }}
                >
                <Plus size={10} className="opacity-50" />
                {prefab.label}
                </button>
                {cat === 'Custom' && onDeleteTemplate && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteTemplate(prefab.id); }}
                        className="p-1.5 text-[#777] hover:text-[#FF5555] rounded opacity-0 group-hover:opacity-100 transition-all mr-1"
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