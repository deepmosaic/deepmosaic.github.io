// `_data/plans.yml` の `tiers:` を読む極小パーサ (TICKET-SITE-CONTRACT-SSOT)。
//
// 元は `pricing.test.js` の中に閉じていた。案B (Supabase `plan_catalog` との突き合わせ) で
// **テスト以外からも** plans.yml を読む必要が出たので切り出した。読み手を 2 つ持つと
// 「片方だけ直して片方が古い」という、この一連のチケットが潰そうとしている構図
// そのものになるため、plans.yml を読むコードは必ずここを通す。
//
// YAML ライブラリを devDependency に足さないための割り切り。対応するのは plans.yml が
// 実際に使っている形 (2 階層のスカラーと `- label:` の配列) だけ。
//
// **非対応の記法に当たったら黙って読み飛ばさず throw する。** 静かに `undefined` を
// 返すと「検査は通るが値は間違っている」状態になり、読み手の存在意義が消えるため。
// 具体的には以下を検出する:
//
//   - ブロックスカラー (`summary: |` / `>`)
//   - 暗黙 null (`overage_per_hour:` のように値を書かない形)
//     → 次の行のインデントを見て「ネストブロックの開始」と区別する

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** `_data/plans.yml` の既定パス (このモジュールからの相対で解決する)。 */
export const PLANS_YML = join(HERE, '..', '..', '_data', 'plans.yml');

/**
 * plans.yml の `tiers:` を配列で返す。
 *
 * @param {string} [ymlPath]
 * @returns {Record<string, unknown>[]}
 */
export function loadTiers(ymlPath = PLANS_YML) {
  const lines = readFileSync(ymlPath, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l === 'tiers:');
  if (start < 0) throw new Error(`${ymlPath} に tiers: が無い`);

  const tiers = [];
  let current = null;

  /** 次の非空・非コメント行を返す (ネスト判定のための先読み)。 */
  const nextMeaningful = (from) => {
    for (let j = from; j < lines.length; j += 1) {
      const t = lines[j].trim();
      if (t !== '' && !t.startsWith('#')) return lines[j];
    }
    return null;
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const item = line.match(/^ {2}- (\w+): (.*)$/);
    if (item) {
      current = {};
      tiers.push(current);
      current[item[1]] = parseScalar(item[2]);
      continue;
    }

    const pair = line.match(/^ {4}(\w+):(.*)$/);
    if (pair) {
      const [, key, rest] = pair;
      const value = rest.replace(/\s+#.*$/, '').trim();

      if (/^[|>]/.test(value)) {
        throw new Error(
          `plans.yml: ${key} がブロックスカラー (${value}) だが、このパーサは非対応。` +
            ' plans.yml を 1 行スカラーに戻すか、パーサを拡張すること。',
        );
      }

      if (value === '') {
        // 値が空 → ネストブロックの開始か、暗黙 null か。次行のインデントで判定する。
        const next = nextMeaningful(i + 1);
        const startsNestedBlock = next !== null && /^ {6}|^ {4}- /.test(next);
        if (!startsNestedBlock) {
          throw new Error(
            `plans.yml: ${key} が暗黙 null (値なし) になっている。` +
              ' このパーサは読み取れないので `null` と明示すること。',
          );
        }
        continue; // specs / bullets / cta のネストは計算に不要なので読み飛ばす
      }

      current[key] = parseScalar(value);
      continue;
    }

    // ネストの中身 (6 スペース以上 / 4 スペースの配列要素) は無視
    if (/^ {6}/.test(line) || /^ {4}- /.test(line)) continue;
    // tiers: ブロックの外に出た
    if (!/^ /.test(line)) break;
  }
  return tiers;
}

/** YAML の 1 行スカラーを JS の値にする (行末コメントは落とす)。 */
export function parseScalar(raw) {
  const v = raw.replace(/\s+#.*$/, '').trim();
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v.replace(/^"(.*)"$/, '$1');
}
