;(function(){

    function get_params() {
        var vars = new Object, params;
        var temp_params = decodeURI(window.location.search).substring(1).split('&');
        for(var i = 0; i <temp_params.length; i++) {
            params = temp_params[i].split('=');
            if(!params[0] || !params[1]) {
                return null
            }
            vars[params[0]] = params[1];
        }

        return params[1]
    }

    function set_alert(message) {
        M.toast({
            html: message,
            classes: 'ajax-error-red',
            displayLength: 10000
        });
    }

    function reset_all(pond, fileUploadBox, fileSectionBox, is_remove_file=true) {
        if (is_remove_file) {
            pond.removeFiles()
        }
        fileUploadBox.isHide = ''
        fileSectionBox.isHide = 'hide'
        fileSectionBox.isPreLoaderHide = ''
        fileSectionBox.isCloseButtonHide = 'hide'
        fileSectionBox.isExportImageHide = 'hide'
        fileSectionBox.isExportJsonHide = 'hide'
        fileSectionBox.src_image = ''
        fileSectionBox.export_url = ''
        fileSectionBox.export_json_url = ''
    }

    axios.defaults.headers.common['Content-Type'] = 'application/json';

  /**
    * ****************************************************
    *  DOMの構築が完了してから実行する
    * ****************************************************
    */

  $(function() {

    $('.dropdown-trigger').dropdown();

    var fileUploadBox = new Vue({
        delimiters: ['${', '}'],
        el: '#file_upload_box',
        data:  {
            isHide: ''
        }
    });

    var fileSectionBox = new Vue({
        delimiters: ['${', '}'],
        el: '#file_section_box',
        data:  {
            isHide: 'hide',
            isPreLoaderHide: '',
            isCloseButtonHide: 'hide',
            isExportImageHide: 'hide',
            isExportJsonHide: 'hide',
            src_image: '',
            export_url: '',
            export_json_url: ''
        },
        methods: {
            close_file_section: function(event) {
                reset_all(pond, fileUploadBox, fileSectionBox)
            }
        }
    });

    // Select the file input and use
    // create() to turn it into a pond
    const inputElement = document.querySelector('input[type="file"]');

    FilePond.registerPlugin(
        FilePondPluginFileValidateType,
        FilePondPluginFileValidateSize
    );

    // create a FilePond instance at the input element location
    const pond = FilePond.create(inputElement);

    // ファイルが追加されたときの処理
    pond.on('addfile', (error, file) => {
        if (error) {
            set_alert('Error occured. Please reload page and retry when add file')
            reset_all(pond, fileUploadBox, fileSectionBox, is_remove_file=false)
        }
        // google recaptchaで人間の操作であることをチェックする
        grecaptcha.ready(function() {
            grecaptcha.execute('6Lf4mn4UAAAAAICHav2Z4bWzn-loS3V74VC5Q7N8', {
                action: 'upload_image'
            })
            .then(function(token) {
                axios.post('/users/recaptcha', {
                    token: token
                })
                .then(function (res) {
                    if (res.data.access != 'ok') {
                        set_alert('You were judged to be a bot')
                        reset_all(pond, fileUploadBox, fileSectionBox)
                    }
                })
                .catch(function (error) {
                    set_alert('Error occured. Please reload page and retry when recaptcha')
                    reset_all(pond, fileUploadBox, fileSectionBox)
                });
            });
        });
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

                    fileUploadBox.isHide = 'hide'
                    fileSectionBox.isHide = ''
                    fileSectionBox.isPreLoaderHide = ''

                    data = JSON.parse(res)

                    axios.post('/images/' + data.id + '/detections', {
                        name_hashed: data.name_hashed,
                        mime: data.mime
                    })
                    .then(function (res) {
                        img_src = '/images/' + res.data.name_hashed + '/file'
                        fileSectionBox.isPreLoaderHide = 'hide'
                        fileSectionBox.isCloseButtonHide = ''
                        fileSectionBox.isExportImageHide = ''
                        fileSectionBox.isExportJsonHide = ''
                        fileSectionBox.src_image = img_src
                        fileSectionBox.export_url = img_src
                        fileSectionBox.export_json_url = img_src
                    })
                    .catch(function (error) {
                        set_alert('Error occured. Please reload page and retry when image post')
                        reset_all(pond, fileUploadBox, fileSectionBox)
                    });

                },
                onerror: function(res) {
                    data = JSON.parse(res)
                    set_alert(data.message)
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
