var $;
$ = require("jquery");

$(document).ready(function() {
    // body...
    $('.counter').counterUp({
        time: 800
    });
});
$(".learn_btn").on("click", function() {
    $(".modal-wrapper").fadeIn(300);
});
$("#close_modal").on("click", function() {
    $(".modal-wrapper").fadeOut(300);
});
$(".modal-close-wrap").on("click", function() {
    $(".modal-wrapper").fadeOut(300);
});
