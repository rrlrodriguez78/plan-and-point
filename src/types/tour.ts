export interface Tour {
  id?: string;
  title: string;
  description?: string;
  is_published?: boolean;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
  tour_type?: 'tour_360' | 'photo_tour';
}

export interface FloorPlan {
  id: string;
  name: string;
  image_url: string;
  capture_date?: string;
  height?: number;
  width?: number;
  tour_id?: string;
  created_at?: string;
}

export interface HotspotStyle {
  icon?: string;
  color?: string;
  size?: number;
}

export interface Hotspot {
  id: string;
  title: string;
  description?: string;
  x_position: number;
  y_position: number;
  media_url?: string;
  media_type?: string;
  has_panorama?: boolean;
  panorama_count?: number;
  floor_plan_id?: string;
  created_at?: string;
  style?: HotspotStyle;
}

export interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  photo_url_mobile?: string;
  photo_url_thumbnail?: string;
  description?: string;
  display_order: number;
  capture_date?: string;
  created_at?: string;
}
