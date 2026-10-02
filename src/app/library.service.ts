import { Injectable, effect, signal } from '@angular/core';
import { Track } from './player.service';

export interface Result extends Track {
  description: string; published: string; duration: number; views: number;
}

export interface Playlist { id: string; name: string; tracks: Track[]; }

const KEY = 'reel.v1';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  readonly playlists = signal<Playlist[]>(this.load());

  constructor() {
    effect(() => {
      try { localStorage.setItem(KEY, JSON.stringify(this.playlists())); } catch { /* storage full or blocked */ }
    });
  }

  private load(): Playlist[] {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* first run */ }
    return [{ id: 'liked', name: 'Liked videos', tracks: [] }];
  }

  create(name: string): string {
    const id = crypto.randomUUID();
    this.playlists.update((p) => [...p, { id, name, tracks: [] }]);
    return id;
  }

  rename(id: string, name: string) {
    this.playlists.update((all) => all.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  addTrack(playlistId: string, track: Track) {
    this.playlists.update((all) =>
      all.map((p) =>
        p.id !== playlistId || p.tracks.some((t) => t.id === track.id)
          ? p
          : { ...p, tracks: [...p.tracks, track] }
      )
    );
  }

  removeTrack(playlistId: string, trackId: string) {
    this.playlists.update((all) =>
      all.map((p) => (p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p))
    );
  }

  static parseId(input: string): string | null {
    const s = input.trim();
    const m = s.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/) ?? s.match(/^([\w-]{11})$/);
    return m ? m[1] : null;
  }

  /** Title and channel via YouTube's oEmbed endpoint: no API key, no quota. */
  async lookup(id: string): Promise<Omit<Track, 'id'>> {
    try {
      const url = `https://www.youtube.com/watch?v=${id}`;
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      return { title: d.title, artist: d.author_name };
    } catch {
      return { title: 'Untitled video', artist: 'Unknown artist' };
    }
  }

  async search(q: string): Promise<Result[]> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Search failed. Is the API running?');
    }
    return res.json();
  }
}
