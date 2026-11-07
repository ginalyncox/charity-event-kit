import { ImageResponse } from 'next/og';
import { ICON_SVG } from '@/lib/icon-svg';

const SRC = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString('base64')}`;

/** App icons: the trophy-with-heart mark. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = [180, 192, 512].includes(Number(size)) ? Number(size) : 192;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <img src={SRC} width={px} height={px} alt="" />
      </div>
    ),
    { width: px, height: px, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
