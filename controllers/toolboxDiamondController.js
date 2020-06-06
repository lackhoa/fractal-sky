class ToolboxDiamondController extends ToolboxShapeController {
    constructor(state, view, model) {
        super(state, view, model);
    }

    // For drag and drop
    createElementAt(x, y) {
        let points = [{ cmd: "M", x: x - 15, y: y - 30 }, { cmd: "L", x: x - 45, y: y }, { cmd: "L", x: x - 15, y: y + 30 }, { cmd: "L", x: x + 15, y: y }];
        let path = points.reduce((acc, val) => acc = acc + val.cmd + " " + val.x + " " + val.y, "") + " Z";
        let group = Helpers.createElement("g", {}, false);
        let el = Helpers.createElement('path', { d: path, stroke: "black", "stroke-width": 1, fill: "#FFFFFF" });
        group.appendChild(el);

        let model = new DiamondModel();
        model._d = path;
        let view = new ShapeView(group, model);
        let controller = new DiamondController(this.state, view, model);

        return { el: group, model: model, view: view, controller: controller };
    }
}
