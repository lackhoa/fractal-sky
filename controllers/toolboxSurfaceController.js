class ToolboxSurfaceController extends Controller {
    get isSurfaceController() {
        return true;
    }

    get hasConnectionPoints() {
        return false;
    }

    onDrag(dx, dy) {
        toolboxGroupController.onDrag(dx, dy);
    }
}
