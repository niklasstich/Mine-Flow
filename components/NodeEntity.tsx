import React, { memo } from 'react';
import { Settings, AlertTriangle, CheckCircle, Copy, Trash2, Pencil, Box } from 'lucide-react';
import { NodeData, FlowState, UnitDictionary } from '../types';

export interface InternalNodeStatus {
  label: string;
  inputColor: string;
  outputColor: string;
}

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
  showEfficiency: boolean;
  isCollapsed: boolean;
  internalNodes?: InternalNodeStatus[];
}

// Helper to determine status color based on value
const getStatusColor = (value: number): string => {
    if (value < 0.5) return "#FF5555"; // Red
    if (value < 0.9) return "#FFAA00"; // Gold
    if (value < 0.99) return "#FFFF55"; // Yellow
    if (value <= 1.01) return "#55FF55"; // Green
    if (value <= 1.5) return "#FFFF55"; // Yellow (Over-sat)
    if (value <= 2.0) return "#FFAA00"; // Gold
    return "#FF5555"; // Red
};

export const NodeEntity: React.FC<NodeEntityProps> = memo(({
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
  isFrame,
  showEfficiency,
  isCollapsed,
  internalNodes
}) => {
  const saturation = flowData?.saturation ?? 1;
  const outputRatio = flowData?.outputFlowRatio ?? 1;
  const actualOpRate = flowData?.actualOpRate ?? 0;
  const hasInputs = node.recipe.inputs.length > 0;
  
  // Generators (no inputs) always have perfect input saturation
  const effectiveInputSat = !hasInputs && !isFrame ? 1.0 : saturation;
  // Sinks (no outputs) always have perfect output ratio
  const effectiveOutputRatio = node.recipe.outputs.length === 0 && !isFrame ? 1.0 : outputRatio;

  const inputColor = showEfficiency ? getStatusColor(effectiveInputSat) : '#525252';
  const outputColor = showEfficiency ? getStatusColor(effectiveOutputRatio) : '#525252';

  const InputStatusIcon = effectiveInputSat < 0.99 ? AlertTriangle : CheckCircle;
  const OutputStatusIcon = effectiveOutputRatio < 0.99 ? AlertTriangle : CheckCircle;

  let bgColor = isFrame ? "bg-[#3a3a3a]" : "bg-[#252526]";

  const width = node.width || 240;
  const heightStyle = node.height ? { height: node.height } : {};

  // Construct Box Shadow
  // 1. Selection Ring (if selected): 2px gap (bg color), 2px white ring
  // 2. Drop Shadow (always): 4px offset block shadow
  const selectionShadow = isSelected ? '0 0 0 2px #1c1917, 0 0 0 4px white, ' : '';
  const dropShadow = '4px 4px 0px rgba(0,0,0,0.5)';
  const combinedShadow = selectionShadow + dropShadow;

  return (
    <div
      className={`absolute flex flex-col rounded-sm transition-shadow select-none group font-mono ${isSelected ? 'z-30' : 'z-20'}`}
      style={{ 
        left: node.x, 
        top: node.y,
        width: width,
        ...heightStyle,
        transform: 'translate(0, 0)', // GPU handling
        boxShadow: combinedShadow,
        // Split Border Logic: Wrapper acts as border via padding
        background: `linear-gradient(90deg, ${inputColor} 50%, ${outputColor} 50%)`,
        padding: '2px' 
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className={`flex flex-col w-full h-full ${bgColor} rounded-[1px] relative`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-2 border-b border-[#525252] bg-black/20 handle cursor-grab active:cursor-grabbing`}>
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
        <div className="p-3 relative flex-1 bg-gradient-to-br from-white/5 to-transparent flex flex-col">
            
            {/* Stats Row (Input Saturation | Rate | Output Efficiency) */}
            {!isCollapsed && (
                <div className="flex justify-between items-center mb-4 text-[10px] font-mono select-none">
                     {/* Input Saturation (Left) */}
                    <div className="flex items-center gap-1 font-bold" style={{ color: showEfficiency ? inputColor : '#888' }} title="Input Saturation">
                        <InputStatusIcon size={10} /> {(effectiveInputSat * 100).toFixed(0)}%
                    </div>

                    {/* Rate (Center) */}
                    <div className="text-[#666] font-normal">
                        {actualOpRate.toFixed(2)} ops/s
                    </div>

                    {/* Output Ratio (Right) */}
                    <div className="flex items-center gap-1 font-bold" style={{ color: showEfficiency ? outputColor : '#888' }} title="Output Efficiency">
                         {(effectiveOutputRatio * 100).toFixed(0)}% <OutputStatusIcon size={10} />
                    </div>
                </div>
            )}

            {/* Machine List for Collapsed Frame */}
            {isCollapsed && internalNodes && (
                <div className="flex-1 overflow-y-auto mb-2 pr-1 custom-scrollbar">
                     <div className="text-[10px] text-[#777] font-bold uppercase mb-1 border-b border-[#555] pb-1">Contents</div>
                     <div className="flex flex-col gap-0.5">
                        {internalNodes.map((item, i) => (
                            <div key={i} className="text-[10px] text-[#ccc] flex items-center gap-2 hover:bg-white/5 p-0.5 rounded">
                                 <div className="w-2 h-2 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: item.inputColor }} title="Input Efficiency"/>
                                 <span className="truncate">{item.label}</span>
                                 <div className="w-2 h-2 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: item.outputColor }} title="Output Efficiency"/>
                            </div>
                        ))}
                        {internalNodes.length === 0 && <div className="text-[10px] text-[#555] italic">Empty</div>}
                     </div>
                </div>
            )}

            {/* IO Area */}
            <div className={`flex justify-between gap-4 ${isCollapsed ? 'mt-auto' : ''}`}>
            {/* Inputs */}
            <div className="flex flex-col gap-3 w-1/2">
                {node.recipe.inputs.map((item, idx) => {
                const color = unitDictionary[item.type]?.color || '#a8a29e';
                return (
                <div key={`in-${idx}`} className="relative flex items-center h-6 group/socket">
                    {/* Input Socket Target - Square Slot Look */}
                    <div 
                    className="absolute -left-[30px] w-6 h-6 bg-[#1a1a1a] border border-[#555] z-50 cursor-crosshair flex items-center justify-center hover:border-white transition-colors shadow-inner"
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
                    
                    {!isCollapsed && (
                    <span className="text-xs text-[#cccccc] truncate pl-1 select-none pointer-events-none font-mono" title={item.name}>
                        {item.amount} {item.unit && <span className="text-[#888888] text-[10px]">{item.unit}</span>} {item.name}
                    </span>
                    )}
                </div>
                )})}
            </div>

            {/* Outputs */}
            <div className="flex flex-col gap-3 w-1/2 items-end">
                {node.recipe.outputs.map((item, idx) => {
                const color = unitDictionary[item.type]?.color || '#a8a29e';
                return (
                <div key={`out-${idx}`} className="relative flex items-center justify-end h-6 w-full group/socket">
                    {!isCollapsed && (
                    <span className="text-xs text-[#cccccc] truncate pr-1 text-right select-none pointer-events-none font-mono" title={item.name}>
                        {item.amount} {item.unit && <span className="text-[#888888] text-[10px]">{item.unit}</span>} {item.name}
                    </span>
                    )}
                    {/* Output Socket Target - Square Slot Look */}
                    <div
                    className="absolute -right-[30px] w-6 h-6 bg-[#1a1a1a] border border-[#555] z-50 cursor-crosshair flex items-center justify-center hover:border-white transition-colors shadow-inner"
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

        {/* Footer / Status Bar (for frames) */}
        {isFrame && (
            <div className="h-1 w-full bg-[#1a1a1a] flex">
                <div 
                    className="h-full transition-all" 
                    style={{ 
                        width: '50%',
                        backgroundColor: inputColor,
                        opacity: showEfficiency ? effectiveInputSat : 1
                    }} 
                />
                <div 
                    className="h-full transition-all" 
                    style={{ 
                        width: '50%',
                        backgroundColor: outputColor,
                        opacity: showEfficiency ? effectiveOutputRatio : 1
                    }} 
                />
            </div>
        )}
      </div>
    </div>
  );
});