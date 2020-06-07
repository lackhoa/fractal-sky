class GroupView {
    constructor(svgElement, model) {
        this.svgElement = svgElement;
        model.eventPropertyChanged = this.onPropertyChange.bind(this);
    }

    onPropertyChange(prop, val) {
        this.svgElement.setAttribute(prop, val);
    }

    get id() {return this.svgElement.getAttribute("id");}
    set id(val) {this.svgElement.setAttribute("id", val);}

    // Gets the ID of the first child, the "real" shape, of the group surrounding the shape.
    get actualId() {return this.actualElement.getAttribute("id");}
}

// This is the closest thing to the DOM
class ShapeView extends GroupView {
    // Anchors don't have a wrapping group so there are no child elements.
    get actualElement() {
        if (this.svgElement.firstElementChild == null) {
            return this.svgElement;
        } else {return this.svgElement.firstElementChild}
    }

    onPropertyChange(property, value) {
        // Property is usually "translate"
        // Every shape is grouped, so we want to update the property of the first child in the group.
        this.actualElement.setAttribute(property, value);
    }
}

class LineView extends ShapeView {
    onPropertyChange(property, value) {
        // A line consists of a transparent portion [0] with a larger stroke width than the visible line [1]
        this.svgElement.firstElementChild.children[0].setAttribute(property, value);
        this.svgElement.firstElementChild.children[1].setAttribute(property, value);
    }
}

class AnchorView extends GroupView {}
class ObjectsView extends GroupView {}
class SurfaceView extends GroupView {}
class ToolboxSurfaceView extends GroupView {}
class ToolboxView extends GroupView {}
