﻿class CircleModel extends ShapeModel {
    constructor() {
        super();
        this._cx = 0;
        this._cy = 0;
        this._r = 0;
    }

    serialize() {
        var model = super.serialize();
        model.cx = this._cx;
        model.cy = this._cy;
        model.r = this._r;

        return { Circle: model };
    }

    deserialize(model, el) {
        super.deserialize(model, el);
        this.cx = model.cx;
        this.cy = model.cy;
        this.r = model.r;
    }

    get cx() { return this._cx; }
    get cy() { return this._cy; }
    get r() { return this._r; }

    set cx(value) {
        this._cx = value;
        this.propertyChanged("cx", value);
    }

    set cy(value) {
        this._cy = value;
        this.propertyChanged("cy", value);
    }

    set r(value) {
        this._r = value;
        this.propertyChanged("r", value);
    }
}