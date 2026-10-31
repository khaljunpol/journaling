import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
          borderRadius: 112,
        }}
      >
        {/* Journal page lines */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '64px 72px',
            width: '100%',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 14,
                borderRadius: 7,
                background: i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                width: i === 0 ? '100%' : i === 3 ? '60%' : '85%',
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
