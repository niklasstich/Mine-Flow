import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Clock, Box, Copy, Share2 } from 'lucide-react';
import { NodeData, Recipe, ItemStack, ResourceType, TimeUnit, UnitDictionary, ResourceDef } from '../types';
import { getUnitsForType, getDefaultUnit } from '../services/unitDictionary';

interface RecipeDialogProps {
  node: NodeData;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, newLabel: string, newRecipe: Recipe) => void;
  onSaveTemplate: (label: string, recipe: Recipe) => void;
  unitDictionary: UnitDictionary;
  mode?: 'node' | 'prefab';
  submitLabel?: string;
  onDelete?: () => void;
  onExport?: () => void;
}

export const RecipeDialog: React.FC<RecipeDialogProps> = ({ node, isOpen, onClose, onSave, onSaveTemplate, unitDictionary, mode = 'node', submitLabel, onDelete, onExport }) => {
  const [label, setLabel] = useState(node.label);
  const [category, setCategory] = useState('Custom'); // For prefab creation
  const [recipe, setRecipe] = useState<Recipe>(JSON.parse(JSON.stringify(node.recipe)));

  useEffect(() => {
    if (isOpen) {
      setLabel(node.label);
      if (mode === 'prefab') setCategory('Custom');
      // Ensure defaults if fields missing from old version
      const safeRecipe = JSON.parse(JSON.stringify(node.recipe));
      if (!safeRecipe.processTimeUnit) safeRecipe.processTimeUnit = 'seconds';
      safeRecipe.inputs.forEach((i: any) => { 
          if(!i.type) i.type = 'item'; 
          if(!i.unit) i.unit = getDefaultUnit(unitDictionary, i.type);
      });
      safeRecipe.outputs.forEach((o: any) => { 
          if(!o.type) o.type = 'item'; 
          if(!o.unit) o.unit = getDefaultUnit(unitDictionary, o.type);
      });
      setRecipe(safeRecipe);
    }
  }, [isOpen, node, unitDictionary, mode]);

  if (!isOpen) return null;

  const handleAddItem = (type: 'inputs' | 'outputs') => {
    const defaultType = Object.keys(unitDictionary)[0] || 'item';
    const newItem: ItemStack = {
      id: crypto.randomUUID(),
      name: type === 'inputs' ? 'New Input' : 'New Output',
      amount: 1,
      type: defaultType,
      unit: getDefaultUnit(unitDictionary, defaultType)
    };
    setRecipe(prev => ({
      ...prev,
      [type]: [...prev[type], newItem]
    }));
  };

  const handleRemoveItem = (type: 'inputs' | 'outputs', index: number) => {
    setRecipe(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handleUpdateItem = (type: 'inputs' | 'outputs', index: number, field: keyof ItemStack, value: any) => {
    setRecipe(prev => {
      const newList = [...prev[type]];
      const oldItem = newList[index];
      
      // If type changes, reset unit to default of new type
      if (field === 'type' && value !== oldItem.type) {
         newList[index] = { ...oldItem, [field]: value, unit: getDefaultUnit(unitDictionary, value) };
      } else {
         newList[index] = { ...oldItem, [field]: value };
      }
      return { ...prev, [type]: newList };
    });
  };

  const handleSave = () => {
    // Basic validation
    if (!recipe.processTime || recipe.processTime <= 0) {
        alert("Processing time must be greater than 0");
        return;
    }
    
    onSave(node.id, label, recipe);
    onClose();
  };

  const handleTemplateSave = () => {
      onSaveTemplate(label, recipe);
  };

  const calculateRate = () => {
      let time = recipe.processTime;
      if (recipe.processTimeUnit === 'ticks') {
          time = time / 20;
      }
      return time > 0 ? 1/time : 0;
  }

  const renderItemRow = (item: ItemStack, idx: number, section: 'inputs' | 'outputs') => {
      const units = getUnitsForType(unitDictionary, item.type);
      const resourceTypes = Object.entries(unitDictionary).map(([key, val]) => ({
          type: key,
          label: (val as ResourceDef).label
      }));

      return (
        <div key={item.id} className="flex flex-col gap-2 bg-slate-900/50 p-3 rounded border border-slate-700/50">
            <div className="flex gap-2 items-center">
                <input 
                type="text" 
                value={item.name}
                onChange={(e) => handleUpdateItem(section, idx, 'name', e.target.value)}
                className={`flex-1 bg-transparent border-b border-slate-600 text-sm text-white focus:outline-none pb-1 ${section === 'inputs' ? 'focus:border-indigo-400' : 'focus:border-emerald-400'}`}
                placeholder="Item Name"
                />
                <button onClick={() => handleRemoveItem(section, idx)} className="text-red-400 hover:text-red-300 p-1">
                <Trash2 size={14} />
                </button>
            </div>
            
            <div className="flex gap-2 items-center justify-between flex-wrap">
                <div className="flex items-center gap-2">
                    <select 
                        value={item.type || 'item'}
                        onChange={(e) => handleUpdateItem(section, idx, 'type', e.target.value as ResourceType)}
                        className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded px-1 py-1 focus:outline-none max-w-[120px]"
                    >
                        {resourceTypes.map(rt => <option key={rt.type} value={rt.type}>{rt.label}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Qty:</span>
                    <input 
                        type="number" 
                        value={item.amount}
                        onChange={(e) => handleUpdateItem(section, idx, 'amount', parseFloat(e.target.value))}
                        className={`w-16 bg-transparent border-b border-slate-600 text-sm text-white focus:outline-none pb-1 text-right ${section === 'inputs' ? 'focus:border-indigo-400' : 'focus:border-emerald-400'}`}
                        min="0"
                    />
                    
                    {/* Unit Dropdown */}
                    <select
                         value={item.unit || ''}
                         onChange={(e) => handleUpdateItem(section, idx, 'unit', e.target.value)}
                         className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded px-1 py-1 focus:outline-none w-20"
                    >
                        {units.map(u => (
                            <option key={u.key} value={u.key}>{u.key}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Box className="w-6 h-6 text-indigo-400" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-white">
                    {mode === 'prefab' ? 'Create New Machine' : (submitLabel === 'Save Machine' ? 'Edit Machine' : 'Configure Machine')}
                </h2>
                <p className="text-sm text-slate-400">
                    {mode === 'prefab' ? 'Define a new machine type for your library' : 'Define process parameters and I/O'}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* Machine Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Machine Name</label>
            <input 
              type="text" 
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              placeholder="e.g. Electric Furnace"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Inputs */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Inputs</h3>
                <button onClick={() => handleAddItem('inputs')} className="text-xs flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors">
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="space-y-3">
                {recipe.inputs.map((item, idx) => renderItemRow(item, idx, 'inputs'))}
                {recipe.inputs.length === 0 && <div className="text-xs text-slate-500 italic text-center py-4">No inputs (Generator)</div>}
              </div>
            </div>

            {/* Outputs */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Outputs</h3>
                <button onClick={() => handleAddItem('outputs')} className="text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded transition-colors">
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="space-y-3">
                {recipe.outputs.map((item, idx) => renderItemRow(item, idx, 'outputs'))}
                {recipe.outputs.length === 0 && <div className="text-xs text-slate-500 italic text-center py-4">No outputs (Sink)</div>}
              </div>
            </div>
          </div>

          {/* Processing Time */}
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
            <div className="p-2 bg-blue-500/20 rounded-full">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-300 block mb-1">Processing Time</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={recipe.processTime}
                  onChange={(e) => setRecipe(prev => ({ ...prev, processTime: parseFloat(e.target.value) }))}
                  className="w-24 bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  min="0.05"
                  step="0.05"
                />
                <select
                    value={recipe.processTimeUnit || 'seconds'}
                    onChange={(e) => setRecipe(prev => ({ ...prev, processTimeUnit: e.target.value as TimeUnit }))}
                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none"
                >
                    <option value="seconds">Seconds</option>
                    <option value="ticks">Ticks (1/20s)</option>
                </select>
              </div>
            </div>
            <div className="text-right text-slate-400 text-sm">
              Rate: <span className="text-white font-mono font-bold">{calculateRate().toFixed(2)}</span> ops/sec
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3">
          {onDelete && (
             <button 
                onClick={onDelete} 
                className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-900/20 border border-red-500/20 hover:border-red-500/50 transition-colors mr-auto flex items-center gap-2 text-sm"
             >
                <Trash2 size={16} /> Delete
             </button>
          )}

          {onExport && (
             <button 
                onClick={onExport} 
                className="px-4 py-2 rounded-lg text-emerald-400 hover:bg-emerald-900/20 border border-emerald-500/20 hover:border-emerald-500/50 transition-colors mr-auto flex items-center gap-2 text-sm"
             >
                <Share2 size={16} /> Share Code
             </button>
          )}

          {mode === 'node' && !onDelete && (
              <button onClick={handleTemplateSave} className="px-4 py-2 rounded-lg text-indigo-300 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/60 transition-colors mr-auto flex items-center gap-2 text-sm">
                <Copy size={16} /> Save as Template
              </button>
          )}
          
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
            {submitLabel || (mode === 'prefab' ? 'Create Machine' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
};