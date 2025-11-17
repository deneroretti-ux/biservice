"use client";
import { useState } from "react";

export default function UploadPage() {
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    setMsg(res.ok ? "Arquivo(s) enviado(s)" : "Falha no upload");
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">Upload de Arquivos</h2>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border bg-white p-4">
        <input name="files" type="file" multiple className="block" />
        <button className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-white">Enviar</button>
        {msg && <div className="text-sm text-zinc-600">{msg}</div>}
      </form>
    </div>
  );
}
