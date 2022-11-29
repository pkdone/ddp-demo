module.exports = { context_values_get, logStartTimestamp, logEndTimestampWithJSONResult, PRIV_getDBCollection, PRIV_logErrorAndReturnGenericError, PRIV_ensureRequestResponseExist, getDummyRequestResponse };


//
// Stand-in replacement for Atlas App Services "context.values.get()" (in the app services project
// the app services secret associated with a value will be used instead).
// Only used when running this code in standaline node.js (not in Atlas App Services)
// 
function context_values_get(key) {
  const value = process.env[key];

  if ((!value) || (value.trim().length <= 0)) {
    throw `Unable to locate the key-value pair for '${key}' in the '.env' file in this project's root folder - ensure this file exists and contains the key-value pair`;
  }

  return value;
}


//
// Log the start timestamp.
//
// Only used when running this code in standalone node.js (not in Atlas App Services)
//
function logStartTimestamp(result) {
  console.log(`START: ${new Date()}`);
}


//
// Log the result JSON to the console and also a log file cos it may be really larger, also
// logging end timestamp.
//
// Only used when running this code in standalone node.js (not in Atlas App Services)
//
function logEndTimestampWithJSONResult(result) {
  result = result || "<empty-result>";
  const fs = require("fs");
  console.log(JSON.stringify(result, null, 2));
  const TESTING_OUPUT_FILE = "tmp/results.json";
  fs.writeFileSync(TESTING_OUPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`Test output file is at: ${TESTING_OUPUT_FILE}`);
  console.log(`END: ${new Date()}`);
}


//
// Constructs dummy / mock request and response objects for testing functions intended to be for 
// REST API calls.

// Only request when running tests in satnadline node.js
//
function getDummyRequestResponse(dummyParameters) {
  return PRIV_ensureRequestResponseExist(null, null, dummyParameters);
}


//
// Ensures there is a request and response already present and if not creates placeholder versions.
//
// Required in Atlas App Services when running funcitons intended for HTTPS Endpoints direction 
// from the console
//
// Required in Standaloine node.js to enable the same code to work - in this case usually the 
// 'dummayParameters' is also provided with fake GET/POST values for testing standalone
//
function PRIV_ensureRequestResponseExist(request, response, dummyParameters = {}) {
  if (typeof request === 'string') {
    request = {param1: request};
  } else if (!request) {
    request = {};
  }

  request.body = request.body || {};

  if (!request.body.text) {
    request.body.text = () => JSON.stringify(dummyParameters, null, 2);
  }

  request.query = request.query || dummyParameters;
  response = response || {};
  response.setStatusCode = () => {};
  return {request, response};
}


//
// Get handle on main DB collection (mechanism varies if running in App Servicies vs standalone)
//
function PRIV_getDBCollection(collname) {
  let client;

  if (typeof context !== "undefined") {   // If running code inside Atlas App Services functions
    client = context.services.get("mongodb-atlas"); 
  } else {
    const {MongoClient} = require("mongodb");  // If running code standalone in node.js
    client = new MongoClient(context_values_get("DEV_ONLY_MONGODB_URL"));  
  }

  const dbName = context_values_get("DB_NAME");  
  const db = client.db(dbName);
  return db.collection(collname);
}


//
// Log error, then if in dev mode throw error again so full root cause can be seen, otherwise
// return generic error message
//
function PRIV_logErrorAndReturnGenericError(error, response) {
  console.error("Problem executing function");
  console.error(error);

  if (response) {
    response.setStatusCode(500);
  } else {
    throw error;
  }

  return ({msg: "Internal error"});
}


//
// Get the current value of the secret used for invoking HTTPS endpoints from a logged in UI
//
function PUB_getHTTPSTmpPwd() {
  return context_values_get("HTTPS_TMP_PWD");
}


//
// Always signal that a password reset should not occur by returning 'status: fail'
//
function PUB_resetUserLoginPasswdFail() {
  return {status: "fail"};
}


//
// Rotate the secret, used for invoking HTTPS endpoints from a logged in UI, to a new random value
//
async function PRIV_rotateHTTPSTmpPwd() {
  let {baseAppSrvsUrl, projectId, appId, accessToken} = await PRIV_bootsrapToAtlasAppServicesAppRuntime();
  const secretsListResponse = await PRIV_invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/groups/${projectId}/apps/${appId}/secrets`, "GET", accessToken, null);
  const SECRET_KEY_ID = "HTTPS_TMP_PWD_SECRET";
  const secretId = PRIV_getValueFieldForFirstKeyOccurenceInArrayOfObjects(secretsListResponse, "name", SECRET_KEY_ID, "_id");
  const crypto = require("crypto");
  const randomString = crypto.randomBytes(16).toString("hex");  
  await PRIV_invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/groups/${projectId}/apps/${appId}/secrets/${secretId}`, "PUT", accessToken, {name: SECRET_KEY_ID, value: randomString});  
  console.log(`Rotated password for secret: ${SECRET_KEY_ID}`);
  return {result: "TMP_PWD_ROTATED"};
}


//
// Using the App Services Admin API invokve "enable virtual hosting" on this app services application
// because can't do make this happen just in app json config
//
async function PUB_enableAppVirtualHosting() {
  let {baseAppSrvsUrl, projectId, appId, accessToken} = await PRIV_bootsrapToAtlasAppServicesAppRuntime();
  await PRIV_invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/groups/${projectId}/apps/${appId}/hosting/config`, "PATCH", accessToken, {enabled: true});
  return ` Enabled virtual hosting for app `;
}


//
// Using Atlas App Services API connect to the remote project capturing some key context variables
//
async function PRIV_bootsrapToAtlasAppServicesAppRuntime() {
  const baseAppSrvsUrl = "https://realm.mongodb.com/api/admin/v3.0";    
  const projPubKey = context_values_get("ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY");
  const projPrvKey = context_values_get("ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY");
  const loginResponse = await PRIV_invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/auth/providers/mongodb-cloud/login`, "POST", null, {username: projPubKey, apiKey: projPrvKey});
  const accessToken = loginResponse.access_token;
  let projectId;
  let appId;

  if (typeof context !== "undefined") {
    // If running in App Services then can get required data from runtime 'context' object
    projectId = context.app.projectId;
    appId = context.app.id;
  } else {
    // If running in local node.js use local env vars and get app id from association with app name
    projectId = context_values_get("PROJECT_ID");
    const appName = context_values_get("APP_NAME");
    const appsListResponse = await PRIV_invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/groups/${projectId}/apps`, "GET", accessToken, null);
    appId = PRIV_getValueFieldForFirstKeyOccurenceInArrayOfObjects(appsListResponse, "name", appName, "_id");
  }

  return {baseAppSrvsUrl, projectId, appId, accessToken};
}


//
// Find a matching object from an array of objects (where the given key and its value matches) then
// return the value of a specifed property of the matching object
//
function PRIV_getValueFieldForFirstKeyOccurenceInArrayOfObjects(arrayOfObjects, matchKeyName, matchKeyValue, returnFieldName) {
  const foundObject = arrayOfObjects.find(obj => obj[matchKeyName] === matchKeyValue);
  return foundObject ? foundObject[returnFieldName] : null;
}


//
// Call an App Services Admin REST HTTP API resource
//
async function PRIV_invokeAppSvcsAdminAPIResource(url, method, accessToken, jsonDataToSend) {
  const axios = require("axios").default;  
  let request = {
    url: url,
  }

  request.method = method;
  request.headers = {};
  request.headers["Accept"] = "application/json";

  if (accessToken) {
    request.headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (jsonDataToSend) {
    request.headers["Content-Type"] = "application/octet-stream";
    request.data = jsonDataToSend;
  } 
  
  let resourceObject = {};

  try {
    const response = await axios(request);
    resourceObject = response.data;
  } catch (error) {
    console.error(`Error invoking App Services Admin API resource: ${url}`);
    console.error(error);
    throw error;
  }

  return resourceObject;
}


//
// Using the App Services Admin API invokve "enable virtual hosting" on this app services
// application because can't do make this happen just in app json config
//
async function PUB_getAppVirtualHostingURL() {
  let hostingUri = "";

  // If running in App Services then  get URL from runtime 'context' object, else can't do anything
  if (typeof context !== "undefined") {
    let numTries = 0;

    // Loop wait 2 secs each time between each try for CDN hosting and DNS to update (max total
    // time to spend trying is 1 minute)
    while (numTries < 30) {
      hostingUri = context.app.hostingUri;

      if (hostingUri) {
        break;
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      numTries++;
    } 
  }

  return hostingUri ? ` App virtual hosting URL:  https://${hostingUri}/ ` : " ";
}
