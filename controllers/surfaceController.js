class SurfaceController extends Controller {
    constructor(state, surfaceView, surfaceModel) {
        super(state, surfaceView, surfaceModel);
    }

    get isSurfaceController() {return true;}

    get hasConnectionPoints() {return false;}

    // overrides Controller.onDrag
    onDrag(dx, dy) {
        this.model.updateTranslation(dx, dy);
        var dx = this.model.tx % this.model.gridCellW;
        var dy = this.model.ty % this.model.gridCellH;
        this.model.setTranslate(dx, dy);
    }

    onMouseLeave() {this.state.clearSelectedObject();}
}
