function VirtualGrid(width, height) {
    this.width = width;
    this.height = height;
    this.originX = Math.floor(width / 2);
    this.originY = Math.floor(height / 2);
    this.values = typeof Float64Array === "function" ? new Float64Array(width * height) : new Array(width * height);
    this.clear();
}

VirtualGrid.prototype.clear = function () {
    for (var i = 0; i < this.values.length; i++) {
        this.values[i] = 0;
    }
};

VirtualGrid.prototype.setPixel = function (x, y, intensity) {
    var column = x + this.originX;
    var row = y + this.originY;
    if (column < 0 || row < 0 || column >= this.width || row >= this.height) {
        return;
    }
    var index = row * this.width + column;
    if (intensity > this.values[index]) {
        this.values[index] = intensity > 1 ? 1 : intensity;
    }
};
