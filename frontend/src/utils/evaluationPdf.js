import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';

export const EVALUATION_SHEET_LAYOUT = Object.freeze({
  pageWidth: '210mm',
  pageMinHeight: '297mm',
  contentPadding: '12mm',
});

function ensurePdfFilename(filename) {
  // Prohibir caracteres de control; eslint no-control-regex desactivado para el rango \x00–\x1f
  const baseName = String(filename || 'evaluacion')
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
    .replace(/\s+/g, ' ');

  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;
}

function preparePdfSource(sourceNode) {
  if (!sourceNode) {
    throw new Error('No se encontró el contenido para exportar el PDF.');
  }

  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '0';
  tempContainer.style.top = '0';
  tempContainer.style.width = EVALUATION_SHEET_LAYOUT.pageWidth;
  tempContainer.style.background = '#ffffff';
  tempContainer.style.pointerEvents = 'none';
  tempContainer.style.opacity = '0';
  tempContainer.style.zIndex = '-1';
  tempContainer.style.overflow = 'visible';

  const clonedNode = sourceNode.cloneNode(true);
  clonedNode.style.position = 'relative';
  clonedNode.style.left = '0';
  clonedNode.style.top = '0';
  clonedNode.style.width = EVALUATION_SHEET_LAYOUT.pageWidth;
  clonedNode.style.maxWidth = EVALUATION_SHEET_LAYOUT.pageWidth;
  clonedNode.style.minHeight = EVALUATION_SHEET_LAYOUT.pageMinHeight;
  clonedNode.style.padding = EVALUATION_SHEET_LAYOUT.contentPadding;
  clonedNode.style.margin = '0 auto';
  clonedNode.style.boxSizing = 'border-box';
  clonedNode.style.boxShadow = 'none';
  clonedNode.style.transform = 'none';
  clonedNode.style.background = '#ffffff';

  tempContainer.appendChild(clonedNode);
  document.body.appendChild(tempContainer);

  const cleanup = () => {
    if (tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }
  };

  return { clonedNode, cleanup };
}

async function createWorker(sourceNode, filename) {
  const { clonedNode, cleanup } = preparePdfSource(sourceNode);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 120));

    const worker = html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        filename: ensurePdfFilename(filename),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(clonedNode);

    return { worker, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export async function saveEvaluationPdf({ sourceNode, filename }) {
  const { worker, cleanup } = await createWorker(sourceNode, filename);

  try {
    await worker.save();
  } finally {
    cleanup();
  }
}

export async function getEvaluationPdfBlob({ sourceNode, filename }) {
  const { worker, cleanup } = await createWorker(sourceNode, filename);

  try {
    await worker.toPdf();
    const pdf = await worker.get('pdf');
    return pdf.output('blob');
  } finally {
    cleanup();
  }
}

async function readBinaryFromSource({ sourceFile, sourceUrl }) {
  if (sourceFile?.arrayBuffer) {
    return new Uint8Array(await sourceFile.arrayBuffer());
  }

  if (sourceUrl) {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error('No se pudo leer el PDF original.');
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  throw new Error('No hay PDF original disponible para anexar observaciones.');
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = ensurePdfFilename(filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function saveOriginalPdfWithAppendedObservations({
  originalSourceFile,
  originalSourceUrl,
  appendixSourceNode,
  filename,
}) {
  if (!appendixSourceNode) {
    throw new Error('No se encontró el anexo de observaciones para exportar.');
  }

  const originalBytes = await readBinaryFromSource({
    sourceFile: originalSourceFile,
    sourceUrl: originalSourceUrl,
  });

  let originalPdf;
  try {
    originalPdf = await PDFDocument.load(originalBytes);
  } catch (error) {
    throw new Error('El archivo original no es un PDF válido para anexar observaciones.');
  }

  const appendixBlob = await getEvaluationPdfBlob({
    sourceNode: appendixSourceNode,
    filename: 'observaciones-anexo.pdf',
  });
  const appendixBytes = new Uint8Array(await appendixBlob.arrayBuffer());
  const appendixPdf = await PDFDocument.load(appendixBytes);

  const mergedPdf = await PDFDocument.create();
  const originalPages = await mergedPdf.copyPages(originalPdf, originalPdf.getPageIndices());
  originalPages.forEach((page) => mergedPdf.addPage(page));
  const appendixPages = await mergedPdf.copyPages(appendixPdf, appendixPdf.getPageIndices());
  appendixPages.forEach((page) => mergedPdf.addPage(page));

  const mergedBytes = await mergedPdf.save();
  triggerBlobDownload(
    new Blob([mergedBytes], { type: 'application/pdf' }),
    filename
  );
}
