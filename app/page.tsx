// app/page.tsx
// Dashboard showing recent document_files grouped by project / enquiry,
// with per-drawing metadata coming from document_pages (page 1).
//
// Title-block / OCR metadata:
//   document_pages.drawing_number
//   document_pages.drawing_title
//   document_pages.revision
//
// Files live on the NAS via doc-gateway; thumbnails are page-1 PNGs.

import Link from 'next/link';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/* ------------ Types ------------ */

interface DocumentFileRow {
  id: string;
  enquirynumber: string | null;
  projectnumber: string | null;
  original_filename: string;
  storage_object_path: string;
  status: string;
  file_size_bytes: number | null;
  page_count: number | null;
}

interface DocumentGroup {
  key: string;
  label: string;
  rows: DocumentFileRow[];
}

interface PageSummaryRow {
  id: string;
  document_id: string;
  page_number: number;
  image_object_path: string | null;
  status: string | null;
  drawing_number: string | null;
  drawing_title: string | null;
  revision: string | null;
}

interface PageSummary {
  pageId: string;
  imagePath: string | null;
  status: string | null;
  drawing_number: string | null;
  drawing_title: string | null;
  revision: string | null;
}

/* ------------ Helpers ------------ */

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

async function fetchRecentDocuments(limit: number): Promise<DocumentFileRow[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('document_files')
    .select(
      [
        'id',
        'enquirynumber',
        'projectnumber',
        'original_filename',
        'storage_object_path',
        'status',
        'file_size_bytes',
        'page_count',
      ].join(','),
    )
    .order('id', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('Error fetching document_files:', error);
    return [];
  }

  return data as unknown as DocumentFileRow[];
}

async function fetchPageSummariesForDocuments(
  documentIds: string[],
): Promise<Map<string, PageSummary>> {
  const map = new Map<string, PageSummary>();

  if (documentIds.length === 0) {
    return map;
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
        'drawing_number',
        'drawing_title',
        'revision',
      ].join(','),
    )
    .in('document_id', documentIds)
    .eq('page_number', 1);

  if (error || !data) {
    console.error('Error fetching document_pages:', error);
    return map;
  }

  const rows = data as unknown as PageSummaryRow[];

  for (const row of rows) {
    if (!map.has(row.document_id)) {
      map.set(row.document_id, {
        pageId: row.id,
        imagePath: row.image_object_path,
        status: row.status,
        drawing_number: row.drawing_number,
        drawing_title: row.drawing_title,
        revision: row.revision,
      });
    }
  }

  return map;
}

function groupDocuments(rows: DocumentFileRow[]): DocumentGroup[] {
  const groups = new Map<string, DocumentGroup>();

  for (const row of rows) {
    let key: string;
    let label: string;

    if (row.projectnumber) {
      key = `project:${row.projectnumber}`;
      label = `Project ${row.projectnumber}`;
    } else if (row.enquirynumber) {
      key = `enquiry:${row.enquirynumber}`;
      label = `Enquiry ${row.enquirynumber}`;
    } else {
      key = 'unassigned';
      label = 'Unassigned';
    }

    let group = groups.get(key);
    if (!group) {
      group = { key, label, rows: [] };
      groups.set(key, group);
    }

    group.rows.push(row);
  }

  const result = Array.from(groups.values());
  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
}

// Sort by drawing_number then revision, based on page-1 metadata.
function sortRowsForDisplay(
  rows: DocumentFileRow[],
  pageMap: Map<string, PageSummary>,
): DocumentFileRow[] {
  const copy = [...rows];

  copy.sort((a, b) => {
    const aMeta = pageMap.get(a.id) || null;
    const bMeta = pageMap.get(b.id) || null;

    const aNum =
      aMeta?.drawing_number && aMeta.drawing_number.trim().length > 0
        ? aMeta.drawing_number
        : '\uffff';
    const bNum =
      bMeta?.drawing_number && bMeta.drawing_number.trim().length > 0
        ? bMeta.drawing_number
        : '\uffff';

    const numCompare = aNum.localeCompare(bNum, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (numCompare !== 0) {
      return numCompare;
    }

    const aRev =
      aMeta?.revision && aMeta.revision.trim().length > 0
        ? aMeta.revision
        : '\uffff';
    const bRev =
      bMeta?.revision && bMeta.revision.trim().length > 0
        ? bMeta.revision
        : '\uffff';

    return aRev.localeCompare(bRev, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return copy;
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return '-';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  const rounded = Math.round(kb * 10) / 10;
  return `${rounded.toFixed(1)} kB`;
}

function getGatewayBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_DOC_GATEWAY_BASE_URL;
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

function buildGatewayUrl(
  baseUrl: string | null,
  storagePath: string,
): string | null {
  if (!baseUrl) {
    return null;
  }
  const relative = storagePath.replace(/^\/+/, '');
  return `${baseUrl}/${relative}`;
}

// Fallback title when drawing_title is not yet populated.
function deriveDrawingTitle(row: DocumentFileRow): string {
  const name = row.original_filename || '';
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0) {
    return name.slice(0, lastDot);
  }
  return name;
}

/* ------------ Page component ------------ */

export default async function HomePage() {
  const rows = await fetchRecentDocuments(50);
  const groups = groupDocuments(rows);
  const gatewayBaseUrl = getGatewayBaseUrl();
  const docIds = rows.map((row) => row.id);
  const pageMap = await fetchPageSummariesForDocuments(docIds);

  return (
    <main style={{ padding: '1rem 2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Document control dashboard</h1>
      <p style={{ marginBottom: '0.5rem' }}>
        Recent uploads from <code>document_files</code>, grouped by project or enquiry.
        Drawing metadata (number, title, revision) comes from{' '}
        <code>document_pages</code> (page 1) after title-block tagging and OCR.
      </p>
      <p style={{ marginBottom: '1rem' }}>
        Click a thumbnail to open the title-block annotator for that page.
      </p>

      {groups.length === 0 && (
        <p>
          No documents found yet. Upload some PDFs on the{' '}
          <Link href="/documents/upload">Upload documents</Link> page.
        </p>
      )}

      {groups.map((group) => {
        const sortedRows = sortRowsForDisplay(group.rows, pageMap);

        return (
          <section key={group.key} style={{ marginTop: '2rem' }}>
            <h2>{group.label}</h2>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Preview
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Drawing number
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Drawing title
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Revision
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Status
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Pages
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      Size
                    </th>
                    <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
                      NAS path
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const page = pageMap.get(row.id) || null;
                    const thumbUrl =
                      page?.imagePath && gatewayBaseUrl
                        ? buildGatewayUrl(gatewayBaseUrl, page.imagePath)
                        : null;
                    const pdfLink = buildGatewayUrl(
                      gatewayBaseUrl,
                      row.storage_object_path,
                    );

                    const drawingNumber = page?.drawing_number || '';
                    const drawingTitle =
                      page?.drawing_title ||
                      (deriveDrawingTitle(row) || '');
                    const revision = page?.revision || '';

                    return (
                      <tr key={row.id}>
                        <td
                          style={{
                            borderBottom: '1px solid #eee',
                            padding: '0.5rem',
                            textAlign: 'center',
                          }}
                        >
                          {thumbUrl && page ? (
                            <Link href={`/pages/${page.pageId}/titleblock`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={thumbUrl}
                                alt="Page 1 preview"
                                style={{
                                  maxWidth: '120px',
                                  maxHeight: '120px',
                                  border: '1px solid #ccc',
                                }}
                              />
                            </Link>
                          ) : (
                            <span>–</span>
                          )}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {drawingNumber || '–'}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {drawingTitle || '–'}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {revision || '–'}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {row.status || '-'}
                          {page?.status && page.status !== row.status
                            ? ` (page: ${page.status})`
                            : ''}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {row.page_count ?? '-'}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {formatSize(row.file_size_bytes)}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                          {pdfLink ? (
                            <a href={pdfLink} target="_blank" rel="noreferrer">
                              {row.storage_object_path}
                            </a>
                          ) : (
                            row.storage_object_path
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
