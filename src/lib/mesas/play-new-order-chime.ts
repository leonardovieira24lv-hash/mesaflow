/**
 * Sprint "Destaque de Pedido Não Processado" (2026-07-31): som curto,
 * sintetizado via Web Audio API — não um arquivo de áudio importado. Duas
 * notas rápidas (ver `playNewOrderChime`), ~260ms no total, envelope de
 * ganho suave (evita "clique" no início/fim) — referência: bipe de
 * confirmação de PDV/KDS, não um alerta longo ou "divertido".
 *
 * `AudioContext` é criado só na primeira chamada (não no import/mount do
 * componente) — navegadores restringem áudio antes de qualquer interação
 * do usuário na página; como este painel é usado o dia inteiro com toques
 * constantes, na prática o contexto já estará liberado bem antes do
 * primeiro pedido. Mesmo assim, `.resume()` é chamado defensivamente e
 * qualquer falha (contexto bloqueado, navegador sem suporte) é
 * silenciosa — o alerta visual (animação + badge) nunca depende do som
 * pra funcionar.
 */
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedContext) {
    sharedContext = new AudioContextClass();
  }
  return sharedContext;
}

function playTone(context: AudioContext, frequency: number, startTime: number, duration: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  // Envelope: sobe rápido, segura, cai suave — evita o "clique" de um
  // ganho ligado/desligado abruptamente.
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.22, startTime + 0.015);
  gain.gain.setValueAtTime(0.22, startTime + duration - 0.06);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playNewOrderChime() {
  try {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;
    // Duas notas curtas, subindo (estilo "ping-pong" de confirmação) —
    // ~130ms cada, ~260ms no total.
    playTone(context, 880, now, 0.13);
    playTone(context, 1175, now + 0.13, 0.13);
  } catch {
    // Best-effort — nunca deixa a ausência de som quebrar a experiência
    // visual (animação/badge continuam funcionando normalmente).
  }
}
