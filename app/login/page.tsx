'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('E-mail ou senha inválidos.');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.session?.access_token || '');

      router.push('/area/upload');

    } catch (err: any) {
      setError(err?.message || 'Falha de rede ou erro inesperado.');
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0B1220]">
      <div className="flex items-center mb-6">
        <img
          src="/logo/logo.png"
          alt="BI Service"
          className="w-16 h-16 object-contain mr-2"
        />
        <h1 className="text-3xl font-bold">
          <span className="text-white">BI</span>{' '}
          <span className="text-blue-400">Service</span>
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 p-6 bg-white/5 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-6">
          Entrar no Sistema
        </h1>

        {error && (
          <div className="text-red-400 text-sm text-center">{error}</div>
        )}

        <div>
          <label className="block text-sm text-white/80">Email</label>
          <input
            className="w-full mt-1 p-2 rounded bg-white/10 text-white border border-white/10 focus:border-blue-400 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-white/80">Senha</label>
          <input
            type="password"
            className="w-full mt-1 p-2 rounded bg-white/10 text-white border border-white/10 focus:border-blue-400 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
