import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'MR DIY Food Ordering',
  description: 'Weekly staff meal planning and ordering',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
