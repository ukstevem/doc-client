// app/documents/upload/page.tsx

'use client';

import { useState, FormEvent } from 'react';

export default function UploadPage() {
  const [projectNumber, setProjectNumber] = useState('');
  const [subProjectItemSeq, setSubProjectItemSeq] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');
  const [scopeRef, setScopeRef] = useState('');
  const [drawingNumber, setDrawingNumber] = useState('');
  const [revision, setRevision] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const [message, setMessage] = useState<string>('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Form submitted (stub only) – nothing uploaded yet.');
  }

  return (
    <div style={{ maxWidth: 600 }}>
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
        This is a stub. In later steps we&apos;ll wire this up to the NAS
        bucket and Supabase.
      </p>

      <form onSubmit={handleSubmit}>
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
            style={{
              width: '100%',
              padding: '0.25rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Sub-project / item seq
          </label>
          <input
            type="text"
            value={subProjectItemSeq}
            onChange={(e) => setSubProjectItemSeq(e.target.value)}
            style={{
              width: '100%',
              padding: '0.25rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Enquiry number (optional)
          </label>
          <input
            type="text"
            value={enquiryNumber}
            onChange={(e) => setEnquiryNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '0.25rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Scope reference (optional)
          </label>
          <input
            type="text"
            value={scopeRef}
            onChange={(e) => setScopeRef(e.target.value)}
            style={{
              width: '100%',
              padding: '0.25rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              Drawing number
            </label>
            <input
              type="text"
              value={drawingNumber}
              onChange={(e) => setDrawingNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '0.25rem',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <div style={{ width: '35%' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              Revision
            </label>
            <input
              type="text"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              style={{
                width: '100%',
                padding: '0.25rem',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

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
            onChange={(e) => setFiles(e.target.files)}
            style={{
              marginTop: '0.25rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '0.4rem 0.9rem',
            fontSize: '0.9rem',
            borderRadius: 4,
            border: 'none',
            background: '#111827',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Submit (stub)
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
    </div>
  );
}
