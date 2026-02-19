import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';
import { Transaction, ValidationError } from '@/types';

interface CSVUploadProps {
  onParsed: (transactions: Transaction[], fileName: string) => void;
  onProcessing: (state: boolean) => void;
}

const SAMPLE_CSV = `transaction_id,sender_id,receiver_id,amount,timestamp
TXN_001,ACC_001,ACC_002,1500.00,2024-01-15 09:23:11
TXN_002,ACC_002,ACC_003,1400.00,2024-01-15 10:45:22
TXN_003,ACC_003,ACC_001,1350.00,2024-01-15 11:12:33
TXN_004,ACC_004,ACC_002,800.00,2024-01-15 12:00:00
TXN_005,ACC_005,ACC_002,750.00,2024-01-15 12:30:00`;

export function CSVUpload({ onParsed, onProcessing }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [successInfo, setSuccessInfo] = useState<{ rows: number } | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrors([{ message: 'Only .csv files are accepted.' }]);
      return;
    }
    const name = file.name;
    setIsLoading(true);
    setErrors([]);
    setSuccessInfo(null);
    setFileName(name);
    onProcessing(true);

    const result = await parseCSV(file);
    setIsLoading(false);
    onProcessing(false);

    if (!result.success) {
      setErrors(result.errors);
    } else {
      setSuccessInfo({ rows: result.rowCount });
      onParsed(result.transactions, name);
    }
  }, [onParsed, onProcessing]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload zone */}
      <label
        className={`dropzone flex flex-col items-center justify-center gap-4 p-12 cursor-pointer ${isDragging ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input type="file" accept=".csv" className="hidden" onChange={handleChange} />
        <div className="flex flex-col items-center gap-3 text-center">
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : successInfo ? (
            <CheckCircle2 className="w-12 h-12 text-success" style={{ color: 'hsl(145 65% 45%)' }} />
          ) : (
            <Upload className="w-12 h-12 text-primary" style={{ color: 'hsl(var(--primary))' }} />
          )}
          <div>
            <p className="text-lg font-semibold text-foreground">
              {isLoading
                ? 'Parsing CSV...'
                : successInfo
                ? `Loaded: ${fileName}`
                : 'Drop your transaction CSV here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {successInfo
                ? `${successInfo.rows.toLocaleString()} valid transactions ready for analysis`
                : 'or click to browse — .csv files only, up to 10,000 transactions'}
            </p>
          </div>
        </div>
      </label>

      {/* Column format guide */}
      <div className="glass-card mt-4 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Required Column Structure
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { name: 'transaction_id', type: 'String' },
            { name: 'sender_id', type: 'String' },
            { name: 'receiver_id', type: 'String' },
            { name: 'amount', type: 'Float' },
            { name: 'timestamp', type: 'YYYY-MM-DD HH:MM:SS' },
          ].map((col) => (
            <div key={col.name} className="bg-muted rounded-md px-3 py-2">
              <p className="font-mono text-xs text-primary">{col.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{col.type}</p>
            </div>
          ))}
        </div>
        <button
          onClick={downloadSample}
          className="mt-3 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          Download sample CSV
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-4 glass-card border border-destructive/30 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" style={{ color: 'hsl(var(--destructive))' }} />
            <p className="text-sm font-semibold text-destructive" style={{ color: 'hsl(var(--destructive))' }}>
              Validation Failed
            </p>
          </div>
          <ul className="space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="text-xs font-mono text-muted-foreground">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
