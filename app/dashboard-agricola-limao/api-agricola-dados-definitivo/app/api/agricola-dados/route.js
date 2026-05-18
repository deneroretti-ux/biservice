import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PASTA_PADRAO = "C:\\Users\\BiService\\Desktop\\TESTE";

function isExcelFile(fileName) {
  const lower = String(fileName || "").toLowerCase();
  return (
    (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) &&
    !lower.startsWith("~$")
  );
}

function getLatestExcelFile(folderPath) {
  if (!fs.existsSync(folderPath)) {
    return {
      ok: false,
      status: 404,
      message: `Pasta não encontrada: ${folderPath}`,
    };
  }

  const files = fs
    .readdirSync(folderPath)
    .filter(isExcelFile)
    .map((fileName) => {
      const fullPath = path.join(folderPath, fileName);
      const stat = fs.statSync(fullPath);
      return {
        fileName,
        fullPath,
        modifiedMs: stat.mtimeMs,
        size: stat.size,
      };
    })
    .filter((file) => file.size > 0)
    .sort((a, b) => b.modifiedMs - a.modifiedMs);

  if (!files.length) {
    return {
      ok: false,
      status: 404,
      message: `Nenhum arquivo Excel encontrado em: ${folderPath}`,
    };
  }

  return { ok: true, file: files[0] };
}

export async function GET() {
  try {
    const folderPath = process.env.AGRICOLA_DADOS_DIR || PASTA_PADRAO;
    const result = getLatestExcelFile(folderPath);

    if (!result.ok) {
      return new Response(result.message, {
        status: result.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = fs.readFileSync(result.file.fullPath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(result.file.fileName)}`,
        "x-file-name": encodeURIComponent(result.file.fileName),
        "x-file-path": encodeURIComponent(result.file.fullPath),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Erro na API /api/agricola-dados:", error);

    return new Response(
      `Erro ao ler arquivo agrícola: ${error?.message || String(error)}`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
