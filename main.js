"use strict";
// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var panZoom = null;  // A third-party svg pan-zoom thing
var mouseDown = null;  // Previous mouse position (in svg coordinate). The event attribute is no use because movement can be handled by different elements
var prevMouseDown = null;  // Gotta keep track of the previous position!
var rotationPivot = null;
let shapeList = [];  // Keep track of all added shapes (including the ones removed)

let log = console.log;
let [W, H] = [1000, 600];

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
var controlChanged = true;
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

function issueMove(offset, evt) {
  let focused = state.getFocused();
  if (focused) focused.respondToMove(offset, evt);}

// Handling keyboard events
let keymap = {"ctrl-z": tryUndo,
              "ctrl-y": tryRedo,
              "ArrowRight": (evt) => issueMove([10,0], evt),
              "ArrowUp": (evt) => issueMove([0,-10], evt),
              "ArrowDown": (evt) => issueMove([0,10], evt),
              "ArrowLeft": (evt) => issueMove([-10,0], evt),
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
function rotate([a,b, c,d, e,f], angle) {
  let S = Math.sin(angle);
  let C = Math.cos(angle);
  let M = [C,S, -S,C, 0,0];
  return [...transform(M, [a,b]), ...transform(M, [c,d]), ...transform(M, [e,f])]}

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
let cornerMold = {...commonMold, tag:"rect", width:0.1, height:0.1, stroke:"red"};
let endpointMold = {...cornerMold, width:10, height:10};

function serialize(shape) {return shape.getModel()}

function svgCoor([x,y]) {
  let z = panZoom.getZoom();
  return [x/z, y/z];}

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
    move = ([dx, dy]) => {
      let {x1,y1,x2,y2} = model.getAll();
      model.set({x1:x1+dx, y1:y1+dy,
                 x2:x2+dx, y2:y2+dy});}}
  else {
    move = ([dx, dy]) => {
      update(model, "transform", (m) => translate(m, [dx,dy]))}}

  // "Bounding box" of the shape, responsible for highlighting and receiving hover
  var bMold = (tag == "line") ? lineBoxMold : boxMold;
  let box = es(
    bMold.tag,
    {...bMold, visibility: "hidden",
     // Allways handle mouse event, visible or not
     "pointer-events": "all",
     onMouseEnter: () => {if (!mouseDown) highlight()},
     // The mouse can leave a shape and still be dragging it
     onMouseLeave: () => {if (that != state.getFocused()) unhighlight()},
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
    var endpoint1 = es(ctag, {...endpointMold,
                              onMouseDown:ctrOnMouseDown(endpoint1Md)});
    var endpoint2 = es(ctag, {...endpointMold,
                              onMouseDown:ctrOnMouseDown(endpoint2Md)});
    controls = es("g", {visibility: "hidden"},
                  [endpoint1, endpoint2]);}
  else {
    function iResize([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      var m;
      // shift: extend the i vector, maintain ratio
      if (evt.shiftKey) {
        let A = a+dx; let D = (d+dx);
        let s = A/a;
        m = [A,b*s, c*s,D, e,f]}
      // control: freely move the i vector
      else if (evt.ctrlKey) {m = [a+dx,b+dy, c,d, e,f]}
      // nothing pressed: extend the i vector
      else {let A = a+dx; m = [A,b*A/a, c,d, e,f]}
      model.set({transform: m})}

    function jResize([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      var m;
      // shift: extend the j vector, maintain ratio
      if (evt.shiftKey) {
        let D = d+dy; let A = a+dy;
        let s = D/d;
        m = [A,b*s, c*s,D, e,f]}
      // control: freely move the j vector
      else if (evt.ctrlKey) {m = [a,b, c+dx,d+dy, e,f]}
      // nothing pressed: extend the j vector
      else {let C = c+dx; m = [a,b, C,d*C/c, e,f]}
      model.set({transform: m})}

    function rotator([dx,dy], evt) {
      let [x,y] = prevMouseDown;
      let [X,Y] = mouseDown;  // mouse position in svg coordinate
      let xform = model.get("transform")
      if (!rotationPivot) {
        rotationPivot = transform(xform, [0.5,0.5])}
      let [a,b,c,d,e,f] = xform;
      let [ox,oy] = rotationPivot;
      model.set({transform: translate(rotate(translate(xform, [-ox,-oy]),
                                             (Math.atan2(Y-oy, X-ox) -
                                              Math.atan2(y-oy, x-ox))),
                                      [ox,oy])})}

    controls = es("g",
                  {visibility: "hidden"},
                  [es(ctag, {...cornerMold, x:0.95,  y:-0.05,
                             onMouseDown:ctrOnMouseDown(iResize)}),
                   es(ctag, {...cornerMold, x:-0.05, y:0.95,
                             onMouseDown:ctrOnMouseDown(jResize)}),
                   // Rotator
                   es(ctag, {...cornerMold, x:1, y:1,
                             onMouseDown:
                             (evt) => {
                               rotationPivot = null;
                               ctrOnMouseDown(rotator)(evt)}})]);}

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
        switch (k) {
        case "x1":
          setAttr(endpoint1, {x: v-5}); break;
        case "y1":
          setAttr(endpoint1, {y: v-5}); break;
        case "x2":
          setAttr(endpoint2, {x: v-5}); break;
        case "y2":
          setAttr(endpoint2, {y: v-5}); break;}}}}
  else {
    updateFn = (k,v) => {
      if (k == "transform") {
        // transform is applied to all associated DOM groups
        setAttr(box, {transform: v});
        setAttr(controls, {transform: v});}}}

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
  // Abstraction on mouse event handlers
  function ctrOnMouseDown(fn) {
    // Returns an event handler
    return (evt) => {
      controlChanged = true;  // Switched to a new control
      evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
      prevMouseDown = mouseDown;
      mouseDown = svgCoor([evt.clientX, evt.clientY]);
      // The same shape might have different "controllers", so we bind the moveFn regardless
      moveFn = fn;}}

  function respondToMove([dx,dy], evt) {if (moveFn) moveFn([dx,dy], evt)}
  that.respondToMove = respondToMove;

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
    if (mouseDown) {// If dragging
      let [x0,y0] = mouseDown;
      // Update the mouse position for future dragging
      let z = panZoom.getZoom();
      let [x,y] = [evt.clientX/z, evt.clientY/z];
      prevMouseDown = [x0,y0];
      mouseDown = [x,y];
      if (state.getFocused()) {
        // Issue move command, if there's any listener
        issueMove([(x-x0),(y-y0)], evt);
        // Cancel bubble, so svg won't get pan/zoom event
        evt.cancelBubble = true;}}}

  let svg_el = es("svg", {id:"svg", width:W, height:H, fill:"black"},
                  // pan-zoom wrapper wrap around here
                  [es("g", {id:"surface",
                            onMouseMove: surfaceOnMouseMove,
                            onMouseUp: (evt) => {mouseDown = null;
                                                 rotationPivot = null;
                                                 controlChanged = true;},
                            onMouseDown: (evt) => {state.focus(null);
                                                   prevMouseDown = mouseDown;
                                                   mouseDown = svgCoor([evt.x,evt.y])}},
                      [es("defs", {id:"defs"}, [lGrid]),
                       es("rect", {id:"grid", width:W, height: H,
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

// @TodoList
// Add the other box resize controls
// Rotation
// Change viewport size depending on the device
// Change properties like stroke, stroke-width and fill: go for the side-panel first, before drop-down context menu
// Add "send-to-front/back"
