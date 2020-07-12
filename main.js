"use strict";
let log = console.log;
let assert = console.assert;
let abs = Math.abs;
let entries = Object.entries;
function distance([x,y], [X,Y]) {
  let dx = X - x;
  let dy = Y - y;
  return Math.sqrt(dx*dx + dy*dy);}
function factor([a,b, c,d, e,f], [u,v]) {
  assert((b*c - a*d) != 0);
  let x = (-c*f + c*v + d*(-u) + e*d)/(b*c - a*d)
  let y = (a*f - a*v + b*u - e*b)/(b*c - a*d)
  return [x,y];}
let idMatrix = [1,0, 0,1, 0,0];
// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var panZoom;  // A third-party svg pan-zoom thing
var svg_el;  // The main svg element of the app
// There's only ever one mouse manager: it keeps track of mouse position, that's it
function MouseManager() {
  // Keep track of mouse position (in svg coordinate).
  // The offset attribute can't be used, since movement can be handled by different elements
  var mousePos = null;
  this.getMousePos = () => mousePos;
  var prevMousePos = null;  // Previous mouse pos
  this.getPrevMousePos = () => prevMousePos;

  function svgCoor([x,y]) {
    // x,y is mouse location given in screen coordinate
    // Factor in the offset of the svg element
    let {e,f} = svg_el.getScreenCTM();
    // Undo further svg-pan-zoom's effect
    let z = panZoom.getZoom();
    let d = panZoom.getPan();
    return [(x - d.x - e)/z, (y - d.y - f)/z];}

  function handle(evt) {
    prevMousePos = mousePos;
    // Urgh, this is not it! evt.x refers to screen coordinate
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
function activeFrames() {
  return frameList.filter((f) => f.isActive()) }

// Store them, so they won't change
let [W, H] = [window.innerWidth, window.innerHeight];
let theD = Math.min(W,H) - (Math.min(W,H) % 100);  // theD is the dimension of "the-frame"

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
let cornerMold = {...commonMold, r:cornerWidth/2,
                  tag:"circle", stroke:"red", cursor:"move"};
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
      attrs.transform = [a*theD,b*theD, c*theD,d*theD, e,f];}
    else {
      let scale = 1/3;  // Scaling is applied by default
      attrs.transform = [theD*scale,0, 0,theD*scale,
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
     ** If depth > 0, recurse down
     ** "frameBeingCreated" is the frame that is in the process of being added */
    newView = (parent, depth, frameBeingCreated) => {
      console.assert(model, "Model is supposed to be initialized already!");
      let [a,b,c,d,e,f] = model.get("transform");
      let xform = [a/theD,b/theD, c/theD,d/theD, e,f];
      let el = es("g", {class:"frame", transform:xform},
                  [es("g", {class:"frame-shapes"})]);
      parent.appendChild(el);
      // A frame needs its shapes
      for (let shape of activeShapes()) {
        shape.newView( frameShapes(el) )}
      // If this should be a branch: make a forest of nodes of the depth level
      if (depth > 0) {
        el.appendChild( makeLayer(depth-1, frameBeingCreated) );}

      views.push({parent:parent, el:el, depth:depth});
      return el;}}
  else {// This is a normal shape
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
    function oMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      var m;
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
        let s = 1 - Math.min(x,y);
        m = [a*s,b*s, c*s,d*s, a+c+e-a*s-c*s,b+d+f-b*s-d*s];}
      else {
        // The fixed point is the bottom-right: [a+c+e, b+d+f]
        let s = (+d*dx - c*dy)/(b*c - a*d) + 1
        let t = (-b*dx + a*dy)/(b*c - a*d) + 1;
        m = [s*a,s*b, t*c,t*d, a+c+e-s*a-t*c,b+d+f-s*b-t*d];}

      setUndoable({transform: m});}

    function iMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      var m;
      // Control key: just set the i-vector to whatever that is
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
        m = [x*a,x*b, x*c,x*d, e+c-x*c,f+d-x*d];}
      else if (evt.ctrlKey) {
        m = [a+dx,b+dy, c,d, e,f];}
      else {
        let s = 1 + (-d*dx + c*dy)/(b*c - a*d);
        let t = 1 + (-b*dx + a*dy)/(b*c - a*d);
        m = [s*a,s*b, t*c,t*d, e+c-t*c,f+d-t*d];}

      setUndoable({transform: m});}

    function jMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      var m;
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
        m = [y*a,y*b, y*c,y*d, e+a-y*a,f+b-y*b];}
      else if (evt.ctrlKey) {
        m = [a,b, c+dx,d+dy, e,f];}
      else {
        let s = 1 + (d*dx - c*dy)/(b*c - a*d);
        let t = 1 + (b*dx - a*dy)/(b*c - a*d);
        m = [s*a,s*b, t*c,t*d, e+a-s*a,f+b-s*b];}

      setUndoable({transform: m});}

    function ijMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      var m;
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
        let s = Math.max(x,y);
        m = [a*s,b*s, c*s,d*s, e,f];}
      else {
        let s = -(d*dx - c*dy)/(b*c - a*d) + 1
        let t = +(b*dx - a*dy)/(b*c - a*d) + 1;
        // The fixed point is the top-left: [e,f]
        m = [s*a,s*b, t*c,t*d, e,f];}

      setUndoable({transform: m});}

    function oiMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      let [_s,t] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
      let tt = 1-t;
      setUndoable({transform: [a,b, c*tt,d*tt, e+c*t,f+d*t]});}

    function ojMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      let [s,_t] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
      let ss = 1-s;
      setUndoable({transform: [a*ss,b*ss, c,d, e+a*s,f+b*s]});}

    function i_ijMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      let [s,_t] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
      setUndoable({transform: [a*s,b*s, c,d, e,f]});}

    function j_ijMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.get("transform");
      let [_s,t] = factor([a,b,c,d,e,f], mouseMgr.getMousePos());
      setUndoable({transform: [a,b, c*t,d*t, e,f]});}

    var rotPivot, rotMatrix, rotAngle;  // set whenever the rotator is pressed
    function rotator() {
      let [x,y] = mouseMgr.getMousePos();  // mouse position in svg coordinate
      let [ox,oy] = rotPivot;
      setUndoable({transform: translate(rotate(translate(rotMatrix, [-ox,-oy]),
                                               (Math.atan2(y-oy,x-ox) - rotAngle)),
                                        [ox,oy])})}

    // Corners
    var iCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(iMove)})
    var jCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(jMove)});
    var oCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(oMove)});
    var ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(ijMove)});
    // Side controls
    var i_ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(i_ijMove)});
    var j_ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(j_ijMove)});
    var oiCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(oiMove)});
    var ojCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(ojMove)});
    // Rotator
    let hitbox = es("rect", {x:0,y:0, width:1,height:1,
                             fill:"transparent",
                             stroke:"transparent",
                             "vector-effect":"non-scaling-stroke"})
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
                          stroke:"red", cursor:"move"},
                    // Specified in 0-1 coord
                    [es("path", {d:"M .5 0 A .5 .5 0 1 1 0 .5",
                                 fill:"transparent", "vector-effect":"non-scaling-stroke"}),
                     es("line", {x1:0, y1:.5, x2:-.2, y2:.7,"vector-effect":"non-scaling-stroke"}),
                     es("line", {x1:0, y1:.5, x2:.2, y2:.7,"vector-effect":"non-scaling-stroke"}),
                     hitbox])
    controls = es("g", {visibility:"hidden"},
                  [oCtr, iCtr, jCtr, ijCtr,  // Corners
                   oiCtr, ojCtr, i_ijCtr, j_ijCtr,  // Sides
                   rotCtr]);}

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
        switch (k) {
        case "x1":
          setAttr(endpoint1, {cx: v}); break;
        case "y1":
          setAttr(endpoint1, {cy: v}); break;
        case "x2":
          setAttr(endpoint2, {cx: v}); break;
        case "y2":
          setAttr(endpoint2, {cy: v}); break;}}}}
  else {
    // This function is in charge of modifying the controller's locations
    updateFn = (k,v) => {
      for (let {el} of views) { setAttr(el, {[k]: v}) }

      if (k == "transform") {
        // transform is applied directly to the box
        setAttr(box, {transform: v});
        // Adjust controllers' positions
        let [a,b,c,d,e,f] = v;
        let tl = [e,f];
        let tr = [a+e,b+f];  // [a,b] + [e,f]
        let bl = [c+e,d+f];
        let br = [a+c+e,b+d+f];
        // The rotator location
        let w = cornerWidth / 2;
        let dist = distance(tl, br);
        setAttr(rotCtr, {transform: [20,0, 0,20,
                                     // The rotator lines up with the tl and br corners
                                     e-4*w*(a+c)/dist, f-4*w*(b+d)/dist]});
        // The corners' locations
        setAttr(oCtr,  {cx:tl[0], cy:tl[1]});
        setAttr(iCtr,  {cx:tr[0], cy:tr[1]});
        setAttr(jCtr,  {cx:bl[0], cy:bl[1]});
        setAttr(ijCtr, {cx:br[0], cy:br[1]});
        // The side controls' locations
        setAttr(oiCtr,   {cx:a/2+e, cy:b/2+f});
        setAttr(ojCtr,   {cx:c/2+e, cy:d/2+f});
        setAttr(i_ijCtr, {cx:a+c/2+e, cy:b+d/2+f});
        setAttr(j_ijCtr, {cx:a/2+c+e, cy:b/2+d+f});

        // Frames more things to take care of:
        if (type == "frame") {
          // Transform of axes
          setAttr(axes, {transform:v})
          // Nested stuff
          let xform = [a/theD,b/theD, c/theD,d/theD, e,f];
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
  // All mouse event handlers must implement this
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
    // Add the controls to the DOM
    controlLayer.appendChild(controls);
    boxLayer.appendChild(box);
    if (type == "frame") {
      axesLayer.appendChild(axes)}

    // Add the views
    assert(views.length == 0);
    let layers = getLayers();
    if (type == "frame") {
      if (activeFrames().length == 0) {
        // If there was no nested frames before, then the tree technically only has zero-depth (in the DOM).
        // Since it's pointless to have overlapping elements
        newView(frameNested(root), treeDepth-1, this)}
      else {
        var depth = 0;
        // Exclude the leaves, which don't have nested frames
        for (let layer of layers.slice(0,-1)) {
          for (let frame of layer) {
            assert(frame.getAttribute("class") == "frame");
            newView(frameNested(frame), treeDepth-depth-1, this);}
          depth++;}}}

    else {// None-frames
      for (let layer of layers) {
        for (let frame of layer) {
          newView(frameShapes(frame))}}}

    active = true;}
  this.register = register;

  function deregister() {
    // Remove from DOM, the shape's still around for undo/redo
    state.unfocus(that);
    active = false;
    for (let {el} of views) { el.remove() }
    views.length = 0;  // Wipe out the views too, since it will be created a new when registered
    controls.remove();
    box.remove();
    if (type == "frame") { axes.remove() }}
  this.deregister = deregister;

  if (type == "frame") {
    function cleanUpLeaves() {
      // Remove leaves that were detached from the DOM (whose parent is null)
      // Oh my God this is ugly!
      let len = views.length;
      assert(len > 0, "If it has no views, then it wouldn't have leaves");

      // This loop applies to the leaves
      var i;
      for (i = len-1; i >= 0; i--) {
        if (views[i].el.parent) {
          // Remove everything we've looped over
          views.length = i+1;
          break;}}}
    this.cleanUpLeaves = cleanUpLeaves;}}

var treeDepth = 1;  // Depth of the deepest node
function frameShapes(frame) {return frame.children[0]}
function frameNested(frame) {return frame.children[1]}
function isLeaf(frame) {
  return (frame.getElementsByClassName("frame-nested").length == 0);}

/** Make frames of "depth", then put them to a group */
function makeLayer(depth, frameBeingCreated) {
  let g = es("g", {class:"frame-nested"});
  let frames = activeFrames();
  if (frameBeingCreated) frames.push(frameBeingCreated)
  for (let frame of frames) {
    frame.newView(g, depth, frameBeingCreated)}
  return g;}

// A layer is list of frames (DOM frames, that is)
function getLayers() {
  // The first layer is the shape layer
  let res = [[root]];
  var lastLayer = [root];
  if (activeFrames().length != 0) {
    // the DOM has zero depth if there's only the identity frame
    while (true) {
      var newLayer = [];
      assert(lastLayer.length > 0, "There can't be an empty layer?");
      if (isLeaf(lastLayer[0])) break;
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

/** Decrement the current frame count */
function decDepth() {
  assert(treeDepth > 0);
  let layers = getLayers();
  // Again, there's a space case when there's no nested frame
  if (layers.length > 1) {
    for (let frame of layers[layers.length-2])
      frameNested(frame).remove();
    for (let frame of activeFrames())
      frame.cleanUpLeaves();}

  treeDepth--;}

// What happens when the user clicks the "create button"
function newShape(type, mold) {
  let s = new Shape(type, mold);
  s.register();  // Put controls & views in the DOM
  if (type == "frame") frameList.push(s)
  else shapeList.push(s);
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
  root = es("g", {id:"root", class:"frame"},
            [es("g", {class:"frame-shapes"}),
             es("g", {class:"frame-nested"})]);
  controlLayer = es("g", {id:"controls"});
  boxLayer = es("g", {id:"boxes"});
  // This is the only "onMouseMove" event
  function surfaceOnMouseMove(evt) {
    if (evt.buttons == 1) {
      mouseMgr.handle(evt);
      let focused = state.getFocused();
      if (focused &&
          ((evt.movementX != 0) || (evt.movementY != 0))) {
        // If dragging & there's a listener, we checked for zero since there's a bug with "ctrl+click" that triggerse this event, even when there's no movement
        focused.respondToDrag(evt);
        // Cancel bubble, so svg won't get pan/zoom event
        evt.cancelBubble = true;}}}

  // This layer holds all the axes, so we can turn them all on/off
  axesLayer = es("g", {id:"axes"},
                 [// The identity frame (decoration)
                   es("use", {id:"the-frame", href:"#frame",
                              transform:[theD,0, 0,theD, 0,0]})])

  svg_el = es("svg", {id:"svg", width:W+1, height:H+1, fill:"black"},
              // "W+1" and "H+1" is to show the grid at the border
              // pan-zoom wrapper wrap around here
              [es("g", {id:"surface",
                        onMouseMove: surfaceOnMouseMove,
                        onMouseUp: (evt) => {
                          controlChanged = true;
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
                    axesLayer, root, boxLayer, controlLayer])]);

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

               e("span", {}, [et(" | ")]),
               // Save to file
               e("button", {onClick:(evt) => saveDiagram()},
                 [et("Save")]),
               // Load from file
               e("button", {onClick:(evt) => triggerUpload()},
                 [et("Load")]),

               e("span", {}, [et(" | ")]),
               // Undo/Redo buttons
               undoBtn, redoBtn,

               e("span", {}, [et(" | ")]),
               // Changing depth
               e("input", {type:"number", name:"Depth", min:1, max:20,
                           value:treeDepth,
                           onchange:(evt) => {
                             let v = parseInt(evt.target.value);
                             if (v < treeDepth) {
                               while (treeDepth > v) {decDepth()}}
                             else if (v > treeDepth) {
                               while (treeDepth < v) {incDepth()}}}}),

               e("span", {}, [et(" | ")]),
               // Toggling grid
               e("button", {onclick: (evt) => {
                 let v = getComputedStyle(axesLayer).visibility;
                 let V = (v == "visible") ? "hidden" : "visible";
                 setAttr(axesLayer, {visibility: V})}},
                 [et("Axes")]),
             ]);
  app.appendChild(UI);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#svg", {dblClickZoomEnabled: false,
                                // Don't do any bullshit on startup
                                fit:false, center:false});
  panZoom.pan({x:20, y:20});}
