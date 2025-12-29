import React from 'react';
import { Settings, AlertTriangle, CheckCircle, Copy, Trash2, Pencil } from 'lucide-react';
import { NodeData, FlowState, UnitDictionary } from '../types';

interface NodeEntityProps {
  node: NodeData;
  flowData: FlowState['nodeRates'][string];
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSocketMouseDown: (e: React.MouseEvent, socketIdx: number, isInput: boolean) => void;
  onSocketMouseUp: (e: React.MouseEvent, socketIdx: number, isInput: boolean) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  unitDictionary: UnitDictionary;
  isFrame?: boolean;
}

export const NodeEntity: React.FC<NodeEntityProps> = ({
  node,
  flowData,
  isSelected,
  onMouseDown,
  onEdit,
  onDelete,
  onDuplicate,
  onSocketMouseDown,
  onSocketMouseUp,
  onDoubleClick,
  onContextMenu,
  unitDictionary,
  isFrame
}) => {
  const efficiency = flowData?.efficiency ?? 1;
  const isStarved = efficiency < 0.99 && node.recipe.inputs.length > 0;
  
  // Dynamic color for status border
  let statusColor = "border-slate-600";
  if (isStarved) statusColor = "border-orange-500 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]";
  else if (efficiency >= 0.99) statusColor = "border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]";

  // Calculate Rate for display
  let timeInSeconds = node.recipe.processTime;
  if (node.recipe.processTimeUnit === 'ticks') {
      timeInSeconds = timeInSeconds / 20;
  }
  const opsRate = timeInSeconds > 0 ? 1 / timeInSeconds : 0;

  const width = node.width || 240;
  const heightStyle = node.height ? { height: node.height } : {};

  return (
    <div
      className={`absolute flex flex-col bg-slate-800 rounded-lg border-2 transition-shadow select-none group ${statusColor} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}`}
      style={{ 
        left: node.x, 
        top: node.y,
        width: width,
        ...heightStyle,
        transform: 'translate(0, 0)' // GPU handling
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-900/30 rounded-t-lg handle cursor-grab active:cursor-grabbing">
        <span className="font-semibold text-slate-200 truncate pr-2">{node.label}</span>
        
        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
            title={isFrame ? "Rename Frame" : "Edit Recipe"}
          >
            {isFrame ? <Pencil size={14} /> : <Settings size={14} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors"
            title="Duplicate Machine"
          >
            <Copy size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
            title="Delete Machine"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 relative flex-1">
        {/* Efficiency Indicator */}
        <div className="absolute top-2 right-3 text-[10px] font-mono font-bold flex items-center gap-1">
          {isStarved ? (
            <span className="text-orange-400 flex items-center gap-1"><AlertTriangle size={10} /> {(efficiency * 100).toFixed(0)}%</span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={10} /> 100%</span>
          )}
        </div>

        <div className="text-xs text-slate-500 mb-3 font-mono">
          {opsRate.toFixed(2)} ops/s
        </div>

        {/* IO Area */}
        <div className="flex justify-between gap-4">
          {/* Inputs */}
          <div className="flex flex-col gap-3 w-1/2">
            {node.recipe.inputs.map((item, idx) => {
              const color = unitDictionary[item.type]?.color || '#94a3b8';
              return (
              <div key={`in-${idx}`} className="relative flex items-center h-6 group/socket">
                {/* Input Socket Target - Larger transparent hit area */}
                <div 
                  className="absolute -left-[24px] w-8 h-8 rounded-full z-50 cursor-crosshair flex items-center justify-center hover:scale-110 transition-transform"
                  onMouseDown={(e) => onSocketMouseDown(e, idx, true)}
                  onMouseUp={(e) => onSocketMouseUp(e, idx, true)}
                  title={`Input: ${item.name} (${item.type})`}
                >
                    {/* Visual Dot */}
                    <div 
                        className="w-4 h-4 rounded-full border shadow-sm group-hover/socket:ring-2 ring-white/30"
                        style={{ backgroundColor: color, borderColor: color }}
                    />
                </div>
                <span className="text-xs text-slate-300 truncate pl-1 select-none pointer-events-none" title={item.name}>
                  {item.amount} {item.unit && <span className="text-slate-500 text-[10px]">{item.unit}</span>} {item.name}
                </span>
              </div>
            )})}
          </div>

          {/* Outputs */}
          <div className="flex flex-col gap-3 w-1/2 items-end">
            {node.recipe.outputs.map((item, idx) => {
               const color = unitDictionary[item.type]?.color || '#94a3b8';
               return (
              <div key={`out-${idx}`} className="relative flex items-center justify-end h-6 w-full group/socket">
                <span className="text-xs text-slate-300 truncate pr-1 text-right select-none pointer-events-none" title={item.name}>
                  {item.amount} {item.unit && <span className="text-slate-500 text-[10px]">{item.unit}</span>} {item.name}
                </span>
                {/* Output Socket Target */}
                <div
                  className="absolute -right-[24px] w-8 h-8 rounded-full z-50 cursor-crosshair flex items-center justify-center hover:scale-110 transition-transform"
                  onMouseDown={(e) => onSocketMouseDown(e, idx, false)}
                  onMouseUp={(e) => onSocketMouseUp(e, idx, false)}
                  title={`Output: ${item.name} (${item.type})`}
                >
                    {/* Visual Dot */}
                    <div 
                        className="w-4 h-4 rounded-full border shadow-sm group-hover/socket:ring-2 ring-white/30"
                        style={{ backgroundColor: color, borderColor: color }}
                    />
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

    </div>
  );
};