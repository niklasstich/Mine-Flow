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

  // Styles
  const inputClass = "bg-[#111] border border-[#555] text-sm text-[#eee] px-2 py-1 focus:outline-none focus:border-[#aaa] font-mono";
  const btnClass = "bg-[#3a3a3a] border border-[#555] hover:bg-[#4a4a4a] hover:border-[#fff] text-[#eee] px-3 py-1 font-mono text-xs transition-colors flex items-center gap-2";

  const renderItemRow = (item: ItemStack, idx: number, section: 'inputs' | 'outputs') => {
      const units = getUnitsForType(unitDictionary, item.type);
      const resourceTypes = Object.entries(unitDictionary).map(([key, val]) => ({
          type: key,
          label: (val as ResourceDef).label
      }));

      return (
        <div key={item.id} className="flex flex-col gap-2 bg-[#2a2a2a] p-2 border border-[#444]">
            <div className="flex gap-2 items-center">
                <input 
                    type="text" 
                    value={item.name}
                    onChange={(e) => handleUpdateItem(section, idx, 'name', e.target.value)}
                    className={`flex-1 ${inputClass}`}
                    placeholder="Item Name"
                />
                <button onClick={() => handleRemoveItem(section, idx)} className="text-[#FF5555] hover:text-red-400 p-1">
                    <Trash2 size={14} />
                </button>
            </div>
            
            <div className="flex gap-2 items-center justify-between flex-wrap">
                <div className="flex items-center gap-2">
                    <select 
                        value={item.type || 'item'}
                        onChange={(e) => handleUpdateItem(section, idx, 'type', e.target.value as ResourceType)}
                        className={`${inputClass} max-w-[120px]`}
                    >
                        {resourceTypes.map(rt => <option key={rt.type} value={rt.type}>{rt.label}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-[#888] font-mono">Qty:</span>
                    <input 
                        type="number" 
                        value={item.amount}
                        onChange={(e) => handleUpdateItem(section, idx, 'amount', parseFloat(e.target.value))}
                        className={`w-16 ${inputClass} text-right`}
                        min="0"
                    />
                    
                    <select
                         value={item.unit || ''}
                         onChange={(e) => handleUpdateItem(section, idx, 'unit', e.target.value)}
                         className={`${inputClass} w-20`}
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="p-3 border-b-2 border-[#555] flex justify-between items-center bg-[#333]">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-[#444] border border-[#555]">
                <Box className="w-5 h-5 text-[#aaa]" />
             </div>
             <div>
                <h2 className="text-lg font-bold text-[#eee]">
                    {mode === 'prefab' ? 'Create New Machine' : (submitLabel === 'Save Machine' ? 'Edit Machine' : 'Configure Machine')}
                </h2>
             </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#555] text-[#aaa] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          
          {/* Machine Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#aaa] uppercase tracking-wider">Machine Name</label>
            <input 
              type="text" 
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={`w-full ${inputClass} p-2 text-base`}
              placeholder="e.g. Electric Furnace"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-[#444] pb-1">
                <h3 className="text-xs font-bold text-[#aaa] uppercase">Inputs</h3>
                <button onClick={() => handleAddItem('inputs')} className="text-[#55FF55] hover:text-white text-xs flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {recipe.inputs.map((item, idx) => renderItemRow(item, idx, 'inputs'))}
                {recipe.inputs.length === 0 && <div className="text-xs text-[#555] italic text-center py-4 border border-dashed border-[#444]">No inputs (Generator)</div>}
              </div>
            </div>

            {/* Outputs */}
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-[#444] pb-1">
                <h3 className="text-xs font-bold text-[#aaa] uppercase">Outputs</h3>
                <button onClick={() => handleAddItem('outputs')} className="text-[#55FF55] hover:text-white text-xs flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {recipe.outputs.map((item, idx) => renderItemRow(item, idx, 'outputs'))}
                {recipe.outputs.length === 0 && <div className="text-xs text-[#555] italic text-center py-4 border border-dashed border-[#444]">No outputs (Sink)</div>}
              </div>
            </div>
          </div>

          {/* Processing Time */}
          <div className="bg-[#2a2a2a] p-3 border border-[#444] flex items-center gap-4">
            <div className="p-2 bg-[#333] border border-[#444]">
              <Clock className="w-5 h-5 text-[#aaa]" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-[#aaa] uppercase block mb-1">Processing Time</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={recipe.processTime}
                  onChange={(e) => setRecipe(prev => ({ ...prev, processTime: parseFloat(e.target.value) }))}
                  className={`w-24 ${inputClass}`}
                  min="0.05"
                  step="0.05"
                />
                <select
                    value={recipe.processTimeUnit || 'seconds'}
                    onChange={(e) => setRecipe(prev => ({ ...prev, processTimeUnit: e.target.value as TimeUnit }))}
                    className={inputClass}
                >
                    <option value="seconds">Seconds</option>
                    <option value="ticks">Ticks (1/20s)</option>
                </select>
              </div>
            </div>
            <div className="text-right text-[#888] text-xs">
              Rate: <span className="text-[#eee] font-bold">{calculateRate().toFixed(2)}</span> ops/sec
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[#555] bg-[#333] flex justify-end gap-2">
          {onDelete && (
             <button 
                onClick={onDelete} 
                className={`${btnClass} text-[#FF5555] border-[#FF5555]/30 hover:bg-[#FF5555]/20 mr-auto`}
             >
                <Trash2 size={14} /> Delete
             </button>
          )}

          {onExport && (
             <button 
                onClick={onExport} 
                className={`${btnClass} text-[#55FF55] border-[#55FF55]/30 hover:bg-[#55FF55]/20 mr-auto`}
             >
                <Share2 size={14} /> Share
             </button>
          )}

          {mode === 'node' && !onDelete && (
              <button onClick={handleTemplateSave} className={`${btnClass} text-[#55FFFF] border-[#55FFFF]/30 hover:bg-[#55FFFF]/20 mr-auto`}>
                <Copy size={14} /> Save Template
              </button>
          )}
          
          <button onClick={onClose} className={btnClass}>
            Cancel
          </button>
          <button onClick={handleSave} className="bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] text-white px-6 py-1 font-mono text-xs active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] active:bg-[#2a2a2a]">
            {submitLabel || (mode === 'prefab' ? 'Create Machine' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
};