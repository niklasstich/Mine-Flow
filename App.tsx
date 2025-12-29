import React, { useState, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { RecipeDialog } from './components/RecipeDialog';
import { ConnectionDialog } from './components/ConnectionDialog';
import { DictionaryEditor } from './components/DictionaryEditor';
import { Sidebar } from './components/Sidebar';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ImportExportDialog } from './components/ImportExportDialog';
import { RenameDialog } from './components/RenameDialog';
import { NodeData, Connection, Recipe, Prefab, UnitDictionary, FrameData, Blueprint } from './types';
import { DEFAULT_RECIPE, PREFABS } from './constants';
import { DEFAULT_UNIT_DICTIONARY } from './services/unitDictionary';
import { generateDiagramString, generatePrefabString, parseImportString, DiagramData } from './utils/io';
import { getNodesInFrame } from './utils/frameUtils';
import { Plus, Cpu, Book, Layers, Box, Share2, Upload } from 'lucide-react';

export default function App() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Connection[]>([]);
  const [frames, setFrames] = useState<FrameData[]>([]);
  
  // View State
  const [collapseFrames, setCollapseFrames] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Initialize library (built-ins + custom) from local storage
  const [library, setLibrary] = useState<Prefab[]>(() => {
    try {
      const saved = localStorage.getItem('mineflow_v2_library');
      let loaded: any[] = [];
      
      if (saved) {
        loaded = JSON.parse(saved);
      } else {
        // Fallback: Try migration from v1
        const oldCustom = localStorage.getItem('mineflow_custom_prefabs');
        const custom = oldCustom ? JSON.parse(oldCustom) : [];
        // Deep copy defaults
        loaded = [...JSON.parse(JSON.stringify(PREFABS)), ...custom];
      }

      // Ensure all items have IDs (Migration)
      return loaded.map((p) => ({ ...p, id: p.id || crypto.randomUUID() }));

    } catch (e) {
      console.error("Failed to load library", e);
      return JSON.parse(JSON.stringify(PREFABS));
    }
  });

  // Initialize Blueprints (Process Lines)
  const [blueprints, setBlueprints] = useState<Blueprint[]>(() => {
      try {
          const saved = localStorage.getItem('mineflow_v2_blueprints');
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          return [];
      }
  });

  const [unitDictionary, setUnitDictionary] = useState<UnitDictionary>(DEFAULT_UNIT_DICTIONARY);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnDialogOpen, setIsConnDialogOpen] = useState(false);
  const [isDictOpen, setIsDictOpen] = useState(false);
  
  // Import/Export State
  const [ioState, setIoState] = useState<{
      isOpen: boolean;
      mode: 'import' | 'export';
      exportData?: string;
      exportTitle?: string;
      title?: string;
  }>({ isOpen: false, mode: 'export' });

  // Rename Dialog State
  const [renameState, setRenameState] = useState<{
      isOpen: boolean;
      type: 'frame' | 'blueprint' | 'create_blueprint' | 'save_prefab';
      id: string;
      currentName: string;
  }>({ isOpen: false, type: 'frame', id: '', currentName: '' });

  // Temporary state to hold recipe when saving a prefab via RenameDialog
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);

  const [editingNode, setEditingNode] = useState<NodeData | null>(null);
  const [creatingPrefab, setCreatingPrefab] = useState<NodeData | null>(null);
  const [editingPrefabId, setEditingPrefabId] = useState<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<Connection | null>(null);
  
  // Confirmation State
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Persist library whenever it changes
  useEffect(() => {
    localStorage.setItem('mineflow_v2_library', JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    localStorage.setItem('mineflow_v2_blueprints', JSON.stringify(blueprints));
  }, [blueprints]);

  const handleAddNode = () => {
    const id = crypto.randomUUID();
    const newNode: NodeData = {
      id,
      x: 100 + (nodes.length * 20) % 200,
      y: 100 + (nodes.length * 20) % 200,
      label: `Machine ${nodes.length + 1}`,
      recipe: JSON.parse(JSON.stringify(DEFAULT_RECIPE))
    };
    setNodes([...nodes, newNode]);
  };

  const handleDuplicateNode = (nodeId: string) => {
    const original = nodes.find(n => n.id === nodeId);
    if (!original) return;

    // Deep copy recipe with new IDs for I/O
    const newRecipe = JSON.parse(JSON.stringify(original.recipe));
    newRecipe.inputs = newRecipe.inputs.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
    newRecipe.outputs = newRecipe.outputs.map((o: any) => ({ ...o, id: crypto.randomUUID() }));

    const newNode: NodeData = {
        id: crypto.randomUUID(),
        label: `${original.label} (Copy)`,
        x: original.x + 40,
        y: original.y + 40,
        recipe: newRecipe
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleEditNode = (node: NodeData) => {
    setEditingNode(node);
    setIsDialogOpen(true);
  };
  
  const handleEditEdge = (edge: Connection) => {
      setEditingEdge(edge);
      setIsConnDialogOpen(true);
  }

  const handleSaveRecipe = (nodeId: string, newLabel: string, newRecipe: Recipe) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, label: newLabel, recipe: newRecipe } : n
    ));
    
    // Cleanup edges if sockets were removed
    setEdges(prev => prev.filter(e => {
        if (e.sourceNodeId === nodeId && e.sourceSocketIdx >= newRecipe.outputs.length) return false;
        if (e.targetNodeId === nodeId && e.targetSocketIdx >= newRecipe.inputs.length) return false;
        return true;
    }));
  };
  
  const handleSaveConnection = (edgeId: string, capacity: number) => {
      setEdges(prev => prev.map(e => 
        e.id === edgeId ? { ...e, capacity } : e
      ));
  };

  // Called from RecipeDialog "Save as Template" button
  const handleRequestSaveTemplate = (label: string, recipe: Recipe) => {
      setPendingRecipe(recipe);
      setRenameState({
          isOpen: true,
          type: 'save_prefab',
          id: 'new', // Placeholder
          currentName: label
      });
  };

  // Actual logic to commit to library
  const commitSaveTemplate = (label: string, recipe: Recipe) => {
    setLibrary(prev => [...prev, {
        id: crypto.randomUUID(),
        label,
        category: 'Custom',
        recipe: JSON.parse(JSON.stringify(recipe))
    }]);
    setIsSidebarOpen(true);
    alert(`Saved "${label}" to Library.`);
  };

  // Called from Node Context Menu "Save to Library"
  const handleSaveToLibrary = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setPendingRecipe(node.recipe);
    setRenameState({
        isOpen: true,
        type: 'save_prefab',
        id: nodeId,
        currentName: node.label
    });
  };

  // --- Frame Handlers ---

  const handleRenameFrame = (frameId: string) => {
      const frame = frames.find(f => f.id === frameId);
      if (!frame) return;
      setRenameState({
          isOpen: true,
          type: 'frame',
          id: frameId,
          currentName: frame.label
      });
  };
  
  const handleRenameBlueprint = (id: string) => {
      const bp = blueprints.find(b => b.id === id);
      if (!bp) return;
      setRenameState({
          isOpen: true,
          type: 'blueprint',
          id: id,
          currentName: bp.label
      });
  }

  const performRename = (newName: string) => {
      if (!newName.trim()) return;
      
      if (renameState.type === 'frame') {
          setFrames(prev => prev.map(f => f.id === renameState.id ? { ...f, label: newName.trim() } : f));
      } else if (renameState.type === 'blueprint') {
          setBlueprints(prev => prev.map(b => b.id === renameState.id ? { ...b, label: newName.trim() } : b));
      } else if (renameState.type === 'create_blueprint') {
          saveFrameToLibraryInternal(renameState.id, newName.trim());
      } else if (renameState.type === 'save_prefab' && pendingRecipe) {
          commitSaveTemplate(newName.trim(), pendingRecipe);
          setPendingRecipe(null);
      }
      setRenameState(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveFrameToLibrary = (frameId: string) => {
      const frame = frames.find(f => f.id === frameId);
      if (!frame) return;

      // Use dialog instead of prompt
      setRenameState({
          isOpen: true,
          type: 'create_blueprint',
          id: frameId,
          currentName: frame.label
      });
  };

  const saveFrameToLibraryInternal = (frameId: string, name: string) => {
      const frame = frames.find(f => f.id === frameId);
      if (!frame) return;

      // 1. Get Contained Nodes
      const containedNodes = getNodesInFrame(frame, nodes);
      const containedNodeIds = new Set(containedNodes.map(n => n.id));

      // 2. Clone and Normalize Nodes (Relative to Frame Top-Left)
      const relativeNodes = containedNodes.map(n => ({
          ...n,
          x: n.x - frame.x,
          y: n.y - frame.y,
          // Deep Copy Recipe to detach references
          recipe: JSON.parse(JSON.stringify(n.recipe))
      }));

      // 3. Get Contained Edges
      const containedEdges = edges.filter(e => 
          containedNodeIds.has(e.sourceNodeId) && containedNodeIds.has(e.targetNodeId)
      );

      // 4. Clone Edges
      const clonedEdges = containedEdges.map(e => ({ ...e }));

      // 5. Create Blueprint
      const newBlueprint: Blueprint = {
          id: crypto.randomUUID(),
          label: name,
          nodes: relativeNodes,
          edges: clonedEdges,
          frames: [] 
      };

      setBlueprints(prev => [...prev, newBlueprint]);
      setIsSidebarOpen(true);
      alert(`Process Line "${name}" saved to library.`);
  };

  const handleDeleteFrame = (frameId: string) => {
      const frame = frames.find(f => f.id === frameId);
      if (!frame) return;

      const containedNodes = getNodesInFrame(frame, nodes);
      const count = containedNodes.length;

      setConfirmationState({
          isOpen: true,
          title: "Delete Frame & Contents",
          message: `Are you sure you want to delete "${frame.label}"? This will also remove ${count} machine${count !== 1 ? 's' : ''} currently inside it.`,
          onConfirm: () => {
              // 1. Identify nodes to remove
              const nodeIdsToRemove = new Set(containedNodes.map(n => n.id));
              
              // 2. Remove Nodes
              setNodes(prev => prev.filter(n => !nodeIdsToRemove.has(n.id)));
              
              // 3. Remove Edges connected to those nodes
              setEdges(prev => prev.filter(e => !nodeIdsToRemove.has(e.sourceNodeId) && !nodeIdsToRemove.has(e.targetNodeId)));
              
              // 4. Remove Frame
              setFrames(prev => prev.filter(f => f.id !== frameId));

              setConfirmationState(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleDeleteBlueprint = (id: string) => {
      const bp = blueprints.find(b => b.id === id);
      const label = bp ? bp.label : "Process Line";

      setConfirmationState({
          isOpen: true,
          title: "Delete Process Line",
          message: `Are you sure you want to delete "${label}" from your library? This action cannot be undone.`,
          onConfirm: () => {
              setBlueprints(prev => prev.filter(b => b.id !== id));
              setConfirmationState(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  // --- Library Management ---

  const handleStartCreatePrefab = () => {
      const tempNode: NodeData = {
          id: 'prefab-creation',
          label: 'New Machine',
          x: 0,
          y: 0,
          recipe: JSON.parse(JSON.stringify(DEFAULT_RECIPE))
      };
      setCreatingPrefab(tempNode);
  };

  const handleSaveNewPrefab = (id: string, label: string, recipe: Recipe) => {
      setLibrary(prev => [...prev, {
          id: crypto.randomUUID(),
          label,
          category: 'Custom',
          recipe: JSON.parse(JSON.stringify(recipe))
      }]);
      setCreatingPrefab(null);
      setIsSidebarOpen(true);
  };

  const handleDeleteLibraryItem = (id: string) => {
      const item = library.find(p => p.id === id);
      const label = item ? item.label : "this machine";
      
      setConfirmationState({
          isOpen: true,
          title: "Delete Machine",
          message: `Are you sure you want to delete "${label}" from your library? This action cannot be undone.`,
          onConfirm: () => {
              setLibrary(prev => prev.filter(p => p.id !== id));
              setConfirmationState(prev => ({ ...prev, isOpen: false }));
              if (editingPrefabId === id) {
                  setEditingPrefabId(null);
              }
          }
      });
  };

  const handleEditLibraryItem = (id: string) => {
      setEditingPrefabId(id);
  };

  const handleUpdateLibraryItem = (id: string, label: string, recipe: Recipe) => {
    if (!editingPrefabId) return;
    
    setLibrary(prev => prev.map(p => {
        if (p.id === editingPrefabId) {
            return {
                ...p,
                label,
                recipe: JSON.parse(JSON.stringify(recipe))
            };
        }
        return p;
    }));
    setEditingPrefabId(null);
  };

  // --- IO Handlers ---

  const handleExportDiagram = () => {
      const dataStr = generateDiagramString(nodes, edges, frames);
      setIoState({
          isOpen: true,
          mode: 'export',
          exportData: dataStr,
          exportTitle: 'Diagram Save Code',
          title: 'Share Diagram'
      });
  };

  const handleImportData = (str: string) => {
      const result = parseImportString(str);
      
      if (result.type === 'error') {
          alert("Invalid data string. Could not detect diagram or machine format.");
          return;
      }

      if (result.type === 'diagram') {
          const d = result.data as DiagramData;
          setConfirmationState({
              isOpen: true,
              title: "Replace Diagram?",
              message: "This will replace your current diagram with the imported one. All unsaved changes to the current diagram will be lost.",
              onConfirm: () => {
                  setNodes(d.nodes || []);
                  setEdges(d.edges || []);
                  setFrames(d.frames || []);
                  setConfirmationState(prev => ({ ...prev, isOpen: false }));
              }
          });
      } else if (result.type === 'machine') {
          const d = result.data;
          setLibrary(prev => [...prev, {
              id: crypto.randomUUID(),
              label: d.label || 'Imported Machine',
              category: d.category || 'Custom',
              recipe: d.recipe
          }]);
          setIsSidebarOpen(true);
          alert(`Imported "${d.label}" to your Library.`);
      }
  };

  const handleExportPrefab = (prefab: Prefab) => {
      const str = generatePrefabString(prefab);
      setIoState({
          isOpen: true,
          mode: 'export',
          exportData: str,
          exportTitle: `Machine Code: ${prefab.label}`,
          title: 'Share Machine'
      });
  };
  
  const handleOpenImport = () => {
      setIoState({
          isOpen: true,
          mode: 'import',
          title: 'Import Data',
          exportTitle: 'Paste Diagram or Machine code'
      });
  };

  const isOverlayOpen = isDialogOpen || isConnDialogOpen || isDictOpen || !!creatingPrefab || !!editingPrefabId || ioState.isOpen || renameState.isOpen;
  const editingPrefab = editingPrefabId ? library.find(p => p.id === editingPrefabId) : null;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Navbar */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 shadow-lg relative z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-green-700 p-2 rounded shadow-lg shadow-emerald-500/20">
            <Cpu size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-zinc-100">MineFlow</h1>
            <p className="text-xs text-zinc-400 font-mono">Process Engineer v1.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          
          {/* View Mode Radio Group */}
          <div className="flex bg-zinc-800 p-1 rounded border border-zinc-700">
             <button
                onClick={() => setCollapseFrames(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${!collapseFrames ? 'bg-zinc-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
             >
                <Layers size={14} />
                Detailed
             </button>
             <button
                onClick={() => setCollapseFrames(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${collapseFrames ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
             >
                <Box size={14} />
                Collapsed
             </button>
          </div>

          <div className="h-6 w-px bg-zinc-700 mx-2"></div>

          <button 
             onClick={handleOpenImport}
             className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
             title="Import Data"
          >
             <Upload size={20} />
          </button>
          
          <button 
             onClick={handleExportDiagram}
             className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
             title="Share / Save Diagram"
          >
             <Share2 size={20} />
          </button>

          <div className="h-6 w-px bg-zinc-700 mx-2"></div>

          <button 
            onClick={() => setIsDictOpen(true)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded font-medium transition-all border border-zinc-700 hover:text-white"
          >
            <Book size={18} />
            Dictionary
          </button>
          <button 
            onClick={handleAddNode}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-medium transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Plus size={18} />
            Add Machine
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 relative overflow-hidden flex">
        <div className="flex-1 relative">
            <Canvas 
                nodes={nodes} 
                setNodes={setNodes} 
                edges={edges} 
                setEdges={setEdges}
                frames={frames}
                setFrames={setFrames}
                onEditNode={handleEditNode}
                onEditEdge={handleEditEdge}
                onDuplicateNode={handleDuplicateNode}
                onSaveToLibrary={handleSaveToLibrary}
                onSaveFrameToLibrary={handleSaveFrameToLibrary}
                onRenameFrame={handleRenameFrame}
                onDeleteFrame={handleDeleteFrame}
                prefabs={library}
                unitDictionary={unitDictionary}
                isOverlayOpen={isOverlayOpen}
                onDeleteCustomPrefab={handleDeleteLibraryItem}
                collapseFrames={collapseFrames}
            />
        </div>
        
        {/* Sidebar Overlay */}
        <Sidebar 
            prefabs={library} 
            blueprints={blueprints}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            onDeletePrefab={handleDeleteLibraryItem} 
            onAddPrefab={handleStartCreatePrefab}
            onEditPrefab={handleEditLibraryItem}
            onExportPrefab={handleExportPrefab}
            onDeleteBlueprint={handleDeleteBlueprint}
            onRenameBlueprint={handleRenameBlueprint}
        />
      </main>

      {/* Dialogs */}
      <RenameDialog 
          isOpen={renameState.isOpen}
          onClose={() => setRenameState(prev => ({ ...prev, isOpen: false }))}
          title={
              renameState.type === 'frame' ? "Rename Frame" : 
              renameState.type === 'blueprint' ? "Rename Process Line" :
              renameState.type === 'save_prefab' ? "Save Machine" :
              "Save Process Line"
          }
          initialValue={renameState.currentName}
          onSave={performRename}
      />

      {editingNode && (
        <RecipeDialog 
            node={editingNode}
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleSaveRecipe}
            onSaveTemplate={handleRequestSaveTemplate}
            unitDictionary={unitDictionary}
            mode="node"
            submitLabel="Save Changes"
        />
      )}

      {creatingPrefab && (
          <RecipeDialog 
            node={creatingPrefab}
            isOpen={true}
            onClose={() => setCreatingPrefab(null)}
            onSave={handleSaveNewPrefab}
            onSaveTemplate={() => {}} 
            unitDictionary={unitDictionary}
            mode="prefab"
            submitLabel="Create Machine"
          />
      )}

      {editingPrefab && (
        <RecipeDialog 
            node={{
                id: 'prefab-edit',
                x: 0, 
                y: 0,
                label: editingPrefab.label,
                recipe: editingPrefab.recipe
            }}
            isOpen={true}
            onClose={() => setEditingPrefabId(null)}
            onSave={handleUpdateLibraryItem}
            onSaveTemplate={() => {}} 
            unitDictionary={unitDictionary}
            mode="prefab"
            submitLabel="Save Machine"
            onDelete={() => handleDeleteLibraryItem(editingPrefab.id)}
            onExport={() => handleExportPrefab(editingPrefab)}
        />
      )}
      
      {editingEdge && (
          <ConnectionDialog
            connection={editingEdge}
            isOpen={isConnDialogOpen}
            onClose={() => setIsConnDialogOpen(false)}
            onSave={handleSaveConnection}
            unitDictionary={unitDictionary}
          />
      )}

      <DictionaryEditor 
          isOpen={isDictOpen} 
          onClose={() => setIsDictOpen(false)}
          dictionary={unitDictionary}
          onSave={setUnitDictionary}
      />
      
      <ImportExportDialog 
          isOpen={ioState.isOpen}
          onClose={() => setIoState(prev => ({ ...prev, isOpen: false }))}
          mode={ioState.mode}
          exportData={ioState.exportData}
          exportTitle={ioState.exportTitle}
          title={ioState.title}
          onImport={handleImportData}
      />

      <ConfirmationDialog 
        isOpen={confirmationState.isOpen}
        title={confirmationState.title}
        message={confirmationState.message}
        onConfirm={confirmationState.onConfirm}
        onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
        confirmLabel={confirmationState.title.includes("Replace") ? "Import & Replace" : "Delete"}
        isDestructive={true}
      />
    </div>
  );
}