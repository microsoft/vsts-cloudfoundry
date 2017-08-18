// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import process = require('process');
import Q = require('q');

var onError = function(errMsg) {
    tl.error(errMsg);
    process.exit(1);
}

var cfEndpoint = tl.getInput('cfEndpoint', true);
if (!cfEndpoint) {
    onError('The Cloud Foundry Endpoint could not be found');
}

var cfEndpointUrl = tl.getEndpointUrl(cfEndpoint, false);
if (!cfEndpointUrl) {
    onError('The Cloud Foundry Endpoint URL could not be found');
}

var cfEndpointAuth = tl.getEndpointAuthorization(cfEndpoint, false);
var workingDir = tl.getInput('workingDirectory', true);

var cfPath = tl.which('cf');
var cfToolLocation = tl.getInput('cfToolLocation');
if(cfToolLocation != tl.getVariable('System.DefaultWorkingDirectory')) {
    //custom tool location for cf CLI was specified
    cfPath = cfToolLocation;
} else {
    //tool location for cf CLI was not specified, show error if cf CLI is not in the PATH
    if (!cfPath) {
        onError('cf CLI is not found in the path. Install the cf CLI: https://github.com/cloudfoundry/cli.') 
    }
}

if(!fs.existsSync(cfPath)) {
    onError('cf CLI not found at: ' + cfPath);
}

//login using cf CLI login
function loginToCF() {
     return Q.fcall(() => {
        var cfLogin = tl.tool(cfPath);
        cfLogin.arg('login');
        cfLogin.arg('-a');
        cfLogin.arg(cfEndpointUrl);
        cfLogin.arg('-u');
        cfLogin.arg(cfEndpointAuth['parameters']['username']);
        cfLogin.arg('-p');
        cfLogin.arg(cfEndpointAuth['parameters']['password']);
        if (tl.getBoolInput('oneTimePassword')) {
            cfLogin.arg('--sso-passcode');
            cfLogin.arg(tl.getInput('ssoPasscode'));
        }
        if(tl.getBoolInput('skipSSLValidation')) {
            cfLogin.arg('--skip-ssl-validation');
        }
        if(tl.getInput('org')) {
            cfLogin.arg('-o');
            cfLogin.arg(tl.getInput('org'));
        }
        if(tl.getInput('space')) {
            cfLogin.arg('-s');
            cfLogin.arg(tl.getInput('space'));
        }

        tl.debug('Login to connect to cf instance');
        return cfLogin.exec();
     });
}

//The main task login to run cf CLI commands
loginToCF()
.then(function (code) {
   var cfCmd = tl.tool(cfPath);
   cfCmd.arg(tl.getInput('cfCommand', true));
   var args = tl.getInput('cfArguments');
   if(args) {
       cfCmd.line(args);
   }
   cfCmd.exec()
   .fail(onError);
})
.fail(function(err) {
    onError('Failed to login to the Cloud Foundry endpoint. Verify the URL and credentials. ' + err);
})

