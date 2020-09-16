/** This is a frontend file */
var userId;

async function onSignIn(googleUser) {
  let profile = googleUser.getBasicProfile();
  userId = profile.getId();
  log("userID is: " + userId);

  {let id_token = googleUser.getAuthResponse().id_token;
   let config = await configPromise;
   let res = await fetch(`${config.BACKEND}/token-signin`, {
     method : "POST",
     headers: {"Content-Type": "application/json"},
     body   : JSON.stringify({token: id_token})});
   let whatever = await res.json();
   log(`Backend response: ${whatever}`)}}

function signOut() {
  let auth2 = gapi.auth2.getAuthInstance();
  auth2.signOut().then(() => {
    log("User signed out.");});
  userId = null;}
