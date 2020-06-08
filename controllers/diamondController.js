class DiamondController extends ShapeController {
    getConnectionPoints() {
        var corners = this.getCorners();
        var middleTop = new Point((corners[0].x + corners[1].x) / 2, corners[0].y);
        var middleBottom = new Point((corners[0].x + corners[1].x) / 2, corners[1].y);
        var middleLeft = new Point(corners[0].x, (corners[0].y + corners[1].y) / 2);
        var middleRight = new Point(corners[1].x, (corners[0].y + corners[1].y) / 2);

        var connectionPoints = [
            { connectionPoint: middleTop },
            { connectionPoint: middleBottom },
            { connectionPoint: middleLeft },
            { connectionPoint: middleRight }
        ];

        return connectionPoints;
    }

    getULCorner() {
        var rect = this.view.svgElement.getBoundingClientRect();
        var p = new Point(rect.left, rect.top);
        p = Helpers.translateToSvgCoordinate(p);

        return p;
    }

    getLRCorner() {
        var rect = this.view.svgElement.getBoundingClientRect();
        var p = new Point(rect.right, rect.bottom);
        p = Helpers.translateToSvgCoordinate(p);

        return p;
    }

    topMove(dx, dy) {
        var ulCorner = this.getULCorner();
        var lrCorner = this.getLRCorner();
        this.changeHeight(ulCorner, lrCorner, -dy);
    }

    bottomMove(dx, dy) {
        var ulCorner = this.getULCorner();
        var lrCorner = this.getLRCorner();
        this.changeHeight(ulCorner, lrCorner, dy);
    }

    leftMove(dx, dy) {
        var ulCorner = this.getULCorner();
        var lrCorner = this.getLRCorner();
        this.changeWidth(ulCorner, lrCorner, -dx);
    }

    rightMove(dx, dy) {
        var ulCorner = this.getULCorner();
        var lrCorner = this.getLRCorner();
        this.changeWidth(ulCorner, lrCorner, dx);
    }

    changeWidth(ulCorner, lrCorner, dx) {
        ulCorner.x -= dx;
        lrCorner.x += dx;
        this.updatePath(ulCorner, lrCorner);
    }

    changeHeight(ulCorner, lrCorner, dy) {
        ulCorner.y -= dy;
        lrCorner.y += dy;
        this.updatePath(ulCorner, lrCorner);
    }

    updatePath(ulCorner, lrCorner) {
        // example path: d: "M 240 100 L 210 130 L 240 160 L 270 130 Z"
        var ulCorner = this.getRelativeLocation(ulCorner);
        var lrCorner = this.getRelativeLocation(lrCorner);
        var mx = (ulCorner.x + lrCorner.x) / 2;
        var my = (ulCorner.y + lrCorner.y) / 2;
        var path = "M " + mx + " " + ulCorner.y;
        path = path + " L " + ulCorner.x + " " + my;
        path = path + " L " + mx + " " + lrCorner.y;
        path = path + " L " + lrCorner.x + " " + my;
        path = path + " Z"
        this.model.d = path;
    }
}
