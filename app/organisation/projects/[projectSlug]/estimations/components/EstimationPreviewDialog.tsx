'use client';

import { useQuery } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileTextIcon, DownloadIcon, PrinterIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useProject } from '@/components/providers/ProjectProvider';

interface EstimationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimationId: Id<"costEstimations">;
  currencySymbol: string;
}

export function EstimationPreviewDialog({
  open,
  onOpenChange,
  estimationId,
  currencySymbol
}: EstimationPreviewDialogProps) {
  const { team } = useProject();
  const estimation = useQuery(apiAny.costEstimations.getCostEstimationWithItems, { estimationId });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'draft':
      case 'expired':
      default:
        return 'secondary';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!estimation) return;

    try {
      const jsPdfModule = await import("jspdf");
      const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;
      await import('jspdf-autotable');

      const doc = new jsPDF({
        format: 'a4',
        unit: 'mm'
      });

      let y = 20;

      // Header
      if (team) {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(team.name || 'Company', 20, y);
        y += 10;
      }

      // Title
      doc.setFontSize(16);
      doc.text('COST ESTIMATION', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (estimation.estimationNumber) {
        doc.text(`No: ${estimation.estimationNumber}`, 20, y);
        y += 5;
      }
      doc.text(`Date: ${format(new Date(estimation.estimationDate), 'MMM d, yyyy')}`, 20, y);
      y += 10;

      // Basic Info Box
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(estimation.title, 20, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (estimation.location) {
        doc.text(`Location: ${estimation.location}`, 20, y);
        y += 5;
      }
      if (estimation.plannedStartDate) {
        doc.text(`Planned Start: ${format(new Date(estimation.plannedStartDate), 'MMM d, yyyy')}`, 20, y);
        y += 5;
      }
      y += 5;

      // Customer Info
      if (estimation.customerName) {
        doc.setFont('helvetica', 'bold');
        doc.text('Client:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(estimation.customerName, 35, y);
        y += 5;
        if (estimation.customerAddress) {
          doc.text(estimation.customerAddress, 35, y);
          y += 5;
        }
        if (estimation.customerEmail || estimation.customerPhone) {
          const contact = [estimation.customerEmail, estimation.customerPhone].filter(Boolean).join(' | ');
          doc.text(contact, 35, y);
          y += 5;
        }
        y += 5;
      }

      // Labor Table
      if (estimation.laborItems && estimation.laborItems.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Labor', 20, y);
        y += 5;

        doc.autoTable({
          startY: y,
          head: [['Description', 'Qty', 'Unit', 'Price/Unit', 'Total']],
          body: estimation.laborItems.filter(Boolean).map(item => [
            item!.name,
            item!.quantity.toString(),
            item!.unit,
            item!.unitPrice ? `${item!.unitPrice.toFixed(2)} ${currencySymbol}` : '-',
            item!.totalPrice ? `${item!.totalPrice.toFixed(2)} ${currencySymbol}` : '-',
          ]),
          margin: { left: 20, right: 20 },
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [70, 70, 70] },
          foot: [['', '', '', 'Subtotal:', `${estimation.laborTotal?.toFixed(2) || '0.00'} ${currencySymbol}`]],
          footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        });

        y = doc.lastAutoTable.finalY + 10;
      }

      // Shopping List Table
      if (estimation.materialItems && estimation.materialItems.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Shopping List', 20, y);
        y += 5;

        doc.autoTable({
          startY: y,
          head: [['Product', 'Qty', 'Price/Unit', 'Total']],
          body: estimation.materialItems.filter(Boolean).map(item => [
            item!.name,
            item!.quantity.toString(),
            item!.unitPrice ? `${item!.unitPrice.toFixed(2)} ${currencySymbol}` : '-',
            item!.totalPrice ? `${item!.totalPrice.toFixed(2)} ${currencySymbol}` : '-',
          ]),
          margin: { left: 20, right: 20 },
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [70, 70, 70] },
          foot: [['', '', 'Subtotal:', `${estimation.materialsTotal?.toFixed(2) || '0.00'} ${currencySymbol}`]],
          footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        });

        y = doc.lastAutoTable.finalY + 10;
      }

      // Summary
      doc.setFontSize(10);
      const summaryX = 120;
      const valueX = 170;

      doc.setFont('helvetica', 'normal');
      doc.text('Labor:', summaryX, y);
      doc.text(`${estimation.laborTotal?.toFixed(2) || '0.00'} ${currencySymbol}`, valueX, y, { align: 'right' });
      y += 5;

      doc.text('Shopping List:', summaryX, y);
      doc.text(`${estimation.materialsTotal?.toFixed(2) || '0.00'} ${currencySymbol}`, valueX, y, { align: 'right' });
      y += 5;

      doc.setDrawColor(200);
      doc.line(summaryX, y, valueX, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('Net Total:', summaryX, y);
      doc.text(`${estimation.netTotal?.toFixed(2) || '0.00'} ${currencySymbol}`, valueX, y, { align: 'right' });
      y += 5;

      doc.setFont('helvetica', 'normal');
      if (estimation.discountPercent && estimation.discountPercent > 0) {
        doc.setTextColor(200, 0, 0);
        doc.text(`Discount (${estimation.discountPercent}%):`, summaryX, y);
        doc.text(`-${estimation.discountAmount?.toFixed(2) || '0.00'} ${currencySymbol}`, valueX, y, { align: 'right' });
        doc.setTextColor(0);
        y += 5;
      }

      doc.text(`VAT (${estimation.vatPercent}%):`, summaryX, y);
      doc.text(`${estimation.vatAmount?.toFixed(2) || '0.00'} ${currencySymbol}`, valueX, y, { align: 'right' });
      y += 5;

      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(summaryX, y, valueX, y);
      y += 6;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('GROSS TOTAL:', summaryX, y);
      doc.text(`${estimation.grossTotal?.toFixed(2) || '0.00'} ${currencySymbol}`, valueX, y, { align: 'right' });

      // Save
      const filename = `estimation-${estimation.estimationNumber || estimation._id}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('PDF export error:', error);
    }
  };

  if (!estimation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Loading estimation preview</DialogTitle>
        </DialogHeader>
          <Spinner />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileTextIcon className="h-6 w-6 text-primary" />
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Estimation Preview
            </DialogTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button size="sm" onClick={handleExportPDF}>
              <DownloadIcon className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </DialogHeader>

        <Card className="mt-6 gap-6 rounded-2xl p-0 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-6 border-b px-6 pb-6">
            <div className="flex flex-col gap-1">
              {team && (
                <h2 className="text-xl font-semibold tracking-tight">{team.name}</h2>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">COST ESTIMATION</div>
              {estimation.estimationNumber && (
                <div className="text-sm text-muted-foreground">#{estimation.estimationNumber}</div>
              )}
              <Badge variant={getStatusColor(estimation.status)} className="mt-2">
                {estimation.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6 px-6 pb-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold">{estimation.title}</h3>
              {estimation.location && (
                  <p className="text-sm text-muted-foreground">Location: {estimation.location}</p>
              )}
                <p className="text-sm text-muted-foreground">
                  Date: {format(new Date(estimation.estimationDate), 'MMMM d, yyyy')}
                </p>
              {estimation.plannedStartDate && (
                  <p className="text-sm text-muted-foreground">
                    Planned Start: {format(new Date(estimation.plannedStartDate), 'MMMM d, yyyy')}
                  </p>
              )}
              </div>
            {estimation.customerName && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-muted-foreground">Client:</p>
                  <p className="font-medium">{estimation.customerName}</p>
                {estimation.customerAddress && (
                    <p className="text-sm text-muted-foreground">{estimation.customerAddress}</p>
                )}
                {estimation.customerEmail && (
                    <p className="text-sm text-muted-foreground">{estimation.customerEmail}</p>
                )}
                {estimation.customerPhone && (
                    <p className="text-sm text-muted-foreground">{estimation.customerPhone}</p>
                )}
                </div>
            )}
            </div>

          {estimation.laborItems && estimation.laborItems.length > 0 && (
              <div className="flex flex-col gap-3">
                <h4 className="font-semibold">Labor</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="w-20 px-3 py-2 text-right">Qty</th>
                      <th className="w-16 px-3 py-2 text-center">Unit</th>
                      <th className="w-28 px-3 py-2 text-right">Price/Unit</th>
                      <th className="w-28 px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                  {estimation.laborItems.filter(Boolean).map((item) => (
                      <tr key={item!._id} className="border-b">
                        <td className="px-3 py-2">{item!.name}</td>
                        <td className="px-3 py-2 text-right">{item!.quantity}</td>
                        <td className="px-3 py-2 text-center">{item!.unit}</td>
                        <td className="px-3 py-2 text-right">
                        {item!.unitPrice?.toFixed(2) || '-'} {currencySymbol}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                        {item!.totalPrice?.toFixed(2) || '-'} {currencySymbol}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50">
                      <td colSpan={4} className="px-3 py-2 text-right font-medium">Labor Subtotal:</td>
                      <td className="px-3 py-2 text-right font-semibold">
                      {estimation.laborTotal?.toFixed(2) || '0.00'} {currencySymbol}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
          )}

          {estimation.materialItems && estimation.materialItems.length > 0 && (
              <div className="flex flex-col gap-3">
                <h4 className="font-semibold">Shopping List</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="w-20 px-3 py-2 text-right">Qty</th>
                      <th className="w-28 px-3 py-2 text-right">Price/Unit</th>
                      <th className="w-28 px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                  {estimation.materialItems.filter(Boolean).map((item) => (
                      <tr key={item!._id} className="border-b">
                        <td className="px-3 py-2">{item!.name}</td>
                        <td className="px-3 py-2 text-right">{item!.quantity}</td>
                        <td className="px-3 py-2 text-right">
                        {item!.unitPrice?.toFixed(2) || '-'} {currencySymbol}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                        {item!.totalPrice?.toFixed(2) || '-'} {currencySymbol}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50">
                      <td colSpan={3} className="px-3 py-2 text-right font-medium">Shopping List Subtotal:</td>
                      <td className="px-3 py-2 text-right font-semibold">
                      {estimation.materialsTotal?.toFixed(2) || '0.00'} {currencySymbol}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
          )}

            <div className="border-t pt-4">
              <div className="ml-auto flex max-w-xs flex-col gap-2">
              <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Labor:</span>
                <span>{estimation.laborTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shopping List:</span>
                <span>{estimation.materialsTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
              </div>
                <div className="flex justify-between border-t pt-2 font-medium">
                <span>Net Total:</span>
                <span>{estimation.netTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
              </div>
              {estimation.discountPercent && estimation.discountPercent > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                  <span>Discount ({estimation.discountPercent}%):</span>
                  <span>-{estimation.discountAmount?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({estimation.vatPercent}%):</span>
                <span>{estimation.vatAmount?.toFixed(2) || '0.00'} {currencySymbol}</span>
              </div>
                <div className="flex justify-between border-t pt-2 text-xl font-semibold">
                <span>GROSS TOTAL:</span>
                <span>{estimation.grossTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
              </div>
            </div>
            </div>

          {estimation.notes && (
              <div className="mt-6 border-t pt-4">
                <h4 className="mb-2 font-semibold">Notes</h4>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{estimation.notes}</p>
            </div>
          )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
