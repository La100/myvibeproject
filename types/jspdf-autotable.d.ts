import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: unknown) => void;
    lastAutoTable: { finalY: number };
  }
}
