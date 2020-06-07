class PathModel extends Model {
    constructor() {super(); this._d = null;}

    serialize() {
        let data = super.serialize();
        data.d = this._d;
        return data;
    }
    deserialize(data, el) {
        super.deserialize(data, el);
        this.d = data.d;
    }

    get d() { return this._d; }
    set d(value) {
        this._d = value;
        this.propertyChanged("d", value);
    }
}
