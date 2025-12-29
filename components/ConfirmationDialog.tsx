import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmLabel = "Confirm",
  isDestructive = true 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 flex gap-4">
            <div className={`p-3 rounded-full h-fit flex-shrink-0 ${isDestructive ? 'bg-red-500/20 text-red-500' : 'bg-indigo-500/20 text-indigo-500'}`}>
                <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
            </div>
        </div>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
            <button 
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
            >
                Cancel
            </button>
            <button 
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors shadow-lg ${
                    isDestructive 
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
                }`}
            >
                {confirmLabel}
            </button>
        </div>
      </div>
    </div>
  );
};