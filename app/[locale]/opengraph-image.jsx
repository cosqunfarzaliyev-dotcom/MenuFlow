import { ImageResponse } from 'next/og';
import { getMarketingDictionary } from '@/lib/i18n/server';

// Applies to every page under app/[locale]/ (nearest-segment convention —
// none of the six marketing pages defines its own opengraph-image, so all
// of them inherit this one). Code-generated, not a static asset: no image
// file to keep in sync with the tagline, and it can localize the headline
// per locale for free.
export const alt = 'MenuFlow';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }) {
  const { locale } = await params;
  const { t } = getMarketingDictionary(locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: '#FBF6EC',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#2A2115', marginBottom: 28 }}>
          MenuFlow
        </div>
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 800, color: '#2A2115', lineHeight: 1.15, maxWidth: 980 }}>
          {t('metaSiteTitle').replace('MenuFlow — ', '')}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#6B5D46', marginTop: 28, maxWidth: 900 }}>
          {t('metaSiteDescription')}
        </div>
      </div>
    ),
    { ...size },
  );
}
