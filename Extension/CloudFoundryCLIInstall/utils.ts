"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');
import toolLib = require('azure-pipelines-tool-lib/tool');
import os = require('os');
import util = require('util');

import uuidV4 = require('uuid/v4');
const toolName = "cf";
const isWindows = os.type().match(/^Win/);
const toolNameWithExtension = toolName + getExecutableExtension();

export async function downloadCF(version: string): Promise<string> {
   
    var cleanVersion = version.replace(/(0+)([1-9]+)/,"$2");
    var cachedToolpath = toolLib.findLocalTool(toolName, cleanVersion);
   
    if (!cachedToolpath) {
        try {
            var cfDownloadPath = await toolLib.downloadTool(getDownloadURL(version), toolName + "-" + uuidV4() + getArchiveExtension());
        } catch (exception) {
            throw new Error(tl.loc("CFDownloadFailed", getDownloadURL(version), exception));
        }

        var unzipedCFPath: string;
        if(isWindows) {
            unzipedCFPath = await toolLib.extractZip(cfDownloadPath);
        } else {
            //tgz is a tar file packaged using gzip utility
            unzipedCFPath = await toolLib.extractTar(cfDownloadPath);
        }

        // caching only "cf(.exe)" CLI
        unzipedCFPath = path.join(unzipedCFPath, toolNameWithExtension);
        cachedToolpath = await toolLib.cacheFile(unzipedCFPath, toolNameWithExtension, toolName, cleanVersion);
    }

    var cfPath = findCFCli(cachedToolpath);
    if (!cfPath) {
        throw new Error(tl.loc("CFCLINotFoundInFolder", cachedToolpath))
    }

    fs.chmodSync(cfPath, "777");
    return cfPath;
}

function findCFCli(rootFolder: string) {
    var cfPath = path.join(rootFolder, toolNameWithExtension);
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = tl.match(allPaths, cfPath, rootFolder);
    return matchingResultsFiles[0];
}


function getDownloadURL(version: string): string {
    var platform;
    switch (os.type()) {
        case 'Linux':
            platform = "linux64-binary"; break;

        case 'Darwin':
            platform = "macosx64-binary"; break;

        default:
        case 'Windows_NT':
            platform = "windows64-exe"; break;
    }
    return util.format("https://packages.cloudfoundry.org/stable?release=%s&version=%s&source=azure-pipelines", platform, version);
}

function getExecutableExtension(): string {
    if (isWindows) {
        return ".exe";
    }
    return "";
}

function getArchiveExtension(): string {
    if(isWindows) {
        return ".zip";
    }
    return ".tgz";
}
