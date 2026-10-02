import { Component, computed, inject, signal } from '@angular/core';
import { LibraryService, Result } from './library.service';
import { PlayerService, Track } from './player.service';

@Component({
  selector: 'app-root',
  template: `
    @if (showHeader()) {
      <header>
        <span class="logo">Reel</span>
        <div class="search">
          <input #q placeholder="Search YouTube for a song or artist" aria-label="Search YouTube" (keydown.enter)="search(q)" />
          <button (click)="search(q)" [disabled]="searching()">{{ searching() ? 'Searching…' : 'Search' }}</button>
        </div>
      </header>
    }

    <div class="stage" [class.idle]="!pl.current()">
      <div id="yt-player"></div>
      @if (!pl.current()) { <p>Search for a song, or open your library, to start watching.</p> }
    </div>

    @if (resultsOpen()) {
      <section class="results-view" aria-label="Search results">
        <div class="results-col">
          <div class="results-head">
            <h2>Results for {{ query() }}</h2>
            <button (click)="resultsOpen.set(false)">Close results</button>
          </div>
          @if (searching()) { <p class="muted">Searching…</p> }
          @if (searchError()) { <p class="err">{{ searchError() }}</p> }
          @for (r of results(); track r.id; let i = $index) {
            <article class="card">
              <button class="thumb" (click)="playResult(i)" [attr.aria-label]="'Play ' + r.title">
                <img [src]="thumb(r)" alt="" width="240" height="135" loading="lazy" />
                @if (r.duration) { <span class="len">{{ fmt(r.duration) }}</span> }
              </button>
              <div class="info">
                <h3>{{ r.title }}</h3>
                <p class="meta">
                  <span>{{ r.artist }}</span>
                  <span>{{ year(r) }}</span>
                  @if (r.views) { <span>{{ views(r.views) }} views</span> }
                </p>
                <p class="desc">{{ r.description }}</p>
                <div class="acts">
                  <button class="pick" (click)="playResult(i)">Play</button>
                  <button class="ghost" (click)="addResult(r)" [disabled]="inSelected(r)">
                    {{ inSelected(r) ? 'In ' + selected()?.name : 'Add to ' + selected()?.name }}
                  </button>
                </div>
              </div>
            </article>
          }
        </div>
      </section>
    }

    <section class="panel" [class.open]="panelOpen()" aria-label="Library">
      <nav aria-label="Playlists">
        @for (p of lib.playlists(); track p.id) {
          <button [class.on]="p.id === selectedId()" (click)="selectedId.set(p.id)">
            {{ p.name }} <small>{{ p.tracks.length }}</small>
          </button>
        }
      </nav>
      <input #np placeholder="New playlist" aria-label="New playlist name" (keydown.enter)="create(np)" />

      @if (selected(); as s) {
        @if (editing()) {
          <input #rn class="rename" [value]="s.name" aria-label="Playlist name"
            (keydown.enter)="rename(rn)" (keydown.escape)="editing.set(false)" (blur)="rename(rn)" />
        } @else {
          <div class="titlerow">
            <h2>{{ s.name }}</h2>
            <button class="link" (click)="startRename()">Rename</button>
          </div>
        }
        <div class="add">
          <input #url placeholder="Paste a YouTube link" aria-label="YouTube link" (keydown.enter)="add(url)" />
          <button (click)="add(url)" [disabled]="busy()">{{ busy() ? 'Adding…' : 'Add video' }}</button>
        </div>
        @if (error()) { <p class="err">{{ error() }}</p> }

        <ul class="tracks">
          @for (t of s.tracks; track t.id; let i = $index) {
            <li [class.now]="pl.current()?.id === t.id">
              <button class="row" (click)="pl.play(s.tracks, i); panelOpen.set(false)">
                <img [src]="thumb(t)" alt="" loading="lazy" width="96" height="54" />
                <span><b>{{ t.title }}</b><i>{{ t.artist }}</i></span>
              </button>
              <button class="x" (click)="lib.removeTrack(s.id, t.id)" [attr.aria-label]="'Remove ' + t.title">×</button>
            </li>
          } @empty {
            <p class="muted">No videos here yet. Search above, or paste a YouTube link.</p>
          }
        </ul>
      }
    </section>

    <footer>
      <button class="lib" (click)="panelOpen.set(!panelOpen())" [attr.aria-expanded]="panelOpen()">Library</button>
      <div class="now">
        <b>{{ pl.current()?.title ?? 'Nothing playing' }}</b>
        <i>{{ pl.current()?.artist }}</i>
      </div>
      <div class="ctl">
        <button (click)="pl.previous()">Prev</button>
        <button class="go" (click)="pl.toggle()">{{ pl.isPlaying() ? 'Pause' : 'Play' }}</button>
        <button (click)="pl.next()">Next</button>
        <button (click)="toggleFullscreen()">Fullscreen</button>
      </div>
      <div class="seek">
        <span>{{ fmt(pl.progress()) }}</span>
        <input type="range" min="0" step="1" aria-label="Seek"
          [max]="pl.duration()" [value]="pl.progress()"
          (input)="pl.seek(+$any($event.target).value)" />
        <span>{{ fmt(pl.duration()) }}</span>
      </div>
    </footer>
  `,
})
export class App {
  readonly lib = inject(LibraryService);
  readonly pl = inject(PlayerService);

  readonly selectedId = signal(this.lib.playlists()[0].id);
  readonly selected = computed(() => this.lib.playlists().find((p) => p.id === this.selectedId()) ?? null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly panelOpen = signal(true);
  readonly editing = signal(false);

  readonly query = signal('');
  readonly results = signal<Result[]>([]);
  readonly resultsOpen = signal(false);
  readonly searching = signal(false);
  readonly searchError = signal('');

  /** The search bar stays out of the way while a video is playing full screen. */
  readonly showHeader = computed(() => !this.pl.current() || this.panelOpen() || this.resultsOpen());

  create(el: HTMLInputElement) {
    const name = el.value.trim();
    if (!name) return;
    this.selectedId.set(this.lib.create(name));
    el.value = '';
  }

  async add(el: HTMLInputElement) {
    const s = this.selected();
    if (!s) return;
    const id = LibraryService.parseId(el.value);
    if (!id) {
      this.error.set('That doesn’t look like a YouTube link. Copy it from the video’s Share button.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    const meta = await this.lib.lookup(id);
    this.busy.set(false);
    this.lib.addTrack(s.id, { id, ...meta });
    el.value = '';
  }

  startRename() {
    this.editing.set(true);
    setTimeout(() => document.querySelector<HTMLInputElement>('.rename')?.select());
  }

  rename(el: HTMLInputElement) {
    if (!this.editing()) return;
    const name = el.value.trim();
    if (name) this.lib.rename(this.selectedId(), name);
    this.editing.set(false);
  }

  async search(el: HTMLInputElement) {
    const q = el.value.trim();
    if (!q) return;
    this.query.set(q);
    this.results.set([]);
    this.searchError.set('');
    this.searching.set(true);
    this.panelOpen.set(false);
    this.resultsOpen.set(true);
    try {
      this.results.set(await this.lib.search(q));
      if (!this.results().length) this.searchError.set('No embeddable music videos found. Try different words.');
    } catch (e) {
      this.searchError.set(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      this.searching.set(false);
    }
  }

  /** Plays from this result onward, so the rest of the results act as a queue. */
  playResult(i: number) {
    this.pl.play(this.results(), i);
    this.resultsOpen.set(false);
    this.panelOpen.set(false);
  }

  addResult(r: Result) {
    const s = this.selected();
    if (s) this.lib.addTrack(s.id, { id: r.id, title: r.title, artist: r.artist });
  }

  inSelected(t: Track) { return !!this.selected()?.tracks.some((x) => x.id === t.id); }

  toggleFullscreen() {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  }

  thumb(t: Track) { return `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`; }

  year(r: Result) { return new Date(r.published).getFullYear() || ''; }

  views(n: number) { return new Intl.NumberFormat('en', { notation: 'compact' }).format(n); }

  fmt(sec: number) {
    const s = Math.floor(sec || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }
}
