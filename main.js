// TODO: Prepend "Constants."
  const Constants = {
      SVG_NS: "http://www.w3.org/2000/svg",
      SVG_SURFACE_ID: "surface",
      SVG_TOOLBOX_SURFACE_ID: "toolboxSurface",
      SVG_OBJECTS_ID: "objects",
      SVG_TOOLBOX_ID: "toolbox",
      SVG_ANCHORS_ID: "anchors",
      SHAPE_CLASS_NAME: "svgShape",
      FILE_INPUT: "fileInput",
      OBJECT_GROUP_ID: "objectGroup",
      FILENAME: "diagram.json",
      TOOLBOX_RECTANGLE_ID: "toolboxRectangle",
      TOOLBOX_CIRCLE_ID: "toolboxCircle",
      TOOLBOX_DIAMOND_ID: "toolboxDiamond",
      TOOLBOX_LINE_ID: "toolboxLine",
      NEARBY_DELTA: 40,
      KEY_RIGHT: 39,
      KEY_UP: 38,
      KEY_LEFT: 37,
      KEY_DOWN: 40,
      KEY_DELETE: 46,
  };

const START_OF_DIAGRAM_TAG = "<diagram>";
const END_OF_DIAGRAM_TAG = "</diagram>";

// Must be lowercase "shapename" - "shapeName", as set in the toolbox controller, the DOM adds elements as lowercase!
// https://stackoverflow.com/a/6386486/2276361
const SHAPE_NAME_ATTR = "shapename";

// Global so UI can set the text of a text shape.
var mouseController = null;

// Global so we can access the surface translation.
var surfaceModel = null;

// Global so clearSvg can reset the objects translation
var objectsModel = null;

// AnchorGroupController is global for the moment because it's used by all shape controllers.
var anchorGroupController = null;

// Global so we can add/remove shape models as they are dropped / removed from the diagram.
var diagramModel = null;

// Global so we can move the toolbox around.
var toolboxGroupController = null;

document.getElementById(Constants.FILE_INPUT).addEventListener('change', readSingleFile, false);
document.onkeydown = onKeyDown;

// https://stackoverflow.com/a/1648854/2276361
// Read that regarding the difference between handling the event as a function
// vs in the HTML attribute definition.  Sigh.
function onKeyDown(evt) {
    var handled = mouseController.onKeyDown(evt);

    if (handled) {
        evt.preventDefault();
    }
}

// https://w3c.github.io/FileAPI/
// https://stackoverflow.com/questions/3582671/how-to-open-a-local-disk-file-with-javascript
// Loading the file after it has been loaded doesn't trigger this event again because it's
// hooked up to "change", and the filename hasn't changed!
function readSingleFile(e) {
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onload = loadComplete;
    reader.readAsText(file);
    // Clears the last filename(s) so loading the same file will work again.
    document.getElementById(Constants.FILE_INPUT).value = "";
}

function loadComplete(e) {
    var contents = e.target.result;
    // If we don't do this, it adds the elements, but they have to have unique ID's
    clearSvg();
    diagramModel.deserialize(contents);
}

function clearSvg() {
    mouseController.destroyAllButSurface();
    surfaceModel.setTranslation(0, 0);
    objectsModel.setTranslation(0, 0);
    diagramModel.clear();
    var node = Helpers.getElement(Constants.SVG_OBJECTS_ID);
    Helpers.removeChildren(node);
}

// https://stackoverflow.com/questions/23582101/generating-viewing-and-saving-svg-client-side-in-browser
function saveSvg() {
    var json = diagramModel.serialize();
    var blob = new Blob([json], { 'type': "image/json" });

    // We're using https://github.com/eligrey/FileSaver.js/
    // but with the "export" (a require node.js thing) removed.
    // There are several forks of this, not sure if there's any improvements in the forks.
    saveAs(blob, Constants.FILENAME);
}

// Update the selected shape's text.  Works only with text shapes right now.
function setText() {
    if (mouseController.selectedControllers != null) {
        var text = document.getElementById("text").value;
        mouseController.selectedControllers.map(c => c.model.text = text);
    }
}

function registerToolboxItem(mouseController, elementId, fncCreateController) {
    var svgElement = Helpers.getElement(elementId);
    var model = new Model();
    var view = new View(svgElement, model);
    var controller = fncCreateController(mouseController, view, model);
    mouseController.attach(view, controller);
}

(function initialize() {
    mouseController = new MouseController();
    diagramModel = new DiagramModel(mouseController);
    let svgSurface = Helpers.getElement(Constants.SVG_SURFACE_ID);
    let svgObjects = Helpers.getElement(Constants.SVG_OBJECTS_ID);
    let svgAnchors = Helpers.getElement(Constants.SVG_ANCHORS_ID);
    let toolboxSurface = Helpers.getElement(Constants.SVG_TOOLBOX_SURFACE_ID);
    let toolbox = Helpers.getElement(Constants.SVG_TOOLBOX_ID);

    surfaceModel = new SurfaceModel();
    objectsModel = new ObjectsModel();
    let anchorsModel = new Model();
    let toolboxSurfaceModel = new Model();

    let surfaceView = new SurfaceView(svgSurface, surfaceModel);
    let objectsView = new ObjectsView(svgObjects, objectsModel);
    let anchorsView = new AnchorView(svgAnchors, anchorsModel);
    let toolboxSurfaceView = new View(toolboxSurface, toolboxSurfaceModel);

    let surfaceController = new SurfaceController(mouseController, surfaceView, surfaceModel);
    let objectsController = new ObjectsController(mouseController, objectsView, objectsModel);
    anchorGroupController = new AnchorGroupController(mouseController, anchorsView, anchorsModel);

    // We need a controller to handle mouse events when the user moves the mouse fast enough on the toolbox to leave the shape being dragged and dropped, but it also needs to override onDrag because the toolbox can't be moved around.  TODO: At least, not at the moment.
    let toolboxSurfaceController = new ToolboxSurfaceController(mouseController, toolboxSurfaceView, toolboxSurfaceModel);

    // Attach both the surface and objects controller to the surface view so that events from the surface view are routed to both controllers, one for dealing with the grid, one for moving the objects on the surface and the surface is translated.
    mouseController.attach(surfaceView, surfaceController);
    mouseController.attach(surfaceView, objectsController);
    mouseController.attach(toolboxSurfaceView, toolboxSurfaceController);

    let toolboxModel = new Model();
    let toolboxView = new ToolboxView(toolbox, toolboxModel);
    toolboxGroupController = new ToolboxGroupController(mouseController, toolboxView, toolboxModel);
    // mouseController.attach(toolboxView, toolboxController);

    // Example of creating a shape programmatically:
    /*
      var rectEl = Helpers.createElement('rect', { x: 240, y: 100, width: 60, height: 60, fill: "#FFFFFF", stroke: "black", "stroke-width": 1 });
      var rectModel = new RectangleModel();
      rectModel._x = 240;
      rectModel._y = 100;
      rectModel._width = 60;
      rectModel._height = 60;
      var rectView = new ShapeView(rectEl, rectModel);
      var rectController = new RectangleController(mouseController, rectView, rectModel);
      Helpers.getElement(Constants.SVG_OBJECTS_ID).appendChild(rectEl);
      mouseController.attach(rectView, rectController);
      // Most shapes also need an anchor controller
      mouseController.attach(rectView, anchorGroupController);
    */

    // Create Toolbox Model-View-Controllers and register with mouse controller.
    registerToolboxItem(mouseController, Constants.TOOLBOX_RECTANGLE_ID,
                        (mc, view, model) => new ToolboxRectangleController(mc, view, model));
    registerToolboxItem(mouseController, Constants.TOOLBOX_CIRCLE_ID,
                        (mc, view, model) => new ToolboxCircleController(mc, view, model));
    registerToolboxItem(mouseController, Constants.TOOLBOX_DIAMOND_ID,
                        (mc, view, model) => new ToolboxDiamondController(mc, view, model));
    registerToolboxItem(mouseController, Constants.TOOLBOX_LINE_ID,
                        (mc, view, model) => new ToolboxLineController(mc, view, model));
})();
