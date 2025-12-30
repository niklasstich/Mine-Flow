import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200]">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden font-mono">
        <div className="p-4 flex gap-4 bg-[#212121]">
            <div className={`p-2 border border-[#555] h-fit flex-shrink-0 bg-[#2a2a2a] ${isDestructive ? 'text-[#FF5555]' : 'text-[#55FFFF]'}`}>
                <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-bold text-[#eee] mb-2">{title}</h3>
                <p className="text-[#aaa] text-xs leading-relaxed">{message}</p>
            </div>
        </div>

        <div className="p-3 bg-[#333] border-t-2 border-[#555] flex justify-end gap-2">
            <button 
                onClick={onCancel}
                className="bg-[#3a3a3a] border border-[#555] hover:bg-[#4a4a4a] text-[#eee] px-4 py-1.5 text-xs font-mono"
            >
                Cancel
            </button>
            <button 
                onClick={onConfirm}
                className={`bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono px-4 py-1.5 text-xs ${
                    isDestructive ? 'text-[#FF5555]' : 'text-[#eee]'
                }`}
            >
                {confirmLabel}
            </button>
        </div>
      </div>
    </div>
  );
};