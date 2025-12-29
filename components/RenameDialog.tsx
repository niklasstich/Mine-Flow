import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] backdrop-blur-[2px]">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="space-y-4">
            <input 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                <button 
                    onClick={() => onSave(value)} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium shadow-lg shadow-indigo-500/20"
                >
                    Save
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};