class ToolboxCircleController extends ToolboxShapeController {
    constructor(mouseController, view, model) {
        super(mouseController, view, model);
    }

    createElementAt(x, y) {
        let group = Helpers.createElement("g", {}, false);
        let el = Helpers.createElement('circle', { cx: x, cy: y, r:30, fill: "#FFFFFF", stroke: "black", "stroke-width": 1 });
        group.appendChild(el);
        let model = new CircleModel();
        model._cx = x;
        model._cy = y;
        model._r = 30;
        let view = new ShapeView(group, model);
        let controller = new CircleController(this.mouseController, view, model);
        return { el: group, model: model, view: view, controller: controller };
    }
}
