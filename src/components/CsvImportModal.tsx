import React, { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const { addEquipment, equipmentList, categories } = useRentFlow();
  const [csvText, setCsvText] = useState(
    `SKU,Name,Category,MakeModel,DailyRate,WeeklyRate,MonthlyRate,Deposit,TotalStock,Type
JLG-1930,JLG 1930ES Electric Scissor Lift,Aerial Lifts,JLG 1930ES (19ft Platform),140,520,1450,350,3,Serialized
WCK-LT4,Wacker Neuson Mobile Light Tower 4x1000W,Power & Generation,Wacker Neuson LT4,110,420,1150,250,2,Serialized
BLK-SHORING,Trench Shoring Box Steel 8x10ft,Site Safety & Bulk Gear,ProShore 8x10 Steel Shield,180,650,1800,500,4,Bulk`
  );
  const [previewParsed, setPreviewParsed] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleParsePreview = () => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim());
    const parsed: any[] = [];
    const dups: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 5) {
        const sku = cols[0];
        const name = cols[1];
        const catName = cols[2];
        const makeModel = cols[3];
        const dailyRate = parseFloat(cols[4]) || 100;
        const weeklyRate = parseFloat(cols[5]) || dailyRate * 4;
        const monthlyRate = parseFloat(cols[6]) || weeklyRate * 3;
        const deposit = parseFloat(cols[7]) || 300;
        const stock = parseInt(cols[8], 10) || 1;
        const isSerialized = cols[9]?.toLowerCase() !== 'bulk';

        if (equipmentList.some((e) => e.sku.toLowerCase() === sku.toLowerCase())) {
          dups.push(sku);
        }

        parsed.push({
          sku,
          name,
          categoryName: catName,
          makeModel,
          dailyRate,
          weeklyRate,
          monthlyRate,
          securityDeposit: deposit,
          totalStock: stock,
          isSerialized,
        });
      }
    }

    setPreviewParsed(parsed);
    setDuplicates(dups);
  };

  const handleConfirmImport = () => {
    let count = 0;
    previewParsed.forEach((row) => {
      // Find matching category or fallback
      const cat = categories.find(
        (c) => c.name.toLowerCase().includes(row.categoryName.toLowerCase()) ||
               row.categoryName.toLowerCase().includes(c.name.toLowerCase())
      ) || categories[0];

      addEquipment({
        categoryId: cat.id,
        name: row.name,
        sku: row.sku,
        makeModel: row.makeModel,
        description: `Imported from CSV fleet sheet. ${row.makeModel}.`,
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f9?auto=format&fit=crop&w=800&q=80',
        isSerialized: row.isSerialized,
        totalStock: row.totalStock,
        dailyRate: row.dailyRate,
        weeklyRate: row.weeklyRate,
        monthlyRate: row.monthlyRate,
        securityDeposit: row.securityDeposit,
        replacementValue: row.dailyRate * 120,
        maintenanceIntervalHours: 250,
        meterUnit: 'hours',
        specifications: {
          'Import Source': 'Verified Fleet CSV',
          'Asset Type': row.isSerialized ? 'Serialized Unit' : 'Bulk Pool',
        },
      });
      count++;
    });

    setImportedCount(count);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                CSV Fleet Inventory Batch Import
              </h3>
              <p className="text-slate-500">
                Parse equipment records, check duplicates, and configure rate cards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {importedCount !== null ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <h4 className="font-bold text-emerald-950 text-sm">
              {importedCount} Equipment Models Successfully Imported!
            </h4>
            <p className="text-emerald-700">Serialized units and rate cards added to fleet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Paste Raw CSV Data or Edit Sample:
                </label>
                <button
                  type="button"
                  onClick={handleParsePreview}
                  className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 font-bold hover:bg-blue-100"
                >
                  Parse & Preview
                </button>
              </div>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-800"
              />
            </div>

            {/* Validation & Preview Table */}
            {previewParsed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Preview: {previewParsed.length} Items Validated
                  </span>
                  {duplicates.length > 0 && (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      {duplicates.length} duplicate SKUs detected
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Equipment Name</th>
                        <th className="p-2">Daily / Wk / Mo</th>
                        <th className="p-2">Deposit</th>
                        <th className="p-2">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewParsed.map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono font-bold text-slate-800">{p.sku}</td>
                          <td className="p-2 font-medium text-slate-900">{p.name}</td>
                          <td className="p-2 text-slate-600">
                            ${p.dailyRate} / ${p.weeklyRate} / ${p.monthlyRate}
                          </td>
                          <td className="p-2 font-bold text-purple-700">${p.securityDeposit}</td>
                          <td className="p-2 font-bold">{p.totalStock} ({p.isSerialized ? 'Units' : 'Bulk'})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {previewParsed.length === 0 ? (
                <button
                  type="button"
                  onClick={handleParsePreview}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Validate CSV
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  Confirm & Import {previewParsed.length} Assets
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
