
require("./rur.js");
require("./translator.js");
require("./visible_world.js");
require("./world.js");
require("./state.js");
require("./blockly.js");
require("./recorder.js");
require("./world_init.js");
require("./create_editors.js");
require("./utils/supplant.js");
var clone_world = require("./world/clone_world.js").clone_world;

RUR.runner = {};

RUR.state.code_evaluated = false;

RUR.runner.run = function (playback) {
    "use strict";
    var fatal_error_found = false, xml, xml_text;
    if (RUR.state.editing_world && !RUR.state.code_evaluated) {
        RUR._SAVED_WORLD = clone_world(RUR.CURRENT_WORLD);
    }
    if (!RUR.state.code_evaluated) {
        RUR.CURRENT_WORLD = clone_world(RUR._SAVED_WORLD);
        RUR.world_init.set();
        if (RUR.state.input_method === "blockly-py") {
            editor.setValue(Blockly.Python.workspaceToCode(RUR.blockly.workspace));
        } else if (RUR.state.input_method === "blockly-js") {
            editor.setValue(Blockly.JavaScript.workspaceToCode(RUR.blockly.workspace));
        }
        if (RUR.state.input_method === "blockly-py" ||
            RUR.state.input_method === "blockly-js") {
                xml = Blockly.Xml.workspaceToDom(RUR.blockly.workspace);
                xml_text = Blockly.Xml.domToText(xml);
                localStorage.setItem("blockly", xml_text);
        }
        fatal_error_found = RUR.runner.eval(editor.getValue()); // jshint ignore:line
    }
    if (!fatal_error_found) {
        // save program so that it a new browser session can use it as
        // starting point.
        try {
            localStorage.setItem("editor", editor.getValue());
            localStorage.setItem("library", library.getValue());
        } catch (e) {}
        // "playback" is a function called to play back the code in a sequence of frames
        // or a "null function", f(){} can be passed if the code is not
        // dependent on the robot world.
        if (RUR.state.prevent_playback) {
            return;
        }
        playback();
    }
};

RUR.runner.eval = function(src) {  // jshint ignore:line
    var error_name, message, response, other_info, from_python, error;
    other_info = '';

    /* At some point around version 3.2.0, Brython changed the way it
       handled uncaught errors, and no longer pass a "nice" object
       to the surrounding Javascript environment - since this is not
       the way Brython programmers normally do things.   While this
       has been changed back some time after version 3.2.3, we nonetheless
       guard against any future changes by doing our own handling. */

    RUR.__python_error = false;
    try {
        if (RUR.state.programming_language === "javascript") {
            RUR.runner.eval_javascript(src);
        } else if (RUR.state.programming_language === "python") {
            RUR.runner.eval_python(src);
            if (RUR.__python_error) {
                throw RUR.__python_error;
            }
        } else {
            alert("FATAL ERROR: Unrecognized programming language.");
            return true;
        }
    } catch (e) {
        if (RUR.__debug){
            console.dir(e);
        }
        error = {};
        if (RUR.state.programming_language === "python") {
            error.reeborg_shouts = e.reeborg_shouts;
            response = RUR.runner.simplify_python_traceback(e);
            message = response.message;
            other_info = response.other_info;
            error_name = response.error_name;
            error.message = "<h3>" + error_name + "</h3><h4>" +
                                    message + "</h4><p>" + other_info + '</p>';
        } else {
            error_name = e.name;
            message = e.message;
            other_info = '';
            if (e.reeborg_shouts !== undefined) {
                error.message = e.reeborg_shouts;
                error.reeborg_shouts = e.reeborg_shouts;
            }
        }

        if (e.reeborg_shouts !== undefined){
            RUR.record_frame("error", error);
        } else {
            RUR.show_feedback("#Reeborg-shouts",
                                    "<h3>" + error_name + "</h3><h4>" +
                                    message + "</h4><p>" + other_info + '</p>');
            return true;
        }
    }
    RUR.state.code_evaluated = true;
    return false;
};


RUR.runner.eval_javascript = function (src) {
    // do not "use strict"
    var pre_code, post_code;
    pre_code = pre_code_editor.getValue();
    post_code = post_code_editor.getValue();
    RUR.reset_definitions();
    src = pre_code + "\n" + src + "\n" + post_code;
    eval(src); // jshint ignore:line
};


RUR.runner.eval_python = function (src) {
    // do not  "use strict"
    var pre_code, post_code, highlight;
    RUR.reset_definitions();
    pre_code = pre_code_editor.getValue();
    post_code = post_code_editor.getValue();
    translate_python(src, RUR.state.highlight, RUR.state.watch_vars, pre_code, post_code);
};

RUR.runner.simplify_python_traceback = function(e) {
    "use strict";
    var message, error_name, other_info, diagnostic;
    other_info = '';
    if (e.reeborg_shouts === undefined) {
        message = e.$message;
        error_name = e.__name__;
        diagnostic = '';
        switch (error_name) {
            case "SyntaxError":
                try {
                    other_info = RUR.runner.find_line_number(e.args[1][3]);
                    if (RUR.runner.check_colons(e.args[1][3])) {
                        other_info += RUR.translate("<br>Perhaps a missing colon is the cause.");
                    } else if (RUR.runner.check_func_parentheses(e.args[1][3])){
                        other_info += RUR.translate("<br>Perhaps you forgot to add parentheses ().");
                    }
                } catch (e) { // jshint ignore:line
                    other_info = "I could not analyze this error; you might want to contact my programmer with a description of this problem.";
                }
                break;
            case "IndentationError":
                message = RUR.translate("The code is not indented correctly.");
                try {
                    other_info = RUR.runner.find_line_number(e.args[1][3]);
                    if (e.args[1][3].indexOf("RUR.set_lineno_highlight([") == -1){
                        other_info += "<br><code>" + e.args[1][3] + "</code>";
                    }
                } catch (e) {  // jshint ignore:line
                    other_info = "I could not analyze this error; you might want to contact my programmer with a description of this problem.";
                }
                break;
            case "NameError":
                try {
                    other_info = RUR.runner.find_line_number(message);
                    other_info += RUR.translate("<br>Perhaps you misspelled a word or forgot to define a function or a variable.");
                } catch (e) {  // jshint ignore:line
                    other_info = "I could not analyze this error; you might want to contact my programmer.";
                }
                break;
            case "Internal Javascript error: SyntaxError":
            case "Internal Javascript error: TypeError":
                error_name = "Invalid Python Code";
                message = '';
                other_info = RUR.translate("I cannot help you with this problem.");
                break;
            default:
                other_info = "";
        }
    } else {
        message = e.reeborg_shouts;
        if (e.__name__ === undefined) {
            error_name = "ReeborgError";
        } else {
            error_name = e.__name__;
        }
    }
    return {message:message, other_info:other_info, error_name:error_name};
};


RUR.runner.find_line_number = function(bad_code) {
    /** With the possibility of having code inserted by the highlighting routine,
        with some pre-code, and with Brython not counting empty lines at the
        beginning of a program, it is more reliable to scan the source code
        for the offending code as identified by Brython and see if it occurs
        only once in the user's program */
    var lines, found, i, lineno;
    if (bad_code.indexOf("RUR.set_lineno_highlight([") != -1){
        bad_code = bad_code.replace("RUR.set_lineno_highlight([", "");
        lines = bad_code.split("]");
        lineno = lines[0] + 1;
        return RUR.translate("Error found at or near line {number}.").supplant({number: lineno.toString()});
    }
    lines = editor.getValue().split("\n");
    found = false;
    lineno = false;
    for (i=0; i<lines.length; i++) {
        try {
        } catch (e) {
            return '';
        }
         if(lines[i].indexOf(bad_code) != -1){
            if (found){
                return '';   // found the offending code twice; can not rely on this
            } else {
                found = true;
                lineno = i+1;
            }
        }
    }
    if (lineno) {
        return RUR.translate("Error found at or near line {number}.").supplant({number: lineno.toString()});
    }
    return '';
};


RUR.runner.check_colons = function(line_of_code) {
    var tokens, line, nb_token;
    tokens = ['if ', 'if(', 'else', 'elif ','elif(','while ','while(',
              'for ','for(', 'def '];
    for (nb_token=0; nb_token < tokens.length; nb_token++){
        if (line_of_code.indexOf(tokens[nb_token]) != -1){
            if (line_of_code.indexOf(":") == -1){
                return true;    // missing colon
            }
        }
    }
    return false;  // no missing colon
};

RUR.runner.check_func_parentheses = function(line_of_code) {
    if (line_of_code.indexOf('def') != -1){
        if (line_of_code.indexOf("(") == -1){
            return true;    // missing parentheses
        }
    }
    return false;  // no missing parentheses
};
