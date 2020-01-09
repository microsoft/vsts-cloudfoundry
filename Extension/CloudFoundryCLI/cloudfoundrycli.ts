// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('azure-pipelines-task-lib');
import path = require('path');
import fs = require('fs');
import Q = require('q');
import {IExecOptions}  from 'azure-pipelines-task-lib/toolrunner';


tl.setResourcePath(path.join(__dirname, 'task.json'));

var cfEndpoint = tl.getInput('cfEndpoint', true);
var cfEndpointUrl = tl.getEndpointUrl(cfEndpoint, false);
var cfEndpointAuth = tl.getEndpointAuthorization(cfEndpoint, false);
var workingDir = tl.getInput('workingDirectory', true);
var cfPath = tl.which('cf');


if (tl.filePathSupplied('cfToolLocation')) {
    tl.debug('Using supplied tool location');
    cfPath = tl.getPathInput('cfToolLocation');
}

function getOptions() {
    const  CFHOMEKEY = 'CF_HOME';
    var options = <IExecOptions>{};
    options.env = process.env;

    if(!(CFHOMEKEY in options.env)){
        const tempDir = tl.getVariable('Agent.TempDirectory');
        // overriding config dir so that different agents on the same host can run. https://docs.cloudfoundry.org/cf-cli/cf-help.html 
        options.env['CF_HOME'] = path.join(tempDir, 'cfCLI');
    }
    
    return options;
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
        if (tl.getBoolInput('skipSSLValidation')) {
            cfLogin.arg('--skip-ssl-validation');
        }
        if (tl.getInput('org')) {
            cfLogin.arg('-o');
            cfLogin.arg(tl.getInput('org'));
        }
        if (tl.getInput('space')) {
            cfLogin.arg('-s');
            cfLogin.arg(tl.getInput('space'));
        }

        tl.debug('Login to connect to cf instance');
        return cfLogin.exec(getOptions());
    });
}


if (!cfPath) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('CLINotFound'));
} else if (!fs.existsSync(cfPath)) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('CLINotFoundInPath', cfPath));
} else {
    //The main task login to run cf CLI commands
    loginToCF()
        .then(function (code) {
            tl.cd(workingDir);
            var cfCmd = tl.tool(cfPath);
            cfCmd.arg(tl.getInput('cfCommand', true));
            var args = tl.getInput('cfArguments');
            if (args) {
                cfCmd.line(args);
            }
            cfCmd.exec(getOptions())
                .fail(function (err) {
                    tl.setResult(tl.TaskResult.Failed, '' + err);
                });
        })
        .fail(function (err) {
            tl.error(err);
            tl.setResult(tl.TaskResult.Failed, tl.loc('EndPointCredentials'));
        })
}
