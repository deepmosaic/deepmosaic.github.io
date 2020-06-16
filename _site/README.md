# deepmosaic.github.io
Deepmosaic Landing Page


# Install jekyll
- 以下のページに従ってrubyをインストール  
  https://jekyllrb.com/docs/  

- コードを変更したらbuildコマンドでコードを生成。`_site`ディレクトリにビルドされたファイルが生成される
  --watchを付けると変更があった時に自動で再ビルドしてくれる
```
jekyll build --watch
```

- server起動
serverではなくserve
```
jekyll serve
```

jekyllに処理の対象であることを伝えるためにファイルの先頭に`--- ---`を記入する必要がある。これがないとbuildの対象にならない
```
---
---
```
