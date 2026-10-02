import './globals.css';
export const metadata = { title: 'Kargo Hiring Dashboard' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <nav><b>Kargo Hiring</b><a href="/">Upload</a><a href="/dashboard">Dashboard</a></nav>
      <main>{children}</main>
    </body></html>
  );
}
