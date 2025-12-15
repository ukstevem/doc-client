'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  DragEvent,
  ChangeEvent,
} from 'react';

type ViewMode = 'library' | 'pictorial' | 'projects';

type DocumentStatus =
  | 'clean'
  | 'needs_attention'
  | 'unmatched'
  | 'revision_check'
  | 'pending'
  | 'error'
  | 'other';

type AttentionCategory = 'clean' | 'needs_attention';

type VersionInfo = {
  id: string;
  revision: string | null;
  uploadDate: string;
  status: string;
};

type DocumentSummary = {
  id: string;
  projectOrEnquiry: string;
  drawingOrDocNumber: string;
  title: string;
  revision: string | null;
  pages: number;
  status: DocumentStatus;
  attentionCategory: AttentionCategory;
  uploadDate?: string;
  originalFilename?: string;
  nasPath?: string;
  sizeLabel?: string;
  thumbnailUrl?: string | null;
  pdfUrl?: string | null;
  versionHistory?: VersionInfo[];
};

// ---------------- Upload bar ----------------

type UploadBarProps = {
  onUpload: (
    files: File[],
    meta: { type: 'project' | 'enquiry'; value: string }
  ) => Promise<void> | void;
};

function UploadBar({ onUpload }: UploadBarProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFilesSelected = useCallback(
    (filesList: FileList | null) => {
      if (!filesList || filesList.length === 0) return;
      const files = Array.from(filesList);

      const value = window.prompt(
        'Enter project or enquiry number for these files:'
      );
      if (!value || !value.trim()) return;

      // For now, treat everything as "project"; we can add a toggle later
      onUpload(files, { type: 'project', value: value.trim() });
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const filesList = e.dataTransfer.files;
      handleFilesSelected(filesList);
    },
    [handleFilesSelected]
  );

  const onDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragActive) setDragActive(true);
    },
    [dragActive]
  );

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFilesSelected(e.target.files);
      e.target.value = '';
    },
    [handleFilesSelected]
  );

  return (
    <div className="flex items-center gap-3">
      <label
        className={`border rounded px-3 py-1 text-xs cursor-pointer ${
          dragActive ? 'bg-blue-50 border-blue-400' : 'bg-white'
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span className="font-medium">Upload</span>
        <span className="ml-2 text-[11px] text-gray-500">
          Drag &amp; drop or click
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          onChange={onFileInputChange}
          accept=".pdf,.PDF"
        />
      </label>
      <span className="text-[11px] text-gray-500">
        Files will be processed by the PDF worker.
      </span>
    </div>
  );
}

// ---------------- Library view ----------------

type LibraryViewProps = {
  documents: DocumentSummary[];
  filterProject: string;
  filterText: string;
  selectedId: string | null;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function LibraryView({
  documents,
  filterProject,
  filterText,
  selectedId,
  onSelect,
  onTagTemplate,
}: LibraryViewProps) {
  const filtered = useMemo(
    () =>
      documents.filter((doc) => {
        if (filterProject && doc.projectOrEnquiry !== filterProject) return false;
        if (
          filterText &&
          !doc.drawingOrDocNumber
            .toLowerCase()
            .includes(filterText.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [documents, filterProject, filterText]
  );

  return (
    <div className="flex-1 overflow-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead className="bg-gray-50 border-b text-[11px] uppercase tracking-wide text-gray-600">
          <tr>
            <th className="text-left px-2 py-1 border-r">Project / Enquiry</th>
            <th className="text-left px-2 py-1 border-r">Number</th>
            <th className="text-left px-2 py-1 border-r">Title</th>
            <th className="text-left px-2 py-1 border-r">Rev</th>
            <th className="text-left px-2 py-1 border-r">Pages</th>
            <th className="text-left px-2 py-1 border-r">Status</th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((doc) => {
            const isSelected = doc.id === selectedId;
            return (
              <tr
                key={doc.id}
                className={
                  'border-b cursor-pointer ' +
                  (isSelected ? 'bg-blue-100' : 'hover:bg-blue-50')
                }
                onClick={() => onSelect(doc)}
              >
                <td className="px-2 py-1 align-top">
                  {doc.projectOrEnquiry}
                </td>
                <td className="px-2 py-1 align-top font-mono">
                  {doc.drawingOrDocNumber}
                </td>
                <td className="px-2 py-1 align-top">{doc.title}</td>
                <td className="px-2 py-1 align-top">
                  {doc.revision ?? '-'}
                </td>
                <td className="px-2 py-1 align-top text-center">
                  {doc.pages}
                </td>
                <td className="px-2 py-1 align-top">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-2 py-1 align-top">
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 border rounded mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(doc);
                    }}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 border rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagTemplate(doc);
                    }}
                  >
                    Tag template
                  </button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-2 py-4 text-center text-xs text-gray-500"
              >
                No documents match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Pictorial view ----------------

type PictorialViewProps = {
  documents: DocumentSummary[];
  filterProject: string;
  filterText: string;
  selectedId: string | null;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function PictorialView({
  documents,
  filterProject,
  filterText,
  selectedId,
  onSelect,
  onTagTemplate,
}: PictorialViewProps) {
  const filtered = useMemo(
    () =>
      documents.filter((doc) => {
        if (filterProject && doc.projectOrEnquiry !== filterProject) return false;
        if (
          filterText &&
          !doc.drawingOrDocNumber
            .toLowerCase()
            .includes(filterText.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [documents, filterProject, filterText]
  );

  return (
    <div className="flex-1 overflow-auto p-2">
      {filtered.length === 0 && (
        <div className="text-xs text-gray-500 text-center mt-4">
          No documents match the current filters.
        </div>
      )}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((doc) => {
          const isSelected = doc.id === selectedId;
          return (
            <div
              key={doc.id}
              className={
                'border rounded shadow-sm bg-white cursor-pointer flex flex-col ' +
                (isSelected ? 'ring-2 ring-blue-400' : '')
              }
              onClick={() => onSelect(doc)}
            >
              <div className="bg-gray-100 border-b h-40 flex items-center justify-center overflow-hidden">
                {doc.thumbnailUrl ? (
                  <img
                    src={doc.thumbnailUrl}
                    alt={doc.title}
                    className="object-contain max-h-full"
                  />
                ) : (
                  <span className="text-[11px] text-gray-500">
                    No preview available
                  </span>
                )}
              </div>
              <div className="p-2 space-y-1">
                <div className="text-[11px] text-gray-500">
                  {doc.projectOrEnquiry}
                </div>
                <div className="font-mono text-xs font-semibold">
                  {doc.drawingOrDocNumber}
                  {doc.revision && (
                    <span className="ml-1 text-[10px] text-gray-500">
                      (Rev {doc.revision})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-700 line-clamp-2">
                  {doc.title}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <StatusBadge status={doc.status} />
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 border rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagTemplate(doc);
                    }}
                  >
                    Tag
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Project view ----------------

type ProjectViewProps = {
  documents: DocumentSummary[];
  selectedProjectOrEnquiry: string;
  selectedId: string | null;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function ProjectView({
  documents,
  selectedProjectOrEnquiry,
  selectedId,
  onSelect,
  onTagTemplate,
}: ProjectViewProps) {
  const filtered = useMemo(() => {
    if (!selectedProjectOrEnquiry) return [];
    return documents.filter(
      (doc) => doc.projectOrEnquiry === selectedProjectOrEnquiry
    );
  }, [documents, selectedProjectOrEnquiry]);

  const needsAttention = filtered.filter(
    (doc) => doc.attentionCategory === 'needs_attention'
  );
  const clean = filtered.filter((doc) => doc.attentionCategory === 'clean');

  if (!selectedProjectOrEnquiry) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
        Select a project or enquiry from the dropdown above.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-2 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-red-600">
            Items needing attention
          </h3>
          <span className="text-[11px] text-gray-500">
            Unmatched, revision checks, errors, pending, etc.
          </span>
        </div>
        <DocumentTable
          documents={needsAttention}
          selectedId={selectedId}
          onSelect={onSelect}
          onTagTemplate={onTagTemplate}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-green-700">
            Clean / processed items
          </h3>
          <span className="text-[11px] text-gray-500">
            Current, processed versions only.
          </span>
        </div>
        <DocumentTable
          documents={clean}
          selectedId={selectedId}
          onSelect={onSelect}
          onTagTemplate={onTagTemplate}
        />
      </div>
    </div>
  );
}

type DocumentTableProps = {
  documents: DocumentSummary[];
  selectedId: string | null;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function DocumentTable({
  documents,
  selectedId,
  onSelect,
  onTagTemplate,
}: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <div className="border rounded bg-gray-50 px-2 py-2 text-xs text-gray-500">
        No documents in this bucket.
      </div>
    );
  }

  return (
    <div className="border rounded overflow-hidden">
      <table className="min-w-full text-xs border-collapse">
        <thead className="bg-gray-50 border-b text-[11px] uppercase tracking-wide text-gray-600">
          <tr>
            <th className="text-left px-2 py-1 border-r">Number</th>
            <th className="text-left px-2 py-1 border-r">Title</th>
            <th className="text-left px-2 py-1 border-r">Rev</th>
            <th className="text-left px-2 py-1 border-r">Status</th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const isSelected = doc.id === selectedId;
            return (
              <tr
                key={doc.id}
                className={
                  'border-b cursor-pointer ' +
                  (isSelected ? 'bg-blue-100' : 'hover:bg-blue-50')
                }
                onClick={() => onSelect(doc)}
              >
                <td className="px-2 py-1 align-top font-mono">
                  {doc.drawingOrDocNumber}
                </td>
                <td className="px-2 py-1 align-top">{doc.title}</td>
                <td className="px-2 py-1 align-top">
                  {doc.revision ?? '-'}
                </td>
                <td className="px-2 py-1 align-top">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-2 py-1 align-top">
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 border rounded mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(doc);
                    }}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 border rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagTemplate(doc);
                    }}
                  >
                    Tag
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Detail panel ----------------

type DetailPanelProps = {
  document: DocumentSummary | null;
};

function DetailPanel({ document }: DetailPanelProps) {
  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        Select a drawing or document to see details.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-3 py-2">
        <div className="text-xs text-gray-500">
          {document.projectOrEnquiry}
        </div>
        <div className="font-semibold text-sm">
          <span className="font-mono">{document.drawingOrDocNumber}</span>
          {document.revision && (
            <span className="ml-1 text-xs text-gray-500">
              (Rev {document.revision})
            </span>
          )}
        </div>
        <div className="text-xs text-gray-700">{document.title}</div>
      </div>

      {/* Meta + quick actions */}
      <div className="px-3 py-2 border-b flex items-start justify-between gap-3">
        <div className="space-y-1 text-xs">
          <div>
            <span className="text-gray-500 mr-1">Pages:</span>
            <span>{document.pages}</span>
          </div>
          <div>
            <span className="text-gray-500 mr-1">Status:</span>
            <StatusBadge status={document.status} />
          </div>
          {document.uploadDate && (
            <div>
              <span className="text-gray-500 mr-1">Uploaded:</span>
              <span>{new Date(document.uploadDate).toLocaleString()}</span>
            </div>
          )}
          {document.originalFilename && (
            <div>
              <span className="text-gray-500 mr-1">File:</span>
              <span>{document.originalFilename}</span>
            </div>
          )}
          {document.nasPath && (
            <div className="break-all">
              <span className="text-gray-500 mr-1">NAS path:</span>
              <span>{document.nasPath}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 items-end">
          {document.pdfUrl && (
            <a
              href={document.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
            >
              Open PDF
            </a>
          )}
        </div>
      </div>

      {/* Inline preview box */}
      {document.thumbnailUrl && (
        <div className="px-3 py-2 border-b bg-gray-50 flex justify-center">
          <button
            type="button"
            className="border rounded bg-white max-w-full max-h-64 overflow-hidden"
            onClick={() => {
              const target = document.pdfUrl ?? document.thumbnailUrl!;
              window.open(target, '_blank');
            }}
          >
            <img
              src={document.thumbnailUrl}
              alt={document.title}
              className="max-h-64 max-w-full object-contain"
            />
          </button>
        </div>
      )}

      {/* Version history */}
      <div className="flex-1 overflow-auto px-3 py-2">
        <h3 className="text-xs font-semibold mb-1">Version history</h3>
        {document.versionHistory && document.versionHistory.length > 0 ? (
          <ul className="text-xs space-y-1">
            {document.versionHistory.map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <span>
                  Rev {v.revision ?? '-'} ({v.status})
                </span>
                <span className="text-gray-500">
                  {new Date(v.uploadDate).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-500">
            No version history found.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Status badge ----------------

type StatusBadgeProps = {
  status: DocumentStatus;
};

function StatusBadge({ status }: StatusBadgeProps) {
  let label = '';
  let className =
    'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]';

  switch (status) {
    case 'clean':
      label = 'Clean';
      className += ' bg-green-50 border-green-500 text-green-700';
      break;
    case 'needs_attention':
      label = 'Needs attention';
      className += ' bg-yellow-50 border-yellow-500 text-yellow-700';
      break;
    case 'unmatched':
      label = 'Unmatched';
      className += ' bg-orange-50 border-orange-500 text-orange-700';
      break;
    case 'revision_check':
      label = 'Revision check';
      className += ' bg-blue-50 border-blue-500 text-blue-700';
      break;
    case 'pending':
      label = 'Pending';
      className += ' bg-gray-50 border-gray-400 text-gray-700';
      break;
    case 'error':
      label = 'Error';
      className += ' bg-red-50 border-red-500 text-red-700';
      break;
    default:
      label = 'Other';
      className += ' bg-gray-50 border-gray-400 text-gray-700';
      break;
  }

  return <span className={className}>{label}</span>;
}

// ---------------- Main dashboard page ----------------

export default function DashboardPage() {
  const [view, setView] = useState<ViewMode>('library');

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentSummary | null>(null);

  const [filterProject, setFilterProject] = useState('');
  const [filterText, setFilterText] = useState('');

  const [projectFilterForProjectsView, setProjectFilterForProjectsView] =
    useState('');

  // Load list of documents once; UI filters are client-side
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/documents');
        if (!res.ok) {
          console.error('Failed to fetch documents:', res.statusText);
          return;
        }
        const body = (await res.json()) as { documents?: DocumentSummary[] };
        if (cancelled) return;
        const docs = body.documents ?? [];
        setDocuments(docs);
        if (docs.length > 0) {
          setSelectedDoc(docs[0]);
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      if (doc.projectOrEnquiry) {
        set.add(doc.projectOrEnquiry);
      }
    }
    return Array.from(set).sort();
  }, [documents]);

  const handleSelectDoc = useCallback((doc: DocumentSummary) => {
    // Immediately show whatever we already know from the list
    setSelectedDoc(doc);

    (async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`);

        if (!res.ok) {
          // 404: treat as "no extra detail/history", don't spam console with errors
          if (res.status === 404) {
            console.warn(
              'No extra detail/history found for document',
              doc.id
            );
          } else {
            console.error(
              'Failed to fetch document detail:',
              res.status,
              res.statusText
            );
          }
          return;
        }

        const body = (await res.json()) as {
          document: DocumentSummary;
          history: VersionInfo[];
        };

        // Only merge into the same doc that is still selected
        setSelectedDoc((prev) => {
          if (!prev || prev.id !== doc.id) return prev;
          return {
            ...prev,
            ...body.document,
            versionHistory: body.history,
          };
        });
      } catch (err) {
        console.error('Error fetching document detail:', err);
      }
    })();
  }, []);

  const handleTagTemplate = useCallback((doc: DocumentSummary) => {
    // Placeholder: plug this into your template-tagging flow (e.g. /tagger?id=...)
    console.log('Tag template for doc', doc.id);
  }, []);

  const handleUpload = useCallback(
    async (
      files: File[],
      meta: { type: 'project' | 'enquiry'; value: string }
    ) => {
      console.log('Upload requested', { files, meta });
      // TODO: wire this to your upload API / worker pipeline
    },
    []
  );

  const selectedId = selectedDoc?.id ?? null;

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar with view switch + upload */}
      <header className="border-b px-4 py-2 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Document dashboard</h1>
          <div className="flex gap-1 text-[11px]">
            <button
              type="button"
              className={`px-2 py-0.5 rounded border ${
                view === 'library'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700'
              }`}
              onClick={() => setView('library')}
            >
              Library
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded border ${
                view === 'pictorial'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700'
              }`}
              onClick={() => setView('pictorial')}
            >
              Pictorial
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded border ${
                view === 'projects'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700'
              }`}
              onClick={() => setView('projects')}
            >
              Projects
            </button>
          </div>
        </div>

        <UploadBar onUpload={handleUpload} />
      </header>

      {/* Main content: left = view, right = details */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-[3] border-r bg-gray-50">
          {/* Filters bar */}
          <div className="flex items-center gap-3 px-3 py-2 border-b bg-white">
            {view !== 'projects' && (
              <>
                <div className="flex items-center gap-1">
                  <label className="text-[11px] text-gray-600">
                    Project / Enquiry
                  </label>
                  <select
                    className="border rounded px-2 py-0.5 text-xs"
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                  >
                    <option value="">All</option>
                    {projectOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[11px] text-gray-600">
                    Drawing / doc #
                  </label>
                  <input
                    className="border rounded px-2 py-0.5 text-xs"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter by number"
                  />
                </div>
              </>
            )}

            {view === 'projects' && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-gray-600">
                  Project / Enquiry
                </label>
                <select
                  className="border rounded px-2 py-0.5 text-xs"
                  value={projectFilterForProjectsView}
                  onChange={(e) =>
                    setProjectFilterForProjectsView(e.target.value)
                  }
                >
                  <option value="">Select…</option>
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* View content */}
          {view === 'library' && (
            <LibraryView
              documents={documents}
              filterProject={filterProject}
              filterText={filterText}
              selectedId={selectedId}
              onSelect={handleSelectDoc}
              onTagTemplate={handleTagTemplate}
            />
          )}

          {view === 'pictorial' && (
            <PictorialView
              documents={documents}
              filterProject={filterProject}
              filterText={filterText}
              selectedId={selectedId}
              onSelect={handleSelectDoc}
              onTagTemplate={handleTagTemplate}
            />
          )}

          {view === 'projects' && (
            <ProjectView
              documents={documents}
              selectedProjectOrEnquiry={projectFilterForProjectsView}
              selectedId={selectedId}
              onSelect={handleSelectDoc}
              onTagTemplate={handleTagTemplate}
            />
          )}
        </div>

        <div className="flex flex-col flex-[2] bg-white">
          <DetailPanel document={selectedDoc} />
        </div>
      </div>
    </div>
  );
}
