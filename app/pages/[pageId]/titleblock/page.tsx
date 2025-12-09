// app/pages/[pageId]/titleblock/page.tsx

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import TitleblockAnnotator from './TitleblockAnnotator';

type PageProps = {
  params: Promise<{ pageId: string }>;
};

type FieldKey = 'drawing_number' | 'drawing_title' | 'revision' | 'other';

interface NormalisedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FieldArea {
  field: FieldKey;
  x_rel: number;
  y_rel: number;
  width_rel: number;
  height_rel: number;
}

interface PageRow {
  id: string;
  document_id: string;
  page_number: number;
  image_object_path: string | null;
  status: string | null;
  titleblock_x: number | null;       // normalised 0–1
  titleblock_y: number | null;       // normalised 0–1
  titleblock_width: number | null;   // normalised 0–1
  titleblock_height: number | null;  // normalised 0–1
  titleblock_fingerprint: unknown | null;
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createSupabaseServerClient(): SupabaseClient {
  const url = readEnv('SUPABASE_URL');
  const key = readEnv('SUPABASE_SECRET_KEY');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function getGatewayBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_DOC_GATEWAY_BASE_URL;
  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_DOC_GATEWAY_BASE_URL is not set. Cannot build image URL.',
    );
  }
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error(
      'NEXT_PUBLIC_DOC_GATEWAY_BASE_URL is empty after trimming.',
    );
  }
  return trimmed;
}

function buildGatewayUrl(baseUrl: string, storagePath: string): string {
  const relative = storagePath.replace(/^\/+/, '');
  return `${baseUrl}/${relative}`;
}

// Convert stored fingerprint to field areas (rects inside title-block).
// Supports both version 2 (areas) and legacy version 1 (clicks -> small areas).
function parseFingerprint(value: unknown): FieldArea[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const obj = value as {
    version?: unknown;
    areas?: unknown[];
    clicks?: unknown[];
  };

  const version =
    typeof obj.version === 'number' ? obj.version : 1;
  const validFields: FieldKey[] = [
    'drawing_number',
    'drawing_title',
    'revision',
    'other',
  ];

  const result: FieldArea[] = [];

  // Preferred: version 2 with "areas"
  if (Array.isArray(obj.areas)) {
    for (const item of obj.areas) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const rec = item as Record<string, unknown>;
      const fieldRaw = rec.field;
      const xRaw = rec.x_rel;
      const yRaw = rec.y_rel;
      const wRaw = rec.width_rel;
      const hRaw = rec.height_rel;

      if (typeof fieldRaw !== 'string') {
        continue;
      }
      if (!validFields.includes(fieldRaw as FieldKey)) {
        continue;
      }

      const xNum = typeof xRaw === 'number' ? xRaw : Number(xRaw);
      const yNum = typeof yRaw === 'number' ? yRaw : Number(yRaw);
      const wNum = typeof wRaw === 'number' ? wRaw : Number(wRaw);
      const hNum = typeof hRaw === 'number' ? hRaw : Number(hRaw);

      if (
        Number.isNaN(xNum) ||
        Number.isNaN(yNum) ||
        Number.isNaN(wNum) ||
        Number.isNaN(hNum)
      ) {
        continue;
      }

      result.push({
        field: fieldRaw as FieldKey,
        x_rel: xNum,
        y_rel: yNum,
        width_rel: wNum,
        height_rel: hNum,
      });
    }
    return result;
  }

  // Legacy: version 1 with "clicks" (points inside title-block).
  // We approximate each point as a small 0.15×0.15 rect centred on the click.
  if (version === 1 && Array.isArray(obj.clicks)) {
    const fallbackW = 0.15;
    const fallbackH = 0.15;

    for (const item of obj.clicks) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const rec = item as Record<string, unknown>;
      const fieldRaw = rec.field;
      const xRaw = rec.x_rel ?? rec.x;
      const yRaw = rec.y_rel ?? rec.y;

      if (typeof fieldRaw !== 'string') {
        continue;
      }
      if (!validFields.includes(fieldRaw as FieldKey)) {
        continue;
      }

      const xNum = typeof xRaw === 'number' ? xRaw : Number(xRaw);
      const yNum = typeof yRaw === 'number' ? yRaw : Number(yRaw);

      if (Number.isNaN(xNum) || Number.isNaN(yNum)) {
        continue;
      }

      const cx = Math.min(Math.max(xNum, 0), 1);
      const cy = Math.min(Math.max(yNum, 0), 1);

      let left = cx - fallbackW / 2;
      let top = cy - fallbackH / 2;
      if (left < 0) {
        left = 0;
      }
      if (top < 0) {
        top = 0;
      }

      let width = fallbackW;
      let height = fallbackH;
      if (left + width > 1) {
        width = 1 - left;
      }
      if (top + height > 1) {
        height = 1 - top;
      }

      if (width <= 0 || height <= 0) {
        continue;
      }

      result.push({
        field: fieldRaw as FieldKey,
        x_rel: left,
        y_rel: top,
        width_rel: width,
        height_rel: height,
      });
    }
  }

  return result;
}

// Interpret stored title-block coords as normalised only if they are sane (0–1).
function toInitialNormalisedRect(row: PageRow): NormalisedRect | null {
  const { titleblock_x, titleblock_y, titleblock_width, titleblock_height } =
    row;

  if (
    titleblock_x === null ||
    titleblock_y === null ||
    titleblock_width === null ||
    titleblock_height === null
  ) {
    return null;
  }

  const x = titleblock_x;
  const y = titleblock_y;
  const w = titleblock_width;
  const h = titleblock_height;

  const inRange =
    x >= 0 &&
    x <= 1 &&
    y >= 0 &&
    y <= 1 &&
    w > 0 &&
    w <= 1 &&
    h > 0 &&
    h <= 1;

  if (!inRange) {
    // Legacy / bad values: treat as "no title-block yet".
    return null;
  }

  return {
    left: x,
    top: y,
    width: w,
    height: h,
  };
}

export default async function TitleblockPage(props: PageProps) {
  const { pageId } = await props.params;

  if (!pageId) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Invalid parameters
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>
          The page id is missing from the route.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('document_pages')
    .select(
      [
        'id',
        'document_id',
        'page_number',
        'image_object_path',
        'status',
        'titleblock_x',
        'titleblock_y',
        'titleblock_width',
        'titleblock_height',
        'titleblock_fingerprint',
      ].join(','),
    )
    .eq('id', pageId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching document_pages row:', error);
  }

  if (!data) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Page not found
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>
          No <code>document_pages</code> record was found for id{' '}
          <code>{pageId}</code>.
        </p>
      </div>
    );
  }

  const row = data as PageRow;

  if (!row.image_object_path) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Image not available
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>
          The worker has not yet rendered a page image for this sheet.
        </p>
      </div>
    );
  }

  const gatewayBase = getGatewayBaseUrl();
  const imageUrl = buildGatewayUrl(gatewayBase, row.image_object_path);

  const initialTitleblockRectNorm = toInitialNormalisedRect(row);
  const initialAreas = parseFingerprint(row.titleblock_fingerprint);

  return (
    <div style={{ padding: '1rem', maxWidth: 1100 }}>
      <h1
        style={{
          fontSize: '1.4rem',
          fontWeight: 600,
          marginBottom: '0.25rem',
          color: '#0f172a',
        }}
      >
        Title-block annotation
      </h1>
      <p
        style={{
          fontSize: '0.9rem',
          color: '#4b5563',
          marginBottom: '0.75rem',
        }}
      >
        Page <code>{row.id}</code> (document <code>{row.document_id}</code>),
        page number {row.page_number}. Status:{' '}
        <code>{row.status || 'unknown'}</code>
      </p>

      <TitleblockAnnotator
        pageId={row.id}
        imageUrl={imageUrl}
        initialTitleblockRectNorm={initialTitleblockRectNorm}
        initialAreas={initialAreas}
      />
    </div>
  );
}
