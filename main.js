"use strict";
let abs = Math.abs;
/** Get angle from Ox to vector [dx,dy]*/
// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var panZoom = null;  // A third-party svg pan-zoom thing
// There's only ever one mouse manager: it keeps track of mouse position, that's it
function MouseManager() {
  // Keep track of mouse position (in svg coordinate).
  // The offset attribute can't be used, since movement can be handled by different elements
  var mousePos = null;
  this.getMousePos = () => mousePos;
  var prevMousePos = null;  // Previous mouse pos
  this.getPrevMousePos = () => prevMousePos;

  function svgCoor([x,y]) {
    let z = panZoom.getZoom();
    let d = panZoom.getPan();
    return [(x-d.x)/z, (y-d.y)/z];}

  function handle(evt) {
    prevMousePos = mousePos;
    mousePos = svgCoor([evt.x,evt.y]);}
  this.handle = handle;}

function mouseOffset() {
  let [x1,y1] = mouseMgr.getPrevMousePos();
  let [x2,y2] = mouseMgr.getMousePos();
  return [x2-x1, y2-y1]}

let mouseMgr = new MouseManager();
let shapeList = [];  // Keep track of all added shapes (including the ones removed)

let log = console.log;
// Store them, so they won't change
let [W, H] = [window.innerWidth - (window.innerWidth % 100),
              window.innerHeight - (window.innerHeight % 100)];
let D = Math.min(W, H);

// Undo/Redo stuff
// "undoStack" and "redoStack" are lists of commands
// Commands are like {action: "remove"/"create"/"edit", shape: <shape ptr>, controller: <arbitrary string>, before: <keys-vals before>, after: <keys-vals after>}
// The latter half of the keys are only needed for edits
// Deleted shapes linger around, since they're needed for undo
let undoStack = [];
let redoStack = [];
function canUndo() {return (undoStack.length != 0)};
function canRedo() {return (redoStack.length != 0)};
function tryUndo() {if (canUndo()) {undo()} else {log("Cannot undo!")}}
function tryRedo() {if (canRedo()) {redo()} else {log("Cannot redo!")}}

let undoBtn = e("button", {onClick:tryUndo, disabled:true}, [et("Undo")]);
let redoBtn = e("button", {onClick:tryRedo, disabled:true}, [et("Redo")]);
function updateUndoUI() {
  undoBtn.disabled = !canUndo();
  redoBtn.disabled = !canRedo();}

// Save the command to the undo stack
var controlChanged = true;  // This flag is set to truth to signify that the undo should insert a "break"
function issueCmd(cmd) {
  let len = undoStack.length;
  // So the deal is this: if the edit continuously comes from the same source, then we view that as the same edit
  if (len != 0) {
    let last = undoStack[len-1];
    if (controlChanged) {
      undoStack.push(cmd);
      controlChanged = false;}
    else if (cmd.action == "edit") {last.after = cmd.after}
    else {undoStack.push(cmd)}}
  else {undoStack.push(cmd)}
  redoStack.length = 0;  // Empty out the redoStack
  updateUndoUI();}

function undo() {
  let cmd = undoStack.pop();
  redoStack.push(cmd);
  switch (cmd.action) {
  case "create":
    cmd.shape.deregister(false);  // The shape is still there, just register it
    break;
  case "remove":
    cmd.shape.reregister();
    break;
  case "edit":
    cmd.shape.setAttrsAuto(cmd.before);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

function redo() {
  let cmd = redoStack.pop();
  undoStack.push(cmd);
  switch (cmd.action) {
  case "create":
    cmd.shape.reregister();  // The shape is still there, just register it
    break;
  case "remove":
    cmd.shape.deregister(false);
    break;
  case "edit":
    cmd.shape.setAttrsAuto(cmd.after);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

// There's only one of these
function State() {
  let that = this;
  var focused = null;
  that.getFocused = () => focused;

  function focus(shape) {
    // Shape can be null
    if (focused != shape) {
      if (focused) focused.unfocus()
      focused = shape;
      if (shape) shape.focus();}}
  that.focus = focus;

  // Make sure a shape isn't focused
  function unfocus(shape) {if (focused == shape) focus(null)}
  that.unfocus = unfocus;}

let state = new State();

function arrowMove(offset) {
  let focused = state.getFocused();
  if (focused) focused.move(offset)}

// Handling keyboard events
let keymap = {"ctrl-z": tryUndo,
              "ctrl-y": tryRedo,
              "ArrowRight": (evt) => arrowMove([10, 0]),
              "ArrowUp": (evt)    => arrowMove([0,  -10]),
              "ArrowDown": (evt)  => arrowMove([0,  10]),
              "ArrowLeft": (evt)  => arrowMove([-10,0]),
              "Delete": () => {
                let focused = state.getFocused();
                if (focused) {focused.deregister()}},}
window.onkeydown = (evt) => {
  let keys = [];
  if (evt.ctrlKey) {keys.push("ctrl")}
  if (evt.shiftKey) {keys.push("shift")}
  keys.push(evt.key);
  let lookup = keymap[keys.join("-")];
  if (lookup) {
    evt.preventDefault();// Arrow keys scroll the window, we don't want that
    lookup()};}

// Some pure transformation functions
function translate([a,b, c,d, e,f], [tx,ty]) {
  return [a,b, c,d, e+tx, f+ty];}
function extend([a,b, c,d, e,f], [dx,dy]) {
  return [a+dx,b, c,d+dy, e,f]}
function transform([a,b, c,d, e,f], [x,y]) {
  return [a*x+c*y+e, b*x+d*y+f]}
function compose([A,B, C,D, E,F], [a,b, c,d, e,f]) {
  return [(a*A + b*C), (a*B + b*D),
          (c*A + d*C), (c*B + d*D),
          (e*A + f*C + E), (e*B + f*D + F),]}
function rotate(m, angle) {
  let S = Math.sin(angle);
  let C = Math.cos(angle);
  let M = [C,S, -S,C, 0,0];
  return compose(M, m);}

// These models define shape and their associated controls
// Note: "tag" denotes the DOM element's tag, other attributes are consistent with my DOM model
let commonMold = {fill:"transparent", stroke:"black",
                  "vector-effect": "non-scaling-stroke"};
let rectMold = {...commonMold, tag:"rect", width:1, height:1};
let circMold = {...commonMold, tag:"circle", cx:0.5, cy:0.5, r:0.5};
let lineMold = {...commonMold, tag: "line"};
let lineBoxMold = {...lineMold, "stroke-width":10, stroke:"#0000FF55",};

let boxMold = {...commonMold, tag:"rect",
               width:1, height:1, fill:"#0000FF55",};
let cornerWidth = 20;
let cornerMold = {...commonMold, width:cornerWidth, height:cornerWidth,
                  tag:"rect", stroke:"red"};

function serialize(shape) {return shape.getModel()}

var shapeLayer; var controlLayer; var boxLayer;
function update(obj, k, f) {obj.set({[k]: f(obj.get(k))})}

function Shape(mold) {
  // Creates and adds a group containing the shape and its controls from a mold
  // The mold contains the DOM tag and initial attributes
  // Optionally pass in `data` for serialization purpose
  let that = this;  // Weird trick to make "this" work in private function
  // Calculating spawn location
  let {tag, ...attrs} = {...mold};
  let {x,y} = panZoom.getPan();
  let [rx,ry] = [(Math.random())*20, (Math.random())*20];  // Randomize
  let z = panZoom.getZoom();
  if (tag == "line") {
    if (!attrs.x1) {
      [attrs.x1, attrs.y1, attrs.x2, attrs.y2] = [rx, ry, rx+100, ry+100]}}
  else if (!attrs.transform) {
    // panZoom's transform is: array V ➾ P(V) = zV+Δ (where Δ = [x,y])
    // Substituting (V - Δ/z) for V skews that result to just be zV
    let DEFAULT_SCALE = 100;
    attrs.transform = [DEFAULT_SCALE,0, 0,DEFAULT_SCALE,
                       (100-x+rx)/z, (100-y+ry)/z]}

  let shape = es(tag, attrs);

  var move;
  if (tag == "line") {
    move = ([dx,dy]) => {
      let {x1,y1,x2,y2} = model.getAll();
      model.set({x1:x1+dx, y1:y1+dy,
                 x2:x2+dx, y2:y2+dy});}}
  else {
    move = ([dx,dy]) => {
      update(model, "transform", (m) => translate(m, [dx,dy]))}}
  this.move = move;

  // "Bounding box" of the shape, responsible for highlighting and receiving hover
  var bMold = (tag == "line") ? lineBoxMold : boxMold;
  let box = es(
    bMold.tag,
    {...bMold, visibility: "hidden",
     // Allways handle mouse event, visible or not
     "pointer-events": "all",
     onMouseEnter: (evt) => {if (evt.buttons == 0) highlight()},
     // The mouse can leave a shape and still be dragging it
     onMouseLeave: () => {if (that != state.getFocused()) {unhighlight()}},
     onMouseDown: (evt) => {state.focus(that);
                            ctrOnMouseDown(move)(evt);}});

  let ctag = cornerMold.tag;
  var controls;
  if (tag == "line") {
    let endpoint1Md = ([dx,dy]) => {
      let {x1,y1} = model.getAll();
      model.set({x1: x1+dx, y1: y1+dy});}
    let endpoint2Md = ([dx,dy]) => {
      let {x2,y2} = model.getAll();
      model.set({x2:x2+dx, y2:y2+dy});}
    var endpoint1 = es(ctag, {...cornerMold,
                              onMouseDown:ctrOnMouseDown(endpoint1Md)});
    var endpoint2 = es(ctag, {...cornerMold,
                              onMouseDown:ctrOnMouseDown(endpoint2Md)});
    controls = es("g", {visibility: "hidden"},
                  [endpoint1, endpoint2]);}
  else {
    function iMove([dx,dy]) {
      let [a,b,c,d,e,f] = model.get("transform");
      model.set({transform: [a+dx,b+dy, c,d, e,f]})}

    function jMove([dx,dy]) {
      let [a,b,c,d,e,f] = model.get("transform");
      model.set({transform: [a,b, c+dx,d+dy, e,f]})}

    function iExtend([dx,dy], evt) {
      // If "shift" is pressed, maintain ratio
      let [a,b,c,d,e,f] = model.get("transform");
      // The havior depends on the orientation of the control
      // Division by zero can only occur when a = b = 0
      let s = abs(a) > abs(b) ? (a+dx)/a : (b+dy)/b;
      var m;
      if (evt.shiftKey) {m = [a*s,b*s, c*s,d*s, e,f];}
      else {m = [a*s,b*s, c,d, e,f]}
      model.set({transform: m});}

    function jExtend([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      let s = abs(c) > abs(d) ? (c+dx)/c : (d+dy)/d;
      var m;
      if (evt.shiftKey) {m = [a*s,b*s, c*s,d*s, e,f]}
      else {m = [a,b, c*s,d*s, e,f]}
      model.set({transform: m});}

    var rotPivot, rotMatrix, rotAngle;  // set whenever the rotator is pressed
    function rotator() {
      let [x,y] = mouseMgr.getMousePos();  // mouse position in svg coordinate
      let [ox,oy] = rotPivot;
      model.set({transform: translate(rotate(translate(rotMatrix, [-ox,-oy]),
                                             (Math.atan2(y-oy,x-ox) - rotAngle)),
                                      [ox,oy])})}

    // Freely changing i and j
    var iCtr = es(ctag, {...cornerMold, x:0.95,  y:-0.05,
                         onMouseDown:ctrOnMouseDown(iMove)})
    var jCtr = es(ctag, {...cornerMold, x:-0.05, y:0.95,
                         onMouseDown:ctrOnMouseDown(jMove)});
    // Side controls
    var iSide = es("line", {...lineBoxMold, x1:1,y1:0.2, x2:1,y2:0.8,
                            onMouseDown:ctrOnMouseDown(iExtend),
                            cursor:"col-resize",
                            stroke:"#FF000055"});
    var jSide = es("line", {...lineBoxMold, x1:0.2,y1:1, x2:0.8,y2:1,
                            onMouseDown:ctrOnMouseDown(jExtend),
                            cursor:"row-resize",
                            stroke:"#FF000055"});
    // Rotator
    var rotCtr = es("g", {onMouseDown:
                          (evt) => {
                            ctrOnMouseDown(rotator)(evt)
                            // Let the pivot be at the center of the shape
                            let xform = model.get("transform");
                            let [ox,oy] = transform(xform, [0.5,0.5]);
                            let [x,y] = mouseMgr.getMousePos();
                            rotPivot = [ox,oy];
                            rotMatrix = xform;
                            rotAngle = Math.atan2(y-oy, x-ox);}},
                    // dimension ~100x100
                    [es("path", {d:"M 75 25 A 50 50, 0, 1, 1, 25 75",
                                 stroke:"red", "stroke-width": 5,
                                 fill:"transparent"}),
                     es("line", {x1:"25", y1:"75", x2:"15", y2:"85",
                                 stroke:"red", "stroke-width":5}),
                     es("line", {x1:"25", y1:"75", x2:"35", y2:"85",
                                 stroke:"red", "stroke-width":5})])
    controls = es("g", {visibility: "hidden"},
                  [iCtr, jCtr, iSide, jSide, rotCtr]);}

  function focus() {
    highlight();
    setAttr(controls, {visibility: "visible"});}
  that.focus = focus;

  var updateFn;  // Special things to do when the model updates
  if (tag == "line") {
    updateFn = (k,v) => {
      if (["x1", "y1", "x2", "y2"].includes(k)) {
        // Changing the endpoints of the model also changes box
        setAttr(box, {[k]: v});
        // Then we change the nobs, too!
        let V = v-cornerWidth/2;
        switch (k) {
        case "x1":
          setAttr(endpoint1, {x: V}); break;
        case "y1":
          setAttr(endpoint1, {y: V}); break;
        case "x2":
          setAttr(endpoint2, {x: V}); break;
        case "y2":
          setAttr(endpoint2, {y: V}); break;}}}}
  else {
    // This function is in charge of modifying the controller's locations
    updateFn = (k,v) => {
      if (k == "transform") {
        // transform is applied directly to the box
        setAttr(box, {transform: v});
        // Adjust controllers' positions
        let [a,b,c,d,e,f] = v;
        let tl = transform(v, [0,0]);
        let tr = transform(v, [1,0]);
        let bl = transform(v, [0,1]);
        let w = cornerWidth / 2;
        setAttr(iCtr, {x:tr[0]-w, y:tr[1]-w});
        setAttr(jCtr, {x:bl[0]-w, y:bl[1]-w});
        setAttr(rotCtr, {transform: [0.2,0, 0,0.2,  // These are fixed
                                     tl[0]-w-5, tl[1]-w-5]});
        setAttr(iSide, {transform:v});
        setAttr(jSide, {transform:v});

        // Change side control's cursor based on orientation
        setAttr(iSide, {cursor: (abs(a) > abs(b)) ? "col-resize" : "row-resize"});
        setAttr(jSide, {cursor: (abs(c) > abs(d)) ? "col-resize" : "row-resize"})}}}

  function modelCtor() {
    // Guarantees no mutation without going through updateFn
    var val = {};
    this.set = (obj, canUndo=true) => {
      // canUndo: is this an undoable command or not
      let oldValues = {};
      for (let [k,v] of Object.entries(obj)) {
        oldValues[k] = val[k];
        setAttr(shape, {[k]: v});
        updateFn(k, v);
        val[k] = v;}
      if (canUndo)
        issueCmd({action:"edit", shape:that,
                  before:oldValues, after:obj})}

    this.get = (k) => val[k];
    // Only returns copies: no mutation allowed!
    this.getAll = () => {return {...val}};

    // Then we initialize the model, also mutating the DOM to match (not undoable)
    this.set({ tag:tag, ...attrs}, false)}

  let model = new modelCtor();

  function unfocus() {
    unhighlight();
    setAttr(controls, {visibility: "hidden"});}
  that.unfocus = unfocus.bind(that);

  // Shapes have "movement function", which is only ever called when a move command has been issued (such as drag, or arrow keys) on the focused shape
  var moveFn;
  // All mouse event handlers must implement these
  function ctrOnMouseDown(fn) {
    // Returns an event handler
    return (evt) => {
      controlChanged = true;  // Switched to a new control
      evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
      mouseMgr.handle(evt);
      // The same shape might have different "controllers", so we bind the moveFn regardless
      moveFn = fn;}}

  function respondToDrag(evt) {console.assert(moveFn);
                               // Pass in the event to detect modifier keys
                               moveFn(mouseOffset(), evt)}
  that.respondToDrag = respondToDrag;

  function highlight() {setAttr(box, {visibility: "visible"})}
  function unhighlight() {setAttr(box, {visibility: "hidden"})}

  // This flag is for serialization
  var active = false;
  that.getActive = () => active;

  let reregister = () => {// Like "register", but issued by undo/redo
    active = true;
    // We add the view to the DOM
    shapeLayer.appendChild(shape);
    controlLayer.appendChild(controls);
    boxLayer.appendChild(box);}
  that.reregister = reregister.bind(that);

  let register = () => {
    reregister()
    // Add to the undo stack
    issueCmd({action: "create", shape: that})}
  shapeList.push(that);
  that.register = register.bind(that);

  let deregister = (doesIssue=true) => {
    // remove from DOM, the shape's still around for undo/redo
    state.unfocus(that);
    active = false;
    shapeLayer.removeChild(shape);
    controlLayer.removeChild(controls);
    boxLayer.removeChild(box);
    if (doesIssue) {
      // Add to the undo stack
      issueCmd({action: "remove", shape: that})}}
  that.deregister = deregister.bind(that);

  // Technically this returns only the copy of the model
  that.getModel = () => model.getAll();

  // Emergency hole to undo/redo attribute (note: NOT undoable)
  that.setAttrsAuto = (attrs) => model.set(attrs, false)}

{// The DOM
  let lGrid = es("pattern", {id:"largeGrid",
                             width:100, height:100, patternUnits:"userSpaceOnUse"},
                 [es("rect", {width:100, height:100, fill:"none"}),
                  es("path", {d:"M 100 0 H 0 V 100",
                              fill:"none", stroke:"#777777", "stroke-width":2})]);

  let app = document.getElementById("app");
  // The three SVG Layers
  shapeLayer = es("g", {id:"shapes"});
  controlLayer = es("g", {id:"controls"});
  boxLayer = es("g", {id:"boxes"});
  // The whole diagram
  function surfaceOnMouseMove(evt) {
    mouseMgr.handle(evt);
    let focused = state.getFocused()
    if ((evt.buttons == 1) && focused) {// If dragging & there's a listener
      focused.respondToDrag(evt);
      // Cancel bubble, so svg won't get pan/zoom event
      evt.cancelBubble = true;}}

  let svg_el = es("svg", {id:"svg", width:W+1, height:H+1, fill:"black"},
                  // "W+1" and "H+1" to show the grid at the border
                  // pan-zoom wrapper wrap around here
                  [es("g", {id:"surface",
                            onMouseMove: surfaceOnMouseMove,
                            onMouseUp: (evt) => {controlChanged = true;
                                                 mouseMgr.handle(evt);},
                            onMouseDown: (evt) => {state.focus(null);
                                                   mouseMgr.handle(evt);}},
                      [es("defs", {id:"defs"}, [lGrid]),
                       es("rect", {id:"grid", width:W+1, height: H+1,
                                   fill: "url(#largeGrid)"}),
                       // Due to event propagation, events that aren't handled by any shape-group will be handled by the surface
                       shapeLayer, boxLayer, controlLayer])]);

  let UI = e("div", {id:"UI"},
             [// Shape creation
               e("button", {onClick: (evt) => {new Shape(rectMold).register()}},
                 [et("Rectangle")]),
               e("button", {onClick: (evt) => {new Shape(circMold).register()}},
                 [et("Circle")]),
               e("button", {onClick: (evt) => {new Shape(lineMold).register()}},
                 [et("Line")]),

               // Save to file
               e("button", {onClick:(evt) => saveDiagram()},
                 [et("Save")]),
               // Load from file
               e("button", {onClick:(evt) => triggerUpload()},
                 [et("Load")]),

               // Undo/Redo buttons
               undoBtn, redoBtn
             ]);
  app.appendChild(UI);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#svg", {dblClickZoomEnabled: false});}

/* @TodoList
   - Rotation is still not exactly right (skips around, when zoomed out)
   - Make the grid bigger, leave some scrolling space
   - Add "send-to-front/back"
   - Change properties like stroke, stroke-width and fill: go for the side-panel first, before drop-down context menu
*/
