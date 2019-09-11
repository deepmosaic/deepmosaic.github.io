;(function(){

  /**
    * -----------------------------------------------------
    *  DOMの構築が完了してから実行する
    * -----------------------------------------------------
    */

$(function() {

    const url = 'https://api.deepmosaic.co.jp'

    $('.tooltipped').tooltip({
        outDuration: 0,
        enterDelay: 200,
        exitDelay: 0,
        position: 'bottom'
    });

    function _create_bbox(
        stage, img_w, img_y, index, x = 100, y = 100, width = 100, height = 100) {

        var layer = new Konva.Layer();

        stage.add(layer);

        // idとnameを任意に付けることができる
        var rect = new Konva.Rect({
            x: x,
            y: y,
            width: width,
            height: height,
            id: index,
            name: 'dummy',
            stroke: '#00ff00',
            draggable: true
        });

        layer.add(rect);

        /*
        rect.on('dragmove', function () {
            if (rect.x() <= 0) { rect.stopDrag(); }
            if (rect.y() <= 0) { rect.stopDrag(); }
            if (rect.x() + rect.width() >= img_w || rect.x() + (rect.width() * rect.scaleX()) >= img_w) { rect.stopDrag(); }
            if (rect.y() + rect.height() >= img_y) { rect.stopDrag(); }
        });
        */

        rect.on('dragend', function () {
            if (rect.x() <= 0) {
                rect.x(0);
                layer.draw();
            }
            if (rect.y() <= 0) {
                rect.y(0)
                layer.draw();
            }
            if (rect.x() + rect.width() >= img_w || rect.x() + (rect.width() * rect.scaleX()) >= img_w) {
                rect.x(img_w - rect.width() * rect.scaleX())
                layer.draw();
            }
            if (rect.y() + rect.height() >= img_y || rect.y() + (rect.height() * rect.scaleY()) >= img_y) {
                rect.y(img_y - rect.height() * rect.scaleY())
                layer.draw();
            }
        });

        rect.on('transform', function () {
            if (rect.x() <= 0) {
                tr.stopTransform();
            }
            if (rect.y() <= 0) {
                tr.stopTransform();
            }
            if (rect.x() + (rect.width() * rect.scaleX()) >= img_w) {
                tr.stopTransform();
                rect.x(img_w - rect.width() * rect.scaleX())
                layer.draw();
            }
            if (rect.y() + (rect.height() * rect.scaleY()) >= img_y) {
                tr.stopTransform();
                rect.y(img_y - rect.height() * rect.scaleY())
                layer.draw();
            }
        });


        rect.on('transformed', function () {
            if (rect.x() <= 0) {
                rect.x(0)
                layer.draw();
            }
            if (rect.y() <= 0) {
                rect.y(0)
                layer.draw();
            }
            if (rect.x() + rect.width() * rect.scaleX() >= img_w) {
                rect.x(img_w - rect.width() * rect.scaleX())
                layer.draw();
            }
            if (rect.y() + rect.height() * rect.scaleY() >= img_y) {
                rect.y(img_y - rect.height() * rect.scaleY())
                layer.draw();
            }
        });

        // create new transformer
        var tr = new Konva.Transformer({
            rotateEnabled: false,
            borderStroke: '#00ff00',
            borderStrokeWidth: 4,
            ignoreStroke: true,
            anchorFill: 'white',
            anchorStroke: 'gray',
            anchorCornerRadius: 50,
            anchorSize: 8,
            anchorStrokeWidth: 1,
            keepRatio: false
        });

        // ダブルクリックで削除
        rect.on('dblclick dbltap', function () {
            layer.destroy();
        });

        layer.add(tr);
        tr.attachTo(rect);
        layer.draw();
    }

    /**
     * konvaのstage.toJSON()で取得できる値を変換する
    * @return [{
        xmin: float,
        ymin: float,
        xmax: float,
        ymax: float
    }]
    */
function _convert_format(val) {
    var array = [];
    var val = JSON.parse(val)

    for (let i = 0; i < val.children.length; i++) {
        // マイナスの場合か何かわからないが、x, yがない場合がある
        if ('x' in val.children[i].children[0].attrs) {
            x = val.children[i].children[0].attrs.x
        } else {
            x = 0.0
        }

        if ('y' in val.children[i].children[0].attrs) {
            y = val.children[i].children[0].attrs.y
        } else {
            y = 0.0
        }

        if ('scaleX' in val.children[i].children[0].attrs) {
            scale_x = val.children[i].children[0].attrs.scaleX
        } else {
            scale_x = 1.0
        }

        if ('scaleY' in val.children[i].children[0].attrs) {
            scale_y = val.children[i].children[0].attrs.scaleY
        } else {
            scale_y = 1.0
        }
        
        // 相対位置を返す
        array.push({
            xmin: x / val.attrs.width,
            ymin: y / val.attrs.height,
            xmax: (x + val.children[i].children[0].attrs.width * scale_x) / val.attrs.width,
            ymax: (y + val.children[i].children[0].attrs.height * scale_y) / val.attrs.height
        })
    }
    return array
}

// 以下はkonvaの設定
function create_canvas(image_name, detection) {
    var img_w = $('#img-konva').width();
    var img_y = $('#img-konva').height();
    var stage = new Konva.Stage({
        container: 'container-konva',
        width: img_w,
        height: img_y
    });

    if (detection) {
        for (let i = 0; i < detection.length; i++) {
            // 相対位置でxmin, ymin, xmax, ymaxが入っているので絶対位置に戻す
            _create_bbox(
                stage, 
                img_w, 
                img_y,
                index = detection[i].index,
                x = detection[i].xmin * img_w,
                y = detection[i].ymin * img_y,
                width = (detection[i].xmax * img_w) - (detection[i].xmin * img_w),
                height = (detection[i].ymax * img_y) - (detection[i].ymin * img_y)
            )
        }
    }

    $('#add-bbox').click(function () {
        _create_bbox(stage, img_w, img_y, 1)
    });

    $('#upload-new-file-button').click(function () {
        $('#image_upload_loading').addClass('hide');
        $('#image_upload_result').addClass('hide');
        $('#image_upload').removeClass('hide').addClass('animated fadeIn');

        // イベントを解除しないとないといけない
        $('#add-bbox').off()
        $('#export-with-mosaic').off()
        $('#upload-new-file-button').off()

        // 明示的にdestoryしないとbboxが一瞬残る
        stage.destroy()
    });

    $('#export-with-mosaic').click(function () {
        bbox = _convert_format(stage.toJSON());
        post_bbox(image_name, bbox)
    })
}

function post_bbox(image_name, bbox) {
    axios.post(url + '/v1/detection/images/' + image_name, {
        bbox: bbox
    })
    .then(function (response) {
        // 画像がキャッシュされてしまうのを防ぐためにクエリパラメータを付与する
        var rnd_val = Math.random().toString(36).slice(-8);
        window.open(url + '/v1/detection/images/' + image_name + '/mosaic?rnd=' + rnd_val);
    })
    .catch(function (error) {
        M.toast({
            html: error.message,
            classes: 'red'
        })
    });
}

var image_upload_img_result = new Vue({
    el: "#image_upload_img_result",
    data: {
        image_url: '/assets/img/main_logo_og_600x314.jpg'
    }
});

/*
var image_upload_meta_result = new Vue({
    el: "#image_upload_meta_result",
    data: {
        detections: [
            {
                label: 'unko'
            },
            {
                label: 0
            },
            {
                label: 0
            }
        ]
    }
});
*/
$('#modal-project-start-dropzone').dropzone({
    url: url + "/v1/detection/images",
    timeout: 50000, // milliseconds 
    //maxFiles: 1,
    maxFilesize: 10, // MB単位で指定,
    parallelUploads: 1, // 同時にアップロードできる数
    createImageThumbnails: false,
    resizeWidth: 1024,
    uploadMultiple: false,
    paramName: 'image_file',
    acceptedFiles: 'image/png, image/jpeg',
    previewTemplate: '<div></div>', // サムネイルが表示されないようにするためにダミーの値をセットしている
    error: function(file, errorMessage, xhr){
    // フロントのエラーとサーバーからのエラーの両方がこの中で扱われる

        $('#image_upload').removeClass('hide');
        $('#image_upload_loading').addClass('hide');
        $('#image_upload_result').addClass('hide');

        try {
            if (xhr) {
                M.toast({
                    html: JSON.parse(xhr.response).message,
                    classes: 'red'
                })
            } else {
                M.toast({
                    html: errorMessage,
                    classes: 'red'
                })
            }
        }
        catch (e) {
            M.toast({
                html: 'エラーが発生しました。他の画像で試してください',
                classes: 'red'
            })
        }


        // dropzoneを初期化
        this.removeAllFiles(true);
    },
    processing: function(file) {
    // upload処理が開始したときに発火するイベント
        $('#image_upload').addClass('hide');
        $('#image_upload_loading').removeClass('hide');
    },
    success: function(file, data) {
        $('#image_upload_loading').addClass('hide');
        $('#image_upload_result').removeClass('hide');

        image_upload_img_result.image_url = data.image_url;
        // image_upload_meta_result.detections = [];

        // dropzoneを初期化
        this.removeAllFiles(true);
        
        // konvaをアクティベイト
        // 若干遅らせてからkonvaを初期化しないと画像のheightを取得できない
        setTimeout(function () {
            create_canvas(data.image_name, data.detection.labels);
        }, 300);
    }

});

});
})();
