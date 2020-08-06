let abs = Math.abs;
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
