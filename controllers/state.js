const LEFT_MOUSE_BUTTON = 0;
const TOOLBOX_DRAG_MIN_MOVE = 3;

// This is not a controller in the MVC sense, it doesn't even control only mouse!
// It's the "omniponent" object that is shared everywhere, a kind of "coordinator"
class State {
    constructor() {
        this.mouseDown = false;
        this.controllers = {};
        // Active controllers is not null when we're selecting a shape (mouse down on it)
        // When we're dragging a shape, the active controllers is the shape. But if we just hover on it, it's null.
        this.activeControllers = [];
        this.currentHoverControllers = [];
        this.leavingId = -1;
        this.draggingToolboxShape = false;
        this.selectedControllers = null;
        this.selectedShapeId = null;
        this.hoverShapeId = null;

        // We can't use movementX and movementY of the event because when the user moves the mouse quickly, the move events switch from the shape to the surface (or another shape)
        this.x = 0; this.y = 0;
        this.dx = 0; this.dy = 0;
    }

    // Each view is attached to many controllers
    attach(view, controller) {
        let id = view.id;
        if (this.controllers[id] == undefined) {
            this.controllers[id] = [];
        }
        this.controllers[id].push(controller);
    }

    // Compare functions detach with destroyAll.

    // Detach all controllers associated with this view.
    detach(view) {delete this.controllers[view.id];}
    detachAll() {this.controllers = {};}
    destroy(view) {
        var id = view.id;
        this.controllers[id].map(controller=>controller.destroy());
        delete this.controllers[id];
    }

    destroyShapeById(id) {
        this.controllers[id].map(controller => controller.destroy());
        delete this.controllers[id];
    }

    // Detaches all controllers and unwires events associated with the controller.
    destroyAll() {
        this.controllers.map(ctr => ctr.map(v => v.destroy()));
        this.controllers = {};
    }

    destroyAllButSurface() {
        Object.entries(this.controllers).map(([key, val]) => {
            val.map(v => {
                // Don't remove surface, toolbox, objects group, or toolbox shapes.
                if (!v.isSurfaceController && !v.isToolboxShapeController) {
                    v.destroy();
                    // Hopefully deleting the dictionary entry while iterating won't be a disaster since we called Object.entries!
                    delete this.controllers[key];
                }
            });
        });
    }

    get isClick() {
        // See if the mouse event is a click or a drag
        let [dX, dY] = [(this.startDownX - this.x), (this.startDownY - this.y)];
        return ((Math.abs(dX) < TOOLBOX_DRAG_MIN_MOVE) &&
                (Math.abs(dY) < TOOLBOX_DRAG_MIN_MOVE));
    }

    onKeyDown(evt) {
        let isOverShape = (this.hoverShapeId != null);
        var handled = false;

        if (isOverShape) {
            switch (evt.keyCode) {
            case Constants.KEY_RIGHT:
                this.currentHoverControllers.map(c => c.onDrag(1, 0));
                handled = true;
                break;
            case Constants.KEY_UP:
                this.currentHoverControllers.map(c => c.onDrag(0, -1));
                handled = true;
                break;
            case Constants.KEY_LEFT:
                this.currentHoverControllers.map(c => c.onDrag(-1, 0));
                handled = true;
                break;
            case Constants.KEY_DOWN:
                this.currentHoverControllers.map(c => c.onDrag(0, 1));
                handled = true;
                break;
            case Constants.KEY_DELETE:
                // Mouse is "leaving" the control
                this.currentHoverControllers.map(c => c.onMouseLeave());
                // Remove shape from diagram model, and all connections of this shape.
                diagramModel.removeShape(this.hoverShapeId);
                // Remove shape from state and detach events.
                this.destroyShapeById(this.hoverShapeId);
                // Remove from "objects" collection.
                var el = Helpers.getElement(this.hoverShapeId);
                el.parentNode.removeChild(el);
                // Cleanup.
                this.currentHoverControllers = [];
                this.hoverShapeId = null;
                handled = true;
                break;
            }
        }

        return isOverShape && handled;
    }

    // Get the controller associated with the event and remember where the user clicked.
    onMouseDown(evt) {
        if (evt.button == LEFT_MOUSE_BUTTON) {
            evt.preventDefault();
            var id = evt.currentTarget.getAttribute("id");
            this.selectedShapeId = id;
            if (this.controllers[id] != null) {
                this.activeControllers = this.controllers[id];
            } else { this.activeControllers = []; }
            this.selectedControllers = this.controllers[id];
            this.mouseDown = true;
            this.startDownX = evt.clientX;
            this.startDownY = evt.clientY;
            this.x = evt.clientX;
            this.y = evt.clientY;
            for (let c of this.activeControllers) {
                c.onMouseDown();
            }
        }
    }

    // If the user is dragging, call the controller's onDrag function.
    onMouseMove(evt) {
        evt.preventDefault();
        if (this.mouseDown && this.activeControllers != []) {
            this.dx = evt.clientX - this.x;
            this.dy = evt.clientY - this.y;
            this.x = evt.clientX;
            this.y = evt.clientY;
            for (let c of this.activeControllers) {
                c.onDrag(this.dx, this.dy);
            }
        }
    }

    onMouseUp(evt) {
        evt.preventDefault();
        if (evt.button == LEFT_MOUSE_BUTTON && this.activeControllers != []) {
            this.selectedShapeId = null;
            this.x = evt.clientX;
            this.y = evt.clientY;
            this.activeControllers.map(c => c.onMouseUp(this.isClick));
            this.clearSelectedObject();

            if (this.draggingToolboxShape) {
                // shapeBeingDraggedAndDropped is set by the ToolboxShapeController.
                // We preserve this shape in case the user releases the mouse button while the mouse is over a different shape (like the surface) as a result of a very fast drag & drop where the shape hasn't caught up with the mouse, or the mouse is outside of shape's boundaries.
                this.finishDragAndDrop(this.shapeBeingDraggedAndDropped, evt.currentTarget);
            }
        }
    }

    onMouseEnter(evt) {
        evt.preventDefault();
        let id = evt.currentTarget.getAttribute("id");
        this.hoverShapeId = id;

        if (this.mouseDown) {
            // Dragging , so ignore shapes we enter and leave
        } else {  // Hover management.
            if (this.leavingId != -1) {
                console.log("Leaving " + this.leavingId);
                for (let c of this.currentHoverControllers) {
                    c.onMouseLeave();
                }
                let ctrlNames = this.controllers[id].map(ctrl=>ctrl.constructor.name).join(", ")
                console.log(`Entering view ${id} => controllers ${ctrlNames}`);
                // Tell the new shape that we're entering.
                this.currentHoverControllers = this.controllers[id];
                for (let c of this.currentHoverControllers) {
                    c.onMouseEnter();
                }
            }
        }
    }

    onMouseLeave(evt) {
        evt.preventDefault();
        this.leavingId = evt.currentTarget.getAttribute("id");
        this.hoverShapeId = null;
    }

    // Returns the controllers associated with the SVG element.
    getControllers(evt) {
        let id = evt.currentTarget.getAttribute("id");
        return this.controllers[id];
    }

    getControllersById(id) {return this.controllers[id];}

    getControllersByElement(el) {
        let id = el.getAttribute("id");
        return this.getControllersById(id);
    }

    clearSelectedObject() {
        this.mouseDown = false;
        this.activeControllers = [];
    }

    // Move the shape out of the toolbox group and into the objects group.
    // This requires dealing with surface translation.
    finishDragAndDrop(elDropped, elCurrent) {
        // Remove from toolbox group, translate, add to objects group.
        Helpers.getElement(Constants.SVG_TOOLBOX_ID).removeChild(elDropped);
        let id = elDropped.getAttribute("id");
        for (let c of this.controllers[id]) {
            c.model.translate(-surfaceModel.tx + toolboxGroupController.model.tx,
                              -surfaceModel.ty + toolboxGroupController.model.ty);
        }
        Helpers.getElement(Constants.SVG_OBJECTS_ID).appendChild(elDropped);

        this.draggingToolboxShape = false;
    }
}
