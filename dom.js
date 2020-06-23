let EVENT_LIST = ["onMouseMove", "onMouseEnter", "onMouseLeave", "onMouseUp", "onMouseDown", "onClick", "onChange"];

function setAttr(el, data) {
  for (let [k, v] of Object.entries(data)) {
    if (k == "transform") {
      console.assert(v.length == 6);  // `v` is a 6-array
      el.setAttribute("transform", `matrix(${v.join(" ")})`)}
    else if (k == "style") {
      for (let [sk, sv] of Object.entries(v)) {el.style[sk] = sv}}
    else if (EVENT_LIST.includes(k)) {
      // Don't include these as attributes, better performance and avoid ES5/6 bugs
      // The "substring" is to remove the "on", because... I don't fucking know?
      el.addEventListener(k.substring(2).toLowerCase(), v)}
    else {el.setAttribute(k, v)}}
  return el;}

// Element-creation functions
function e(tag, data, children=[]) {
  // "data.type" holds the type of the element
  let ns = data.xmlns || "http://www.w3.org/1999/xhtml";
  let el = document.createElementNS(ns, tag);
  setAttr(el, data);
  for (let c of children) {el.appendChild(c);};
  return el;}
let SVG_NS = "http://www.w3.org/2000/svg";
// Create svg element
function es(tag, data, children=[]) {
  return e(tag, {...data, xmlns:SVG_NS}, children);}
function et(text) {
  return document.createTextNode(text);}
