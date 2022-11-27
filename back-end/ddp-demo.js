require("dotenv").config();
const {context_values_get, logJSONResult, PRIV_getDBCollection, PRIV_getRequestQueryParam,
       PRIV_logErrorAndReturnGenericError, getDummyRequestResponse } = require("./app-svcs-utils");


// TEST WRAPPER  (similar to App Services' function test console)
(async() => {
  console.log(`START: ${new Date()}`);
  const {request, response} = getDummyRequestResponse({myParam: 'hello', myOtherParam: 'goodbye'});
  let result = await GET_doSomething(request, response);
  //let result = await POST_doThisThat(request, response);
  logJSONResult(result);
  console.log(`END: ${new Date()}`);
})();


//
// Example function which will be turned into HTTP GET Endpoint
//
// Curl example to invoke when deployed in App Svcs:
//  curl https://x.y.com/app/appname/endpoint/doSomething?secret=376327322\&myParam=hello
//
async function GET_doSomething(request, response) {
  try {
    console.log(`Starting doing something at: ${new Date()}`);
    const myParam = PRIV_getRequestQueryParam(request, 'myParam');
    console.log(`Param received: ${myParam}`);
    const num = await PRIV_querySomthingAndLog();
    await PRIV_persistSomething(`Got ${num} records`);
    console.log(`Ending doing something at: ${new Date()}`);
    return {result: `Got ${num} records and saved a new record`};
  } catch (error) {
    return PRIV_logErrorAndReturnGenericError(error, response);
  }
}


//
// Example function which will be turned into HTTP POST Endpoint
//
// Curl example to invoke when deployed in App Svcs:
//  curl -H "Content-Type: application/json" -d '{"myParam": "hello", "myOtherParam": "goodbye"}' https://x.y.com/app/appname/endpoint/doSomething?secret=376327322
//
async function POST_doThisThat(request, response) {
  try {
    console.log(`Doing this and that at: ${new Date()}`);
    const bodyText = request.body.text();
    console.log(bodyText);
    const payload = JSON.parse(bodyText);
    console.log(`Received JSON payload: ${JSON.stringify(payload)}`);
    return {received: payload};
  } catch (error) {
    return PRIV_logErrorAndReturnGenericError(error, response);
  }
}


//
// Query some shit
//
async function PRIV_querySomthingAndLog(orgConfig) {
  console.log(`Querying something`);
  const collName = PRIV_getConstants().XXDATA_COLLNAME;  
  const coll = PRIV_getDBCollection(collName);  
  const queryFilter = {"message" : {"$ne": ""}};
  const queryProjection = {"_id": 0, "timestamp": 1, "message": 1};
  const querySort = {"timestamp": -1};
  const queryLimit = 1000;
  const queryOptions = {projection: queryProjection, sort: querySort, limit: queryLimit};  // Used by standalone node.js only
  // ACTION: UNCOMMENT   (don't edit this line - action picked up when the code is converted to AppSvcs functions)
  //const resultArray = await coll.find(queryFilter, queryProjection).limit(queryLimit).sort(querySort).toArray();
  // ACTION: REMOVE   (don't edit this line - action picked up when the code is converted to AppSvcs functions)
  const resultArray = await coll.find(queryFilter, queryOptions).toArray(); 
  // Would really do something better than just print out
  console.log(`Collection contains ${resultArray.length} records`);
  return resultArray.length;
}


//
// Persist some shit
//
async function PRIV_persistSomething(message) {
  console.log(`Peristing msg: ${message}`);
  const collName = PRIV_getConstants().XXDATA_COLLNAME;  
  const coll = PRIV_getDBCollection(collName);
  await coll.insertOne({"timestamp": new Date(), "message": message});   
  console.log(`Peristed msg: ${message}`);
}


//
// Get project constants (need to wrap these in a function as need a way to share these between Atlas App Services functions
// 
function PRIV_getConstants() {
  return {
    XXDATA_COLLNAME: "xxdata",
    YYDATA_COLLNAME: "yydata",
    ZZDATA_COLLNAME: "zzdata",
  }
}
