// 一筆花火 2 — ゲームサイトとのつなぎ。SDK が無い場所（自分のサイト・テスト）では何もしない
// CrazyGames（window.CrazyGames）と Playgama Bridge（window.bridge。YouTube Playables・MSN などへ配る）に対応
const AD_GRACE_MS = 420000; // 11/21 依頼主: 7 分。平均の遊び時間を上げるのが先。遊び始めてから最初の広告までの最短（ミリ秒）。序盤は広告で止めない（Playgama の目安: 平均 5 分・1 遊びあたり広告 0.30）
const AD_T0 = performance.now();
// 広告どうしの最短の間（11/19: 1 遊びあたり 1.05 回で目安 0.30 の 3.5 倍、間は平均 70 秒。平均の遊び時間 4:09 が目安 5:00 に届かない）
const AD_GAP_MS = 200000;
let adLast = -Infinity;
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
    // 区切り（夜のあと・祭りの終わり）の広告。広告どうしの間隔は場の SDK が決める。
    // ただし遊び始めて 3 分までは出さない（Playgama は 30 秒未満で離れた回を「遊び」と数えず、最初の広告が 29 秒目に出ていた）
    ad() { try { const now = performance.now(); if (now - AD_T0 < AD_GRACE_MS || now - adLast < AD_GAP_MS) return false; if (pg?.advertisement?.isInterstitialSupported) { adLast = now; pg.advertisement.showInterstitial(); return true; } } catch { /* */ } return false; },
    // 独自のイベント（どこで離れたかを見る）。名前は固定、変わる値は data に。版の名前を必ず付ける
    ev(name, data = {}) { try { pg?.analytics?.send?.(name, { ...data, t: Math.round(performance.now() / 1000), build: '2026-11-21e' }); } catch { /* 送れなくても遊べる */ } },
    // ランキング（Bridge）。Playgama は Bridge SaaS で in_game（自分で表を描く）、YouTube は native（点を送るだけ）
    lbType() { try { return pg?.leaderboards?.type || 'not_available'; } catch { return 'not_available'; } },
    async lbSet(score) { if (P.lbType() === 'not_available') return; try { await pg.leaderboards.setScore('best_score', Math.max(0, Math.floor(score))); } catch { /* 送れなくても遊べる */ } },
    async lbTop() { if (P.lbType() !== 'in_game') return null; try { return await pg.leaderboards.getEntries('best_score'); } catch { return null; } },
    lbPopup() { try { if (P.lbType() === 'native_popup') pg.leaderboards.showNativePopup('best_score')?.catch?.(() => {}); } catch { /* */ } },
    get playerId() { try { return pg?.player?.id || null; } catch { return null; } },
    // ログイン（Playgama のアカウント名でランキングに載る）。ログインしていない人の名前は Playgama が英語で自動につける（例: Ivory Pheasant）
    get loginOk() { try { return !!pg?.player?.isAuthorizationSupported && !pg.player.isAuthorized; } catch { return false; } },
    async login() { try { await pg.player.authorize(); return !!pg.player.isAuthorized; } catch { return false; } },
    // 報酬つき広告: 見終わって報酬が出たら true。失敗・途中で閉じたら false。広告の間は音を消す
    get rewardedOk() { try { return !!pg?.advertisement?.isRewardedSupported; } catch { return false; } },
    rewarded(placement = 'revive') {
      return new Promise((resolve) => {
        if (!P.rewardedOk) { resolve(false); return; }
        const E = pg.EVENT_NAME || {}; let got = false, done = false;
        const fin = (v) => { if (done) return; done = true; try { pg.advertisement.off?.(E.REWARDED_STATE_CHANGED, h); } catch { /* */ } P.onAd && P.onAd(false); resolve(v); };
        const h = (s) => { if (done) return; if (s === 'opened' || s === 'loading') P.onAd && P.onAd(true); if (s === 'rewarded') got = true; if (s === 'closed') fin(got); if (s === 'failed') fin(false); };
        try { pg.advertisement.on(E.REWARDED_STATE_CHANGED, h); pg.advertisement.showRewarded(placement); } catch { fin(false); }
        setTimeout(() => fin(got), 120000);
      });
    },
    read(key) { try { return sdk?.data ? sdk.data.getItem(key) : null; } catch { return null; } },
    async load(key) {
      // Bridge は JSON の文字列を読み出し時に自動で物に直して返す（そのまま JSON.parse すると失敗し、続きからが消えていた）
      if (pg) { try { const d = await pg.storage.get([key]); const v = d && d[0]; return v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v)); } catch { return null; } }
      return P.read(key);
    },
    write(key, v) {
      try { sdk?.data?.setItem(key, v); } catch { /* */ }
      try { pg?.storage.set([key], [v])?.catch?.(() => {}); } catch { /* */ }
    },
  };
  return P;
}
