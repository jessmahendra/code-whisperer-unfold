
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Screenshot } from '@/services/screenshotService';

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  className?: string;
}

export default function ScreenshotGallery({ screenshots, className }: ScreenshotGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (!screenshots || screenshots.length === 0) {
    return null;
  }

  const currentScreenshot = screenshots[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
  };

  const openModal = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsZoomed(false);
  };

  return (
    <>
      <Card className={`${className} mb-4`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                Visual Guide {screenshots.length > 1 && `(${currentIndex + 1}/${screenshots.length})`}
              </h3>
              <div className="flex gap-2">
                {screenshots.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPrevious}
                      disabled={screenshots.length <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNext}
                      disabled={screenshots.length <= 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openModal}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <img
                src={currentScreenshot.url}
                alt={currentScreenshot.caption}
                className="w-full h-auto max-h-64 object-contain rounded-md border cursor-pointer"
                onClick={openModal}
              />
              {currentScreenshot.stepNumber && (
                <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {currentScreenshot.stepNumber}
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600">
              {currentScreenshot.caption}
            </div>

            {screenshots.length > 1 && (
              <div className="flex gap-1 justify-center">
                {screenshots.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal for zoomed view */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
              onClick={closeModal}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-4">
              {screenshots.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              
              <img
                src={currentScreenshot.url}
                alt={currentScreenshot.caption}
                className={`max-w-full max-h-full object-contain transition-transform ${
                  isZoomed ? 'scale-150' : 'scale-100'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
              />
              
              {screenshots.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
            </div>
            
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <div className="bg-black/50 text-white px-4 py-2 rounded-md">
                {currentScreenshot.caption}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
