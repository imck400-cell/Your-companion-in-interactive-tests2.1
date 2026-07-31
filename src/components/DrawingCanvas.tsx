import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Pencil, RotateCcw, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
  initialDataUrl?: string;
  onChange: (dataUrl: string) => void;
  readOnly?: boolean;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  initialDataUrl,
  onChange,
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const [color, setColor] = useState('#1d4ed8');
  const [lineWidth, setLineWidth] = useState(3);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high pixel density
    const width = canvas.parentElement?.clientWidth || 500;
    const height = 300;
    canvas.width = width;
    canvas.height = height;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        saveHistory();
      };
      img.src = initialDataUrl;
    } else {
      saveHistory();
    }
  }, []);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(imageData);
    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }
    onChange(canvas.toDataURL('image/png'));
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveHistory();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const lastState = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    if (!canvas || !lastState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(lastState, 0, 0);
    onChange(canvas.toDataURL('image/png'));
  };

  const colors = ['#000000', '#1d4ed8', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777'];

  return (
    <div className="flex flex-col gap-3 w-full my-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTool('pencil')}
              className={`p-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-all ${
                tool === 'pencil' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
              title="قلم الرسم"
            >
              <Pencil className="w-4 h-4" />
              قلم
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-all ${
                tool === 'eraser' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
              title="ممحاة"
            >
              <Eraser className="w-4 h-4" />
              ممحاة
            </button>
          </div>

          {tool === 'pencil' && (
            <div className="flex items-center gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c ? 'scale-110 border-slate-800 shadow-md' : 'border-white'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">السمك:</span>
            <input
              type="range"
              min="1"
              max="15"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-20 accent-emerald-600"
            />
            <button
              type="button"
              onClick={undo}
              className="p-2 bg-white text-slate-700 hover:bg-slate-200 rounded-lg text-sm flex items-center gap-1 border border-slate-200"
              title="تراجع"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm flex items-center gap-1 border border-red-200"
              title="مسح الكل"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full bg-white rounded-xl overflow-hidden border-2 border-dashed border-slate-300 shadow-inner relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full touch-none cursor-crosshair block"
        />
      </div>
    </div>
  );
};
