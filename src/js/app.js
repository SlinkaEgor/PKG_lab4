(function () {
    function byId(id) { return document.getElementById(id); }

    function write(node, value) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
        node.appendChild(document.createTextNode(value));
    }

    function number(value, digits) {
        return value.toFixed(digits).replace(".", ",");
    }

    var method = byId("method");
    var canvas = byId("gridCanvas");
    var status = byId("rasterStatus");
    var grid = new VirtualGrid(61, 45);
    var preview = new VirtualGrid(grid.width, grid.height);
    var inputs = ["x0", "y0", "x1", "y1"];

    function render() {
        GridPainter.paint(canvas, grid, Number(byId("scale").value),
            byId("showGrid").checked, byId("showAxes").checked, byId("showLabels").checked, preview);
    }

    function changeLabels() {
        var circle = method.value === "circle";
        var ellipse = method.value === "ellipse";
        write(byId("labelX0"), circle || ellipse ? "Центр X" : "Начало X₁");
        write(byId("labelY0"), circle || ellipse ? "Центр Y" : "Начало Y₁");
        write(byId("labelX1"), circle ? "Радиус r" : ellipse ? "Полуось rₓ" : "Конец X₂");
        write(byId("labelY1"), ellipse ? "Полуось rᵧ" : "Конец Y₂");
        byId("secondY").className = circle ? "hidden" : "";
    }

    function exampleValues() {
        var values = method.value === "circle" ? [0, 0, 15, 0]
            : method.value === "ellipse" ? [0, 0, 23, 12] : [-24, -11, 23, 15];
        for (var i = 0; i < inputs.length; i++) {
            byId(inputs[i]).value = values[i];
        }
    }

    function integer(id, positive, focusInvalid) {
        var input = byId(id);
        var raw = input.value.replace(/^\s+|\s+$/g, "");
        var value = Number(raw);
        if (!/^-?\d+$/.test(raw) || Math.abs(value) > 500 || (positive && value < 0)) {
            if (focusInvalid) {
                input.focus();
            }
            var label = byId("label" + id.toUpperCase());
            throw new Error(label.textContent + ": " + (positive ? "целое число от 0 до 500." : "целое число от −500 до 500."));
        }
        return value;
    }

    function draw(commit) {
        var id = method.value;
        var circle = id === "circle";
        var ellipse = id === "ellipse";
        var x;
        var y;
        var endX;
        var endY;
        preview.clear();
        try {
            x = integer("x0", false, commit);
            y = integer("y0", false, commit);
            endX = integer("x1", circle || ellipse, commit);
            endY = circle ? 0 : integer("y1", ellipse, commit);
        } catch (error) {
            render();
            status.className = "status error";
            write(status, error.message);
            return;
        }
        RasterEngine[id](commit ? grid : preview, x, y, endX, endY);
        render();
        status.className = "status";
        var limitX = circle || ellipse ? Math.abs(x) + endX : Math.max(Math.abs(x), Math.abs(endX));
        var limitY = circle || ellipse ? Math.abs(y) + (circle ? endX : endY) : Math.max(Math.abs(y), Math.abs(endY));
        var clipped = limitX > grid.originX || limitY > grid.originY;
        var message = commit ? "Фигура добавлена." : "Предпросмотр.";
        write(status, clipped ? message + " Часть фигуры вне сетки." : message);
    }

    var tabs = ["tabRaster", "tabBenchmark"];
    function showTab(selected) {
        for (var i = 0; i < tabs.length; i++) {
            var button = byId(tabs[i]);
            var active = i === selected;
            button.className = active ? "tab current" : "tab";
            button.setAttribute("aria-pressed", active ? "true" : "false");
            byId(button.getAttribute("aria-controls")).className = active ? "" : "hidden";
        }
    }

    function addCell(row, value) {
        var cell = document.createElement("td");
        write(cell, value);
        row.appendChild(cell);
    }

    var descriptors = [
        { id: "lineCount", name: "Время от числа отрезков", axis: "Отрезки, тыс.", thousands: true },
        { id: "lineLength", name: "Время от длины отрезка", axis: "Длина, шагов по ведущей оси" },
        { id: "circleCount", name: "Время от числа кривых", axis: "Кривые, тыс.", thousands: true },
        { id: "radius", name: "Время от радиуса", axis: "Радиус или полуось, клеток" }
    ];

    function displayChart(results, descriptor) {
        var card = document.createElement("section");
        card.className = "card chart";
        var title = document.createElement("h3");
        write(title, descriptor.name);
        card.appendChild(title);
        var legend = document.createElement("div");
        legend.className = "legend";
        card.appendChild(legend);
        var scroll = document.createElement("div");
        scroll.className = "scroll";
        card.appendChild(scroll);
        var chart = document.createElement("canvas");
        chart.width = 470;
        chart.height = 250;
        chart.setAttribute("aria-label", descriptor.name);
        scroll.appendChild(chart);
        var groups = [];
        var byMethod = {};
        for (var i = 0; i < results.length; i++) {
            var point = results[i];
            if (point.series !== descriptor.id) {
                continue;
            }
            var info = RasterBenchmark.methods[point.method];
            if (!byMethod[point.method]) {
                var item = document.createElement("span");
                var swatch = document.createElement("i");
                swatch.className = "key";
                swatch.style.backgroundColor = info.color;
                item.appendChild(swatch);
                item.appendChild(document.createTextNode(info.name));
                legend.appendChild(item);
                byMethod[point.method] = { color: info.color, points: [] };
                groups.push(byMethod[point.method]);
            }
            byMethod[point.method].points.push(point);
        }
        byId("charts").appendChild(card);
        GridPainter.graph(chart, groups, descriptor);
    }

    function displayResults(results, rasters) {
        var rows = byId("resultRows");
        rows.innerHTML = "";
        byId("charts").innerHTML = "";
        for (var i = 0; i < results.length; i++) {
            var value = results[i];
            if ((value.series === "lineCount" && value.value === 100000)
                || (value.series === "circleCount" && value.value === 50000)) {
                var row = document.createElement("tr");
                addCell(row, RasterBenchmark.methods[value.method].name);
                addCell(row, String(value.count));
                addCell(row, number(value.time, 3));
                addCell(row, number(value.time * 1000 / value.count, 4));
                rows.appendChild(row);
            }
        }
        byId("benchOutput").className = "";
        GridPainter.paint(byId("benchmarkLines"), rasters.lines, 2, true, true, true, null, 32);
        GridPainter.paint(byId("benchmarkCircles"), rasters.circles, 2, true, true, true, null, 32);
        for (i = 0; i < descriptors.length; i++) {
            displayChart(results, descriptors[i]);
        }
    }

    byId("tabRaster").onclick = function () { showTab(0); };
    byId("tabBenchmark").onclick = function () { showTab(1); };
    if (!canvas.getContext) {
        write(status, "Этот браузер не поддерживает Canvas.");
        return;
    }
    method.onchange = function () { changeLabels(); exampleValues(); draw(false); };
    for (var i = 0; i < inputs.length; i++) {
        byId(inputs[i]).oninput = function () { draw(false); };
    }
    byId("drawForm").onsubmit = function () { draw(true); return false; };
    byId("example").onclick = function () { exampleValues(); draw(false); };
    byId("clear").onclick = function () {
        grid.clear();
        preview.clear();
        render();
        status.className = "status";
        write(status, "Растр очищен.");
    };
    byId("scale").onchange = render;
    byId("showGrid").onchange = render;
    byId("showAxes").onchange = render;
    byId("showLabels").onchange = render;
    canvas.onmousemove = function (event) {
        var point = GridPainter.coordinates(canvas, grid, Number(byId("scale").value), event);
        write(byId("cursor"), point ? "(" + point.x + ", " + point.y + ")" : "61 × 45 клеток");
    };
    canvas.onmouseout = function () { write(byId("cursor"), "61 × 45 клеток"); };
    var benchmarkButton = byId("runBenchmark");
    var exampleButton = byId("showBenchmarkExample");
    exampleButton.onclick = function () {
        byId("progressTrack").className = "progress-track hidden";
        displayResults(BenchmarkExample, RasterBenchmark.exampleRasters());
        write(byId("benchStatus"), "Пример результатов: сохранённый замер.");
    };
    benchmarkButton.onclick = function () {
        this.disabled = true;
        exampleButton.disabled = true;
        byId("benchOutput").className = "hidden";
        byId("progressTrack").className = "progress-track";
        byId("progressBar").style.width = "0%";
        write(byId("benchStatus"), "Подготовка входных данных…");
        setTimeout(function () {
            RasterBenchmark.run(function (done, total) {
                byId("progressBar").style.width = Math.round(100 * done / total) + "%";
                write(byId("benchStatus"), "Выполнено серий: " + done + " из " + total + ".");
            }, function (results, rasters) {
                displayResults(results, rasters);
                benchmarkButton.disabled = false;
                exampleButton.disabled = false;
                write(byId("benchStatus"), "Бенчмарк завершён. Таймер: " + RasterBenchmark.timer + ".");
            });
        }, 0);
    };
    showTab(0);
    changeLabels();
    draw(false);
}());
