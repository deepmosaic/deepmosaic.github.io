# deepmosaic.github.io
Deepmosaic Landing Page

# Install Ruby
Ruby+gemをインストール
https://rubyinstaller.org/downloads/

# Install jekyll
- 以下のページに従ってrubyをインストール  
  https://jekyllrb.com/docs/  

```
deepmosaic.github.ioのディレクトリに移動し、
bundle install
```

- 下記エラーが出る場合は下記を実行

```
C:/Ruby30-x64/lib/ruby/gems/3.0.0/gems/jekyll-4.2.0/lib/jekyll/commands/serve/servlet.rb:3:in `require': cannot load such file -- webrick (LoadError)

bundle add webrick

こちらも試してみる
gem update
```

- server起動
serverではなくserve
```
bundle exec jekyll serve
```

- コードを変更したらbuildコマンドでコードを生成。`_site`ディレクトリにビルドされたファイルが生成される
  --watchを付けると変更があった時に自動で再ビルドしてくれる
```
bundle exec jekyll build
```

jekyllに処理の対象であることを伝えるためにファイルの先頭に`--- ---`を記入する必要がある。これがないとbuildの対象にならない
```
---
---
```
