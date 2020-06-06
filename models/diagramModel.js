// This is a static object
class DiagramModel {
    constructor(mouseController) {
        this.mouseController = mouseController;
        this.models = [];
        // What is this shit?
        this.mvc = {
            Rectangle: { model: RectangleModel, view: ShapeView, controller: RectangleController, creator : () => this.createElement("rect") },
            Circle: { model: CircleModel, view: ShapeView, controller: CircleController, creator: () => this.createElement("circle") },
            Diamond: { model: DiamondModel, view: ShapeView, controller: DiamondController, creator: () => this.createElement("path") },
            Line: { model: LineModel, view: LineView, controller: LineController, creator: () => this.createLineElement() },
            Text: { model: TextModel, view: TextView, controller: TextController, creator: () => this.createTextElement() },
        };
    }

    clear() {this.models = [];}

    addModel(model, id) {
        this.models.push({ model: model, id: id });
    }

    removeShape(shapeId) {
        this.models = this.models.filter(m => m.id != shapeId);
    }

    createElement(elName) {
        var group = Helpers.createElement("g", {});
        var el = Helpers.createElement(elName, { fill: "#FFFFFF", stroke: "black", "stroke-width": 1 });
        group.appendChild(el);

        return group;
    }

    createTextElement() {
        var group = Helpers.createElement("g", {});
        var el = Helpers.createElement('text', { "font-size": 12, "font-family": "Verdana" });
        el.innerHTML = Constants.DEFAULT_TEXT;
        group.appendChild(el);

        return group;
    }

    createLineElement(elName) {
        var group = Helpers.createElement("g", {});
        var el = Helpers.createElement('g', {});
        el.appendChild(Helpers.createElement('line', {"stroke-width": 20, stroke: "black", "stroke-opacity": "0", "fill-opacity": "0" }));
        el.appendChild(Helpers.createElement('line', {fill: "#FFFFFF", stroke: "black", "stroke-width": 1 }));
        group.appendChild(el);

        return group;
    }

    // Returns JSON of serialized models.
    serialize() {
        var uberModel = [];
        var model = surfaceModel.serialize();
        model[Object.keys(model)[0]].id = Constants.SVG_SURFACE_ID;
        uberModel.push(model);

        this.models.map(m => {
            var model = m.model.serialize();
            model[Object.keys(model)[0]].id = m.id;
            uberModel.push(model);
        });

        return JSON.stringify({ model: uberModel });
    }

    // Creates an MVC for each model of the provided JSON.
    deserialize(jsonString) {
        var modelData = JSON.parse(jsonString);
        var models = modelData.model;
        var objectModels = [];
        surfaceModel.setTranslation(0, 0);
        objectsModel.setTranslation(0, 0);

        models.map(model => {
            var key = Object.keys(model)[0];
            var val = model[key];

            if (key == "Surface") {
                // Special handler for surface, we keep the existing MVC objects.
                // We set both the surface and objects translation, but the surface translation is mod'd by the gridCellW/H.
                surfaceModel.deserialize(val);
                objectsModel.setTranslation(surfaceModel.tx, surfaceModel.ty);
            } else {
                var model = new this.mvc[key].model();
                objectModels.push(model);
                var el = this.mvc[key].creator();
                // Create the view first so it hooks into the model's property change event.
                var view = new this.mvc[key].view(el, model);
                model.deserialize(val, el);
                view.id = val.id;
                var controller = new this.mvc[key].controller(mouseController, view, model);

                // Update our diagram's model collection.
                this.models.push({ model: model, id: val.id });

                Helpers.getElement(Constants.SVG_OBJECTS_ID).appendChild(el);
                this.mouseController.attach(view, controller);

                // shapes also need an anchor controller
                if (controller.shouldShowAnchors) {
                    this.mouseController.attach(view, anchorGroupController);
                }
            }
        });
    }
}
