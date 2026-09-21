const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('📖 ページロード開始...');
  await page.goto('https://yuichi916.github.io/seikai-tech-guide.html', { waitUntil: 'networkidle' });
  console.log('✅ ページ読み込み完了');

  // 1. タイトル確認
  const title = await page.title();
  console.log(`\n📄 ページタイトル: ${title}`);

  // 2. H1 確認
  const h1 = await page.locator('h1').first().textContent();
  console.log(`📌 メインタイトル: ${h1}`);

  // 3. SVG アーキテクチャ図が存在するか
  const svgCount = await page.locator('svg.arch-diagram').count();
  console.log(`🎯 アーキテクチャ図: ${svgCount > 0 ? '✅ 存在' : '❌ 未検出'}`);

  // 4. インタラクティブボックス数
  const boxCount = await page.locator('.arch-box').count();
  console.log(`🔲 アーキテクチャボックス: ${boxCount}個`);

  // 5. セクション検出
  console.log('\n📑 セクション検出:');
  const sections = [
    { id: '#architecture', name: 'アーキテクチャ' },
    { id: '#flow', name: 'フロー' },
    { id: '#details', name: '詳細' },
    { id: '#stack', name: 'スタック' },
    { id: '#case', name: 'ケース' }
  ];
  for (const sec of sections) {
    const exists = await page.locator(sec.id).count();
    console.log(`  ${sec.name}: ${exists > 0 ? '✅' : '❌'}`);
  }

  // 6. ボタン検出
  console.log('\n🖱️ ボタン:');
  const buttons = await page.locator('.btn').count();
  console.log(`  検出数: ${buttons}個`);

  // 7. リンク検出
  console.log('\n🔗 ナビゲーションリンク:');
  const links = await page.locator('a[href]').count();
  console.log(`  検出数: ${links}個`);

  // 8. パフォーマンス計測
  const metrics = await page.metrics();
  console.log(`\n⚡ パフォーマンス:`);
  console.log(`  DOM ノード: ${metrics.Nodes}`);
  console.log(`  JS ヒープ: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)}MB`);
  console.log(`  レイアウト回数: ${metrics.LayoutCount}`);

  // 9. コンソールエラー
  let errorCount = 0;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`  ❌ ${msg.text()}`);
      errorCount++;
    }
  });

  await page.waitForTimeout(500);
  if (errorCount === 0) {
    console.log('\n✅ コンソールエラー: なし');
  }

  console.log('\n🎉 テスト完了\n');
  await browser.close();
})();
