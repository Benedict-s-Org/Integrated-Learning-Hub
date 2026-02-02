import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegion } from '@/hooks/useRegion';
import { RegionMap } from '@/components/region';
import { Loader2 } from 'lucide-react';

export function RegionPage() {
  const navigate = useNavigate();
  const { region, loading, error } = useRegion();

  const handleNavigateToCity = (ownerId: string) => {
    // Navigate to the city page with the owner's ID
    // For now, just navigate to the main city page
    navigate('/city');
  };

  const handleNavigateHome = () => {
    navigate('/city');
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">載入大地區地圖...</p>
        </div>
      </div>
    );
  }

  if (error || !region) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">無法載入大地區</p>
          <p className="text-muted-foreground">{error || '找不到地區資料'}</p>
          <button
            onClick={() => navigate('/city')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            返回城市
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <RegionMap
        region={region}
        onNavigateToCity={handleNavigateToCity}
        onNavigateHome={handleNavigateHome}
      />
    </div>
  );
}

export default RegionPage;
