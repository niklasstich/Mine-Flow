import React, { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialValue: string;
  onSave: (newValue: string) => void;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({ isOpen, onClose, title, initialValue, onSave }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
        setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200]">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-md p-0 font-mono">
        <div className="p-3 border-b-2 border-[#555] flex justify-between items-center bg-[#333]">
            <div className="flex items-center gap-2">
                <Pencil size={16} className="text-[#aaa]" />
                <h3 className="text-lg font-bold text-[#eee]">{title}</h3>
            </div>
            <button onClick={onClose} className="text-[#aaa] hover:text-white"><X size={18}/></button>
        </div>
        
        <div className="p-5 space-y-4 bg-[#212121]">
            <input 
                className="w-full bg-[#111] border border-[#555] p-3 text-[#eee] focus:outline-none focus:border-[#aaa] transition-all"
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
                placeholder="Enter name..."
                onKeyDown={e => {
                    if (e.key === 'Enter') onSave(value);
                    if (e.key === 'Escape') onClose();
                }}
            />
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="bg-[#3a3a3a] border border-[#555] hover:bg-[#4a4a4a] text-[#eee] px-4 py-1.5 text-xs font-mono">Cancel</button>
                <button 
                    onClick={() => onSave(value)} 
                    className="bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono px-6 py-1.5 text-xs"
                >
                    Save
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};