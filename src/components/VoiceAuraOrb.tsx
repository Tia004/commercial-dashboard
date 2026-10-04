'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  NEURAL_VOICES,
  NeuralVoice,
  getSavedVoice,
  saveVoice,
  playVoiceSample,
  playAiBriefing,
  stopAllAudio,
  isSpeechPlaying,
} from '@/lib/speechVoice';

interface VoiceAuraOrbProps {
  crmContext?: {
    pipelineTotal?: number;
    openDealsCount?: number;
    todayTasksCount?: number;
    brands?: string[];
    urgentDeals?: string[];
  };
  onClose?: () => void;
  standalone?: boolean;
}

export const VoiceAuraOrb: React.FC<VoiceAuraOrbProps> = ({
  crmContext,
  onClose,
  standalone = false,
}) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('Fenrir');
  const [status, setStatus] = useState<'idle' | 'generating' | 'playing'>('idle');
  const [spokenText, setSpokenText] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [speed, setSpeed] = useState<number>(1.0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setSelectedVoiceId(getSavedVoice());
  }, []);

  const currentVoice: NeuralVoice =
    NEURAL_VOICES.find((v) => v.id === selectedVoiceId) || NEURAL_VOICES[0];

  const handleSelectVoice = (id: string) => {
    stopAllAudio();
    setStatus('idle');
    setSelectedVoiceId(id);
    saveVoice(id);
    setFeedback(`Voce ${id} selezionata.`);
  };

  const handlePlaySample = async () => {
    if (status === 'playing') {
      stopAllAudio();
      setStatus('idle');
      setFeedback('Riproduzione interrotta.');
      return;
    }

    stopAllAudio();
    setStatus('generating');
    setFeedback(`Preparazione voce ${currentVoice.name}…`);
    setSpokenText('');

    await playVoiceSample(selectedVoiceId, {
      onStart: () => {
        setStatus('playing');
        setFeedback(`In riproduzione: ${currentVoice.name}`);
      },
      onEnd: () => {
        setStatus('idle');
        setFeedback('');
      },
      onError: (err) => {
        setStatus('idle');
        setFeedback(`Errore: ${err.message || 'Riproduzione non riuscita'}`);
      },
    });
  };

  const handlePlayBriefing = async () => {
    if (status === 'playing') {
      stopAllAudio();
      setStatus('idle');
      return;
    }

    stopAllAudio();
    setStatus('generating');
    setFeedback('Generazione briefing motivazionale AI…');
    setSpokenText('');

    await playAiBriefing({
      voice: selectedVoiceId,
      crmContext,
      onGenerating: () => setStatus('generating'),
      onStart: () => setStatus('playing'),
      onText: (text) => setSpokenText(text),
      onEnd: () => {
        setStatus('idle');
        setFeedback('');
      },
      onError: (err) => {
        setStatus('idle');
        setFeedback(`Errore: ${err.message || 'Generazione non riuscita'}`);
      },
    });
  };

  // Canvas Aurora Borealis Fluid Animation (ChatGPT Voice Mode recreation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const render = () => {
      t += status === 'playing' ? 0.045 : status === 'generating' ? 0.03 : 0.015;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = w / 2 - 2;

      ctx.clearRect(0, 0, w, h);

      // Clip to circular orb
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // 1. Deep Celestial Electric Blue Top Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1e3a8a'); // rich cobalt
      skyGrad.addColorStop(0.25, '#2563eb'); // electric royal blue
      skyGrad.addColorStop(0.55, '#3b82f6'); // azure highlight
      skyGrad.addColorStop(1, '#0f172a'); // deep base
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Dynamic multi-sine billowing Aurora Clouds (like ChatGPT screen)
      const pulse = status === 'playing' ? Math.sin(t * 3) * 12 + 6 : 0;
      const waveOffset1 = Math.sin(t * 0.9) * 18;
      const waveOffset2 = Math.cos(t * 1.2) * 14;

      // Cloud layer 1 (Soft luminous cyan-white haze)
      ctx.fillStyle = 'rgba(219, 234, 254, 0.45)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.42 + waveOffset1);
      for (let x = 0; x <= w; x += 10) {
        const y =
          h * 0.45 +
          Math.sin(x * 0.025 + t * 1.1) * 22 +
          Math.cos(x * 0.012 - t * 0.7) * 15 +
          pulse;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Cloud layer 2 (Billowing White Cloud Peaks)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.52 + waveOffset2);
      for (let x = 0; x <= w; x += 8) {
        const y =
          h * 0.53 +
          Math.sin(x * 0.035 + t * 1.4) * 26 +
          Math.cos(x * 0.018 + t * 0.8) * 18 +
          pulse * 0.7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Cloud layer 3 (Pure White Soft Foreground Mist)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.65);
      for (let x = 0; x <= w; x += 8) {
        const y =
          h * 0.64 +
          Math.sin(x * 0.04 - t * 1.2) * 20 +
          Math.sin(x * 0.015 + t * 1.5) * 12 +
          pulse * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // 3. Subtle 3D Spherical Vignette & Atmospheric Rim
      const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
      rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
      rimGrad.addColorStop(0.9, 'rgba(30,58,138,0.2)');
      rimGrad.addColorStop(1, 'rgba(15,23,42,0.6)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();

      // Soft circular outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = status === 'playing' ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.2)';
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [status]);

  const voiceIndex = NEURAL_VOICES.findIndex((v) => v.id === selectedVoiceId);

  return (
    <div className={`flex flex-col items-center text-center ${standalone ? 'p-6 max-w-xl mx-auto' : 'w-full'}`}>
      {/* Header info */}
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/15 border border-primary/20">
              Voce Neurale AI
            </span>
            {status === 'playing' && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                In riproduzione
              </span>
            )}
            {status === 'generating' && (
              <span className="text-[11px] font-semibold text-amber-400 animate-pulse">
                Elaborazione…
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1">
            Esperienza Vocale Naturale
          </h2>
        </div>

        {onClose && (
          <button
            onClick={() => {
              stopAllAudio();
              onClose();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Chiudi"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Aurora Borealis Orb Container (Exact ChatGPT Voice style) */}
      <div className="relative my-4 flex items-center justify-center">
        {/* Ambient atmospheric glow */}
        <div
          className={`absolute -inset-4 rounded-full filter blur-2xl transition-all duration-700 pointer-events-none ${
            status === 'playing'
              ? 'bg-blue-500/35 scale-110 opacity-100'
              : status === 'generating'
              ? 'bg-indigo-500/25 scale-105 opacity-80 animate-pulse'
              : 'bg-blue-600/15 scale-95 opacity-50'
          }`}
        />

        {/* Circular Orb Canvas */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.35)] border border-white/10 bg-black cursor-pointer group"
          onClick={handlePlaySample}
          title="Clicca per ascoltare la voce"
        >
          <canvas
            ref={canvasRef}
            width={208}
            height={208}
            className="w-full h-full block"
          />

          {/* Central Hover Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]">
            <span className="material-symbols-outlined text-white text-[38px] drop-shadow-md">
              {status === 'playing' ? 'pause_circle' : 'play_circle'}
            </span>
          </div>
        </div>
      </div>

      {/* Voice Name & Feedback */}
      <div className="mb-4">
        <div className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
          <span>{currentVoice.name}</span>
          <span className="text-[11px] text-zinc-400 font-normal">
            ({currentVoice.gender === 'male' ? 'Maschile' : 'Femminile'})
          </span>
        </div>
        <p className="text-xs text-primary font-medium mt-0.5">
          {currentVoice.tone}
        </p>
        <p className="text-[11px] text-zinc-400 max-w-sm mx-auto mt-1 leading-relaxed">
          {currentVoice.description}
        </p>
      </div>

      {/* Interactive Voice Range Slider */}
      <div className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg mb-4 text-left">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-zinc-400 font-medium">Seleziona Voce</span>
          <span className="text-primary font-mono text-[11px] font-bold">
            {voiceIndex + 1} di {NEURAL_VOICES.length}
          </span>
        </div>

        {/* Range Track Slider */}
        <div className="relative my-2">
          <input
            type="range"
            min={0}
            max={NEURAL_VOICES.length - 1}
            step={1}
            value={voiceIndex}
            onChange={(e) => {
              const idx = Number(e.target.value);
              const v = NEURAL_VOICES[idx];
              if (v) handleSelectVoice(v.id);
            }}
            className="w-full accent-blue-500 cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
            aria-label="Slider selezione voce"
          />
        </div>

        {/* Quick select pills */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {NEURAL_VOICES.map((v) => {
            const isSelected = selectedVoiceId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectVoice(v.id)}
                className={`py-1.5 px-1 rounded-xl text-center text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300 shadow-sm'
                    : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className="truncate">{v.id}</div>
                <div className="text-[9px] font-normal text-zinc-500 truncate">
                  {v.gender === 'male' ? 'M' : 'F'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Spoken Text live subtitle if available */}
      {spokenText && (
        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 mb-4 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
            Testo pronunciato
          </span>
          <p className="text-xs text-zinc-300 leading-relaxed italic">
            &ldquo;{spokenText}&rdquo;
          </p>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex items-center justify-center gap-2.5 w-full max-w-md">
        {status === 'playing' ? (
          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              setStatus('idle');
              setFeedback('Riproduzione interrotta.');
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            <span>Interrompi riproduzione</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={status === 'generating'}
              onClick={handlePlaySample}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/20 bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">volume_up</span>
              <span>Ascolta prova ({currentVoice.id})</span>
            </button>

            <button
              type="button"
              disabled={status === 'generating'}
              onClick={handlePlayBriefing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Genera il riepilogo motivazionale con i numeri reali della pipeline di oggi"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Briefing vendite</span>
            </button>
          </>
        )}
      </div>

      {feedback && (
        <span className="text-[11px] text-zinc-400 mt-2 block animate-fade-in">
          {feedback}
        </span>
      )}
    </div>
  );
};
