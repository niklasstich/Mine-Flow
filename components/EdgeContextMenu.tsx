import React from 'react';
import { Settings2, Trash2 } from 'lucide-react';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({ x, y, onClose, onEdit, onDelete }) => {
  const itemClass = "w-full text-left px-3 py-2 text-xs text-[#eee] hover:bg-[#333] hover:text-white flex items-center gap-2 transition-colors";
  
  return (
    <div 
      className="fixed bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] py-1 w-48 z-[100] font-mono"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
        <button onClick={onEdit} className={itemClass}>
            <Settings2 size={14} className="text-[#aaa]" /> Edit Connection
        </button>
        <div className="h-0.5 bg-[#333] my-1 mx-1"></div>
        <button onClick={onDelete} className={`${itemClass} text-[#FF5555] hover:text-[#ff7777]`}>
            <Trash2 size={14} /> Delete Connection
        </button>
    </div>
  );
};