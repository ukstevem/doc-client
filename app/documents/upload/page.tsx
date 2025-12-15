'use client';

import React, { useMemo, useState } from 'react';

type ContextType = 'project' | 'enquiry';

interface UploadResult {
  filename: string;
  size: number;
  type: string;
  storagePath: string | null;
  error?: string;
}

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function uploadWithProgress(formData: FormData, onProgress: (pct: number) => void) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      onProgress(pct);
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error('Bad JSON response from /api/upload'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

export default function UploadPage() {
  const [contextType, setContextType] = useState<ContextType>('project');
  const [projectNumber, setProjectNumber] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<UploadResult[]>([]);

  const pickedFiles = useMemo(() => (files ? Array.from(files) : []), [files]);
  const totalBytes = useMemo(
    () => pickedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
    [pickedFiles],
  );

  function validate(): string | null {
    if (!files || files.length === 0) return 'Select at least one PDF.';
    if (contextType === 'project' && !projectNumber.trim()) return 'Enter a project number.';
    if (contextType === 'enquiry' && !enquiryNumber.trim()) return 'Enter an enquiry number.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    setResults([]);
    setProgress(0);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!files) {
      setError('No files selected.');
      return;
    }

    const fd = new FormData();
    fd.append('contextType', contextType);
    if (contextType === 'project') fd.append('projectNumber', projectNumber.trim());
    if (contextType === 'enquiry') fd.append('enquiryNumber', enquiryNumber.trim());

    for (const f of Array.from(files)) fd.append('files', f);

    setSubmitting(true);

    try {
      const data = await uploadWithProgress(fd, setProgress);

      if (!data || data.ok !== true) {
        setError(data?.error || 'Upload API returned an error.');
        return;
      }

      const mapped: UploadResult[] = (data.files || []).map((f: any) => ({
        filename: f.filename,
        size: f.size,
        type: f.type,
        storagePath: f.storagePath,
        error: f.error,
      }));

      setResults(mapped);

      const ctxLabel =
        contextType === 'project'
          ? `project ${projectNumber.trim()}`
          : `enquiry ${enquiryNumber.trim()}`;

      setMessage(`Uploaded ${mapped.length} file(s) linked to ${ctxLabel}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected upload error.');
    } finally {
      setSubmitting(false);
      setTimeout(() => setProgress(0), 600);
    }
  }

  const pill = (active: boolean) => ({
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    background: active ? '#111827' : '#ffffff',
    color: active ? '#ffffff' : '#111827',
    fontSize: '0.85rem',
    cursor: submitting ? 'default' : 'pointer',
    opacity: submitting ? 0.7 : 1,
  });

  return (
    <div style={{ maxWidth: 760, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Upload</h1>
        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          PDFs → NAS + <code>document_files</code>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          {/* Row: context + id */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setContextType('project')}
                style={pill(contextType === 'project')}
              >
                Project
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setContextType('enquiry')}
                style={pill(contextType === 'enquiry')}
              >
                Enquiry
              </button>
            </div>

            {contextType === 'project' ? (
              <input
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                placeholder="Project number (e.g. 10001)"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  fontSize: '0.95rem',
                }}
              />
            ) : (
              <input
                value={enquiryNumber}
                onChange={(e) => setEnquiryNumber(e.target.value)}
                placeholder="Enquiry number (e.g. 55555)"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  fontSize: '0.95rem',
                }}
              />
            )}
          </div>

          {/* Row: file picker */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div>
              <input
                type="file"
                accept="application/pdf"
                multiple
                disabled={submitting}
                onChange={(e) => setFiles(e.target.files)}
                style={{ fontSize: '0.95rem' }}
              />
              <div style={{ marginTop: 6, fontSize: '0.85rem', color: '#6b7280' }}>
                {pickedFiles.length > 0 ? (
                  <>
                    Selected <b>{pickedFiles.length}</b> file(s) • {formatMb(totalBytes)}
                  </>
                ) : (
                  'Select one or more PDFs'
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 14px',
                borderRadius: 10,
                border: 'none',
                background: submitting ? '#6b7280' : '#111827',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Uploading…' : 'Upload'}
            </button>
          </div>

          {/* Progress */}
          {submitting && (
            <div style={{ display: 'grid', gap: 6 }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: '#e5e7eb',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: '#111827',
                    transition: 'width 120ms linear',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{progress}%</div>
            </div>
          )}

          {/* Messages */}
          {error && <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{error}</div>}
          {message && <div style={{ color: '#15803d', fontSize: '0.9rem' }}>{message}</div>}
        </div>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>Results</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {results.map((r) => {
              const ok = !r.error && r.storagePath;
              return (
                <div
                  key={`${r.filename}-${r.storagePath ?? 'x'}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: ok ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.filename}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {formatMb(r.size)} • {r.type || 'unknown'}
                      {ok && (
                        <>
                          {' '}
                          • <code>{r.storagePath}</code>
                        </>
                      )}
                    </div>
                    {!ok && r.error && (
                      <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>{r.error}</div>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, color: ok ? '#15803d' : '#b91c1c' }}>
                    {ok ? 'OK' : 'FAIL'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
