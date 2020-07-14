# RemoteResource

[![Build Status](https://travis-ci.com/razee-io/RemoteResource.svg?branch=master)](https://travis-ci.com/razee-io/RemoteResource)
![GitHub](https://img.shields.io/github/license/razee-io/RemoteResource.svg?color=success)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=razee-io/RemoteResource)](https://dependabot.com)

RemoteResource is the foundation for implementing continuous deployment with
razeedeploy. It retrieves and applies the configuration for all resources.

## Install

```shell
kubectl apply -f "https://github.com/razee-io/RemoteResource/releases/latest/download/resource.yaml"
```

## Resource Definition

### Sample

```yaml
apiVersion: "deploy.razee.io/v1alpha2"
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
          <header_key3>:
            valueFrom:
              secretKeyRef:
                name: <name of secret resource>
                namespace: <optional namespace of secret resource>
                key: <key in secret>
    - optional: true
      options:
        url: http://<source_repo_url>/<file_name2>
```

### Spec

**Path:** `.spec`

**Description:** `spec` is required and **must** include section `requests`.

**Schema:**

```yaml
spec:
  type: object
  required: [requests]
  properties:
    requests:
      type: array
      ...
```

### Request Options

**Path:** `.spec.requests[].options`

**Description:** All options defined in an options object will be passed as-is
to the http request. This means you can specify things like headers for
authentication in this section. See [RemoteResourceS3](https://github.com/razee-io/RemoteResourceS3)
for authenticating with an S3 object store.

**Note:** You can reference secret data in your header options by setting the value
of any key in the headers to be `valueFrom.secretKeyRef`.
eg. `.spec.requests[].options.headers.<yourHeaderKey> =
.valueFrom.secretKeyRef.{name, namespace, key}`

**Schema:**

```yaml
options:
  type: object
  oneOf:
    - required: [url]
    - required: [uri]
  properties:
    url:
      type: string
      format: uri
    uri:
      type: string
      format: uri
    headers:
      type: object
      x-kubernetes-preserve-unknown-fields: true
```

### Optional Request

**Path:** `.spec.requests[].optional`

**Description:** if download or applying child resource fails, RemoteResource
will stop execution and report error to `.status`. You can allow execution to
continue by marking a reference as optional.

**Schema:**

```yaml
optional:
  type: boolean
```

**Default:** `false`

### Managed Resource Labels

#### Reconcile

Child resource: `.metadata.labels[deploy.razee.io/Reconcile]`

- DEFAULT: `true`
  - A razeedeploy resource (parent) will clean up a resources it applies (child)
when either the child is no longer in the parent resource definition or the
parent is deleted.
- `false`
  - This behavior can be overridden when a child's resource definition has
the label `deploy.razee.io/Reconcile=false`.

#### Resource Update Mode

Child resource: `.metadata.labels[deploy.razee.io/mode]`

Razeedeploy resources default to merge patching children. This behavior can be
overridden when a child's resource definition has the label
`deploy.razee.io/mode=<mode>`

Mode options:

- DEFAULT: `MergePatch`
  - A simple merge, that will merge objects and replace arrays. Items previously
  defined, then removed from the definition, will be removed from the live resource.
  - "As defined in [RFC7386](https://tools.ietf.org/html/rfc7386), a Merge Patch
  is essentially a partial representation of the resource. The submitted JSON is
  "merged" with the current resource to create a new one, then the new one is
  saved. For more details on how to use Merge Patch, see the RFC." [Reference](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#patch-operations)
- `StrategicMergePatch`
  - A more complicated merge, the kubernetes apiServer has defined keys to be
  able to intelligently merge arrays it knows about.
  - "Strategic Merge Patch is a custom implementation of Merge Patch. For a
  detailed explanation of how it works and why it needed to be introduced, see
  [StrategicMergePatch](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-api-machinery/strategic-merge-patch.md)."
  [Reference](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#patch-operations)
  - [Kubectl Apply Semantics](https://kubectl.docs.kubernetes.io/pages/app_management/field_merge_semantics.html)
- `EnsureExists`
  - Will ensure the resource is created and is replaced if deleted. Will not
  enforce a definition.

### Debug Individual Resource

`.spec.resources.metadata.labels[deploy.razee.io/debug]`

Treats the live resource as EnsureExist. If any razeedeploy component is enforcing
the resource, and the label `deploy.razee.io/debug: true` exists on the live
resource, it will treat the resource as ensure exist and not override any changes.
This is useful for when you need to debug a live resource and don't want razeedeploy
overriding your changes. Note: this will only work when you add it to live resources.
If you want to have the EnsureExist behavior, see [Resource Update Mode](#Resource-Update-Mode).

- ie: `kubectl label rr <your-rr> deploy.razee.io/debug=true`

### Lock Cluster Updates

Prevents the controller from updating resources on the cluster. If this is the
first time creating the `razeedeploy-config` ConfigMap, you must delete the running
controller pods so the deployment can mount the ConfigMap as a volume. If the
`razeedeploy-config` ConfigMap already exists, just add the pair `lock-cluster: true`.

1. `export CONTROLLER_NAME=remoteresource-controller && export CONTROLLER_NAMESPACE=razee`
1. `kubectl create cm razeedeploy-config -n $CONTROLLER_NAMESPACE --from-literal=lock-cluster=true`
1. `kubectl delete pods -n $CONTROLLER_NAMESPACE $(kubectl get pods -n $CONTROLLER_NAMESPACE
 | grep $CONTROLLER_NAME | awk '{print $1}' | paste -s -d ',' -)`
