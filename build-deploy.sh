#!/bin/bash

# Load environment variables from '.env' file
source .env   

# Build app (converting Node.js funcs to app services funcs)
node convert-to-app-svcs-proj.js  

# Undeploy old app (if it exists)
cd app
realm-cli apps delete --app="${APP_NAME}" -y
printf "^ Ignore 'app delete failed' errors here if the app was not previously deployed\n"

# Deploy skeleton version of the app
realm-cli push -y
printf "^ Ignore 'push failed' errors here because these will be fixed by a subsequent push\n"

# Upload secrets required by the app
realm-cli secrets create --app="${APP_NAME}" --name "ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY_SECRET" --value "${ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY}"
realm-cli secrets create --app="${APP_NAME}" --name "ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY_SECRET" --value "${ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY}"
realm-cli secrets create --app="${APP_NAME}" --name "DB_NAME_SECRET" --value "${DB_NAME}"
realm-cli secrets create --app="${APP_NAME}" --name "HTTPS_TMP_PWD_SECRET" --value "12345"   # Temporarily hardcoded for early dev
#realm-cli secrets create --app="${APP_NAME}" --name "HTTPS_TMP_PWD_SECRET" --value "$(openssl rand -hex 16)"

# Deploy full version of the app
realm-cli push --include-node-modules -y

# Enable virtual hosting and print the app's URL
realm-cli function run --app="${APP_NAME}" --name PUB_enableAppVirtualHosting
realm-cli function run --app="${APP_NAME}" --name PUB_getAppVirtualHostingURL
cd ..