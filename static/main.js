// ReachView code is placed under the GPL license.
// Written by Egor Fedorov (egor.fedorov@emlid.com)
// Copyright (c) 2015, Emlid Limited
// All rights reserved.

// If you are interested in using ReachView code as a part of a
// closed source project, please contact Emlid Limited (info@emlid.com).

// This file is part of ReachView.

// ReachView is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// ReachView is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with ReachView.  If not, see <http://www.gnu.org/licenses/>.

// ####################### HANDLE WINDOW FOCUS/UNFOCUS #######################

var defaultConfigs = ['reach_single_default.conf', 'reach_kinematic_default.conf', 'reach_base_default.conf'];

var isActive = true;

// ############################### MAIN ###############################

$(document).ready(function () {

    // SocketIO namespace:
    namespace = "/test";

    // initiate SocketIO connection
    socket = io.connect("http://" + document.domain + ":" + location.port + namespace);

    // say hello on connect
    socket.on("connect", function () {
        socket.emit("browser connected", {data: "I'm connected"});
    });

    // Current active tab
    var active_tab = "Status";

    $("a.tab").click(function () {
        active_tab = $(this).text();

        console.log("Active tab = " + active_tab);
    });

    // ####################### HANDLE REACH MODES, START AND STOP MESSAGES #######################

    // handle data broadcast

    // socket.on("current state", function(msg) {
    //     // check if the browser tab and app tab are active

    //     if(typeof msg.state == "undefined")
    //         msg.state = 'base';

    //     console.log("Got message containing Reach state. Currently in " + msg.state + " mode");
    //     console.log("Current rover config is " + msg.rover.current_config);

    //     // add current configs to the dropdown menu

    //     var select_options = $("#config_select");
    //     var select_options_hidden = $('#config_select_hidden');
    //     var delete_options_hidden = $('#config_delete_hidden');
    //     var available_configs_list = $('.available_configs');
    //     var to_append = "";

    //     for (var i = 0; i < msg.available_configs.length; i++) {
    //         if(jQuery.inArray( msg.available_configs[i], defaultConfigs ) >= 0)
    //             to_append += "<option value='" + msg.available_configs[i] + "' class='default_config'>" + msg.available_configs[i] + "</option>";
    //         else
    //             to_append += "<option value='" + msg.available_configs[i] + "' class='extra_config'>" + msg.available_configs[i] + "</option>";
    //     }

    //     select_options.html(to_append).trigger("create");
    //     delete_options_hidden.html(to_append).trigger("create");
    //     select_options_hidden.html('<option value="custom">New config title</option>' + to_append).trigger("create");

    //     delete_options_hidden.find('.default_config').remove();

    //     select_options.val(msg.rover.current_config);

    //     if (msg.state == "rover") {
    //         $('input:radio[name="radio_base_rover"]').filter('[value="rover"]').next().click();
    //     } else if (msg.state == "base") {
    //         $('input:radio[name="radio_base_rover"]').filter('[value="base"]').next().click();
    //     }

    //     if(jQuery.inArray( msg.rover.current_config, defaultConfigs ) >= 0)
    //         $('#reset_config_button').removeClass('ui-disabled');
    //     else
    //         $('#reset_config_button').addClass('ui-disabled');

    //     if(select_options.find('.extra_config').length != 0)
    //         $('#delete_config_button').removeClass('ui-disabled');
    //     else
    //         $('#delete_config_button').addClass('ui-disabled');

    //     if(msg.started == 'yes'){
    //         $('#start_button').css('display', 'none');
    //         $('#stop_button').css('display', 'inline-block');
    //         chart.cleanStatus(msg.state, "started");
    //     }
    //     else{
    //         $('#stop_button').css('display', 'none');
    //         $('#start_button').css('display', 'inline-block');
    //     }



    // });

    // socket.on("available configs", function(msg) {
    //     var select_options = $("#config_select");
    //     var select_options_hidden = $('#config_select_hidden');
    //     var delete_options_hidden = $('#config_delete_hidden');
    //     var available_configs_list = $('.available_configs');
    //     var oldVal = select_options.val();
    //     var oldNum = select_options.children('option').length;
    //     var to_append = "";

    //     for (var i = 0; i < msg.available_configs.length; i++) {
    //         if(jQuery.inArray( msg.available_configs[i], defaultConfigs ) >= 0)
    //             to_append += "<option value='" + msg.available_configs[i] + "' class='default_config'>" + msg.available_configs[i] + "</option>";
    //         else
    //             to_append += "<option value='" + msg.available_configs[i] + "' class='extra_config'>" + msg.available_configs[i] + "</option>";
    //     }

    //     select_options.html(to_append).trigger("create");
    //     delete_options_hidden.html(to_append).trigger("create");
    //     select_options_hidden.html('<option value="custom">New config title</option>' + to_append).trigger("create");
    //     delete_options_hidden.find('.default_config').remove();

    //     var newNum = select_options.children('option').length;

    //     if(newNum<oldNum){
    //         available_configs_list.val('reach_single_default.conf');
    //         available_configs_list.parent().find('span').html('reach_single_default.conf');
    //     }
    //     else if(newNum >= oldNum){
    //         available_configs_list.val(oldVal);
    //         available_configs_list.parent().find('span').html(oldVal);
    //     }

    //     delete_options_hidden.val(delete_options_hidden.find('option:first-child').val());
    //     delete_options_hidden.parent().find('span').html(delete_options_hidden.find('option:first-child').val());

    //     available_configs_list.change();
    // });

    // ####################### HANDLE SATELLITE LEVEL BROADCAST #######################

    chart = new Chart();
    chart.sparkline("#new-visitors", "line", 30, 60, "basis", 750, "#26A69A");

    barChart = new barChart();
    barChart.barGrouped('#d3-bar-grouped', 220);

    socket.on("satellite broadcast rover", function(msg) {
        // check if the browser tab and app tab are active
        if ((active_tab == "Status") && (isActive == true)) {

            console.groupCollapsed('Rover satellite msg received:');
                for (var k in msg)
                    console.log(k + ':' + msg[k]);
            console.groupEnd();

            var average = 0;
            for (var i in msg)
                average += parseFloat(msg[i]);

            chart.update("#new-visitors", "line", 30, 60, "basis", 750, "#26A69A", 0.1*average);
            
            var data11 = [{'State':'G2', 'Rover':['40', 'blue'], 'Base':['10', 'green']}, {'State':'G3', 'Rover':['20', 'blue'], 'Base':['0', 'yellow']}, {'State':'G4', 'Rover':['20', 'blue'], 'Base':['0', 'yellow']}];
            barChart.roverUpdate(msg);
        }
    });

    socket.on("satellite broadcast base", function(msg) {
        // check if the browser tab and app tab are active
        if ((active_tab == "Status") && (isActive == true)) {
            console.groupCollapsed('Base satellite msg received:');
                for (var k in msg)
                    console.log(k + ':' + msg[k]);
            console.groupEnd();

            barChart.baseUpdate(msg);
        }
    });

    // ####################### HANDLE COORDINATE MESSAGES #######################

    socket.on("coordinate broadcast", function(msg) {
        // check if the browser tab and app tab
        if ((active_tab == "Status") && (isActive == true)) {

            console.groupCollapsed('Coordinate msg received:');
                for (var k in msg)
                    console.log(k + ':' + msg[k]);
            console.groupEnd();
            // updateCoordinateGrid(msg);
        }
    });

    socket.on("current config rover", function(msg) {
    	// showRover(msg);
    });

    socket.on("current config base", function(msg) {
    	// showBase(msg);
    });

    // end of document.ready
});
