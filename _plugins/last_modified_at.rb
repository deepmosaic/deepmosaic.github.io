# frozen_string_literal: true

# sitemap の <lastmod> の元になる `page.last_modified_at` を、ページのソースを最後に変えたコミットの日時で埋める。
# jekyll-sitemap (1.4) はこの値があると <lastmod> を出す (date_to_xmlschema)。依存の gem は足さない。
#
#   - 日時は `git -C <site.source> log -1 --format=%cI -- <パス…>`。シェルを通さず引数の配列で呼ぶ。
#   - `_config.yml` の `last_modified_at_extra_paths:` (ソースのパス → 追加で見るパスの配列) に載ったページは、
#     自分のファイルと追加のパスのうち一番新しいコミットの日時 (本文を部品やデータに持つページのため)。
#   - 履歴の最初のコミット (親の無いコミット) しか当たらないページは、控え `_data/lastmod.yml`
#     (ソースのパス → 日時) の日時を使う。控えに無ければそのコミットの日時。控えは `scripts/write-lastmod.rb` が書く。
#   - git が使えない・浅いクローン (全ファイルの日時が最後のコミットにそろう) のときは日時を入れず、警告を 1 行出す。
#   - まだコミットしていない新しいファイル (git log の結果が空) はファイルの mtime。
#   - front matter に `last_modified_at` があるページは上書きしない。
#   - 検査は scripts/i18n/checks/seo.mjs (全 <url> に ISO 8601 の lastmod、値が 2 種類以上)。

require "open3"
require "time"

module DeepmosaicSite
  class LastModifiedAt < Jekyll::Generator
    safe true
    priority :high

    LOG_TOPIC = "LastModifiedAt:"
    CONFIG_KEY = "last_modified_at_extra_paths"
    SNAPSHOT_KEY = "lastmod"

    def generate(site)
      resolver = Resolver.from_site(site)
      reason = resolver.unavailable_reason
      if reason
        Jekyll.logger.warn LOG_TOPIC, "sitemap の lastmod を出さない (#{reason})"
        return
      end
      site.pages.each do |page|
        found = resolver.lookup(page)
        page.data["last_modified_at"] = found[:time] if found
      end
    end

    # ページ → 日時の求め方。scripts/write-lastmod.rb も同じものを使う。
    class Resolver
      def self.from_site(site)
        new(site.source, site.config[CONFIG_KEY] || {}, site.data[SNAPSHOT_KEY] || {})
      end

      def initialize(source, extra, snapshot)
        @source = source
        @extra = extra
        @snapshot = snapshot
      end

      # ページのソースのパス (先頭の / なし)。
      def self.relative_path(page)
        page.relative_path.to_s.sub(%r{\A/}, "")
      end

      # { time:, from: :git | :snapshot | :mtime } か nil (front matter に日時がある・ファイルが無い)。
      def lookup(page)
        return nil if page.data.key?("last_modified_at")

        rel = self.class.relative_path(page)
        abs = File.join(@source, rel)
        return nil unless File.file?(abs)

        commit = last_commit([rel] + Array(@extra[rel]))
        return { time: File.mtime(abs), from: :mtime } unless commit
        return { time: commit[:time], from: :git } unless commit[:root]

        kept = snapshot_time(rel)
        kept ? { time: kept, from: :snapshot } : { time: commit[:time], from: :git }
      end

      # lastmod を出せない理由 (出せるなら nil)。
      def unavailable_reason
        out, err, status = Open3.capture3("git", "-C", @source, "rev-parse", "--is-shallow-repository")
        return "git が失敗した: #{err.strip}" unless status.success?
        return "浅いクローンでは全ファイルの日時が最後のコミットにそろう" if out.strip == "true"

        nil
      rescue SystemCallError => e
        "git を起動できない: #{e.message}"
      end

      private

      # 最後のコミットの { time:, root: (親が無い) }。コミットが無い・git の失敗は nil (失敗は警告)。
      def last_commit(paths)
        out, err, status = Open3.capture3("git", "-C", @source, "log", "-1", "--format=%cI%x09%P", "--", *paths)
        unless status.success?
          Jekyll.logger.warn LOG_TOPIC, "git log が失敗した (#{paths.first}): #{err.strip}"
          return nil
        end
        line = out.lines.first.to_s.chomp
        return nil if line.strip.empty?

        date, parents = line.split("\t", 2)
        { time: Time.iso8601(date.strip), root: parents.to_s.strip.empty? }
      rescue ArgumentError => e
        Jekyll.logger.warn LOG_TOPIC, "git の日時を読めない (#{paths.first}): #{e.message}"
        nil
      end

      # 控えの日時 (無い・読めないときは nil。読めないときは警告)。
      def snapshot_time(rel)
        value = @snapshot[rel]
        return nil if value.nil?
        return value if value.is_a?(Time)

        Time.iso8601(value.to_s)
      rescue ArgumentError
        Jekyll.logger.warn LOG_TOPIC, "控えの日時を読めない (#{rel}): #{value}"
        nil
      end
    end
  end
end
