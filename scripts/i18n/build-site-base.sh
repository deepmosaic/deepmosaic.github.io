#!/usr/bin/env bash
# T-2199 (i18n1112 I18N-701): ja-identity の基点の _site を作る (リーダー用。チケットでは実行しない)。
#
#   bash scripts/i18n/build-site-base.sh <commit> <出力の _site>
#   例: bash scripts/i18n/build-site-base.sh 10678af D:/dm-scratch/i18n/site-base/W7/_site
#
#   - <commit> を一時 worktree (D:/dm-scratch/i18n/site-base/_src-<短い sha>) に --detach で出し、
#     npm ci → npm run build → bundle exec jekyll build --strict_front_matter -d <出力> を回して worktree を消す。
#   - ゲートのビルドと同じ条件にするため JEKYLL_ENV は付けない。
#   - 基点はウェーブの開始時に 1 回だけ作り、そのウェーブの全チケットで使い回す。
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "使い方: bash scripts/i18n/build-site-base.sh <commit> <出力の _site>" >&2
  exit 2
fi

commit="$1"
# 出力先は絶対パスに直す。jekyll build は cd "$src" の後に走り、-d の相対パスを一時 worktree 基準で解決するため、
# 相対パスのままだと出力が worktree ごと消えるのに成功と表示される。
mkdir -p "$(dirname "$2")"
# Git Bash の pwd は /d/... の形になり Windows の Ruby が読めないので、pwd -W (D:/...) を優先する。
out="$(cd "$(dirname "$2")" && { pwd -W 2>/dev/null || pwd; })/$(basename "$2")"
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sha="$(git -C "$repo" rev-parse --short "$commit^{commit}")"
src="D:/dm-scratch/i18n/site-base/_src-$sha"

if [ -e "$src" ]; then
  echo "一時 worktree の場所が既にある: $src (前の実行の残りなら git worktree remove --force で消す)" >&2
  exit 1
fi

cleanup() {
  git -C "$repo" worktree remove --force "$src" || true
}
trap cleanup EXIT

git -C "$repo" worktree add --detach "$src" "$sha"
(
  cd "$src"
  unset JEKYLL_ENV
  npm ci
  npm run build
  bundle exec jekyll build --strict_front_matter -d "$out"
)
echo "基点の _site を作った: $out (commit $sha)"
