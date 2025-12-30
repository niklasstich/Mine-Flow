import React from 'react';
import { Copy, Scissors, Trash2, Save } from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onSaveToLibrary: () => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ x, y, onClose, onCopy, onCut, onDelete, onSaveToLibrary }) => {
  const itemClass = "w-full text-left px-3 py-2 text-xs text-[#eee] hover:bg-[#333] hover:text-white flex items-center gap-2 transition-colors";
  
  return (
    <div 
      className="fixed bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] py-1 w-48 z-[100] font-mono"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
        <button onClick={onCopy} className={itemClass}>
            <Copy size={14} className="text-[#aaa]" /> Copy
        </button>
        <button onClick={onCut} className={itemClass}>
            <Scissors size={14} className="text-[#aaa]" /> Cut
        </button>
        <div className="h-0.5 bg-[#333] my-1 mx-1"></div>
        <button onClick={onSaveToLibrary} className={`${itemClass} text-[#55FFFF]`}>
            <Save size={14} /> Save to Library
        </button>
        <div className="h-0.5 bg-[#333] my-1 mx-1"></div>
        <button onClick={onDelete} className={`${itemClass} text-[#FF5555] hover:text-[#ff7777]`}>
            <Trash2 size={14} /> Delete
        </button>
    </div>
  );
};