// app/documents/upload/page.tsx

'use client';

import { useState, FormEvent } from 'react';

type ContextType = 'project' | 'enquiry';

interface UploadResult {
  filename: string;
  size: number;
  type: string;
  storagePath: string | null;
  error?: string;
}

export default function UploadPage() {
  const [contextType, setContextType] = useState<ContextType>('project');
  const [projectNumber, setProjectNumber] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<UploadResult[]>([]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFiles(event.target.files);
  }

  function validateInputs(): string | null {
    if (!files || files.length === 0) {
      return 'Please select at least one PDF file.';
    }

    if (contextType === 'project' && !projectNumber.trim()) {
      return 'Please enter a project number.';
    }

    if (contextType === 'enquiry' && !enquiryNumber.trim()) {
      return 'Please enter an enquiry number.';
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setResults([]);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!files) {
      setError('No files selected.');
      return;
    }

    const formData = new FormData();
    formData.append('contextType', contextType);

    if (contextType === 'project') {
      formData.append('projectNumber', projectNumber.trim());
    } else {
      formData.append('enquiryNumber', enquiryNumber.trim());
    }

    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    setSubmitting(true);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'Upload API returned an error.');
        return;
      }

      const mapped: UploadResult[] = (data.files || []).map(
        (f: {
          filename: string;
          size: number;
          type: string;
          storagePath: string | null;
          error?: string;
        }) => ({
          filename: f.filename,
          size: f.size,
          type: f.type,
          storagePath: f.storagePath,
          error: f.error,
        }),
      );

      setResults(mapped);

      const ctxLabel =
        contextType === 'project'
          ? `project ${projectNumber.trim()}`
          : `enquiry ${enquiryNumber.trim()}`;

      setMessage(
        `Upload complete. ${
          mapped.length
        } file(s) linked to ${ctxLabel} and queued for worker processing.`,
      );
    } catch (err) {
      console.error(err);
      setError('Unexpected error while calling /api/upload.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
        }}
      >
        Upload documents
      </h1>
      <p
        style={{
          fontSize: '0.9rem',
          color: '#555',
          marginBottom: '1rem',
        }}
      >
        Choose a project <strong>or</strong> enquiry and upload one or more PDF
        files. Files are written to the NAS and a minimal{' '}
        <code>document_files</code> row is created for the worker to process.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Context selector */}
        <div
          style={{
            marginBottom: '0.75rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Link files to:
          </span>

          <label style={{ fontSize: '0.85rem' }}>
            <input
              type="radio"
              name="contextType"
              value="project"
              checked={contextType === 'project'}
              onChange={() => setContextType('project')}
              style={{ marginRight: '0.25rem' }}
            />
            Project
          </label>

          <label style={{ fontSize: '0.85rem' }}>
            <input
              type="radio"
              name="contextType"
              value="enquiry"
              checked={contextType === 'enquiry'}
              onChange={() => setContextType('enquiry')}
              style={{ marginRight: '0.25rem' }}
            />
            Enquiry
          </label>
        </div>

        {/* Project OR enquiry field */}
        {contextType === 'project' ? (
          <div style={{ marginBottom: '0.75rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              Project number
            </label>
            <input
              type="text"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="e.g. 10001"
              style={{
                width: '100%',
                padding: '0.25rem',
                fontSize: '0.9rem',
              }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: '0.75rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              Enquiry number
            </label>
            <input
              type="text"
              value={enquiryNumber}
              onChange={(e) => setEnquiryNumber(e.target.value)}
              placeholder="e.g. ENQ-1234"
              style={{
                width: '100%',
                padding: '0.25rem',
                fontSize: '0.9rem',
              }}
            />
          </div>
        )}

        {/* Files */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            PDF files
          </label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            style={{
              marginTop: '0.25rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        {error && (
          <p
            style={{
              marginTop: '0.5rem',
              fontSize: '0.85rem',
              color: '#b91c1c',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: '0.75rem',
            padding: '0.4rem 0.9rem',
            fontSize: '0.9rem',
            borderRadius: 4,
            border: 'none',
            background: submitting ? '#6b7280' : '#111827',
            color: 'white',
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Uploading…' : 'Upload'}
        </button>

        {message && (
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.85rem',
              color: '#16a34a',
            }}
          >
            {message}
          </p>
        )}
      </form>

      {results.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            borderRadius: 4,
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <h2
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            Upload results
          </h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            {results.map((r) => {
              const ok = !r.error && r.storagePath;
              return (
                <li key={r.filename} style={{ marginBottom: '0.35rem' }}>
                  <code>{r.filename}</code> – {r.size} bytes (
                  {r.type || 'unknown MIME type'})
                  {ok && (
                    <span style={{ color: '#15803d' }}>
                      {' '}
                      — stored at <code>{r.storagePath}</code>
                    </span>
                  )}
                  {!ok && r.error && (
                    <span style={{ color: '#b91c1c' }}>
                      {' '}
                      — error: {r.error}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
