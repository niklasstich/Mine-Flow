import React from 'react';
import { Settings, AlertTriangle, CheckCircle, Copy, Trash2, Pencil, AlertOctagon, Box } from 'lucide-react';
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
  const saturation = flowData?.saturation ?? 1;
  const hasInputs = node.recipe.inputs.length > 0;
  
  // If it's a frame, we rely on the passed saturation (which is an aggregate of internals), 
  // not whether the frame itself has external inputs.
  // Generators (nodes with no inputs) are otherwise always Green.
  const isGenerator = !hasInputs && !isFrame;

  // Coloring Logic (Spectrum)
  
  let statusBorderColor = "border-[#525252]"; // Dark gray default
  let statusTextColor = "text-[#aaaaaa]";
  let StatusIcon = CheckCircle;
  let bgColor = isFrame ? "bg-[#3a3a3a]" : "bg-[#252526]"; // Frame is slightly lighter (Command Block-ish?), Machine is dark

  if (isGenerator) {
      statusBorderColor = "border-[#55FF55]"; // MC Green
      statusTextColor = "text-[#55FF55]";
  } else {
      if (saturation < 0.5) {
          statusBorderColor = "border-[#FF5555]"; // MC Red
          statusTextColor = "text-[#FF5555]";
          StatusIcon = AlertOctagon;
      } else if (saturation < 0.9) {
          statusBorderColor = "border-[#FFAA00]"; // MC Gold
          statusTextColor = "text-[#FFAA00]";
          StatusIcon = AlertTriangle;
      } else if (saturation < 0.99) {
          statusBorderColor = "border-[#FFFF55]"; // MC Yellow
          statusTextColor = "text-[#FFFF55]";
          StatusIcon = AlertTriangle;
      } else if (saturation <= 1.01) {
          statusBorderColor = "border-[#55FF55]"; // MC Green
          statusTextColor = "text-[#55FF55]";
          StatusIcon = CheckCircle;
      } else if (saturation <= 1.5) {
          statusBorderColor = "border-[#FFFF55]";
          statusTextColor = "text-[#FFFF55]";
          StatusIcon = AlertTriangle;
      } else if (saturation <= 2.0) {
          statusBorderColor = "border-[#FFAA00]";
          statusTextColor = "text-[#FFAA00]";
          StatusIcon = AlertTriangle;
      } else {
          statusBorderColor = "border-[#FF5555]";
          statusTextColor = "text-[#FF5555]";
          StatusIcon = AlertOctagon;
      }
  }

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
      className={`absolute flex flex-col ${bgColor} rounded-sm border-2 transition-colors select-none group font-mono ${statusBorderColor} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1c1917]' : ''}`}
      style={{ 
        left: node.x, 
        top: node.y,
        width: width,
        ...heightStyle,
        transform: 'translate(0, 0)', // GPU handling
        boxShadow: '4px 4px 0px rgba(0,0,0,0.5)' // Blocky shadow
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-2 border-b-2 ${statusBorderColor} bg-black/20 handle cursor-grab active:cursor-grabbing`}>
        <div className="flex items-center gap-2 overflow-hidden">
             {isFrame && <Box size={14} className="text-[#a8a8a8]" />}
             <span className="font-bold text-[#e0e0e0] truncate text-sm">{node.label}</span>
        </div>
        
        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 hover:bg-[#4a4a4a] rounded-sm text-[#aaaaaa] hover:text-white transition-colors"
            title={isFrame ? "Rename Frame" : "Edit Recipe"}
          >
            {isFrame ? <Pencil size={12} /> : <Settings size={12} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1 hover:bg-[#4a4a4a] rounded-sm text-[#aaaaaa] hover:text-[#55FF55] transition-colors"
            title="Duplicate Machine"
          >
            <Copy size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 hover:bg-[#4a4a4a] rounded-sm text-[#aaaaaa] hover:text-[#FF5555] transition-colors"
            title="Delete Machine"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 relative flex-1 bg-gradient-to-br from-white/5 to-transparent">
        {/* Saturation Indicator */}
        <div className={`absolute top-2 right-3 text-[10px] font-mono font-bold flex items-center gap-1 ${statusTextColor}`}>
           <StatusIcon size={10} /> {(saturation * 100).toFixed(0)}%
        </div>

        <div className="text-xs text-[#888888] mb-4 font-mono">
          {opsRate.toFixed(2)} ops/s
        </div>

        {/* IO Area */}
        <div className="flex justify-between gap-4">
          {/* Inputs */}
          <div className="flex flex-col gap-3 w-1/2">
            {node.recipe.inputs.map((item, idx) => {
              const color = unitDictionary[item.type]?.color || '#a8a29e';
              return (
              <div key={`in-${idx}`} className="relative flex items-center h-6 group/socket">
                {/* Input Socket Target - Square Slot Look */}
                <div 
                  className="absolute -left-[26px] w-6 h-6 bg-[#1a1a1a] border border-[#555] z-50 cursor-crosshair flex items-center justify-center hover:border-white transition-colors shadow-inner"
                  onMouseDown={(e) => onSocketMouseDown(e, idx, true)}
                  onMouseUp={(e) => onSocketMouseUp(e, idx, true)}
                  title={`Input: ${item.name} (${item.type})`}
                >
                    {/* Visual Square */}
                    <div 
                        className="w-3 h-3 shadow-sm"
                        style={{ backgroundColor: color }}
                    />
                </div>
                <span className="text-xs text-[#cccccc] truncate pl-1 select-none pointer-events-none font-mono" title={item.name}>
                  {item.amount} {item.unit && <span className="text-[#888888] text-[10px]">{item.unit}</span>} {item.name}
                </span>
              </div>
            )})}
          </div>

          {/* Outputs */}
          <div className="flex flex-col gap-3 w-1/2 items-end">
            {node.recipe.outputs.map((item, idx) => {
               const color = unitDictionary[item.type]?.color || '#a8a29e';
               return (
              <div key={`out-${idx}`} className="relative flex items-center justify-end h-6 w-full group/socket">
                <span className="text-xs text-[#cccccc] truncate pr-1 text-right select-none pointer-events-none font-mono" title={item.name}>
                  {item.amount} {item.unit && <span className="text-[#888888] text-[10px]">{item.unit}</span>} {item.name}
                </span>
                {/* Output Socket Target - Square Slot Look */}
                <div
                  className="absolute -right-[26px] w-6 h-6 bg-[#1a1a1a] border border-[#555] z-50 cursor-crosshair flex items-center justify-center hover:border-white transition-colors shadow-inner"
                  onMouseDown={(e) => onSocketMouseDown(e, idx, false)}
                  onMouseUp={(e) => onSocketMouseUp(e, idx, false)}
                  title={`Output: ${item.name} (${item.type})`}
                >
                    {/* Visual Square */}
                    <div 
                        className="w-3 h-3 shadow-sm"
                        style={{ backgroundColor: color }}
                    />
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* Footer / Status Bar (if needed, e.g. for frames) */}
      {isFrame && (
          <div className="h-1 w-full bg-[#1a1a1a]">
              <div 
                className="h-full transition-all" 
                style={{ 
                    width: `${Math.min(100, saturation * 100)}%`,
                    backgroundColor: statusTextColor.replace('text-[', '').replace(']', '')
                }} 
              />
          </div>
      )}

    </div>
  );
};