// 一筆花火 2 — ゲームサイトとのつなぎ。SDK が無い場所（自分のサイト・テスト）では何もしない
export function createPlatform() {
  let sdk = null, playing = false;
  const P = {
    ready: false,
    async init() {
      const CG = window.CrazyGames;
      if (!CG || !CG.SDK) return;
      try {
        await CG.SDK.init();
        sdk = CG.SDK; P.ready = true;
        // 「音を消す」の設定に従う
        try {
          P.muted = !!sdk.game.settings?.muteAudio;
          sdk.game.addSettingsChangeListener?.((s) => { P.muted = !!s.muteAudio; P.onMute && P.onMute(P.muted); });
        } catch { /* 無い版でも遊べる */ }
      } catch (e) { console.warn('sdk', e); }
    },
    loadingStart() { try { sdk?.game.loadingStart?.(); } catch { /* */ } },
    loadingStop() { try { sdk?.game.loadingStop?.(); } catch { /* */ } },
    start() { if (playing) return; playing = true; try { sdk?.game.gameplayStart(); } catch { /* */ } },
    stop() { if (!playing) return; playing = false; try { sdk?.game.gameplayStop(); } catch { /* */ } },
    happy() { try { sdk?.game.happytime(); } catch { /* */ } },
    read(key) { try { return sdk?.data ? sdk.data.getItem(key) : null; } catch { return null; } },
    write(key, v) { try { sdk?.data?.setItem(key, v); } catch { /* */ } },
  };
  return P;
}
