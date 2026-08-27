import { useState } from 'react';

interface ProductImageGalleryProps {
  images: string[];
  alt: string;
}

export function ProductImageGallery({ images, alt }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

  return (
    <div>
      <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-stone-100">
        <img src={activeImage} alt={alt} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Ver imagen ${index + 1}`}
              className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                index === activeIndex ? 'border-brand-600' : 'border-transparent'
              }`}
            >
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
