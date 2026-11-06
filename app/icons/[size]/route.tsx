import { ImageResponse } from 'next/og';

/** App icons drawn on the fly: the orange "CE" mark. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = [180, 192, 512].includes(Number(size)) ? Number(size) : 192;
  const maskable = new URL(req.url).searchParams.has('maskable');
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#d9481f',
          borderRadius: maskable ? 0 : px * 0.22,
          color: '#fff',
          fontSize: px * (maskable ? 0.34 : 0.42),
          fontWeight: 900,
          letterSpacing: -px * 0.01,
        }}
      >
        CE
      </div>
    ),
    { width: px, height: px, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
