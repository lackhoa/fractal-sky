/** This is a frontend file */
var userId;

async function onSignIn(googleUser) {
  let profile = googleUser.getBasicProfile();
  userId = profile.getId();
  log("userID is: " + userId);

  {let id_token = googleUser.getAuthResponse().id_token;
   // #Todo: Change to "fetch"
   let xhr = new XMLHttpRequest();
   let config = await configPromise;
   xhr.open("POST", config.BACKEND + "/token-signin");
   xhr.setRequestHeader("Content-Type", "application/json");
   xhr.onload = () => {console.log("Backend response: " + xhr.responseText);};
   xhr.send(JSON.stringify({token: id_token}));}}

function signOut() {
  let auth2 = gapi.auth2.getAuthInstance();
  auth2.signOut().then(() => {
    log("User signed out.");});
  userId = null;}
