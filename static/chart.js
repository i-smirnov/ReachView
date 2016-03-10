function Chart() {

		this.data = [];
        this.path = '';
        this.x = '';
        this.line = '';
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
        var area = d3.svg.area()
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
            this.path.attr("d", area).attr('class', 'd3-area').style("fill", color); // area
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
            svg.select(".d3-area").attr("d", area);
        }
    }

            // Update random data. For demo only
        // ------------------------------

    this.update = function(element, chartType, qty, height, interpolation, duration, color, msg) {

        this.data.push(parseFloat(msg));
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
            this.path.attr("d", area).attr('class', 'd3-area').style("fill", color)
        }
        else {
            this.path.attr("d", this.line).attr("class", "d3-line d3-line-medium").style('stroke', color);
        }
    }
};

function barChart() {


    // Chart setup
    this.barGrouped = function(element, height) {


        // Basic setup
        // ------------------------------

        // Define main variables
        var d3Container = d3.select(element),
            margin = {top: 5, right: 10, bottom: 20, left: 40},
            width = d3Container.node().getBoundingClientRect().width - margin.left - margin.right,
            height = height - margin.top - margin.bottom - 5;

        // Construct scales
        // ------------------------------

        // Horizontal
        var x0 = d3.scale.ordinal()
            .rangeRoundBands([0, width], .1);

        var x1 = d3.scale.ordinal()
            .range([0, width]);

        // Vertical
        var y = d3.scale.linear()
            .range([height, 0]);

        // Colors
        var color = d3.scale.ordinal()
        .range(["green", "#eeeeee"]);



        // Create axes
        // ------------------------------

        // Horizontal
        var xAxis = d3.svg.axis()
            .scale(x0)
            .orient("bottom");

        // Vertical
        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .tickFormat(d3.format(".2s"));



        // Create chart
        // ------------------------------

        // Add SVG element
        var container = d3Container.append("svg");

        // Add SVG group
        var svg = container
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


        // Load data
        // ------------------------------

            var data = [{'State':'G1', 'Rover':['10', 'red'], 'Base':['50', 'green']}];
            var ageNames = d3.keys(data[0]).filter(function(key) { return key !== "State"; });

            // Pull out values
            data.forEach(function(d) {
                d.ages = ageNames.map(function(name) { return {name: name, value: +d[name][0], color: d[name][1]}; });
            });


            // Set input domains
            // ------------------------------

            // Horizontal
            x0.domain(data.map(function(d) { return d.State; }));
            x1.domain(ageNames).rangeRoundBands([0, x0.rangeBand()]);

            // Vertical
            y.domain([0, d3.max(data, function(d) { return d3.max(d.ages, function(d) { return d.value; }); })]);


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

            // Add text label
            verticalAxis.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 10)
                .attr("dy", ".71em")
                .style("text-anchor", "end")
                .style("fill", "#999")
                .style("font-size", 12)
                .text("Level");


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


            // Axes
            // -------------------------

            // Horizontal ranges
            x0.rangeRoundBands([0, width], .1);
            x1.rangeRoundBands([0, x0.rangeBand()]);

            // Horizontal axis
            svg.selectAll('.d3-axis-horizontal').call(xAxis);


            // Chart elements
            // -------------------------

            // Bar group
            svg.selectAll('.bar-group').attr("transform", function(d) { return "translate(" + x0(d.State) + ",0)"; });

            // Bars
            svg.selectAll('.d3-bar').attr("width", x1.rangeBand()).attr("x", function(d) { return x1(d.name); });

        }
    }

    // this.barUpdate = function(){
    //     var data = [{'State':'G1', 'Rover':['100', 'green'], 'Base':['10', 'red']}];
    //     var ageNames = d3.keys(data[0]).filter(function(key) { return key !== "State"; });

    //     // Pull out values
    //     data.forEach(function(d) {
    //         d.ages = ageNames.map(function(name) { return {name: name, value: +d[name][0], color: d[name][1]}; });
    //     });

    //     // var state = svg.selectAll(".bar-group")
    //     //     .data(data)
    //     //     .enter()
    //     //     .append("g")
    //     //         .attr("class", "bar-group")
    //     //         .attr("transform", function(d) { return "translate(" + x0(d.State) + ",0)"; });

    //     // Append bars
    //     svg.selectAll("rect")
    //         .transition()
    //         .delay(0)
    //         .duration(1000)
    //         .ease('cubic-in-out')
    //             .attr("x", function(d) { return x1(d.name); })
    //             .attr("y", function(d) { return y(d.value); })
    //             .attr("height", function(d) { return height - y(d.value); })
    //             .style("fill", function(d) {return d.color; });
    // }
};