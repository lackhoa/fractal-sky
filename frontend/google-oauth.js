/** This is a frontend file */
var userId;

function onSignIn(googleUser) {
  let profile = googleUser.getBasicProfile();
  userId = profile.getId();
  log("ID: " + userId);}

function onFailure(error) {log(error);}

function signOut() {
  let auth2 = gapi.auth2.getAuthInstance();
  auth2.signOut().then(function () {
    log("User signed out.");});
  userId = null;}
