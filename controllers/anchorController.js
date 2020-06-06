// Anchors know about their shape controller, so when they're dragged, the shape controller will handle the resizing
class AnchorController extends Controller {
    constructor(state, view, model, shapeController, fncDragAnchor, anchorIdx) {
        super(state, view, model);
        this.fncDragAnchor = fncDragAnchor;
        this.anchorIdx = anchorIdx;
    }

    get isAnchorController() {return true;}

    // We don't show anchors for anchors.
    // This wouldn't happen anyways because no anchors are returned,
    // but having this flag is a minor performance improvement, maybe.
    get shouldShowAnchors() {return false;}

    onDrag(dx, dy) {
        // Call into the shape controller to handle the specific anchor drag.
        this.fncDragAnchor(dx, dy);
    }
}
