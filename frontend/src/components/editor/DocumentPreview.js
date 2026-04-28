import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { renderAsync as renderDocxAsync } from 'docx-preview';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './documentPreview.css';

const DEFAULT_DESKTOP_ZOOM = 1.1;
const PDF_ZOOM_OPTIONS = [0.9, 1, DEFAULT_DESKTOP_ZOOM, 1.25, 1.5];
const DEFAULT_PAGE_RATIO = 1.414;

// En builds CRA con `homepage: "./"` el PUBLIC_URL suele ser "." y los paths relativos
// terminan resolviendo contra /static/js/..., rompiendo la carga del worker.
// Forzamos ruta absoluta servida desde `public/`.
const resolvePdfWorkerSrc = () => {
  const raw = String(process.env.PUBLIC_URL || '').trim();
  const normalized = raw.replace(/\/+$/, '');
  if (!normalized || normalized === '.' || normalized === './') return '/pdf.worker.min.mjs';
  return `${normalized}/pdf.worker.min.mjs`;
};

pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerSrc();

function getFileExtension(doc) {
  if (doc?.fileType) return String(doc.fileType).toLowerCase();
  const filename = String(doc?.filename || '');
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function formatZoomLabel(scale) {
  return `${Math.round(scale * 100)}%`;
}

function getDefaultZoom() {
  if (typeof window === 'undefined') {
    return 1;
  }

  return window.innerWidth >= 1024 ? DEFAULT_DESKTOP_ZOOM : 1;
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const updateWidth = () => setWidth(element.clientWidth || 0);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function buildDocxBuffer(doc) {
  if (doc?.sourceFile?.arrayBuffer) {
    return doc.sourceFile.arrayBuffer();
  }

  if (doc?.previewUrl) {
    return fetch(doc.previewUrl).then((response) => {
      if (!response.ok) {
        throw new Error('No se pudo cargar la vista previa DOCX.');
      }

      return response.arrayBuffer();
    });
  }

  return Promise.reject(new Error('No hay archivo DOCX disponible.'));
}

function PreviewShell({ zoom, onZoomChange, children, statusText = null }) {
  return (
    <div className="document-preview-root">
      <div className="document-preview-toolbar">
        <div className="document-preview-toolbar__meta">
          <span className="document-preview-toolbar__label">Vista original</span>
          {statusText ? <span className="document-preview-toolbar__status">{statusText}</span> : null}
        </div>
        <div className="document-preview-toolbar__zoom">
          {PDF_ZOOM_OPTIONS.map((option) => {
            const isActive = zoom === option;
            return (
              <button
                key={option}
                type="button"
                className={`document-preview-toolbar__zoom-button${isActive ? ' is-active' : ''}`}
                onClick={() => onZoomChange(option)}
              >
                {formatZoomLabel(option)}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}

function PreviewFallback({ errorMessage, fallback }) {
  return (
    <div className="document-preview-fallback">
      <div className="document-preview-fallback__banner">
        <strong>Vista original no disponible.</strong>
        <span>{errorMessage || 'Se muestra el visor anterior como respaldo.'}</span>
      </div>
      {fallback}
    </div>
  );
}

function PdfPageCard({ pageNumber, width, onError, visibilityRoot = null, onVisibilityChange = null }) {
  const pageRef = useRef(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 2);
  const [ratio, setRatio] = useState(DEFAULT_PAGE_RATIO);

  useEffect(() => {
    const element = pageRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '1200px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = pageRef.current;
    if (!element || typeof IntersectionObserver === 'undefined' || typeof onVisibilityChange !== 'function') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibilityChange(pageNumber, entry.isIntersecting ? entry.intersectionRatio : 0);
      },
      {
        root: visibilityRoot || null,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      onVisibilityChange(pageNumber, 0);
    };
  }, [onVisibilityChange, pageNumber, visibilityRoot]);

  return (
    <div ref={pageRef} className="document-preview-page-shell" style={{ minHeight: Math.max(width * ratio, 320) }}>
      {isVisible ? (
        <>
          <Page
            pageNumber={pageNumber}
            width={width}
            renderAnnotationLayer={true}
            renderTextLayer={true}
            canvasBackground="#ffffff"
            loading={<div className="document-preview-page-shell__loading">Cargando pagina {pageNumber}...</div>}
            onLoadSuccess={(page) => {
              const viewport = page.getViewport({ scale: 1 });
              if (viewport.width > 0) {
                setRatio(viewport.height / viewport.width);
              }
            }}
            onRenderError={onError}
            onGetTextError={onError}
            onGetAnnotationsError={onError}
          />
          <div className="document-preview-page-shell__number">Pagina {pageNumber}</div>
        </>
      ) : (
        <div className="document-preview-page-shell__placeholder">
          <span>Preparando pagina {pageNumber}...</span>
        </div>
      )}
    </div>
  );
}

function PdfPreview({ doc, zoom, onZoomChange, onError, onPageHintChange }) {
  const viewportRef = useRef(null);
  const viewportWidth = useElementWidth(viewportRef);
  const [pageCount, setPageCount] = useState(0);
  const visibleRatiosRef = useRef({});
  const lastHintRef = useRef(null);

  useEffect(() => {
    setPageCount(0);
  }, [doc?.id, doc?.previewUrl, doc?.sourceFile]);

  useEffect(() => {
    visibleRatiosRef.current = {};
    lastHintRef.current = null;
    if (typeof onPageHintChange === 'function') {
      onPageHintChange(null);
    }
  }, [doc?.id, doc?.previewUrl, doc?.sourceFile, onPageHintChange]);

  const handlePageVisibilityChange = useMemo(() => {
    return (pageNumber, ratioValue) => {
      visibleRatiosRef.current[pageNumber] = ratioValue;
      const entries = Object.entries(visibleRatiosRef.current)
        .map(([page, ratio]) => ({ page: Number(page), ratio: Number(ratio) || 0 }))
        .filter((entry) => entry.ratio > 0);

      if (!entries.length) {
        if (lastHintRef.current !== null) {
          lastHintRef.current = null;
          if (typeof onPageHintChange === 'function') {
            onPageHintChange(null);
          }
        }
        return;
      }

      entries.sort((left, right) => {
        if (right.ratio !== left.ratio) return right.ratio - left.ratio;
        return left.page - right.page;
      });

      const nextPage = entries[0].page;
      if (lastHintRef.current !== nextPage) {
        lastHintRef.current = nextPage;
        if (typeof onPageHintChange === 'function') {
          onPageHintChange(nextPage);
        }
      }
    };
  }, [onPageHintChange]);

  const pageWidth = useMemo(() => {
    const baseWidth = viewportWidth > 0 ? Math.min(Math.max(viewportWidth - 24, 320), 1240) : 880;
    return Math.round(baseWidth * zoom);
  }, [viewportWidth, zoom]);

  return (
    <PreviewShell
      zoom={zoom}
      onZoomChange={onZoomChange}
      statusText={pageCount ? `${pageCount} pagina${pageCount === 1 ? '' : 's'}` : 'Cargando PDF'}
    >
      <div ref={viewportRef} className="document-preview-viewport">
        <div className="document-preview-pages">
          <Document
            file={doc?.sourceFile || doc?.previewUrl}
            loading={<div className="document-preview-loading">Cargando PDF...</div>}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            onLoadError={onError}
            onSourceError={onError}
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <PdfPageCard
                key={`pdf-page-${index + 1}`}
                pageNumber={index + 1}
                width={pageWidth}
                onError={onError}
                visibilityRoot={viewportRef.current}
                onVisibilityChange={handlePageVisibilityChange}
              />
            ))}
          </Document>
        </div>
      </div>
    </PreviewShell>
  );
}

function DocxPreview({ doc, zoom, onZoomChange, onError }) {
  const docxRef = useRef(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let disposed = false;
    const container = docxRef.current;
    if (!container) return undefined;

    const renderDocument = async () => {
      setIsRendering(true);
      container.innerHTML = '';

      try {
        const buffer = await buildDocxBuffer(doc);
        if (disposed) return;

        await renderDocxAsync(buffer, container, undefined, {
          className: 'document-preview-docx-content',
          inWrapper: false,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: false,
        });

        if (!disposed) {
          setIsRendering(false);
        }
      } catch (error) {
        if (!disposed) {
          setIsRendering(false);
          onError(error);
        }
      }
    };

    renderDocument();

    return () => {
      disposed = true;
      container.innerHTML = '';
    };
  }, [doc, onError]);

  return (
    <PreviewShell
      zoom={zoom}
      onZoomChange={onZoomChange}
      statusText={isRendering ? 'Renderizando DOCX' : 'DOCX listo'}
    >
      <div className="document-preview-viewport">
        {isRendering ? <div className="document-preview-loading">Renderizando DOCX...</div> : null}
        <div className="document-preview-docx-zoom" style={{ zoom }}>
          <div ref={docxRef} className="document-preview-docx-host" />
        </div>
      </div>
    </PreviewShell>
  );
}

export default function DocumentPreview({ doc, fallback = null, onPageHintChange = null }) {
  const fileExtension = getFileExtension(doc);
  const [zoom, setZoom] = useState(getDefaultZoom);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    setZoom(getDefaultZoom());
    setPreviewError('');
  }, [doc?.id, doc?.previewUrl, doc?.sourceFile, fileExtension]);

  if (!doc || !['pdf', 'docx'].includes(fileExtension)) {
    return fallback;
  }

  if (!doc?.sourceFile && !doc?.previewUrl) {
    return fallback;
  }

  const handlePreviewError = (error) => {
    setPreviewError(error?.message || 'No se pudo renderizar el documento original.');
  };

  if (previewError) {
    return <PreviewFallback errorMessage={previewError} fallback={fallback} />;
  }

  if (fileExtension === 'pdf') {
    return (
      <PdfPreview
        doc={doc}
        zoom={zoom}
        onZoomChange={setZoom}
        onError={handlePreviewError}
        onPageHintChange={onPageHintChange}
      />
    );
  }

  return <DocxPreview doc={doc} zoom={zoom} onZoomChange={setZoom} onError={handlePreviewError} />;
}
