"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as utils from "./utils";

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function configureCF() {
    var version = tl.getInput("cfVersion", true);
    var cfPath = await utils.downloadCF(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(cfPath))) {
        toolLib.prependPath(path.dirname(cfPath));
    }
}

async function verifyCF() {
    console.log(tl.loc("VerifyCFInstallation"));
    var cfToolPath = tl.which("cf", true);
    var cf = tl.tool(cfToolPath);
    cf.arg("--version");
    return cf.exec();
}

configureCF()
    .then(() => verifyCF())
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, error));