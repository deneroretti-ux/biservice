'use client'

import { supabase } from '@/lib/supabase'

export default function TesteSupabase() {

  async function testar() {
    const { data, error } = await supabase.auth.getSession()

    console.log('DATA:', data)
    console.log('ERROR:', error)

    alert('Supabase conectado com sucesso!')
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Teste Supabase</h1>

      <button
        onClick={testar}
        style={{
          padding: 20,
          background: '#111',
          color: '#fff',
          borderRadius: 10
        }}
      >
        Testar conexão
      </button>
    </div>
  )
}