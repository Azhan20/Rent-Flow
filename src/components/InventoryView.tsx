import React, { useState } from 'react';
import {
  Layers,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  ChevronRight,
  Sparkles,
  Info,
  DollarSign,
  Tag,
  Box,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { EquipmentModel, EquipmentStatus } from '../types';

interface InventoryViewProps {
  onOpenNewBookingWithItem?: (equipmentId: string) => void;
  onOpenAiCopilot: () => void;
  onOpenCsvImport: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onOpenNewBookingWithItem,
  onOpenAiCopilot,
  onOpenCsvImport,
}) => {
  const { equipmentList, categories, currentOrg, addEquipment, deleteEquipment, setActiveView } = useRentFlow();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<EquipmentModel | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Equipment Form State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newMakeModel, setNewMakeModel] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id || 'cat-earth');
  const [newDailyRate, setNewDailyRate] = useState('250');
  const [newWeeklyRate, setNewWeeklyRate] = useState('1000');
  const [newMonthlyRate, setNewMonthlyRate] = useState('2900');
  const [newDeposit, setNewDeposit] = useState('500');
  const [newReplacementValue, setNewReplacementValue] = useState('45000');
  const [newIsSerialized, setNewIsSerialized] = useState(true);
  const [newTotalStock, setNewTotalStock] = useState('2');
  const [newDescription, setNewDescription] = useState('');

  // Filtering
  const filteredEquipment = equipmentList.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.makeModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.assetUnits &&
        item.assetUnits.some((u) =>
          u.unitIdentifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
        ));

    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;

    let matchesStatus = true;
    if (selectedStatus !== 'all') {
      if (item.isSerialized && item.assetUnits) {
        matchesStatus = item.assetUnits.some((u) => u.status === selectedStatus);
      } else {
        matchesStatus = selectedStatus === 'AVAILABLE';
      }
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleExportCsv = () => {
    const headers = ['SKU', 'Name', 'Category', 'MakeModel', 'DailyRate', 'WeeklyRate', 'MonthlyRate', 'Deposit', 'TotalStock', 'Type'];
    const rows = equipmentList.map((eq) => [
      eq.sku,
      `"${eq.name.replace(/"/g, '""')}"`,
      categories.find((c) => c.id === eq.categoryId)?.name || eq.categoryId,
      `"${eq.makeModel.replace(/"/g, '""')}"`,
      eq.dailyRate,
      eq.weeklyRate,
      eq.monthlyRate,
      eq.securityDeposit,
      eq.totalStock,
      eq.isSerialized ? 'Serialized' : 'Bulk',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rentflow_fleet_${currentOrg.slug}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSku) return;

    addEquipment({
      categoryId: newCategoryId,
      name: newName,
      sku: newSku.toUpperCase(),
      makeModel: newMakeModel || newName,
      description: newDescription || 'Commercial grade rental equipment unit.',
      imageUrl: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80',
      isSerialized: newIsSerialized,
      totalStock: parseInt(newTotalStock, 10) || 1,
      dailyRate: parseFloat(newDailyRate) || 100,
      weeklyRate: parseFloat(newWeeklyRate) || 400,
      monthlyRate: parseFloat(newMonthlyRate) || 1200,
      securityDeposit: parseFloat(newDeposit) || 300,
      replacementValue: parseFloat(newReplacementValue) || 20000,
      maintenanceIntervalHours: 250,
      meterUnit: 'hours',
      specifications: {
        'Fleet Class': 'Standard Commercial',
        'Inspection Cycle': '250 Hours / 90 Days',
      },
    });

    setShowAddModal(false);
    // Reset form
    setNewName('');
    setNewSku('');
    setNewMakeModel('');
    setNewDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Fleet & Asset Inventory
          </h1>
          <p className="text-xs text-slate-500">
            Serialized machinery units, bulk stock balances, rate cards, and telematics hours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCsvImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            <span>CSV Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Fleet</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Equipment</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search equipment by name, SKU, serial number, make/model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="CHECKED_OUT">Checked Out (On Hire)</option>
            <option value="RESERVED">Reserved</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Equipment List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipment.map((item) => {
          const categoryName = categories.find((c) => c.id === item.categoryId)?.name || 'General';

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
            >
              <div>
                {/* Equipment Image & Category Badge */}
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80';
                    }}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="rounded-md bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-white">
                      {categoryName}
                    </span>
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    <span className="rounded-md bg-white/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow-xs">
                      {item.isSerialized ? `${item.totalStock} Serialized Units` : `${item.totalStock} in Bulk Stock`}
                    </span>
                  </div>
                </div>

                {/* Details Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold text-blue-600">
                        SKU: {item.sku}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Depot: {currentOrg.locations[0]?.code}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mt-0.5">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  </div>

                  {/* Rate Card Summary */}
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Day</span>
                      <span className="text-xs font-bold text-slate-900">${item.dailyRate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Week</span>
                      <span className="text-xs font-bold text-slate-900">${item.weeklyRate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Month</span>
                      <span className="text-xs font-bold text-slate-900">${item.monthlyRate}</span>
                    </div>
                  </div>

                  {/* Individual Serialized Units Status Pills */}
                  {item.isSerialized && item.assetUnits && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-600 block">
                        Assigned Units ({item.assetUnits.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.assetUnits.map((u) => {
                          const statusColors: Record<EquipmentStatus, string> = {
                            AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            CHECKED_OUT: 'bg-amber-50 text-amber-700 border-amber-200',
                            RESERVED: 'bg-blue-50 text-blue-700 border-blue-200',
                            MAINTENANCE: 'bg-rose-50 text-rose-700 border-rose-200',
                            RETIRED: 'bg-slate-100 text-slate-600 border-slate-300',
                            LOST_DAMAGED: 'bg-red-100 text-red-800 border-red-300',
                          };

                          return (
                            <span
                              key={u.id}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${statusColors[u.status]}`}
                              title={`Unit: ${u.unitIdentifier} | SN: ${u.serialNumber} | Hours: ${u.currentMeterHours}h`}
                            >
                              <span className="font-bold">{u.unitIdentifier}</span>
                              <span>•</span>
                              <span>{u.status.replace('_', ' ')}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="border-t border-slate-100 p-3 bg-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                    <span>Specs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('machinery_3d')}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold transition-colors"
                    title="Inspect articulated 3D model & telematics"
                  >
                    <Box className="h-3.5 w-3.5 text-amber-600" />
                    <span>3D View</span>
                  </button>
                </div>

                {onOpenNewBookingWithItem && (
                  <button
                    type="button"
                    onClick={() => onOpenNewBookingWithItem(item.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    <span>Reserve</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEquipment.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Layers className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No equipment found</h3>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search query, filter criteria, or add a new equipment model.
          </p>
        </div>
      )}

      {/* Equipment Specs Drawer/Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-semibold text-blue-600">
                  {selectedItem.sku}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedItem.name}</h3>
                <p className="text-xs text-slate-500">{selectedItem.makeModel}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Technical Specifications
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedItem.specifications).map(([key, val]) => (
                  <div key={key} className="rounded-md bg-white p-2 border border-slate-200">
                    <span className="text-[11px] text-slate-400 block">{key}</span>
                    <span className="font-semibold text-slate-800">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedItem.isSerialized && selectedItem.assetUnits && (
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Serialized Units & Telematics Readings
                </h4>
                <div className="space-y-2">
                  {selectedItem.assetUnits.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{u.unitIdentifier}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            SN: {u.serialNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Meter: <strong className="text-slate-800">{u.currentMeterHours} hrs</strong> • {u.conditionNote}
                        </p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {u.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Equipment to Fleet</h3>
                <p className="text-xs text-slate-500">Define model, rates, serialized units, and deposit requirement.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Equipment / Machine Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Kubota KX040-4 Mini Excavator"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="e.g. KUB-KX040"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Make & Model
                  </label>
                  <input
                    type="text"
                    value={newMakeModel}
                    onChange={(e) => setNewMakeModel(e.target.value)}
                    placeholder="e.g. Kubota KX040-4 (4 Ton Class)"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Rates */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Rental Rate Card & Deposit</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block">Daily ($)</label>
                    <input
                      type="number"
                      required
                      value={newDailyRate}
                      onChange={(e) => setNewDailyRate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Weekly ($)</label>
                    <input
                      type="number"
                      required
                      value={newWeeklyRate}
                      onChange={(e) => setNewWeeklyRate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Monthly ($)</label>
                    <input
                      type="number"
                      required
                      value={newMonthlyRate}
                      onChange={(e) => setNewMonthlyRate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Deposit ($)</label>
                    <input
                      type="number"
                      required
                      value={newDeposit}
                      onChange={(e) => setNewDeposit(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Inventory Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Asset Type
                  </label>
                  <select
                    value={newIsSerialized ? 'serialized' : 'bulk'}
                    onChange={(e) => setNewIsSerialized(e.target.value === 'serialized')}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500"
                  >
                    <option value="serialized">Serialized Units (Unique SN & Meter)</option>
                    <option value="bulk">Bulk Inventory (Quantity only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Total Quantity / Initial Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newTotalStock}
                    onChange={(e) => setNewTotalStock(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Create Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
