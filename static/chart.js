function Chart() {

		this.data = [];
        this.path = '';
        this.x = '';
        this.line = '';
        this.area = '';
        var x;
        var y;

        // this.path = '';

	    this.sparkline = function(element, chartType, qty, height, interpolation, duration, color) {
        
        // Basic setup
        // ------------------------------

        // Define main variables
        var d3Container = d3.select(element),
            margin = {top: 0, right: 0, bottom: 0, left: 0},
            width = d3Container.node().getBoundingClientRect().width - margin.left - margin.right,
            height = height - margin.top - margin.bottom;


        // Generate random data (for demo only)
        for (var i=0; i < qty; i++) {
            this.data.push(Math.floor(Math.random() * 0))
        }

        // Construct scales
        // ------------------------------

        // Horizontal
        x = d3.scale.linear().range([0, width]);

        // Vertical
        y = d3.scale.linear().range([height - 5, 5]);



        // Set input domains
        // ------------------------------

        // Horizontal
        x.domain([1, qty - 3])

        // Vertical
        y.domain([0, height])

        // Construct chart layout
        // ------------------------------

        // Line
        this.line = d3.svg.line()
            .interpolate(interpolation)
            .x(function(d, i) { return x(i); })
            .y(function(d, i) { return y(d); });

        // Area
        this.area = d3.svg.area()
            .interpolate(interpolation)
            .x(function(d,i) { 
                return x(i); 
            })
            .y0(height)
            .y1(function(d) { 
                return y(d); 
            });

        // Create SVG
        // ------------------------------

        // Container
        var container = d3Container.append('svg');

        // SVG element
        var svg = container
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");



        // Add mask for animation
        // ------------------------------

        // Add clip path
        var clip = svg.append("defs")
            .append("clipPath")
            .attr('id', function(d, i) { return "load-clip-" + element.substring(1) })

        // Add clip shape
        var clips = clip.append("rect")
            .attr('class', 'load-clip')
            .attr("width", 0)
            .attr("height", height);

        // Animate mask
        clips
            .transition()
                .duration(1000)
                .ease('linear')
                .attr("width", width);



        //
        // Append chart elements
        //

        // Main path
        this.path = svg.append("g")
            .attr("clip-path", function(d, i) { return "url(#load-clip-" + element.substring(1) + ")"})
            .append("path")
                .datum(this.data)
                .attr("transform", "translate(" + x(0) + ",0)");

        // Add path based on chart type
        if(chartType == "area") {
            this.path.attr("d", this.area).attr('class', 'd3-area').style("fill", color); // area
        }
        else {
            this.path.attr("d", this.line).attr("class", "d3-line d3-line-medium").style('stroke', color); // line
        }

        // Animate path
        this.path
            .style('opacity', 0)
            .transition()
                .duration(750)
                .style('opacity', 1);

        // Call function on window resize
        $(window).on('resize', resizeSparklines);

        // Call function on sidebar width change
        $('.sidebar-control').on('click', resizeSparklines);

        // Resize function
        // 
        // Since D3 doesn't support SVG resize by default,
        // we need to manually specify parts of the graph that need to 
        // be updated on window resize
        function resizeSparklines() {

            // Layout variables
            width = d3Container.node().getBoundingClientRect().width - margin.left - margin.right;


            // Layout
            // -------------------------

            // Main svg width
            container.attr("width", width + margin.left + margin.right);

            // Width of appended group
            svg.attr("width", width + margin.left + margin.right);

            // Horizontal range
            x.range([0, width]);


            // Chart elements
            // -------------------------

            // Clip mask
            clips.attr("width", width);

            // Line
            svg.select(".d3-line").attr("d", this.line);

            // Area
            svg.select(".d3-area").attr("d", this.area);
        }
    }

            // Update random data. For demo only
        // ------------------------------

    this.update = function(element, chartType, qty, height, interpolation, duration, color, msg) {

        this.data.push(parseFloat(msg)*qty);
        // pop the old data point off the front
        this.data.shift();
        // Redraw the path and slide it to the left
        this.path
            .attr("transform", null)
            .transition()
                .duration(duration)
                .ease("easeOutQuart")
                .attr("transform", "translate(" + x(0) + ",0)");

        // Update path type
        if(chartType == "area") {
            this.path.attr("d", this.area).attr('class', 'd3-area').style("fill", color)
        }
        else {
            this.path.attr("d", this.line).attr("class", "d3-line d3-line-medium").style('stroke', color);
        }
    }
};

function barChart() {
        
    var svg;
    var y;
    var x0;
    var height = 250;
    var data = [];
    var currentLabels = [];
    // Chart setup
    this.barGrouped = function(element) {

        var yAxis;

        // Basic setup
        // ------------------------------

        // Define main variables
        var d3Container = d3.select(element),
            margin = {top: 5, right: 10, bottom: 20, left: 20},
            width = d3Container.node().getBoundingClientRect().width - margin.left - margin.right;

        height = height - margin.top - margin.bottom - 5;

        // Construct scales
        // ------------------------------

        // Horizontal
        x0 = d3.scale.ordinal()
            .rangeRoundBands([0, width], .1);

        var x1 = d3.scale.ordinal()
            .range([0, width]);

        // Vertical
        y = d3.scale.linear()
            .range([height, 0]);

        // Create axes
        // ------------------------------

        // Horizontal
        var xAxis = d3.svg.axis()
            .scale(x0)
            .orient("bottom");

        // Vertical
        yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(5)
            .tickSize(-width, 0, 0)
            .tickFormat(d3.format(".2s"));



        // Create chart
        // ------------------------------

        // Add SVG element
        var container = d3Container.append("svg");

        // Add SVG group
        svg = container
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


        // Load data
        // ------------------------------
            data = [
                {'State':'G1', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G2', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']}, 
                {'State':'G3', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G4', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G5', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G6', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G7', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G8', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G9', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']},
                {'State':'G10', 'Rover':['0', 'transparent'], 'Base':['0', 'transparent']}
            ];
            var ageNames = d3.keys(data[0]).filter(function(key) { return key !== "State"; });

            // Pull out values
            data.forEach(function(d) {
                d.ages = ageNames.map(function(name) { return {name: name, value: d[name][0], color: d[name][1]}; });
            });

            // Set input domains
            // ------------------------------

            // Horizontal
            x0.domain(data.map(function(d) { return d.State; }));
            x1.domain(ageNames).rangeRoundBands([0, x0.rangeBand()]);

            // Vertical
            y.domain([0, 55]);

            //
            // Append chart elements
            //

            // Append axes
            // ------------------------------

            // Horizontal
            svg.append("g")
                .attr("class", "d3-axis d3-axis-horizontal d3-axis-strong")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            // Vertical
            var verticalAxis = svg.append("g")
                .attr("class", "d3-axis d3-axis-vertical d3-axis-strong")
                .call(yAxis);

            // Add bars
            // ------------------------------

            // Group values
            var state = svg.selectAll(".bar-group")
                .data(data)
                .enter()
                .append("g")
                    .attr("class", "bar-group")
                    .attr("transform", function(d) { return "translate(" + x0(d.State) + ",0)"; });

            // Append bars
            state.selectAll(".d3-bar")
                .data(function(d) { return d.ages; })
                .enter()
                .append("rect")
                    .attr("class", "d3-bar")
                    .attr("width", x1.rangeBand())
                    .attr("x", function(d) { return x1(d.name); })
                    .attr("y", function(d) { return y(d.value); })
                    .attr("height", function(d) { return height - y(d.value); })
                    .style("fill", function(d) {return d.color; });
        // });


        // Resize chart
        // ------------------------------

        // Call function on window resize
        $(window).on('resize', resize);

        // Call function on sidebar width change
        $('.sidebar-control').on('click', resize);

        // Resize function
        // 
        // Since D3 doesn't support SVG resize by default,
        // we need to manually specify parts of the graph that need to 
        // be updated on window resize
        function resize() {

            // Layout variables
            width = d3Container.node().getBoundingClientRect().width - margin.left - margin.right;


            // Layout
            // -------------------------

            // Main svg width
            container.attr("width", width + margin.left + margin.right);

            // Width of appended group
            svg.attr("width", width + margin.left + margin.right);


            yAxis.tickSize(-width, 0, 0);
            // Axes
            // -------------------------

            // Horizontal ranges
            x0.rangeRoundBands([0, width], .1);
            x1.rangeRoundBands([0, x0.rangeBand()]);

            // Horizontal axis
            svg.selectAll('.d3-axis-horizontal').call(xAxis);
            svg.selectAll('.d3-axis-vertical').call(yAxis);


            // Chart elements
            // -------------------------

            // Bar group
            svg.selectAll('.bar-group').attr("transform", function(d) { return "translate(" + x0(d.State) + ",0)"; });

            // Bars
            svg.selectAll('.d3-bar').attr("width", x1.rangeBand()).attr("x", function(d) { return x1(d.name); });

        }
    }

    this.roverUpdate = function(msg){
        // msg object contains satellite data for rover in {"name0": "level0", "name1": "level1"} format

        // we want to display the top 10 results
        var number_of_satellites = 10;

        // graph has a list of datasets. rover sat values are in the first one
        var rover_dataset_number = 1;

        // first, we convert the msg object into a list of satellites to make it sortable

        var new_sat_values = [];

        for (var k in msg) {
            new_sat_values.push({sat:k, level:msg[k]});
        }

        // sort the sat levels by ascension
        new_sat_values.sort(function(a, b) {
            var diff = a.level - b.level;

            if (Math.abs(diff) < 3) {
                diff = 0;
            }

            return diff
        });

        // next step is to cycle through top 10 values if they exist
        // and extract info about them: level, name, and define their color depending on the level

        var new_sat_values_length = new_sat_values.length;
        var new_sat_levels = [];
        var new_sat_labels = [];
        var new_sat_fillcolors = [];

        for(var i = new_sat_values_length - number_of_satellites; i < new_sat_values_length; i++) {
            // check if we actually have enough satellites to plot:
            if (i <  0) {
                // we have less than number_of_satellites to plot
                // so we fill the first bars of the graph with zeroes and stuff
                new_sat_levels.push(0);
                new_sat_labels.push("");
                new_sat_fillcolors.push("rgba(0, 0, 0, 0.9)");
            } else {
                // we have gotten to useful data!! let's add it to the the array too

                // for some reason I sometimes get undefined here. So plot zero just to be safe
                var current_level = parseInt(new_sat_values[i].level) || 0;
                var current_fillcolor;

                // determine the fill color depending on the sat level
                switch(true) {
                    case (current_level < 30):
                        current_fillcolor = "#EF5350"; // Red
                        break;
                    case (current_level >= 30 && current_level <= 45):
                        current_fillcolor = "#FF7043"; // Yellow
                        break;
                    case (current_level >= 45):
                        current_fillcolor = "#009688"; // Green
                        break;
                }

                new_sat_levels.push(current_level);
                new_sat_labels.push(new_sat_values[i].sat);
                new_sat_fillcolors.push(current_fillcolor);
            }
        }

        for (var i = 0; i < new_sat_levels.length; i++) {
            
            data[i]['State'] = new_sat_labels[i];
            data[i]['Rover'][0] = new_sat_levels[i];
            data[i]['Rover'][1] = new_sat_fillcolors[i];

            currentLabels[i] = new_sat_labels[i];
        };

        var ageNames = d3.keys(data[0]).filter(function(key) { return key !== "State"; });
        // Pull out values
        data.forEach(function(d) {
            d.ages = ageNames.map(function(name) { return {name: name, value: d[name][0], color: d[name][1]}; });
        });

        svg.selectAll("text")
            .data(data)
            .text(function(d) {return d.State;})
            .style("font-size","10px");

        var state = svg.selectAll(".bar-group")
            .data(data)

        state.selectAll(".d3-bar")
            .data(function(d) {return d.ages; })
            .transition()
            .duration(500)
            .attr("y", function(d) { return y(d.value); })
            .attr("height", function(d) { return height - y(d.value); })
            .style("fill", function(d) {return d.color; });
    }

    this.baseUpdate = function(msg){

        var base_dataset_number = 0;
        var current_level = 0;
        var current_fillcolor;
        var new_sat_levels = [];
        // var new_sat_labels = [];
        var new_sat_fillcolors = [];

        // cycle through the graphs's labels and extract base levels for them
        currentLabels.forEach(function(label, label_index) {
            if (label in msg) {
                // get the sat level as an integer
                current_level = parseInt(msg[label]);

                new_sat_levels.push(current_level);
                new_sat_fillcolors.push("#d9d9d9");

            } else {
                // if we don't the same satellite in the base
                new_sat_levels.push(0);
                new_sat_fillcolors.push("#d9d9d9");
            }

        });
        for (var i = 0; i < new_sat_levels.length; i++) {
            data[i]['Base'][0] = new_sat_levels[i];
            data[i]['Base'][1] = new_sat_fillcolors[i];
        };

        // if(JSON.stringify(msg) == JSON.stringify(lastBaseMsg)){
        //     numOfRepetition++;
        // }
        // else{
        //    lastBaseMsg = msg;
        //    numOfRepetition = 0;
        // }

        // if(numOfRepetition >= 5)
        //     this.chartdata1 = [{'value':'', 'color':'rgba(255,0,0,0.5)'}, {'value':'', 'color':'rgba(255,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}, {'value':'', 'color':'rgba(0,255,0,0.5)'}];

        var ageNames = d3.keys(data[0]).filter(function(key) { return key !== "State"; });
        // Pull out values
        data.forEach(function(d) {
            d.ages = ageNames.map(function(name) { return {name: name, value: d[name][0], color: d[name][1]}; });
        });

        x0.domain(data.map(function(d) { return d.State; }));

        var state = svg.selectAll(".bar-group")
            .data(data)

        state.selectAll(".d3-bar")
            .data(function(d) {return d.ages; })
            .transition()
            .duration(500)
            .attr("y", function(d) { return y(d.value); })
            .attr("height", function(d) { return height - y(d.value); })
            .style("fill", function(d) {return d.color; });
    }
};

    // Initialize charts
    

function pieChart(){

    var foreground;
    var arc;
    var twoPi = Math.PI * 2;
    var front;
    var numberText;
    var formatPercent = d3.format('.0%');
    var svg;
    // Chart setup
    this.progressCounter = function(element, radius, border, color, end, iconClass, textTitle, textAverage) {

        // Basic setup
        // ------------------------------

        // Main variables
        var d3Container = d3.select(element),
            startPercent = 0,
            iconSize = 32,
            endPercent = end,
            boxSize = radius * 2;

        // Values count
        var count = Math.abs((endPercent - startPercent) / 0.01);

        // Values step
        var step = endPercent < startPercent ? -0.01 : 0.01;

        // Create chart
        // ------------------------------

        // Add SVG element
        var container = d3Container.append('svg');

        // Add SVG group
        svg = container
            .attr('width', boxSize)
            .attr('height', boxSize)
            .append('g')
                .attr('transform', 'translate(' + (boxSize / 2) + ',' + (boxSize / 2) + ')');



        // Construct chart layout
        // ------------------------------

        // Arc
        arc = d3.svg.arc()
            .startAngle(0)
            .innerRadius(radius)
            .outerRadius(radius - border);

        // Paths
        // ------------------------------

        // Background path
        svg.append('path')
            .attr('class', 'd3-progress-background')
            .attr('d', arc.endAngle(twoPi))
            .style('fill', '#eee');

        // Foreground path
        foreground = svg.append('path')
            .attr('class', 'd3-progress-foreground')
            .attr('filter', 'url(#blur)')
            .style('fill', color)
            .style('stroke', color);

        // Front path
        front = svg.append('path')
            .attr('class', 'd3-progress-front')
            .style('fill', color)
            .style('fill-opacity', 1);

        // Text
        // ------------------------------

        // Percentage text value
        numberText = d3.select(element)
            .append('h2')
                .attr('class', 'mt-15 mb-5')

        // Icon
        d3.select(element)
            .append("i")
                .attr("class", iconClass + " counter-icon")
                .attr('style', 'top: ' + ((boxSize - iconSize) / 2) + 'px');

        // Title
        d3.select(element)
            .append('div')
                .text(textTitle);

        // Subtitle
        d3.select(element)
            .append('div')
                .attr('class', 'text-size-small text-muted')
                .text(textAverage);
    }


        this.update = function(startPercent, endPercent){
            var progress = startPercent;
            var count = Math.abs((endPercent - startPercent) / 0.01);
            var step = endPercent < startPercent ? -0.01 : 0.01;

            (function loops() {
                foreground.attr('d', arc.endAngle(twoPi * progress));
                front.attr('d', arc.endAngle(twoPi * progress));
                numberText.text((endPercent*50).toFixed(1));

                // svg.selectAll("i").text('1');

                if (count > 0) {
                    count--;
                    progress += step;
                    setTimeout(loops, 10);
                }
            })();
        }
}

function googleMap(){ 
    var map;
    var flightPath;
    var cityCircle;
    lineArr = new Array;
    pointArr = new Array;

    this.create = function(lat, lon){

        // First, create an object containing LatLng and population for each city.
        
        // citymap['wroclaw'] = {
        //     center: new google.maps.LatLng(lat, lon),
        //     population: round
        // };

        // Initialize
        function initialize() {

            // Options
            var mapOptions = {
                zoom: 30,
                center: new google.maps.LatLng(lat, lon),
                mapTypeId: google.maps.MapTypeId.TERRAIN
            };

            // Apply options
            map = new google.maps.Map($('.map-drawing-circles')[0], mapOptions);
        }

        // Load map
        // google.maps.event.addDomListener(window, 'load', initialize);
        initialize();

    };

    this.setZoom = function(){
        map.setZoom(20);
    }

    this.setCenter = function(lat, lon){
        var myLatlng = {lat: parseFloat(lat), lng: parseFloat(lon)};
        map.setCenter(myLatlng);
    }

    this.update = function(lat, lon, round){
                    // Construct the circle for each value in citymap.
        // Note: We scale the area of the circle based on the population.
        // for (var city in citymap) {

            // Options
            var populationOptions = {
                strokeColor: '#b41b1b',
                strokeOpacity: 0.5,
                strokeWeight: 1,
                fillColor: '#b41b1b',
                fillOpacity: 0.2,
                map: map,
                center: new google.maps.LatLng(lat, lon),
                radius: Math.sqrt(round) * 100
            };

            // Add the circle for this city to the map.
            cityCircle = new google.maps.Circle(populationOptions);
            
            pointArr.push(cityCircle);

        // }
    }

    this.line = function(path, color){
        flightPath = new google.maps.Polyline({
            path: path,
            geodesic: true,
            // strokeColor: '#FF0000',
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 1
        });

        this.addLine();

        lineArr.push(flightPath);
    }

    this.removeLine = function(){
        flightPath.setMap(null);
    }

    this.addLine = function(){
        flightPath.setMap(map);
    }

    this.clearMap = function(){
        
        for (var i = 0; i < lineArr.length; i++) {
            lineArr[i].setMap(null);
        }

        for (var i = 0; i < pointArr.length; i++) {
            pointArr[i].setMap(null);
        }
    }

    // this.clear = function(markers) {
    //     for (var i = 0; i < markers.length; i++) {
    //         console.log(markers.length);
    //         markers[i].setMap(null);
    //     }
    // }
}