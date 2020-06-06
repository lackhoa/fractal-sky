// The shape controller handles showing the anchors and other decorations.
class ShapeController extends Controller {
    constructor(mouseController, shapeView, shapeModel) {
        super(mouseController, shapeView, shapeModel);
    }

    // Not all shapes have anchors.
    getAnchors() {return [];}
    getCorners() {return [this.getULCorner(), this.getLRCorner()];}

    onDrag(dx, dy) {super.onDrag(dx, dy);}

    onMouseEnter() {
        if (!this.mouseController.mouseDown && this.shouldShowAnchors) {
            // If the user is dragging another shape, then don't show anchor
            anchorGroupController.showAnchors(this);
        }
    }

    // If we're showing the anchors, moving the mouse on top of an anchor will cause the current shape to leave, which will erase the anchors!  We handle this situation in the mouse controller.
    onMouseLeave() {
        if (this.shouldShowAnchors) {
            anchorGroupController.removeAnchors();
        }
    }

    moveAnchor(anchor, dx, dy) {anchor.translate(dx, dy);}
    adjustAnchorX(anchor, dx) {anchor.translate(dx, 0);}
    adjustAnchorY(anchor, dy) {anchor.translate(0, dy);}
}
