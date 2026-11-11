import React from 'react';
import {
  BarChart3,
  Download,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Wrench,
  Layers,
  Calendar,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

export const ReportsView: React.FC = () => {
  const { currentOrg, invoices, bookings, equipmentList, maintenanceOrders, categories } = useRentFlow();

  const totalInvoiced = invoices.reduce((acc, i) => acc + i.totalDue, 0);
  const totalCollected = invoices.reduce((acc, i) => acc + i.amountPaid, 0);
  const totalDepositsHeld = bookings.reduce((acc, b) => {
    if (b.status === 'CHECKED_OUT' || b.status === 'CONFIRMED') {
      return acc + b.depositAmount;
    }
    return acc;
  }, 0);

  const totalMaintenanceCost = maintenanceOrders.reduce(
    (acc, m) => acc + m.costParts + m.costLabor,
    0
  );

  // Revenue by category
  const categoryStats = categories.map((cat) => {
    const itemsInCat = equipmentList.filter((e) => e.categoryId === cat.id);
    let totalStock = 0;
    let revenue = 0;

    itemsInCat.forEach((eq) => {
      totalStock += eq.totalStock;
      bookings.forEach((b) => {
        b.items.forEach((item) => {
          if (item.equipmentModelId === eq.id) {
            revenue += item.lineSubtotal;
          }
        });
      });
    });

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      totalUnits: totalStock,
      totalRevenue: revenue,
    };
  });

  const handleExportReportCsv = () => {
    const headers = ['Category', 'FleetUnits', 'GeneratedRevenue'];
    const rows = categoryStats.map((c) => [
      `"${c.categoryName}"`,
      c.totalUnits,
      c.totalRevenue.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `rentflow_revenue_report_${currentOrg.slug}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Financial & Utilization Reports
          </h1>
          <p className="text-xs text-slate-500">
            Audit-ready revenue reconciliation, asset yield, maintenance cost centers, and CSV exports.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportReportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export Summary CSV</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Invoiced (Gross)</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{invoices.length} invoices issued</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Cash Collected</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1">Settled payments in bank</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Escrow Security Deposits</span>
          <p className="text-2xl font-bold text-purple-700 mt-1">
            ${totalDepositsHeld.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Refundable trust liability</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Maintenance & Parts Cost</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ${totalMaintenanceCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Direct fleet service expense</p>
        </div>
      </div>

      {/* Category Performance Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">
          Revenue & Inventory Yield by Category
        </h2>

        <div className="divide-y divide-slate-100">
          {categoryStats.map((c) => {
            const maxRev = Math.max(...categoryStats.map((s) => s.totalRevenue), 1);
            const percent = Math.round((c.totalRevenue / maxRev) * 100);

            return (
              <div key={c.categoryId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="sm:w-1/3">
                  <span className="font-bold text-slate-900 block">{c.categoryName}</span>
                  <span className="text-[11px] text-slate-400">{c.totalUnits} Units in Fleet</span>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Revenue Share</span>
                    <span className="font-bold text-slate-800">${c.totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.max(8, percent)}%` }}
                    />
                  </div>
                </div>

                <div className="sm:w-32 text-right">
                  <span className="font-bold text-slate-900">
                    ${c.totalRevenue.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
