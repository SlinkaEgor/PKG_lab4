var RasterEngine = (function () {
    function steps(x0, y0, x1, y1) {
        return Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    }

    function stepLine(target, x0, y0, x1, y1) {
        var n = steps(x0, y0, x1, y1);
        var dx = x1 - x0;
        var dy = y1 - y0;
        for (var i = 0; i < n; i++) {
            var t = i / n;
            target.setPixel(Math.floor(x0 + dx * t + 0.5), Math.floor(y0 + dy * t + 0.5), 1);
        }
        target.setPixel(x1, y1, 1);
    }

    function ddaLine(target, x0, y0, x1, y1) {
        var n = steps(x0, y0, x1, y1);
        if (n > 0) {
            var dx = (x1 - x0) / n;
            var dy = (y1 - y0) / n;
            for (var i = 0; i < n; i++) {
                target.setPixel(Math.floor(x0 + 0.5), Math.floor(y0 + 0.5), 1);
                x0 += dx;
                y0 += dy;
            }
        }
        target.setPixel(x1, y1, 1);
    }

    function bresenhamLine(target, x0, y0, x1, y1) {
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1;
        var sy = y0 < y1 ? 1 : -1;
        var error;
        if (dx >= dy) {
            error = Math.floor(dx / 2);
            while (x0 !== x1) {
                target.setPixel(x0, y0, 1);
                x0 += sx;
                error -= dy;
                if (error < 0) {
                    y0 += sy;
                    error += dx;
                }
            }
        } else {
            error = Math.floor(dy / 2);
            while (y0 !== y1) {
                target.setPixel(x0, y0, 1);
                y0 += sy;
                error -= dx;
                if (error < 0) {
                    x0 += sx;
                    error += dy;
                }
            }
        }
        target.setPixel(x1, y1, 1);
    }

    function wuPixel(target, steep, u, v, intensity) {
        if (steep) {
            target.setPixel(v, u, intensity);
        } else {
            target.setPixel(u, v, intensity);
        }
    }

    function wuLine(target, x0, y0, x1, y1) {
        var steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
        var u0 = steep ? y0 : x0;
        var u1 = steep ? y1 : x1;
        var v0 = steep ? x0 : y0;
        var v1 = steep ? x1 : y1;
        var swap;
        if (u0 > u1) {
            swap = u0;
            u0 = u1;
            u1 = swap;
            swap = v0;
            v0 = v1;
            v1 = swap;
        }

        wuPixel(target, steep, u0, v0, 1);
        if (u0 === u1) {
            return;
        }

        var gradient = (v1 - v0) / (u1 - u0);
        var v = v0 + gradient;
        for (var u = u0 + 1; u < u1; u++) {
            var low = Math.floor(v);
            var fraction = v - low;
            wuPixel(target, steep, u, low, 1 - fraction);
            if (fraction > 0) {
                wuPixel(target, steep, u, low + 1, fraction);
            }
            v += gradient;
        }
        wuPixel(target, steep, u1, v1, 1);
    }

    function symmetricFour(target, cx, cy, x, y) {
        target.setPixel(cx + x, cy + y, 1);
        target.setPixel(cx - x, cy + y, 1);
        target.setPixel(cx + x, cy - y, 1);
        target.setPixel(cx - x, cy - y, 1);
    }

    function bresenhamCircle(target, cx, cy, radius) {
        var x = 0;
        var y = radius;
        var d = 3 - 2 * radius;
        while (x <= y) {
            symmetricFour(target, cx, cy, x, y);
            symmetricFour(target, cx, cy, y, x);
            if (d < 0) {
                d += 4 * x + 6;
            } else {
                d += 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    function castlePittewayEllipse(target, cx, cy, rx, ry) {
        if (rx === 0 || ry === 0) {
            bresenhamLine(target, cx - rx, cy - ry, cx + rx, cy + ry);
            return;
        }
        if (rx < ry) {
            castlePittewayEllipse({
                setPixel: function (x, y, intensity) {
                    target.setPixel(cx + y, cy + x, intensity);
                }
            }, 0, 0, ry, rx);
            return;
        }

        var a = rx * rx;
        var b = ry * ry;
        var x = 0;
        var y = ry;
        var xGradient = 0;
        var yGradient = 2 * a * y;
        var d = 4 * b - 4 * a * y + a;
        while (xGradient < yGradient && x < rx && y > 0) {
            symmetricFour(target, cx, cy, x, y);
            var diagonal = d >= 0;
            x++;
            xGradient += 2 * b;
            d += 4 * (xGradient + b);
            if (diagonal) {
                yGradient -= 2 * a;
                y--;
                d -= 4 * yGradient;
            }
        }

        d = b * (2 * x + 1) * (2 * x + 1) + 4 * a * (y - 1) * (y - 1) - 4 * a * b;
        while (y > 0) {
            symmetricFour(target, cx, cy, x, y);
            if (d < 0 && x < rx) {
                xGradient += 2 * b;
                x++;
                d += 4 * xGradient;
            }
            y--;
            yGradient -= 2 * a;
            d += 4 * (a - yGradient);
        }

        for (; x <= rx; x++) {
            target.setPixel(cx + x, cy, 1);
            target.setPixel(cx - x, cy, 1);
        }
    }

    return {
        step: stepLine,
        dda: ddaLine,
        bresenham: bresenhamLine,
        wu: wuLine,
        circle: bresenhamCircle,
        ellipse: castlePittewayEllipse
    };
}());
