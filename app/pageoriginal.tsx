import Link from 'next/link';
export default function Home() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold">Portal BI Unificado</h1>
      <p className="text-slate-300 mt-2">Next.js + Prisma • Single runtime</p>
      <div className="mt-6 flex gap-4">
        <Link href="/login" className="px-4 py-2 rounded-xl bg-white/10 border border-white/10">Login</Link>
        <Link href="/area/upload" className="px-4 py-2 rounded-xl bg-white/10 border border-white/10">Área &rarr; Upload</Link>
        <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-white/10 border border-white/10">Dashboard</Link>
      </div>
    </main>
  )
}
