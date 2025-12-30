import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Trash2, Box, Plus, Settings, Share2, Workflow, Layers, Pencil } from 'lucide-react';
import { Prefab, Blueprint } from '../types';

interface SidebarProps {
  prefabs: Prefab[];
  blueprints: Blueprint[];
  isOpen: boolean;
  onToggle: () => void;
  onDeletePrefab: (id: string) => void;
  onAddPrefab: () => void;
  onEditPrefab: (id: string) => void;
  onExportPrefab: (prefab: Prefab) => void;
  onDeleteBlueprint: (id: string) => void;
  onRenameBlueprint: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    prefabs, blueprints, isOpen, onToggle, 
    onDeletePrefab, onAddPrefab, onEditPrefab, onExportPrefab,
    onDeleteBlueprint, onRenameBlueprint
}) => {
  const [activeTab, setActiveTab] = useState<'machines' | 'lines'>('machines');
  
  // Group by category for Machines
  const categories = Array.from(new Set(prefabs.map(p => p.category)));
  if (categories.includes('Custom')) {
      const idx = categories.indexOf('Custom');
      categories.splice(idx, 1);
      categories.unshift('Custom');
  }

  const onDragStartPrefab = (e: React.DragEvent, prefab: Prefab) => {
    e.dataTransfer.setData('application/mineflow-prefab', JSON.stringify(prefab));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onDragStartBlueprint = (e: React.DragEvent, blueprint: Blueprint) => {
    e.dataTransfer.setData('application/mineflow-blueprint', JSON.stringify(blueprint));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // MC Button Style Helper Class
  const mcBtnClass = "bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono";

  return (
    <div className={`absolute right-0 top-0 bottom-0 bg-[#212121] border-l-4 border-[#111] transition-all duration-300 z-40 flex shadow-2xl font-mono ${isOpen ? 'w-80' : 'w-0'}`}>
        {/* Toggle Button */}
        <button 
            onClick={onToggle}
            className={`absolute -left-8 top-4 ${mcBtnClass} p-1 w-8 h-10 flex items-center justify-center`}
            title={isOpen ? "Collapse Library" : "Expand Library"}
        >
            {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`flex-1 flex flex-col overflow-hidden bg-[#c6c6c6] ${!isOpen ? 'hidden' : ''}`}>
            
            {/* Header / Tabs */}
            <div className="flex flex-col bg-[#c6c6c6] p-2 pb-0">
                <div className="flex items-center justify-between mb-2 px-1">
                     <div className="flex items-center gap-2 text-[#333]">
                        <Box size={18} className="text-[#333]"/>
                        <span className="font-bold text-lg">Library</span>
                    </div>
                </div>
                
                <div className="flex gap-1">
                    <button 
                        onClick={() => setActiveTab('machines')}
                        className={`flex-1 py-2 text-xs font-bold border-t-2 border-x-2 rounded-t-sm transition-colors ${activeTab === 'machines' ? 'bg-[#c6c6c6] text-[#333] border-[#555] border-b-0 -mb-0.5 z-10' : 'bg-[#8b8b8b] text-[#eee] border-[#555] hover:bg-[#a0a0a0]'}`}
                    >
                        Machines
                    </button>
                    <button 
                        onClick={() => setActiveTab('lines')}
                        className={`flex-1 py-2 text-xs font-bold border-t-2 border-x-2 rounded-t-sm transition-colors ${activeTab === 'lines' ? 'bg-[#c6c6c6] text-[#333] border-[#555] border-b-0 -mb-0.5 z-10' : 'bg-[#8b8b8b] text-[#eee] border-[#555] hover:bg-[#a0a0a0]'}`}
                    >
                        Process Lines
                    </button>
                </div>
            </div>

            {/* Content Area - Solid Dark Inventory Background */}
            <div className="flex-1 overflow-y-auto p-3 space-y-6 bg-[#212121] border-t-2 border-[#555] shadow-inner relative">
                
                {activeTab === 'machines' && (
                    <>
                         <div className="flex justify-end relative z-10">
                            <button 
                                onClick={onAddPrefab}
                                className={`text-xs flex items-center gap-1 px-3 py-1.5 ${mcBtnClass}`}
                            >
                                <Plus size={12} /> New Machine
                            </button>
                         </div>

                        {categories.length === 0 && (
                            <div className="text-center text-[#777] py-10 text-sm relative z-10">
                                Library is empty.<br/>Click + to create machines.
                            </div>
                        )}

                        {categories.map(cat => (
                        <div key={cat} className="space-y-2 relative z-10">
                            <div className="px-1 text-xs font-bold text-[#aaa] uppercase tracking-wider flex items-center gap-2">
                                <span className="h-0.5 bg-[#444] flex-1"></span>
                                {cat}
                                <span className="h-0.5 bg-[#444] flex-1"></span>
                            </div>
                            <div className="space-y-1">
                                {prefabs
                                    .filter(p => p.category === cat)
                                    .map((prefab) => (
                                    <div 
                                        key={prefab.id}
                                        draggable
                                        onDragStart={(e) => onDragStartPrefab(e, prefab)}
                                        className="group bg-[#8b8b8b] border-2 border-[#373737] hover:border-[#fff] p-2 cursor-grab active:cursor-grabbing flex items-center gap-3 transition-all hover:translate-x-1"
                                    >
                                        <div className="text-[#333] group-hover:text-black transition-colors">
                                            <GripVertical size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-[#111]">{prefab.label}</div>
                                            <div className="text-[10px] text-[#333]">
                                                {prefab.recipe.inputs.length} In / {prefab.recipe.outputs.length} Out
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onExportPrefab(prefab); }}
                                                className="p-1 text-[#333] hover:text-black hover:bg-white/20 rounded"
                                                title="Share Machine"
                                            >
                                                <Share2 size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEditPrefab(prefab.id); }}
                                                className="p-1 text-[#333] hover:text-black hover:bg-white/20 rounded"
                                                title="Edit Machine"
                                            >
                                                <Settings size={12} />
                                            </button>
                                            {cat === 'Custom' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDeletePrefab(prefab.id); }}
                                                    className="p-1 text-[#333] hover:text-red-700 hover:bg-red-500/20 rounded"
                                                    title="Delete Machine"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        ))}
                    </>
                )}

                {activeTab === 'lines' && (
                    <>
                        {blueprints.length === 0 ? (
                            <div className="text-center text-[#777] py-10 text-sm space-y-2 relative z-10">
                                <Workflow className="mx-auto text-[#555]" size={32} />
                                <p>No Process Lines saved.</p>
                                <p className="text-xs">Right click a Frame in the canvas and select "Save to Library" to add one.</p>
                            </div>
                        ) : (
                             <div className="space-y-1 relative z-10">
                                {blueprints.map(bp => (
                                    <div 
                                        key={bp.id}
                                        draggable
                                        onDragStart={(e) => onDragStartBlueprint(e, bp)}
                                        className="group bg-[#8b8b8b] border-2 border-[#373737] hover:border-[#fff] p-2 cursor-grab active:cursor-grabbing flex items-center gap-3 transition-all hover:translate-x-1"
                                    >
                                         <div className="text-[#333] group-hover:text-black transition-colors">
                                            <GripVertical size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-[#111]">{bp.label}</div>
                                            <div className="text-[10px] text-[#333] flex items-center gap-2">
                                                <span className="flex items-center gap-0.5"><Box size={10}/> {bp.nodes.length}</span>
                                                <span className="flex items-center gap-0.5"><Workflow size={10}/> {bp.edges.length}</span>
                                                <span className="flex items-center gap-0.5"><Layers size={10}/> {bp.frames?.length || 0}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRenameBlueprint(bp.id); }}
                                                className="p-1 text-[#333] hover:text-black hover:bg-white/20 rounded"
                                                title="Rename Line"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteBlueprint(bp.id); }}
                                                className="p-1 text-[#333] hover:text-red-700 hover:bg-red-500/20 rounded"
                                                title="Delete Line"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </>
                )}

            </div>
            
            <div className="p-2 bg-[#c6c6c6] border-t-2 border-[#fff] text-[10px] text-center text-[#555] font-bold">
                Drag items to canvas to add
            </div>
        </div>
    </div>
  );
};