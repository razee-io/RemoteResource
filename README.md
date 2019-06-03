# RemoteResource

[![Build Status](https://travis-ci.com/razee-io/RemoteResource.svg?branch=master)](https://travis-ci.com/razee-io/RemoteResource)
![GitHub](https://img.shields.io/github/license/razee-io/RemoteResource.svg?color=success)

RemoteResource is the most basic piece needed when working with kapitan for resource deployment. This is the component that retrieves and applies all of your other resources.

## Install

```shell
kubectl apply -f "https://github.com/razee-io/RemoteResource/releases/latest/download/resource.yaml"
```

## Resource Definition

```yaml
apiVersion: "kapitan.razee.io/v1alpha1"
kind: RemoteResource
metadata:
  name: <remote_resource_name>
  namespace: <namespace>
spec:
  requests:
    - options:
        url: https://<source_repo_url>/<file_name1>
        headers:
          <header_key1>: <header_value1>
          <header_key2>: <header_value2>
    - optional: true
      options:
        url: http://<source_repo_url>/<file_name2>
```

Fields:
- `.spec.requests`
  - required: true
  - type: array

## Features

### options
