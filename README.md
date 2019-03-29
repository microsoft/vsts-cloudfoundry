# vsts-cloudfoundry

[![Build Status](https://dev.azure.com/mseng/AzureDevOps/_apis/build/status/Microsoft.vsts-cloudfoundry?branchName=master)](https://dev.azure.com/mseng/AzureDevOps/_build/latest?definitionId=8377&branchName=master)

[![Build status](https://dev.azure.com/mseng/AzureDevOps/_apis/build/status/Teams/CIX/GitHub.vsts-cloudfoundry.CI)](https://dev.azure.com/mseng/AzureDevOps/_build/latest?definitionId=3417)

Cloud Foundry build extension for Azure DevOps allows you to automate the deployment process to any Cloud Foundry instance. This extension provides a build task to enable you to push applications to any Cloud Foundry instance. It also includes a Utility task to run any Cloud Foundry CLI commands as part of your build process.

## Create a Cloud Foundry Connection

Create a Generic Service Endpoint and specify your Cloud Foundry API endpoint URL, email/username and password.

Open the settings/admin page for your account and go to `Services` tab.

![Cloud Foundry Endpoint](Extension/images/cfEndpoint.png)

Enter the endpoint details.

![Generic Endpoint Details](images/cfGenericEndpoint.png)

## Define your build process

Create a build definition to automate your build process. For detailed instructions on setting up a build definition, check [this](https://msdn.microsoft.com/library/vs/alm/build/define/create)

Add the Cloud Foundry Build tasks to your build steps and setup the arguments. The `Cloud Foundry` build task to push applications to Cloud Foundry can be found under `Deploy` category. The `Cloud Foundry CLI` task to run any Cloud Foundry CLI command can be found under the `Utility` category.

![Cloud Foundry Build Tasks](Extension/images/cfBuildTasks.png)

## Install Cloud Foundry CLI on your build agent

Use the `Cloud Foundry CLI Install` task.

The task will look for the Cloud Foundry CLI in the PATH on the build machine. An alternate path to the Cloud Foundry CLI can be specified in the `Advanced` section of the task. This can be a local path on the build machine or a server path.

## Contributing

We love and encourage community contributions. To contribute:

1. Submit issues for bugs or suggestions to help us improve the extension
1. Fork the code and submit pull requests for any bug fixes or features

## Build pre-requisites

1. This package requires `node` and `npm`

## To compile, run

1. npm install
1. gulp

The vsix package will be produced in `_package`, and it can be uploaded to Azure DevOps Marketplace for sharing. 
