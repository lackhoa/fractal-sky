class RectangleController extends ShapeController {
    getULCorner() {
        var p = new Point(this.model.x, this.model.y);
        p = this.getAbsoluteLocation(p);

        return p;
    }

    getLRCorner() {
        var p = new Point(this.model.x + this.model.width, this.model.y + this.model.height);
        p = this.getAbsoluteLocation(p);

        return p;
    }

    topMove(dx, dy) {
        // Moving the top affects "y" and "height"
        var y = this.model.y + dy;
        var height = this.model.height - dy;
        this.model.y = y;
        this.model.height = height;
    }

    bottomMove(dx, dy) {
        // Moving the bottom affects only "height"
        var height = this.model.height + dy;
        this.model.height = height;
    }

    leftMove(dx, dy) {
        // Moving the left affects "x" and "width"
        var x = this.model.x + dx;
        var width = this.model.width - dx;
        this.model.x = x;
        this.model.width = width;
    }

    rightMove(dx, dy) {
        // Moving the right affects only "width"
        var width = this.model.width + dx;
        this.model.width = width;
    }
}
