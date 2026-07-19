import React, { memo } from 'react';
import { Settings, AlertTriangle, CheckCircle, Copy, Trash2, Pencil, Box } from 'lucide-react';
import { NodeData, FlowState, UnitDictionary, ItemStack } from '../types';
import { GtnhIcon } from './GtnhIcon';
import { GtnhCatalog } from '../services/gtnhCatalog';
import { computeMinNodeHeight } from '../utils/geometry';

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
  onResizeStart?: (e: React.MouseEvent, handle: string) => void;
  gtnhCatalog?: GtnhCatalog | null;
  gtnhAtlasUrl?: string | null;
}

// Resolve the icon atlas id for an item/fluid slot, if we have catalog data
// for it -- generic/manual recipe slots (no gtnh.goodsId) never resolve.
const resolveIconId = (item: ItemStack, catalog: GtnhCatalog | null | undefined): number | undefined => {
  const goodsId = item.gtnh?.goodsId;
  if (!goodsId || !catalog) return undefined;
  const goods = item.type === 'fluid' ? catalog.fluidsById.get(goodsId) : catalog.itemsById.get(goodsId);
  return goods?.iconId;
};

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
  internalNodes,
  onResizeStart,
  gtnhCatalog,
  gtnhAtlasUrl
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
  const ioRowCount = Math.max(node.recipe.inputs.length, node.recipe.outputs.length);
  // Belt-and-suspenders: node.height is normally kept in sync with row count
  // wherever the recipe is edited (see App.tsx's handleSaveRecipe), but this
  // guards every render against any path that isn't -- overflow is visible,
  // not clipped, so a too-short explicit height lets rows spill out past the
  // node's own bottom border instead of just getting cut off.
  const heightStyle = node.height ? { height: Math.max(node.height, computeMinNodeHeight(ioRowCount)) } : {};

  // Construct Box Shadow
  // 1. Selection Ring (if selected): 2px gap (bg color), 2px white ring
  // 2. Drop Shadow (always): 4px offset block shadow
  const selectionShadow = isSelected ? '0 0 0 2px #1c1917, 0 0 0 4px white, ' : '';
  const dropShadow = '4px 4px 0px rgba(0,0,0,0.5)';
  const combinedShadow = selectionShadow + dropShadow;

  // An IO row spans both grid columns when its counterpart slot doesn't
  // exist at that row index, so a lone long label isn't squeezed into half
  // the node width while the other half sits empty.
  const renderInputRow = (item: ItemStack, idx: number, spanFull: boolean) => {
    const resourceDef = unitDictionary[item.type];
    const color = resourceDef?.color || '#a8a29e';
    const typeLabel = resourceDef?.label || item.type;
    const iconId = resolveIconId(item, gtnhCatalog);
    return (
    <div key={`in-${idx}`} className={`relative flex items-center h-6 min-w-0 group/socket ${spanFull ? 'col-span-2' : ''}`}>
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
        <div className="flex items-center gap-1 min-w-0 pl-1">
            {iconId !== undefined && gtnhAtlasUrl && (
                <GtnhIcon atlasUrl={gtnhAtlasUrl} iconId={iconId} size={16} className="item-icon" />
            )}
            <span
                className="text-[8px] font-bold uppercase leading-none px-1 py-0.5 rounded-sm shrink-0"
                style={{ color, backgroundColor: `${color}26`, border: `1px solid ${color}66` }}
                title={typeLabel}
            >
                {typeLabel.slice(0, 2)}
            </span>
            <span className="text-xs text-[#cccccc] truncate select-none pointer-events-none font-mono" title={item.name}>
                {item.amount} {item.unit && <span className="text-[#888888] text-[10px]">{item.unit}</span>} {item.name}
            </span>
            {/* Custom hover tooltip: full text never gets clipped, unlike the truncated label above */}
            <div data-testid="io-tooltip-in" className="absolute left-0 -top-7 hidden group-hover/socket:block z-50 bg-[#111] text-white text-[10px] px-2 py-1 rounded border border-[#555] whitespace-nowrap shadow-lg pointer-events-none">
                {item.amount} {item.unit} {item.name} <span className="text-[#888]">({typeLabel})</span>
            </div>
        </div>
        )}
    </div>
    );
  };

  const renderOutputRow = (item: ItemStack, idx: number, spanFull: boolean) => {
    const resourceDef = unitDictionary[item.type];
    const color = resourceDef?.color || '#a8a29e';
    const typeLabel = resourceDef?.label || item.type;
    const iconId = resolveIconId(item, gtnhCatalog);
    return (
    <div key={`out-${idx}`} className={`relative flex items-center justify-end h-6 min-w-0 group/socket ${spanFull ? 'col-span-2' : ''}`}>
        {!isCollapsed && (
        <div className="flex items-center gap-1 min-w-0 pr-1 justify-end">
            {/* Custom hover tooltip: full text never gets clipped, unlike the truncated label below */}
            <div data-testid="io-tooltip-out" className="absolute right-0 -top-7 hidden group-hover/socket:block z-50 bg-[#111] text-white text-[10px] px-2 py-1 rounded border border-[#555] whitespace-nowrap shadow-lg pointer-events-none">
                {item.amount} {item.unit} {item.name} <span className="text-[#888]">({typeLabel})</span>
            </div>
            <span className="text-xs text-[#cccccc] truncate text-right select-none pointer-events-none font-mono" title={item.name}>
                {item.amount} {item.unit && <span className="text-[#888888] text-[10px]">{item.unit}</span>} {item.name}
            </span>
            <span
                className="text-[8px] font-bold uppercase leading-none px-1 py-0.5 rounded-sm shrink-0"
                style={{ color, backgroundColor: `${color}26`, border: `1px solid ${color}66` }}
                title={typeLabel}
            >
                {typeLabel.slice(0, 2)}
            </span>
            {iconId !== undefined && gtnhAtlasUrl && (
                <GtnhIcon atlasUrl={gtnhAtlasUrl} iconId={iconId} size={16} className="item-icon" />
            )}
        </div>
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
    );
  };

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

            {/* IO Area: a 2-column grid, one row per max(inputs, outputs) index.
                A row's cell spans both columns when its counterpart slot is
                absent, so a lone label can use the full node width instead
                of being capped at half with the other half sitting empty. */}
            <div className={`grid grid-cols-2 gap-x-4 gap-y-3 ${isCollapsed ? 'mt-auto' : ''}`}>
                {Array.from({ length: ioRowCount }).map((_, idx) => {
                    const inputItem = node.recipe.inputs[idx];
                    const outputItem = node.recipe.outputs[idx];
                    return (
                        <React.Fragment key={idx}>
                            {inputItem && renderInputRow(inputItem, idx, !outputItem)}
                            {outputItem && renderOutputRow(outputItem, idx, !inputItem)}
                        </React.Fragment>
                    );
                })}
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

      {/* Resize Handle (bottom-right corner, machines only -- frames resize via their own border handle) */}
      {!isFrame && onResizeStart && (
          <div
              data-testid="node-resize-handle"
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-40"
              onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'se'); }}
          >
              <div className="w-2 h-2 bg-white/30 border border-white/50" />
          </div>
      )}
    </div>
  );
});