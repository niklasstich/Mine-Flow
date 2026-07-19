import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, ArrowDownToLine, ArrowUpFromLine, Loader2, Plus } from 'lucide-react';
import { NodeData } from '../types';
import { GtnhIcon } from './GtnhIcon';
import { getVoltageTierName, getVoltageTierBaseVoltage } from '../services/unitDictionary';
import {
  fetchGtnhManifest,
  fetchGtnhCatalog,
  searchGoods,
  getRecipesForGoods,
  groupRecipesByType,
  resolveRecipeIoGoods,
  createNodeFromGtnhRecipe,
  RecipeIoType,
  GtnhCatalog,
  GoodsSearchResult,
  PortableRecipe,
} from '../services/gtnhCatalog';

interface GtnhBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (node: NodeData) => void;
  spawnPosition: { x: number; y: number };
}

const btnClass = "bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono";

function useGtnhCatalog(isOpen: boolean) {
  const [catalog, setCatalog] = useState<GtnhCatalog | null>(null);
  const [atlasUrl, setAtlasUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || catalog || loading) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const manifest = await fetchGtnhManifest();
        const version = Object.keys(manifest.versions)[0];
        if (!version) throw new Error('No GTNH data versions available.');
        const loaded = await fetchGtnhCatalog(version);
        setCatalog(loaded);
        setAtlasUrl(`${import.meta.env.BASE_URL}gtnh-data/${version}/${manifest.versions[version].atlasFile}`);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load GTNH data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, catalog, loading]);

  return { catalog, atlasUrl, loading, error };
}

export const GtnhBrowserDialog: React.FC<GtnhBrowserDialogProps> = ({ isOpen, onClose, onAddNode, spawnPosition }) => {
  const { catalog, atlasUrl, loading, error } = useGtnhCatalog(isOpen);

  const [query, setQuery] = useState('');
  const [hideUnproducible, setHideUnproducible] = useState(true);
  const [selectedGoods, setSelectedGoods] = useState<GoodsSearchResult | null>(null);
  const [direction, setDirection] = useState<'production' | 'consumption'>('production');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<PortableRecipe | null>(null);
  const [substitutions, setSubstitutions] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedGoods(null);
      setSelectedRecipe(null);
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    if (!catalog) return [];
    return searchGoods(catalog, query, { hideUnproducible });
  }, [catalog, query, hideUnproducible]);

  const recipesForGoods = useMemo(() => {
    if (!catalog || !selectedGoods) return [];
    return getRecipesForGoods(catalog, selectedGoods.id, selectedGoods.kind, direction);
  }, [catalog, selectedGoods, direction]);

  const groupedRecipes = useMemo(() => groupRecipesByType(recipesForGoods), [recipesForGoods]);
  const typeNames = useMemo(() => Array.from(groupedRecipes.keys()).sort(), [groupedRecipes]);

  useEffect(() => {
    setSelectedRecipe(null);
    setActiveType(typeNames[0] ?? null);
  }, [selectedGoods, direction, typeNames.join('|')]);

  useEffect(() => {
    setSubstitutions({});
  }, [selectedRecipe?.id]);

  if (!isOpen) return null;

  const activeRecipes = activeType ? groupedRecipes.get(activeType) ?? [] : [];

  const handleSelectGoods = (goods: GoodsSearchResult) => {
    setSelectedGoods(goods);
  };

  const handleAdd = () => {
    if (!catalog || !selectedRecipe) return;
    const node = createNodeFromGtnhRecipe(catalog, selectedRecipe, {
      x: spawnPosition.x,
      y: spawnPosition.y,
      substitutions,
    });
    onAddNode(node);
    onClose();
  };

  const Icon: React.FC<{ iconId: number; size?: number; title?: string; className?: string }> = ({ iconId, size = 24, title, className }) => {
    if (!atlasUrl) return <div style={{ width: size, height: size }} className={className} />;
    return <GtnhIcon atlasUrl={atlasUrl} iconId={iconId} size={size} title={title} className={className} />;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150]">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="p-3 border-b-2 border-[#555] flex justify-between items-center bg-[#333]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 border border-[#555] bg-[#2a2a2a] text-[#4ade80]">
              <Search size={18} />
            </div>
            <h2 className="text-lg font-bold text-[#eee]">Browse GTNH Recipes</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#555] text-[#aaa] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center gap-2 text-[#aaa] text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading GTNH catalog (182k recipes)...
          </div>
        )}
        {error && (
          <div className="flex-1 flex items-center justify-center text-[#FF5555] text-sm p-4 text-center">{error}</div>
        )}

        {catalog && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: search + goods grid */}
            <div className="w-72 border-r-2 border-[#555] flex flex-col bg-[#1a1a1a]">
              <div className="p-2 border-b border-[#444] space-y-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search items & fluids..."
                  className="w-full bg-[#111] border border-[#555] px-2 py-1.5 text-xs text-[#eee] focus:outline-none focus:border-[#aaa]"
                />
                <label className="flex items-center gap-1.5 text-[10px] text-[#aaa] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideUnproducible}
                    onChange={(e) => setHideUnproducible(e.target.checked)}
                    className="accent-[#4ade80]"
                  />
                  Hide items with no crafting recipe
                </label>
              </div>
              <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                {query.trim() === '' && (
                  <div className="text-center text-[#666] text-xs py-6 px-2">Type to search {catalog.counts.items.toLocaleString()} items / {catalog.counts.fluids.toLocaleString()} fluids.</div>
                )}
                {query.trim() !== '' && searchResults.length === 0 && (
                  <div className="text-center text-[#666] text-xs py-6 px-2">No matches.</div>
                )}
                {searchResults.map((g) => (
                  <button
                    key={`${g.kind}-${g.id}`}
                    onClick={() => handleSelectGoods(g)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${selectedGoods?.id === g.id ? 'bg-[#2a4a2a] text-[#eee]' : 'text-[#ccc] hover:bg-[#2a2a2a]'}`}
                  >
                    <Icon iconId={g.iconId} size={20} />
                    <span className="flex flex-col flex-1 min-w-0">
                      <span className="truncate">{g.name}</span>
                      <span className="text-[9px] uppercase text-[#777] truncate">{g.mod}</span>
                    </span>
                    <span className="text-[9px] uppercase text-[#777]">{g.kind}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: recipe browser */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedGoods && (
                <div className="flex-1 flex items-center justify-center text-[#666] text-sm">
                  Search and pick an item or fluid to see its recipes.
                </div>
              )}

              {selectedGoods && (
                <>
                  <div className="p-2 border-b border-[#444] flex items-center gap-3 bg-[#242424]">
                    <Icon iconId={selectedGoods.iconId} size={24} />
                    <span className="text-sm font-bold text-[#eee] flex-1">
                      {selectedGoods.name} <span className="text-[10px] font-normal text-[#777]">({selectedGoods.mod})</span>
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDirection('production')}
                        className={`text-[10px] px-2 py-1 flex items-center gap-1 border ${direction === 'production' ? 'bg-[#2a4a2a] border-[#4ade80] text-[#eee]' : 'border-[#555] text-[#aaa] hover:bg-[#333]'}`}
                        title="Recipes that produce this"
                      >
                        <ArrowDownToLine size={11} /> Made by
                      </button>
                      <button
                        onClick={() => setDirection('consumption')}
                        className={`text-[10px] px-2 py-1 flex items-center gap-1 border ${direction === 'consumption' ? 'bg-[#2a4a2a] border-[#4ade80] text-[#eee]' : 'border-[#555] text-[#aaa] hover:bg-[#333]'}`}
                        title="Recipes that consume this"
                      >
                        <ArrowUpFromLine size={11} /> Used by
                      </button>
                    </div>
                  </div>

                  {typeNames.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-[#666] text-sm">
                      No {direction === 'production' ? 'production' : 'consumption'} recipes found.
                    </div>
                  )}

                  {typeNames.length > 0 && (
                    <div className="flex flex-1 overflow-hidden">
                      {/* RecipeType tabs */}
                      <div className="w-48 border-r border-[#444] overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                        {typeNames.map((t) => (
                          <button
                            key={t}
                            onClick={() => setActiveType(t)}
                            className={`w-full text-left px-2 py-1.5 text-[11px] border-b border-[#333] transition-colors ${activeType === t ? 'bg-[#2a4a2a] text-[#eee]' : 'text-[#ccc] hover:bg-[#2a2a2a]'}`}
                          >
                            {t} <span className="text-[#777]">({groupedRecipes.get(t)?.length})</span>
                          </button>
                        ))}
                      </div>

                      {/* Recipe list + detail */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {activeRecipes.map((r) => (
                          <RecipeRow
                            key={r.id}
                            recipe={r}
                            catalog={catalog}
                            Icon={Icon}
                            expanded={selectedRecipe?.id === r.id}
                            onToggle={() => setSelectedRecipe(selectedRecipe?.id === r.id ? null : r)}
                            substitutions={substitutions}
                            setSubstitutions={setSubstitutions}
                            onAdd={handleAdd}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface RecipeRowProps {
  recipe: PortableRecipe;
  catalog: GtnhCatalog;
  Icon: React.FC<{ iconId: number; size?: number; title?: string; className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  substitutions: Record<number, string>;
  setSubstitutions: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onAdd: () => void;
}

const RecipeRow: React.FC<RecipeRowProps> = ({ recipe, catalog, Icon, expanded, onToggle, substitutions, setSubstitutions, onAdd }) => {
  const inputs = recipe.items.filter((io) => io.type === RecipeIoType.ItemInput || io.type === RecipeIoType.FluidInput || io.type === RecipeIoType.OreDictInput);
  const outputs = recipe.items.filter((io) => io.type === RecipeIoType.ItemOutput || io.type === RecipeIoType.FluidOutput);
  const tierName = recipe.gt ? getVoltageTierName(recipe.gt.voltageTier) : null;
  const baseVoltage = recipe.gt ? getVoltageTierBaseVoltage(recipe.gt.voltageTier) : null;

  return (
    <div className={`border ${expanded ? 'border-[#4ade80]' : 'border-[#3a3a3a]'} bg-[#242424]`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2 text-left hover:bg-[#2a2a2a] transition-colors">
        <div className="flex items-center gap-0.5">
          {inputs.slice(0, 4).map((io, i) => (
            <IoIcon key={i} io={io} catalog={catalog} Icon={Icon} />
          ))}
        </div>
        <span className="text-[#666] text-xs">&rarr;</span>
        <div className="flex items-center gap-0.5">
          {outputs.slice(0, 4).map((io, i) => (
            <IoIcon key={i} io={io} catalog={catalog} Icon={Icon} />
          ))}
        </div>
        <div className="flex-1" />
        {tierName && <span className="text-[10px] text-[#aaa]">{tierName} ({baseVoltage} EU/t)</span>}
        {recipe.gt && <span className="text-[10px] text-[#777]">{(recipe.gt.durationTicks / 20).toFixed(1)}s</span>}
      </button>

      {expanded && (
        <div className="p-3 border-t border-[#3a3a3a] space-y-3 bg-[#1e1e1e]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase text-[#777] mb-1">Inputs</div>
              <div className="space-y-1">
                {inputs.map((io, idx) => {
                  const globalIdx = recipe.items.indexOf(io);
                  return (
                    <IoRow
                      key={idx}
                      io={io}
                      slotIndex={globalIdx}
                      catalog={catalog}
                      Icon={Icon}
                      substitutions={substitutions}
                      setSubstitutions={setSubstitutions}
                    />
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#777] mb-1">Outputs</div>
              <div className="space-y-1">
                {outputs.map((io, idx) => {
                  const globalIdx = recipe.items.indexOf(io);
                  return (
                    <IoRow
                      key={idx}
                      io={io}
                      slotIndex={globalIdx}
                      catalog={catalog}
                      Icon={Icon}
                      substitutions={substitutions}
                      setSubstitutions={setSubstitutions}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onAdd} className={`${btnClass} px-4 py-1.5 text-xs flex items-center gap-2`}>
              <Plus size={14} /> Add to Canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const IoIcon: React.FC<{ io: PortableRecipe['items'][number]; catalog: GtnhCatalog; Icon: RecipeRowProps['Icon'] }> = ({ io, catalog, Icon }) => {
  const resolved = resolveRecipeIoGoods(catalog, io);
  if (!resolved) return null;
  const iconId = resolved.kind === 'oreDict' ? catalog.itemsById.get(resolved.goods.itemIds[0])?.iconId ?? 0 : resolved.goods.iconId;
  const name = resolved.kind === 'oreDict' ? `[Ore Dict] ${resolved.goods.id}` : resolved.goods.name;
  return <Icon iconId={iconId} size={20} title={name} />;
};

const IoRow: React.FC<{
  io: PortableRecipe['items'][number];
  slotIndex: number;
  catalog: GtnhCatalog;
  Icon: RecipeRowProps['Icon'];
  substitutions: Record<number, string>;
  setSubstitutions: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}> = ({ io, slotIndex, catalog, Icon, substitutions, setSubstitutions }) => {
  const resolved = resolveRecipeIoGoods(catalog, io);
  if (!resolved) return null;

  if (resolved.kind === 'oreDict') {
    const chosenId = substitutions[slotIndex] ?? resolved.goods.itemIds[0];
    const chosenItem = catalog.itemsById.get(chosenId);
    return (
      <div className="flex items-center gap-2 text-xs text-[#ddd]">
        <Icon iconId={chosenItem?.iconId ?? 0} size={20} />
        <select
          value={chosenId}
          onChange={(e) => setSubstitutions((prev) => ({ ...prev, [slotIndex]: e.target.value }))}
          className="flex-1 bg-[#111] border border-[#555] text-[#eee] text-[11px] px-1 py-0.5"
        >
          {resolved.goods.itemIds.map((id) => (
            <option key={id} value={id}>
              {catalog.itemsById.get(id)?.name ?? id}
            </option>
          ))}
        </select>
        <span className="text-[#888]">x{io.amount}</span>
      </div>
    );
  }

  const name = resolved.kind === 'item' ? resolved.goods.name : `${resolved.goods.name} (Fluid)`;
  const amount = resolved.kind === 'fluid' ? `${io.amount}mB` : `x${io.amount}`;

  return (
    <div className="flex items-center gap-2 text-xs text-[#ddd]">
      <Icon iconId={resolved.goods.iconId} size={20} />
      <span className="flex-1 truncate">{name}</span>
      <span className="text-[#888]">{amount}</span>
      {io.probability < 1 && <span className="text-[10px] text-[#facc15]">{(io.probability * 100).toFixed(1)}%</span>}
    </div>
  );
};
