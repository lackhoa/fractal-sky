class SurfaceController extends Controller {
    constructor(state, surfaceView, surfaceModel) {
        super(state, surfaceView, surfaceModel);
    }

    get isSurfaceController() {return true;}

    get hasConnectionPoints() {return false;}

    // overrides Controller.onDrag
    onDrag(dx, dy) {
        this.model.updateTranslation(dx, dy);
        let [mdx, mdy] = [this.model.tx % this.model.gridCellW,
                          this.model.ty % this.model.gridCellH];
        this.model.setTranslate(mdx, mdy);
    }

    onMouseLeave() {this.state.clearSelectedObject();}
}
