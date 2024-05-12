#! /bin/bash -eux
#* SPDX-License-Identifier: AGPL-3.0-or-later

scripts_dir=$(dirname $0)
project_dir="$scripts_dir/.."

echo '1st, you must login to Azure. Type: 
    az login
@See https://docs.microsoft.com/ja-jp/azure/azure-functions/create-first-function-cli-node?tabs=azure-cli%2Cbrowser
' >&2

# Define them in "$project_dir/secrets/create-remote.rc.bash"
#   resource_group="${resource_group-AzFunBot-rg}"
#   location="${location-japanwest}"
#   storage_name="${storage_name-azfunbotstorage}"
#   sku="${sku-Standard_LRS}"
source "$project_dir/secrets/create-remote.rc.bash"

app_name='azfunbot'
function_ver='4'
node_ver='20'
os='Windows'

az group create --name "$resource_group" --location "$location"
az storage account create --name "$storage_name" --location "$location" --resource-group "$resource_group" --sku "$sku"
az functionapp create --resource-group "$resource_group" --consumption-plan-location "$location" --os-type "$os" --runtime node --runtime-version "$node_ver" --functions-version "$function_ver" --name "$app_name" --storage-account "$storage_name"

echo "If you want to deploy $app_name, you type:

    func azure functionapp publish $app_name

If you want to delete, you type:

    az group delete --name $resource_group
" >&2
