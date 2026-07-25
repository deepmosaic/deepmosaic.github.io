source "https://rubygems.org"

# Jekyll
gem "jekyll", "~> 4.4"

# Plugins
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.17"
  # jekyll-seo-tag は削除 (TICKET-SITE-05)。{% seo %} が呼ばれておらず無効だった。
  # head は _layouts/default.html の手書きが正 (canonical / hreflang / OG /
  # Twitter Card / JSON-LD まで揃っており seo-tag より制御が効く)。
  gem "jekyll-sitemap", "~> 1.4"
end

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.2.0", :platforms => [:mingw, :x64_mingw, :mswin]

# Required for Ruby 3.4+
gem "csv"
gem "webrick", "~> 1.9"
gem "base64"
gem "bigdecimal"
