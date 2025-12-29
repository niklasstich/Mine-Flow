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
  return (
    <div 
      className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-48 z-[100] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
        <button onClick={onCopy} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
            <Copy size={14} /> Copy
        </button>
        <button onClick={onCut} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
            <Scissors size={14} /> Cut
        </button>
        <div className="h-px bg-slate-700 my-1"></div>
        <button onClick={onSaveToLibrary} className="w-full text-left px-3 py-2 text-sm text-indigo-300 hover:bg-slate-700 flex items-center gap-2">
            <Save size={14} /> Save to Library
        </button>
        <div className="h-px bg-slate-700 my-1"></div>
        <button onClick={onDelete} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2">
            <Trash2 size={14} /> Delete
        </button>
    </div>
  );
};