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

        console.log(this.data);

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
            
        console.log(x(0));

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