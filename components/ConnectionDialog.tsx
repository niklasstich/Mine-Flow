import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Settings2 } from 'lucide-react';
import { Connection, UnitDictionary } from '../types';

interface ConnectionDialogProps {
  connection: Connection | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, capacity: number) => void;
  unitDictionary: UnitDictionary;
}

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ connection, isOpen, onClose, onSave, unitDictionary }) => {
  const [capacity, setCapacity] = useState<string>("-1");

  useEffect(() => {
    if (isOpen && connection) {
      setCapacity(connection.capacity === -1 || connection.capacity === undefined ? "-1" : connection.capacity.toString());
    }
  }, [isOpen, connection]);

  if (!isOpen || !connection) return null;

  const handleSave = () => {
    const val = parseFloat(capacity);
    if (isNaN(val)) return;
    onSave(connection.id, val);
    onClose();
  };

  const typeColor = unitDictionary[connection.type]?.color || '#94a3b8';
  const btnClass = "bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono px-4 py-1.5 text-xs flex items-center gap-2";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="p-3 border-b-2 border-[#555] flex justify-between items-center bg-[#333]">
          <div className="flex items-center gap-3">
             <div className="p-1 border border-[#555] bg-[#222]">
                <ArrowRightLeft className="w-4 h-4" style={{ color: typeColor }} />
             </div>
             <div>
                <h2 className="text-sm font-bold text-[#eee] capitalize">{unitDictionary[connection.type]?.label || connection.type} Line</h2>
             </div>
          </div>
          <button onClick={onClose} className="text-[#aaa] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#aaa] uppercase tracking-wider flex items-center gap-2">
                <Settings2 size={12} />
                Max Transfer Rate
            </label>
            <div className="flex items-center gap-2">
                <input 
                type="number" 
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="flex-1 bg-[#111] border border-[#555] p-2 text-[#eee] focus:outline-none focus:border-[#aaa] font-mono text-sm"
                placeholder="Limit"
                />
                <span className="text-xs text-[#777]">units/sec</span>
            </div>
            <p className="text-[10px] text-[#666] italic border-l-2 border-[#444] pl-2">
                Set to -1 for unlimited throughput.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[#555] bg-[#333] flex justify-end gap-3">
          <button onClick={onClose} className="bg-[#3a3a3a] border border-[#555] hover:bg-[#4a4a4a] text-[#eee] px-4 py-1.5 text-xs">
            Cancel
          </button>
          <button onClick={handleSave} className={btnClass}>
            Update Line
          </button>
        </div>
      </div>
    </div>
  );
};