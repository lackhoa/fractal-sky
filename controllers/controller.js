class Controller {  // Receives user input, route it to model, then update the view
    // Controllers coordinate through the state
    constructor(state, view, model) {
        this.state = state;
        this.view = view;
        this.model = model;
        this.events = [];
        // Wire up events
        this.wireUpEvents();
    }

    get isSurfaceController() {return false;}
    get isToolboxShapeController() {return false;}

    destroy() {this.unhookEvents();}

    // This is the function that registers the events for the DOM elements!
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


    /** The shape itself is translated since it is grouped under the surface */
    getAbsoluteLocation(p) {// I like how it changes its parameter
        p = p.translate(this.model.tx, this.model.ty);
        p = p.translate(surfaceModel.tx, surfaceModel.ty);
        return p;
    }

    getRelativeLocation(p) {
        p = p.translate(-this.model.tx, -this.model.ty);
        p = p.translate(-surfaceModel.tx, -surfaceModel.ty);
        return p;
    }

    // Routed from the state:
    onMouseEnter() { }
    onMouseLeave() { }
    onMouseDown() { }
    onMouseUp() { }
    onDrag(dx, dy) {this.model.translate(dx, dy)}

    wireUpEvents () {
        let el = this.view.svgElement;
        let state = this.state;
        // Route the DOM element's state to be handled by the state, that's it!
        // I should call the state "the main controller"
        this.registerEventListener(el, "mousedown", state.onMouseDown, state);
        this.registerEventListener(el, "mouseup", state.onMouseUp, state);
        this.registerEventListener(el, "mousemove", state.onMouseMove, state);
        this.registerEventListener(el, "mouseenter", state.onMouseEnter, state);
        this.registerEventListener(el, "mouseleave", state.onMouseLeave, state);
    }
}
