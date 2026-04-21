/**
 * Invoice PDF generation — V1.
 *
 * Strategy: render the existing structured InvoicePreview node into a PDF via
 * html2canvas + jsPDF. This guarantees PDF and on-screen preview stay
 * visually identical (same template, same data path).
 *
 * Issued invoices: caller passes the snapshot-driven preview node, so the PDF
 * reflects the frozen issued document.
 * Drafts: caller passes the live preview node — explicitly accepted for V1.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type PdfResult = {
  blob: Blob;
  base64: string; // pure base64 (no data: prefix)
  filename: string;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function renderInvoicePdf(
  node: HTMLElement,
  filename: string,
): Promise<PdfResult> {
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const usableW = A4_WIDTH_MM - MARGIN_MM * 2;
  const usableH = A4_HEIGHT_MM - MARGIN_MM * 2;
  const imgWmm = usableW;
  const imgHmm = (canvas.height * imgWmm) / canvas.width;

  if (imgHmm <= usableH) {
    pdf.addImage(imgData, "JPEG", MARGIN_MM, MARGIN_MM, imgWmm, imgHmm);
  } else {
    // Multi-page slicing: paginate by translating the image upward each page.
    let heightLeft = imgHmm;
    let position = MARGIN_MM;
    pdf.addImage(imgData, "JPEG", MARGIN_MM, position, imgWmm, imgHmm);
    heightLeft -= usableH;
    while (heightLeft > 0) {
      position = MARGIN_MM - (imgHmm - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", MARGIN_MM, position, imgWmm, imgHmm);
      heightLeft -= usableH;
    }
  }

  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const blob = pdf.output("blob");
  const base64 = await blobToBase64(blob);
  return { blob, base64, filename: safeName };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
