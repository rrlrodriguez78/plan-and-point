import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Check, RotateCw, X } from 'lucide-react';

interface ImageEditorProps {
  imageFile: File;
  onSave: (editedFile: File) => void;
  onCancel: () => void;
}

export default function ImageEditor({ imageFile, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      originalImageRef.current = img;
      renderImage();
    };
    img.src = URL.createObjectURL(imageFile);

    return () => {
      if (img.src) URL.revokeObjectURL(img.src);
    };
  }, [imageFile]);

  useEffect(() => {
    renderImage();
  }, [brightness, contrast, saturation, rotation]);

  const renderImage = () => {
    if (!canvasRef.current || !originalImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = originalImageRef.current;

    // Calculate rotated dimensions
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const newWidth = img.width * cos + img.height * sin;
    const newHeight = img.width * sin + img.height * cos;

    // Set canvas size
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Clear canvas
    ctx.clearRect(0, 0, newWidth, newHeight);

    // Apply transformations
    ctx.save();
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(rad);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  };

  const handleSave = async () => {
    if (!canvasRef.current) return;

    setIsProcessing(true);
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob(
          (b) => resolve(b!),
          'image/jpeg',
          0.9
        );
      });

      const editedFile = new File([blob], imageFile.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      onSave(editedFile);
    } catch (error) {
      console.error('Error saving edited image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 bg-slate-100 rounded-lg overflow-auto flex items-center justify-center p-4">
        <canvas ref={canvasRef} className="max-w-full max-h-full" />
      </div>

      <div className="space-y-4 p-4 bg-white rounded-lg border">
        <div>
          <Label>Brillo: {brightness}%</Label>
          <Slider
            value={[brightness]}
            onValueChange={([val]) => setBrightness(val)}
            min={50}
            max={150}
            step={1}
          />
        </div>

        <div>
          <Label>Contraste: {contrast}%</Label>
          <Slider
            value={[contrast]}
            onValueChange={([val]) => setContrast(val)}
            min={50}
            max={150}
            step={1}
          />
        </div>

        <div>
          <Label>Saturación: {saturation}%</Label>
          <Slider
            value={[saturation]}
            onValueChange={([val]) => setSaturation(val)}
            min={0}
            max={200}
            step={1}
          />
        </div>

        <div>
          <Label>Rotación: {rotation}°</Label>
          <Slider
            value={[rotation]}
            onValueChange={([val]) => setRotation(val)}
            min={0}
            max={360}
            step={5}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isProcessing} className="flex-1">
            {isProcessing ? (
              <>
                <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Guardar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
