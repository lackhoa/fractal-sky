"use strict";
let log = console.log;
let assert = console.assert;
let abs = Math.abs;
let entries = Object.entries;
let idMatrix = [1,0, 0,1, 0,0];
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
let shapeList = [];  // Keep track of all added shape models (inactives included)
function activeShapes() { return shapeList.filter((s) => s.isActive()) }
let frameList = [];  // Keep track of all frames (inactives included)
function activeFrames() { return frameList.filter((f) => f.isActive()) }

// Store them, so they won't change
let [W, H] = [window.innerWidth, window.innerHeight];
let D = Math.min(W,H) - (Math.min(W,H) % 100);

// Undo/Redo stuff
// "undoStack" and "redoStack" are lists of commands
// Commands are like {action: "remove"/"create"/"edit", shape: <shape ptr>, before: <keys-vals before>, after: <keys-vals after>}
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
    cmd.shape.deregister();  // The shape is still there, just register it
    break;
  case "remove":
    cmd.shape.register();
    break;
  case "edit":
    cmd.shape.model.set(cmd.before);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

function redo() {
  let cmd = redoStack.pop();
  undoStack.push(cmd);
  switch (cmd.action) {
  case "create":
    cmd.shape.register();  // The shape is still there, just register it
    break;
  case "remove":
    cmd.shape.deregister();
    break;
  case "edit":
    cmd.shape.model.set(cmd.after);
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

function arrowMove([dx,dy]) {
  let focused = state.getFocused();
  if (focused) focused.move([dx,dy])
  else {panZoom.panBy({x:-dx, y:-dy})}}

// Handling keyboard events
let keymap = {"ctrl-z": tryUndo,
              "ctrl-y": tryRedo,
              "ArrowRight": (evt) => arrowMove([10, 0]),
              "ArrowUp": (evt)    => arrowMove([0,  -10]),
              "ArrowDown": (evt)  => arrowMove([0,  10]),
              "ArrowLeft": (evt)  => arrowMove([-10,0]),
              "Delete": () => {
                let focused = state.getFocused();
                if (focused) {
                  let shape = focused;
                  shape.deregister();
                  issueCmd({action:"remove", shape:shape})}},}
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
let HL_COLOR = "#0000FF55"
let commonMold = {fill:"transparent", stroke:"black",
                  "vector-effect": "non-scaling-stroke"};
let rectMold = {...commonMold, tag:"rect", width:1, height:1};
let circMold = {...commonMold, tag:"circle", cx:0.5, cy:0.5, r:0.5};
let lineMold = {...commonMold, tag: "line"};
let lineBoxMold = {...lineMold, "stroke-width":10, stroke:HL_COLOR,};

let boxMold = {...commonMold, tag:"rect",
               width:1, height:1, fill:HL_COLOR,};
let cornerWidth = 20;
let cornerMold = {...commonMold, width:cornerWidth, height:cornerWidth,
                  tag:"rect", stroke:"red"};
let frameMold = {tag:"use", href:"#frame",};

var root, controlLayer, boxLayer, axesLayer;

/** A model is a simple locked dictionary, useful for automatic serialization
    Guarantees mutations have to get through updateFn */
function Model(initData={}, updateFn=(k,v) => {}) {
  let that = this;  // Weird trick to make "this" work in private function
  var val = {};

  var updateFn = updateFn;  // Special thing to do when the model updates
  that.getUpdateFn = () => updateFn;
  that.augmentUpdateFn = (fn) => {
    let oldUpdateFn = updateFn;
    updateFn = (k,v) => {oldUpdateFn(k,v); fn(k,v);}}

  function set(obj) {
    for (let [k,v] of entries(obj)) {
      updateFn(k, v);
      val[k] = v;}}
  that.set = set.bind(that);

  function get(k) {return val[k]}
  that.get = get.bind(that);
  // Only returns copies
  function getAll() {return {...val}}
  that.getAll = getAll.bind(that);

  // Initialize the model, which triggers the effects specified in "updateFn"
  that.set(initData)}
function triggerUpdate(model, keys) {
  for (let key of keys) {
    model.set({[key]: model.get(key)})}}

function Shape(type, mold={}) {
  // Creates and adds a group containing the shape and its controls from a mold
  // The mold contains the DOM tag and initial attributes
  // Optionally pass in `data` for serialization purpose
  let that = this;  // Weird trick to make "this" work in private function
  that.type = type;
  var model;
  if (type == "frame") {
    var {tag, ...attrs} = {...frameMold, ...mold};}
  else {
    var {tag, ...attrs} = mold;}
  that.tag = tag;
  // Calculating spawn location
  let [rx,ry] = [(Math.random())*20, (Math.random())*20];  // Randomize
  let {x,y} = panZoom.getPan();
  let [dx,dy] = [x,y];
  let z = panZoom.getZoom();
  if (tag == "line") {
    if (!attrs.x1) {
      let X = (-dx+100+rx)/z;
      let Y = (-dy+100+ry)/z;
      [attrs.x1, attrs.y1, attrs.x2, attrs.y2] = [X,Y, X+100, Y+100]}}

  else if (type == "frame") {
    let xform = attrs.xform;
    if (xform) {
      let [a,b,c,d,e,f] = attrs.xform;
      attrs.transform = [a*D,b*D, c*D,d*D, e,f];}
    else {
      let DEFAULT_SCALE = 1/3;  // How much will the shapes within it will be scaled
      attrs.transform = [D*DEFAULT_SCALE,0, 0,D*DEFAULT_SCALE,
                         (-dx+100+rx)/z, (-dy+100+ry)/z]}}

  else if (!attrs.transform) {
    // panZoom's transform (svg → screen): V ➾ P(V) = zV+Δ (where Δ = [dx,dy])
    // Substituting (V - Δ/z + D/z) for V skews that result to zV+D (screen coord)
    let DEFAULT_DIM = 100;
    attrs.transform = [DEFAULT_DIM,0, 0,DEFAULT_DIM,
                       (-dx+100+rx)/z, (-dy+100+ry)/z]}

  let views = [];  // Views are {parent, el} pairs
  that.getViews = () => views;
  /** Make a DOM element whose attribute is linked to the model
   ** This is supposed to be called when the model has been initialized */
  var newView;
  if (type == "frame") {
    /** Returns a <g> element whose transform is synced with the given frame
     ** If depth > 0, recurse down */
    newView = (parent, depth) => {
      console.assert(model, "Model is supposed to be initialized already!");
      let [a,b,c,d,e,f] = model.get("transform");
      let xform = [a/D,b/D, c/D,d/D, e,f];
      let el = es("g", {class:"frame", transform:xform},
                  [es("g", {class:"frame-shapes"})]);
      // A frame needs its shapes
      for (let shape of activeShapes()) {
        shape.newView( frameShapes(el) )}
      // If this is a branch: make a forest of nodes of the depth level
      if (depth > 0) {
        el.appendChild( makeLayer(depth-1) );}

      views.push({parent:parent, el:el});
      parent.appendChild(el);
      return el;}}
  else {
    newView = (parent) => {
      console.assert(model, "Model is supposed to be initialized");
      let el = es(tag, model.getAll());
      views.push({parent:parent, el:el});
      parent.appendChild(el);
      return el;}}
  that.newView = newView;

  var move;
  if (tag == "line") {
    move = ([dx,dy]) => {
      let {x1,y1,x2,y2} = model.getAll();
      setUndoable({x1:x1+dx, y1:y1+dy,
                   x2:x2+dx, y2:y2+dy});}}
  else {
    move = ([dx,dy]) => {
      let m = model.get("transform");
      setUndoable({transform: translate(m, [dx,dy])});}}
  that.move = move;

  // "Bounding box" of the shape, responsible for highlighting and receiving hover
  let bMold = (tag == "line") ? lineBoxMold : boxMold;
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
      setUndoable({x1: x1+dx, y1: y1+dy});}
    let endpoint2Md = ([dx,dy]) => {
      let {x2,y2} = model.getAll();
      setUndoable({x2:x2+dx, y2:y2+dy});}
    var endpoint1 = es(ctag, {...cornerMold,
                              onMouseDown:ctrOnMouseDown(endpoint1Md)});
    var endpoint2 = es(ctag, {...cornerMold,
                              onMouseDown:ctrOnMouseDown(endpoint2Md)});
    controls = es("g", {visibility: "hidden"},
                  [endpoint1, endpoint2]);}
  else {
    function iMove([dx,dy]) {
      let [a,b,c,d,e,f] = model.get("transform");
      setUndoable({transform: [a+dx,b+dy, c,d, e,f]})}

    function jMove([dx,dy]) {
      let [a,b,c,d,e,f] = model.get("transform");
      setUndoable({transform: [a,b, c+dx,d+dy, e,f]})}

    function iExtend([dx,dy], evt) {
      // If "shift" is pressed, maintain ratio
      let [a,b,c,d,e,f] = model.get("transform");
      // The havior depends on the orientation of the control
      // Division by zero can only occur when a = b = 0
      let s = abs(a) > abs(b) ? (a+dx)/a : (b+dy)/b;
      var m;
      if (evt.shiftKey) {m = [a*s,b*s, c*s,d*s, e,f];}
      else {m = [a*s,b*s, c,d, e,f]}
      setUndoable({transform: m});}

    function jExtend([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      let s = abs(c) > abs(d) ? (c+dx)/c : (d+dy)/d;
      var m;
      if (evt.shiftKey) {m = [a*s,b*s, c*s,d*s, e,f]}
      else {m = [a,b, c*s,d*s, e,f]}
      setUndoable({transform: m});}

    var rotPivot, rotMatrix, rotAngle;  // set whenever the rotator is pressed
    function rotator() {
      let [x,y] = mouseMgr.getMousePos();  // mouse position in svg coordinate
      let [ox,oy] = rotPivot;
      setUndoable({transform: translate(rotate(translate(rotMatrix, [-ox,-oy]),
                                               (Math.atan2(y-oy,x-ox) - rotAngle)),
                                        [ox,oy])})}

    // Freely changing i and j
    var iCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(iMove)})
    var jCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(jMove)});
    // Side controls
    var iSide = es("line", {...lineBoxMold, x1:1,y1:0.2, x2:1,y2:0.8,
                            onMouseDown:ctrOnMouseDown(iExtend),
                            cursor:"col-resize", stroke:"#FF000055"});
    var jSide = es("line", {...lineBoxMold, x1:0.2,y1:1, x2:0.8,y2:1,
                            onMouseDown:ctrOnMouseDown(jExtend),
                            cursor:"row-resize", stroke:"#FF000055"});
    // Rotator
    let hitbox = es("rect", {x:0,y:0, width:1,height:1,
                             fill:"transparent",
                             stroke:"transparent",
                             "vector-effect":"non-scaling-stroke",
                             onMouseEnter:(evt) => hili(),
                             onMouseLeave:(evt) => unhili()})
    let hili = () => {setAttr(hitbox, {fill: HL_COLOR})};
    let unhili = () => {setAttr(hitbox, {fill: "transparent"})};
    var rotCtr = es("g", {onMouseDown:
                          (evt) => {
                            ctrOnMouseDown(rotator)(evt)
                            // Let the pivot be at the center of the shape
                            let tform = model.get("transform");
                            let [ox,oy] = transform(tform, [0.5,0.5]);
                            let [x,y] = mouseMgr.getMousePos();
                            rotPivot = [ox,oy];
                            rotMatrix = tform;
                            rotAngle = Math.atan2(y-oy, x-ox);},
                          // "vector-effect" is not inherited for some reason???
                          stroke:"red"},
                    // Specified in 0-1 coord
                    [es("path", {d:"M .5 0 A .5 .5 0 1 1 0 .5",
                                 fill:"transparent", "vector-effect":"non-scaling-stroke"}),
                     es("line", {x1:0, y1:.5, x2:-.2, y2:.7,"vector-effect":"non-scaling-stroke"}),
                     es("line", {x1:0, y1:.5, x2:.2, y2:.7,"vector-effect":"non-scaling-stroke"}),
                     hitbox])
    controls = es("g", {visibility:"hidden"},
                  [iCtr, jCtr, iSide, jSide, rotCtr]);}

  function focus() {
    highlight();
    setAttr(controls, {visibility: "visible"});}
  that.focus = focus;

  if (type == "frame") {
    var axes = es(tag, attrs);}

  // Come about to making the model
  var updateFn;
  if (tag == "line") {
    updateFn = (k,v) => {
      for (let {el} of views) { setAttr(el, {[k]: v}) }
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
      for (let {el} of views) { setAttr(el, {[k]: v}) }

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
        setAttr(rotCtr, {transform: [20,0, 0,20,
                                     tl[0]-w-5, tl[1]-w-5]});
        setAttr(iSide, {transform:v});
        setAttr(jSide, {transform:v});

        // Change side control's cursor based on orientation
        setAttr(iSide, {cursor: (abs(a) > abs(b)) ? "col-resize":"row-resize"});
        setAttr(jSide, {cursor: (abs(c) > abs(d)) ? "col-resize":"row-resize"});

        // Frames more things to take care of:
        if (type == "frame") {
          // Transform of axes
          setAttr(axes, {transform:v})
          // Nested stuff
          let xform = [a/D,b/D, c/D,d/D, e,f];
          for (let {el} of views) {
            setAttr(el, {transform:xform})}}}}}

  // Model holds changing data which to be synced with the view
  // In shapes, the model holds attributes
  // In frames, the model molds session-specific transform and xform
  if (type == "frame") {
    model = new Model({transform: attrs.transform}, updateFn);}
  else {
    model = new Model(attrs, updateFn);}
  that.model = model;

  function setUndoable(attrs) {
    let before = {};
    for (let k in attrs) {before[k] = model.get(k)}
    model.set(attrs);
    issueCmd({action:"edit", shape:that,
              before:before, after:attrs});}

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
      // One shape might have different controls, so we bind the moveFn regardless
      moveFn = fn;}}

  function respondToDrag(evt) {
    console.assert(moveFn);
    // Pass in the event to detect modifier keys
    moveFn(mouseOffset(), evt)}
  that.respondToDrag = respondToDrag;

  function highlight() {setAttr(box, {visibility: "visible"})}
  function unhighlight() {setAttr(box, {visibility: "hidden"})}

  // This flag is for serialization
  var active = false;
  that.isActive = () => active;

  function register() {
    active = true;
    // Add the views & controls to the DOM
    for (let {parent,el} of views) {
      parent.appendChild(el)}
    controlLayer.appendChild(controls);
    boxLayer.appendChild(box);
    if (type == "frame") {
      axesLayer.appendChild(axes)}}
  that.register = register.bind(that);

  function deregister() {
    // Remove from DOM, the shape's still around for undo/redo
    state.unfocus(that);
    active = false;
    for (let {el} of views) { el.remove() }
    controls.remove();
    box.remove();
    if (type == "frame") { axes.remove() }}
  that.deregister = deregister.bind(that);}

var treeDepth = 2;  // Depth of the deepest node
function frameShapes(frame) {return frame.children[0]}
function frameNested(frame) {return frame.children[1]}
function isLeaf(frame) {
  return (frame.getElementsByClassName("frame-nested").length == 0);}

/** Make frames of the passed depth, then put them to a group */
function makeLayer(depth) {
  let g = es("g", {class:"frame-nested"});
  for (let frame of activeFrames()) {
    frame.newView(g, depth)}
  return g;}

// A layer is list of frames
// @Fix: still infinite loop! When there is a nested frame
function getLayers() {
  // The first layer is the shape layer
  let res = [[root]];
  var lastLayer = res[0];
  if (activeFrames().length != 0) {
    // We wouldn't need deeper layers if there's only the identity frame
    while (true) {
      var newLayer = [];
      assert(lastLayer.length > 0);
      if (isLeaf(lastLayer[0])) {break}
      else {
        for (let frame of lastLayer) {
          assert(frame.getAttribute("class") == "frame");
          for (let f of frameNested(frame).children) {
            assert(f.getAttribute("class") == "frame");
            newLayer.push(f);}}
        res.push(newLayer);
        lastLayer = newLayer;}}}

  return res;}

/** Increment the current frame count */
function incDepth() {
  let layers = getLayers();
  let leaves = layers[layers.length - 1];
  for (let leaf of leaves) {
    leaf.appendChild( makeLayer(0) )}
  treeDepth++;}

function newShape(type, mold) {
  let s = new Shape(type, mold);
  s.register();  // Put all the control stuff in the DOM
  let layers = getLayers();
  if (type == "frame") {
    // Include this frame in the frameList first, so it will include itself
    frameList.push(s);
    if (activeFrames().length == 1) {// If the frame list was empty before
      s.newView(frameNested(root), treeDepth-1)}
    else {
      var depth = 0;
      // Exclude the last item
      for (let layer of layers.slice(0,-1)) {
        for (let frame of layer) {
          assert(frame.getAttribute("class") == "frame");
          s.newView(frameNested(frame), treeDepth-depth-1);}
        depth++;}}}

  else {// None-frames
    for (let layer of layers) {
      for (let frame of layer) {
        s.newView(frameShapes(frame))}}
    shapeList.push(s);}

  issueCmd({action:"create", shape:s});}

{// The DOM
  let tile = es("pattern", {id:"tile",
                            width:100, height:100, patternUnits:"userSpaceOnUse"},
                [es("rect", {width:100, height:100, fill:"none"}),
                 es("path", {d:"M 100 0 H 0 V 100",
                             fill:"none", stroke:"#777777", "stroke-width":2})]);
  let frameStroke = {"vector-effect": "non-scaling-stroke",
                     fill:"transparent", "stroke-width":3};
  // This is within 00-11 bound
  let arr = 0.03;
  let frameDef = es("g", {id:"frame", "vector-effect": "non-scaling-stroke"},
                    [// This is i
                      es("path", {...frameStroke, stroke:"red", d:`M 0 0 H 1`}),
                      es("path", {...frameStroke, stroke:"red",
                                  d:`M ${1-arr} ${-arr} L 1 0 L ${1-arr} ${arr}`,}),
                      // This is j
                      es("path", {...frameStroke, stroke:"green", d:`M 0 0 V 1`}),
                      es("path", {...frameStroke, stroke:"green",
                                  d:`M ${-arr} ${1-arr} L 0 1 L ${arr} ${1-arr}`}),
                    ]);

  let app = document.getElementById("app");
  // The SVG Layers: also the root frame, with depth of 1 at first
  root = es("g", {id:"root", class:"frame", transform:idMatrix},
            [es("g", {class:"frame-shapes"}),
             es("g", {class:"frame-nested"})]);
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

  // This layer holds all the axes, so we can turn them all on/off
  axesLayer = es("g", {id:"axes"},
                 [// The identity frame (decoration)
                   es("use", {id:"the-frame", href:"#frame",
                              transform:[D,0, 0,D, 0,0]})])

  let svg_el = es("svg", {id:"svg", width:W+1, height:H+1, fill:"black"},
                  // "W+1" and "H+1" is to show the grid at the border
                  // pan-zoom wrapper wrap around here
                  [es("g", {id:"surface",
                            onMouseMove: surfaceOnMouseMove,
                            onMouseUp: (evt) => {controlChanged = true;
                                                 mouseMgr.handle(evt);},
                            onMouseDown: (evt) => {state.focus(null);
                                                   mouseMgr.handle(evt);}},
                      [// Definitions
                        es("defs", {id:"defs"}, [tile, frameDef]),
                        // The grid
                        es("rect", {id:"grid",
                                    width:2*W+1, height:2*H+1,
                                    // Offset so that things will be in the middle
                                    x:-W/2, y:-H/2,
                                    fill:"url(#tile)"}),
                        // Due to event propagation, events not handled by any shape will be handled by the surface
                        root, boxLayer, controlLayer, axesLayer])]);

  let UI = e("div", {id:"UI"},
             [// Shape creation
               e("button", {onClick: (evt) => {newShape("shape", rectMold)}},
                 [et("Rectangle")]),
               e("button", {onClick: (evt) => {newShape("shape", circMold)}},
                 [et("Circle")]),
               e("button", {onClick: (evt) => {newShape("shape", lineMold)}},
                 [et("Line")]),
               e("button", {onClick: (evt) => {newShape("frame")}},
                 [et("Frame")]),

               // Save to file
               e("button", {onClick:(evt) => saveDiagram()},
                 [et("Save")]),
               // Load from file
               e("button", {onClick:(evt) => triggerUpload()},
                 [et("Load")]),

               // Undo/Redo buttons
               undoBtn, redoBtn]);
  app.appendChild(UI);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#svg", {dblClickZoomEnabled: false,
                                // Don't do any bullshit on startup
                                fit:false, center:false});
  panZoom.pan({x:20, y:20});}

/* @Todo
   - Undo is broken
   - Allow changing levels arbitrarily
   - Distinguish the-frame from the other frames
   - Add box for frames
   - Remove box highlight for focused shapes
   - Add "send-to-front/back"
   - Change properties like stroke, stroke-width and fill: go for the side-panel first, before drop-down context menu
   - Add copy/paste
*/
