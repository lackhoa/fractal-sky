class Controller {  // Receives user input, route it to model, then update the view
    // Controllers are not separate, since they must know about the state (eg whether or not the mouse is down)
    constructor(state, view, model) {
        this.state = state;
        this.view = view;
        this.model = model;
        this.events = [];
        // Wire up events
        this.wireUpEvents();
    }

    get isSurfaceController() {return false;}
    get isAnchorController() {return false;}
    get isToolboxShapeController() {return false;}
    get shouldShowAnchors() {return true;}
    get hasConnectionPoints() {return true;}


    destroy() {this.unhookEvents();}

    // This is the function that registers the events!
    registerEventListener(element, eventName, callback, self) {
        if (self == null || self === undefined) {self = this;}
        var ref = callback.bind(self);
        element.addEventListener(eventName, ref);
        this.events.push({ element: element,
                           eventName: eventName,
                           callbackRef: ref });
    }

    unhookEvents() {
        for (var i = 0; i < this.events.length; i++) {
            var event = this.events[i];
            event.element.removeEventListener(event.eventName, event.callbackRef);
        }

        this.events = [];
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

    wireUpEvents () {
        let el = this.view.svgElement;
        let state = this.state;
        // Basically let the state handles everything, the end!
        this.registerEventListener(el, "mousedown", state.onMouseDown, state);
        this.registerEventListener(el, "mouseup", state.onMouseUp, state);
        this.registerEventListener(el, "mousemove", state.onMouseMove, state);
        this.registerEventListener(el, "mouseenter", state.onMouseEnter, state);
        this.registerEventListener(el, "mouseleave", state.onMouseLeave, state);
    }
}
