// 画面の骨組み（モックから移植）。動きは lib/kazami.js が付ける
export const MARKUP = `
<header>
  <div class="wrap hrow">
    <div class="brand">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13" fill="none" stroke="var(--accent)" stroke-width="2"/><path d="M15 4 L19 17 L15 14 L11 17 Z" fill="var(--accent)"/><circle cx="15" cy="15" r="2" fill="var(--ink)"/></svg>
      <div><b>Kazami</b> <small>風読み · 470 · 大村湾</small></div>
    </div>
    <label class="select" for="date">日付
      <select id="date"></select>
    </label>
    <div class="live"><span id="updated">予報</span></div>
  </div>
  <div class="wrap">
    <nav class="tabs" role="tablist">
      <button class="tab" role="tab" aria-selected="true" data-view="today" id="tab-today">風の予報 <span class="stage">MVP</span></button>
      <button class="tab" role="tab" aria-selected="false" data-view="analog" id="tab-analog">似た日から読む <span class="stage">MVP</span></button>
      <button class="tab" role="tab" aria-selected="false" data-view="obs" id="tab-obs">実測と答え合わせ <span class="stage">STEP 2</span></button>
      <button class="tab" role="tab" aria-selected="false" data-view="tactics" id="tab-tactics">レース振り返り <span class="stage">STEP 3</span></button>
    </nav>
  </div>
</header>

<main class="wrap">
<!-- ================= TODAY ================= -->
<section class="view" id="view-today">
  <div class="panel today">
    <div class="mapwrap" id="mapwrap">
      <canvas id="map" aria-label="大村湾 レース海面の風の流れ"></canvas>
      <div class="maptag"><span class="eyebrow">練習エリア</span><b class="num" id="tagDir">335°<small>NNW</small></b><span class="num" id="tagSpd">5.2 m/s</span></div>
      <div class="coursesel" role="group" aria-label="コース">
        <button type="button" data-c="wl" aria-pressed="true">上下</button><button type="button" data-c="outer" aria-pressed="false">アウター</button><button type="button" data-c="inner" aria-pressed="false">インナー</button>
        <label class="sr" for="leg">上りレグの長さ</label><select id="leg"><option value="0.2" selected>200m</option><option value="0.3">300m</option><option value="0.5">500m</option><option value="0.8">800m</option><option value="1.2">1.2km</option></select>
      </div>
      <div class="zoomctl" role="group" aria-label="地図の拡大縮小">
        <button type="button" id="zin" aria-label="拡大">＋</button><button type="button" id="zout" aria-label="縮小">－</button><button type="button" id="zcourse" class="t">コース</button><button type="button" id="zarea" class="t">エリア</button><button type="button" id="zbay" class="t">湾全体</button>
      </div>
      <button type="button" class="facbtn" id="facbtn" aria-pressed="false">研修所の位置を直す</button>
      <div class="mapctl">
        <button class="play" id="play" type="button" aria-label="時間を再生"><svg width="14" height="14" viewBox="0 0 14 14" id="playIcon"><path d="M3 1.5 L12 7 L3 12.5Z" fill="currentColor"/></svg></button>
        <input type="range" id="hour" min="8" max="17" step="1" value="10" aria-label="時刻">
        <span class="num" id="hourLbl">10:00</span>
      </div>
    </div>
    <div class="verdict">
      <div class="pills" id="pills"></div>
      <div>
        <div class="eyebrow" id="eyebrow"></div>
        <h1 id="headline"></h1>
      </div>
      <p class="lead" id="lead"></p>
      <div class="meter" aria-live="polite">
        <div class="top"><span id="mTime">10:00 の風は</span><b id="mText">朝の平均とほぼ同じ</b></div>
        <div class="gauge"><div class="rail"></div><div class="zero"></div><div class="needle" id="needle" style="left:50%"></div>
          <div class="lbl num"><span>−30°</span><span>0</span><span>+30°</span></div></div>
        <div class="foot"><span>← 左振れ（反時計回り）</span><span>右振れ（時計回り）→</span></div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="ph"><h2>1時間ごとの風</h2><p>矢印は風が吹いていく向き。色は 10–11時の平均からの振れ</p></div>
    <div class="strip" id="strip"></div>
  </div>

  <div class="panel">
    <div class="ph"><h2 id="planTitle">作戦メモ</h2><p>予報データから自動で作成</p></div>
    <ul class="plan" id="plan"></ul>
  </div>

  <details class="more" id="more">
    <summary>くわしく：3モデルの予報を比べる<span>MSM · ECMWF · ICON</span></summary>
    <div class="inner">
      <div class="ph" style="margin:0"><h2>風向の時間変化</h2>
        <div class="legend"><span><i style="background:var(--msm)"></i>MSM 琴海寄り</span><span><i style="background:repeating-linear-gradient(90deg,var(--msm) 0 4px,transparent 4px 7px)"></i>MSM 湾中央寄り</span><span><i style="background:var(--ecmwf)"></i>ECMWF 9km</span><span><i style="background:var(--icon)"></i>ICON（湾北部）</span></div></div>
      <svg class="chart" id="c-dir" height="240"></svg>
      <div class="ph" style="margin:0"><h2>風速</h2><p>m/s · 点線は突風（MSMは突風の予報なし）</p></div>
      <svg class="chart" id="c-spd" height="160"></svg>
      <div class="tablewrap"><table id="tbl"></table></div>
    </div>
  </details>
</section>

<!-- ================= ANALOG ================= -->
<section class="view" id="view-analog" hidden>
  <div class="panel">
    <p class="note" style="margin:0 0 14px">過去の実測データがまだないため、このタブはサンプル表示です。予報と観測の保存を始めると、実際の「似た日」に置き換わります。</p>
    <div class="answer">
      <div class="dots" id="dots" aria-label="似た日 8日の結果"></div>
      <div>
        <div class="eyebrow">明日と似た条件の過去 8日</div>
        <h2>8日中6日、昼すぎに右へ振れた。明日も右振れの可能性が高い</h2>
        <p>残りの2日は朝の北東の風が昼まで残り、北西の風が入りませんでした。</p>
      </div>
    </div>
  </div>
  <div class="panel">
    <div class="ph"><h2>この条件で探しています</h2><p>タップで条件を外すと候補が増えます</p></div>
    <div class="chips" id="filters">
      <button type="button" class="chip" aria-pressed="true">冬型（西高東低）</button>
      <button type="button" class="chip" aria-pressed="true">風向 320–360°</button>
      <button type="button" class="chip" aria-pressed="true">風速 4–8 m/s</button>
      <button type="button" class="chip" aria-pressed="true">10–12月</button>
      <button type="button" class="chip" aria-pressed="false">晴れ</button>
      <button type="button" class="chip" aria-pressed="false">潮：上げ</button>
    </div>
  </div>
  <div class="grid2">
    <div class="panel">
      <div class="ph"><h2>似た日の風向の動きと明日の予報</h2>
        <div class="legend"><span><i style="background:var(--ink-3)"></i>似た日</span><span><i style="background:var(--accent);height:4px"></i>中央値</span></div></div>
      <svg class="chart" id="c-analog" height="290"></svg>
      <p class="sample" style="margin:8px 0 0">※ モックのためサンプルデータです</p>
    </div>
    <div class="panel">
      <div class="ph"><h2>似た日（似ている順）</h2><p>タップでグラフを強調</p></div>
      <div class="alist" id="alist"></div>
    </div>
  </div>
  <div class="panel">
    <div class="ph"><h2>似た日から言えること</h2></div>
    <ul class="insights">
      <li><span class="big num">6/8</span><div><b>13時前後に右へ振れた</b><span>平均 +14°。右海面へ早めに寄せた艇が有利だった日が多い。</span></div></li>
      <li><span class="big num">9分</span><div><b>午前の振れの周期</b><span>7–12分おきに左右 ±10° 前後。1レグに1回は振れが来る。</span></div></li>
      <li><span class="big num">+1.8</span><div><b>午後に上がる風速 (m/s)</b><span>12時→14時の平均。2レース目以降はハイクアウト前提で。</span></div></li>
      <li><span class="big num">2/8</span><div><b>予報どおりにならなかった日</b><span>朝8時に北東（30–60°）の風が吹いていたら、北西の風が入らないことがある。</span></div></li>
    </ul>
  </div>
</section>

<!-- ================= OBS (STEP 2) ================= -->
<section class="view" id="view-obs" hidden>
  <div class="grid2">
    <div class="panel">
      <div class="ph"><h2>実測データの入手先</h2><p>計測器がなくても始められます</p></div>
      <div class="srcs">
        <div class="src"><div class="ico">✈</div><div><b>長崎空港の観測（自動）</b><span>湾内にある空港の公開観測。30分ごとに風向・風速を自動で保存</span></div><span class="tag lo">自動</span></div>
        <div class="src"><div class="ico">AM</div><div><b>アメダス（自動）</b><span>湾周辺の観測点を10分ごとに保存</span></div><span class="tag lo">自動</span></div>
        <div class="src"><div class="ico">✎</div><div><b>部員のかんたん記録</b><span>練習中にスマホで「振れた」をタップ。本部船のハンドコンパスの値も入力可</span></div><span class="tag mid">手入力</span></div>
        <div class="src"><div class="ico">GPS</div><div><b>スマホのGPSログ（第3段階）</b><span>防水ケースに入れたスマホで航跡を記録 → アップロード</span></div><span class="tag mid">今後</span></div>
      </div>
    </div>
    <div class="panel">
      <div class="ph"><h2>かんたん記録</h2><p>海の上でタップするだけ（試せます）</p></div>
      <div class="quick">
        <button type="button" class="qb l" data-k="左に振れた">◀ 左振れ<small>反時計回り</small></button>
        <button type="button" class="qb g" data-k="ブローが来た">ブロー<small>強い風</small></button>
        <button type="button" class="qb r" data-k="右に振れた">右振れ ▶<small>時計回り</small></button>
      </div>
      <ul class="log" id="log">
        <li><span class="num">10:42</span>右に振れた · 本部船 340°</li>
        <li><span class="num">10:35</span>ブローが来た · 右海面</li>
        <li><span class="num">10:31</span>左に振れた · 本部船 326°</li>
      </ul>
    </div>
  </div>
  <div class="grid2">
    <div class="panel">
      <div class="ph"><h2>どのモデルがよく当たる？（直近30日）</h2><p>長崎空港の観測と比べた平均の外れ</p></div>
      <div class="eyebrow" style="margin-bottom:8px">風向</div>
      <div class="bars" id="barsDir"></div>
      <div class="eyebrow" style="margin:16px 0 8px">風速</div>
      <div class="bars" id="barsSpd"></div>
    </div>
    <div class="panel">
      <div class="ph"><h2>予報のクセ</h2></div>
      <p class="note">大村湾では <b>MSM が風向を平均 8° 左寄り</b>に予報する傾向。明日の MSM の予報も、右に 8° ずらして読むのがおすすめ。</p>
      <p class="note" style="margin-top:10px">冬型の日は <b>ECMWF の風速がやや弱め</b>（−1.1 m/s）。</p>
    </div>
  </div>
  <div class="panel">
    <div class="ph"><h2>風の振れの記録（11/08 長崎空港の観測）</h2><p>平均からのずれ。右振れ＝緑、左振れ＝赤</p></div>
    <svg class="chart" id="c-osc" height="200"></svg>
  </div>
</section>

<!-- ================= TACTICS (STEP 3) ================= -->
<section class="view" id="view-tactics" hidden>
  <div class="grid2">
    <div class="panel">
      <div class="ph"><h2>GPS航跡と風の振れ（11/08 第2レース）</h2><p>上りレグ · スマホGPS</p></div>
      <div class="mapbox"><svg id="track" viewBox="0 0 400 320" aria-label="GPS航跡"></svg></div>
      <div class="legend" style="margin-top:10px"><span><i style="background:var(--right)"></i>リフトで走れた区間</span><span><i style="background:var(--left)"></i>ヘッダーで走った区間</span><span>①② タック</span></div>
    </div>
    <div class="panel">
      <div class="ph"><h2>タックの判断</h2><p>振れに合わせて返せたか</p></div>
      <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="stat"><div class="k">ヘッダーで返せた</div><div class="v num">5/7<small>回</small></div></div>
        <div class="stat"><div class="k">ヘッダーで走った時間</div><div class="v num">31<small>%</small></div></div>
        <div class="stat"><div class="k">返すまでの平均</div><div class="v num">48<small>秒</small></div></div>
        <div class="stat"><div class="k">VMG</div><div class="v num">2.9<small>kt</small></div></div>
      </div>
      <ul class="insights" style="margin-top:14px;grid-template-columns:minmax(0,1fr)">
        <li><span class="big num">④</span><div><b>12°のヘッダーを90秒走り続けた</b><span>この区間で約 25m のロス。6° を超えたら返す基準に。</span></div></li>
        <li><span class="big num">⑥</span><div><b>右振れの前に右海面へ</b><span>13:10 の右振れを予報どおり先取りして 3艇抜き。</span></div></li>
      </ul>
    </div>
  </div>
</section>
</main>
<footer class="wrap">「風の予報」タブは Open-Meteo の実際の予報（気象庁 MSM・ECMWF IFS 9km・ICON）を表示。ページを開いても自動では更新されません（取得時刻はページ上部）。「似た日から読む」「実測と答え合わせ」「レース振り返り」タブはサンプルです。地図の海岸線は標高データ（約200m間隔）から作成。</footer>
`;
