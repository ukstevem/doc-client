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

type AttentionCategory = 'clean' | 'needs_attention';

type DocumentStatus =
  | 'clean'
  | 'needs_attention'
  | 'unmatched'
  | 'revision_check'
  | 'pending'
  | 'error'
  | 'other';

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


export default function DashboardPage() {
  const [view, setView] = useState<ViewMode>('library');

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentSummary | null>(null);

  const [filterProject, setFilterProject] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');

  const [projectFilterForProjectsView, setProjectFilterForProjectsView] =
    useState<string>('');

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
        if (docs.length > 0 && !selectedDoc) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectDoc = useCallback((doc: DocumentSummary) => {
    // Optimistic selection
    setSelectedDoc(doc);

    // Fetch detail + version history
    (async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`);
        if (!res.ok) {
          console.error('Failed to fetch document detail:', res.statusText);
          return;
        }
        const body = (await res.json()) as {
          document: DocumentSummary;
          history: VersionInfo[];
        };

        setSelectedDoc((prev) => {
          if (!prev || prev.id !== doc.id) {
            return prev;
          }
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
    // TODO: plug into your tagging route
    // e.g. router.push(`/tag/page/${doc.id}`);
    console.log('Tag template for document:', doc.id);
  }, []);

  const handleUpload = useCallback(
    async (
      files: File[],
      meta: { type: 'project' | 'enquiry'; value: string }
    ) => {
      // TODO: wire this to your real upload endpoint
      console.log('Uploading files', {
        count: files.length,
        meta,
      });
    },
    []
  );

  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.projectOrEnquiry) {
        set.add(d.projectOrEnquiry);
      }
    });
    return Array.from(set).sort();
  }, [documents]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b px-4 py-2 flex items-center gap-4">
        <div className="font-semibold text-lg">Doc Control</div>

        <ViewTabs current={view} onChange={setView} />

        <div className="flex-1" />

        <UploadBar onUpload={handleUpload} />
      </header>

      {/* Filters row */}
      <div className="border-b px-4 py-2 flex items-center gap-4">
        {view !== 'projects' && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">
                Project / Enquiry
              </label>
              <select
                className="border rounded px-2 py-1 text-sm"
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">
                Drawing / Doc number
              </label>
              <input
                className="border rounded px-2 py-1 text-sm"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter by number…"
              />
            </div>
          </>
        )}

        {view === 'projects' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Project / Enquiry</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={projectFilterForProjectsView}
              onChange={(e) => setProjectFilterForProjectsView(e.target.value)}
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

      {/* Main area: left view + right detail */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto border-r">
          {view === 'library' && (
            <LibraryView
              documents={documents}
              filterProject={filterProject}
              filterText={filterText}
              onSelect={handleSelectDoc}
              onTagTemplate={handleTagTemplate}
            />
          )}

          {view === 'pictorial' && (
            <PictorialView
              documents={documents}
              filterProject={filterProject}
              filterText={filterText}
              onSelect={handleSelectDoc}
              onTagTemplate={handleTagTemplate}
            />
          )}

          {view === 'projects' && (
            <ProjectView
              documents={documents}
              selectedProjectOrEnquiry={projectFilterForProjectsView}
              onSelect={handleSelectDoc}
              onTagTemplate={handleTagTemplate}
            />
          )}
        </div>

        <div className="w-96 flex-shrink-0 overflow-auto">
          <DetailPanel document={selectedDoc} />
        </div>
      </div>
    </div>
  );
}

type ViewTabsProps = {
  current: ViewMode;
  onChange: (view: ViewMode) => void;
};

function ViewTabs({ current, onChange }: ViewTabsProps) {
  const options: { id: ViewMode; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'pictorial', label: 'Pictorial' },
    { id: 'projects', label: 'Projects' },
  ];

  return (
    <nav className="flex gap-1">
      {options.map((opt) => {
        const isActive = opt.id === current;
        return (
          <button
            key={opt.id}
            type="button"
            className={
              'px-3 py-1 rounded text-sm border ' +
              (isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-800 hover:bg-gray-100')
            }
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </nav>
  );
}

type UploadBarProps = {
  onUpload: (
    files: File[],
    meta: { type: 'project' | 'enquiry'; value: string }
  ) => Promise<void> | void;
};

type UploadMetaState =
  | { stage: 'idle' }
  | { stage: 'askingMeta'; files: File[] }
  | {
      stage: 'readyToUpload';
      files: File[];
      mode: 'project' | 'enquiry';
      value: string;
    };

function UploadBar({ onUpload }: UploadBarProps) {
  const [dragActive, setDragActive] = useState(false);
  const [metaState, setMetaState] = useState<UploadMetaState>({ stage: 'idle' });
  const [isUploading, setIsUploading] = useState(false);

  const reset = useCallback(() => {
    setMetaState({ stage: 'idle' });
    setIsUploading(false);
  }, []);

  const handleFilesSelected = useCallback(
    (filesList: FileList | null) => {
      if (!filesList || filesList.length === 0) {
        return;
      }
      const files = Array.from(filesList);
      setMetaState({ stage: 'askingMeta', files });
    },
    []
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);

      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        handleFilesSelected(event.dataTransfer.files);
        event.dataTransfer.clearData();
      }
    },
    [handleFilesSelected]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  }, [dragActive]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (dragActive) {
      setDragActive(false);
    }
  }, [dragActive]);

  const handleMetaConfirm = useCallback(
    (mode: 'project' | 'enquiry', value: string) => {
      if (!value.trim()) {
        return;
      }
      if (metaState.stage !== 'askingMeta') {
        return;
      }
      setMetaState({
        stage: 'readyToUpload',
        files: metaState.files,
        mode,
        value: value.trim(),
      });
    },
    [metaState]
  );

  const handleStartUpload = useCallback(async () => {
    if (metaState.stage !== 'readyToUpload') {
      return;
    }
    try {
      setIsUploading(true);
      await onUpload(metaState.files, {
        type: metaState.mode,
        value: metaState.value,
      });
    } finally {
      reset();
    }
  }, [metaState, onUpload, reset]);

  const filesCount =
    metaState.stage === 'idle'
      ? 0
      : metaState.stage === 'askingMeta'
      ? metaState.files.length
      : metaState.files.length;

  return (
    <div
      className={
        'border rounded px-3 py-1 text-xs flex items-center gap-2 ' +
        (dragActive ? 'bg-blue-50 border-blue-400' : 'bg-white')
      }
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <label className="cursor-pointer text-xs font-medium">
        <span className="underline">Browse</span> or drop files
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleFilesSelected(e.target.files)
          }
        />
      </label>

      {filesCount > 0 && (
        <span className="text-gray-700">
          {filesCount} file{filesCount === 1 ? '' : 's'} selected
        </span>
      )}

      {metaState.stage === 'idle' && filesCount === 0 && (
        <span className="text-gray-400">(Upload available from any view)</span>
      )}

      {metaState.stage === 'askingMeta' && (
        <UploadMetaPrompt files={metaState.files} onConfirm={handleMetaConfirm} />
      )}

      {metaState.stage === 'readyToUpload' && (
        <button
          type="button"
          className="ml-2 px-2 py-1 border rounded bg-blue-600 text-white disabled:opacity-60"
          disabled={isUploading}
          onClick={handleStartUpload}
        >
          {isUploading ? 'Uploading…' : 'Process'}
        </button>
      )}

      {metaState.stage !== 'idle' && (
        <button
          type="button"
          className="ml-1 px-2 py-1 border rounded text-gray-600 text-xs"
          onClick={reset}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

type UploadMetaPromptProps = {
  files: File[];
  onConfirm: (mode: 'project' | 'enquiry', value: string) => void;
};

function UploadMetaPrompt({ files, onConfirm }: UploadMetaPromptProps) {
  const [mode, setMode] = useState<'project' | 'enquiry'>('enquiry');
  const [value, setValue] = useState('');

  return (
    <div className="flex items-center gap-2 ml-3">
      <span className="text-gray-700">
        Process {files.length} file{files.length === 1 ? '' : 's'} as
      </span>
      <select
        className="border rounded px-1 py-0.5 text-xs"
        value={mode}
        onChange={(e) =>
          setMode(e.target.value === 'project' ? 'project' : 'enquiry')
        }
      >
        <option value="enquiry">Enquiry</option>
        <option value="project">Project</option>
      </select>
      <input
        className="border rounded px-2 py-0.5 text-xs"
        placeholder={mode === 'project' ? 'Project number' : 'Enquiry number'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="button"
        className="px-2 py-0.5 border rounded bg-gray-100 text-xs"
        onClick={() => onConfirm(mode, value)}
      >
        Set
      </button>
    </div>
  );
}

type LibraryViewProps = {
  documents: DocumentSummary[];
  filterProject: string;
  filterText: string;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function LibraryView({
  documents,
  filterProject,
  filterText,
  onSelect,
  onTagTemplate,
}: LibraryViewProps) {
  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filterProject && doc.projectOrEnquiry !== filterProject) {
        return false;
      }
      if (
        filterText &&
        !doc.drawingOrDocNumber.toLowerCase().includes(filterText.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [documents, filterProject, filterText]);

  return (
    <div className="p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-2 py-1">Project / Enquiry</th>
            <th className="text-left px-2 py-1">Drawing / Doc number</th>
            <th className="text-left px-2 py-1">Title</th>
            <th className="text-left px-2 py-1">Rev</th>
            <th className="text-left px-2 py-1">Pages</th>
            <th className="text-left px-2 py-1">Status</th>
            <th className="text-left px-2 py-1">Size</th>
            <th className="text-left px-2 py-1">NAS Path</th>
            <th className="text-left px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((doc) => {
            const isAttention = doc.attentionCategory === 'needs_attention';
            return (
              <tr
                key={doc.id}
                className={
                  'border-b cursor-pointer hover:bg-gray-50 ' +
                  (isAttention ? 'bg-yellow-50' : '')
                }
                onClick={() => onSelect(doc)}
              >
                <td className="px-2 py-1 whitespace-nowrap">
                  {doc.projectOrEnquiry}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {doc.drawingOrDocNumber}
                </td>
                <td className="px-2 py-1">{doc.title}</td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {doc.revision ?? '-'}
                </td>
                <td className="px-2 py-1 text-center">{doc.pages}</td>
                <td className="px-2 py-1 whitespace-nowrap">
                  <StatusChip status={doc.status} />
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {doc.sizeLabel ?? '-'}
                </td>
                <td className="px-2 py-1 text-xs truncate max-w-[240px]">
                  {doc.nasPath ?? ''}
                </td>
                <td
                  className="px-2 py-1 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  {doc.attentionCategory === 'needs_attention' && (
                    <button
                      type="button"
                      className="mr-2 px-2 py-0.5 border rounded text-xs"
                      onClick={() => onTagTemplate(doc)}
                    >
                      Tag
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-2 py-0.5 border rounded text-xs"
                    onClick={() => onSelect(doc)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            );
          })}

          {filtered.length === 0 && (
            <tr>
              <td className="px-2 py-4 text-center text-gray-500" colSpan={9}>
                No documents match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type PictorialViewProps = {
  documents: DocumentSummary[];
  filterProject: string;
  filterText: string;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function PictorialView({
  documents,
  filterProject,
  filterText,
  onSelect,
  onTagTemplate,
}: PictorialViewProps) {
  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filterProject && doc.projectOrEnquiry !== filterProject) {
        return false;
      }
      if (
        filterText &&
        !doc.drawingOrDocNumber.toLowerCase().includes(filterText.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [documents, filterProject, filterText]);

  return (
    <div className="p-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {filtered.map((doc) => {
          const isAttention = doc.attentionCategory === 'needs_attention';
          return (
            <div
              key={doc.id}
              className={
                'border rounded overflow-hidden cursor-pointer flex flex-col ' +
                (isAttention ? 'bg-yellow-50' : 'bg-white')
              }
              onClick={() => onSelect(doc)}
            >
              <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                {doc.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doc.thumbnailUrl}
                    alt={doc.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>No preview</span>
                )}
              </div>
              <div className="p-2 flex flex-col gap-1">
                <div className="text-xs text-gray-500">
                  {doc.projectOrEnquiry}
                </div>
                <div className="text-sm font-semibold">
                  {doc.drawingOrDocNumber}
                </div>
                <div className="text-xs text-gray-700 line-clamp-2">
                  {doc.title}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-600">
                    Rev {doc.revision ?? '-'}
                  </span>
                  <StatusChip status={doc.status} />
                </div>
                {doc.attentionCategory === 'needs_attention' && (
                  <div className="mt-1">
                    <button
                      type="button"
                      className="px-2 py-0.5 border rounded text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagTemplate(doc);
                      }}
                    >
                      Tag template
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-gray-500 text-sm col-span-full py-4">
            No documents match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

type ProjectViewProps = {
  documents: DocumentSummary[];
  selectedProjectOrEnquiry: string;
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
};

function ProjectView({
  documents,
  selectedProjectOrEnquiry,
  onSelect,
  onTagTemplate,
}: ProjectViewProps) {
  const filtered = useMemo(() => {
    if (!selectedProjectOrEnquiry) {
      return [];
    }
    return documents.filter(
      (doc) => doc.projectOrEnquiry === selectedProjectOrEnquiry
    );
  }, [documents, selectedProjectOrEnquiry]);

  const needsAttention = filtered.filter(
    (doc) => doc.attentionCategory === 'needs_attention'
  );
  const clean = filtered.filter((doc) => doc.attentionCategory === 'clean');

  return (
    <div className="p-4 space-y-4">
      {!selectedProjectOrEnquiry && (
        <div className="text-sm text-gray-500">
          Select a project or enquiry above to see its documents.
        </div>
      )}

      {selectedProjectOrEnquiry && (
        <>
          <section>
            <h2 className="font-semibold text-sm mb-2">
              Needs attention ({needsAttention.length})
            </h2>
            <SimpleProjectTable
              documents={needsAttention}
              onSelect={onSelect}
              onTagTemplate={onTagTemplate}
              highlightAttention
            />
          </section>

          <section>
            <h2 className="font-semibold text-sm mb-2">
              Clean ({clean.length})
            </h2>
            <SimpleProjectTable
              documents={clean}
              onSelect={onSelect}
              onTagTemplate={onTagTemplate}
            />
          </section>
        </>
      )}
    </div>
  );
}

type SimpleProjectTableProps = {
  documents: DocumentSummary[];
  onSelect: (doc: DocumentSummary) => void;
  onTagTemplate: (doc: DocumentSummary) => void;
  highlightAttention?: boolean;
};

function SimpleProjectTable({
  documents,
  onSelect,
  onTagTemplate,
  highlightAttention,
}: SimpleProjectTableProps) {
  if (documents.length === 0) {
    return (
      <div className="border rounded px-3 py-2 text-sm text-gray-500">
        None.
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b bg-gray-50">
          <th className="text-left px-2 py-1">Drawing / Doc number</th>
          <th className="text-left px-2 py-1">Title</th>
          <th className="text-left px-2 py-1">Rev</th>
          <th className="text-left px-2 py-1">Status</th>
          <th className="text-left px-2 py-1">Actions</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => (
          <tr
            key={doc.id}
            className={
              'border-b cursor-pointer hover:bg-gray-50 ' +
              (highlightAttention ? 'bg-yellow-50' : '')
            }
            onClick={() => onSelect(doc)}
          >
            <td className="px-2 py-1 whitespace-nowrap">
              {doc.drawingOrDocNumber}
            </td>
            <td className="px-2 py-1">{doc.title}</td>
            <td className="px-2 py-1 whitespace-nowrap">
              {doc.revision ?? '-'}
            </td>
            <td className="px-2 py-1 whitespace-nowrap">
              <StatusChip status={doc.status} />
            </td>
            <td
              className="px-2 py-1 whitespace-nowrap"
              onClick={(e) => e.stopPropagation()}
            >
              {highlightAttention && (
                <button
                  type="button"
                  className="mr-2 px-2 py-0.5 border rounded text-xs"
                  onClick={() => onTagTemplate(doc)}
                >
                  Tag
                </button>
              )}
              <button
                type="button"
                className="px-2 py-0.5 border rounded text-xs"
                onClick={() => onSelect(doc)}
              >
                Details
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
      <div className="border-b px-3 py-2">
        <div className="text-xs text-gray-500">
          {document.projectOrEnquiry}
        </div>
        <div className="font-semibold text-sm">
          {document.drawingOrDocNumber}
        </div>
        <div className="text-xs text-gray-700">{document.title}</div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Rev</span>{' '}
            <span>{document.revision ?? '-'}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Pages</span>{' '}
            <span>{document.pages}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Size</span>{' '}
            <span>{document.sizeLabel ?? '-'}</span>
          </span>
        </div>

        <div className="mt-2 text-xs text-gray-600 space-y-1">
          {document.uploadDate && (
            <div>
              <span className="font-medium">Uploaded:</span>{' '}
              {document.uploadDate}
            </div>
          )}
          {document.originalFilename && (
            <div>
              <span className="font-medium">File:</span>{' '}
              {document.originalFilename}
            </div>
          )}
          {document.nasPath && (
            <div className="break-all">
              <span className="font-medium">NAS:</span> {document.nasPath}
            </div>
          )}
          {document.pdfUrl && (
            <div>
                <span className="font-medium">PDF:</span>{' '}
                <a
                href={document.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
                >
                Open PDF
                </a>
            </div>
            )}

        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2">
        <h3 className="text-xs font-semibold mb-1">Version history</h3>
        {document.versionHistory && document.versionHistory.length > 0 ? (
          <ul className="text-xs space-y-1">
            {document.versionHistory.map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <span>
                  Rev {v.revision ?? '-'} ({v.status})
                </span>
                <span className="text-gray-500">{v.uploadDate}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-500">No history recorded.</div>
        )}
      </div>

      <div className="border-t px-3 py-2 flex gap-2 text-xs">
        <button
        type="button"
        className="px-2 py-1 border rounded disabled:opacity-60"
        disabled={!document.pdfUrl}
        onClick={() => {
            if (document.pdfUrl) {
            window.open(document.pdfUrl, '_blank');
            }
        }}
        >
        Open preview
        </button>
        <button
          type="button"
          className="px-2 py-1 border rounded"
          onClick={() => console.log('Open NAS for', document.nasPath)}
        >
          Open NAS folder
        </button>
      </div>
    </div>
  );
}

type StatusChipProps = {
  status: DocumentStatus;
};

function StatusChip({ status }: StatusChipProps) {
  let label = status;
  let className =
    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ';

  switch (status) {
    case 'clean':
      label = 'Current';
      className += 'bg-green-50 border-green-400 text-green-700';
      break;
    case 'needs_attention':
      label = 'Needs attention';
      className += 'bg-yellow-50 border-yellow-500 text-yellow-700';
      break;
    case 'unmatched':
      label = 'Unmatched';
      className += 'bg-orange-50 border-orange-500 text-orange-700';
      break;
    case 'revision_check':
      label = 'Revision check';
      className += 'bg-blue-50 border-blue-500 text-blue-700';
      break;
    case 'pending':
      label = 'Processing';
      className += 'bg-gray-50 border-gray-400 text-gray-700';
      break;
    case 'error':
      label = 'Error';
      className += 'bg-red-50 border-red-500 text-red-700';
      break;
    default:
      label = 'Other';
      className += 'bg-gray-50 border-gray-400 text-gray-700';
      break;
  }

  return <span className={className}>{label}</span>;
}
