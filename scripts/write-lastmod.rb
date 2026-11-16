# frozen_string_literal: true

# sitemap の lastmod の控え `_data/lastmod.yml` を書き直す。
#
#   bundle exec ruby scripts/write-lastmod.rb [サイトのソース (既定: このリポ)]
#
#   - 値は `_plugins/last_modified_at.rb` が今の履歴と控えから各ページに入れる日時そのもの (UTC の表記で持つ)。
#     まだコミットしていないページ (mtime) と front matter に日時があるページは書かない。今あるページだけを書く。
#   - 控えを作り直すときに回してコミットする。普段は回さなくてよい。
#   - 浅いクローン・git が使えないときは書かずに終了コード 1。

require "jekyll"

root = File.expand_path(ARGV[0] || File.join(__dir__, ".."))
config = Jekyll.configuration("source" => root, "destination" => File.join(root, "_site"), "quiet" => true)
site = Jekyll::Site.new(config)
site.reset
site.read

resolver = DeepmosaicSite::LastModifiedAt::Resolver.from_site(site)
reason = resolver.unavailable_reason
abort "控えを書かない (#{reason})" if reason

entries = {}
site.pages.each do |page|
  found = resolver.lookup(page)
  next unless found && %i[git snapshot].include?(found[:from])

  entries[DeepmosaicSite::LastModifiedAt::Resolver.relative_path(page)] =
    found[:time].getutc.strftime("%Y-%m-%dT%H:%M:%S+00:00")
end

lines = [
  "# sitemap の lastmod の控え (ページのソースのパス → 日時)。scripts/write-lastmod.rb が書く。手で直さない。",
  "# _plugins/last_modified_at.rb が、履歴の最初のコミットしか当たらないページにこの日時を使う。",
]
entries.keys.sort.each { |rel| lines << "#{rel.dump}: \"#{entries[rel]}\"" }
path = File.join(root, "_data", "#{DeepmosaicSite::LastModifiedAt::SNAPSHOT_KEY}.yml")
File.binwrite(path, lines.join("\n") + "\n")
puts "#{entries.size} 件を書いた: #{path}"
