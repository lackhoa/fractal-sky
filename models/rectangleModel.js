﻿class RectangleModel extends Model {
    constructor() {
        super();
        this._x = 0; this._y = 0;
        this._width = 0; this._height = 0;
    }

    serialize() {
        var model = super.serialize();
        model.x = this._x;
        model.y = this._y;
        model.width = this._width;
        model.height = this._height;

        return { Rectangle: model };
    }

    deserialize(model, el) {
        super.deserialize(model, el);
        this.x = model.x;
        this.y = model.y;
        this.width = model.width;
        this.height = model.height;
    }

    get x() { return this._x; }
    get y() { return this._y; }
    get width() { return this._width; }
    get height() { return this._height; }

    set x(value) {
        this._x = value;
        this.propertyChanged("x", value);
    }

    set y(value) {
        this._y = value;
        this.propertyChanged("y", value);
    }

    set width(value) {
        this._width = value;
        this.propertyChanged("width", value);
    }

    set height(value) {
        this._height = value;
        this.propertyChanged("height", value);
    }
}
