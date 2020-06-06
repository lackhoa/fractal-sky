class Controller {  // Receives user input, route it to model, then update the view
    // Of course we cannot forget the almighty "mouseController"
    constructor(mouseController, view, model) {
        this.mouseController = mouseController;
        this.view = view;
        this.model = model;
        this.events = [];
        this.wireUpEvents();
    }

    get isSurfaceController() {return false;}
    get isAnchorController() {return false;}
    get isToolboxShapeController() {return false;}
    get shouldShowAnchors() {return true;}
    get hasConnectionPoints() {return true;}

    registerEvent(element, eventName, callbackRef) {
        this.events.push({ element: element, eventName: eventName,
                           callbackRef: callbackRef });
    }

    destroy() {this.unhookEvents();}

    registerEventListener(element, eventName, callback, self) {
        if (self == null || self === undefined) {self = this;}
        var ref = callback.bind(self);
        element.addEventListener(eventName, ref);
        this.registerEvent(element, eventName, ref);
    }

    unhookEvents() {
        for (var i = 0; i < this.events.length; i++) {
            var event = this.events[i];
            event.element.removeEventListener(event.eventName, event.callbackRef);
        }

        this.events = [];
    }

    wireUpEvents() {
        this.registerEventListener(this.view.svgElement, "mousedown", this.mouseController.onMouseDown, this.mouseController);
        this.registerEventListener(this.view.svgElement, "mouseup", this.mouseController.onMouseUp, this.mouseController);
        this.registerEventListener(this.view.svgElement, "mousemove", this.mouseController.onMouseMove, this.mouseController);
        this.registerEventListener(this.view.svgElement, "mouseenter", this.mouseController.onMouseEnter, this.mouseController);
        this.registerEventListener(this.view.svgElement, "mouseleave", this.mouseController.onMouseLeave, this.mouseController);
    }

    getAbsoluteLocation(p) {// I like how this changes its parameter
        p = p.translate(this.model.tx, this.model.ty);
        p = p.translate(surfaceModel.tx, surfaceModel.ty);
        return p;
    }

    getRelativeLocation(p) {
        p = p.translate(-this.model.tx, -this.model.ty);
        p = p.translate(-surfaceModel.tx, -surfaceModel.ty);
        return p;
    }

    // Routed from mouse controller:
    onMouseEnter() { }
    onMouseLeave() { }
    onMouseDown() { }
    onMouseUp() { }
    onDrag(dx, dy) {this.model.translate(dx, dy)}
}
