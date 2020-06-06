class ToolboxRectangleController extends ToolboxShapeController {
    constructor(state, view, model) {
        super(state, view, model);
    }

    createElementAt(x, y) {
        var group = Helpers.createElement("g", {}, false);
        var el = Helpers.createElement('rect', { x: x - 30, y: y - 30, width: 60, height: 60, fill: "#FFFFFF", stroke: "black", "stroke-width": 1 });
        group.appendChild(el);
        var model = new RectangleModel();
        model._x = x - 30;
        model._y = y - 30;
        model._width = 60;
        model._height = 60;
        var view = new ShapeView(group, model);
        var controller = new RectangleController(this.state, view, model);

        return { el: group, model: model, view: view, controller: controller };
    }
}
