# RSS checker 2 for Azure Functions

## How to run this in your local Windows

1) azurite --silent --location .cache/azurite --debug .cache/azurite/debug.log
2) func start --verbose

## How to run this on Azure

### 1) Configure Azure parameters

```bash
vim secrets/create-remote.rc.bash
```

eg.

```bash
resource_group='DiffRss-rg'
location='japanwest'
storage_name='diffrssstorage'
sku='Standard_LRS'
```

@see create-remote.bash

### 2) Login Azure by `az login` CLI command

```bash
az login
```

### 3) Run `./create-remote.bash` command

```bash
./create-remote.bash
```

### 4) Configure remote "Application settings" from Web browser

* [Azure Portal](https://portal.azure.com/#home)
* ->"Function App"
* ->"DiffRss"
* ->"Configuration"
* ->"New Application Setting"

#### Define them

* LINE_ID
* LINE_ACCESS_TOKEN
* DIFFRSS_SCHEDULE

### 5) Publish DiffRss

```bash
func azure functionapp publish DiffRss
```
