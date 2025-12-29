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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Dictionary Editor
                <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Configure Resource Types</span>
            </h2>
            <div className="flex items-center gap-4">
                <button onClick={handleResetDefaults} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1">
                    <Undo2 size={12}/> Reset Defaults
                </button>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar (Types) */}
            <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
                <div className="p-3 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Resource Types
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {(Object.keys(localDict) as ResourceType[]).map(type => (
                        <div key={type} className="flex items-center group">
                             <button
                                onClick={() => setActiveType(type)}
                                className={`flex-1 text-left px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${activeType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                            >
                                <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: localDict[type].color }} />
                                {localDict[type].label}
                            </button>
                        </div>
                    ))}
                </div>
                
                {/* Add Type Form */}
                <div className="p-3 border-t border-slate-700 bg-slate-900">
                    {isAddingType ? (
                        <div className="space-y-2 animate-in slide-in-from-bottom-2">
                            <input 
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" 
                                placeholder="ID (e.g. magic)" 
                                value={newTypeId}
                                onChange={e => setNewTypeId(e.target.value)}
                            />
                            <input 
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" 
                                placeholder="Label (e.g. Magic)" 
                                value={newTypeLabel}
                                onChange={e => setNewTypeLabel(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button onClick={handleAddType} className="flex-1 bg-indigo-600 text-white text-xs py-1 rounded">Add</button>
                                <button onClick={() => setIsAddingType(false)} className="flex-1 bg-slate-700 text-slate-300 text-xs py-1 rounded">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsAddingType(true)}
                            className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-500 text-xs flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Add Resource Type
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            {currentDef ? (
            <div className="flex-1 overflow-y-auto bg-slate-800/50 flex flex-col">
                
                {/* Type Settings */}
                <div className="p-6 border-b border-slate-700 bg-slate-800">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Settings2Icon className="text-slate-400" size={20}/>
                            Type Settings
                        </h3>
                        <button 
                            onClick={() => handleDeleteType(activeType)}
                            className="text-red-400 hover:bg-red-500/10 px-3 py-1 rounded text-xs flex items-center gap-1 border border-red-500/20"
                        >
                            <Trash2 size={12} /> Delete Type
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1"><LayoutGrid size={12}/> Display Label</label>
                                <input 
                                    type="text" 
                                    value={currentDef.label} 
                                    onChange={(e) => handleUpdateType('label', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1"><Palette size={12}/> Display Color</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={currentDef.color} 
                                        onChange={(e) => handleUpdateType('color', e.target.value)}
                                        className="h-9 w-12 bg-transparent border-0 p-0 cursor-pointer"
                                    />
                                    <input 
                                        type="text"
                                        value={currentDef.color}
                                        onChange={(e) => handleUpdateType('color', e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1"><Target size={12}/> Base Unit ID</label>
                                <input 
                                    type="text" 
                                    value={currentDef.baseUnit} 
                                    onChange={(e) => handleUpdateType('baseUnit', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                                    title="Warning: Changing this requires a matching unit in the units table"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Must match a Unit ID in the table below. This unit is treated as Factor 1.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Units Table */}
                <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Conversion Units</h3>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500 font-bold border-b border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Unit ID</th>
                                    <th className="px-4 py-3">Display Name</th>
                                    <th className="px-4 py-3 text-right">Factor (to Base)</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {Object.entries(currentDef.units).map(([key, rawUnit]) => {
                                    const unit = rawUnit as UnitDef;
                                    const isBase = key === currentDef.baseUnit;
                                    return (
                                    <tr key={key} className={`hover:bg-slate-800/50 transition-colors ${isBase ? 'bg-indigo-900/20' : ''}`}>
                                        <td className="px-4 py-3 font-mono text-indigo-300">
                                            {key} {isBase && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 rounded ml-2">BASE</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="text" 
                                                value={unit.label}
                                                onChange={(e) => handleUpdateUnit(key, 'label', e.target.value)}
                                                className="bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none w-full"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {isBase ? (
                                                <span className="text-slate-500">1.000</span>
                                            ) : (
                                                <input 
                                                    type="number" 
                                                    value={unit.factor}
                                                    onChange={(e) => handleUpdateUnit(key, 'factor', parseFloat(e.target.value))}
                                                    className="bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none w-24 text-right"
                                                    step="0.001"
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!isBase && (
                                                <button onClick={() => handleDeleteUnit(key)} className="text-slate-600 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )})}
                                
                                {/* Add Row */}
                                <tr className="bg-slate-950/50">
                                    <td className="px-4 py-3">
                                        <input 
                                            type="text" 
                                            value={newKey} 
                                            onChange={(e) => setNewKey(e.target.value)}
                                            placeholder="ID (e.g. kFE)"
                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-full focus:outline-none focus:border-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="text" 
                                            value={newLabel} 
                                            onChange={(e) => setNewLabel(e.target.value)}
                                            placeholder="Name (e.g. Kilo Forge Energy)"
                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-full focus:outline-none focus:border-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <input 
                                            type="number" 
                                            value={newFactor} 
                                            onChange={(e) => setNewFactor(parseFloat(e.target.value))}
                                            placeholder="1.0"
                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-24 text-right focus:outline-none focus:border-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={handleAddUnit}
                                            disabled={!newKey || !newLabel}
                                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded p-1"
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
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    Select a resource type to edit
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => { onSave(localDict); onClose(); }} 
            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Save size={18} />
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