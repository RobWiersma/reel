import { Injectable, computed, signal } from '@angular/core';

export interface Track { id: string; title: string; artist: string; }

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady?: () => void; }
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  readonly queue = signal<Track[]>([]);
  readonly index = signal(-1);
  readonly isPlaying = signal(false);
  readonly progress = signal(0);
  readonly duration = signal(0);
  readonly current = computed(() => this.queue()[this.index()] ?? null);

  private player: any;
  private apiReady: Promise<void> | null = null;
  private timer?: number;

  /** The YouTube script only loads the first time something plays. */
  private loadApi(): Promise<void> {
    return (this.apiReady ??= new Promise<void>((resolve) => {
      window.onYouTubeIframeAPIReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.append(s);
    }));
  }

  async play(tracks: Track[], start = 0) {
    this.queue.set([...tracks]);
    await this.go(start);
  }

  async go(i: number) {
    const q = this.queue();
    if (i < 0 || i >= q.length) return;
    this.index.set(i);
    this.progress.set(0);
    await this.loadApi();
    const id = q[i].id;
    if (this.player) {
      this.player.loadVideoById(id);
    } else {
      this.player = new window.YT.Player('yt-player', {
        videoId: id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e: any) => this.onState(e.data),
          // Uploader disabled embedding, or the video was removed: skip it.
          onError: () => this.next(),
        },
      });
    }
  }

  next() { return this.go(this.index() + 1); }

  previous() {
    return this.progress() > 3 ? this.seek(0) : this.go(this.index() - 1);
  }

  toggle() {
    if (!this.player) return;
    this.isPlaying() ? this.player.pauseVideo() : this.player.playVideo();
  }

  seek(seconds: number) {
    this.player?.seekTo(seconds, true);
    this.progress.set(seconds);
  }

  private onState(state: number) {
    // YT.PlayerState: 0 ended, 1 playing, 2 paused
    this.isPlaying.set(state === 1);
    clearInterval(this.timer);
    if (state === 1) {
      this.timer = window.setInterval(() => {
        this.progress.set(this.player.getCurrentTime());
        this.duration.set(this.player.getDuration());
      }, 500);
    }
    if (state === 0) this.next();
  }
}
