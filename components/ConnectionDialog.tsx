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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[2px]">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                <ArrowRightLeft className="w-5 h-5" style={{ color: typeColor }} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white capitalize">{unitDictionary[connection.type]?.label || connection.type} Line</h2>
                <p className="text-xs text-slate-400">Configure transfer rate</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Settings2 size={14} />
                Max Transfer Rate
            </label>
            <div className="flex items-center gap-2">
                <input 
                type="number" 
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                placeholder="Limit"
                />
                <span className="text-sm text-slate-500">units/sec</span>
            </div>
            <p className="text-xs text-slate-500 italic">
                Set to -1 for unlimited throughput.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-sm">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
            Update Line
          </button>
        </div>
      </div>
    </div>
  );
};