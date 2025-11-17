'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Erro'); return; }
    localStorage.setItem('token', data.token);
    router.push('/area/upload');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 p-6 bg-white/5">
       <h1 className="text-2xl font-bold text-center text-white mb-6">
  Entrar no Sistema
</h1>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div><label className="block text-sm">Email</label>
          <input className="w-full mt-1 p-2 rounded bg-white/10" value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div><label className="block text-sm">Senha</label>
          <input type="password" className="w-full mt-1 p-2 rounded bg-white/10" value={password} onChange={e=>setPassword(e.target.value)} /></div>
        <button className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10">Entrar</button>
      </form>
    </main>
  );
}
