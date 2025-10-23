import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import {
  Type, MapPin, Star, Heart,  Palette, 
  Building, Home, Camera, Video, BedDouble, Bath, Car, TreePine, 
  ChefHat, Sofa, Flower, Circle, Triangle, Diamond, Coffee, Utensils, Monitor, X, Check
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from 'react-i18next';

const iconComponents: Record<string, any> = {
  MapPin, Building, Home, Camera, Video, BedDouble, Bath, Car, TreePine, Star, Heart,
  ChefHat, Sofa, Flower, Circle, Triangle, Diamond, Coffee, Utensils, Monitor
};

const iconList = Object.keys(iconComponents);

interface PointStyleSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (style: any) => void;
  initialStyle?: any;
}

export default function PointStyleSelector({ isOpen, onClose, onConfirm, initialStyle = {} }: PointStyleSelectorProps) {
  const { t } = useTranslation();
  const [displayType, setDisplayType] = useState(initialStyle?.display_type || 'icon');
  const [iconName, setIconName] = useState(initialStyle?.icon_name || 'MapPin');
  const [customText, setCustomText] = useState(initialStyle?.custom_text || 'A');
  const [iconSize, setIconSize] = useState(initialStyle?.icon_size || 32);
  const [iconRotation, setIconRotation] = useState(initialStyle?.icon_rotation || 0);
  const [iconColor, setIconColor] = useState(initialStyle?.icon_color || '#3b82f6');
  const [backgroundColor, setBackgroundColor] = useState(initialStyle?.background_color || '#ffffff');

  useEffect(() => {
    setDisplayType(initialStyle?.display_type || 'icon');
    setIconName(initialStyle?.icon_name || 'MapPin');
    setCustomText(initialStyle?.custom_text || 'A');
    setIconSize(initialStyle?.icon_size || 32);
    setIconRotation(initialStyle?.icon_rotation || 0);
    setIconColor(initialStyle?.icon_color || '#3b82f6');
    setBackgroundColor(initialStyle?.background_color || '#ffffff');
  }, [initialStyle]);

  const handleConfirm = () => {
    onConfirm({
      display_type: displayType,
      icon_name: iconName,
      custom_text: customText,
      icon_size: iconSize,
      icon_rotation: iconRotation,
      icon_color: iconColor,
      background_color: backgroundColor,
    });
  };

  const IconComponent = iconComponents[iconName] || MapPin;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">{t('pointStyle.title')}</DialogTitle>
          <DialogDescription>
            {t('pointStyle.subtitle')}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Columna de configuración */}
              <div className="space-y-6">
                <Tabs value={displayType} onValueChange={setDisplayType}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="icon" className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      {t('pointStyle.icon')}
                    </TabsTrigger>
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      {t('pointStyle.text')}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="icon" className="space-y-4 pt-4">
                    <div>
                      <Label className="text-base font-semibold">{t('pointStyle.selectIcon')}</Label>
                      <div className="grid grid-cols-6 gap-2 mt-3">
                        {iconList.map(name => {
                          const Icon = iconComponents[name];
                          return (
                            <Button
                              key={name}
                              variant="outline"
                              size="icon"
                              onClick={() => setIconName(name)}
                              className={`h-12 w-12 ${iconName === name ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                              <Icon className="w-5 h-5" />
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="text" className="pt-4">
                    <div>
                      <Label htmlFor="custom-text" className="text-base font-semibold">{t('pointStyle.customText')}</Label>
                      <Input
                        id="custom-text"
                        value={customText}
                        onChange={e => setCustomText(e.target.value)}
                        placeholder={t('pointStyle.customTextPlaceholder')}
                        className="mt-2"
                        maxLength={10}
                      />
                      <p className="text-xs text-slate-500 mt-1">{t('pointStyle.maxCharacters')}</p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">{t('pointStyle.sizeLabel')} {iconSize}px</Label>
                    <Slider 
                      value={[iconSize]} 
                      onValueChange={([val]) => setIconSize(val)} 
                      min={16} 
                      max={80} 
                      step={2} 
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-base font-semibold">{t('pointStyle.rotationLabel')} {iconRotation}°</Label>
                    <Slider 
                      value={[iconRotation]} 
                      onValueChange={([val]) => setIconRotation(val)} 
                      min={0} 
                      max={360} 
                      step={5} 
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="icon-color" className="text-base font-semibold">{t('pointStyle.mainColor')}</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input 
                          id="icon-color" 
                          type="color" 
                          value={iconColor} 
                          onChange={e => setIconColor(e.target.value)} 
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input 
                          type="text" 
                          value={iconColor} 
                          onChange={e => setIconColor(e.target.value)} 
                          className="flex-1"
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bg-color" className="text-base font-semibold">{t('pointStyle.backgroundColor')}</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input 
                          id="bg-color" 
                          type="color" 
                          value={backgroundColor} 
                          onChange={e => setBackgroundColor(e.target.value)} 
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input 
                          type="text" 
                          value={backgroundColor} 
                          onChange={e => setBackgroundColor(e.target.value)} 
                          className="flex-1"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna de previsualización */}
              <div className="flex flex-col">
                <div className="bg-slate-100 rounded-lg p-8 flex-1 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Label className="text-lg font-semibold">{t('pointStyle.preview')}</Label>
                    <div className="bg-white p-8 rounded-lg shadow-inner">
                      <div
                        className="mx-auto flex items-center justify-center shadow-lg border-2 transition-all duration-300"
                        style={{
                          height: `${iconSize}px`,
                          width: displayType === 'text' ? 'auto' : `${iconSize}px`,
                          padding: displayType === 'text' ? `0 ${iconSize * 0.3}px` : '0',
                          borderRadius: displayType === 'text' ? '8px' : '50%',
                          backgroundColor: backgroundColor,
                          borderColor: iconColor,
                          transform: `rotate(${iconRotation}deg)`,
                        }}
                      >
                        {displayType === 'icon' ? (
                          <IconComponent
                            style={{
                              width: `${iconSize * 0.6}px`,
                              height: `${iconSize * 0.6}px`,
                              color: iconColor,
                            }}
                          />
                        ) : (
                          <span
                            className="font-bold leading-none"
                            style={{
                              fontSize: `${iconSize * 0.4}px`,
                              color: iconColor,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {customText || t('pointStyle.text')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><strong>{t('pointStyle.type')}</strong> {displayType === 'icon' ? t('pointStyle.icon') : t('pointStyle.text')}</p>
                      <p><strong>{t('pointStyle.sizeLabel')}</strong> {iconSize}px</p>
                      <p><strong>{t('pointStyle.rotationLabel')}</strong> {iconRotation}°</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 border-t bg-slate-50/50 rounded-b-lg flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2"/>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
            <Check className="w-4 h-4 mr-2"/>
            {t('pointStyle.confirmStyle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
