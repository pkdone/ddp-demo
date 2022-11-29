require("dotenv").config();
const {context_values_get, logStartTimestamp, logEndTimestampWithJSONResult, PRIV_getDBCollection, PRIV_logErrorAndReturnGenericError, PRIV_ensureRequestResponseExist, getDummyRequestResponse } = require("./app-svcs-utils");


// TEST WRAPPER  (similar to App Services' function test console, but for standalone node.js)
(async() => {
  logStartTimestamp();

  // TEST TO RUN  (only uncomment one test)
  //let result = await PRIV_getLastTradedPriceForExchangeSymbolAsOf("AHD3M", new Date("2022-03-22T01:01:43.828Z"));
  //let result = await PRIV_getDayOpenCloseHighLowAvgTradedPriceForExchangeSymbol("AHD3M", new Date("2022-03-22T01:01:43.828Z"));
  const {request, response} = getDummyRequestResponse({symbol: "AHD3M", date: "2022-03-22T01:01:43.828Z"});
  let result = await GET_lastTradedPriceForExchangeSymbolAsOf(request, response);
  //let result = await GET_dayOpenCloseHighLowAvgTradedPriceForExchangeSymbol(request, response);  
  //let result = await POST_doThisThat(request, response);

  logEndTimestampWithJSONResult(result);
})();


//
// REST Get API wrapper for getting the last tradded price for a symbol as of a particular date.
//
// Curl example to invoke when deployed in App Svcs:
//  curl curl https://eu-west-1.aws.data.mongodb-api.com/app/ddp-demo-XXXX/endpoint/lastTradedPriceForExchangeSymbolAsOf?secret=65c5d45db35102312f000bab628e4b61\&symbol=AHD3M\&date=2022-03-22T01:01:43.828Z
//
async function GET_lastTradedPriceForExchangeSymbolAsOf(request, response) {
  const func = (typeof context === "undefined") ? PRIV_getLastTradedPriceForExchangeSymbolAsOf
                                                : "PRIV_getLastTradedPriceForExchangeSymbolAsOf";
  return await PRIV_restGetAPISymbolPlusDataWrapper(request, response, func);
}



//
// REST Get API wrapper for getting the open, close, high, low & average traded proces for a
// specific exchange symbox for a  specific day
//
// Curl example to invoke when deployed in App Svcs:
//  curl curl https://eu-west-1.aws.data.mongodb-api.com/app/ddp-demo-XXXX/endpoint/GET_dayOpenCloseHighLowAvgTradedPriceForExchangeSymbol?secret=65c5d45db35102312f000bab628e4b61\&symbol=AHD3M\&date=2022-03-22T01:01:43.828Z
//
async function GET_dayOpenCloseHighLowAvgTradedPriceForExchangeSymbol(request, response) {
  const func = (typeof context === "undefined") ? PRIV_getDayOpenCloseHighLowAvgTradedPriceForExchangeSymbol
                                                  : "PRIV_getDayOpenCloseHighLowAvgTradedPriceForExchangeSymbol";
  return await PRIV_restGetAPISymbolPlusDataWrapper(request, response, func);
}



//
// Check symbol and data paramrters provided via the REST API call and then invoke the target 
// implementation function
//
async function PRIV_restGetAPISymbolPlusDataWrapper(request, response, apiFunction) {
  ({request, response} = PRIV_ensureRequestResponseExist(request, response));

  try {
    const symbol = (request.query.hasOwnProperty('symbol')) ? request.query.symbol : '';
    const dateText = (request.query.hasOwnProperty('date')) ? request.query.date : '';

    if (!symbol || !dateText) {
      response.setStatusCode(400);
      return {"errorMessage": "User error - please provide params for both 'symbol' and 'date'"};
    }

    const date = new Date(dateText);

    if (isNaN(date)) {
      response.setStatusCode(400);
      return {"errorMessage": "User error - please the date param in the correct format, e.g.: '2021-12-31T23:59:59.999Z'"};
    }

    let result = (typeof apiFunction === "function") ?
      await apiFunction(symbol, date) :
      await context.functions.execute(apiFunction, symbol, date);

    return {result: result};
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
  ({request, response} = PRIV_ensureRequestResponseExist(request, response));

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
// Get the last tradded price for a symbol as of a particular date.
//
// db.trades_ts.explain("executionStats").find({exchange_symbol: 'AHD3M', ts: {$lte: ISODate("2022-03-22T01:01:43.828Z")}})
//
async function PRIV_getLastTradedPriceForExchangeSymbolAsOf(symbol, date) {
  const collName = PRIV_getConstant("TRADES_TS_COLLNAME");  
  const coll = PRIV_getDBCollection(collName);  
  const queryFilter = {"exchange_symbol": symbol, "ts": date};
  const queryProjection = {"_id": 0, "exchange_symbol": 1, "ts": 1, "price": 1};
  const queryOptions = {projection: queryProjection};  // Used by standalone node.js only
  // ACTION: UNCOMMENT   (atlas-app-svcs only)
  //return await coll.findOne(queryFilter, queryProjection);
  // ACTION: REMOVE   (node.js only)
  return await coll.findOne(queryFilter, queryOptions); 
}


//
// Get the open, close, high, low & average traded proces for a specific exchange symbox for a 
// specific day
//
// db.orders.explain("executionStats").aggregate(pipeline);
//
async function PRIV_getDayOpenCloseHighLowAvgTradedPriceForExchangeSymbol(symbol, date) {
  const collName = PRIV_getConstant("TRADES_TS_COLLNAME");  
  const coll = PRIV_getDBCollection(collName); 
  const startDatetime = new Date(date); 
  startDatetime.setHours(0, 0, 0, 0);
  const endDatetime = new Date(date); 
  endDatetime.setHours(23, 59, 59, 999);  

  const pipeline = [  
    {"$match": {
      "exchange_symbol": symbol,
      "ts": {
        "$gt": startDatetime,
        "$lte": endDatetime,
      },
    }},
  
    {"$group": {
      "_id": "",
      "open": {"$first": "$price"},
      "close": {"$last": "$price"},
      "high": {"$max": "$price"},
      "low": {"$min": "$price"},
      "avg": {"$avg": "$price"},
    }},

    {"$unset": [
      "_id",
    ]},     
  ];    

  return coll.aggregate(pipeline).toArray();
}


//
// Get project constants (need to wrap these in a function as need a way to share these between Atlas App Services functions
// 
function PRIV_getConstant(key) {
  const CONSTANTS = {
    TRADES_TS_COLLNAME: "trades_ts",
  };

  return CONSTANTS[key];
}
