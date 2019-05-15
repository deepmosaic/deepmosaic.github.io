;(function(){



    function set_alert(message) {
        M.toast({
            html: message,
            classes: 'ajax-error-red',
            displayLength: 10000
        });
    }


    axios.defaults.headers.common['Content-Type'] = 'application/json';

  /**
    * ****************************************************
    *  DOMの構築が完了してから実行する
    * ****************************************************
    */

  $(function() {

    // initilization
    $('.dropdown-trigger').dropdown({
        constrainWidth: false,
        coverTrigger: false
    });

    $('.tooltipped').tooltip();

    $('.modal').modal({
        onCloseEnd: function() {
            pond.removeFiles()
        }
    });

    var progressbar = new Vue({
        el: '#project-progress',
        data:  {
            isHide: 'hide'
        }
    });

    Vue.component('detection-list', {
        template:
            '<div class="card project-detection-list-box">' +
                '<div class="project-detection-list card-content waves-effect waves-block waves-light">' +
                    '<p></p>' +
                '</div>' +
            '</div>'
    });

    var project_detection_list = new Vue({
        el: '#project-detection-list'
    });

    Vue.component('project-image', {
        template:
            '<img class="responsive-img" :src="src_image" id="project-image-edit-box">',
        props: ['src_image']
    });

    var project_image = new Vue({
        el: '#project_image',
        data:  {
            src_image: ''
        }
    });

    FilePond.registerPlugin(
        FilePondPluginFileValidateType,
        FilePondPluginFileValidateSize
    );

    // Select the file input and use
    // create() to turn it into a pond
    const inputElement = document.querySelector('input[type="file"]');
    // create a FilePond instance at the input element location
    const pond = FilePond.create(inputElement);

    // ファイルのアップロードが完了したときの処理
    pond.on('processfile', (error, file) => {
        progressbar.isHide = ''
        $('.modal').modal('close')
    });

    pond.setOptions({
        maxFileSize: '3MB',
        acceptedFileTypes: ['image/png', 'image/jpeg', 'image/jpg'],
        labelIdle: '<i class="small material-icons file-upload-icon"><p>cloud_upload</i>Drag & Drop your image file or <span class="filepond--label-action"> Click here </span></p>',
        server: {
            // Filepondではuploadのことをprocessと呼んでいる
            process: {
                url: '/images',
                method: 'POST',
                withCredentials: false,
                headers: {},
                onload: function(res) {

                    data = JSON.parse(res)

                    axios.post('/images/' + data.id + '/detections', {
                        name_hashed: data.name_hashed,
                        mime: data.mime
                    })
                    .then(function (res) {

                        progressbar.isHide = 'hide'

                        // resolveが呼び出されると、次のthenに飛ぶ
                        // resolve()の引数に値を渡すと、次のthenのmsgにその値が格納される
                        // rejectが呼び出されると、cactchに飛ぶ
                        var promise = new Promise((resolve, reject) => {
                            project_image.src_image = ''
                            img_src = '/images/' + res.data.name_hashed + '/file'
                            project_image.src_image = img_src
                            resolve()
                        })

                        promise.then((msg) => {

                            // onメソッドはイベントを追加していくので、offで解除する必要がある
                            $('#edit-crop').off()
                            $('#edit-clear').off()
                            $('#edit-restore').off()
                            $('#edit-export').off()

                            const image = document.getElementById('project-image-edit-box');

                            if (res.data.classes.length === 0) {
                                var auto_crop = false
                                var class_data = {}
                            } else {
                                var auto_crop = true
                                var class_data = {
                                    y: res.data.classes[0].ymin,
                                    x: res.data.classes[0].xmin,
                                    height: res.data.classes[0].y,
                                    width: res.data.classes[0].x
                                }
                            }

                            //for (var i = 0; i < res.data.classes.length; i++) {
                            var cropper = new Cropper(image, {
                                aspectRatio: NaN,
                                modal: false,
                                autoCrop: auto_crop,
                                data: class_data
                            })

                            $('#edit-crop').on('click', function() {
                                cropper.crop()
                            })

                            $('#edit-clear').on('click', function() {
                                cropper.clear()
                            })

                            $('#edit-restore').on('click', function() {
                                cropper.reset()
                                cropper.setData(class_data)
                            })

                            $('#edit-export').on('click', function() {

                                // naturalWidthに応じたcropのサイズを返す
                                box = cropper.getData()

                                axios.put('/images/' + data.id + '/detections', {
                                    name_hashed: data.name_hashed,
                                    mime: data.mime,
                                    xmin: box.x,
                                    ymin: box.y,
                                    width: box.width,
                                    height: box.height
                                })
                                .then(function (res) {

                                })
                                .catch(function (error) {

                                });
                            })

                            // ファイルが追加されたときの処理
                            // cropper変数を参照できるようにするために少し変ではあるが、
                            // この場所で定義している
                            pond.onOnce('addfile', (error, file) => {
                                cropper.destroy()
                                $('#project-image-edit-box').removeAttr('src')
                            });

                            //}

                        }).catch(() => { // エラーハンドリング
                            progressbar.isHide = 'hide'
                        })


                    })
                    .catch(function (error) {
                        set_alert('Error occured. Please reload page and retry when image post')
                        progressbar.isHide = 'hide'
                    });

                },
                onerror: function(res) {
                    data = JSON.parse(res)
                    set_alert(data.message)
                    progressbar.isHide = 'hide'
                }
            },
            revert: {
                url: '/images'
            }
        },
        name: 'image_file'
    });



  });
})();
