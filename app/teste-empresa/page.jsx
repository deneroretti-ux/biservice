'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TesteEmpresa() {
  const [dados, setDados] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setErro('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        setErro('Erro ao buscar usuário logado: ' + userError.message)
        return
      }

      if (!user) {
        setErro('Usuário não logado')
        return
      }

      setUsuario(user)

      // TESTE SIMPLES
      const { data, error } = await supabase
        .from('usuarios_empresas')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error(error)
        setErro('Erro ao buscar vínculos: ' + error.message)
        return
      }

      setDados(data)
    }

    carregar()
  }, [])

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 40,
        background: '#0B1220',
        color: '#fff',
        fontFamily: 'Arial',
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>
        Teste Empresa / Multiempresa
      </h1>

      {erro && (
        <div
          style={{
            background: '#7f1d1d',
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {erro}
        </div>
      )}

      <section
        style={{
          background: 'rgba(255,255,255,0.08)',
          padding: 20,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>
          Usuário logado
        </h2>

        <pre style={{ whiteSpace: 'pre-wrap' }}>
{JSON.stringify(
  {
    id: usuario?.id,
    email: usuario?.email,
  },
  null,
  2
)}
        </pre>
      </section>

      <section
        style={{
          background: 'rgba(255,255,255,0.08)',
          padding: 20,
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>
          Vínculos encontrados
        </h2>

        <pre style={{ whiteSpace: 'pre-wrap' }}>
{JSON.stringify(dados, null, 2)}
        </pre>
      </section>
    </main>
  )
}
