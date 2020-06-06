class CircleController extends ShapeController {
    getAnchors() {
        let corners = this.getCorners();
        let middleTop = new Point((corners[0].x + corners[1].x) / 2, corners[0].y);
        let middleBottom = new Point((corners[0].x + corners[1].x) / 2, corners[1].y);
        let middleLeft = new Point(corners[0].x, (corners[0].y + corners[1].y) / 2);
        let middleRight = new Point(corners[1].x, (corners[0].y + corners[1].y) / 2);

        return [
            { anchor: middleTop, onDrag: this.topMove.bind(this) },
            { anchor: middleBottom, onDrag: this.bottomMove.bind(this) },
            { anchor: middleLeft, onDrag: this.leftMove.bind(this) },
            { anchor: middleRight, onDrag: this.rightMove.bind(this) }
        ];
    }

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

    topMove(anchors, anchor, dx, dy) {
        this.changeRadius(-dy);
        this.moveAnchor(anchors[0], 0, dy);
        this.moveAnchor(anchors[1], 0, -dy);
        this.moveAnchor(anchors[2], dy, 0);
        this.moveAnchor(anchors[3], -dy, 0);
    }

    bottomMove(anchors, anchor, dx, dy) {
        this.changeRadius(dy);
        this.moveAnchor(anchors[0], 0, -dy);
        this.moveAnchor(anchors[1], 0, dy);
        this.moveAnchor(anchors[2], -dy, 0);
        this.moveAnchor(anchors[3], dy, 0);
    }

    leftMove(anchors, anchor, dx, dy) {
        this.changeRadius(-dx);
        this.moveAnchor(anchors[0], 0, dx);
        this.moveAnchor(anchors[1], 0, -dx);
        this.moveAnchor(anchors[2], dx, 0);
        this.moveAnchor(anchors[3], -dx, 0);
    }

    rightMove(anchors, anchor, dx, dy) {
        this.changeRadius(dx);
        this.moveAnchor(anchors[0], 0, -dx);
        this.moveAnchor(anchors[1], 0, dx);
        this.moveAnchor(anchors[2], -dx, 0);
        this.moveAnchor(anchors[3], dx, 0);
    }

    changeRadius(amt) {
        this.model.r = this.model.r + amt;
    }
}
