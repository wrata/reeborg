/* Author: André Roberge
   License: MIT
 */

/*jshint browser:true, devel:true, indent:4, white:false, plusplus:false */
/*globals $, RUR, editor, library, toggle_contents_button, update_controls */

$(document).ready(function() {
    RUR.select_world("Alone");
    // init
    var child, button_closed = false;

    $("#header-child button").on("click", function(){
        var index, label, children;
        $(this).toggleClass("active");
        $(this).toggleClass("blue-gradient");
        $(this).toggleClass("reverse-blue-gradient");
        label = $(this).attr("label");

        children = $("#panels").children();
        for (index = 0; index < children.length; index++){
            child = $(children[index]);
            if (child.attr("id") === label) {
                child.toggleClass("active");
            }
        }

        if (label === "world-panel"){
            $("#world-panel").toggleClass("active");
        }  else if (label === "output-panel"){
            $("#output-panel").toggleClass("active");
        }  else if (label === "editor-panel"){
            $("#editor-panel").toggleClass("active");
        }
        
        update_controls();

    });

    $(function() {
        $("#tabs").tabs({heightStyle: "auto"});
    });

    $("#editor-link").on("click", function(){
        $("#lint").show();
        $("#save-library").hide();
    });
    $("#library-link").on("click", function(){
        $("#lint").hide();
        $("#save-library").show();
    });

    $("#save-library").on("click", function() {
        localStorage.setItem(RUR.settings.library, library.getValue());
        $('#saved').show().fadeOut(2000);
    });

    try {  
        var library_comment = '';
        if (RUR.programming_language == "javascript") {
            library_comment = RUR.translation["/* Your special code goes here */\n\n"];
        } else if (RUR.programming_language == "python") {
            library_comment = RUR.translation["# Your special code goes here \n\n"];
        }
        var library_content = localStorage.getItem(RUR.settings.library) || library_comment;
        library.setValue(library_content + "\n");
    } catch (e){ alert("Your browser does not support localStorage; you will not be able to save your functions in the library or your notes.");}

    $("#contents-button").on("click", toggle_contents_button);

    $("#help").dialog({autoOpen:false, width:600,  height:500, maximize: false, position:"top",
        beforeClose: function( event, ui ) {$("#help-button").addClass("blue-gradient").removeClass("reverse-blue-gradient");}});
  
    $("#help-button").on("click", function() {
        if (RUR.ajax_requests.help !== undefined){
            if ($("#help-button").hasClass("reverse-blue-gradient")) {
                $("#help").dialog("open");
            } else {
                $("#help").dialog("close");
            }
            return;
        }
        $('#help').load(RUR.settings.xml+"help.xml");
        RUR.ajax_requests.help = true;
        $("#help").dialog("open");
        return false;
    });

    $("#Reeborg-says").dialog({minimize: false, maximize: false, autoOpen:false, width:500, position:{my: "center", at: "center", of: $("#robot_canvas")}});
    $("#Reeborg-shouts").dialog({minimize: false, maximize: false, autoOpen:false, width:500, dialogClass: "alert", position:{my: "center", at: "center", of: $("#robot_canvas")}});

    editor.widgets = [];
    library.widgets = [];

    RUR.__load_world = function(data){
        RUR.world.import_(data);
        RUR.world.reset();
        RUR.controls.reload();
    };

    // initialize the world and then sets up a listener for subsequent changes
    $.get($("#select_world").val(), function(data) {
            RUR.__load_world(data);
            $("select").attr("style", "background-color:#fff");
            // jquery is sometimes too intelligent; it can guess
            // if the imported object is a string ... or a json object
            // I need a string here;  so make sure to prevent it from identifying.
        }, "text");
    RUR.world.robot_world_active = true;

    $("#select_world").change(function() {
        var data, val = $(this).val();
        RUR.world.robot_world_active = true;
        if (val.substring(0,11) === "user_world:"){
            // $("#step").removeClass("hidden");
            data = localStorage.getItem(val);
            RUR.__load_world(data);
            $("select").attr("style", "background-color:#eff");
        } else {
            // $("#step").removeClass("hidden");
            $.get(val, function(data) {
                RUR.__load_world(data);
                $("select").attr("style", "background-color:#fff");
                // jquery is sometimes too intelligent; it can guess
                // if the imported object is a string ... or a json object
                // I need a string here;  so make sure to prevent it from identifying.
            }, "text");
        }
    });
    RUR.controls.set_ready_to_run();
});