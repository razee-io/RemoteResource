# RemoteResource

[![Build Status](https://travis-ci.com/razee-io/RemoteResource.svg?branch=master)](https://travis-ci.com/razee-io/RemoteResource)
![GitHub](https://img.shields.io/github/license/razee-io/RemoteResource.svg?color=success)

RemoteResource is the most basic piece needed when working with kapitan for resource deployment. This is the component that retrieves and applies all of your other resources.

## Install

```shell
kubectl apply -f "https://github.com/razee-io/RemoteResource/releases/latest/download/resource.yaml"
```

## Resource Definition

#### Sample:

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

#### Fields:

- `.metadata.labels[kapitan.razee.io/Reconcile]`
  - required: false
  - type: string
  - default: 'true'
- `.metadata.labels[kapitan.razee.io/mode]`
  - required: false
  - type: string
  - default: 'MergePatch'
- `.spec.requests`
  - required: true
  - type: array
- `.spec.requests.options`
  - required: true
  - type: object
- `.spec.requests.url` or `.spec.requests.uri`
  - required: true
  - type: string
- `.spec.requests.optional`
  - required: false
  - type: boolean
  - default: false

## Features

### Reconcile

A kapitan resource (parent) will clean up a resources it applies (child) when
either the child is no longer in the parent resource definition or the parent is deleted.
This behavior can be overridden when a child's resource definition has the label
`kapitan.razee.io/Reconcile=false`.

### Resource Update Mode

Kapitan resources default to merge patching children. This behavior can be
overridden when a child's resource definition has the label
`kapitan.razee.io/mode=<mode>`

Mode options:
- DEFAULT: `MergePatch`
  - A simple merge, that will merge objects and replace arrays. Items previously defined, then removed from the definition, will be removed from the live resource.
  - "As defined in [RFC7386](https://tools.ietf.org/html/rfc7386), a Merge Patch is essentially a partial representation of the resource. The submitted JSON is "merged" with the current resource to create a new one, then the new one is saved. For more details on how to use Merge Patch, see the RFC." [Reference](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#patch-operations)
- `StrategicMergePatch`
  - A more complicated merge, the kubernetes apiServer has defined keys to be able to
  intelligently merge arrays it knows about.
  - "Strategic Merge Patch is a custom implementation of Merge Patch. For a detailed explanation of how it works and why it needed to be introduced, see [StrategicMergePatch](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-api-machinery/strategic-merge-patch.md)." [Reference](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#patch-operations)
  - [Kubectl Apply Semantics](https://kubectl.docs.kubernetes.io/pages/app_management/field_merge_semantics.html)
- `EnsureExists`
  - Will ensure the resource is created and is replaced if deleted. Will not enforce a definition.
