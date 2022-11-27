require('dotenv').config();
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const readline = require('readline');


//
// Main conversion utility.
//
// Uses content of "app-svcs-app-template" to form the base structure for a generated project into
// the folder "app", setting the app's is in the project config on the fly,
//
// Functions with the following prefixes in their names will all be converted to App Services
// functions (extra specific behaviour shown in brackets):
//
//  * GET_ or PUT_ or DELETE_ or PATCH_  (set to private and an HTTPS Endpoint is created with
//                       "query string" auth enabled based on a secret called HTTPS_TMP_PWD_SECRET)
//  * PUB_  (set to public)
//  * PRIV_  (et to private)
//
// Functions without the above prefixes will not be included in the app services app.
//
// Add one of the following new lines to an existing line in the source code if you want the
// existing line to then be commented/uncommented/removed during the code conversion process:
//
//     // ACTION: COMMENT
//     // ACTION: UNCOMMENT
//     // ACTION: REMOVE
//
// Replaces use of "context_values_get()" with the app services function "context.values.get()".
//
// Wraps calls from one function to another inside "context.functions.execute()" to enable the
// function invocation to work in App Services.
//
(async() => {
  const appName = process.env.APP_NAME;
  const dbClusterName = process.env.DB_CLUSTER_NAME;
  const SOURCE_FOLDER = process.env.SRC_FOLDER_NAME;
  const appTemplateDir = "app-svcs-app-template";
  const generatedAppDir = "app";
  await generateAppSrvcsApp(SOURCE_FOLDER, appName, appTemplateDir, generatedAppDir, dbClusterName);
})();


//
// Create the app services app from a template and generating additional parts
//
async function generateAppSrvcsApp(sourceJSFolder, appName, appTemplateDir, appDir, clusterName) {  
  await createSkeletonAppStructure(appDir, appName, appTemplateDir, clusterName);
  await generateFunctionsResourcesForAllSrcFiles(appDir, sourceJSFolder);
  console.log(`Converted standalone Node.js code to Atlas App Services functions and generated new app services app project in sub-folder: ${appDir}`);
}


//
// Copy the template over and replace some config values in some of the JSON with real values
// (e.g. app name)
//
async function createSkeletonAppStructure(appDir, appName, appTemplateDir, clusterName) {  
  fs.rmSync(appDir, {recursive: true, force: true});
  await fsExtra.copy(appTemplateDir, appDir, {overwrite: true});
  replaceTokensInFile(path.join(appDir, 'realm_config.json'), '__APP_NAME__', appName);
  replaceTokensInFile(path.join(appDir, 'data_sources', 'mongodb-atlas', 'config.json'), '__CLUSTER_NAME__', clusterName);
}


//
// Create app services function resource for every function in every JS source file contained in 
// the specific folder
//
async function generateFunctionsResourcesForAllSrcFiles(appDir, sourceJSFolder) {
  const functionsDir = path.join(appDir, 'functions');
  const functionsConfigFile = path.join(functionsDir, 'config.json');
  const httpsEndpointsDir = path.join(appDir, 'http_endpoints');
  const endpointsConfigFile = path.join(httpsEndpointsDir, 'config.json');
  fs.writeFileSync(functionsConfigFile, '[');
  fs.writeFileSync(endpointsConfigFile, '[');
  let isFirstFunc = true;
  let isFirstEndpoint = true;

  for (const file of fs.readdirSync(sourceJSFolder)) {
    const filePath = path.join(sourceJSFolder, file);

    if ((fs.lstatSync(filePath).isFile()) && (filePath.endsWith('.js'))) {
      ({ isFirstFunc, isFirstEndpoint } = await generateFunctionsResourcesForSrcFile(filePath, 
            functionsDir, functionsConfigFile, isFirstFunc, isFirstEndpoint, endpointsConfigFile));
    }
  };

  fs.appendFileSync(endpointsConfigFile, '\n]');
  fs.appendFileSync(functionsConfigFile, '\n]');
}


//
// For a JS source file, extract each of its functions and create a seperate top level function
// source file + config for it. Also if function name starts with REST method prefix then create 
// an HTTPS Endpoont too.
//
async function generateFunctionsResourcesForSrcFile(filename, functionsDir, functionsConfigFile, isFirstFunc, isFirstEndpoint, endpointsConfigFile) {
  const fileStream = fs.createReadStream(filename);
  const lines = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let nextFunction = null;

  for await (const line of lines) {
    const startFuncMatches = line.match(/(.*)function\s\s*(\w*)\((.*)/);

    if (startFuncMatches) {
      nextFunction = {
        functionName: startFuncMatches[2],
        isAsync: startFuncMatches[1].includes('async'),
        functionDeclarationEndLine: startFuncMatches[3],
        content: '',
      };
    } else if (nextFunction) {
      const endFuncMatches = line.match(/^\}.*/);

      if (endFuncMatches) {
        nextFunction.content += '};'; // Add end of function export deliminator
        isFirstFunc = generateFuncContentInNewDirectory(functionsDir, functionsConfigFile, nextFunction, isFirstFunc);
        isFirstEndpoint = generateHTTPSEndpointForFunc(endpointsConfigFile, nextFunction.functionName, isFirstEndpoint);
        nextFunction = null;
      } else {
        nextFunction.content += `${line}\n`; // Add current line as is
      }
    }
  }
  return { isFirstFunc, isFirstEndpoint };
}


//
// Create the JS file config files for invidual JS function
//
 function generateFuncContentInNewDirectory(funcDir, configFile, functionMetadata, isFirstFunc) {
  const FUNCS_TO_TRANSFER_PREFIXES = ['GET_', 'POST_', 'PUT_', 'DELETE_', 'PATCH_', 'PUB_', 'PRIV_'];  
  const matches = functionMetadata.functionName.match(/^(\S+_)\S+/);  // Get the prefix for the function (if any)

  if (matches) {
    const prefix = matches[1];
  
    if (FUNCS_TO_TRANSFER_PREFIXES.indexOf(prefix) < 0) {
      return isFirstFunc;
    }
  } else {
    return isFirstFunc;
  }

  //console.log(` ${functionMetadata.functionName}: exports = ${functionMetadata.isAsync ? 'async ' : ''}function(${functionMetadata.functionDeclarationEndLine}`); 
  generateFunctionConfigFile(isFirstFunc, configFile, functionMetadata);
  generateFunctionJSSourceFile(funcDir, functionMetadata, FUNCS_TO_TRANSFER_PREFIXES); 
  return false;
}


//
// Create the config file for one JSON function
//
function generateFunctionConfigFile(isFirstFunc, configFile, functionMetadata) {
  if (!isFirstFunc) {
    fs.appendFileSync(configFile, ',');
  }

  const isPrivate = functionMetadata.functionName.startsWith("PUB_") ? false : true;
  fs.appendFileSync(configFile, '\n');

  const configJson = `  {
    "name": "${functionMetadata.functionName}",
    "private": ${isPrivate},
    "run_as_system": true,    
    "disable_arg_logs": true
  }`;

  fs.appendFileSync(configFile, configJson);
}


//
// Create the source JS file for one function fixing some of the code where needed to work properly
// in App Services instead of Node.js
//
function generateFunctionJSSourceFile(funcDir, functionMetadata, funcsToTransferPrefixes) {
  const jsFile = `${funcDir}/${functionMetadata.functionName}.js`;
  const newFirstLine = `exports = ${functionMetadata.isAsync ? 'async ' : ''}function(${functionMetadata.functionDeclarationEndLine}\n`;
  fs.appendFileSync(jsFile, newFirstLine);
  let nextLineAction = null;

  for (const line of functionMetadata.content.split(/\r?\n/)) {
    const actionMatches = line.match(/.*ACTION:\s*(\S+)\s*/);

    if (actionMatches) {
      nextLineAction = actionMatches[1];
    } else if (nextLineAction == "REMOVE") {
      // Don't do anything with the line - just throw it away
      nextLineAction = null;
    } else if (nextLineAction == "COMMENT") {
      fs.appendFileSync(jsFile, `  //${line}\n`);
      nextLineAction = null;
    } else if (nextLineAction == "UNCOMMENT") {
      fs.appendFileSync(jsFile, `${line.replace('//', '')}\n`);
      nextLineAction = null;
    } else {
      let modifiedLine = line.replace("context_values_get", "context.values.get");

      for (const funcPrefix of funcsToTransferPrefixes) {
        const newModifiedLine = getModifiedFuncExecutionText(modifiedLine, funcPrefix);

        if (newModifiedLine) {
          modifiedLine = newModifiedLine;
          break;
        }
      }

      fs.appendFileSync(jsFile, `${modifiedLine}\n`);
      nextLineAction = null;
    }
  }
}


//
// Contain a function's call to another func in app services inside a "context.functions.execute()
//
function getModifiedFuncExecutionText(text, funcPrefix) {
  const regex = `(.*)(${funcPrefix}.*)\\((.*)\\)(.*)`;
  const matches = text.match(new RegExp(regex));
  
  if (matches) {
    const prefix = matches[1];
    const funcName = matches[2];
    const params = matches[3];
    const suffix = matches[4];
    let paramsText = "'";

    if (params) {
      paramsText = `', ${params}`;
    } 

    return `${prefix}context.functions.execute('${funcName}${paramsText})${suffix}`;
  }

  return null;
}


//
// Replace every occurrence of a token in a file with a replacement string
//
function replaceTokensInFile(filepath, tokenStr, replaceStr) {
  let content = fs.readFileSync(filepath, {encoding:'utf8', flag:'r'});
  content = content.replace(new RegExp(tokenStr, 'g'), replaceStr);
  fs.writeFileSync(filepath, content);
}


// 
// Create a HTTP endpoint for a name function only if its name is prefixed with API
// 
function generateHTTPSEndpointForFunc(configFile, functionName, isFirstEndpoint) {
  const REST_HTTP_FUNCS_PREFIXES = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];  

  let httpMethod = null;
  let resourceName = null;
  const matches = functionName.match(/^(\S+)_(\S+)/);  // Look for func names beginning with a REST prefix

  if (matches) {
    httpMethod = matches[1];
    resourceName = matches[2];
  } else {
    // Return non-changed flag cos this function wasn't mean to be for an API endpoint
    return isFirstEndpoint;
  }

  if ((!resourceName) || (REST_HTTP_FUNCS_PREFIXES.indexOf(httpMethod) < 0)) {
    // Return non-changed flag cos this function wasn't mean to be for an API endpoint
    return isFirstEndpoint;
  }
  
  if (!isFirstEndpoint) {
    fs.appendFileSync(configFile, ',');
  }

  fs.appendFileSync(configFile, '\n');

  const configJson = `  {
    "route": "/${resourceName}",
    "http_method": "${httpMethod}",
    "function_name": "${functionName}",
    "validation_method": "SECRET_AS_QUERY_PARAM",
    "secret_name": "HTTPS_TMP_PWD_SECRET",
    "respond_result": true,
    "fetch_custom_user_data": false,
    "create_user_on_auth": false,
    "disabled": false,
    "return_type": "JSON"
  }`;  

  fs.appendFileSync(configFile, configJson);
  return false;  // Indicate that no longer first endpoint created
}
