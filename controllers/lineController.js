class LineController extends ShapeController {
    onDrag(dx, dy) {super.onDrag(dx, dy);}

    translateEndpoint(idx, dx, dy) {
        switch (idx) {
        case 0:
            var p = new Point(this.model.x1, this.model.y1);
            p = p.translate(dx, dy);
            this.model.x1 = p.x;
            this.model.y1 = p.y;
            break;
        case 1:
            var p = new Point(this.model.x2, this.model.y2);
            p = p.translate(dx, dy);
            this.model.x2 = p.x;
            this.model.y2 = p.y;
            break;
        }
    }

    getULCorner() {
        var p = new Point(this.model.x1, this.model.y1);
        p = this.getAbsoluteLocation(p);
        return p;
    }

    getLRCorner() {
        var p = new Point(this.model.x2, this.model.y2);
        p = this.getAbsoluteLocation(p);
        return p;
    }

    // Move the (x1, y1) coordinate.
    moveULCorner(dx, dy) {
        this.model.x1 = this.model.x1 + dx;
        this.model.y1 = this.model.y1 + dy;
    }

    // Move the (x2, y2) coordinate.
    moveLRCorner(dx, dy) {
        this.model.x2 = this.model.x2 + dx;
        this.model.y2 = this.model.y2 + dy;
    }
}
