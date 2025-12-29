import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Upload, Clipboard, Check } from 'lucide-react';

interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exportData?: string; // If provided, we are in export mode
  exportTitle?: string;
  onImport?: (dataStr: string) => void; // If provided, we are in import mode
  mode: 'export' | 'import';
  title?: string;
}

export const ImportExportDialog: React.FC<ImportExportDialogProps> = ({ 
  isOpen, onClose, exportData, exportTitle, onImport, mode, title 
}) => {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'export' && exportData) {
        setText(exportData);
      } else {
        setText('');
      }
      setCopied(false);
      setError(null);
    }
  }, [isOpen, exportData, mode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    if (!text.trim()) {
        setError("Please paste a data string");
        return;
    }
    if (onImport) {
        try {
            onImport(text);
            onClose();
        } catch (e) {
            setError("Invalid data string");
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[150] backdrop-blur-[2px]">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg border border-slate-700 ${mode === 'export' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {mode === 'export' ? <Download size={20} /> : <Upload size={20} />}
             </div>
             <div>
                <h2 className="text-lg font-bold text-white">{title || (mode === 'export' ? 'Export Data' : 'Import Data')}</h2>
                <p className="text-xs text-slate-400">
                    {mode === 'export' ? exportTitle || 'Copy this code to share' : 'Paste a MineFlow code below'}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
            <div className="relative">
                <textarea 
                    className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    readOnly={mode === 'export'}
                    placeholder={mode === 'import' ? "Paste MF_DIAGRAM:... or MF_MACHINE:... string here" : ""}
                    spellCheck={false}
                />
                {mode === 'export' && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 hover:text-white transition-all shadow-lg"
                        title="Copy to Clipboard"
                    >
                        {copied ? <Check size={16} className="text-emerald-400"/> : <Copy size={16}/>}
                    </button>
                )}
            </div>

            {error && (
                <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/50 p-2 rounded">
                    {error}
                </div>
            )}
            
            <div className="text-xs text-slate-500 leading-relaxed">
                {mode === 'export' 
                    ? "This code contains your diagram structure or machine recipe. Share it with others to let them import it." 
                    : "Importing will load the diagram or add the machine to your library. Ensure you trust the source."}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-sm">
            Cancel
          </button>
          {mode === 'import' && (
              <button onClick={handleImport} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2">
                <Upload size={16} />
                Load Data
              </button>
          )}
          {mode === 'export' && (
             <button onClick={handleCopy} className={`px-6 py-2 rounded-lg text-white text-sm font-medium shadow-lg active:scale-95 transition-all flex items-center gap-2 ${copied ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}>
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
                {copied ? 'Copied!' : 'Copy Code'}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};