/**
 * Ringtone & Audio Tone Synthesizer and Player
 * Supports both custom user-uploaded audio files and instant Web Audio API synthesized tones
 */

class RingtoneManager {
  private activeAudio: HTMLAudioElement | null = null;
  private ringtoneInterval: number | null = null;
  private audioCtx: AudioContext | null = null;
  private masterSynthGain: GainNode | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (this.audioCtx && !this.masterSynthGain) {
      this.masterSynthGain = this.audioCtx.createGain();
      this.masterSynthGain.connect(this.audioCtx.destination);
    }
    return this.audioCtx;
  }

  /**
   * Play Incoming Call Ringtone
   * Uses customUrl if provided, otherwise loops an energetic synthesized melodic sequence
   */
  public playIncomingRingtone(customUrl?: string | null): void {
    this.stopAll();

    if (customUrl && customUrl.trim()) {
      try {
        const audio = new Audio(customUrl);
        audio.loop = true;
        audio.volume = 0.85;
        audio.play().catch((err) => {
          console.warn('Custom ringtone autoplay blocked, falling back to Web Audio:', err);
          this.startSynthesizedIncomingLoop();
        });
        this.activeAudio = audio;
        return;
      } catch (e) {
        console.warn('Failed to load custom audio, using synthesizer fallback:', e);
      }
    }

    this.startSynthesizedIncomingLoop();
  }

  /**
   * Play Outgoing Ringback Tone (calling someone else)
   */
  public playOutgoingRingback(customUrl?: string | null): void {
    this.stopAll();

    if (customUrl && customUrl.trim()) {
      try {
        const audio = new Audio(customUrl);
        audio.loop = true;
        audio.volume = 0.7;
        audio.play().catch(() => {
          this.startSynthesizedOutgoingLoop();
        });
        this.activeAudio = audio;
        return;
      } catch {
        // Fallback
      }
    }

    this.startSynthesizedOutgoingLoop();
  }

  /**
   * Play Call Connected Chime
   */
  public playConnectedChime(): void {
    this.stopAll();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio context error
    }
  }

  /**
   * Play Call Ended / Rejected Tone
   */
  public playCallEndTone(): void {
    this.stopAll();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(349.23, now + 0.12);
      osc.frequency.setValueAtTime(261.63, now + 0.24);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch {
      // Audio context error
    }
  }

  /**
   * Preview any audio URL or synthesized tone
   */
  public previewAudio(url?: string | null): void {
    this.stopAll();
    if (url && url.trim()) {
      try {
        const audio = new Audio(url);
        audio.volume = 0.8;
        audio.play().catch(() => {
          this.playIncomingChimePattern();
        });
        this.activeAudio = audio;
        // Auto-stop after 8 seconds
        setTimeout(() => {
          if (this.activeAudio === audio) {
            this.stopAll();
          }
        }, 8000);
      } catch {
        this.playIncomingChimePattern();
      }
    } else {
      this.playIncomingChimePattern();
    }
  }

  /**
   * Stop all playing ringtones and cancel intervals
   */
  public stopAll(): void {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {}
      this.activeAudio = null;
    }

    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    if (this.audioCtx && this.masterSynthGain) {
      try {
        const now = this.audioCtx.currentTime;
        this.masterSynthGain.gain.cancelScheduledValues(now);
        this.masterSynthGain.gain.setValueAtTime(0, now);
      } catch {}
    }
  }

  // --- Internal Synthesized Loops ---

  private ensureMasterGainActive(): void {
    const ctx = this.getAudioContext();
    if (ctx && this.masterSynthGain) {
      const now = ctx.currentTime;
      this.masterSynthGain.gain.cancelScheduledValues(now);
      this.masterSynthGain.gain.setValueAtTime(1, now);
    }
  }

  private startSynthesizedIncomingLoop(): void {
    this.ensureMasterGainActive();
    this.playIncomingChimePattern();
    this.ringtoneInterval = window.setInterval(() => {
      this.ensureMasterGainActive();
      this.playIncomingChimePattern();
    }, 2800);
  }

  private playIncomingChimePattern(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterSynthGain) return;

    try {
      const now = ctx.currentTime;
      // High-grade marimba/bell sequence: E5, G#5, B5, E6
      const notes = [
        { f: 659.25, t: 0.0, d: 0.18 },
        { f: 830.61, t: 0.16, d: 0.18 },
        { f: 987.77, t: 0.32, d: 0.18 },
        { f: 1318.51, t: 0.48, d: 0.35 },
        { f: 987.77, t: 0.9, d: 0.18 },
        { f: 1318.51, t: 1.08, d: 0.4 },
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);

        gain.gain.setValueAtTime(0.12, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

        osc.connect(gain);
        gain.connect(this.masterSynthGain!);

        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.05);
      });
    } catch {
      // Audio error
    }
  }

  private startSynthesizedOutgoingLoop(): void {
    this.ensureMasterGainActive();
    this.playOutgoingRingbackBurst();
    this.ringtoneInterval = window.setInterval(() => {
      this.ensureMasterGainActive();
      this.playOutgoingRingbackBurst();
    }, 3500);
  }

  private playOutgoingRingbackBurst(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterSynthGain) return;

    try {
      const now = ctx.currentTime;
      // Standard dual-tone 440Hz + 480Hz
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.setValueAtTime(0.06, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterSynthGain!);

      osc1.start(now);
      osc2.start(now);

      osc1.stop(now + 1.26);
      osc2.stop(now + 1.26);
    } catch {
      // Tone generation error
    }
  }
}

export const ringtonePlayer = new RingtoneManager();
