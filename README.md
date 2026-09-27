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
resource_group="${resource_group-AzFunBot-rg}"
location="${location-japanwest}" 
storage_name="${storage_name-azfunbotstorage}"
sku="${sku-Standard_LRS}"
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

```conf
LINE_ID={Your LINE ID}
LINE_ACCESS_TOKEN={Your Access Token}
DIFFRSS_SCHEDULE={Schedule to Watch RSS (e.g. 1 1 9 * * *)}
TELL_SCHEDULE={Schedule to tell to Users (e.g. 1 2 9 * * *)}
DIFFRSS_MAX_CHAR_LIMIT={Max Limit for LINE Text}
DIFFRSS_FETCH_TIMEOUT_MILLI_SEC={Timeout to fetch one feed in milliseconds (default: 30000)}
LINE_ADMIN_ID={LINE ID to notify errors to (optional)}
```

### 5) Publish DiffRss

e.g.

```bash
func azure functionapp publish AzFunBot
```

## How to maintain the entities

Use `scripts/maintain.mjs`, which calls the `maintain` API with curl.
The aliases such as `maintain:` are defined in `secrets/maintain.mjs.config.json`.

### Register the RSS feeds

`secrets/urls.json` is an array of feeds:

```json
[
  { "key": "jvn", "url": "https://jvn.jp/rss/jvn.rdf" },
  { "key": "gihyo", "url": "https://gihyo.jp/feed/atom" }
]
```

* `key` must match `^[A-Za-z0-9_-]{1,84}$` and must be unique.
* `url` must be an absolute `http` or `https` URL.

```bash
./scripts/maintain.mjs -k -X POST --json @secrets/urls.json 'maintain:?code=&key=urls'
```

The links already seen are saved per feed as `previous:<key>`.
A new feed is not notified on its first fetch; only later items are.

### Read or delete an entity

```bash
./scripts/maintain.mjs -k -X GET 'maintain:?code=&key=previous:jvn'
./scripts/maintain.mjs -k -X DELETE 'maintain:?code=&key=previous:jvn'
```

The legacy key `previous` (used up to v0.22.0) can only be deleted.

See [docs/specs/diffrss-partial-failure.md](docs/specs/diffrss-partial-failure.md) for details.
