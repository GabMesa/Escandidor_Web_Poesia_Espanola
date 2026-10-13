import { interpolatePoemEdit } from './poem-exports.js';

function wrapText(context, text, width) {
  const lines = [];
  for (const verse of text.split('\n')) {
    let line = '';
    for (const character of Array.from(verse)) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line); line = character;
      } else line += character;
    }
    lines.push(line);
  }
  return lines;
}

export function createPoemVideoExporter({ dialog, canvas, speed, preview, download, status, summary }) {
  const context = canvas.getContext('2d');
  let title = '', timeline = [], operation = null, fontSize = 34;
  const fps = 30;
  const mimeTypes = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const recordingType = typeof MediaRecorder === 'function'
    ? mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) : null;
  let palette;
  function seconds() { return Math.max(.5, Math.min(10, Number(speed.value) || 2)); }
  function totalFrames() { return Math.ceil((timeline.length + 1) * seconds() * fps); }
  function fitPoem() {
    for (fontSize = 34; fontSize > 1; fontSize--) {
      context.font = `${fontSize}px Georgia, serif`;
      if (timeline.every(frame => wrapText(context, frame.text, 1120).length * fontSize * 1.4 <= 460)) break;
    }
  }
  function draw(frameIndex = totalFrames() - 1) {
    const time = frameIndex / fps;
    const sceneIndex = Math.min(timeline.length - 1, Math.floor(time / seconds()));
    const current = timeline[sceneIndex];
    if (!current) return;
    const previous = timeline[sceneIndex - 1]?.text || '';
    const progress = Math.min(1, (time / seconds() - sceneIndex) / .7);
    const text = interpolatePoemEdit(previous, current.text, progress);
    context.fillStyle = palette.paper; context.fillRect(0, 0, 1280, 720);
    context.fillStyle = palette.ink; context.font = '22px Georgia, serif'; context.fillText('Mesa de Poesía', 80, 50);
    context.font = '14px system-ui, sans-serif'; context.textAlign = 'right'; context.fillText('EL POEMA SE CONSTRUYE', 1200, 50); context.textAlign = 'left';
    context.strokeStyle = palette.line; context.beginPath(); context.moveTo(80, 70); context.lineTo(1200, 70); context.stroke();
    let titleSize = 32;
    do { context.font = `${titleSize--}px Georgia, serif`; } while (context.measureText(title).width > 1120 && titleSize > 10);
    context.fillStyle = palette.ink; context.fillText(title, 80, 123);
    context.font = `${fontSize}px Georgia, serif`;
    const lines = wrapText(context, text, 1120);
    lines.forEach((line, index) => context.fillText(line, 80, 180 + index * fontSize * 1.4));
    context.font = '15px system-ui, sans-serif'; context.fillStyle = palette.muted;
    context.fillText(`${current.label} · ${sceneIndex + 1} de ${timeline.length}`, 80, 670);
    context.textAlign = 'right'; context.fillText('Del primer borrador al último verso.', 1200, 670); context.textAlign = 'left';
    context.fillStyle = palette.line; context.fillRect(80, 690, 1120, 3);
    context.fillStyle = palette.accent; context.fillRect(80, 690, 1120 * frameIndex / Math.max(1, totalFrames() - 1), 3);
  }
  function describe() {
    summary.textContent = `${title} · ${timeline.length} ${timeline.length === 1 ? 'edición' : 'ediciones'} · ${((timeline.length + 1) * seconds()).toFixed(1)} segundos.`;
  }
  function stop() { operation?.abort(); }
  function busy(value) {
    preview.disabled = value; download.disabled = value || !recordingType || !canvas.captureStream; speed.disabled = value;
  }
  async function play(record) {
    stop();
    const controller = new AbortController(); operation = controller;
    busy(true);
    let stream, recorder, stopped, recordingError;
    const chunks = [];
    try {
      draw(0);
      if (record) {
        stream = canvas.captureStream(fps);
        recorder = new MediaRecorder(stream, { mimeType: recordingType, videoBitsPerSecond: 4_000_000 });
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        stopped = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.onerror = event => { recordingError = event.error || new Error('No se pudo grabar el video.'); controller.abort(); };
        recorder.start();
      }
      const frames = totalFrames();
      for (let frame = 0; frame < frames; frame++) {
        if (controller.signal.aborted) throw recordingError || new DOMException('Cancelado', 'AbortError');
        draw(frame);
        status.textContent = `${record ? 'Creando video' : 'Vista previa'}: ${Math.round((frame + 1) / frames * 100)} %`;
        await new Promise(resolve => setTimeout(resolve, 1000 / fps));
      }
      if (controller.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
      if (record) {
        recorder.stop(); await stopped;
        if (controller.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
        if (recordingError) throw recordingError;
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (!blob.size) throw new Error('El navegador no pudo crear el video.');
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0,100) || 'poema'}-evolucion.${recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        status.textContent = 'Video descargado. Puedes reproducirlo o compartirlo.';
      } else status.textContent = 'Vista previa terminada.';
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'Exportación cancelada.' : error.message || 'No se pudo generar el video.';
    } finally {
      if (recorder && recorder.state !== 'inactive') { recorder.stop(); await stopped; }
      stream?.getTracks().forEach(track => track.stop());
      if (operation === controller) { operation = null; busy(false); }
    }
  }
  preview.addEventListener('click', () => play(false));
  download.addEventListener('click', () => play(true));
  speed.addEventListener('input', () => { describe(); draw(); });
  dialog.addEventListener('close', stop);
  for (const button of dialog.querySelectorAll('[data-close-video]')) button.addEventListener('click', () => { stop(); dialog.close(); });
  return {
    open(poemTitle, frames) {
      title = poemTitle; timeline = frames;
      const style = getComputedStyle(document.documentElement);
      palette = { paper: style.getPropertyValue('--brand-bg').trim(), ink: style.getPropertyValue('--text').trim(), muted: style.getPropertyValue('--muted').trim(), line: style.getPropertyValue('--line').trim(), accent: style.getPropertyValue('--accent').trim() };
      describe(); fitPoem(); busy(false); draw();
      status.textContent = !recordingType || !canvas.captureStream
        ? 'Este navegador permite ver la animación, pero no grabar el video. Prueba con un navegador actualizado.'
        : 'La exportación tarda lo mismo que dura el video. Mantén esta pestaña visible durante la grabación.';
      dialog.showModal();
    }
  };
}
