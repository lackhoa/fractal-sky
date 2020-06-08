class CircleController extends ShapeController {
    getULCorner() {
        var p = new Point(this.model.cx - this.model.r, this.model.cy - this.model.r);
        p = this.getAbsoluteLocation(p);

        return p;
    }

    getLRCorner() {
        var p = new Point(this.model.cx + this.model.r, this.model.cy + this.model.r);
        p = this.getAbsoluteLocation(p);

        return p;
    }

    topMove(dx, dy) {
        this.changeRadius(-dy);
    }

    bottomMove(dx, dy) {
        this.changeRadius(dy);
    }

    leftMove(dx, dy) {
        this.changeRadius(-dx);
    }

    rightMove(dx, dy) {
        this.changeRadius(dx);
    }

    changeRadius(amt) {
        this.model.r = this.model.r + amt;
    }
}
