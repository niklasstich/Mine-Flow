import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Undo2, LayoutGrid, Palette, Target } from 'lucide-react';
import { UnitDictionary, ResourceType, UnitDef, ResourceDef } from '../types';
import { DEFAULT_UNIT_DICTIONARY } from '../services/unitDictionary';
import { ConfirmationDialog } from './ConfirmationDialog';

interface DictionaryEditorProps {
  dictionary: UnitDictionary;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newDict: UnitDictionary) => void;
}

export const DictionaryEditor: React.FC<DictionaryEditorProps> = ({ dictionary, isOpen, onClose, onSave }) => {
  const [localDict, setLocalDict] = useState<UnitDictionary>(JSON.parse(JSON.stringify(dictionary)));
  const [activeType, setActiveType] = useState<ResourceType>(Object.keys(dictionary)[0] || '');
  
  // New Type State
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeId, setNewTypeId] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');

  // New Unit State
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newFactor, setNewFactor] = useState(1);
  
  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
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

  if (!isOpen) return null;

  // --- Type Management ---

  const handleAddType = () => {
      if (!newTypeId || !newTypeLabel) return;
      if (localDict[newTypeId]) {
          alert("Type ID already exists");
          return;
      }
      
      const newType: ResourceDef = {
          label: newTypeLabel,
          baseUnit: 'count',
          color: '#ffffff',
          units: {
              'count': { label: 'Count', factor: 1 }
          }
      };

      setLocalDict(prev => ({ ...prev, [newTypeId]: newType }));
      setActiveType(newTypeId);
      setIsAddingType(false);
      setNewTypeId('');
      setNewTypeLabel('');
  };

  const handleDeleteType = (typeId: string) => {
      if (Object.keys(localDict).length <= 1) {
          alert("Cannot delete the last type.");
          return;
      }
      
      setConfirmState({
          isOpen: true,
          title: "Delete Resource Type",
          message: `Are you sure you want to delete "${localDict[typeId].label}"? Any machines using this type may stop working correctly.`,
          onConfirm: () => {
              const newDict = { ...localDict };
              delete newDict[typeId];
              setLocalDict(newDict);
              if (activeType === typeId) {
                  setActiveType(Object.keys(newDict)[0]);
              }
              setConfirmState(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleUpdateType = (field: keyof ResourceDef, value: any) => {
      setLocalDict(prev => ({
          ...prev,
          [activeType]: {
              ...prev[activeType],
              [field]: value
          }
      }));
  };

  // --- Unit Management ---

  const handleUpdateUnit = (key: string, field: 'label' | 'factor', value: any) => {
    setLocalDict(prev => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        units: {
          ...prev[activeType].units,
          [key]: {
            ...prev[activeType].units[key],
            [field]: value
          }
        }
      }
    }));
  };

  const handleDeleteUnit = (key: string) => {
    if (key === localDict[activeType].baseUnit) {
        alert("Cannot delete the base unit.");
        return;
    }
    const newUnits = { ...localDict[activeType].units };
    delete newUnits[key];
    setLocalDict(prev => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        units: newUnits
      }
    }));
  };

  const handleAddUnit = () => {
    if (!newKey || !newLabel) return;
    if (localDict[activeType].units[newKey]) {
        alert("Unit Key already exists");
        return;
    }

    setLocalDict(prev => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        units: {
          ...prev[activeType].units,
          [newKey]: {
            label: newLabel,
            factor: newFactor
          }
        }
      }
    }));

    // Reset
    setNewKey('');
    setNewLabel('');
    setNewFactor(1);
  };

  const handleResetDefaults = () => {
      setConfirmState({
          isOpen: true,
          title: "Reset Dictionary",
          message: "Are you sure you want to reset the dictionary to defaults? All custom resource types and units will be lost.",
          onConfirm: () => {
              const defaults = JSON.parse(JSON.stringify(DEFAULT_UNIT_DICTIONARY));
              setLocalDict(defaults);
              setActiveType(Object.keys(defaults)[0]);
              setConfirmState(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const currentDef = localDict[activeType];
  const btnClass = "bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono px-3 py-1 text-xs flex items-center gap-2";
  const inputClass = "bg-[#111] border border-[#555] text-[#eee] focus:outline-none focus:border-[#aaa] font-mono text-xs px-2 py-1";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110]">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative font-mono">
        
        {/* Header */}
        <div className="p-3 border-b-2 border-[#555] bg-[#333] flex justify-between items-center">
            <h2 className="text-lg font-bold text-[#eee] flex items-center gap-2">
                Dictionary Editor
                <span className="text-[10px] font-normal text-[#aaa] bg-[#222] px-2 py-0.5 border border-[#444]">Configure Resource Types</span>
            </h2>
            <div className="flex items-center gap-4">
                <button onClick={handleResetDefaults} className="text-xs text-[#777] hover:text-[#FF5555] flex items-center gap-1 transition-colors">
                    <Undo2 size={12}/> Reset Defaults
                </button>
                <button onClick={onClose} className="p-1 hover:bg-[#444] text-[#aaa] hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar (Types) */}
            <div className="w-64 bg-[#1a1a1a] border-r-2 border-[#555] flex flex-col">
                <div className="p-3 border-b-2 border-[#444] text-xs font-bold text-[#777] uppercase tracking-wider bg-[#252525]">
                    Resource Types
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {(Object.keys(localDict) as ResourceType[]).map(type => (
                        <div key={type} className="flex items-center group">
                             <button
                                onClick={() => setActiveType(type)}
                                className={`flex-1 text-left px-3 py-2 text-xs font-bold transition-colors flex items-center gap-2 border ${activeType === type ? 'bg-[#333] text-white border-[#777]' : 'border-transparent text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc]'}`}
                            >
                                <div className="w-3 h-3 border border-white/20 shadow-sm" style={{ backgroundColor: localDict[type].color }} />
                                {localDict[type].label}
                            </button>
                        </div>
                    ))}
                </div>
                
                {/* Add Type Form */}
                <div className="p-3 border-t-2 border-[#444] bg-[#222]">
                    {isAddingType ? (
                        <div className="space-y-2">
                            <input 
                                className={`w-full ${inputClass}`}
                                placeholder="ID (e.g. magic)" 
                                value={newTypeId}
                                onChange={e => setNewTypeId(e.target.value)}
                            />
                            <input 
                                className={`w-full ${inputClass}`} 
                                placeholder="Label (e.g. Magic)" 
                                value={newTypeLabel}
                                onChange={e => setNewTypeLabel(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button onClick={handleAddType} className={`${btnClass} flex-1 justify-center`}>Add</button>
                                <button onClick={() => setIsAddingType(false)} className="bg-[#222] border border-[#444] hover:bg-[#333] text-[#aaa] text-xs px-2 py-1 flex-1 text-center">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsAddingType(true)}
                            className="w-full py-2 border border-dashed border-[#555] text-[#777] hover:text-[#eee] hover:border-[#aaa] text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                            <Plus size={14} /> Add Resource Type
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            {currentDef ? (
            <div className="flex-1 overflow-y-auto bg-[#212121] flex flex-col custom-scrollbar">
                
                {/* Type Settings */}
                <div className="p-6 border-b-2 border-[#333] bg-[#2a2a2a]">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-base font-bold text-[#eee] flex items-center gap-2">
                            <Settings2Icon className="text-[#aaa]" size={16}/>
                            Type Settings
                        </h3>
                        <button 
                            onClick={() => handleDeleteType(activeType)}
                            className="text-[#FF5555] hover:bg-[#FF5555]/10 px-3 py-1 border border-[#FF5555]/30 text-xs flex items-center gap-1 transition-colors"
                        >
                            <Trash2 size={12} /> Delete Type
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-[#888] block mb-1 flex items-center gap-1 uppercase font-bold"><LayoutGrid size={12}/> Display Label</label>
                                <input 
                                    type="text" 
                                    value={currentDef.label} 
                                    onChange={(e) => handleUpdateType('label', e.target.value)}
                                    className={`w-full ${inputClass} p-2`}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#888] block mb-1 flex items-center gap-1 uppercase font-bold"><Palette size={12}/> Display Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={currentDef.color} 
                                        onChange={(e) => handleUpdateType('color', e.target.value)}
                                        className="h-8 w-8 bg-transparent border border-[#555] p-0 cursor-pointer"
                                    />
                                    <input 
                                        type="text"
                                        value={currentDef.color}
                                        onChange={(e) => handleUpdateType('color', e.target.value)}
                                        className={`flex-1 ${inputClass} p-2`}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label className="text-xs text-[#888] block mb-1 flex items-center gap-1 uppercase font-bold"><Target size={12}/> Base Unit ID</label>
                                <input 
                                    type="text" 
                                    value={currentDef.baseUnit} 
                                    onChange={(e) => handleUpdateType('baseUnit', e.target.value)}
                                    className={`w-full ${inputClass} p-2`}
                                    title="Warning: Changing this requires a matching unit in the units table"
                                />
                                <p className="text-[10px] text-[#666] mt-1 border-l-2 border-[#444] pl-2">
                                    Must match a Unit ID in the table below. This unit is treated as Factor 1.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Units Table */}
                <div className="p-6">
                    <h3 className="text-base font-bold text-[#eee] mb-4">Conversion Units</h3>
                    <div className="bg-[#111] border border-[#444]">
                        <table className="w-full text-left text-xs text-[#ccc]">
                            <thead className="bg-[#333] text-[#aaa] font-bold border-b border-[#444]">
                                <tr>
                                    <th className="px-4 py-2 border-r border-[#444]">Unit ID</th>
                                    <th className="px-4 py-2 border-r border-[#444]">Display Name</th>
                                    <th className="px-4 py-2 text-right border-r border-[#444]">Factor (to Base)</th>
                                    <th className="px-4 py-2 text-center w-16">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333]">
                                {Object.entries(currentDef.units).map(([key, rawUnit]) => {
                                    const unit = rawUnit as UnitDef;
                                    const isBase = key === currentDef.baseUnit;
                                    return (
                                    <tr key={key} className={`hover:bg-[#222] transition-colors ${isBase ? 'bg-[#2a2a2a]' : ''}`}>
                                        <td className="px-4 py-2 border-r border-[#333] font-bold text-[#ddd]">
                                            {key} {isBase && <span className="text-[10px] bg-[#444] text-[#aaa] px-1 ml-2 border border-[#555]">BASE</span>}
                                        </td>
                                        <td className="px-4 py-2 border-r border-[#333]">
                                            <input 
                                                type="text" 
                                                value={unit.label}
                                                onChange={(e) => handleUpdateUnit(key, 'label', e.target.value)}
                                                className="bg-transparent border-b border-transparent focus:border-[#aaa] focus:outline-none w-full text-[#ccc]"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right border-r border-[#333]">
                                            {isBase ? (
                                                <span className="text-[#666]">1.000</span>
                                            ) : (
                                                <input 
                                                    type="number" 
                                                    value={unit.factor}
                                                    onChange={(e) => handleUpdateUnit(key, 'factor', parseFloat(e.target.value))}
                                                    className="bg-transparent border-b border-transparent focus:border-[#aaa] focus:outline-none w-full text-right text-[#ccc]"
                                                    step="0.001"
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {!isBase && (
                                                <button onClick={() => handleDeleteUnit(key)} className="text-[#666] hover:text-[#FF5555] transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )})}
                                
                                {/* Add Row */}
                                <tr className="bg-[#1a1a1a]">
                                    <td className="px-4 py-2 border-r border-[#333]">
                                        <input 
                                            type="text" 
                                            value={newKey} 
                                            onChange={(e) => setNewKey(e.target.value)}
                                            placeholder="ID"
                                            className={`w-full ${inputClass}`}
                                        />
                                    </td>
                                    <td className="px-4 py-2 border-r border-[#333]">
                                        <input 
                                            type="text" 
                                            value={newLabel} 
                                            onChange={(e) => setNewLabel(e.target.value)}
                                            placeholder="Name"
                                            className={`w-full ${inputClass}`}
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right border-r border-[#333]">
                                        <input 
                                            type="number" 
                                            value={newFactor} 
                                            onChange={(e) => setNewFactor(parseFloat(e.target.value))}
                                            placeholder="1.0"
                                            className={`w-full ${inputClass} text-right`}
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button 
                                            onClick={handleAddUnit}
                                            disabled={!newKey || !newLabel}
                                            className="text-[#55FF55] hover:text-white disabled:opacity-30 disabled:hover:text-[#55FF55]"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-[#555] bg-[#212121]">
                    Select a resource type to edit
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#555] bg-[#333] flex justify-end gap-3">
          <button onClick={onClose} className="bg-[#3a3a3a] border border-[#555] hover:bg-[#4a4a4a] text-[#eee] px-4 py-1.5 text-xs">
            Cancel
          </button>
          <button 
            onClick={() => { onSave(localDict); onClose(); }} 
            className={btnClass}
          >
            <Save size={14} />
            Save Dictionary
          </button>
        </div>

        <ConfirmationDialog 
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            confirmLabel="Delete"
            isDestructive={true}
        />
      </div>
    </div>
  );
};

const Settings2Icon = ({size, className}: {size: number, className: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
);