$(document).ready(function(){

$('.dropdown-trigger').dropdown();
$('.modal').modal();


$('#modal-project-start-dropzone').dropzone({
    url: "/upload",
    maxFilesize: 1,
    paramName: 'start_project_video',
    acceptedFiles: null,
    addedfile: function(file) {
        alert("Added file.");
    }
});







































});
