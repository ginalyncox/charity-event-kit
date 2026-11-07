import { ImageResponse } from 'next/og';
import { ICON_SVG } from '@/lib/icon-svg';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const SRC = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString('base64')}`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <img src={SRC} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
