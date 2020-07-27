// These models define shape and their associated controls
// Note: "tag" denotes the DOM element's tag, other attributes are consistent with my DOM model
let HL_COLOR = "#0000FF55"
let commonMold = {stroke:"black",
                  "vector-effect": "non-scaling-stroke"};
let shapeFill = "#dd87e0";
let rectMold = {...commonMold, tag:"rect",
                width:1, height:1, fill:shapeFill};
let circMold = {...commonMold, tag:"circle",
                cx:0.5, cy:0.5, r:0.5, fill:shapeFill};
let trigMold = {...commonMold, tag:"path",
                d:"M 0.5 0 L 0 1 H 1 Z", fill:shapeFill};
let lineMold = {...commonMold, tag: "line"};
let lineBoxMold = {...lineMold, class:"line-box-mold",
                   "stroke-width":20, stroke:HL_COLOR};

let boxMold = {...commonMold, class:"box-mold", tag:"rect",
               width:1, height:1, fill:HL_COLOR, stroke:"transparent"};
let cornerWidth = 20;
let cornerMold = {...commonMold, tag:"circle", r:cornerWidth/2,
                  fill:"transparent", stroke:"red", cursor:"move"};
let frameMold = {tag:"use", href:"#frame"};
