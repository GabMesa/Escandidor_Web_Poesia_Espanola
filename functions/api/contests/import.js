import { errorResponse, jsonResponse, requireUser, safeJson } from '../../_lib/helpers.js';
import { fetchContest } from '../../../taller/importer.js';
import { extractContestPdf } from '../../_lib/contest-pdf.js';

export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env);
  if (error) return error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return errorResponse('Origen no permitido.', 403);
  const body = await safeJson(request);
  try {
    const contest = await fetchContest(body.url, { extractPdf: extractContestPdf });
    return jsonResponse({ ok: true, contest }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error.name === 'AbortError' ? 'La consulta demoró demasiado. Podés completar la ficha manualmente.' : error.message, 422);
  }
}
