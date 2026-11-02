import Link from 'next/link';
export default function Away() {
  return (
    <main>
      <h1>Unmounted</h1>
      <Link href="/">Return</Link>
    </main>
  );
}
