var GridPainter = (function () {
    var left = 30;
    var top = 21;

    function rectangle(ctx, x, y, width, height, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }

    function paint(canvas, grid, scale, showGrid, showAxes, showLabels, preview, labelStep) {
        var width = grid.width * scale;
        var height = grid.height * scale;
        var leftMargin = labelStep ? left + 10 : left;
        canvas.width = width + leftMargin + 27;
        canvas.height = height + top + 27;
        var ctx = canvas.getContext("2d");
        var middleX = leftMargin + (grid.originX + 0.5) * scale;
        var middleY = top + (grid.height - grid.originY - 0.5) * scale;
        rectangle(ctx, 0, 0, canvas.width, canvas.height, "#ffffff");
        rectangle(ctx, leftMargin, top, width, height, "#f7fafb");
        var x;
        var y;
        if (showGrid) {
            for (x = 0; x <= grid.width; x++) {
                rectangle(ctx, leftMargin + x * scale, top, 1, height + 1, "#dbe6e9");
            }
            for (y = 0; y <= grid.height; y++) {
                rectangle(ctx, leftMargin, top + y * scale, width + 1, 1, "#dbe6e9");
            }
        }
        if (showAxes) {
            rectangle(ctx, leftMargin, Math.floor(middleY), width, 1, "#b54e49");
            rectangle(ctx, Math.floor(middleX), top, 1, height, "#3a6890");
        }
        for (y = 0; y < grid.height; y++) {
            for (x = 0; x < grid.width; x++) {
                var index = y * grid.width + x;
                var cellX = leftMargin + x * scale + 1;
                var cellY = top + (grid.height - 1 - y) * scale + 1;
                var intensity = grid.values[index];
                if (intensity > 0) {
                    ctx.globalAlpha = intensity;
                    rectangle(ctx, cellX, cellY, scale - 1, scale - 1, "#142f39");
                }
                if (preview && preview.values[index] > 0) {
                    ctx.globalAlpha = preview.values[index];
                    rectangle(ctx, cellX, cellY, scale - 1, scale - 1, "#007587");
                }
            }
        }
        ctx.globalAlpha = 1;
        if (showLabels) {
            var step = labelStep || 5;
            ctx.font = "12px Verdana, sans-serif";
            ctx.fillStyle = "#344c57";
            ctx.textAlign = "center";
            for (x = -grid.originX; x < grid.width - grid.originX; x++) {
                if (x % step === 0) {
                    ctx.fillText(x, middleX + x * scale, top + height + 17);
                }
            }
            ctx.textAlign = "right";
            for (y = -grid.originY; y < grid.height - grid.originY; y++) {
                if (y % step === 0) {
                    ctx.fillText(y, leftMargin - 5, middleY - y * scale + 4);
                }
            }
            ctx.fillStyle = "#a13935";
            ctx.textAlign = "left";
            ctx.fillText("X", leftMargin + width + 7, middleY + 4);
            ctx.fillStyle = "#315e87";
            ctx.fillText("Y", middleX + 6, top - 6);
        }
    }

    function coordinates(canvas, grid, scale, event) {
        var rect = canvas.getBoundingClientRect();
        var x = Math.floor((event.clientX - rect.left - left) / scale);
        var row = Math.floor((event.clientY - rect.top - top) / scale);
        if (x < 0 || row < 0 || x >= grid.width || row >= grid.height) {
            return null;
        }
        return { x: x - grid.originX, y: grid.height - 1 - row - grid.originY };
    }

    function graph(canvas, groups, descriptor) {
        var ctx = canvas.getContext("2d");
        var x0 = 51;
        var y0 = 22;
        var width = canvas.width - x0 - 27;
        var height = canvas.height - y0 - 48;
        var maxTime = 0;
        var values = groups[0].points;
        var maxValue = values[values.length - 1].value;
        var i;
        var j;
        for (i = 0; i < groups.length; i++) {
            for (j = 0; j < groups[i].points.length; j++) {
                maxTime = Math.max(maxTime, groups[i].points[j].time);
            }
        }
        var order = Math.pow(10, Math.floor(Math.log(maxTime / 4 || 1) / Math.LN10));
        var unit = Math.ceil((maxTime / 4) / order) * order || 1;
        var maxAxis = unit * 4;
        rectangle(ctx, 0, 0, canvas.width, canvas.height, "#fff");
        ctx.font = "12px Verdana, sans-serif";
        ctx.textAlign = "right";
        for (i = 0; i <= 4; i++) {
            var y = Math.round(y0 + height * (1 - i / 4));
            rectangle(ctx, x0, y, width, 1, i === 0 ? "#8098a2" : "#e0eaed");
            ctx.fillStyle = "#344c57";
            ctx.fillText(String(Number((i * unit).toPrecision(3))).replace(".", ","), x0 - 6, y + 4);
        }
        rectangle(ctx, x0, y0, 1, height, "#8098a2");
        ctx.textAlign = "center";
        for (i = 0; i < values.length; i++) {
            var tickX = x0 + Math.round(values[i].value / maxValue * width);
            rectangle(ctx, tickX, y0 + height, 1, 5, "#8098a2");
            ctx.fillStyle = "#344c57";
            ctx.fillText(descriptor.thousands ? values[i].value / 1000 : values[i].value, tickX, y0 + height + 18);
        }
        ctx.fillText(descriptor.axis, x0 + width / 2, canvas.height - 6);
        ctx.textAlign = "left";
        ctx.fillText("Время, мс", x0, 13);
        for (i = 0; i < groups.length; i++) {
            var color = groups[i].color;
            var target = {
                setPixel: function (x, y) { rectangle(ctx, x, y, 2, 2, color); }
            };
            var prevX;
            var prevY;
            for (j = 0; j < groups[i].points.length; j++) {
                var point = groups[i].points[j];
                var px = x0 + Math.round(point.value / maxValue * width);
                var py = y0 + height - Math.round(point.time / maxAxis * height);
                if (j > 0) {
                    RasterEngine.bresenham(target, prevX, prevY, px, py);
                }
                rectangle(ctx, px - 2, py - 2, 5, 5, color);
                prevX = px;
                prevY = py;
            }
        }
    }

    return { paint: paint, coordinates: coordinates, graph: graph };
}());
