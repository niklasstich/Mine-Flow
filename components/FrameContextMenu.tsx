import React from 'react';
import { Pencil, Save, Trash2 } from 'lucide-react';

interface FrameContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onSaveToLibrary: () => void;
  onDelete: () => void;
}

export const FrameContextMenu: React.FC<FrameContextMenuProps> = ({ x, y, onClose, onRename, onSaveToLibrary, onDelete }) => {
  return (
    <div 
      className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-48 z-[100] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
        <button onClick={onRename} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
            <Pencil size={14} /> Rename Frame
        </button>
        <div className="h-px bg-slate-700 my-1"></div>
        <button onClick={onSaveToLibrary} className="w-full text-left px-3 py-2 text-sm text-indigo-300 hover:bg-slate-700 flex items-center gap-2">
            <Save size={14} /> Save to Library
        </button>
        <div className="h-px bg-slate-700 my-1"></div>
        <button onClick={onDelete} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2">
            <Trash2 size={14} /> Delete Frame
        </button>
    </div>
  );
};