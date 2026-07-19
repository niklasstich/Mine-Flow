import React from 'react';

// Atlas is a fixed 256-column grid of 32px sprites (iconId = row*256 + col),
// matching gtnh/src/itemIcon.ts's convention -- see services/gtnhCatalog.ts.
const ATLAS_COLUMNS = 256;
const SPRITE_SIZE = 32;

interface GtnhIconProps {
  atlasUrl: string;
  iconId: number;
  size?: number;
  title?: string;
  className?: string;
}

export const GtnhIcon: React.FC<GtnhIconProps> = ({ atlasUrl, iconId, size = 32, title, className }) => {
  const col = iconId % ATLAS_COLUMNS;
  const row = Math.floor(iconId / ATLAS_COLUMNS);
  const scale = size / SPRITE_SIZE;

  return (
    <div
      className={className}
      title={title}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        backgroundImage: `url(${atlasUrl})`,
        backgroundPosition: `${-col * SPRITE_SIZE * scale}px ${-row * SPRITE_SIZE * scale}px`,
        backgroundSize: `${ATLAS_COLUMNS * SPRITE_SIZE * scale}px auto`,
        imageRendering: 'pixelated',
      }}
    />
  );
};
