// 一筆花火 2 — ゲームサイトとのつなぎ。SDK が無い場所（自分のサイト・テスト）では何もしない
// CrazyGames（window.CrazyGames）と Playgama Bridge（window.bridge。YouTube Playables・MSN などへ配る）に対応
export function createPlatform() {
  let sdk = null, pg = null, playing = false;
  const P = {
    ready: false, kind: null, noLocal: false, lang: null, muted: false,
    async init() {
      // Playgama: 保存は Bridge の storage だけ（localStorage を使わない）。言葉・音・一時停止は場の指示に従う
      const B = window.bridge;
      if (B && B.initialize) {
        try {
          await B.initialize();
          pg = B; P.ready = true; P.kind = 'playgama'; P.noLocal = true;
          const L = String(B.platform.language || '');
          P.lang = L.startsWith('ja') ? 'ja' : 'en';
          P.muted = B.platform.isAudioEnabled === false;
          const E = B.EVENT_NAME || {};
          B.platform.on?.(E.AUDIO_STATE_CHANGED, (on) => { P.muted = !on; P.onMute && P.onMute(P.muted); });
          B.platform.on?.(E.PAUSE_STATE_CHANGED, (paused) => { P.onPause && P.onPause(!!paused); });
          B.advertisement?.on?.(E.INTERSTITIAL_STATE_CHANGED, (st) => { P.onAd && P.onAd(st === 'opened' || st === 'loading'); });
        } catch (e) { console.warn('bridge', e); }
        return;
      }
      const CG = window.CrazyGames;
      if (!CG || !CG.SDK) return;
      try {
        await CG.SDK.init();
        sdk = CG.SDK; P.ready = true; P.kind = 'crazygames';
        // 「音を消す」の設定に従う
        try {
          P.muted = !!sdk.game.settings?.muteAudio;
          sdk.game.addSettingsChangeListener?.((s) => { P.muted = !!s.muteAudio; P.onMute && P.onMute(P.muted); });
        } catch { /* 無い版でも遊べる */ }
      } catch (e) { console.warn('sdk', e); }
    },
    loadingStart() { try { sdk?.game.loadingStart?.(); } catch { /* */ } },
    // 遊べる最初の画面が出たら知らせる（Playgama は game_ready が必須）
    loadingStop() { try { sdk?.game.loadingStop?.(); } catch { /* */ } try { pg?.platform.sendMessage('game_ready'); } catch { /* */ } },
    start() { if (playing) return; playing = true; try { sdk?.game.gameplayStart(); } catch { /* */ } },
    stop() { if (!playing) return; playing = false; try { sdk?.game.gameplayStop(); } catch { /* */ } },
    // 夜の進み（Playgama: level_started / level_completed / level_failed / level_paused / level_resumed）。どの夜で離れたかが場の数字に出る
    level(kind, world, night) { try { pg?.platform.sendMessage('level_' + kind, { world: String(world), level: String(night) })?.catch?.(() => {}); } catch { /* */ } },
    // 大事な場面（大一番の勝ち・完走）
    milestone() { try { pg?.platform.sendMessage('player_got_achievement')?.catch?.(() => {}); } catch { /* */ } },
    happy() { try { sdk?.game.happytime(); } catch { /* */ } },
    // 区切り（夜のあと・祭りの終わり）の広告。間隔は場の SDK が決める（自前のタイマーは持たない）
    ad() { try { if (pg?.advertisement?.isInterstitialSupported) pg.advertisement.showInterstitial(); } catch { /* */ } },
    read(key) { try { return sdk?.data ? sdk.data.getItem(key) : null; } catch { return null; } },
    async load(key) {
      if (pg) { try { const d = await pg.storage.get([key]); return d && d[0] != null ? d[0] : null; } catch { return null; } }
      return P.read(key);
    },
    write(key, v) {
      try { sdk?.data?.setItem(key, v); } catch { /* */ }
      try { pg?.storage.set([key], [v])?.catch?.(() => {}); } catch { /* */ }
    },
  };
  return P;
}
