// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Doc Control',
  description: 'Document control frontend (doc-client)',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout(props: RootLayoutProps) {
  const { children } = props;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          backgroundColor: '#f1f5f9',
        }}
      >
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <aside
            style={{
              width: 220,
              backgroundColor: '#ffffff',
              borderRight: '1px solid #e2e8f0',
              padding: '0.75rem 0.75rem 1rem',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                padding: '0.5rem 0.5rem 0.75rem',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '0.75rem',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  color: '#0f172a',
                }}
              >
                Doc Control
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#64748b',
                  marginTop: '0.1rem',
                }}
              >
                client (Next.js on Pi)
              </div>
            </div>

            <nav style={{ fontSize: '0.9rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  padding: '0.25rem 0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Documents
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li>
                  <Link
                    href="/"
                    style={{
                      display: 'block',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 4,
                      textDecoration: 'none',
                      color: '#0f172a',
                    }}
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/documents/upload"
                    style={{
                      display: 'block',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 4,
                      textDecoration: 'none',
                      color: '#0f172a',
                    }}
                  >
                    Upload documents
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main content */}
          <main
            style={{
              flex: 1,
              padding: '1.25rem 1.5rem',
              boxSizing: 'border-box',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
