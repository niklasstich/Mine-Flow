import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Box } from 'lucide-react';
import { NodeData } from '../types';

interface InfoPanelProps {
  nodes: NodeData[];
  selectedNodeIds: Set<string>;
  onSelectMachines: (name: string) => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ nodes, selectedNodeIds, onSelectMachines }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = useMemo(() => {
    const groups: Record<string, { count: number, ids: string[] }> = {};
    nodes.forEach(node => {
       const name = node.label;
       if (!groups[name]) {
           groups[name] = { count: 0, ids: [] };
       }
       groups[name].count += 1;
       groups[name].ids.push(node.id);
    });
    // Sort by count desc
    const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count); 
    return { sorted, total: nodes.length };
  }, [nodes]);

  return (
    <div className="absolute top-4 left-4 z-50 font-mono flex flex-col items-start gap-2 select-none pointer-events-auto">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] text-white px-3 py-2 text-xs flex items-center gap-2 shadow-xl transition-all active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] active:bg-[#2a2a2a]"
        title="Toggle Machine Statistics"
      >
        <BarChart3 size={16} className="text-[#aaa]" />
        <span className="font-bold">Machine Stats</span>
        <div className="bg-[#1a1a1a] px-1.5 rounded text-[#55FF55] text-[10px] border border-[#333]">{stats.total}</div>
        {isExpanded ? <ChevronUp size={14} className="text-[#777]"/> : <ChevronDown size={14} className="text-[#777]"/>}
      </button>

      {isExpanded && (
        <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] p-0 min-w-[240px] max-w-[300px] flex flex-col animate-in fade-in slide-in-from-top-2">
           <div className="p-2 bg-[#333] border-b-2 border-[#555] flex justify-between items-center">
              <span className="text-[#eee] text-xs font-bold uppercase tracking-wider">Inventory</span>
              <span className="text-[#777] text-[10px]">Total: {stats.total}</span>
           </div>
           
           <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1 bg-[#1a1a1a] space-y-0.5">
              {stats.sorted.map(([name, data]) => {
                const isSelected = data.ids.length > 0 && data.ids.every(id => selectedNodeIds.has(id));
                
                return (
                    <div 
                        key={name} 
                        onClick={() => onSelectMachines(name)}
                        className={`
                            flex justify-between items-center text-xs p-1.5 border border-transparent 
                            hover:bg-[#2a2a2a] group transition-all cursor-pointer relative
                            ${isSelected ? 'outline outline-1 outline-white bg-[#333] z-10' : 'border-b-[#333] last:border-b-0'}
                        `}
                    >
                    <div className="flex items-center gap-2 truncate pr-2">
                        <Box size={12} className={`${isSelected ? 'text-white' : 'text-[#555] group-hover:text-[#aaa]'} flex-shrink-0`}/>
                        <span className={`truncate ${isSelected ? 'text-white font-bold' : 'text-[#ccc] group-hover:text-white'}`} title={name}>{name}</span>
                    </div>
                    <span className={`font-bold font-mono px-1.5 rounded border min-w-[20px] text-center ${isSelected ? 'bg-white text-black border-white' : 'text-[#aaa] bg-[#222] border-[#333]'}`}>
                        {data.count}
                    </span>
                    </div>
                );
              })}
              {stats.sorted.length === 0 && (
                  <div className="text-[#555] italic text-xs text-center py-4">
                      No machines placed
                  </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};