// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
"use strict";
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
var tl = require('vsts-task-lib/task');
var Q = require('q');
var onError = function (errMsg) {
    tl.error(errMsg);
    tl.exit(1);
};
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
if (cfToolLocation != tl.getVariable('build.sourcesDirectory')) {
    //custom tool location for cf CLI was specified
    cfPath = cfToolLocation;
}
else {
    //tool location for cf CLI was not specified, show error if cf CLI is not in the PATH
    if (!cfPath) {
        onError('cf CLI is not found in the path. Install the cf CLI: https://github.com/cloudfoundry/cli.');
    }
}
//login using cf CLI login
function loginToCF() {
    return Q.fcall(function () {
        var cfLogin = tl.createToolRunner(cfPath);
        cfLogin.arg('login');
        cfLogin.arg('-a');
        cfLogin.arg(cfEndpointUrl);
        cfLogin.arg('-u');
        cfLogin.arg(cfEndpointAuth['parameters']['username']);
        cfLogin.arg('-p');
        cfLogin.arg(cfEndpointAuth['parameters']['password']);
        if (tl.getBoolInput('oneTimePassword')) {
            cfLogin.arg('--sso');
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
        return cfLogin.exec();
    });
}
//create a service using cf CLI create-user-provided-service
function createService(createServiceArgs) {
    return Q.fcall(function () {
        if (createServiceArgs && createServiceArgs.trim() != '') {
            //cf cups = create-user-provided-service
            var cfCups = tl.createToolRunner(cfPath);
            cfCups.arg('create-user-provided-service');
            cfCups.argString(createServiceArgs);
            return cfCups.exec();
        }
        else {
            return Q(0);
        }
    });
}
//create multiple services based on user input
function createServices() {
    return Q.fcall(function () {
        var serviceDetails = tl.getDelimitedInput('createServiceArgs', '\n', false);
        if (tl.getBoolInput('createServices') && serviceDetails && serviceDetails.length > 0) {
            var result = Q({});
            serviceDetails.forEach(function (fn) {
                result = result.then(function () {
                    return createService(fn);
                });
            });
            return result;
        }
        else {
            tl.debug('User did not choose to create a service or provide any service details.');
            return Q(0);
        }
    });
}
//push app using cf CLI push
function pushAppToCF() {
    return Q.fcall(function () {
        tl.cd(workingDir);
        var cfPush = tl.createToolRunner(cfPath);
        cfPush.arg('push');
        if (tl.getInput('deploymentOptions') == 'manifest') {
            if (tl.getInput('cfManifest', true)) {
                cfPush.arg('-f');
                cfPush.arg(tl.getInput('cfManifest'));
            }
        }
        else if (tl.getInput('deploymentOptions') == 'manual') {
            //set the command line arguments for all the options specified in the UI
            if (tl.getInput('name')) {
                cfPush.arg(tl.getInput('name'));
            }
            if (tl.getInput('instances')) {
                cfPush.arg('-i');
                cfPush.arg(tl.getInput('instances'));
            }
            if (tl.getInput('memoryLimit')) {
                cfPush.arg('-m');
                cfPush.arg(tl.getInput('memoryLimit'));
            }
            if (tl.getInput('startCommand')) {
                cfPush.arg('-c');
                cfPush.arg(tl.getInput('startCommand'));
            }
            if (tl.getInput('domain')) {
                cfPush.arg('-d');
                cfPush.arg(tl.getInput('domain'));
            }
            if (tl.getInput('host')) {
                cfPush.arg('--hostname');
                cfPush.arg(tl.getInput('host'));
            }
        }
        //any additional arguments to pass to cf push
        if (tl.getInput('additionalDeployArgs')) {
            cfPush.argString(tl.getInput('additionalDeployArgs'));
        }
        return cfPush.exec();
    });
}
//restage an app after binding services using cf CLI
function restageApp(appName) {
    return Q.fcall(function () {
        var cfRestage = tl.createToolRunner(cfPath);
        cfRestage.arg('restage');
        cfRestage.arg(appName);
        return cfRestage.exec();
    });
}
//bind one service to an app using cf CLI
function bindServiceToApp(appName, service) {
    return Q.fcall(function () {
        if (appName && service && service.trim() != '') {
            var cfBindService = tl.createToolRunner(cfPath);
            cfBindService.arg('bind-service');
            cfBindService.arg(appName);
            cfBindService.argString(service);
            return cfBindService.exec();
        }
        else {
            return Q(0);
        }
    });
}
//bind multiple serivces to an app based on user input
function bindServicesToApp() {
    return Q.fcall(function () {
        var services = tl.getDelimitedInput('bindServiceArgs', '\n', false);
        if (tl.getBoolInput('bindServices') && services && services.length > 0) {
            //get the application name from services group or deployment options group
            var appName = tl.getInput('appName');
            if (!appName) {
                appName = tl.getInput('name');
            }
            if (!appName) {
                onError('Application name to bind services is not specified.');
            }
            var result = Q({});
            services.forEach(function (fn) {
                result = result.then(function () {
                    return bindServiceToApp(appName, fn);
                });
            });
            result.then(function (code) {
                tl.debug('Successfully bound all services to the application. Restaging the application for changes to take effect.');
                return restageApp(appName);
            }).fail(function (err) {
                onError("Failed to bind services to app. " + err);
            });
        }
        else {
            tl.debug('User did not choose to bind services or specify any services to bind to the application.');
            return Q(0);
        }
    });
}
//The main task logic to push an app to Cloud Foundry
loginToCF()
    .then(function (code) {
    tl.debug('cf login succeeded, create services if applicable.');
    createServices()
        .then(function (code) {
        tl.debug('Finished creating services if applicable, push app using cf CLI.');
        pushAppToCF()
            .then(function (code) {
            tl.debug('Successfully pushed app, now bind to existing services if applicable.');
            bindServicesToApp()
                .fail(function (err) {
                onError('Failed to bind services to the application. ' + err);
            });
        })
            .fail(function (err) {
            onError('Failed to push app to Cloud Foundry. ' + err);
        });
    })
        .fail(function (err) {
        onError('Failed to create services in Cloud Foundry. ' + err);
    });
})
    .fail(function (err) {
    onError('Failed to login to the Cloud Foundry endpoint. Verify the URL and credentials. ' + err);
});
