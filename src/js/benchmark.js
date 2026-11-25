var RasterBenchmark = (function () {
    var methods = {
        step: { name: "Пошаговый", color: "#8f5a36" },
        dda: { name: "ЦДА", color: "#1679ad" },
        bresenham: { name: "Брезенхем", color: "#136d51" },
        wu: { name: "Ву", color: "#794cc0" },
        circle: { name: "Брезенхем (окружность)", color: "#136d51" },
        ellipse: { name: "Кастл–Питвей (равные полуоси)", color: "#794cc0" }
    };
    var lineMethods = ["step", "dda", "bresenham", "wu"];
    var circleMethods = ["circle", "ellipse"];
    var mainLineCount = 100000;
    var mainCircleCount = 50000;
    var exampleInput = { lineSeed: 72134, circleSeed: 41627, circleX: 0, circleY: 0 };
    var lastSeed = null;
    var lastCenter = -1;
    var clock = typeof performance !== "undefined" && typeof performance.now === "function"
        ? function () { return performance.now(); }
        : function () { return new Date().getTime(); };
    var timer = typeof performance !== "undefined" && typeof performance.now === "function"
        ? "performance.now()" : "Date (мс)";

    function randomGenerator(seed) {
        return function (min, max) {
            seed = (1664525 * seed + 1013904223) >>> 0;
            return min + Math.floor(seed / 4294967296 * (max - min + 1));
        };
    }

    function newInput() {
        var seed = Math.floor(Math.random() * 4294967296);
        if (seed === lastSeed) {
            seed = (seed + 1) >>> 0;
        }
        lastSeed = seed;
        var side = 33;
        var center = Math.floor(Math.random() * side * side);
        if (center === lastCenter) {
            center = (center + 1) % (side * side);
        }
        lastCenter = center;
        return {
            lineSeed: seed,
            circleSeed: (seed ^ 0x9e3779b9) >>> 0,
            circleX: center % side - 16,
            circleY: Math.floor(center / side) - 16
        };
    }

    function makeLines(count, fixedLength, seed) {
        var random = randomGenerator(seed);
        var directions = [[1, 1, 0], [1, 1, 1], [-1, 1, 1], [-1, 1, 0],
            [-1, -1, 0], [-1, -1, 1], [1, -1, 1], [1, -1, 0]];
        var lines = [];
        for (var i = 0; i < count; i++) {
            var span = random(8, 120);
            var length = fixedLength || span;
            var side = random(1, length - 1);
            var direction = directions[i % 8];
            var x = direction[2] ? side : length;
            var y = direction[2] ? length : side;
            lines.push([x * direction[0], y * direction[1]]);
        }
        return lines;
    }

    function makeCircles(count, fixedRadius, seed) {
        var random = randomGenerator(seed);
        var circles = [];
        for (var i = 0; i < count; i++) {
            var r = random(5, 80);
            circles.push(fixedRadius || r);
        }
        return circles;
    }

    function jobs(input) {
        input = input || exampleInput;
        var result = [];
        var sets = [
            { id: "lineCount", values: [10000, 25000, 50000, 75000, mainLineCount], methods: lineMethods },
            { id: "lineLength", values: [8, 30, 60, 90, 120], methods: lineMethods },
            { id: "circleCount", values: [5000, 10000, 20000, 35000, mainCircleCount], methods: circleMethods },
            { id: "radius", values: [5, 20, 40, 80, 120], methods: circleMethods }
        ];
        for (var j = 0; j < sets.length; j++) {
            var set = sets[j];
            for (var k = 0; k < set.values.length; k++) {
                var value = set.values[k];
                var data;
                if (set.id === "lineCount") {
                    data = makeLines(value, 0, input.lineSeed);
                } else if (set.id === "lineLength") {
                    data = makeLines(50000, value, input.lineSeed);
                } else if (set.id === "circleCount") {
                    data = makeCircles(value, 0, input.circleSeed);
                } else {
                    data = makeCircles(20000, value, input.circleSeed);
                }
                for (var m = 0; m < set.methods.length; m++) {
                    result.push({
                        series: set.id,
                        value: value,
                        method: set.methods[m],
                        data: data,
                        centerX: set.id === "circleCount" ? input.circleX : 0,
                        centerY: set.id === "circleCount" ? input.circleY : 0
                    });
                }
            }
        }
        return result;
    }

    function drawBatch(grid, job, from, to) {
        var draw = RasterEngine[job.method];
        var data = job.data;
        var centerX = job.centerX || 0;
        var centerY = job.centerY || 0;
        var i;
        if (job.method === "ellipse") {
            for (i = from; i < to; i++) {
                draw(grid, centerX, centerY, data[i], data[i]);
            }
        } else if (job.method === "circle") {
            for (i = from; i < to; i++) {
                draw(grid, centerX, centerY, data[i]);
            }
        } else {
            for (i = from; i < to; i++) {
                draw(grid, 0, 0, data[i][0], data[i][1]);
            }
        }
    }

    function measure(grid, job, repeats) {
        var times = [];
        var batchSize = 5000;
        drawBatch(grid, job, 0, Math.min(batchSize, job.data.length));
        for (var r = 0; r < repeats; r++) {
            var total = 0;
            var passes = 0;
            var start;
            do {
                for (var i = 0; i < job.data.length; i += batchSize) {
                    grid.clear();
                    var end = Math.min(i + batchSize, job.data.length);
                    start = clock();
                    drawBatch(grid, job, i, end);
                    total += clock() - start;
                }
                passes++;
            } while (timer === "Date (мс)" && total < 40 && passes < 64);
            times.push(total / passes);
        }
        times.sort(function (a, b) { return a - b; });
        return times[Math.floor(times.length / 2)];
    }

    function rasterize(job) {
        var grid = new VirtualGrid(257, 257);
        drawBatch(grid, job, 0, job.data.length);
        return grid;
    }

    function buildRasters(lines, circles) {
        return {
            lines: rasterize(lines),
            circles: rasterize(circles)
        };
    }

    function exampleRasters() {
        return buildRasters(
            { method: "bresenham", data: makeLines(mainLineCount, 0, exampleInput.lineSeed) },
            { method: "circle", data: makeCircles(mainCircleCount, 0, exampleInput.circleSeed), centerX: 0, centerY: 0 }
        );
    }

    function run(progress, finish) {
        var tasks = jobs(newInput());
        var grid = new VirtualGrid(257, 257);
        var results = [];
        var index = 0;
        var lines;
        var circles;
        function next() {
            var job = tasks[index];
            if (job.series === "lineCount" && job.value === mainLineCount && job.method === "bresenham") {
                lines = job;
            } else if (job.series === "circleCount" && job.value === mainCircleCount && job.method === "circle") {
                circles = job;
            }
            results.push({
                series: job.series,
                value: job.value,
                method: job.method,
                count: job.data.length,
                time: measure(grid, job, 5)
            });
            index++;
            progress(index, tasks.length);
            if (index < tasks.length) {
                setTimeout(next, 0);
            } else {
                finish(results, buildRasters(lines, circles));
            }
        }
        setTimeout(next, 0);
    }

    return { run: run, methods: methods, timer: timer, jobs: jobs, measure: measure, exampleRasters: exampleRasters };
}());
