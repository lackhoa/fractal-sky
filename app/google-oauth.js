function onSignIn(googleUser) {
  let profile = googleUser.getBasicProfile();
  // Do not send to your backend! Use an ID token instead.
  log("ID: " + profile.getId());}

function onFailure(error) {log(error);}

function signOut() {
  var auth2 = gapi.auth2.getAuthInstance();
  auth2.signOut().then(function () {
    log("User signed out.");});}
