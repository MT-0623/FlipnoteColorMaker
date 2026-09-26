// ==========================================
// 1. 定数・初期設定
// ==========================================

// 基本カラー定義（うごメモ3Dの6色）
const COLORS = {
    K: { r: 0x10, g: 0x10, b: 0x10, hex: '#101010', name: '黒' },
    W: { r: 0xFF, g: 0xFF, b: 0xFF, hex: '#FFFFFF', name: '白' },
    R: { r: 0xFF, g: 0x10, b: 0x10, hex: '#FF1010', name: '赤' },
    B: { r: 0x00, g: 0x38, b: 0xCE, hex: '#0038CE', name: '青' },
    G: { r: 0x00, g: 0x86, b: 0x31, hex: '#008631', name: '緑' },
    Y: { r: 0xFF, g: 0xE7, b: 0x00, hex: '#FFE700', name: '黄' }
};

// ボタンの表示順 (黒・白 / 赤・青 / 緑・黄)
const ORDERED_KEYS = ['K', 'W', 'R', 'B', 'G', 'Y'];

// 初期選択状態（デフォルトで全色ON）
const activeColors = { K: true, W: true, R: true, B: true, G: true, Y: true };


// ==========================================
// 2. 色・数値計算 ユーティリティ
// ==========================================

// 2つの色の視覚的距離を計算
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) * 0.3 +
        Math.pow(c1.g - c2.g, 2) * 0.59 +
        Math.pow(c1.b - c2.b, 2) * 0.11
    );
}

// スコア (一致度%) の計算
function calculateScore(distance) {
    const maxDist = 255;
    const score = Math.max(0, 100 - (distance / maxDist) * 100);
    return score.toFixed(1);
}

// HEX 変換 (#FFFFFF -> {r, g, b})
function hexToRgb(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// RGB 変換 ({r, g, b} -> #FFFFFF)
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}


// ==========================================
// 3. パターン生成 & 市松模様配置ロジック
// ==========================================

// 色の組み合わせパターン全件生成
function generatePatterns(size, activeKeys) {
    const totalPixels = size * size;
    const patterns = [];

    function allocate(keys, remaining, currentCounts) {
        if (keys.length === 1) {
            currentCounts[keys[0]] = remaining;
            patterns.push({ ...currentCounts });
            return;
        }
        const key = keys[0];
        const nextKeys = keys.slice(1);
        for (let i = 0; i <= remaining; i++) {
            currentCounts[key] = i;
            allocate(nextKeys, remaining - i, { ...currentCounts });
        }
    }

    allocate(activeKeys, totalPixels, {});
    return patterns;
}

// ドットを均等にインターリーブ（交互）配置するグリッド作成
function buildCheckerboardGrid(counts, size) {
    const totalPixels = size * size;
    const grid = Array.from({ length: size }, () => Array(size).fill(null));

    // 使用色のプールを作成（使用割合が多い順）
    let pool = [];
    Object.keys(counts)
        .filter(k => counts[k] > 0)
        .sort((a, b) => counts[b] - counts[a])
        .forEach(k => {
            for (let i = 0; i < counts[k]; i++) pool.push(k);
        });

    // ドットを画面全体へ均一に分散させるインデックス順
    const order = [];
    for (let step = 0; step < totalPixels; step++) {
        let x, y;
        if (size === 4) {
            const map4x4 = [
                0, 8, 2, 10,
                12, 4, 14, 6,
                3, 11, 1, 9,
                15, 7, 13, 5
            ];
            const idx = map4x4[step];
            x = idx % 4;
            y = Math.floor(idx / 4);
        } else if (size === 2) {
            const map2x2 = [0, 3, 1, 2];
            const idx = map2x2[step];
            x = idx % 2;
            y = Math.floor(idx / 2);
        } else {
            const stride = 4;
            const idx = (step * stride) % totalPixels;
            x = idx % size;
            y = Math.floor(idx / size);
        }
        order.push({ x, y });
    }

    // プールの色を配置
    for (let i = 0; i < totalPixels; i++) {
        const pos = order[i];
        grid[pos.y][pos.x] = pool[i];
    }

    return grid;
}


// ==========================================
// 4. メイン処理・画面描画 (UI Update)
// ==========================================

// カラー選択ボタンの生成
function initColorButtons() {
    const container = document.getElementById('colorToggleGrid');
    container.innerHTML = '';
    ORDERED_KEYS.forEach(key => {
        const c = COLORS[key];
        const btn = document.createElement('div');
        btn.className = `color-btn ${activeColors[key] ? 'active' : 'inactive'}`;
        btn.innerHTML = `<span class="color-dot" style="background:${c.hex}"></span>${c.name}`;
        btn.addEventListener('click', () => {
            const activeCount = Object.values(activeColors).filter(v => v).length;
            if (activeColors[key] && activeCount <= 1) return; // 最低1色は選択

            activeColors[key] = !activeColors[key];
            btn.className = `color-btn ${activeColors[key] ? 'active' : 'inactive'}`;
            update();
        });
        container.appendChild(btn);
    });
}

// 候補の再計算と結果カードの描画
function update() {
    const targetHex = document.getElementById('hexInput').value;
    if (!/^#[0-9A-Fa-f]{6}$/.test(targetHex)) return;
    const targetRgb = hexToRgb(targetHex);

    const size = parseInt(document.getElementById('gridSize').value);
    const activeKeys = ORDERED_KEYS.filter(k => activeColors[k]);

    if (activeKeys.length === 0) return;

    const rawPatterns = generatePatterns(size, activeKeys);
    const totalPixels = size * size;

    // 各パターンの評価と並び替え
    const evaluated = rawPatterns.map(counts => {
        let r = 0, g = 0, b = 0;
        Object.keys(counts).forEach(k => {
            r += COLORS[k].r * counts[k];
            g += COLORS[k].g * counts[k];
            b += COLORS[k].b * counts[k];
        });
        const avgRgb = { r: r / totalPixels, g: g / totalPixels, b: b / totalPixels };
        const dist = colorDistance(targetRgb, avgRgb);
        const score = calculateScore(dist);
        return { counts, avgRgb, dist, score };
    });

    evaluated.sort((a, b) => a.dist - b.dist);
    const topCandidates = evaluated.slice(0, 6);

    // 描画エリアのクリアとカード追加
    const container = document.getElementById('candidateList');
    container.innerHTML = '';

    topCandidates.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `candidate-card ${index === 0 ? 'best' : ''}`;

        const avgHex = rgbToHex(item.avgRgb.r, item.avgRgb.g, item.avgRgb.b);

        const legendItemsHtml = Object.keys(item.counts)
            .filter(k => item.counts[k] > 0)
            .map(k => `
        <div class="legend-item">
          <span class="legend-chip" style="background:${COLORS[k].hex}"></span>
          <span>${COLORS[k].name}: ${item.counts[k]}マス (${Math.round(item.counts[k] / totalPixels * 100)}%)</span>
        </div>
      `).join('');

        card.innerHTML = `
      ${index === 0 ? '<span class="badge">最良近似</span>' : ''}
      <span class="score-tag">一致度 ${item.score}%</span>
      <div class="canvas-container">
        <div>
          <div style="font-size:0.75rem; text-align:center; margin-bottom:3px; color:#666;">ドット配置 (切替可)</div>
          <canvas class="pattern-canvas" width="64" height="64" title="クリックで縮小・拡大を切替"></canvas>
        </div>
        <div>
          <div style="font-size:0.75rem; text-align:center; margin-bottom:3px; color:#666;">遠目の見え方</div>
          <div class="avg-preview" style="background-color: ${avgHex};"></div>
        </div>
      </div>
      <div class="legend-box">
        ${legendItemsHtml}
      </div>
    `;

        container.appendChild(card);

        // ドット配置キャンバスの描画処理
        const canvas = card.querySelector('.pattern-canvas');
        const ctx = canvas.getContext('2d');
        const grid = buildCheckerboardGrid(item.counts, size);

        // 1パターンの描画関数（isTiled: trueなら4x4の16個敷き詰め、falseなら通常1個）
        function drawPattern(isTiled = false) {
            ctx.clearRect(0, 0, 64, 64);

            const repeat = isTiled ? 4 : 1; // 敷き詰め時は4x4（16個）並べる
            const patternPixelSize = 64 / repeat;
            const tileSize = patternPixelSize / size;

            for (let ry = 0; ry < repeat; ry++) {
                for (let rx = 0; rx < repeat; rx++) {
                    const offsetX = rx * patternPixelSize;
                    const offsetY = ry * patternPixelSize;

                    for (let y = 0; y < size; y++) {
                        for (let x = 0; x < size; x++) {
                            const key = grid[y][x];
                            ctx.fillStyle = COLORS[key].hex;
                            ctx.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                        }
                    }
                }
            }
        }

        // 初期状態は通常表示（1パターン）
        let isTiled = false;
        drawPattern(false);

        // クリックで「1パターン拡大」 ⇔ 「4x4敷き詰め（遠目確認用）」をトグル切替
        canvas.addEventListener('click', () => {
            isTiled = !isTiled;
            drawPattern(isTiled);
        });
    });
}


// ==========================================
// 5. 画像読み込み & スポイト機能
// ==========================================

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imgCanvas = document.getElementById('imagePreviewCanvas');
const imgCtx = imgCanvas.getContext('2d');

dropZone.addEventListener('click', (e) => {
    if (e.target !== imgCanvas) fileInput.click();
});

fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleImageFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]);
});

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = event => {
        const img = new Image();
        img.onload = () => {
            imgCanvas.width = img.width;
            imgCanvas.height = img.height;
            imgCtx.drawImage(img, 0, 0);
            imgCanvas.style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Canvas上のクリックでピクセルの色を取得
imgCanvas.addEventListener('click', e => {
    const rect = imgCanvas.getBoundingClientRect();
    const scaleX = imgCanvas.width / rect.width;
    const scaleY = imgCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const pixel = imgCtx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    document.getElementById('hexInput').value = hex;
    document.getElementById('colorPicker').value = hex;
    update();
});


// ==========================================
// 6. イベントリスナー設定 & 初期化
// ==========================================

const picker = document.getElementById('colorPicker');
const hexInput = document.getElementById('hexInput');
const gridSize = document.getElementById('gridSize');

picker.addEventListener('input', e => {
    hexInput.value = e.target.value;
    update();
});

hexInput.addEventListener('input', e => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        picker.value = e.target.value;
    }
    update();
});

gridSize.addEventListener('change', update);

// 起動時初期化
initColorButtons();
update();