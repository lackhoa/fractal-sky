"use strict";
// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var panZoom = null;  // A third-party svg pan-zoom thing
var mouseDown = null;  // Previous mouse position (in svg coordinate). The event attribute is no use because movement can be handled by different elements
var focused = null;  // The focused shape
var moveFn = null;  // Movement listener
let shapeList = [];  // Keep track of all added shapes (including the ones removed)

'use strict';
let log = console.log;
let [W, H] = [801, 481];

// Undo/Redo stuff
// "undoStack" and "redoStack" are lists of commands
// Commands are like {action: "remove"/"create"/"edit", shape: <shape ptr>, controller: <arbitrary string>, attr: <attr name>, before: <attr val before>, after: <attr val after>}
// The latter half of the keys are only needed for edits
// Deleted shapes linger around, since they're needed for undo
let undoStack = [];
let redoStack = [];
function canUndo() {return (undoStack.length != 0)};
function canRedo() {return (redoStack.length != 0)};

let undoBtn = e("button", {onClick:undo, disabled:true}, [et("Undo")]);
let redoBtn = e("button", {onClick:redo, disabled:true}, [et("Redo")]);
function updateUndoUI() {
  undoBtn.disabled = !canUndo();
  redoBtn.disabled = !canRedo();}

// Save the command to the undo stack
function issueCmd(cmd) {
  let len = undoStack.length;
  // So the deal is this: if the edit continuously comes from the same source, then we view that as the same edit
  if (len != 0) {
    let last = undoStack[len-1];
    if (cmd.action == "edit" &&
        last.action == "edit" &&
        cmd.shape == last.shape &&
        cmd.controller == last.controller) {
      last.after = cmd.after;}
    else {undoStack.push(cmd)}}
  else {undoStack.push(cmd)}
  redoStack.length = 0;  // Empty out the redoStack
  updateUndoUI();}

function undo() {
  let cmd = undoStack.pop();
  switch (cmd.action) {
  case "create":
    cmd.shape.deregister(false);  // The shape is still there, just register it
    break;
  case "remove":
    cmd.shape.reregister();
    break;
  case "edit":
    cmd.shape.setAttr(cmd.attr, cmd.before);
    break;
  default:
    throw("Illegal action", cmd.action)}
  redoStack.push(cmd);
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

function redo() {
  let cmd = redoStack.pop();
  switch (cmd.action) {
  case "create":
    cmd.shape.reregister();  // The shape is still there, just register it
    break;
  case "remove":
    cmd.shape.deregister(false);
    break;
  case "edit":
    cmd.shape.setAttr(cmd.attr, cmd.after);
    break;
  default:
    throw("Illegal action", cmd.action)}
  undoStack.push(cmd);
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

function tryUndo() {if (canUndo()) {undo()} else {log("Cannot undo!")}}
function tryRedo() {if (canRedo()) {redo()} else {log("Cannot redo!")}}

// Handling keyboard events
let keymap = {"ctrl-z": tryUndo,
              "ctrl-y": tryRedo,}
window.onkeydown = (evt) => {
  let keys = [];
  if (evt.ctrlKey) {keys.push("ctrl")}
  if (evt.shiftKey) {keys.push("shift")}
  keys.push(evt.key);
  let lookup = keymap[keys.join("-")];
  if (lookup) {lookup()};}

function translate(model, tx, ty) {
  let [a,b,c,d,e,f] = model.transform || [1,0,0,1,0,0];
  // Note that translation is scaled along with the transformation matrix
  return {...model, transform: [a,b,c,d, e+tx, f+ty]};}

function tslate(model, tx, ty) {// The mutable version
  let [a,b,c,d,e,f] = model.transform || [1,0,0,1,0,0];
  model.transform = [a,b,c,d, e+tx, f+ty];}

// These models define shape and their associated controls
// Note: "tag" denotes the DOM element's tag, other attributes are consistent with my DOM model
let commonMold = {fill:"transparent", stroke:"black",
                  "vector-effect": "non-scaling-stroke"};
let rectMold = {...commonMold, tag:"rect", width:1, height:1};
let circMold = {...commonMold, tag:"circle", cx:0.5, cy:0.5, r:0.5};
let lineMold = {...commonMold, tag: "line", x1:0, y1:0, x2:1, y2:1};

let frameMold = {...commonMold, tag:"rect",
                 width:1, height:1, cursor:"move", fill:"#0000FF55",};
let cornerMold = {...commonMold, tag:"rect", width:0.1, height:0.1, fill:"red"};

// Adding a shape from a model
let DEFAULT_SCALE = 100;

function LockedObj(init, updateFn) {
  // Guarantees no mutation without
  var val = {};
  this.set = (k,newVal) => {
    updateFn(k,val,newVal);
    val[k] = newVal;};
  this.get = (k) => val[k];
  // Only returns copies: no mutation allowed!
  this.getAll = () => {return {...val}};
  for (let [k,v] of Object.entries(init)) {
    this.set(k, v)}}

function serialize(shape) {return shape.getModel()}

function svgCoor([x,y]) {
  let z = panZoom.getZoom();
  return [x/z, y/z];}

var shapeLayer;
var controlLayer;
var boxLayer;
function Shape2D(mold) {
  // Creates and adds a group containing the shape and its controls from a mold
  // The mold contains the DOM tag and initial attributes
  // Optionally pass in `data` for serialization purpose
  let that = this;  // Weird trick to make "this" work in private function
  let moldCopy = {...mold};

  // Calculating spawn location
  if (!moldCopy.transform) {
    let {x,y} = panZoom.getPan();
    let z = panZoom.getZoom();
    let [rx,ry] = [(Math.random())*20, (Math.random())*20];  // Randomize
    // panZoom's transform is: array V ➾ P(V) = zV+Δ (where Δ = [x,y])
    // Substituting (V - Δ/z) for V skews that result to just be zV
    moldCopy.transform = [DEFAULT_SCALE,0, 0,DEFAULT_SCALE,
                          (-x+rx)/z, (-y+ry)/z]}

  let {tag, ...attrs} = {...moldCopy};
  let shape = es(tag, attrs);

  // "Bounding box" of the shape, responsible for highlighting and receiving hover
  let box = es(
    frameMold.tag,
    {...frameMold, visibility: "hidden",
     // Allways handle mouse event, visible or not
     "pointer-events": "all",
     onMouseEnter: () => {if (!mouseDown) {highlight()}},
     // The mouse can leave a shape and still be dragging it
     onMouseLeave: () => {if (that != focused) {unhighlight()}},
     onMouseDown: ctrOnMouseDown(move)});

  let ctag = cornerMold.tag;
  let controls = es(
    "g", {visibility: "hidden",},
    [// Horizontal resizing (right-side)
      es(ctag, {...cornerMold, x:0.9, y:0.45,
                cursor:"e-resize",
                onMouseDown: ctrOnMouseDown(resizeR)}),
      // Vertical resizing (bottom-side)
      es(ctag, {...cornerMold, x:0.45, y:0.9,
                cursor:"s-resize",
                onMouseDown: ctrOnMouseDown(resizeB)}),
      // Bottom-right corner
      es(ctag, {...cornerMold, x:0.9, y:0.9,
                cursor:"se-resize",
                onMouseDown: ctrOnMouseDown(resizeBRDispatch)})]);
  function focus() {
    highlight();
    setAttr(controls, {visibility: "visible"});
    focused = that;}
  function modelCtor() {
    // Guarantees no mutation without
    var val = {};
    let updateFn = (k,v0,v) => {
      setAttr(shape, {[k]: v});
      if (k == "transform") {
        // transform is applied to all associated DOM groups
        setAttr(box, {transform: v});
        setAttr(controls, {transform: v});}}
    this.set = (k,newVal) => {
      updateFn(k,val,newVal);
      val[k] = newVal;};
    this.get = (k) => val[k];
    // Only returns copies: no mutation allowed!
    this.getAll = () => {return {...val}};
    for (let [k,v] of Object.entries(moldCopy)) {
      this.set(k, v)}
  }
  let model = new modelCtor();

  // What the fuck: "model.set" will change the prototype?
  // Setting model allows undo as well (init code doesn't need undoing)
  let oldSet = model.set.bind(model);
  model.set = (k,v, controller=null) => {
    let oldV = model.get(k);
    oldSet(k,v);  // Update the value as usual
    // If the controller is non-null, it means that this is an undoable command
    if (controller) {
      issueCmd({action:"edit", shape:that, controller:controller,
                attr:k, before:oldV, after:v})}
  };

  function unfocus() {
    unhighlight();
    setAttr(controls, {visibility: "hidden"});
    focused = null;}
  that.unfocus = unfocus.bind(that);

  // Abstraction on mouse event handlers
  function ctrOnMouseDown (msg) {
    // Returns an event handler
    return (evt) => {
      evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
      mouseDown = svgCoor([evt.clientX, evt.clientY]);
      // User clicked, transfer focus to the receiving element
      if (focused != that) {
        if (focused) {focused.unfocus()}
        focus();}
      // The same shape might have different "controllers", so we bind the moveFn regardless
      moveFn = msg.bind(that);}}

  function highlight() {setAttr(box, {visibility: "visible"})}
  function unhighlight() {setAttr(box, {visibility: "hidden"})}

  function resizeBR([dx,dy]) {// [dx, dy] is offset given in svg coordinate
    // Moves the bottom-right corner
    let [a,b,c,d,e,f] = model.get("transform");
    model.set("transform", [a+dx,b, c,d+dy, e,f], "resizeBR")}

  function resizeBRSquare([dx,dy]) {
    let [a,b,c,d,e,f] = model.get("transform");
    model.set("transform", [a+dx,b, c,a+dx, e,f], "resizeBR")}

  function resizeBRDispatch([dx,dy], evt) {// If "Shift" is pressed, preserve w/h ratio
    if (evt && evt.shiftKey) {resizeBRSquare([dx,dy])}
    else {resizeBR([dx,dy])}}

  function resizeR([dx, dy]) {resizeBR([dx, 0])}
  function resizeB([dx, dy]) {resizeBR([0, dy])}

  function move([dx, dy]) {
    // Movement is calculated from offset, so panning doesn't matter, but zoom does
    let [a,b,c,d,e,f] = model.get("transform");
    model.set("transform", [a,b,c,d, e+dx, f+dy], "move");}

  // This flag is for serialization
  var inactive = true;
  function getInactive() {return inactive}

  let reregister = () => {// Like "register", but issued by undo/redo
    inactive = false;
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
    unfocus();
    inactive = true;
    shapeLayer.removeChild(shape);
    controlLayer.removeChild(controls);
    boxLayer.removeChild(box);
    if (doesIssue) {
      // Add to the undo stack
      issueCmd({action: "remove", shape: that})}}
  that.deregister = deregister.bind(that);

  // Technically this returns only the copy of the model
  that.getModel = () => model.getAll();

  // Emergency hole to undo/redo attribute
  that.setAttr = (attr,val) => {
    model.set(attr,val)}}

{// The DOM
  let lGrid = es("pattern", {id:"largeGrid",
                             width:80, height:80, patternUnits:"userSpaceOnUse"},
                 [es("rect", {width:80, height:80, fill:"none"}),
                  es("path", {d:"M 80 0 H 0 V 80",
                              fill:"none", stroke:"#777777", strokeWidth:2})]);

  let app = document.getElementById("app");
  // The three SVG Layers
  shapeLayer = es("g", {id:"shapes"});
  controlLayer = es("g", {id:"controls"});
  boxLayer = es("g", {id:"boxes"});
  // The whole diagram
  function surfaceOnMouseMove(evt) {
    if (mouseDown && moveFn) {// If dragging, and there's an active listener
      evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
      let [x0,y0] = mouseDown;
      // Update the mouse position for future dragging
      let z = panZoom.getZoom();
      let [x,y] = [evt.clientX/z, evt.clientY/z];
      mouseDown = [x,y];
      moveFn([x-x0, y-y0], evt);}}

  let svg_el = es("svg", {id:"svg", width:W, height:H, fill:"black"},
                  // pan-zoom wrapper wrap around here
                  [es("g", {id:"surface",
                            onMouseMove: surfaceOnMouseMove,
                            onMouseUp: (evt) => {mouseDown = null},
                            onMouseDown: (evt) => {if (focused) {focused.unfocus()}
                                                   mouseDown = svgCoor([evt.x,evt.y]);}},
                      [es("defs", {id:"defs"}, [lGrid]),
                       es("rect", {id:"grid", width:W, height: H,
                                   fill: "url(#largeGrid)"}),
                       // Due to event propagation, events that aren't handled by any shape-group will be handled by the surface
                       shapeLayer, boxLayer, controlLayer])]);

  let UI = e("div", {id:"UI"},
             [// Shape creation
               e("button", {onClick: (evt) => {new Shape2D(rectMold).register()}},
                 [et("Rectangle")]),

               e("button", {onClick: (evt) => {new Shape2D(circMold).register()}},
                 [et("Circle")]),

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
// Attempt to make lines
// Undo/Redo
// We definitely need the other resize controls
// Add "send-to-front/back"
// Change viewport size depending on the device
// Is it better to force square when "shift" is down, rather than preserving ratio?
