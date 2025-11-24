// app/pages/[pageId]/titleblock/page.tsx

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import TitleblockAnnotator from './TitleblockAnnotator';

type PageProps = {
  params: Promise<{ pageId: string }>;
};

interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type FieldKey = 'drawing_number' | 'drawing_title' | 'revision' | 'other';

interface FingerprintClick {
  field: FieldKey;
  x_rel: number;
  y_rel: number;
}

interface PageRow {
  id: string;
  document_id: string;
  page_number: number;
  image_object_path: string | null;
  status: string | null;
  titleblock_x: number | null;
  titleblock_y: number | null;
  titleblock_width: number | null;
  titleblock_height: number | null;
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

function parseFingerprint(value: unknown): FingerprintClick[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const obj = value as { clicks?: unknown[] };
  if (!Array.isArray(obj.clicks)) {
    return [];
  }

  const result: FingerprintClick[] = [];
  const fields: FieldKey[] = [
    'drawing_number',
    'drawing_title',
    'revision',
    'other',
  ];

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
    if (!fields.includes(fieldRaw as FieldKey)) {
      continue;
    }

    const xNum = typeof xRaw === 'number' ? xRaw : Number(xRaw);
    const yNum = typeof yRaw === 'number' ? yRaw : Number(yRaw);

    if (Number.isNaN(xNum) || Number.isNaN(yNum)) {
      continue;
    }

    result.push({
      field: fieldRaw as FieldKey,
      x_rel: xNum,
      y_rel: yNum,
    });
  }

  return result;
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

  const initialTitleblockRect: PixelRect | null =
    row.titleblock_x !== null &&
    row.titleblock_y !== null &&
    row.titleblock_width !== null &&
    row.titleblock_height !== null
      ? {
          x: row.titleblock_x,
          y: row.titleblock_y,
          width: row.titleblock_width,
          height: row.titleblock_height,
        }
      : null;

  const initialClicks = parseFingerprint(row.titleblock_fingerprint);

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
        initialTitleblockRect={initialTitleblockRect}
        initialClicks={initialClicks}
      />
    </div>
  );
}
