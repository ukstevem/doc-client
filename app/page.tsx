// app/page.tsx

export default function HomePage() {
  return (
    <div style={{ maxWidth: 700 }}>
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
          marginBottom: '0.75rem',
        }}
      >
        This is the frontend for your document-control pipeline.
        Use the sidebar to upload new PDFs. The backend worker
        on the Orin will watch for new records and generate previews.
      </p>
      <p
        style={{
          fontSize: '0.85rem',
          color: '#64748b',
        }}
      >
        Next steps will be to wire uploads into the NAS bucket and the
        <code style={{ fontFamily: 'monospace', marginLeft: 4 }}>
          document_files
        </code>{' '}
        table in Supabase.
      </p>
    </div>
  );
}
