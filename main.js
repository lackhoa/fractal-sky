'use strict';
let e = React.createElement;
let { useState, useCallback, useMemo } = React;
let log = console.log;

// TODO: Prepend "Constants."
let SVG_NS = "http://www.w3.org/2000/svg";
let [W, H] = [801, 481];

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
    let [a,b,c,d,e,f] = model.transform || [1,0,0,1,0,0];
    // Note that translation is scaled along with the transformation matrix
    return {...model, transform: [a,b,c,d, e+tx, f+ty]};
}

function cssMatrix(matrix) {  // `matrix` is a 6-array
    return `matrix(${matrix.join(" ")})`
}

function shapeToCpn(model) {
    // The model is just the tag + the props of the component, but with readable transform
    let m = {...model};  // shallow copying
    // convert transform to CSS
    let xform = model.transform;
    if (xform) {m.transform = cssMatrix(xform);}
    delete m.type;
    return e(model.type, m);
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

let commonShape = {fill:"transparent", stroke:"black",
                   style: {cursor:"move"},
                   vectorEffect: "non-scaling-stroke"};
let rectModel = {...commonShape,
                 type:"rect", width:1, height:1,
                 transform: [100, 0, 0, 100, 0, 0]};
let circleModel = {...commonShape,
                   type:"circle", cx:0.5, cy:0.5, r:0.5,
                   transform: [100, 0, 0, 100, 0, 0]};

// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
function App () {
    let [state, setState] = useState({
        shapes: {},  // Map from id to shapes model
        xform: [1,0,0,1,0,0],  // Universal transformation
        mouseDown: null,  // Previous mouse down position
        focused: null,  // The focused shape id
    });

    // Using the updater callback, no need for depedency
    let onMouseDown = useCallback((evt) => {
        let id = evt.target.id;
        let pos = [evt.clientX, evt.clientY];
        setState((state) => {
            return {...state, mouseDown: pos, focused: id};
        })
    }, [])

    let onMouseMove = useCallback((evt) => {
        let [x,y] = [evt.clientX, evt.clientY];
        setState((state) => {
            // If dragging, move the focused shape
            if (state.mouseDown) {
                let [x0,y0] = state.mouseDown;
                // Update the mouse position for future dragging
                let state1 = {...state, mouseDown: [x,y]};
                let focused = state1.focused;
                if (focused == "grid") {
                    let [a,b,c,d,e,f] = state1.xform;
                    return {...state1, xform: [a,b,c,d, (e+(x-x0)), (f+(y-y0))]};
                } else {
                    let shape = state1.shapes[focused];
                    return {...state1,
                            shapes: {...state1.shapes,
                                     [focused]: translate(shape, x-x0, y-y0)}};
                }
            } else {return state}
        })
    }, [])

    let onMouseUp = useCallback((evt) => {
        setState((state) => {return {...state, mouseDown: null}});
    }, [])

    let bindControl = useCallback((model) => {
        // Let the app control everything
        return {...model,
                onMouseDown: onMouseDown,
                onMouseMove: onMouseMove,
                onMouseUp: onMouseUp};
    }, [])
    let rect = useMemo(() => bindControl(rectModel), []);
    let circle = useMemo(() => bindControl(circleModel), []);

    // Adding a shape from a model
    let addShape = useCallback((model) => {
        setState((state) => {
            let shapes = state.shapes;
            let [a,b,c,d,tx,ty] = state.xform;
            // Create an identity and associate it to a new shape model
            let key = uuidv4();
            // Randomize spawn location
            let [rx,ry] = [(Math.random())*20, (Math.random())*20];
            // set `key` so it'll be available on the Virtual-DOM, but set `id` so it goes to the real DOM
            let shape = {...translate(model,-tx+rx+400,-ty+ry),
                         key:key, id:key};
            return {...state, shapes: {...shapes, [key]: shape}};
        })
    }, []);

    // Shapes that are actually rendered on the screen
    let cpns = Object.values(state.shapes).map(shapeToCpn);
    return e(React.Fragment, {},
             // Controls
             e("div", {id:"controls"},
               e("button", {onClick: (evt) => addShape(rect)}, "Rectangle"),
               e("button", {onClick: (evt) => addShape(circle)}, "Circle")),

             // The svg group, storing the whole digram
             e("svg", {id:"svg", width:W, height:H, xmlns:SVG_NS,},
               e("g", {id:"surface"},
                 e("defs", {id:"defs"}, smallGrid, largeGrid),
                 e("rect", bindControl({
                     // The grid is subject to zooming & panning
                     id:"grid", width:W, height: H,
                     transform: cssMatrix(state.xform),
                     fill: "url(#largeGrid)",
                 }))),
               // The shapes
               e("g", {id:"objects",
                       transform: cssMatrix(state.xform)},
                 cpns))
            );
}

let domContainer = document.getElementById("app");
ReactDOM.render(e(App), domContainer);

// Shape modification: ids for the control points are lists: the control is centralized, as usual
// Change viewport size depending on the device
// Implement zooming & panning: we can steal it from some libraries, it only needs to operate on the SVG data: https://github.com/chrvadala/react-svg-pan-zoom
