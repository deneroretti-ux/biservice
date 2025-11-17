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

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login.');
        return;
      }

      // 🔹 Armazena token no localStorage e também em cookie
      localStorage.setItem('token', data.token);
      document.cookie = `token=${data.token}; Path=/; SameSite=Lax`;

      // 🔹 Redireciona para upload após login
      router.push('/area/upload');
    } catch (err: any) {
      setError(err?.message || 'Falha de rede ou erro inesperado.');
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0B1220]">
      {/* Logo e nome */}
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

      {/* Formulário */}
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
          className="w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
