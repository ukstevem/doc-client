// app/page.tsx
// Dashboard showing recent document_files grouped by project / enquiry,
// with NAS paths rendered as optional links via doc-gateway.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface DocumentFileRow {
  id: string | number;
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

/* --------- Small helpers --------- */

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

async function fetchRecentDocuments(
  limit: number,
): Promise<DocumentFileRow[]> {
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

  return data as DocumentFileRow[];
}

function groupDocuments(
  rows: DocumentFileRow[],
): DocumentGroup[] {
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
  // Remove any trailing slashes so we can safely append paths.
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

/* --------- Page component --------- */

export default async function HomePage() {
  const rows = await fetchRecentDocuments(50);
  const groups = groupDocuments(rows);
  const gatewayBaseUrl = getGatewayBaseUrl();

  return (
    <div style={{ maxWidth: 900 }}>
      <h1
        style={{
          fontSize: '1.6rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          color: '#0f172a',
        }}
      >
        Document control dashboard
      </h1>

      <p
        style={{
          fontSize: '0.95rem',
          color: '#475569',
          marginBottom: '1rem',
        }}
      >
        Recent uploads from <code>document_files</code>, grouped by project or
        enquiry. Files are stored on the NAS; the worker will update status,
        page counts and previews as it processes each file.
      </p>

      {groups.length === 0 && (
        <p
          style={{
            fontSize: '0.9rem',
            color: '#64748b',
          }}
        >
          No documents found yet. Upload some PDFs on the{' '}
          <code>Upload documents</code> page.
        </p>
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem 0.9rem',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: '#0f172a',
            }}
          >
            {group.label}
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.3rem 0.4rem',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    File
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.3rem 0.4rem',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.3rem 0.4rem',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    Pages
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.3rem 0.4rem',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    Size
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.3rem 0.4rem',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    NAS path
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const link = buildGatewayUrl(
                    gatewayBaseUrl,
                    row.storage_object_path,
                  );

                  return (
                    <tr key={row.id}>
                      <td
                        style={{
                          padding: '0.3rem 0.4rem',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <code>{row.original_filename}</code>
                      </td>
                      <td
                        style={{
                          padding: '0.3rem 0.4rem',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        {row.status || '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.3rem 0.4rem',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        {row.page_count ?? '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.3rem 0.4rem',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        {formatSize(row.file_size_bytes)}
                      </td>
                      <td
                        style={{
                          padding: '0.3rem 0.4rem',
                          borderBottom: '1px solid #f1f5f9',
                          maxWidth: 260,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                        }}
                        title={row.storage_object_path}
                      >
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
      ))}
    </div>
  );
}
