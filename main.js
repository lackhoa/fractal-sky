'use strict';
let e = React.createElement;
let i = Immutable;
let log = console.log;

// TODO: Prepend "Constants."
let SVG_NS = "http://www.w3.org/2000/svg";

const START_OF_DIAGRAM_TAG = "<diagram>";
const END_OF_DIAGRAM_TAG = "</diagram>";

// Must be lowercase "shapename" - "shapeName", as set in the toolbox controller, the DOM adds elements as lowercase!
// https://stackoverflow.com/a/6386486/2276361
const SHAPE_NAME_ATTR = "shapename";

// Global so UI can set the text of a text shape.
var state = null;

// Global so we can access the surface translation.
var surfaceModel = null;

// Global so clearSvg can reset the objects translation
var objectsModel = null;

// Global so we can add/remove shape models as they are dropped / removed from the diagram.
var diagramModel = null;

// Global so we can move the toolbox around.
var toolboxGroupController = null;

// Handle keyDown events
// https://stackoverflow.com/a/1648854/2276361
// Read that regarding the difference between handling the event as a function vs in the HTML attribute definition.
function onKeyDown(evt) {
}
document.onkeydown = onKeyDown;

// https://w3c.github.io/FileAPI/
// https://stackoverflow.com/questions/3582671/how-to-open-a-local-disk-file-with-javascript
// Loading the file after it has been loaded doesn't trigger this event again because it's hooked up to "change", and the filename hasn't changed!
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
    state.destroyAllButSurface();
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

function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g,
                                                        c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
}

function translate(model, tx, ty) {
    let [a,b,c,d,e,f] = model.get("transform") || [1,0,0,1,0,0];
    // Note that translation is scaled along with the transformation matrix
    return model.set("transform", [a,b,c,d, e+tx, f+ty]);
}

function cssMatrix(matrix) {  // `matrix` is a 6-array
    return `matrix(${matrix.join(" ")})`
}

function shapeToCpn(model) {
    // The model is just the tag + the props of the component, but with readable transform, and also immutable
    let m = model.toJS();
    let xform = m.transform;
    // convert transform to CSS
    if (xform) {m.transform = cssMatrix(xform);}
    let type = m.type; delete m.type;
    return e(type, m);
}

let smallGrid = e("pattern",
                  {id:"smallGrid",
                   width:8, height:8, patternUnits:"userSpaceOnUse"},
                  e("path",
                    {id:"smallGridPath", d:"M 8 0 H 0 V 8", fill:"none",
                     stroke:"gray", strokeWidth:"0.5"}));

let largeGrid = e("pattern", {id:"largeGrid",
                              width:80, height:80, patternUnits:"userSpaceOnUse"},
                  e("rect", {id:"largeGridRect", width:80, height:80,
                             fill:"url(#smallGrid)"}),
                  e("path", {id:"largeGridPath", d:"M 80 0 H 0 V 80",
                             fill:"none", stroke:"#AAAAAA", strokeWidth:2}));

let commonShape = i.fromJS({fill:"transparent", stroke:"black",
                            style: {cursor:"move"},
                            vectorEffect: "non-scaling-stroke"});
let rect = commonShape.merge({type:"rect", width:1, height:1,
                              transform: [100, 0, 0, 100, 0, 0]});
let circle = commonShape.merge({type:"circle", cx:0.5, cy:0.5, r:0.5,
                                transform: [100, 0, 0, 100, 0, 0]});

// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
class App extends React.Component {
    constructor(props) {
        super(props);
        // `state` (rather `state.data`) must be immutable, we cannot afford it to change EVER (by React)!
        this.state = {data: i.fromJS({shapes: {},  // Maps from ids to shape models
                                      xform: [1,0,0,1,0,0],  // viewport transform
                                      mouseDown: null,  // stores mouse down position
                                      focused: null,  // Focused shape id
                                     })};
        this.rect = this.bindControl(rect);
        this.circle = this.bindControl(circle);
    }

    bindControl(model) {
        // Let the app control everything
        return model.merge({onMouseDown: (evt) => this.onMouseDown(evt),
                            onMouseMove: (evt) => this.onMouseMove(evt),
                            onMouseUp: (evt) => this.onMouseUp(evt)});
    }

    // My replacement of "setState"
    imSetState(data) {this.setState({data: data})}


    onMouseDown(evt) {
        let data = this.state.data;
        let pos = [evt.clientX, evt.clientY];
        this.imSetState(data.merge({mouseDown: pos,
                                    focused: evt.target.id}));
    }

    onMouseMove(evt) {
        let data = this.state.data;
        let mouseDown = data.get("mouseDown");
        // If dragging, move the focused shape
        if (mouseDown) {
            let [x0,y0] = mouseDown;
            let [x,y] = [evt.clientX, evt.clientY];
            let data1 = data.set("mouseDown", [x,y]);  // Update the mouse for future dragging
            let focused = data.get("focused");
            if (focused == "grid") {
                let [a,b,c,d,e,f] = data.get("xform");
                this.imSetState(data1.merge({xform: [a,b,c,d,
                                                     (e+(x-x0)),
                                                     (f+(y-y0))]}));
            } else {
                this.imSetState(data1.updateIn(["shapes", focused],
                                               (shape) => translate(shape, x-x0, y-y0)));
            }
        }
    }

    onMouseUp(evt) {
        let data = this.state.data;
        this.imSetState(data.merge({mouseDown: null}));
    }

    // Adding a shape from the original model
    addShape(model) {
        let data = this.state.data;
        let shapes = data.get("shapes");
        let [a,b,c,d,tx,ty] = data.get("xform");
        // Create an identity and associate it to a new shape model
        let key = uuidv4();
        // Randomize spawn location
        let [rx,ry] = [(Math.random())*20, (Math.random())*20];
        // set `key` so it'll be available on the Virtual-DOM, but set `id` so it goes to the real DOM
        let shape = translate(model,-tx+rx,-ty+ry).merge({key:key, id:key});
        this.imSetState(data.merge({shapes: shapes.set(key, shape)}));
    }

    render() {
        let data = this.state.data;
        let shapes = data.get("shapes");
        // Shapes that are actually rendered on the screen
        let cpns = shapes.valueSeq().map(shapeToCpn).toJS();

        return e(React.Fragment, {},
                 // Controls
                 e("div", {id:"controls"},
                   e("button", {onClick: (evt) => {this.addShape(this.rect)}},
                     "Rectangle"),
                   e("button", {onClick: (evt) => {this.addShape(this.circle)}},
                     "Circle")),

                 // The svg group, storing the whole digram
                 e("svg", {id:"svg", width:801, height:481, xmlns:SVG_NS,},
                   e("g", {id:"surface",
                           x:-80, y:-80, width:961, heigth:641,},
                     e("defs", {id:"defs"}, smallGrid, largeGrid),
                     e("rect", {id:"grid", x:-80, y:-80, width:961, height: 641,
                                transform: cssMatrix(data.get("xform")),
                                fill: "url(#largeGrid)",
                                // The grid is subject to zooming & panning
                                onMouseUp: (evt) => this.onMouseUp(evt),
                                onMouseMove: (evt) => this.onMouseMove(evt),
                                onMouseDown: (evt) => this.onMouseDown(evt),
                               })),
                   // The shapes
                   e("g", {id:"objects",
                           transform: cssMatrix(data.get("xform"))},
                     cpns)));
    }
}

let domContainer = document.getElementById("app");
ReactDOM.render(e(App), domContainer);

// Shape modification: ids for the control points are lists: the control is centralized, as usual
// Change viewport size depending on the device
// Implement zooming & panning: we can steal it from some libraries, it only needs to operate on the SVG data: https://github.com/chrvadala/react-svg-pan-zoom
