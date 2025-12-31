import React, { useState, useEffect, useRef } from 'react';
import { Search, Box, ArrowRight } from 'lucide-react';
import { NodeData } from '../types';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeData[];
  onSelectNode: (nodeId: string) => void;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, nodes, onSelectNode }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Filter nodes based on label or outputs
  const filteredNodes = React.useMemo(() => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return nodes.filter(node => {
      // Match Name
      if (node.label.toLowerCase().includes(lowerQuery)) return true;
      // Match Output Items
      if (node.recipe.outputs.some(o => o.name.toLowerCase().includes(lowerQuery))) return true;
      return false;
    }).slice(0, 10); // Limit to 10 results
  }, [nodes, query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredNodes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredNodes[selectedIndex]) {
        onSelectNode(filteredNodes[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-[#212121] border border-[#555] shadow-2xl overflow-hidden flex flex-col font-mono animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-[#333]">
          <Search className="text-[#777]" size={20} />
          <input 
            ref={inputRef}
            className="flex-1 bg-transparent text-lg text-white placeholder-[#555] focus:outline-none"
            placeholder="Search machines or items..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex gap-2">
             <span className="text-[10px] bg-[#333] px-2 py-1 rounded text-[#888] border border-[#444]">↑↓ to navigate</span>
             <span className="text-[10px] bg-[#333] px-2 py-1 rounded text-[#888] border border-[#444]">Enter to jump</span>
          </div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {filteredNodes.length === 0 && query && (
             <div className="p-4 text-center text-[#555] text-sm italic">No results found</div>
          )}
          {filteredNodes.map((node, idx) => (
            <button
              key={node.id}
              onClick={() => { onSelectNode(node.id); onClose(); }}
              className={`w-full text-left px-4 py-3 flex items-center justify-between group ${idx === selectedIndex ? 'bg-[#3b8526] text-white' : 'text-[#ccc] hover:bg-[#2a2a2a]'}`}
            >
              <div className="flex items-center gap-3">
                <Box size={16} className={idx === selectedIndex ? 'text-white' : 'text-[#555]'} />
                <span className="font-bold">{node.label}</span>
              </div>
              
              {/* Show matching output context if query matches an item */}
              {query && node.recipe.outputs.some(o => o.name.toLowerCase().includes(query.toLowerCase())) && (
                 <div className="text-xs flex items-center gap-1 opacity-80">
                    Outputs <ArrowRight size={10} />
                    <span className="font-bold underline decoration-white/30">
                        {node.recipe.outputs.find(o => o.name.toLowerCase().includes(query.toLowerCase()))?.name}
                    </span>
                 </div>
              )}
            </button>
          ))}
          {!query && (
            <div className="p-4 text-center text-[#555] text-xs">
                Type to find a machine in the diagram...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
