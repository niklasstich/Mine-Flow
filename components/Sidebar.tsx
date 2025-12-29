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
  }

  return (
    <div className={`absolute right-0 top-0 bottom-0 bg-slate-900 border-l border-slate-800 transition-all duration-300 z-40 flex shadow-2xl ${isOpen ? 'w-80' : 'w-0'}`}>
        {/* Toggle Button */}
        <button 
            onClick={onToggle}
            className="absolute -left-6 top-4 bg-slate-800 border border-slate-700 text-slate-400 p-1 rounded-l-md hover:text-white hover:bg-slate-700 shadow-md flex items-center justify-center w-6 h-10 border-r-0"
            title={isOpen ? "Collapse Library" : "Expand Library"}
        >
            {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`flex-1 flex flex-col overflow-hidden bg-slate-900 ${!isOpen ? 'hidden' : ''}`}>
            
            {/* Header / Tabs */}
            <div className="flex flex-col border-b border-slate-800 bg-slate-900">
                <div className="p-4 pb-2 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="bg-indigo-500/20 p-1.5 rounded">
                            <Box size={18} className="text-indigo-400"/>
                        </div>
                        <span className="font-bold text-slate-200">Library</span>
                    </div>
                </div>
                
                <div className="flex px-2 gap-1">
                    <button 
                        onClick={() => setActiveTab('machines')}
                        className={`flex-1 pb-2 pt-1 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${activeTab === 'machines' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Machines
                    </button>
                    <button 
                        onClick={() => setActiveTab('lines')}
                        className={`flex-1 pb-2 pt-1 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${activeTab === 'lines' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Process Lines
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-6 bg-slate-900/50">
                
                {activeTab === 'machines' && (
                    <>
                         <div className="flex justify-end">
                            <button 
                                onClick={onAddPrefab}
                                className="text-xs flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded transition-colors"
                            >
                                <Plus size={12} /> New Machine
                            </button>
                         </div>

                        {categories.length === 0 && (
                            <div className="text-center text-slate-500 py-10 text-sm">
                                Library is empty.<br/>Click + to create machines.
                            </div>
                        )}

                        {categories.map(cat => (
                        <div key={cat} className="space-y-2">
                            <div className="px-1 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="h-px bg-slate-800 flex-1"></span>
                                {cat}
                                <span className="h-px bg-slate-800 flex-1"></span>
                            </div>
                            <div className="space-y-2">
                                {prefabs
                                    .filter(p => p.category === cat)
                                    .map((prefab) => (
                                    <div 
                                        key={prefab.id}
                                        draggable
                                        onDragStart={(e) => onDragStartPrefab(e, prefab)}
                                        className="group bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500/50 rounded-lg p-3 cursor-grab active:cursor-grabbing flex items-center gap-3 transition-all shadow-sm hover:shadow-md hover:translate-x-1"
                                    >
                                        <div className="text-slate-600 group-hover:text-indigo-400 transition-colors">
                                            <GripVertical size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-200">{prefab.label}</div>
                                            <div className="text-[10px] text-slate-500">
                                                {prefab.recipe.inputs.length} In / {prefab.recipe.outputs.length} Out
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onExportPrefab(prefab); }}
                                                className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20 rounded transition-all"
                                                title="Share Machine"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEditPrefab(prefab.id); }}
                                                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20 rounded transition-all"
                                                title="Edit Machine"
                                            >
                                                <Settings size={14} />
                                            </button>
                                            {cat === 'Custom' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDeletePrefab(prefab.id); }}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all"
                                                    title="Delete Machine"
                                                >
                                                    <Trash2 size={14} />
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
                            <div className="text-center text-slate-500 py-10 text-sm space-y-2">
                                <Workflow className="mx-auto text-slate-600" size={32} />
                                <p>No Process Lines saved.</p>
                                <p className="text-xs">Right click a Frame in the canvas and select "Save to Library" to add one.</p>
                            </div>
                        ) : (
                             <div className="space-y-2">
                                {blueprints.map(bp => (
                                    <div 
                                        key={bp.id}
                                        draggable
                                        onDragStart={(e) => onDragStartBlueprint(e, bp)}
                                        className="group bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500/50 rounded-lg p-3 cursor-grab active:cursor-grabbing flex items-center gap-3 transition-all shadow-sm hover:shadow-md hover:translate-x-1"
                                    >
                                         <div className="text-slate-600 group-hover:text-indigo-400 transition-colors">
                                            <GripVertical size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-200">{bp.label}</div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                <span className="flex items-center gap-0.5"><Box size={10}/> {bp.nodes.length}</span>
                                                <span className="flex items-center gap-0.5"><Workflow size={10}/> {bp.edges.length}</span>
                                                <span className="flex items-center gap-0.5"><Layers size={10}/> {bp.frames?.length || 0}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRenameBlueprint(bp.id); }}
                                                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20 rounded transition-all"
                                                title="Rename Line"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteBlueprint(bp.id); }}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all"
                                                title="Delete Line"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </>
                )}

            </div>
            
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-[10px] text-center text-slate-600">
                Drag items to canvas to add
            </div>
        </div>
    </div>
  );
};