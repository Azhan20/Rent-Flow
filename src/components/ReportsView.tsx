import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  FileDown,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Wrench,
  Layers,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { jsPDF } from 'jspdf';
import { generatePredictiveAlerts } from '../utils/predictiveMaintenance';

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

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const handleDownloadFleetSummaryPdf = () => {
    setIsPdfGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const alertsSummary = generatePredictiveAlerts(equipmentList, maintenanceOrders, bookings);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      // Top Dark Navy Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 68, 'F');

      // Brand Logo & Header
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('RENTFLOW - FLEET HEALTH & MAINTENANCE SUMMARY', 30, 32);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Tenant: ${currentOrg.name} (${currentOrg.planTier} Tier)   |   Generated: ${dateStr}   |   Classification: Operations Audit`, 30, 48);

      // Section 1: Executive KPIs
      let y = 92;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('1. EXECUTIVE FLEET & FINANCIAL KPIs', 30, y);

      y += 14;
      const boxWidth = (pageWidth - 60 - 30) / 4;
      const boxHeight = 52;
      const metrics = [
        { label: 'Tracked Fleet Units', val: `${alertsSummary.totalSerializedTracked} Serialized`, sub: `${equipmentList.length} Models Active` },
        { label: 'Critical Service Alerts', val: `${alertsSummary.overdueCount} Overdue`, sub: `${alertsSummary.imminentCount} Imminent (<20h)` },
        { label: 'Total Invoiced (Gross)', val: `$${totalInvoiced.toLocaleString()}`, sub: `$${totalCollected.toLocaleString()} Collected` },
        { label: 'Security Deposits', val: `$${totalDepositsHeld.toLocaleString()}`, sub: 'Escrow Trust Fund' },
      ];

      metrics.forEach((m, idx) => {
        const bx = 30 + idx * (boxWidth + 10);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, y, boxWidth, boxHeight, 4, 4, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label.toUpperCase(), bx + 8, y + 14);

        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(m.val, bx + 8, y + 30);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(m.sub, bx + 8, y + 43);
      });

      y += boxHeight + 24;

      // Section 2: Urgent Predictive Maintenance Alerts
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('2. TELEMATICS & PREVENTIVE MAINTENANCE ACTION RADAR', 30, y);

      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('OEM milestone monitoring tracking current meter hours against recommended overhaul thresholds.', 30, y);

      y += 14;

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(30, y, pageWidth - 60, 20, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text('UNIT ID', 36, y + 13);
      doc.text('EQUIPMENT MODEL', 95, y + 13);
      doc.text('CURRENT / TARGET HRS', 245, y + 13);
      doc.text('SEVERITY STATUS', 355, y + 13);
      doc.text('RECOMMENDED ACTION', 440, y + 13);

      y += 20;

      const priorityAlerts = alertsSummary.alerts.slice(0, 7);

      priorityAlerts.forEach((alert, idx) => {
        const rowBg = idx % 2 === 0 ? 255 : 250;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(30, y, pageWidth - 60, 24, 'F');
        doc.setDrawColor(241, 245, 249);
        doc.line(30, y + 24, pageWidth - 30, y + 24);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(alert.unitIdentifier, 36, y + 15);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const truncatedName = alert.equipmentName.length > 28 ? alert.equipmentName.substring(0, 26) + '...' : alert.equipmentName;
        doc.text(truncatedName, 95, y + 15);

        doc.text(`${alert.currentMeterHours} hrs / ${alert.nextServiceTargetHours} hrs`, 245, y + 15);

        let statusText = 'HEALTHY';
        if (alert.severity === 'CRITICAL_OVERDUE') {
          doc.setTextColor(190, 18, 60);
          statusText = `OVERDUE (${Math.abs(alert.remainingHours)}h)`;
        } else if (alert.severity === 'HIGH_IMMINENT') {
          doc.setTextColor(180, 83, 9);
          statusText = `IMMINENT (${alert.remainingHours}h)`;
        } else if (alert.severity === 'MEDIUM_UPCOMING') {
          doc.setTextColor(29, 78, 216);
          statusText = `UPCOMING (${alert.remainingHours}h)`;
        } else {
          doc.setTextColor(22, 101, 52);
        }
        doc.setFont('helvetica', 'bold');
        doc.text(statusText, 355, y + 15);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const recText = `${alert.recommendedService.title} (~$${alert.recommendedService.estimatedCost})`;
        doc.text(recText.length > 25 ? recText.substring(0, 23) + '..' : recText, 440, y + 15);

        y += 24;
      });

      y += 18;

      // Section 3: Category Breakdown
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('3. CATEGORY INVENTORY & REVENUE YIELD', 30, y);

      y += 14;
      doc.setFillColor(241, 245, 249);
      doc.rect(30, y, pageWidth - 60, 18, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text('CATEGORY NAME', 36, y + 12);
      doc.text('FLEET STOCK UNITS', 240, y + 12);
      doc.text('GENERATED REVENUE', 420, y + 12);

      y += 18;
      doc.setFont('helvetica', 'normal');

      categoryStats.forEach((cat, idx) => {
        const rowBg = idx % 2 === 0 ? 255 : 250;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(30, y, pageWidth - 60, 20, 'F');
        doc.setDrawColor(241, 245, 249);
        doc.line(30, y + 20, pageWidth - 30, y + 20);

        doc.setTextColor(30, 41, 59);
        doc.text(cat.categoryName, 36, y + 13);
        doc.text(`${cat.totalUnits} Units`, 240, y + 13);
        doc.text(`$${cat.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 420, y + 13);

        y += 20;
      });

      y += 24;

      // Section 4: Operational Sign-Off
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(30, y, pageWidth - 60, 75, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('OPERATIONAL SIGN-OFF & COMPLIANCE VERIFICATION', 42, y + 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('I hereby certify that the telematics readings and equipment service intervals logged herein represent true operating hours.', 42, y + 32);

      doc.line(42, y + 62, 220, y + 62);
      doc.text('Lead Fleet Technician / Yard Superintendent', 42, y + 71);

      doc.line(300, y + 62, 480, y + 62);
      doc.text('Operations Director / Managing Agent', 300, y + 71);

      // Page Footer
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`RentFlow Enterprise Fleet Intelligence   •   Tenant ID: ${currentOrg.id}   •   Page 1 of 1`, 30, pageHeight - 20);

      // Save document
      doc.save(`RentFlow_Fleet_Summary_${currentOrg.slug}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsPdfGenerating(false);
    }
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
            Audit-ready revenue reconciliation, asset yield, maintenance cost centers, and PDF/CSV exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Fleet Summary PDF Button */}
          <button
            type="button"
            onClick={handleDownloadFleetSummaryPdf}
            disabled={isPdfGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            title="Generate and download full PDF report of fleet health and maintenance"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>{isPdfGenerating ? 'Generating PDF...' : 'Download Fleet Summary (PDF)'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportReportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Summary CSV</span>
          </button>
        </div>
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
