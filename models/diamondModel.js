class DiamondModel extends PathModel {
    serialize() {
        var model = super.serialize();
        return { Diamond: model };
    }
}
