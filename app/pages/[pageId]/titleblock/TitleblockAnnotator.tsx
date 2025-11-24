'use client';

import React, {
  MouseEvent as ReactMouseEvent,
  useRef,
  useState,
} from 'react';

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

interface TitleblockAnnotatorProps {
  pageId: string;
  imageUrl: string;
  initialTitleblockRect: PixelRect | null;
  initialClicks: FingerprintClick[];
}

interface NormalisedPoint {
  x: number;
  y: number;
}

interface FieldPoint {
  x_rel: number;
  y_rel: number;
}

interface FieldPointMap {
  drawing_number: FieldPoint | null;
  drawing_title: FieldPoint | null;
  revision: FieldPoint | null;
  other: FieldPoint | null;
}

type ActiveTool = 'titleblock' | FieldKey | null;

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function computeNormRect(
  start: NormalisedPoint | null,
  current: NormalisedPoint | null,
): { left: number; top: number; width: number; height: number } | null {
  if (!start || !current) {
    return null;
  }

  const x1 = clamp01(start.x);
  const y1 = clamp01(start.y);
  const x2 = clamp01(current.x);
  const y2 = clamp01(current.y);

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { left, top, width, height };
}

function pixelRectFromNormUsingOverlay(
  rectNorm:
    | { left: number; top: number; width: number; height: number }
    | null,
  overlay: HTMLDivElement | null,
): PixelRect | null {
  if (!rectNorm || !overlay) {
    return null;
  }

  const rect = overlay.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = Math.round(rectNorm.left * rect.width);
  const y = Math.round(rectNorm.top * rect.height);
  const width = Math.round(rectNorm.width * rect.width);
  const height = Math.round(rectNorm.height * rect.height);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function buildInitialFieldPoints(
  clicks: FingerprintClick[],
): FieldPointMap {
  const result: FieldPointMap = {
    drawing_number: null,
    drawing_title: null,
    revision: null,
    other: null,
  };

  for (const c of clicks) {
    if (
      c.field === 'drawing_number' ||
      c.field === 'drawing_title' ||
      c.field === 'revision' ||
      c.field === 'other'
    ) {
      result[c.field] = { x_rel: c.x_rel, y_rel: c.y_rel };
    }
  }

  return result;
}

export default function TitleblockAnnotator(
  props: TitleblockAnnotatorProps,
) {
  const { pageId, imageUrl, initialTitleblockRect, initialClicks } = props;

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [titleblockRect, setTitleblockRect] = useState<PixelRect | null>(
    initialTitleblockRect,
  );
  const [draftStart, setDraftStart] = useState<NormalisedPoint | null>(
    null,
  );
  const [draftCurrent, setDraftCurrent] =
    useState<NormalisedPoint | null>(null);
  const [dragging, setDragging] = useState(false);

  const [fieldPoints, setFieldPoints] = useState<FieldPointMap>(() =>
    buildInitialFieldPoints(initialClicks),
  );

  const [activeTool, setActiveTool] = useState<ActiveTool>(() =>
    initialTitleblockRect ? 'drawing_number' : 'titleblock',
  );

  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const hasTitleblock = titleblockRect !== null;

  function getNormalisedPoint(
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ): NormalisedPoint | null {
    const overlay = overlayRef.current;
    if (!overlay) {
      return null;
    }

    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    return { x: clamp01(x), y: clamp01(y) };
  }

  function handleOverlayMouseDown(
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ): void {
    if (activeTool !== 'titleblock') {
      return;
    }

    event.preventDefault();

    const point = getNormalisedPoint(event);
    if (!point) {
      return;
    }

    setDraftStart(point);
    setDraftCurrent(point);
    setDragging(true);
    setStatusMessage(null);
  }

  function handleOverlayMouseMove(
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ): void {
    if (!dragging || activeTool !== 'titleblock') {
      return;
    }

    const point = getNormalisedPoint(event);
    if (!point) {
      return;
    }

    setDraftCurrent(point);
  }

  function handleOverlayMouseUp(): void {
    if (!dragging) {
      return;
    }
    setDragging(false);
  }

  function handleOverlayMouseLeave(): void {
    if (!dragging) {
      return;
    }
    setDragging(false);
  }

  function handleOverlayClick(
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ): void {
    if (
      activeTool === 'titleblock' ||
      !titleblockRect ||
      !overlayRef.current
    ) {
      return;
    }

    const overlay = overlayRef.current;
    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const tb = titleblockRect;
    const insideX = x >= tb.x && x <= tb.x + tb.width;
    const insideY = y >= tb.y && y <= tb.y + tb.height;

    if (!insideX || !insideY) {
      setStatusMessage(
        'Click was outside the title-block area. Please click inside the green box.',
      );
      return;
    }

    const x_rel = clamp01((x - tb.x) / tb.width);
    const y_rel = clamp01((y - tb.y) / tb.height);

    if (
      activeTool === 'drawing_number' ||
      activeTool === 'drawing_title' ||
      activeTool === 'revision' ||
      activeTool === 'other'
    ) {
      setFieldPoints((prev) => ({
        ...prev,
        [activeTool]: { x_rel, y_rel },
      }));
      setStatusMessage(
        `Set ${activeTool} at (${x_rel.toFixed(2)}, ${y_rel.toFixed(
          2,
        )}) inside title-block.`,
      );
    }
  }

  function handleConfirmTitleblock(): void {
    setStatusMessage(null);

    const overlay = overlayRef.current;
    if (!overlay) {
      setStatusMessage(
        'Overlay not ready. Please try again after the image has loaded.',
      );
      return;
    }

    const normRect = computeNormRect(draftStart, draftCurrent);

    if (!normRect) {
      setStatusMessage(
        'No selection defined. Click and drag a rectangle around the title-block, then click Confirm title-block.',
      );
      return;
    }

    const rect = pixelRectFromNormUsingOverlay(normRect, overlay);

    if (!rect) {
      setStatusMessage(
        'Unable to compute title-block rectangle. Please try again.',
      );
      return;
    }

    if (rect.width < 10 || rect.height < 10) {
      setStatusMessage(
        'Selection is too small. Please drag a larger title-block area.',
      );
      return;
    }

    setTitleblockRect(rect);
    setDraftStart(null);
    setDraftCurrent(null);
    setActiveTool('drawing_number');
    setStatusMessage(
      `Title-block set at x=${rect.x}, y=${rect.y}, w=${rect.width}, h=${rect.height}.`,
    );
  }

  async function handleSaveAll(): Promise<void> {
    setStatusMessage(null);

    if (!titleblockRect) {
      setStatusMessage(
        'Title-block is not defined. Set the title-block before saving.',
      );
      return;
    }

    const clicks: FingerprintClick[] = [];
    const keys: FieldKey[] = [
      'drawing_number',
      'drawing_title',
      'revision',
      'other',
    ];

    for (const key of keys) {
      const p = fieldPoints[key];
      if (!p) {
        continue;
      }
      clicks.push({
        field: key,
        x_rel: p.x_rel,
        y_rel: p.y_rel,
      });
    }

    setSaving(true);

    try {
      const response = await fetch('/api/titleblock-annotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          titleblock: {
            x: titleblockRect.x,
            y: titleblockRect.y,
            width: titleblockRect.width,
            height: titleblockRect.height,
          },
          clicks,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json || json.ok !== true) {
        const message =
          (json && json.error) ||
          `Save failed with status ${response.status}`;
        setStatusMessage(message);
      } else {
        setStatusMessage('Title-block and field clicks saved.');
      }
    } catch {
      setStatusMessage('Network or server error while saving.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear(): Promise<void> {
    setStatusMessage(null);

    const nothingToClear =
      !titleblockRect &&
      !fieldPoints.drawing_number &&
      !fieldPoints.drawing_title &&
      !fieldPoints.revision &&
      !fieldPoints.other;

    if (nothingToClear) {
      setStatusMessage('Nothing to clear for this page.');
      return;
    }

    const confirmed = window.confirm(
      'Clear all title-block and field annotations for this page?',
    );
    if (!confirmed) {
      return;
    }

    setClearing(true);

    try {
      const response = await fetch('/api/titleblock-annotate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json || json.ok !== true) {
        const message =
          (json && json.error) ||
          `Clear failed with status ${response.status}`;
        setStatusMessage(message);
      } else {
        setTitleblockRect(null);
        setDraftStart(null);
        setDraftCurrent(null);
        setFieldPoints({
          drawing_number: null,
          drawing_title: null,
          revision: null,
          other: null,
        });
        setActiveTool('titleblock');
        setStatusMessage('All annotations cleared for this page.');
      }
    } catch {
      setStatusMessage('Network or server error while clearing.');
    } finally {
      setClearing(false);
    }
  }

  const draftRectNorm = computeNormRect(draftStart, draftCurrent);

  function renderOverlayRects() {
    const elements: React.ReactNode[] = [];

    if (titleblockRect) {
      elements.push(
        <div
          key="titleblock"
          style={{
            position: 'absolute',
            left: titleblockRect.x,
            top: titleblockRect.y,
            width: titleblockRect.width,
            height: titleblockRect.height,
            border: '2px solid #22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />,
      );
    }

    if (draftRectNorm && !titleblockRect && overlayRef.current) {
      elements.push(
        <div
          key="draft"
          style={{
            position: 'absolute',
            left: `${draftRectNorm.left * 100}%`,
            top: `${draftRectNorm.top * 100}%`,
            width: `${draftRectNorm.width * 100}%`,
            height: `${draftRectNorm.height * 100}%`,
            border: '2px solid #ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.18)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />,
      );
    }

    return elements;
  }

  function renderFieldMarkers() {
    if (!titleblockRect) {
      return null;
    }

    const tb = titleblockRect;
    const markers: React.ReactNode[] = [];

    const entries: [FieldKey, FieldPoint | null][] = [
      ['drawing_number', fieldPoints.drawing_number],
      ['drawing_title', fieldPoints.drawing_title],
      ['revision', fieldPoints.revision],
      ['other', fieldPoints.other],
    ];

    for (const [field, pt] of entries) {
      if (!pt) {
        continue;
      }

      const x = tb.x + pt.x_rel * tb.width;
      const y = tb.y + pt.y_rel * tb.height;

      const label =
        field === 'drawing_number'
          ? 'D'
          : field === 'drawing_title'
          ? 'T'
          : field === 'revision'
          ? 'R'
          : 'O';

      let borderColor = '#1d4ed8';
      let backgroundColor = '#60a5fa';

      if (field === 'drawing_number') {
        borderColor = '#0f766e';
        backgroundColor = '#14b8a6';
      } else if (field === 'drawing_title') {
        borderColor = '#4f46e5';
        backgroundColor = '#6366f1';
      } else if (field === 'revision') {
        borderColor = '#b45309';
        backgroundColor = '#f97316';
      } else if (field === 'other') {
        borderColor = '#4b5563';
        backgroundColor = '#9ca3af';
      }

      markers.push(
        <div
          key={field}
          title={field}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: `2px solid ${borderColor}`,
            backgroundColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            color: '#ffffff',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>,
      );
    }

    return markers;
  }

  const titleblockButtonDisabled = !!titleblockRect;
  const otherButtonsDisabled = !titleblockRect;
  const busy = saving || clearing;

  return (
    <div>
      <div
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.85rem',
          color: '#475569',
        }}
      >
        <p style={{ marginBottom: '0.25rem' }}>
          1. With <strong>Title-block</strong> selected, click and drag a
          rectangle around the title-block on the page.
        </p>
        <p style={{ marginBottom: '0.25rem' }}>
          2. Click <strong>Confirm title-block</strong>. The box turns
          green.
        </p>
        <p style={{ marginBottom: '0.25rem' }}>
          3. Select a field (Drawing number, Drawing title, Revision, Other)
          and click on the corresponding text inside the green box. You can
          re-click to move any point.
        </p>
        <p style={{ marginBottom: '0.25rem' }}>
          4. When you are happy, click <strong>Save</strong> to write all
          annotations to Supabase, or <strong>Clear</strong> to wipe them.
        </p>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          border: '1px solid #e5e7eb',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: '0.75rem',
          maxWidth: '100%',
        }}
      >
        <img
          src={imageUrl}
          alt="Page preview for title-block annotation"
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        />
        <div
          ref={overlayRef}
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
          onMouseLeave={handleOverlayMouseLeave}
          onClick={handleOverlayClick}
          style={{
            position: 'absolute',
            inset: 0,
            cursor: 'crosshair',
          }}
        >
          {renderOverlayRects()}
          {renderFieldMarkers()}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.5rem',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTool('titleblock')}
          disabled={titleblockButtonDisabled || busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #16a34a',
            backgroundColor:
              !titleblockButtonDisabled && activeTool === 'titleblock'
                ? '#bbf7d0'
                : '#22c55e',
            opacity: busy && !titleblockButtonDisabled ? 0.8 : 1,
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor:
              titleblockButtonDisabled || busy ? 'default' : 'pointer',
          }}
        >
          Title-block
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('drawing_number')}
          disabled={otherButtonsDisabled || busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #0f766e',
            backgroundColor:
              !otherButtonsDisabled && activeTool === 'drawing_number'
                ? '#99f6e4'
                : '#14b8a6',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor:
              otherButtonsDisabled || busy ? 'default' : 'pointer',
          }}
        >
          Drawing number
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('drawing_title')}
          disabled={otherButtonsDisabled || busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #4f46e5',
            backgroundColor:
              !otherButtonsDisabled && activeTool === 'drawing_title'
                ? '#c7d2fe'
                : '#6366f1',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor:
              otherButtonsDisabled || busy ? 'default' : 'pointer',
          }}
        >
          Drawing title
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('revision')}
          disabled={otherButtonsDisabled || busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #b45309',
            backgroundColor:
              !otherButtonsDisabled && activeTool === 'revision'
                ? '#fed7aa'
                : '#f97316',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor:
              otherButtonsDisabled || busy ? 'default' : 'pointer',
          }}
        >
          Revision
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('other')}
          disabled={otherButtonsDisabled || busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #6b7280',
            backgroundColor:
              !otherButtonsDisabled && activeTool === 'other'
                ? '#e5e7eb'
                : '#9ca3af',
            color: '#111827',
            fontSize: '0.85rem',
            cursor:
              otherButtonsDisabled || busy ? 'default' : 'pointer',
          }}
        >
          Other
        </button>

        <button
          type="button"
          onClick={handleConfirmTitleblock}
          disabled={titleblockButtonDisabled || busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #15803d',
            backgroundColor:
              titleblockButtonDisabled || busy ? '#bbf7d0' : '#16a34a',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor:
              titleblockButtonDisabled || busy ? 'default' : 'pointer',
          }}
        >
          Confirm title-block
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={busy}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 4,
            border: '1px solid #b91c1c',
            backgroundColor: busy ? '#fecaca' : '#ef4444',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor: busy ? 'default' : 'pointer',
            marginLeft: 'auto',
          }}
        >
          {clearing ? 'Clearing…' : 'Clear'}
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!hasTitleblock || busy}
          style={{
            padding: '0.3rem 0.9rem',
            borderRadius: 4,
            border: '1px solid #1d4ed8',
            backgroundColor:
              !hasTitleblock || busy ? '#bfdbfe' : '#2563eb',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor:
              !hasTitleblock || busy ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {statusMessage && (
        <p
          style={{
            fontSize: '0.8rem',
            color: '#374151',
          }}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}
