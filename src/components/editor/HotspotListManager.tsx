import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search, 
  Edit2, 
  Trash2, 
  Copy, 
  MapPin,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Hotspot {
  id: string;
  title: string;
  description?: string;
  x_position: number;
  y_position: number;
  media_url?: string;
  media_type?: string;
  floor_plan_id: string;
  style?: {
    icon: string;
    color: string;
    size: number;
  };
}

interface HotspotListManagerProps {
  isOpen: boolean;
  onClose: () => void;
  hotspots: Hotspot[];
  onEdit: (hotspot: Hotspot) => void;
  onDelete: (id: string) => void;
  onDuplicate: (hotspot: Hotspot) => void;
  onFocus: (hotspot: Hotspot) => void;
}

export default function HotspotListManager({
  isOpen,
  onClose,
  hotspots,
  onEdit,
  onDelete,
  onDuplicate,
  onFocus,
}: HotspotListManagerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHotspots = hotspots.filter((h) =>
    h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('hotspotList.manage')}</DialogTitle>
          <DialogDescription>
            {t('hotspotList.manageAll')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('hotspotList.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="secondary">
                {t('hotspotList.total')} {hotspots.length}
              </Badge>
              {searchQuery && (
                <Badge variant="outline">
                  {t('hotspotList.filtered')} {filteredHotspots.length}
                </Badge>
              )}
            </div>
          </div>

          {/* Hotspot List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {filteredHotspots.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? t('hotspotList.notFound')
                    : t('hotspotList.none')}
                </p>
              </Card>
            ) : (
              filteredHotspots.map((hotspot, index) => (
                <Card key={hotspot.id} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Number Badge */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4285F4] flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1 truncate">
                        {hotspot.title}
                      </h4>
                      {hotspot.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {hotspot.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          X: {Math.round(hotspot.x_position)}, Y: {Math.round(hotspot.y_position)}
                        </Badge>
                        {hotspot.media_url && (
                          <Badge variant="secondary" className="text-xs">
                            {hotspot.media_type === 'image' ? '📷' : '🌐'} Media
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onFocus(hotspot)}
                        title={t('hotspotList.center')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(hotspot)}
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDuplicate(hotspot)}
                        title={t('hotspotList.duplicate')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(hotspot.id)}
                        className="text-destructive hover:text-destructive"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
