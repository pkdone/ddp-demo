# Data Delivery Platform (DDP) Demo

This project provides a demo to TODO. 


## Prerequisites

 1. Ensure you have a running Atlas MongoDB cluster which is has a tier of M2 or greater or is a Serverless instance. Ensure the cluster has a database user which has __read + write privileges the `ddp-db` database__ and ensure the Atlas Project's network access includes an access list entry to allow access from your workstation's IP address.

 2. TODO: load data into the database

 3. TODO: create indexes

 4. For your Atlas project which contains the Atlas database cluster to be used by the demo, using the Atlas console, create a Project API Key for the project with just the `Project Owner` role enabled (be sure to save a copy of the generated private key as this is only shown once). 

 5. From the Atlas console, navigate to your project, open `Project Settings` and make a note of your `Group ID` (a.k.a. 'Project ID').

 8. From a terminal on your workstation, ensure you have Node.js installed then from the root folder of this project, run the following to install the required Node.js library modules:

  ```console
  npm install
  ```

 9. From a terminal on your workstation, install the Atlas App Services command line tool and login your tool with the Atlas project using your Project API Key (change the two key values, marked as `XXXX` with your public and private parts of your __Project API key__):

```console
sudo npm install -g mongodb-realm-cli
realm-cli login --api-key="XXXX" --private-api-key="XXXX"
```

10. In the root folder of this project, run the following command to copy an example environment configuration file to a new file in the root folder called `.env`, and then edit the values for the properties shown in this new `.env` file to reflect the your specific environment settings:

```console
cp 'EXAMPLE.env' '.env'
```


## Deploy / Redeploy

 1. From a terminal on your workstation, in the root folder of this project, execute the following command which will rebuild the app from its source files and deploy the app to Atlas using the Atlas App Service's command-line tool (`realm-cli`):

```console
./build-deploy.sh
```


 2. TODO - front-end UI doesn't exist yet so don't try this step. Access the demo's user interface via a web browser, using the URL printed towards the end of the output from the script run in the previous step (`build-deploy.sh`), and then register as a new user.



## Coding And Running The App Back-End Locally On Your Workstation

Using Node.js installed on your workstation and your IDE of choice (e.g. _VS Code_), you can locally develop, refactor, run and debug the JavaScript functions in the main back-end source `back-end/ddp-demo.js` file. The top of the source file contains sample code to run any of the API functions that will subsequently be exposed at HTTPS Endpoints when deployed as an Atlas App Services project. Just uncomment the line which invokes the particular function you want to test and debug before running from your IDE or command-line. Example Node.js command-line:

```console
./node ddp-demo.js
```

When you execute one of the functions in the `back-end/ddp-demo.js` file, the result will be written to the file `tmp/results.json` in your workstation project. This file output is helpful when you need to view the contents of large API response.


## Testing App Services HTTPS Endpoints

The generated HTTPS Endpoints have authorization based on a secret enabled. As a result the query string `secret=xxxxxx` needs to be passed as part of the HTTP request, where `xxxxxx` should be replaced with the value of the `HTTPS_TMP_PWD_SECRET` secret. However, this secret is scheduled to be changed to a new random value every 15 minutes. Therefore, when testing the endpoint, using Curl from a terminal for example, you first need to find out the current value of the secret. To do this, in the App Services console, locate the function `PUB_getHTTPSTmpPwd` and execute it with no parameters via the Function Editor `> Run` button. This will return the current value of the secret which you can copy and then paste into your Curl command to be executed in the terminal.
