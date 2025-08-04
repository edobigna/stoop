import React, { useState } from 'react';
import { DEFAULT_AD_IMAGE_PLACEHOLDER, DEFAULT_AD_IMAGE_PLACEHOLDER_ALT } from '../constants';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2';

interface ImageCarouselProps {
  images?: string[];
  altText?: string;
  className?: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  altText = DEFAULT_AD_IMAGE_PLACEHOLDER_ALT,
  className = "w-full h-64 sm:h-80 md:h-96",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayImages = images && images.length > 0 ? images : [DEFAULT_AD_IMAGE_PLACEHOLDER];

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? displayImages.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === displayImages.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };
  
  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  };

  if (!displayImages || displayImages.length === 0) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`}>
        <img src={DEFAULT_AD_IMAGE_PLACEHOLDER} alt={altText} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`${className} relative group bg-gray-100 overflow-hidden`}>
      <div
        style={{ backgroundImage: `url(${displayImages[currentIndex]})` }}
        className="w-full h-full bg-center bg-cover duration-500 transition-transform ease-in-out"
        role="img"
        aria-label={`${altText} - Immagine ${currentIndex + 1} di ${displayImages.length}`}
      ></div>
      {displayImages.length > 1 && (
        <>
          {/* Left Arrow */}
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 left-3 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 z-10"
            aria-label="Immagine precedente"
          >
            <HiOutlineChevronLeft className="w-5 h-5" />
          </button>
          {/* Right Arrow */}
          <button
            onClick={goToNext}
            className="absolute top-1/2 right-3 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 z-10"
            aria-label="Immagine successiva"
          >
            <HiOutlineChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
            {displayImages.map((_, slideIndex) => (
              <button
                key={slideIndex}
                onClick={() => goToSlide(slideIndex)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  currentIndex === slideIndex ? 'bg-white ring-1 ring-gray-500' : 'bg-gray-400/70 hover:bg-white/90'
                }`}
                aria-label={`Vai a immagine ${slideIndex + 1}`}
              ></button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
