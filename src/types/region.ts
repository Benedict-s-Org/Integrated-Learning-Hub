// Public facility types
export type FacilityType =
  | 'park'
  | 'school'
  | 'library'
  | 'town_hall'
  | 'train_station'
  | 'marketplace'
  | 'bookstore'
  | 'cafe';

// Plot types
export type PlotType = 'city' | 'public_facility' | 'empty';

// Region themes
export type RegionTheme = 'countryside' | 'suburban' | 'urban';

// Region definition
export interface Region {
  id: string;
  name: string;
  gridSize: number;
  theme: RegionTheme;
  createdAt: string;
  updatedAt: string;
}

// Region plot definition
export interface RegionPlot {
  id: string;
  regionId: string;
  ownerId: string | null;
  ownerName?: string;
  position: { x: number; y: number };
  size: { width: number; depth: number };
  plotType: PlotType;
  cityLevel?: number;
  cityName?: string;
  createdAt: string;
  updatedAt: string;
}

// Map element definition (visual component on the map)
export interface RegionMapElement {
  id: string;
  regionId: string;
  assetId: string;
  assetUrl?: string; // URL from joined asset
  x: number;
  y: number;
  zIndex: number;
  createdAt: string;
}

// Public facility definition
export interface PublicFacility {
  id: string;
  regionId: string;
  plotId: string | null;
  facilityType: FacilityType;
  name: string;
  level: number;
  position: { x: number; y: number };
  config: FacilityConfig;
  customImageUrl?: string;
  customAssetId?: string;
  transform?: import("./city").CityTransformData;
  createdAt: string;
  updatedAt: string;
}

// Facility configuration
export interface FacilityConfig {
  capacity?: number;
  features?: string[];
  schedule?: Record<string, unknown>;
  rewards?: Record<string, number>;
  description?: string;
  customImageUrl?: string; // Legacy support or direct override
  transform?: import("./city").CityTransformData;
}

// City visit record
export interface CityVisit {
  id: string;
  visitorId: string;
  visitorName?: string;
  cityOwnerId: string;
  cityOwnerName?: string;
  visitedAt: string;
}

// Region view state
export interface RegionViewState {
  selectedPlotId: string | null;
  hoveredPlotId: string | null;
  selectedFacilityId: string | null;
  cameraOffset: { x: number; y: number };
  zoom: number;
  showFacilityModal: FacilityType | null;
}

// Region with plots and facilities (full data)
export interface RegionData extends Region {
  plots: RegionPlot[];
  facilities: PublicFacility[];
  mapElements: RegionMapElement[];
}

// Facility display info for UI
export interface FacilityDisplayInfo {
  type: FacilityType;
  icon: string;
  label: string;
  color: string;
  description: string;
}

// Facility display map
export const FACILITY_DISPLAY_INFO: Record<FacilityType, FacilityDisplayInfo> = {
  park: {
    type: 'park',
    icon: '🌳',
    label: '公園',
    color: 'hsl(120, 60%, 40%)',
    description: '社交空間，每日訪問可獲得金幣獎勵'
  },
  school: {
    type: 'school',
    icon: '🏫',
    label: '學校',
    color: 'hsl(15, 70%, 50%)',
    description: '學習挑戰，參加可獲得經驗值加成'
  },
  library: {
    type: 'library',
    icon: '📚',
    label: '圖書館',
    color: 'hsl(30, 50%, 40%)',
    description: '瀏覽其他玩家分享的記憶內容'
  },
  town_hall: {
    type: 'town_hall',
    icon: '🏛️',
    label: '市政廳',
    color: 'hsl(0, 0%, 70%)',
    description: '地區統計數據與玩家排行榜'
  },
  train_station: {
    type: 'train_station',
    icon: '🚉',
    label: '火車站',
    color: 'hsl(0, 0%, 50%)',
    description: '快速傳送到其他玩家的城市'
  },
  marketplace: {
    type: 'marketplace',
    icon: '🏪',
    label: '市場',
    color: 'hsl(45, 80%, 50%)',
    description: '交易物品與資源'
  },
  bookstore: {
    type: 'bookstore',
    icon: '📚',
    label: '書店',
    color: 'hsl(25, 70%, 45%)',
    description: '上傳與購買精華筆記、各種心血結晶'
  },
  cafe: {
    type: 'cafe',
    icon: '☕',
    label: '咖啡廳',
    color: 'hsl(330, 60%, 55%)',
    description: '分享心情點滴，互相打氣安慰的角落'
  }
};
