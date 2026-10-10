import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  shape?: 'circle' | 'square';
  title?: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  shape = 'square',
  title = 'Ajuste e Recorte da Foto',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !imageSrc) return null;

  // Active image DataURL or URL
  const [activeSrc, setActiveSrc] = useState<string>(imageSrc);
  const [loadedDataUrl, setLoadedDataUrl] = useState<string | null>(null);

  // Sync activeSrc if imageSrc prop changes
  useEffect(() => {
    if (imageSrc) {
      setActiveSrc(imageSrc);
      setLoadedDataUrl(null);
    }
  }, [imageSrc]);

  // Viewport Size dynamically calculated for mobile screens
  const [VIEWPORT_SIZE, setViewportSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const availableWidth = window.innerWidth - 32;
      return Math.min(320, Math.max(250, availableWidth));
    }
    return 320;
  });

  useEffect(() => {
    const handleResize = () => {
      const availableWidth = window.innerWidth - 32;
      setViewportSize(Math.min(320, Math.max(250, availableWidth)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mode: 'cropbox' (Quadros e Alças Interativas) or 'panzoom' (Mover Foto de Fundo)
  const [editorMode, setEditorMode] = useState<'cropbox' | 'panzoom'>('cropbox');

  // Zoom & Pan Transformations for the Image (0.1x to 15.0x / 1500%)
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // Interactive 1:1 Crop Frame Box (x, y, size in container coordinates)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; size: number }>({
    x: 30,
    y: 30,
    size: 220,
  });

  // Dragging State Refs
  const isDraggingRef = useRef<boolean>(false);
  const activeHandleRef = useRef<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | 'image' | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startCropBoxRef = useRef<{ x: number; y: number; size: number }>({ x: 30, y: 30, size: 220 });
  const lastPinchDistRef = useRef<number | null>(null);

  // Live Preview Data URL
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Natural Loaded Image Dimensions & HTMLImageElement Reference
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Safe Image Preloader (Converts HTTP/HTTPS to DataURL to avoid Canvas CORS Taint)
  useEffect(() => {
    if (!activeSrc) return;

    let isMounted = true;

    const setupImageElement = (srcToUse: string) => {
      const img = new Image();
      if (srcToUse.startsWith('http://') || srcToUse.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        if (!isMounted) return;
        imageElementRef.current = img;
        const w = img.naturalWidth || img.width || 300;
        const h = img.naturalHeight || img.height || 300;
        setImgNaturalSize({ width: w, height: h });
        setPanX(0);
        setPanY(0);
        setZoom(1);

        // Center crop box inside viewport
        const fitScale = Math.min(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h);
        const displayedW = w * fitScale;
        const displayedH = h * fitScale;
        const imgLeft = (VIEWPORT_SIZE - displayedW) / 2;
        const imgTop = (VIEWPORT_SIZE - displayedH) / 2;
        const initialBoxSize = Math.min(displayedW, displayedH, 220);

        setCropBox({
          x: Math.max(10, imgLeft + (displayedW - initialBoxSize) / 2),
          y: Math.max(10, imgTop + (displayedH - initialBoxSize) / 2),
          size: Math.max(80, initialBoxSize),
        });
      };

      img.onerror = () => {
        if (!isMounted) return;
        imageElementRef.current = img;
        setImgNaturalSize({ width: 300, height: 300 });
      };

      img.src = srcToUse;
    };

    if (activeSrc.startsWith('http://') || activeSrc.startsWith('https://')) {
      fetch(activeSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string' && isMounted) {
              setLoadedDataUrl(reader.result);
              setupImageElement(reader.result);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          setupImageElement(activeSrc);
        });
    } else {
      setLoadedDataUrl(activeSrc);
      setupImageElement(activeSrc);
    }

    return () => {
      isMounted = false;
    };
  }, [activeSrc, VIEWPORT_SIZE]);

  // Calculate Base Scale to fit full photo inside container initially
  const getBaseScale = useCallback(() => {
    if (!imgNaturalSize.width || !imgNaturalSize.height) return 1;
    return Math.min(VIEWPORT_SIZE / imgNaturalSize.width, VIEWPORT_SIZE / imgNaturalSize.height);
  }, [imgNaturalSize, VIEWPORT_SIZE]);

  // Smart Face Focus Mechanism
  const handleFaceZoom = (targetZoomLevel = 2.2) => {
    if (!imageElementRef.current || !imgNaturalSize.width || !imgNaturalSize.height) return;

    const img = imageElementRef.current;
    const w = imgNaturalSize.width;
    const h = imgNaturalSize.height;

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 100;
    sampleCanvas.height = 100;
    const sCtx = sampleCanvas.getContext('2d');

    let faceXRatio = 0.5;
    let faceYRatio = 0.32;

    if (sCtx) {
      try {
        sCtx.drawImage(img, 0, 0, 100, 100);
        const imgData = sCtx.getImageData(0, 0, 100, 100);
        const data = imgData.data;

        let totalX = 0;
        let totalY = 0;
        let skinCount = 0;

        for (let y = 5; y < 75; y++) {
          for (let x = 10; x < 90; x++) {
            const idx = (y * 100 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            if (
              r > 60 &&
              g > 35 &&
              b > 20 &&
              r > g &&
              r > b &&
              Math.abs(r - g) >= 12 &&
              r - Math.min(g, b) > 15
            ) {
              totalX += x;
              totalY += y;
              skinCount++;
            }
          }
        }

        if (skinCount > 40) {
          faceXRatio = (totalX / skinCount) / 100;
          faceYRatio = (totalY / skinCount) / 100;
        }
      } catch (e) {
        // Fallback
      }
    }

    setZoom(targetZoomLevel);

    const baseScale = getBaseScale();
    const currentScale = baseScale * targetZoomLevel;
    const imgRenderedW = w * currentScale;
    const imgRenderedH = h * currentScale;

    // Center face inside current cropBox
    const faceXInContainer = (VIEWPORT_SIZE / 2 + panX) + (faceXRatio - 0.5) * imgRenderedW;
    const faceYInContainer = (VIEWPORT_SIZE / 2 + panY) + (faceYRatio - 0.5) * imgRenderedH;

    const newBoxSize = Math.min(cropBox.size, 200);
    const newBoxX = Math.max(0, Math.min(VIEWPORT_SIZE - newBoxSize, faceXInContainer - newBoxSize / 2));
    const newBoxY = Math.max(0, Math.min(VIEWPORT_SIZE - newBoxSize, faceYInContainer - newBoxSize / 2));

    setCropBox({
      x: Math.round(newBoxX),
      y: Math.round(newBoxY),
      size: Math.round(newBoxSize),
    });
  };

  // Generate Cropped Image DataURL
  const generateCroppedImage = useCallback(
    (outputSize = 360): string => {
      const srcToUse = loadedDataUrl || activeSrc;
      if (!imageElementRef.current || !imgNaturalSize.width || !imgNaturalSize.height) {
        return srcToUse || '';
      }

      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return srcToUse || '';

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputSize, outputSize);

      const img = imageElementRef.current;
      const imgW = imgNaturalSize.width;
      const imgH = imgNaturalSize.height;

      // Base scale and current rendered scale inside container
      const baseFitScale = Math.min(VIEWPORT_SIZE / imgW, VIEWPORT_SIZE / imgH);
      const currentScale = baseFitScale * zoom;

      const imgRenderedW = imgW * currentScale;
      const imgRenderedH = imgH * currentScale;

      const imgLeft = (VIEWPORT_SIZE / 2 + panX) - imgRenderedW / 2;
      const imgTop = (VIEWPORT_SIZE / 2 + panY) - imgRenderedH / 2;

      // Crop box in container space relative to rendered image top-left
      const relX = cropBox.x - imgLeft;
      const relY = cropBox.y - imgTop;

      // Convert to natural image coordinates
      const srcX = relX / currentScale;
      const srcY = relY / currentScale;
      const srcSize = cropBox.size / currentScale;

      // Clamp source coordinates safely to natural image bounds
      const sx = Math.max(0, Math.min(imgW, srcX));
      const sy = Math.max(0, Math.min(imgH, srcY));
      const sw = Math.max(1, Math.min(imgW - sx, srcSize - Math.max(0, sx - srcX)));
      const sh = Math.max(1, Math.min(imgH - sy, srcSize - Math.max(0, sy - srcY)));

      // Compute destination coordinates on canvas
      const dx = ((sx - srcX) / srcSize) * outputSize;
      const dy = ((sy - srcY) / srcSize) * outputSize;
      const dw = (sw / srcSize) * outputSize;
      const dh = (sh / srcSize) * outputSize;

      try {
        ctx.save();
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        ctx.restore();
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (e) {
        console.warn('Canvas export fallback:', e);
        return srcToUse;
      }
    },
    [VIEWPORT_SIZE, activeSrc, loadedDataUrl, imgNaturalSize, panX, panY, zoom, cropBox]
  );

  // Update Live Preview in real-time when zoom, pan, or crop box changes
  useEffect(() => {
    if (!imageElementRef.current || !imgNaturalSize.width) return;
    const timer = setTimeout(() => {
      const cropped = generateCroppedImage(220);
      setPreviewUrl(cropped);
    }, 20);
    return () => clearTimeout(timer);
  }, [panX, panY, zoom, cropBox, activeSrc, generateCroppedImage, imgNaturalSize]);

  // Reset / Center Position & Zoom
  const handleCenter = () => {
    setPanX(0);
    setPanY(0);
    setZoom(1);

    if (imgNaturalSize.width && imgNaturalSize.height) {
      const w = imgNaturalSize.width;
      const h = imgNaturalSize.height;
      const fitScale = Math.min(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h);
      const displayedW = w * fitScale;
      const displayedH = h * fitScale;
      const imgLeft = (VIEWPORT_SIZE - displayedW) / 2;
      const imgTop = (VIEWPORT_SIZE - displayedH) / 2;
      const initialBoxSize = Math.min(displayedW, displayedH, 220);

      setCropBox({
        x: Math.max(10, imgLeft + (displayedW - initialBoxSize) / 2),
        y: Math.max(10, imgTop + (displayedH - initialBoxSize) / 2),
        size: Math.max(80, initialBoxSize),
      });
    }
  };

  // Zoom Button Controls
  const handleZoomIn = () => setZoom((prev) => Math.min(parseFloat((prev + 0.25).toFixed(2)), 15.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(parseFloat((prev - 0.25).toFixed(2)), 0.1));

  // Choose Another Photo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const res = event.target.result as string;
        setActiveSrc(res);
        setLoadedDataUrl(res);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Start Dragging Handler
  const handleDragStart = (
    clientX: number,
    clientY: number,
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | 'image'
  ) => {
    isDraggingRef.current = true;
    activeHandleRef.current = handle;
    startPosRef.current = { x: clientX, y: clientY };
    startPanRef.current = { x: panX, y: panY };
    startCropBoxRef.current = { ...cropBox };
  };

  // Drag & Move Handler (Global Window Events)
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - startPosRef.current.x;
      const dy = clientY - startPosRef.current.y;
      const handle = activeHandleRef.current;
      const initial = startCropBoxRef.current;

      if (handle === 'image') {
        setPanX(startPanRef.current.x + dx);
        setPanY(startPanRef.current.y + dy);
      } else if (handle === 'move') {
        const newX = Math.max(0, Math.min(VIEWPORT_SIZE - initial.size, initial.x + dx));
        const newY = Math.max(0, Math.min(VIEWPORT_SIZE - initial.size, initial.y + dy));
        setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
      } else if (handle === 'se' || handle === 's' || handle === 'e') {
        const delta = Math.max(dx, dy);
        const newSize = Math.max(50, Math.min(VIEWPORT_SIZE - initial.x, VIEWPORT_SIZE - initial.y, initial.size + delta));
        setCropBox((prev) => ({ ...prev, size: newSize }));
      } else if (handle === 'nw' || handle === 'n' || handle === 'w') {
        const delta = Math.min(dx, dy);
        const newSize = Math.max(50, initial.size - delta);
        const newX = Math.max(0, initial.x + (initial.size - newSize));
        const newY = Math.max(0, initial.y + (initial.size - newSize));
        setCropBox({ x: newX, y: newY, size: newSize });
      } else if (handle === 'ne') {
        const delta = Math.max(dx, -dy);
        const newSize = Math.max(50, initial.size + delta);
        const newY = initial.y - (newSize - initial.size);
        if (newY >= 0 && initial.x + newSize <= VIEWPORT_SIZE) {
          setCropBox({ x: initial.x, y: newY, size: newSize });
        }
      } else if (handle === 'sw') {
        const delta = Math.max(-dx, dy);
        const newSize = Math.max(50, initial.size + delta);
        const newX = initial.x - (newSize - initial.size);
        if (newX >= 0 && initial.y + newSize <= VIEWPORT_SIZE) {
          setCropBox({ x: newX, y: initial.y, size: newSize });
        }
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      isDraggingRef.current = false;
      activeHandleRef.current = null;
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDraggingRef.current) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (dist - lastPinchDistRef.current) * 0.015;
        setZoom((prev) => Math.min(Math.max(parseFloat((prev + delta).toFixed(2)), 0.1), 15.0));
        lastPinchDistRef.current = dist;
      }
    };

    const handleWindowTouchEnd = () => {
      isDraggingRef.current = false;
      activeHandleRef.current = null;
      lastPinchDistRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [VIEWPORT_SIZE]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((prev) => Math.min(Math.max(parseFloat((prev + delta).toFixed(2)), 0.1), 15.0));
  };

  // Touch Start
  const handleTouchStart = (
    e: React.TouchEvent,
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | 'image' = 'move'
  ) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY, handle);
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDistRef.current = dist;
    }
  };

  // Confirm Cropped Photo
  const handleConfirm = () => {
    const finalCropped = generateCroppedImage(360) || loadedDataUrl || activeSrc;
    if (finalCropped) {
      onConfirm(finalCropped);
    }
  };

  const baseScale = getBaseScale();
  const currentScale = baseScale * zoom;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-100 my-auto">
        
        {/* Header - Compact Mobile */}
        <div className="p-2.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-lg sm:text-xl">crop</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-100 text-xs sm:text-base leading-tight truncate">{title}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">Ajuste o zoom e o enquadramento do rosto</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Cancelar"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">close</span>
          </button>
        </div>

        {/* Mode Selector Tabs (Quadro Interativo vs Mover Foto) + Carregar Outra Foto - Compact Mobile */}
        <div className="px-2 pt-1.5 sm:px-4 sm:pt-2.5 flex items-center gap-1 sm:gap-2 bg-slate-950/40 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setEditorMode('cropbox')}
            className={`flex-1 py-1.5 px-2 sm:py-2 sm:px-3 rounded-t-xl text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
              editorMode === 'cropbox'
                ? 'bg-slate-900 border-b-2 border-sky-400 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-xs sm:text-sm">crop</span>
            <span>✂️ Arrastar Quadro</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorMode('panzoom')}
            className={`flex-1 py-1.5 px-2 sm:py-2 sm:px-3 rounded-t-xl text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
              editorMode === 'panzoom'
                ? 'bg-slate-900 border-b-2 border-emerald-400 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-xs sm:text-sm">pan_tool</span>
            <span>🖐️ Mover Foto</span>
          </button>

          <label className="py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-slate-700/60 shrink-0">
            <span className="material-symbols-outlined text-xs sm:text-sm text-sky-400">upload</span>
            <span className="hidden sm:inline">Trocar foto</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </label>
        </div>

        {/* Framing Canvas Body - Compact Padding on Mobile */}
        <div className="p-2 sm:p-4 flex flex-col items-center gap-2 sm:gap-3 overflow-y-auto">
          
          {/* Main Framing Viewport */}
          <div
            className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 select-none shadow-inner touch-none flex items-center justify-center shrink-0"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onWheel={handleWheel}
            onMouseDown={(e) => {
              if (editorMode === 'panzoom') {
                e.preventDefault();
                handleDragStart(e.clientX, e.clientY, 'image');
              }
            }}
            onTouchStart={(e) => {
              if (editorMode === 'panzoom') {
                handleTouchStart(e, 'image');
              }
            }}
          >
            {/* The Image transformed with STRICT NATURAL ASPECT RATIO PRESERVATION */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${panX}px, ${panY}px)`,
                transition: isDraggingRef.current ? 'none' : 'transform 0.05s ease-out',
              }}
            >
              <img
                src={loadedDataUrl || activeSrc}
                alt="Source"
                draggable={false}
                className="select-none"
                style={{
                  width: imgNaturalSize.width ? `${imgNaturalSize.width * currentScale}px` : 'auto',
                  height: imgNaturalSize.height ? `${imgNaturalSize.height * currentScale}px` : 'auto',
                  aspectRatio: imgNaturalSize.width && imgNaturalSize.height ? `${imgNaturalSize.width} / ${imgNaturalSize.height}` : 'auto',
                  objectFit: 'contain',
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
              />
            </div>

            {/* Dark Mask Overlay with Cutout Window corresponding to Crop Box */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at ${cropBox.x + cropBox.size / 2}px ${cropBox.y + cropBox.size / 2}px, transparent ${
                  cropBox.size / 2 - 1
                }px, rgba(15, 23, 42, 0.82) ${cropBox.size / 2})`,
              }}
            />

            {/* FULLY INTERACTIVE CROP BOX FRAME */}
            <div
              className={`absolute border-2 border-sky-400 z-20 cursor-move flex flex-col justify-between shadow-[0_0_15px_rgba(56,189,248,0.4)] ${
                shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
              }`}
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.size}px`,
                height: `${cropBox.size}px`,
                touchAction: 'none',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragStart(e.clientX, e.clientY, 'move');
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTouchStart(e, 'move');
              }}
            >
              {/* Rule of Thirds Grid inside Crop Box */}
              <div className="w-full h-full relative opacity-25 pointer-events-none">
                <div className="absolute inset-x-0 top-1/3 border-b border-white" />
                <div className="absolute inset-x-0 top-2/3 border-b border-white" />
                <div className="absolute inset-y-0 left-1/3 border-r border-white" />
                <div className="absolute inset-y-0 left-2/3 border-r border-white" />
              </div>

              {/* Edge Handles */}
              <div
                className="absolute -top-3 inset-x-8 h-6 cursor-ns-resize z-30"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'n'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'n'); }}
              />
              <div
                className="absolute -bottom-3 inset-x-8 h-6 cursor-ns-resize z-30"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 's'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 's'); }}
              />
              <div
                className="absolute -left-3 inset-y-8 w-6 cursor-ew-resize z-30"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'w'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'w'); }}
              />
              <div
                className="absolute -right-3 inset-y-8 w-6 cursor-ew-resize z-30"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'e'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'e'); }}
              />

              {/* 4 Corner Touch Handles */}
              <div
                className="absolute -top-3 -left-3 w-8 h-8 bg-sky-400 rounded-full border-2 border-slate-900 cursor-nwse-resize shadow-lg flex items-center justify-center z-30 hover:scale-110 active:scale-125 transition-transform"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'nw'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'nw'); }}
              >
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
              </div>

              <div
                className="absolute -top-3 -right-3 w-8 h-8 bg-sky-400 rounded-full border-2 border-slate-900 cursor-nesw-resize shadow-lg flex items-center justify-center z-30 hover:scale-110 active:scale-125 transition-transform"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'ne'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'ne'); }}
              >
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
              </div>

              <div
                className="absolute -bottom-3 -left-3 w-8 h-8 bg-sky-400 rounded-full border-2 border-slate-900 cursor-nesw-resize shadow-lg flex items-center justify-center z-30 hover:scale-110 active:scale-125 transition-transform"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'sw'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'sw'); }}
              >
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
              </div>

              <div
                className="absolute -bottom-3 -right-3 w-8 h-8 bg-sky-400 rounded-full border-2 border-slate-900 cursor-nwse-resize shadow-lg flex items-center justify-center z-30 hover:scale-110 active:scale-125 transition-transform"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'se'); }}
                onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'se'); }}
              >
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
              </div>
            </div>

            {/* Drag helper hint overlay */}
            <div className="absolute bottom-1.5 inset-x-0 text-center pointer-events-none z-10">
              <span className="text-[9px] sm:text-[10px] text-slate-200 font-medium bg-slate-900/85 backdrop-blur-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-slate-700/60 shadow-sm">
                {editorMode === 'cropbox'
                  ? '🖐️ Toque e arraste o quadro ou use o Zoom'
                  : '🖐️ Toque e arraste a foto'}
              </span>
            </div>
          </div>

          {/* Zoom Controls Bar - Compact Padding & Gaps on Mobile */}
          <div className="w-full max-w-sm flex flex-col gap-1.5 sm:gap-2 bg-slate-950/70 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800 shrink-0">
            
            {/* Presets Bar */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() => handleFaceZoom(2.2)}
                className="flex-1 py-1.5 px-1.5 sm:py-2 sm:px-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 text-sky-300 border border-sky-500/40 text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Focar no rosto automaticamente"
              >
                <span className="material-symbols-outlined text-sm sm:text-base text-sky-400">face</span>
                <span>🎯 Focar Rosto</span>
              </button>

              <button
                type="button"
                onClick={() => handleFaceZoom(4.0)}
                className="py-1.5 px-2 sm:py-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                title="Ampliar ao máximo (4.0x)"
              >
                <span className="material-symbols-outlined text-sm sm:text-base text-purple-400">zoom_in_map</span>
                <span>🔍 Max (4x)</span>
              </button>

              <button
                type="button"
                onClick={handleCenter}
                className="py-1.5 px-2 sm:py-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-700/60 shrink-0"
                title="Restaurar enquadramento inicial"
              >
                <span className="material-symbols-outlined text-sm sm:text-base">center_focus_strong</span>
                <span>Reset</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[10.5px] sm:text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs sm:text-sm text-sky-400">zoom_in</span>
                Zoom Proporcional
              </span>
              <span className="text-sky-400 font-mono font-bold">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Diminuir Zoom"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold flex items-center justify-center transition-all shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">zoom_out</span>
              </button>

              <input
                type="range"
                min="0.1"
                max="15.0"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              <button
                type="button"
                onClick={handleZoomIn}
                title="Aumentar Zoom"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold flex items-center justify-center transition-all shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">zoom_in</span>
              </button>
            </div>
          </div>

          {/* Real-Time Avatar Preview Box - Compact Mobile */}
          {previewUrl && (
            <div className="w-full flex items-center justify-between bg-slate-950/40 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 shrink-0">
              <div className="flex flex-col min-w-0">
                <span className="text-[10.5px] sm:text-xs font-bold text-slate-200 flex items-center gap-1 truncate">
                  <span className="material-symbols-outlined text-xs sm:text-sm text-sky-400">visibility</span>
                  Prévia do Corte
                </span>
                <span className="text-[9.5px] sm:text-[10.5px] text-slate-400 truncate">Recorte que será salvo</span>
              </div>
              <div className="relative p-0.5 bg-slate-900 rounded-xl border border-slate-800 shadow-md shrink-0">
                <img
                  src={previewUrl}
                  alt="Prévia Recortada"
                  className={`w-9 h-9 sm:w-12 sm:h-12 object-cover ${shape === 'circle' ? 'rounded-full' : 'rounded-lg sm:rounded-xl'}`}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Actions Footer - Compact Mobile */}
        <div className="p-2.5 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:from-sky-600 active:to-blue-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-950/30 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">check_circle</span>
            <span>Salvar Foto</span>
          </button>
        </div>

      </div>
    </div>
  );
};
