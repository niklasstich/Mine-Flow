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

  const btnClass = "bg-[#3a3a3a] border-2 border-[#1a1a1a] border-t-[#505050] border-l-[#505050] hover:bg-[#4a4a4a] active:bg-[#2a2a2a] active:border-t-[#1a1a1a] active:border-l-[#1a1a1a] transition-colors text-white font-mono px-4 py-1.5 text-xs flex items-center gap-2";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150]">
      <div className="bg-[#212121] border-2 border-[#555] shadow-[4px_4px_0_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="p-3 border-b-2 border-[#555] flex justify-between items-center bg-[#333]">
          <div className="flex items-center gap-3">
             <div className={`p-1.5 border border-[#555] ${mode === 'export' ? 'bg-[#2a2a2a] text-[#55FF55]' : 'bg-[#2a2a2a] text-[#55FFFF]'}`}>
                {mode === 'export' ? <Download size={18} /> : <Upload size={18} />}
             </div>
             <div>
                <h2 className="text-lg font-bold text-[#eee]">{title || (mode === 'export' ? 'Export Data' : 'Import Data')}</h2>
             </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#555] text-[#aaa] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
            <p className="text-xs text-[#aaa]">
                {mode === 'export' ? exportTitle || 'Copy this code to share' : 'Paste a MineFlow code below'}
            </p>

            <div className="relative">
                <textarea 
                    className="w-full h-40 bg-[#111] border border-[#555] p-3 text-xs font-mono text-[#eee] focus:outline-none focus:border-[#aaa] resize-none custom-scrollbar"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    readOnly={mode === 'export'}
                    placeholder={mode === 'import' ? "Paste MF_DIAGRAM:... or MF_MACHINE:... string here" : ""}
                    spellCheck={false}
                />
                {mode === 'export' && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 bg-[#333] hover:bg-[#444] border border-[#555] text-[#eee] transition-all shadow-sm"
                        title="Copy to Clipboard"
                    >
                        {copied ? <Check size={14} className="text-[#55FF55]"/> : <Copy size={14}/>}
                    </button>
                )}
            </div>

            {error && (
                <div className="text-[#FF5555] text-xs bg-[#330000] border border-[#FF5555] p-2">
                    {error}
                </div>
            )}
            
            <div className="text-xs text-[#777] leading-relaxed">
                {mode === 'export' 
                    ? "This code contains your diagram structure or machine recipe. Share it with others to let them import it." 
                    : "Importing will load the diagram or add the machine to your library. Ensure you trust the source."}
            </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[#555] bg-[#333] flex justify-end gap-2">
          <button onClick={onClose} className="bg-[#3a3a3a] border border-[#555] hover:bg-[#4a4a4a] text-[#eee] px-4 py-1.5 text-xs font-mono">
            Cancel
          </button>
          {mode === 'import' && (
              <button onClick={handleImport} className={btnClass}>
                <Upload size={14} />
                Load Data
              </button>
          )}
          {mode === 'export' && (
             <button onClick={handleCopy} className={btnClass}>
                {copied ? <Check size={14} /> : <Clipboard size={14} />}
                {copied ? 'Copied!' : 'Copy Code'}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};