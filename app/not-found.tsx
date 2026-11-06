import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card">
      <h1>We couldn’t find that page</h1>
      <p className="muted">The link may be mistyped, or the organizer link may be missing its key.</p>
      <Link href="/" className="btn secondary">Go home</Link>
    </div>
  );
}
