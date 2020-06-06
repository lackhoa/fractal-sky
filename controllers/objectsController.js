class ObjectsController extends Controller {
    get isSurfaceController() {return true;}
    get hasConnectionPoints() {return false;}

    // Override: There's no mouse events attached to the view of the "objects" SVG element!
    wireUpEvents() { }
}
